const { EventEmitter } = require('events');
const WebTorrent = require('webtorrent');
const LSChunkStore = require('ls-chunk-store');
const createTorrent = require('create-torrent');
const debug = require('debug')('ug:engine');
const Bugout = require('bugout');
const { TorrentApplication, PackageApplication, isBrowser } = require('./index');


const TRACKERS = [
  "wss://tracker.openwebtorrent.com",
  // Dead:
  // "wss://tracker.fastcast.nz",
  // "wss://tracker.btorrent.xyz"
];


class PrefixedStorage {
  constructor(backend, prefix) {
    debug('Setting up storage with prefix %s', prefix);
    this.backend = backend;
    this.prefix = prefix;
  }

  _makeKey(key) {
    return `${this.prefix}:${key}`;
  }

  setItem(key, value) {
    key = this._makeKey(key);
    debug('Setting: %s to %s', key, value);
    this.backend.setItem(key, value);
  }

  getItem(key) {
    key = this._makeKey(key);
    const value = this.backend.getItem(key);
    debug('Read: %s from %s', value, key);
    return value;
  }

  removeItem(key) {
    key = this._makeKey(key);
    debug('Removing: %s', key);
    this.backend.removeItem(key);
  }

  clear() {
    debug('Clearing storage with prefix %s', this.prefix);

    let toRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = this.backend.key(i);

      if (key.startsWith(`${this.prefix}:`)) {
        toRemove.push(key);
      }
    }

    for (let i = 0; i < toRemove.length; i++) {
      debug('Clearing %s', toRemove[i]);
      this.backend.removeItem(toRemove[i]);
    }
  }
}

class PrefixedLocalStorage extends PrefixedStorage {
  constructor(prefix) {
    super(localStorage, prefix);
  }
}

class PrefixedSessionStorage extends PrefixedStorage {
  constructor(prefix) {
    super(sessionStorage, prefix);
  }
}

class Server extends EventEmitter {
  constructor(app, torrent) {
    super();
    this.id = (torrent && torrent.infoHash);
    this.app = app;
    this.torrent = torrent;
    this.bugout = new Bugout({
      torrent: torrent,
    });
    this._stats = {
      peers: 0,
      uploaded: 0,
      uploadSpeed: 0,
      maxUploadSpeed: 0,
      downloaded: 0,
      downloadSpeed: 0,
      maxDownloadSpeed: 0,
      ratio: 0,
      progress: 0,
    };
    this._storage = null;
    this._collect();
  }

  _collect() {
    /* Collect stats and log events. */
    debug('Setting up stats collection.');

    const torrent = this.torrent, stats = this._stats;

    // NOTE: stats that change frequently.
    torrent.on('upload', (bytes) => {
      stats.uploaded = torrent.uploaded;
      stats.uploadSpeed = torrent.uploadSpeed;
      stats.maxUploadSpeed = Math.max(
        stats.maxUploadSpeed, torrent.uploadSpeed);
      stats.ratio = torrent.ratio;
      stats.progress = torrent.progress;
      this.emit('stats', stats);
    });

    // NOTE: stats that change frequently.
    torrent.on('download', (bytes) => {
      stats.downloaded = torrent.downloaded;
      stats.downloadSpeed = torrent.downloadSpeed;
      stats.maxDownloadSpeed = Math.max(
        stats.maxDownloadSpeed, torrent.downloadSpeed);
      stats.ratio = torrent.ratio;
      stats.progress = torrent.progress;
      this.emit('stats', stats);
    });

    this.torrent.on('wire', () => {
      stats.peers = torrent.numPeers;
      this.emit('stats', stats);
    });

    torrent.on('warning', (msg) => this.emit('log', msg));
    torrent.on('error', (msg) => this.emit('log', msg));
  
    torrent.on('wire', (peer, addr) => {
      this.emit('log', 'Peer {0} connected', addr);
    });
    torrent.on('upload', (bytes) => {
      this.emit('log', 'Sent {0} bytes', bytes);
    });
  }

  get stats() {
    return JSON.parse(JSON.stringify(this._stats));
  }

  get storage() {
    if (this._storage === null) {
      this._storage = new PrefixedLocalStorage(`s:${torrent.infoHash}`);
    }
    return this._storage;
  }

  destroy() {
    return new Promise((resolve, reject) => {
      if (!this.torrent) {
        resolve();
        return;
      }

      this.torrent.destroy(() => {
        resolve();
      });
    });
  }

  flush() {
    return new Promise((resolve, reject) => {
      this
        .destroy()
        .then(() => {
          if (this.storage) {
            this.storage.clear();
          }
          resolve();
        });
    });
  }
}

class Engine extends EventEmitter {
  constructor(opts) {
    debug('Engine starting.');
    super();

    // Servers stored by torrent infoHash.
    opts = opts || {};
    opts.torrentOpts = {
      store: LSChunkStore,
      ...opts.torrentOpts,
    };

    this.servers = {};
    this.wt = opts.wt || new WebTorrent(opts.torrentOpts);
    this._stats = {
      // NOTE: initial values, so stats always exist.
      uploaded: 0,
      uploadSpeed: 0,
      maxUploadSpeed: 0,
      downloaded: 0,
      downloadSpeed: 0,
      maxDownloadSpeed: 0,
    };
    this._collect();
  }

  _collect() {
    this.wt.on('torrent', (torrent) => {
      debug('New torrent added: %s', torrent.infoHash);

      torrent.on('error', () => {
        debug('Torrent error, removing server: %s', torrent.infoHash);

        // We should remove the server, the torrent is going away.
        this.remove(torrent.infoHash);
      });

      // NOTE: stats that change frequently.
      torrent.on('upload', (bytes) => {
        this._stats.uploadSpeed = this.wt.uploadSpeed;
        this._stats.maxUploadSpeed = Math.max(
          this._stats.maxUploadSpeed, this.wt.uploadSpeed);
      });

      // NOTE: stats that change frequently.
      torrent.on('download', (bytes) => {
        this._stats.downloadSpeed = this.wt.downloadSpeed;
        this._stats.maxDownloadSpeed = Math.max(
          this._stats.maxDownloadSpeed, this.wt.downloadSpeed);
      });
    });
  }

  _getOrCreateTorrent(app) {
    /* Retrieves or creates a torrent for the given app. */
    debug('Getting or creating torrent for application.');

    return new Promise((resolve, reject) => {
      let appJson;
      if (isBrowser()) {
        appJson = new File([JSON.stringify(app._manifest())], 'app.json');
      } else {
        appJson = Buffer.from(JSON.stringify(app._manifest()));
        appJson.name = 'app.json';
      }
      const fileObjs = [
        appJson,
      ];
      const opts = {
        name: `${app.fields.name}-${app.fields.version}`,
        announce: TRACKERS,
        comment: app.description,
      };
  
      app.readFiles()
        .then((files) => {
          for (let i in files) {
            let fObj;
            if (isBrowser()) {
              fObj = new File([files[i].body], files[i].name));
            } else {
              fObj = Buffer.from(files[i].body);
              fObj.name = files[i].name;
            }
            fileObjs.push(fObj);
          }
          debug('Torrent contains: %O', fileObjs);

          // Create torrent to retrieve infoHash.
          createTorrent(fileObjs, opts, (e, tmp) => {
            if (e) {
              reject(e);
              return;
            }
      
            let torrent;
            // Get torrent if it is currently active.
            // tmp is a uint8Array instance.
            torrent = this.wt.get(tmp);
            if (torrent) {
              debug('Torrent exists.');
              resolve(torrent);
              return;
            }

            const _seed = () => {
              this.wt.seed(fileObjs, opts, (torrent) => {
                debug('Seeding torrent.');
                resolve(torrent);
              });  
            };

            // Attempt to join swarm.
            try {
              torrent = this.wt.add(tmp.infoHash, opts, (torrent) => {
                debug('Torrent created');
                resolve(torrent);
              });
            } catch (e) {
              debug('Error adding torrent');
              // Error, seed it.
              _seed();
            }

            // If an error occurs, seed the torrent.
            torrent.on('error', (e) => {
              debug('Error adding torrent');
              // Error, seed it.
              _seed();
            });
          });  
        });
    });
  }

  get(id) {
    return this.servers[id];
  }

  _add(server) {
    this.servers[server.id] = server;
    return server;
  }

  serve(file) {
    /* Adds a new server for application bundle. */
    debug('Creating server from file.');

    return new Promise((resolve, reject) => {
      PackageApplication
        .load(file)
        .then((app) => {
          debug('File extracted.');
          this._getOrCreateTorrent(app)
            .then((torrent) => {
              resolve(this._add(new Server(app, torrent)));
            })
            .catch(reject);
        })
        .catch(reject);
    });
  }

  fetch(id) {
    /* Fetches application via torrent. */
    debug('Fetching application: %s', id);

    return new Promise((resolve, reject) => {
      const _addServer = (torrent) => {
        TorrentApplication.load(torrent)
          .then((app) => {
            // NOTE: no storage.
            resolve(this._add(new Server(app, torrent)));
          })
          .catch(reject);
      }

      const server = this.get(id);
      if (server) {
        resolve(server);
        return;
      }
  
      const torrent = this.wt.get(id);
      if (torrent) {
        debug('Torrent exists');
        _addServer(torrent);
        return;
      }

      const opts = {
        announce: TRACKERS,
      };

      this.wt.add(id, opts, (torrent) => {
        debug('Torrent added');
        _addServer(torrent);
      });
    });
  }

  remove(id) {
    /* Removes an application. */
    debug('Removing server: %s', id);

    return new Promise((resolve, reject) => {
      const server = this.get(id);

      if (!server) {
        reject(new Error(`Invalid server.id ${id}`));
        return;
      }

      server
        .destroy()
        .then(() => {
          delete this.servers[id];
          resolve();
        })
        .catch(reject);
      });
  }

  flush(id) {
    /* Removes an application and it's storage. */
    debug('Flusing server: %s', id);

    return new Promise((resolve, reject) => {
      const server = this.get(id);

      if (!server) {
        reject(new Error(`Invalid server.id ${id}`));
        return;
      }

      server
        .flush()
        .then(resolve)
        .catch(reject);
    });
  }

  stats() {
    /* Compiles stats for engine and all servers. */
    return new Promise((resolve, reject) => {
      const engine = JSON.parse(JSON.stringify(this._stats));
      // NOTE: null key is global stats.
      const stats = {
        null: engine,
      };
      const keys = Object.keys(this.servers);

      keys.forEach((key) => {
        const server = this.get(key);
        stats[key] = server.stats;
      });

      // NOTE: stats that are sums.
      engine.length = keys.reduce((prev, curr) => {
        return (curr === null) ? prev : prev + stats[curr].length || 0;
      }, 0);
      engine.uploaded = keys.reduce((prev, curr) => {
        return (curr === null) ? prev : prev + stats[curr].uploaded || 0;
      }, 0);
      engine.downloaded = keys.reduce((prev, curr) => {
        return (curr === null) ? prev : prev + stats[curr].downloaded || 0;
      }, 0);
      engine.numPeers = keys.reduce((prev, curr) => {
        return (curr === null) ? prev : prev + stats[curr].numPeers || 0;
      }, 0);

      // NOTE: stats that are immediate (like gauges.)
      engine.ratio = this.wt.ratio;

      resolve(stats);
    });
  }
}

function _start() {
  window.engine = new Engine();

  // TODO: load past applications from localStorage and serve them.
}

// Only run in browser.
if (typeof(window) !== 'undefined' && 'browser' in window) {
  // This does not currently work, see:
  // https://bugs.chromium.org/p/chromium/issues/detail?id=64100&q=registerprotocolhandler%20extension&can=2
  const url = chrome.runtime.getURL('/dist/html/view.html?url=%s');
  debug('URL for protocol handler: %s', url);
  try {
    navigator.registerProtocolHandler(
      'web+ug', url, 'Web Underground scheme');
  } catch (e) {
    debug('Error installing protocol handler', e);    
  }

  _start();
}

module.exports = {
  Engine,
  Server,
  PrefixedLocalStorage,
  PrefixedSessionStorage,
};
