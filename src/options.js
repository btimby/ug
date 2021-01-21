const $ = require('cash-dom');

const DEFAULTS = {
  seed: true,
  duration: 24,
  trust: [],
};


function saveSetting(name, callback) {
  let value;

  if (typeof(callback) === 'function') {
    value = $(`#${name}`).val();
    value = callback(value);
  } else if (typeof(callback) === 'undefined') {
    value = $(`#${name}`).val();
  } else {
    value = callback;
  }

  browser.storage.sync.set({
    [name]: value,
  })
}

function save(ev) {
  saveSetting('seed', () => {
    return $('#seed').prop('checked');
  });
  saveSetting('duration', Number);
  saveSetting('trust', (value) => {
    if (typeof(value) !== 'undefined') {
      return value.split(', ')
    }
  });
}

function loadSetting(name, type, callback) {
  browser.storage.sync
    .get(name)
    .then((result) => {
      let value = result[name];

      if (typeof(callback) === 'function') {
        callback(value);
        return;
      }

      if (typeof(type) === 'function') {
        value = type(value);
      }

      $(`#${name}`).val(value);
    })
    .catch(console.log);
}

function load() {
  loadSetting('seed', null, (value) => {
    $('#seed').prop('checked', value);
  });
  loadSetting('duration', String);
  loadSetting('trust', (value) => value.join(', '));
}

function reset() {
  saveSetting('seed', String(DEFAULTS.seed));
  saveSetting('duration', String(DEFAULTS.duration));
  saveSetting('trust', DEFAULTS.trust.join(', '));
  load();
}


$(document).ready(load);
$('#save').on('click', save);
$('#reset').on('click', reset);
