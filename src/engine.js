const { EventEmitter } = require('events');
const WebTorrent = require('webtorrent');
const LSChunkStore = require('ls-chunk-store');
const createTorrent = require('create-torrent');
const debug = require('debug')('ug:engine');
const Bugout = require('bugout');
const { TorrentApplication, PackageApplication } = require('./index');


const TRACKERS = [
  "wss://tracker.openwebtorrent.com",
  // Dead:
  // "wss://tracker.fastcast.nz",
  // "wss://tracker.btorrent.xyz"
];


class PrefixedLocalStorage {
  constructor(prefix) {
    debug('Setting up storage with prefix %s', prefix);
    this.prefix = prefix;
  }

  _makeKey() {
    return `${this.prefix}-${key}`;
  }

  setItem(key, value) {
    localStorage.setItem(this._makeKey(key), value);
  }

  getItem(key) {
    return localStorage.getItem(this._makeKey(key));
  }

  removeItem(key) {
    localStorage.removeItem(this._makeKey(key));
  }

  clear() {
    debug('Clearing storage with prefix %s', this.prefix);

    let toRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key.startsWith(this.prefix)) {
        toRemove.push(key);
      }
    }

    for (let i = 0; i < toRemove.length; i++) {
      locaStorage.removeItem(toRemove[i]);
    }
  }
}

class Server extends EventEmitter {
  constructor(app, torrent, storage) {
    super();
    this.id = (torrent && torrent.infoHash);
    this.app = app;
    this.torrent = torrent;
    this.storage = storage;
    this.bugout = new Bugout({
      torrent: torrent,
    });
    this._stats = {};
    this._collect();
  }

  _collect() {
    // NOTE: stats that change frequently.
    this.torrent.on('upload', (bytes) => {
      this._stats.uploaded = this.torrent.uploaded;
      this._stats.uploadSpeed = this.torrent.uploadSpeed;
      this._stats.maxUploadSpeed = Math.max(
        this._stats.maxUploadSpeed, this.torrent.uploadSpeed);
    });

    // NOTE: stats that change frequently.
    this.torrent.on('download', (bytes) => {
      this._stats.downloaded = this.torrent.downloaded;
      this._stats.downloadSpeed = this.torrent.downloadSpeed;
      this._stats.maxDownloadSpeed = Math.max(
        this._stats.maxDownloadSpeed, this.torrent.downloadSpeed);
    });

    this.torrent.on('wire', () => {
      this._stats.numPeers = this.torrent.numPeers;
    });
  }

  get stats() {
    return JSON.parse(JSON.stringify(this._stats));
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

  _createStorage(id) {
    return new PrefixedLocalStorage(id);
  }

  _getOrCreateTorrent(app) {
    /* Retrieves or creates a torrent for the given app. */
    debug('Getting or creating torrent for application.');

    return new Promise((resolve, reject) => {
      const fileObjs = [
        new File([JSON.stringify(app._manifest())], 'app.json'),
      ];
      const opts = {
        name: `${app.fields.name}-${app.fields.version}`,
        announce: TRACKERS,
        comment: app.description,
      };
  
      app.readFiles()
        .then((files) => {
          for (let i in files) {
            fileObjs.push(new File([files[i].body], files[i].name));
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

  createServer(file) {
    /* Adds a new server for application bundle. */
    debug('Creating server from file.');

    return new Promise((resolve, reject) => {
      PackageApplication
        .load(file)
        .then((app) => {
          debug('File extracted.');
          this._getOrCreateTorrent(app)
            .then((torrent) => {
              // NOTE: torrent.infoHash === server.id.
              const storage = this._createStorage(torrent.infoHash);
              resolve(this._add(new Server(app, torrent, storage)));
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
        stats[key].ratio = server.torrent.ratio;
        stats[key].progress = server.torrent.progress;
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
if (document) {
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

  // Only start engine if running as web extension.
  if ('browser' in window) {
    _start();
  }
}

module.exports = {
  Engine,
  Server,
};
