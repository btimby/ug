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
const WT = new WebTorrent({
  store: LSChunkStore,
});


window.serveApp = function serveApp(file) {
  extract(file)
    .then(([obj, files]) => {
      const id = obj.signature;
      console.log('Engine, serving:', obj);
      // TODO: open WebRTC for messaging and add peer info.

      const fileObjs = [];
      const keys = Object.keys(files);
      for (let i = 0; i < keys.length; i++) {
        fileObjs.push(new File([files[keys[i]]], keys[i]));
      }

      const opts = {
        name: id,
        announce: TRACKERS,
        comment: obj.description,
      };
    
      return new Promise((resolve, reject) => {
        // Create torrent to retrieve infoHash.
        createTorrent(fileObjs, opts, (e, tmp) => {
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
    
          WT.seed(fileObjs, opts, (torrent) => {
            resolve([id, torrent]);
          });
        });  
      });
    });
};

window.fetchApp = function fetchApp(id) {
  console.log(`Engine, fetching: ${id}`);

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
        });
    }

    // Torrent may be locally seeded, or already downloaded / downloading.
    const torrent = WT.get(id);
    const opts = {
      announce: TRACKERS,
    };

    if (torrent) {
      _extractBundle(torrent);
    } else {
      WT.add(id, opts, (torrent) => {
        // TODO: return via promise the bundle / payload.
        _extractBundle(torrent);
      });
    }
  });
};

window.stopApp = function stopApp(id) {
  return new Promise((resolve, reject) => {
    WT.remove(id, (e) => {
      if (e) {
        reject(e);
        return;
      }

      resolve();
    })  
  });
};

window.removeApp = function removeApp(id) {
  // TODO: remove torrent files from store.
  // TODO: remove app information from localStorage (won't see next start).
};

window.stats = function stats(id) {
  function _getStats(torrent) {
    const stats = {
      torrent,
    };

    return stats;
  }

  return new Promise((resolve, reject) => {
    if (id) {
      // get stats for specific id.
      const torrent = WT.get(id);

      if (!torrent) {
        reject(new Error(`Invalid torrent id ${id}`));
        return;
      }
      resolve(_getStats(torrent));
    } else {
      const stats = [];
      for (let i = 0; i < WT.torrents.length; i++) {
        stats.push(_getStats(torrent));
      }
      resolve(stats);
    }
  });
};

function _start() {
  console.log('Engine, starting');

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
