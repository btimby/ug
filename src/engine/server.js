const { EventEmitter } = require('events');
const WebTorrent = require('webtorrent');
const debug = require('debug')('ug:engine:server');
const Bugout = require('bugout');
const bs58 = require('bs58');
const { TorrentApplication, PackageApplication, isBrowser } = require('../index');
const { PrefixedLocalStorage, PrefixedSessionStorage } = require('./storage')

const TRACKERS = [
  "wss://tracker.openwebtorrent.com",
  // Dead:
  // "wss://tracker.fastcast.nz",
  // "wss://tracker.btorrent.xyz"
];


class Client {
  constructor(bugout, app, torrent) {
    this.wt = bugout.wt;
    this.app = app;
    this.torrent = torrent;
    this.bugout = bugout;
    this.bugout.on('announce', () => {
      debug('client: announce');
    });
    this.bugout.on('torrent', () => {
      debug('client: torrent');
    });
    this.bugout.on('tracker', () => {
      debug('client: tracker');
    });
    this.bugout.on('tineout', () => {
      debug('client: tineout');
    });
    this.bugout.on('seen', () => {
      debug('client: seen');
    });
    this.bugout.on('left', () => {
      debug('client: left');
    });
    this.bugout.on('connections', () => {
      debug('client: connections');
    });
    this.bugout.on('rpc', () => {
      debug('client: rpc');
    });
    this.bugout.on('rpc-response', () => {
      debug('client: rpc-response');
    });
    this.bugout.on('ping', () => {
      debug('client: ping');
    });
    this.bugout.on('message', () => {
      debug('client: message');
    });
    this.bugout.on('server', () => {
      debug('client: server');
    });
    this.bugout.on('wire', () => {
      debug('client: wire');
    });
    this.bugout.on('wireleft', () => {
      debug('client: wireleft');
    });
    this.bugout.on('wireseen', () => {
      debug('client: wireseen');
    });
    this.localStorage = new PrefixedLocalStorage(this.prefix);
    this.sessionStorage = new PrefixedSessionStorage(this.prefix);
  }

  get id() {
    return this.torrent.infoHash;
  }

  get prefix() {
    return `c:${this.id}`;
  }

  get seed() {
    const seed = localStorage.getItem(`${this.prefix}:seed`);
    debug(`Loaded seed ${seed} for ${this.id}`);
    return seed;
  }

  set seed(value) {
    localStorage.setItem(`${this.prefix}:seed`, value);
    debug(`Saved seed ${value} for ${this.id}`);
  }
}

class Server extends EventEmitter {
  constructor(wt, app, torrent) {
    super();
    this.wt = wt;
    this.app = app;
    this.torrent = torrent;
    debug('Key: %O', bs58.encode(app.key.publicKey));
    this.bugout = new Bugout({
      torrent: torrent,
      keyPair: app.key,
    });
    debug('Key: %O', this.bugout.encodeaddress(app.key.publicKey));
    this.bugout.register('ping', this.ping.bind(this));
    this.bugout.on('announce', () => {
      debug('server: announce');
    });
    this.bugout.on('torrent', () => {
      debug('server: torrent');
    });
    this.bugout.on('tracker', () => {
      debug('server: tracker');
    });
    this.bugout.on('tineout', () => {
      debug('server: tineout');
    });
    this.bugout.on('seen', () => {
      debug('server: seen');
    });
    this.bugout.on('left', () => {
      debug('server: left');
    });
    this.bugout.on('connections', () => {
      debug('server: connections');
    });
    this.bugout.on('rpc', () => {
      debug('server: rpc');
    });
    this.bugout.on('rpc-response', () => {
      debug('server: rpc-response');
    });
    this.bugout.on('ping', () => {
      debug('server: ping');
    });
    this.bugout.on('message', () => {
      debug('server: message');
    });
    this.bugout.on('server', () => {
      debug('server: server');
    });
    this.bugout.on('wire', () => {
      debug('server: wire');
    });
    this.bugout.on('wireleft', () => {
      debug('server: wireleft');
    });
    this.bugout.on('wireseen', () => {
      debug('server: wireseen');
    });
    this.localStorage = new PrefixedLocalStorage(this.prefix);
    this.sessionStorage = new PrefixedSessionStorage(this.prefix);
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

  get seed() {
    const seed = localStorage.getItem(`${this.prefix}:seed`);
    debug(`Loaded seed ${seed} for ${this.id}`);
    return seed;
  }

  set seed(value) {
    localStorage.setItem(`${this.prefix}:seed`, value);
    debug(`Saved seed ${value} for ${this.id}`);
  }

  // ping RPC call.
  ping(address, args, callback) {
    args.hello = `Hello ${address} from ${this.bugout.address()}`;
    callback(args);
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
      const bugout = new Bugout({
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
  