const { EventEmitter } = require('events');
const WebTorrent = require('webtorrent');
const LSChunkStore = require('ls-chunk-store');
const createTorrent = require('create-torrent');
const debug = require('debug')('ug:engine');
const { PackageApplication, isBrowser, isExtension } = require('../index');
const { Entry } = require('./server');


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

    this.entries = {};
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
              fObj = new File([files[i].body], files[i].name);
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

  serve(file) {
    /* Adds a new server for application bundle. */
    debug('Creating server from file.');

    return new Promise((resolve, reject) => {
      PackageApplication
        .load(file)
        .then((app) => {
          debug('File extracted.');

          // TODO: check if entry already exists. We need to create the torrent to get
          // the infoHash.
          Entry
            .serve(this.wt, app)
            .then(({ entry, server }) => {
              this.entries[server.id] = entry;
              resolve(server);
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
      Entry
        .fetch(this.wt, id)
        .then(({ entry, client }) => {
          if (!client.id in this.entries) {
            this.entries[client.id] = entry;
          }
          resolve(client);
        })
        .catch(reject);
    });
  }

  remove(id) {
    /* Removes an application. */
    debug('Removing client & server: %s', id);

    return new Promise((resolve, reject) => {
      const server = this.servers[id];
      const client = this.clients[id];

      const promises = [];
      if (server) {
        promises.push(server.destroy());
      }
      if (client) {
        promises.push(client.destroy());
      }

      Promise
        .all(promises)
        .then(() => {
          delete this.servers[id];
          delete this.clients[id];
          resolve();
        })
        .catch(reject);
    });
  }

  flush(id) {
    /* Removes an application and it's storage. */
    debug('Flushing client & server: %s', id);

    return new Promise((resolve, reject) => {
      const server = this.servers[id];
      const client = this.clients[id];

      const promises = [];
      if (server) {
        promises.push(server.flush());
      }
      if (client) {
        promises.push(client.flush());
      }

      Promise
        .all(promises)
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
      const keys = Object.keys(this.entries);

      keys.forEach((key) => {
        const entry = this.entries[key];
        if (entry.server) {
          stats[key] = entry.server.stats;
        }
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

if (isExtension()) {
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
};
