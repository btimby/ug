const $ = require('cash-dom');
const JSZip = require('jszip');
const debug = require('debug')('ug:serve');


const LOG_LEVEL = {
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  WARNING: 3, 
  ERROR: 4,
};

let RUNNING_SERVER = null;


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
    // Log level provided, followed by msg, start at third argument below.
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

  const divTag = $('<div>')
    .text(msg)
    .attr('class', `level-${lvl}`)
    .appendTo($('#log'));

  const tsTag = $('<p>')
    .text(ts)
    .attr({
      class: `timeago level-${lvl}`,
      datetime: ts
    })
    .prependTo(divTag);

  tail();  
}

function setup(server) {
  const {app, torrent} = server;
  const url = `web+ug://${server.id}`;
  RUNNING_SERVER = server;

  debug('Setting up logging for %s', server.id);
  $('#link')
    .attr('href', url)
    .text(url);

  log('Seeding, infoHash: {0}', server.id);
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
    window.bus
      .stats()
      .then((stats) => {
        // Handle drop-down list.
        const serving = $('<optgroup label="Serving"/>');
        const seeding = $('<optgroup label="Seeding"/>');
  
        for (let st in stats) {
          const opt = $(`<option value=${st.id}">${st.name}</option>`);
  
          if (st.isServing) {
            opt.appendTo(serving);
          } else {
            opt.appendTo(seeding);
          }
        }
  
        if (serving.children().length || seeding.children().length) {
          $('#servers')
            .empty();
        }

        if (serving.children().length) {
          $('#servers')
            .append(serving)
            .show();
        }
  
        if (seeding.children().length) {
          $('#servers')
            .append(seeding)
            .show();
        }

        // Torrent specific stats.
        stats = stats[torrent.infoHash];
        $('#peers').text(stats.numPeers);
        $('#upbytes').text(stats.uploaded);
        $('#upspeed').text(stats.uploadSpeed);
        $('#upmax').text(stats.maxUploadSpeed);
        $('#downbytes').text(stats.downloaded);
        $('#downspeed').text(stats.downloadSpeed);
        $('#downmax').text(stats.maxDownloadSpeed);
      });
  }, 1000);
}

function stop() {
  if (!RUNNING_SERVER) {
    return;
  }

  window.bus
    .remove(RUNNING_SERVER.id)
    .then(() => {
      RUNNING_SERVER = null;
      $('#app').val(null);
      $('#runtime').hide();
    })
    .catch(log);
}

function remove() {
  if (!RUNNING_SERVER) {
    return;
  }

  if (!confirm('Remove data permanently?')) {
    return;
  }

  window.bus
    .flush(RUNNING_SERVER.id)
    .then(() => {
      RUNNING_SERVER = null;
      $('#app').val(null);
      $('#runtime').hide();
    })
    .catch(log);
}

function load() {
  const file = document.getElementById('app').files[0];

  if (!file) {
    return;
  }

  $('#log').empty();
  $('#runtime').show();
  log('Loading {1} byte application from {0}.', file.name, file.size);

  window.bus
    .createServer(file)
    .then((server) => {
      setup(server);
    })
    .catch(log);
}

if (document) {
  $(document).ready(() => {
    $('#app').on('change', load);
    $('#stop').on('click', stop);
    $('#remove').on('click', remove);
    $('#tail').on('click', tail);
    $('#clear').on('click', () => {
      $('#log').empty();
    });
    
    load();
  });
}