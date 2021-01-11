const WebTorrent = require('webtorrent');
const LSChunkStore = require('ls-chunk-store');
const createTorrent = require('create-torrent');
const parseTorrent = require('parse-torrent');
const { verify, extract } = require('./index');


const TRACKERS = [
  "wss://tracker.openwebtorrent.com",
  // Dead:
  // "wss://tracker.fastcast.nz",
  // "wss://tracker.btorrent.xyz"
];


class PrefixLocalStorage {
  constructor(prefix) {
    this.prefix = prefix;
  }

  _makeKey() {
    return `${this.prefix}-${key}`;
  }

  _key(i) {
    return localStorage.key(i);
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
      if (localStorage._key(i).startsWith(this.prefix)) {
        toRemove.push(localStorage.key(i));
      }
    }

    for (let i = 0; i < toRemove.length; i++) {
      locaStorage.removeItem(toRemove[i]);
    }
  }
}

class Server {
  constructor(app, torrent, storage) {
    this.wt = new WebTorrent({
      store: LSChunkStore,
    })
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

      this.torrent.destroy(resolve);
    });
  }

  flush() {
    return new Promise((resolve, reject) => {
      this.destroy.then(() => {
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
    // Servers stored by app.id.
    this.servers = {};
  }

  static _createStorage(app) {
    return new PrefixedLocalStorage(app.id);
  }

  static _getOrCreateTorrent(app) {
    /* Retrieves or creates a torrent for the given app. */
    const opts = {
      name: app.id,
      announce: TRACKERS,
      comment: app.description,
    };

    return new Promise((resolve, reject) => {
      // Create torrent to retrieve infoHash.
      createTorrent(app.files, opts, (e, tmp) => {
        if (e) {
          reject(e);
          return;
        }
  
        // Torrent is a uint8Array instance.
        tmp = parseTorrent(tmp);
  
        // Get torrent if it is currently active.
        let torrent = this.wt.get(tmp.infoHash);
  
        if (torrent) {
          resolve(torrent);
          return;
        }
  
        this.wt.seed(fileObjs, opts, (torrent) => {
          resolve(torrent);
        });
      });  
    });
  }

  get(id) {
    return this.servers[id];
  }

  createServer(app) {
    if (app.id in this.servers) {
      return null;
    }

    return new Promise((resolve, reject) => {
      Engine._getOrCreateTorrent(app)
        .then((torrent) => {
          const storage = Engine._createStorage(app);
          const server = new Server(app, torrent, storage);
          this.apps[app.id] = server;
          resolve(server);
        });
    });
  }

  fetch(id) {
    const server = this.servers[id];

    function _addServer(torrent) {
      const app = new TorrentApplication(torrent);
      // NOTE: no storage.
      server = new Server(app, torrent);
      this.servers[id] = server;
      return server;
    }

    return new Promise((resolve, reject) => {
      if (server) {
        resolve(server);
        return;
      }
  
      const torrent = this.wt.get(id);
      if (torrent) {
        resolve(_addServer(torrent));
        return;
      }

      this.wt.add(id, opts, (torrent) => {
          resolve(_addServer(torrent));
      });
    });
  }

  remove(id) {
    const server = this.servers[id];

    return new Promise((resolve, reject) => {
      if (!server) {
        resolve();
        return;
      }

      server.destroy(() => {
        delete this.servers[id];
        resolve();
      });
    });
  }

  flush(id) {
    const server = this.servers[id];

    return new Promise((resolve, reject) => {
      if (!server) {
        resolve();
        return;
      }

      server
        .flush()
        .then(resolve);
    });
  }

  stats() {
    const stats = {};

    for (let server in self.servers) {
      stats.push({
        id: server.app.id,
      });
    }

    return new Promise((resolve, reject) => {
      resolve(stats);
    });
  }
}

function _start() {
  console.log('Engine, starting');
  window.engine = new Engine();

  // TODO: load past applications from localStorage and serve them.
}

// Only run in browser.
if (window) {
  // This does not currently work, see:
  // https://bugs.chromium.org/p/chromium/issues/detail?id=64100&q=registerprotocolhandler%20extension&can=2
  const url = chrome.runtime.getURL('/dist/html/view.html?url=%s');
  console.log(url);
  try {
    navigator.registerProtocolHandler(
      'web+ug', url, 'Web Underground scheme');
  } catch (e) {
    console.log('Error installing protocol handler', e);    
  }

  _start();
}
