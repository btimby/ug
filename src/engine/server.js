const { EventEmitter } = require('events');
const WebTorrent = require('webtorrent');
const debug = require('debug')('ug:engine:server');
const Bugout = require('bugout');
const bs58 = require('bs58');
const { TorrentApplication, PackageApplication, isBrowser } = require('../index');
const { PrefixedLocalStorage, PrefixedSessionStorage } = require('./storage')
const { CollectionManager } = require('./collection');

const TRACKERS = [
  "wss://tracker.openwebtorrent.com",
  // Dead:
  // "wss://tracker.fastcast.nz",
  // "wss://tracker.btorrent.xyz"
];
// default collection owner permissions;
const OWNER = {
  read: true,
  write: true,
  remove: true,
  overwrite: true,
};
// default collection other permissions.
const OTHER = {
  read: true,
  write: false,
  remove: false,
  overwrite: false,
};


class Client {
  constructor(bugout, app, torrent) {
    this.wt = bugout.wt;
    this.app = app;
    this.torrent = torrent;
    this.bugout = bugout;
    this.localStorage = new PrefixedLocalStorage(this.prefix);
    this.sessionStorage = new PrefixedSessionStorage(this.prefix);
  }

  get id() {
    return this.torrent.infoHash;
  }

  get prefix() {
    return `c:${this.id}`;
  }
}

class Server extends EventEmitter {
  constructor(wt, app, torrent) {
    super();
    this.wt = wt;
    this.app = app;
    this.torrent = torrent;
    this.bugout = new Bugout(this.id, {
      wt,
      torrent,
      keyPair: app.key,
    });
    this.ls = new PrefixedLocalStorage(this.prefix);
    this.ss = new PrefixedSessionStorage(this.prefix);
    this.cm = new CollectionManager(this.ls);
    // TODO: register application specific RPC here.
    this.bugout.register('collection.create', (address, args, cb) => {
      args.permissions[address] = OWNER;
      args.permissions[null] = args.permissions[null] || OTHER;
      const name = args.name;
      delete args.name;

      try {
        this.cm.create(name, args);
      } catch (e) {
        cb(e);
        return;
      }
      cb();
    });
    // this.bugout.register('ping', this.ping.bind(this));
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

  get id() {
    return this.torrent.infoHash;
  }

  get prefix() {
    return `s:${this.id}`;
  }
}

class Entry {
  /*
  This class represents an application that is in a combination two states:

    - The application has been loaded from a bundle and is being served.
    - The application has been loaded from a torrent and is being seeded.
  
  When serving, the application will consist of the following parts:
    - A global WebTorrent instance that seeds all applications.
    - A PackageApplication instance that contains the files representing both the client
      and server side of the application.
    - A Bugout instance that handles the RPC server.

  When seeding (client mode), the application will consist of the following parts:
    - A global WebTorrent instance that seeds all applications.
    - A TorrentApplication instance that contains the files representing the client side
      of the application.
  */
  constructor(wt, app, server) {
    this.wt = wt;
    this.app = app;
    this.server = server;
  }

  static serve(wt, app) {
    /*
    Create a new server for application.

    Parameters:
      wt - the global webtorrent instance.
    */
    if (!app instanceof PackageApplication) {
      return Promise.reject(new Error('Invalid Application'));
    }

    // Server.
    return new Promise((resolve, reject) => {
      // TODO: move torrent creation to index.js:Application.
      // NOTE: don't leak the private key.
      const fields = app._manifest('key');
      fields.key = bs58.encode(app.key.publicKey);
      let appJson;

      if (isBrowser()) {
        appJson = new File([JSON.stringify(fields)], 'app.json');
      } else {
        appJson = Buffer.from(JSON.stringify(fields));
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

          wt.seed(fileObjs, opts, (torrent) => {
            debug('Seeding torrent.');
            const server = new Server(wt, app, torrent);
            const entry = new Entry(wt, app, server);
            resolve({ entry, server });
          });  
        });  
    });
  }

  static fetch(wt, id) {
    return new Promise((resolve, reject) => {
      debug(`Creating new client for ${id}`);
      //const privateWt = new WebTorrent(wt.opts);
      const opts = {
        announce: TRACKERS,
      };
      wt = new WebTorrent(wt.opts);
      const torrent = wt.add(id, opts);
      const bugout = new Bugout(id, {
        wt,
        torrent,
      });
      torrent.on('ready', () => {
        debug('Torrent added');
        TorrentApplication.load(torrent)
          .then((app) => {
            const entry = new Entry(wt, app);
            const client = new Client(bugout, app, torrent);
            resolve({ entry, client });
          })
          .catch(reject);  
      });
    });
  }
}

module.exports = {
  Client,
  Server,
  Entry,
};
  