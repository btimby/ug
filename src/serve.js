const $ = require('cash-dom');
const JSZip = require('jszip');


const LOG_LEVEL = {
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  WARNING: 3, 
  ERROR: 4,
};

let RUNNING_APP = null;


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
  let maxSpeed = 0;
  const {app, torrent} = server;
  const url = `web+ug://${torrent.infoHash}`;

  console.log(`Setting up logging for ${app.id}`);
  $('#link')
    .attr('href', url)
    .text(url);

  log('Seeding, infoHash: {0}', torrent.infoHash);
  log('Exposing files: {0}', app.names);

  $('#name').text(app.fields.name);
  $('#version').text(app.fields.version);
  $('#author').text(app.fields.author);
  $('#desc').text(app.fields.description);

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

    maxSpeed = Math.max(maxSpeed, torrent.uploadSpeed);
    $('#max').text(maxSpeed);
  }, 1000);
}

function load() {
  const file = document.getElementById('app').files[0];

  if (!file) {
    return;
  }

  $('#log').empty();
  $('#runtime').show();
  log('Loading {1} byte application from {0}.', file.name, file.size);

  window.engine
    .createServer(file)
    .then((server) => {
      RUNNING_APP = server.app;
      setup(server);
    })
    .catch(log);
}

function stop() {
  if (!RUNNING_APP) {
    return;
  }

  window.engine
    .remove(RUNNING_APP.id)
    .then(() => {
      RUNNING_APP = null;
      $('#app').val(null);
      $('#runtime').hide();
    })
    .catch(log);
}

function remove() {
  if (!RUNNING_APP) {
    return;
  }

  if (!confirm('Remove data permanently?')) {
    return;
  }

  window.engine
    .flush(RUNNING_APP.id)
    .then(() => {
      RUNNING_APP = null;
      $('#app').val(null);
      $('#runtime').hide();
    })
    .catch(log);
}

$('#app').on('change', load);
$('#stop').on('click', stop);
$('#remove').on('click', remove);
$('#tail').on('click', tail);

if (window) {
  load();
}
