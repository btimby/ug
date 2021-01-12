const WebTorrent = require('webtorrent');
const LSChunkStore = require('ls-chunk-store');
const createTorrent = require('create-torrent');
const parseTorrent = require('parse-torrent');
const debug = require('debug')('ug:engine');
const { TorrentApplication, PackageApplication } = require('./index');


const TRACKERS = [
  "wss://tracker.openwebtorrent.com",
  // Dead:
  // "wss://tracker.fastcast.nz",
  // "wss://tracker.btorrent.xyz"
];


class PrefixedLocalStorage {
  constructor(prefix) {
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

class Server {
  constructor(app, torrent, storage) {
    this.id = (torrent && torrent.infoHash);
    this.app = app;
    this.torrent = torrent;
    this.storage = storage;
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


class Engine {
  constructor() {
    // Servers stored by torrent infoHash.
    this.servers = {};
    this.wt = new WebTorrent({
      store: LSChunkStore,
    })
    .on('torrent', this._collectStats.bind(this));
    this._stats = {
      // NOTE: null key holds aggregate stats.
      null: {
        // NOTE: initial values, so stats always exist.
        uploaded: 0,
        uploadSpeed: 0,
        maxUploadSpeed: 0,
        downloaded: 0,
        downloadSpeed: 0,
        maxDownloadSpeed: 0,
        },
    };
  }

  _collectStats(torrent) {
    // Hook up event listeners to maintain per-torrent and global stats.
    const stats = this._stats[torrent.infoHash] = {
      // NOTE: stat(s) that don't change.
      length: torrent.length,
      id: torrent.infoHash,

      // NOTE: initial values, so stats always exist.
      isSeeding: false,
      isServing: false,
      uploaded: 0,
      uploadSpeed: 0,
      maxUploadSpeed: 0,
      downloaded: 0,
      downloadSpeed: 0,
      maxDownloadSpeed: 0,
      ratio: 0,
      numPeers: 0,
    };

    torrent.on('error', () => {
      delete this._stats[torrent.infoHash];
    });

    // NOTE: stats that change frequently.
    torrent.on('upload', (bytes) => {
      const gStats = this._stats[null];
      gStats.uploadSpeed = this.wt.uploadSpeed;
      gStats.maxUploadSpeed = Math.max(gStats.maxUploadSpeed, this.wt.uploadSpeed);

      stats.uploaded = torrent.uploaded;
      stats.uploadSpeed = torrent.uploadSpeed;
      stats.maxUploadSpeed = Math.max(stats.maxUploadSpeed, torrent.uploadSpeed);
    });

    // NOTE: stats that change frequently.
    torrent.on('download', (bytes) => {
      const gStats = this._stats[null];
      gStats.downloadSpeed = this.wt.downloadSpeed;
      gStats.maxDownloadSpeed = Math.max(gStats.maxDownloadSpeed, this.wt.downloadSpeed);

      stats.downloaded = torrent.downloaded;
      stats.downloadSpeed = torrent.downloadSpeed;
      stats.maxDownloadSpeed = Math.max(stats.maxDownloadSpeed, torrent.downloadSpeed);
    });

    torrent.on('wire', () => {
      stats.numPeers = torrent.numPeers;
    });
  }

  _createStorage(id) {
    return new PrefixedLocalStorage(id);
  }

  _getOrCreateTorrent(app) {
    /* Retrieves or creates a torrent for the given app. */
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
              resolve(torrent);
              return;
            }

            const _seed = () => {
              this.wt.seed(fileObjs, opts, (torrent) => {
                resolve(torrent);
              });  
            };

            // Attempt to join swarm.
            try {
              torrent = this.wt.add(tmp.infoHash, opts, (torrent) => {
                resolve(torrent);
              });
            } catch (e) {
              debug('Error adding torrent, seeding: %O', e);
              // Error, seed it.
              _seed();
            }

            // If an error occurs, seed the torrent.
            torrent.on('error', (e) => {
              debug('Error adding torrent, seeding: %O', e);
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
    return new Promise((resolve, reject) => {
      PackageApplication
        .load(file)
        .then((app) => {
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
        _addServer(torrent);
        return;
      }

      const opts = {
        announce: TRACKERS,
      };

      this.wt.add(id, opts, (torrent) => {
        _addServer(torrent);
      });
    });
  }

  remove(id) {
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
    return new Promise((resolve, reject) => {
      const gStats = this._stats[null];
      const keys = Object.keys(this._stats);

      // NOTE: stats that are sums.
      gStats.length = keys.reduce((prev, curr) => {
        return (curr === null) ? prev : prev + this._stats[curr].length || 0;
      }, 0);
      gStats.uploaded = keys.reduce((prev, curr) => {
        return (curr === null) ? prev : prev + this._stats[curr].uploaded || 0;
      }, 0);
      gStats.downloaded = keys.reduce((prev, curr) => {
        return (curr === null) ? prev : prev + this._stats[curr].downloaded || 0;
      }, 0);
      gStats.numPeers = keys.reduce((prev, curr) => {
        return (curr === null) ? prev : prev + this._stats[curr].numPeers || 0;
      }, 0);

      // NOTE: stats that are immediate (like gauges.)
      gStats.ratio = this.wt.ratio;

      for (let i = 0; i < this.wt.torrents.length; i++) {
        const torrent = this.wt.torrents[i];
        const stats = this._stats[torrent.infoHash];

        const server = this.get(torrent.infoHash);
        if (server) {
          stats.isSeeding = (server.app.isSeeding);
          stats.isServing = (server.app.isServing);
          stats.name = server.app.fields.name;
        }
  
        stats.ratio = torrent.ratio;
        stats.progress = torrent.progress;
      }

      resolve(this._stats);
    });
  }
}

function _start() {
  debug('Engine, starting');
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

  _start();
}
