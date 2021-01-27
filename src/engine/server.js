const { EventEmitter } = require('events');
const WebTorrent = require('webtorrent');
const debug = require('debug')('ug:engine:server');
const Bugout = require('bugout');
const { TorrentApplication, PackageApplication, isBrowser } = require('../index');
const { PrefixedLocalStorage, PrefixedSessionStorage } = require('./storage')

const TRACKERS = [
  "wss://tracker.openwebtorrent.com",
  // Dead:
  // "wss://tracker.fastcast.nz",
  // "wss://tracker.btorrent.xyz"
];


class Client {
  constructor(wt, app, torrent) {
    this.wt = wt;
    this.app = app;
    this.torrent = torrent;
    this.bugout = new Bugout();
    this.localStorage = new PrefixedLocalStorage(`c:${this.id}`);
    this.sessionStorage = new PrefixedSessionStorage(`c:${this.id}`);
  }

  get id() {
    return this.torrent.infoHash;
  }
}

class Server extends EventEmitter {
  constructor(wt, app, torrent) {
    super();
    this.wt = wt;
    this.app = app;
    this.torrent = torrent;
    // Retrieve the seed if it exists.
    this.bugout = new Bugout({
      torrent: torrent,
      seed: this.seed,
    });
    // Store the see for next time.
    this.seed = this.bugout.seed;
    debug(`Bugout identifier: ${this.bugout.identifier}`);
    this.bugout.register('ping', this.ping.bind(this));
    this.localStorage = new PrefixedLocalStorage(`s:${this.id}`);
    this.sessionStorage = new PrefixedSessionStorage(`s:${this.id}`);
  }

  get id() {
    return this.torrent.infoHash;
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

          wt.seed(fileObjs, opts, (torrent) => {
            debug('Seeding torrent.');
            const server = new Server(wt, app, torrent);
            const entry = new Entry(wt, app, server);
            resolve({ entry, server });
          });  
        });  
    });
  }

  static client(wt, id) {
    return new Promise((resolve, reject) => {
      const privateWt = new WebTorrent(wt.opts);
      const opts = {
        announce: TRACKERS,
      };
  
      privateWt.add(id, opts, (torrent) => {
        debug('Torrent added');
        debug(`Creating new client for ${id}`);
        TorrentApplication.load(torrent)
          .then((app) => {
            const entry = new Entry(wt, app);
            const client = new Client(privateWt, app, torrent);
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
  