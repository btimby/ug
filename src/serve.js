const JSZip = require('jszip');


const APP = document.getElementById('app');
const LOG = document.getElementById('log');
const ADDR = document.getElementById('address');
const LINK = document.getElementById('link');
const PEERS = document.getElementById('peers');
const BYTES = document.getElementById('bytes');
const SPEED = document.getElementById('speed');

const LOG_LEVEL = {
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  WARNING: 3, 
  ERROR: 4,
};


function log() {
  // First argument is the log message. Subsequent items are formatted into
  // the message '{0}' for first item, '{1}' for second etc. Non-strings are
  // stringified.
  let lvl, msg, start;

  if (typeof(arguments[0]) === 'integer') {
    // Log level provided, followed by msg, start at third arguments below.
    [lvl, msg] = arguments;
    start = 2;
  } else {
    // Log level omitted, msg provided, start at second argument below.
    lvl = LOG_LEVEL.DEBUG;
    msg = arguments[0];
    start = 1;
  }

  for (let i = start; i < arguments.length; i++) {
    let arg = arguments[i];
    const fmt = `{${i - start}}`;

    if (typeof(arg) !== 'string') {
      arg = JSON.stringify(arg, null, 2);
    }

    if (msg.indexOf(fmt) === -1) {
      log(`Invalid string formatting, no ${fmt}.`);
    }

    msg = msg.replace(fmt, arg);
  }

  const p = document.createElement('p');

  const now = new Date();
  const date = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
  var ts = `${date} ${time}`;

  p.innerHTML = `[${ts}] ${msg}`;
  p.setAttribute('class', `level-${lvl}`);
  LOG.appendChild(p);
}

function logClear() {
  let p;

  while(true) {
    const p = LOG.getElementsByTagName('p');
    if (p.length === 0) {
      break;
    }
    p[0].remove();
  }
}

function setup(id, torrent) {
  const url = `web+ug://${torrent.infoHash}`;
  console.log(`Setting up logging for ${id}, ${torrent}`);
  LINK.setAttribute('href', url);
  LINK.innerHTML = url;
  ADDR.value = torrent.infoHash;

  log('Seeding, infoHash: {0}', torrent.infoHash);
  log('Seeding, magnetUri: {0}', torrent.magnetUri);

  torrent.on('warning', log);
  torrent.on('error', log);

  torrent.on('wire', (peer, addr) => {
    log('Peer {0} connected', addr);
  });
  torrent.on('upload', (bytes) => {
    log('Sent {0} bytes', bytes);
  });

  setInterval(() => {
    PEERS.innerText = torrent.numPeers;
    BYTES.innerText = torrent.uploaded;
    SPEED.innerText = torrent.uploadSpeed;
  }, 1000);
}

function loadApp() {
  const file = this.files[0];
  if (!file) {
    return;
  }

  logClear();
  log('Loading {1} byte application from {0}.', file.name, file.size);

  JSZip
    .loadAsync(file)
    .then((zip) => {
      log('Extracting files.')
      zip.files['app.json']
        .async('string')
        .then((content) => {
          const obj = JSON.parse(content);

          zip.files[obj.bundle]
            .async('string')
            .then((bundle) => {
              log('Initializing: {0}', obj);
              browser.runtime
                .getBackgroundPage()
                .then((bg) => {
                  bg
                    .serveApp(obj, bundle)
                    .then(([id, torrent]) => {
                      setup(id, torrent);
                    })
                    .catch((e) => {
                      console.log(e);
                    });
                });
            })
            .catch((e) => {
              console.log(e);
            });
          })
          .catch((e) => {
            console.log(e);
          });
    });
}


APP.addEventListener('change', loadApp);

if (window) {
  loadApp.bind(APP)();
}
