const pathlib = require('path');
const fs = require('fs');
const { assert } = require('chai');
const JSZip = require('jszip');
const SHA256 = require('crypto-js/sha256');
const rs = require('jsrsasign');


function sign(obj, payload, pem) {
  // NOTE: modifies parameter `obj`.
  const key = rs.KEYUTIL.getKey(pem.toString());
  const pubKeyJWK = rs.KEYUTIL.getJWKFromKey(key);
  const pubKey = rs.KEYUTIL.getPEM(rs.KEYUTIL.getKey({
    e: pubKeyJWK.e,
    kty: pubKeyJWK.kty,
    n: pubKeyJWK.n,
  }));

  // TODO: add SHA256 hash of bundle to obj.
  obj.hash = SHA256(payload).toString();
  // Don't include the private key.
  obj.key = pubKey;

  const msg = JSON.stringify(obj, Object.keys(obj).sort());
  const sig = new rs.Signature({alg: 'SHA256withRSA'});

  sig.init(key);
  sig.updateString(JSON.stringify(obj, Object.keys(obj).sort()));
  obj.signature = sig.sign();
}

function verify(obj, payload) {
  const { key: pem, hash, signature } = obj;
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
  assert.strictEqual(hash, SHA256(payload).toString(), 'Invalid hash');
}

function compile(inPath, outPath) {
  return new Promise((resolve, reject) => {
    const app = fs.readFileSync(inPath);
    const basePath = pathlib.dirname(inPath);
    const obj = JSON.parse(app);
    const {name, bundle: bundlePath, key: keyPath } = obj;
    const zip = new JSZip();
    const payload = fs.readFileSync(pathlib.join(basePath, bundlePath));
    const pem = fs.readFileSync(pathlib.join(basePath, keyPath));

    sign(obj, payload.toString(), pem);
  
    zip.file('app.json', JSON.stringify(obj));
    zip.file(bundlePath, payload);
  
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


module.exports = {
  compile,
  sign,
  verify,
};
