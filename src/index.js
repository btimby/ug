const pathlib = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const { assert } = require('chai');
const JSZip = require('jszip');
const glob = require('glob-fs');
const isGlob = require('is-glob');
const DomStorage = require('dom-storage');
const debug = require('debug')('ug:index');
const nacl = require('tweetnacl');
const bs58 = require("bs58");


const RE_INDEX = /index.html?/gi;


class Application extends EventEmitter {
//  isSeeding = false;
//  isServing = false;

  /* Represents an application. */
  constructor(fields) {
    super();
    this.fields = fields;
    this._key = null;
    this._files = {};
  }

  get key() {
    if (this._key === null) {
      const key = Uint8Array.from(bs58.decode(this.fields.key));

      if (key.length === nacl.sign.secretKeyLength) {
        // We have a secret key, we can create the key pair.
        this._key = nacl.sign.keyPair.fromSecretKey(key);
      } else if (key.length === nacl.sign.publicKeyLength) {
        // We have only the public key...
        this._key = { publicKey: key };
      } else {
        throw new Error('Invalid key');
      }
    }

    return this._key;
  }

  _manifest(...exclude) {
    debug('Generating manifest.');

    const manifest = {};
    const keys = Object.keys(this.fields);

    for (let i in keys) {
      const key = keys[i];
      if (exclude && exclude.indexOf(key) !== -1) {
        continue;
      }
      manifest[key] = this.fields[key];
    }

    return manifest;
  }

  sign() {
    /* Signs fields. */
    debug('Signing manifest');

    const manifest = this._manifest('key', 'signature');
    const str = JSON.stringify(manifest);
    const sig = nacl.sign.detached(Uint8Array.from(str), this.key.secretKey);
    this.fields.signature = manifest.signature = bs58.encode(sig);
    manifest.key = this.fields.key;
    return manifest;
  }

  verify() {
    /* Verifies the signature and hashes of the application. */
    debug('Verifying manifest signature');

    if (!this.fields.signature) {
      throw new Error('No signature');
    }

    const manifest = this._manifest('key', 'signature');
    const sig = bs58.decode(this.fields.signature);
    const str = JSON.stringify(manifest);
    assert(nacl.sign.detached.verify(Uint8Array.from(str), sig, this.key.publicKey), 'Invalid signature');
  }

  get names() {
    const names = [];
    for (let i in this.fields.files) {
      names.push(this.fields.files[i].name);
    }
    return names;
  }

  readFile(path) {
    /* High-level file reading function */
    debug('Reading file %s', path);

    return new Promise((resolve, reject) => {
      const file = this._files[path];
      if (file) {
        debug('File %s found in cache', path);
        resolve(file.body);
        return;
      }

      debug('Reading %s from storage', path);
      this._readFile(path)
        .then((body) => {
          const file = this.fields.files.find((f) => (f.name === path));
          if (!file || file.hash !== bs58.encode(nacl.hash(Uint8Array.from(body)))) {
            debug('hash: %s !== %s', file.hash, bs58.encode(nacl.hash(Uint8Array.from(body))));
            reject(new Error('Invalid hash'));
            return;
          }
          this._files[path] = { body };
          resolve(body);
        })
        .catch(reject);
    });
  }

  readFiles() {
    /* Reads all files. */
    debug('Reading all files.');

    return new Promise((resolve, reject) => {
      const promises = [];

      for (let i in this.fields.files) {
        promises.push(this.readFile(this.fields.files[i].name));
      }

      Promise.all(promises)
        .then((bodies) => {
          const files = [];

          for (let i in this.fields.files) {
            files.push({
              name: this.fields.files[i].name,
              body: bodies[i],
            })
          }

          resolve(files);
        })
        .catch(reject);
    });
  }
}

class ParsedApplication extends Application {
  constructor(files, fields) {
    super(fields);
    this.files = files;
  }

  readFile(path) {
    /* Read file from dictionary. */
    debug('Reading file %s', path);

    // NOTE: No hash check or caching needed.
    const file = this.files[path];

    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('File not found'));
        return;
      }
      resolve(file.body);
    })
  }

  save(outPath) {
    /* Saves a loaded or parsed Application to a zip file. */
    debug('Saving application bundle to %s', outPath);

    const manifest = this.sign();
    const zip = new JSZip();

    zip.file('app.json', JSON.stringify(manifest));

    for (let fn in this.files) {
      zip.file(fn, this.files[fn].body);
    }

    if (!outPath) {
      outPath = pathlib.join(process.cwd(), `${this.fields.name}.app`);
      debug('Path not specified, using %s', outPath);
    }

    return new Promise((resolve, reject) => {
      zip
        .generateNodeStream({type: 'nodebuffer', streamFiles: true})
        .pipe(fs.createWriteStream(outPath))
        .on('finish', () => {
          resolve(outPath);
        })
        .on('error', (e) => reject(e));
    });
  }

  // NOTE: used by compile().
  static parse(path) {
    /* Parses app.json and load all resources. */
    debug('Parsing application definition %s', path);

    const fields = JSON.parse(fs.readFileSync(path));
    const basePath = pathlib.dirname(path);
    const keyPair = nacl.sign.keyPair();
    fields.key = bs58.encode(keyPair.secretKey);

    const files = {};
    fields.files = [];

    for (let desc of fields.contents) {
      const pattern = pathlib.join(basePath, desc.pattern);
      let paths;

      debug('Adding path / pattern %s', pattern);
      if (!isGlob(pattern)) {
        paths = [pattern];
      } else {
        paths = glob().readdirSync(pattern);
        debug('Found matching paths: %O', paths);
      }

      for (let i in paths) {
        const path = paths[i];
        const key = pathlib.relative(basePath, path);
        const body = fs.readFileSync(path).toString();
        const hash = bs58.encode(nacl.hash(Uint8Array.from(body)));

        files[key] = {
          body,
          hash: hash,
        };
        fields.files.push({
          name: key,
          hash: hash,
        })
      }
    }
  
    delete fields.contents;

    if (!fields.index) {
      debug('Definition omitted index.');

      // User may omit index field as long as there is a file named "index.html".
      for (let fn in files) {
        const m = fn.match(RE_INDEX);
        if (m) {
          debug('Using index: %s', fn);
          fields.index = fn;
          break;
        }
      }
    } else {
      debug('%s defined as index, ensuring it exists', fields.index);

      if (!files[fields.index]) {
        throw new Error(`The index field is defined as ${fields.index}, yet no such file is included.`);
      }
    }

    if (!fields.index) {
      throw new Error('Must define an index page or bundle index.html');
    }

    return new ParsedApplication(files, fields);
  }  
}

class PackageApplication extends Application {
  constructor(zip, fields) {
    super(fields);
    this.zip = zip;
  }

  _readFile(path) {
    /* Read file from zip. */
    debug('Reading file %s from zip archive.', path);

    return new Promise((resolve, reject) => {
      this.zip.files[path]
        .async('string')
        .then((body) => {
          resolve(body);
        })
        .catch(reject);
    });
  }

  // NOTE: used by createServer().
  static load(file) {
    /* Loads an application from a zip file. */
    debug('Loading application from bundle.');

    return new Promise((resolve, reject) => {
      JSZip
        .loadAsync(file)
        .then((zip) => {
          //log('Extracting files.')
          zip.files['app.json']
            .async('string')
            .then((body) => {
              const fields = JSON.parse(body);
              const app = new PackageApplication(zip, fields);

              try {
                app.verify();
              } catch(e) {
                reject(e);
                return
              }

              resolve(app);
            })
            .catch((e) => reject(e));
          })
          .catch((e) => reject(e));
    });
  }
}

class TorrentApplication extends Application {
  constructor(torrent, fields) {
    super(fields);
    this.torrent = torrent;
  }

  _readFile(path) {
    /* Read file from a torrent. */
    debug('Reading file %s from torrent.', path);

    const file = this.torrent.files.find((f) => (f.name === path));

    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error(`File not found: ${path}`));
        return;
      }

      file.getBuffer((e, buff) => {
        if (e) {
          reject(e);
          return;
        }
        resolve(buff.toString());
      })
    });
  }

  static load(torrent) {
    /* Load application from a torrent. */
    debug('Loading application from torrent.');

    return new Promise((resolve, reject) => {
      const file = torrent.files.find((f) => (f.name === 'app.json'));

      if (!file) {
        reject(new Error('Torrent is not an application, no app.json'));
        return;
      }

      file.getBuffer((e, buff) => {
        if (e) {
          reject(e);
          return;
        }

        const fields = JSON.parse(buff.toString());
        debug('%O', fields);
        const app = new TorrentApplication(torrent, fields);

        try {
          app.verify();
        } catch(e) {
          reject(e);
          return
        }

        resolve(app);
      });
    });
  }
}

class SessionStorage {
  constructor() {
    this._data = {};
  }
}

function compile(inPath) {
  return ParsedApplication.parse(inPath);
}

function extract(inPath) {
  return PackageApplication.load(fs.readFileSync(inPath));
}

function torrent(torrent) {
  return TorrentApplication.load(torrent);
}

const isBrowser = new Function('return (typeof(window) !== "undefined" && this === window);');
const isNode = new Function('return (typeof(global) !== "undefined" && this === global);');
const isExtension = new Function('return (typeof(window) !== "undefined" && this === window && "browser" in window);');

const atob = (isBrowser()) ? window.atob : require('atob');
const btoa = (isBrowser()) ? window.btoa : require('btoa');
const localStorage = (isBrowser()) ? window.localStorage : new DomStorage('/tmp/local.json');
const sessionStorage = (isBrowser()) ? window.sessionStorage : new DomStorage('/tmp/session.json');


module.exports = {
  PackageApplication,
  TorrentApplication,
  compile,
  extract,
  torrent,
  isBrowser,
  isNode,
  isExtension,
  atob,
  btoa,
  localStorage,
  sessionStorage,
};
