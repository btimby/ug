const WebTorrent = require('webtorrent');
const createTorrent = require('create-torrent');
const parseTorrent = require('parse-torrent');
const { verify } = require('./index');


const TRACKERS = [
  "wss://tracker.openwebtorrent.com",
  // Dead:
  // "wss://tracker.fastcast.nz",
  // "wss://tracker.btorrent.xyz"
];
const WT = new WebTorrent();


function serveApp(obj, payload) {
  const { name, author, key, bundle } = obj;
  const id = key.public;

  console.log('Validating signature')
  verify(obj, payload);

  console.log('Engine, serving:', obj);

  const files = [
    new File([JSON.stringify(obj)], 'app.json'),
    new File([payload], 'bundle.html'),
    // TODO: open WebRTC for messaging and add peer info.
  ];

  const opts = {
    name: id,
    announce: TRACKERS,
  };

  return new Promise((resolve, reject) => {
    // Create torrent to retrieve infoHash.
    createTorrent(files, opts, (e, tmp) => {
      if (e) {
        reject(e);
        return;
      }

      // Torrent is a uint8Array instance.
      tmp = parseTorrent(tmp);

      // Get torrent if it is currently active.
      let torrent = WT.get(tmp.infoHash);

      if (torrent) {
        resolve([id, torrent]);
        return;
      }

      WT.seed(files, opts, (torrent) => {
        resolve([id, torrent]);
      });
    });  
  });
}

function _getFile(torrent, path) {
  return new Promise((resolve, reject) => {
    const file = torrent.files.find((file) => {
      return file.name === path;
    });

    if (!file) {
      // File not found.
      reject(new Error(`No such path ${path} in torrent`));
      return;
    }

    file.getBuffer((e, buffer) => {
      if (e) {
        reject(e);
        return;
      }
      resolve(buffer);
    });
  });
}

function fetchApp(hash) {
  console.log(`Engine, fetching: ${hash}`);

  return new Promise((resolve, reject) => {
    function _extractBundle(torrent) {
      Promise.all([_getFile(torrent, 'app.json'), _getFile(torrent, 'bundle.html')])
        .then(([app, buffer]) => {
          const obj = JSON.parse(app.toString());
          const body = buffer.toString();

          verify(obj, body);
          resolve([obj, body]);
        })
        .catch((e) => {
          reject(e);
        });
    }

    // Torrent may be locally seeded, or already downloaded / downloading.
    const torrent = WT.get(hash);

    if (torrent) {
      _extractBundle(torrent);
    } else {
      WT.add(hash, {announce: TRACKERS}, (torrent) => {
        // TODO: return via promise the bundle / payload.
        _extractBundle(torrent);
      });
    }
  });
}

console.log('Engine, starting');

if (chrome) {
  // This does not currently work, see:
  // https://bugs.chromium.org/p/chromium/issues/detail?id=64100&q=registerprotocolhandler%20extension&can=2
  const url = chrome.runtime.getURL('/html/view.html?hash=%s');
  console.log(url);
  try {
    navigator.registerProtocolHandler(
      'web+ug', url, 'Web Underground scheme');
  } catch (e) {
    console.log('Error installing protocol handler', e);    
  }
}

// Make available to rest of extension.
window.serveApp = serveApp;
window.fetchApp = fetchApp;

module.exports = {
  serveApp,
  fetchApp,
};
