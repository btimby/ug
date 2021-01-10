const WebTorrent = require('webtorrent');
const LSChunkStore = require('ls-chunk-store');
const createTorrent = require('create-torrent');
const parseTorrent = require('parse-torrent');
const { verify } = require('./index');


const TRACKERS = [
  "wss://tracker.openwebtorrent.com",
  // Dead:
  // "wss://tracker.fastcast.nz",
  // "wss://tracker.btorrent.xyz"
];
const WT = new WebTorrent({
  store: LSChunkStore,
});


function serveApp(obj, payload) {
  const id = obj.signature;

  console.log('Validating signature')
  verify(obj, payload);
  // TODO: open WebRTC for messaging and add peer info.

  console.log('Engine, serving:', obj);

  const files = [
    new File([JSON.stringify(obj)], 'app.json'),
    new File([payload], obj.bundle),
  ];

  const opts = {
    name: id,
    announce: TRACKERS,
    comment: obj.description,
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

function fetchApp(hash) {
  console.log(`Engine, fetching: ${hash}`);

  return new Promise((resolve, reject) => {
    function _extractBundle(torrent) {
      function _getFile(path) {
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

      console.log('Parsing app description');
      _getFile('app.json')
        .then((content) => {
          // We must read the json app description to determine the bundle file name.
          const obj = JSON.parse(content.toString());

          console.log(`Fetching bundle ${obj.bundle}`);
          _getFile(obj.bundle)
            .then((content) => {
              const body = content.toString();

              console.log('Verifying signature.');
              verify(obj, body);

              console.log('Application loaded.');
              resolve([obj, body]);
            })
            .catch((e) => {
              reject(e);
            });
        })
        .catch((e) => {
          reject(e);
        });
    }

    // Torrent may be locally seeded, or already downloaded / downloading.
    const torrent = WT.get(hash);
    const opts = {
      announce: TRACKERS,
    };

    if (torrent) {
      _extractBundle(torrent);
    } else {
      WT.add(hash, opts, (torrent) => {
        // TODO: return via promise the bundle / payload.
        _extractBundle(torrent);
      });
    }
  });
}

function start() {
  console.log('Engine, starting');

  // TODO: load past applications from localStorage and serve them.
}

if (chrome) {
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
}

if (window) {
  start();
}

// Make available to rest of extension.
window.serveApp = serveApp;
window.fetchApp = fetchApp;

module.exports = {
  serveApp,
  fetchApp,
};
