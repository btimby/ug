const $ = require('cash-dom');
const JSZip = require('jszip');
const { PackageApplication } = require('./index');


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

function setup(server) {
  const url = `web+ug://${server.torrent.infoHash}`;
  console.log(`Setting up logging for ${server.app.id}`);
  $('#link')
    .attr('href', url)
    .text(url);

  log('Seeding, infoHash: {0}', server.torrent.infoHash);
  log('Exposing files: {0}', server.app.names);

  server.torrent.on('warning', log);
  server.torrent.on('error', log);

  server.torrent.on('wire', (peer, addr) => {
    log('Peer {0} connected', addr);
  });
  server.torrent.on('upload', (bytes) => {
    log('Sent {0} bytes', bytes);
  });

  setInterval(() => {
    $('#peers').text(server.torrent.numPeers);
    $('#bytes').text(server.torrent.uploaded);
    $('#speed').text(server.torrent.uploadSpeed);
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

  file
    .arrayBuffer()
    .then((data) => {
      PackageApplication
        .load(data)
        .then((app) => {
          window.createServer(app)
            .then(setup)
            .catch(console.log);
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
