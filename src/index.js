const pathlib = require('path');
const fs = require('fs');
const { assert } = require('chai');
const JSZip = require('jszip');
const SHA256 = require('crypto-js/sha256');
const rs = require('jsrsasign');
const glob = require('glob-fs');
const isGlob = require('is-glob');


class Application {
  /* Represents an application. */
  constructor(name, description, version, author, key, contents, index) {
    this.name = name;
    this.description = description;
    this.version = version;
    this.author = author;
    this._contents = contents;
    this.index = index;
    this._key = key;
    this._files = {};
  }

  get privateKey() {
    return this._key;
  }

  get publicKey() {
    // Return private portion of the key.
  }

  _loadFiles(baseDir) {
    this._files = [];

    for (let desc of this._contents) {
      const pattern = pathlib.join(baseDir, desc.pattern);
      let files;

      if (!isGlob(pattern)) {
        files = [pattern];
      } else {
        files = glob().readdirSync(pattern);
      }

      for (let file in files) {
        this._files.push();
      }
    }
  }

  sign() {
    /* Signs and generates hashes. */
  }

  verify() {
    /* Verifies the signature and hashes of the application. */
  }

  save(path) {
    /* Saves a loaded or parsed Application to a zip file. */
    this.sign();
  }

  toTorrent() {
    /* Creates a torrent from the application. */
  }

  // NOTE: used by createServer().
  static load(path) {
    /* Loads an application from a zip file. */
    const app = new Application();
    app.verify();
  }

  // NOTE: used by compile().
  static parse(path) {
    /* Parses app.json and load all resources. */
    const attrs = JSON.parse(fs.readFileSync(path));
    const app = new Application(
      attrs.name, attrs.description, attrs.version, attrs.author, attrs.key,
      attrs.contents, attrs.index);

    app._loadFiles();
    app.sign();

    return app;
  }

  static fromTorrent(torrent) {
    /* Creates an application from a torrent. */
    return new TorrentApplication();
  }
}


class TorrentApplication extends Application {

}


function compile(path) {
  return Application.parse(path);
}


function sign(obj, pem) {
  // NOTE: modifies parameter `obj`.
  const key = rs.KEYUTIL.getKey(pem.toString());
  const pubKeyJWK = rs.KEYUTIL.getJWKFromKey(key);
  const pubKey = rs.KEYUTIL.getPEM(rs.KEYUTIL.getKey({
    e: pubKeyJWK.e,
    kty: pubKeyJWK.kty,
    n: pubKeyJWK.n,
  }));

  // Don't include the private key.
  obj.key = pubKey;

  const msg = JSON.stringify(obj, Object.keys(obj).sort());
  const sig = new rs.Signature({alg: 'SHA256withRSA'});

  sig.init(key);
  sig.updateString(JSON.stringify(obj, Object.keys(obj).sort()));
  obj.signature = sig.sign();
}

function verify(obj) {
  const { key: pem, signature } = obj;
  const key = rs.KEYUTIL.getKey(pem);
  const keys = Object.keys(obj);

  // Don't include signature...
  keys.splice(keys.indexOf('signature'), 1);
  keys.sort();

  const msg = JSON.stringify(obj, keys);
  const sig = new rs.Signature({alg: 'SHA256withRSA'});

  sig.init(key);
  sig.updateString(msg);
  assert(sig.verify(signature), 'Invalid signature');
  // Check hashes as files are extracted.
  //assert.strictEqual(hash, SHA256(payload).toString(), 'Invalid hash');
}

function _addFiles(basePath, obj, zip) {
  const fileHashes = [];

  for (let i = 0; i < obj.files.length; i++) {
    const file = obj.files[i];
    let paths;
  
    if (isGlob(file.path)) {
      paths = glob().readdirSync(pathlib.join(basePath, file.path));
    } else {
      paths = [pathlib.join(basePath, file.path)];
    }

    for (let ii = 0; ii < paths.length; ii++) {
      const path = paths[i];
      const body = fs.readFileSync(path);

      fileHashes.push({
        path: pathlib.relative(basePath, path),
        hash: SHA256(body).toString(), 
      });
      zip.file(pathlib.relative(basePath, path), body);
    }
  }

  obj.files = fileHashes;
}

function compile(inPath, outPath) {
  return new Promise((resolve, reject) => {
    const app = fs.readFileSync(inPath);
    const basePath = pathlib.dirname(inPath);
    const obj = JSON.parse(app);
    const {name, key: keyPath } = obj;
    const zip = new JSZip();
    const pem = fs.readFileSync(pathlib.join(basePath, keyPath));

    _addFiles(basePath, obj, zip);
    zip.file('app.json', JSON.stringify(obj));
    sign(obj, pem);

    if (!outPath) {
      outPath = pathlib.join(process.cwd(), `${name}.app`);
    }

    zip
      .generateNodeStream({type: 'nodebuffer', streamFiles: true})
      .pipe(fs.createWriteStream(outPath))
      .on('finish', () => {
        resolve(outPath);
      })  
  });
}

function _checkFiles(obj, zip) {
  const promises = [];

  for (let i = 0; i < obj.files.length; i++) {
    const file = obj.files[i];
    promises.push(zip.files[file.path].async('string'));
  }

  return new Promise((resolve, reject) => {
    Promise
      .all(promises)
      .then((bodies) => {
        const files = {};

        try {
          for (let i = 0; i < obj.files.length; i++) {
            const file = obj.files[i], body = bodies[i];

            assert.strictEqual(file.hash, SHA256(body).toString(), 'Invalid hash');
            files[file.path] = body;
            resolve(files);
          }
        } catch (e) {
          reject(e);
        }
      });
  });
}

function extract(file) {
  if (typeof(file) === 'string') {
    file = fs.readFileSync(file);
  }

  return new Promise((resolve, reject) => {
    JSZip
    .loadAsync(file)
    .then((zip) => {
      //log('Extracting files.')
      zip.files['app.json']
        .async('string')
        .then((content) => {
          let obj;

          try {
            obj = JSON.parse(content);
            verify(obj);
          } catch (e) {
            reject(e);
            return;
          }

          _checkFiles(obj, zip)
            .then((files) => {
              resolve([obj, files]);
            });
        });
    });
  });
}

module.exports = {
  compile,
  extract,
  sign,
  verify,
};
