const $ = require('cash-dom');
const JSZip = require('jszip');


const LOG_LEVEL = {
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  WARNING: 3, 
  ERROR: 4,
};


function tail() {
  if ($('#tail').prop('checked')) {
    const log = $('#log')[0];
    log.scrollTop = log.scrollHeight - log.clientHeight;
  }
}

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

  const now = new Date();
  const date = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
  var ts = `${date} ${time}`;

  const p = $('<p>')
    .text(`[${ts}] ${msg}`)
    .attr('class', `level-${lvl}`)
    .appendTo($('#log'));
  tail();  
}

function setup(id, torrent) {
  const url = `web+ug://${torrent.infoHash}`;
  console.log(`Setting up logging for ${id}, ${torrent}`);
  $('#link')
    .attr('href', url)
    .text(url);

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
    $('#peers').text(torrent.numPeers);
    $('#bytes').text(torrent.uploaded);
    $('#speed').text(torrent.uploadSpeed);
  }, 1000);

  $('#runtime').show();
}

function load() {
  const file = document.getElementById('app').files[0];

  if (!file) {
    return;
  }

  $('#log').empty();
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

function stop() {
  $('#app').val(null);
  $('#runtime').hide();
}

function remove() {
  if (!confirm('Forget about this application?')) {
    return;
  }

  stop();
}

$('#app').on('change', load);
$('#stop').on('click', stop);
$('#remove').on('click', remove);
$('#tail').on('click', tail);

if (window) {
  load();
}
