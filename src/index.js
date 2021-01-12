const pathlib = require('path');
const fs = require('fs');
const { assert } = require('chai');
const JSZip = require('jszip');
const SHA256 = require('crypto-js/sha256');
const rs = require('jsrsasign');
const glob = require('glob-fs');
const isGlob = require('is-glob');
const debug = require('debug')('ug:index');


const RE_INDEX = /index.html?/gi;


class Application {
  isSeeding = false;
  isServing = false;

  /* Represents an application. */
  constructor(fields) {
    this.fields = fields;
    this._key = fields.key;
    this._pub = null;
    this._files = {};
  }

  get privateKey() {
    assert(this._key.isPrivate, 'No private key')
    return this._key;
  }

  get publicKey() {
    if (this._pub === null) {
      if (this._key.isPrivate) {
        // Extract public portion of the key.
        const pubKeyJWK = rs.KEYUTIL.getJWKFromKey(this._key);
        this._pub = rs.KEYUTIL.getPEM(rs.KEYUTIL.getKey({
          e: pubKeyJWK.e,
          kty: pubKeyJWK.kty,
          n: pubKeyJWK.n,
        }));
      } else {
        this._pub = this._key;
      }
    }

    return this._pub;
  }

  _manifest(exclude) {
    const manifest = {};
    const keys = Object.keys(this.fields);

    for (let i in keys) {
      const key = keys[i];
      if (exclude && exclude.indexOf(key) !== -1) {
        continue;
      }
      manifest[key] = this.fields[key];
    }

    // Only include public key.
    manifest.key = this.publicKey;

    return manifest;
  }

  sign() {
    /* Signs fields. */
    const manifest = this._manifest();
    const str = JSON.stringify(manifest, (key, val) => (key === 'signature') ? undefined : val);
    const sig = new rs.Signature({alg: 'SHA256withRSA'});
    sig.init(this.privateKey);
    sig.updateString(str);
    this.fields.signature = manifest.signature = sig.sign();
    return manifest;
    }

  verify() {
    /* Verifies the signature and hashes of the application. */
    if (!this.fields.signature) {
      throw new Error('No signature');
    }

    const manifest = this._manifest(['signature']);
    const str = JSON.stringify(manifest, (key, val) => (key === 'signature') ? undefined : val);
    const sig = new rs.Signature({alg: 'SHA256withRSA'});
    sig.init(this.publicKey);
    sig.updateString(str);
    assert(sig.verify(this.fields.signature), 'Invalid signature');
  }

  get names() {
    const names = [];
    for (let i in this.fields.files) {
      names.push(this.fields.files[i].name);
    }
    return names;
  }

  readFile(path) {
    // Check cache.
    const file = this._files[path];

    return new Promise((resolve, reject) => {
      if (file) {
        resolve(file.body);
        return;
      }

      this._readFile(path)
        .then((body) => {
          const file = this.fields.files.find((f) => (f.name === path));
          if (!file || file.hash !== SHA256(body).toString()) {
            reject(new Error('Invalid hash'));
            return;
          }
          this._files[path] ={ body };
          resolve(body);
        })
        .catch(reject);
    });
  }

  readFiles() {
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
    /* read file from dictionary. */
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
    const manifest = this.sign();
    const zip = new JSZip();

    zip.file('app.json', JSON.stringify(manifest));

    for (let fn in this.files) {
      zip.file(fn, this.files[fn].body);
    }

    if (!outPath) {
      outPath = pathlib.join(process.cwd(), `${this.fields.name}.app`);
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
    const fields = JSON.parse(fs.readFileSync(path));
    const basePath = pathlib.dirname(path);

    fields.key = rs.KEYUTIL.getKey(
      fs.readFileSync(pathlib.join(basePath, fields.key)).toString());

    const files = {};
    fields.files = [];

    for (let desc of fields.contents) {
      const pattern = pathlib.join(basePath, desc.pattern);
      let paths;

      if (!isGlob(pattern)) {
        paths = [pattern];
      } else {
        paths = glob().readdirSync(pattern);
      }

      for (let i in paths) {
        const path = paths[i];
        const key = pathlib.relative(basePath, path);
        const body = fs.readFileSync(path).toString();
        const hash = SHA256(body).toString();

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
      // User may omit index field as long as there is a file named "index.html".
      for (let fn in files) {
        const m = fn.match(RE_INDEX);
        if (m) {
          fields.index = fn;
          break;
        }
      }
    } else {
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
  isSeeding = true;
  isServing = true;

  constructor(zip, fields) {
    super(fields);
    this.zip = zip;
  }

  _readFile(path) {
    /* read file from zip. */
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
  isSeeding = true;
  isServing = false;

  constructor(torrent, fields) {
    super(fields);
    this.torrent = torrent;
  }

  _readFile(path) {
    /* read file from a torrent. */
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

function compile(inPath, outPath) {
  return ParsedApplication.parse(inPath);
}

function extract(inPath) {
  return PackageApplication.load(fs.readFileSync(inPath));
}

function torrent(torrent) {
  return TorrentApplication.load(torrent);
}

module.exports = {
  PackageApplication,
  TorrentApplication,
  compile,
  extract,
  torrent,
};
