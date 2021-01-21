const $ = require('cash-dom');
const debug = require('ug:options')();

const DEFAULTS = {
  seed: true,
  duration: 24,
  trust: [],
};


function saveSetting(name, callback) {
  let value = $(`#${name}`).val();
  debug(`Read ${name}=${value} from element`);
  if (typeof(callback) === 'function') {
    debug(`Calling callback.`)
    value = callback(value);
  } else if (typeof(callback) !== 'undefined') {
    debug(`Using given value ${value}`);
    value = callback;
  }

  debug(`Storing ${name}=${value}, typeof=${typeof(value)}`)
  browser.storage.sync.set({
    [name]: value,
  })
}

function save(ev) {
  debug(`Saving all settings.`);
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
      debug(`Setting ${name}=${value}, typeof=${typeof(value)}`);

      if (typeof(callback) === 'function') {
        debug(`Calling callback to load setting ${name}.`);
        callback(value);
        return;
      }

      if (typeof(type) === 'function') {
        debug(`Converting setting using ${type}`);
        value = type(value);
      }

      debug(`Updating element for ${name}`);
      $(`#${name}`).val(value);
    })
    .catch(console.log);
}

function load() {
  debug(`Loading all settings.`);
  loadSetting('seed', null, (value) => {
    $('#seed').prop('checked', value);
  });
  loadSetting('duration', String);
  loadSetting('trust', (value) => value.join(', '));
}

function reset() {
  debug(`Resetting all settings.`);
  saveSetting('seed', String(DEFAULTS.seed));
  saveSetting('duration', String(DEFAULTS.duration));
  saveSetting('trust', DEFAULTS.trust.join(', '));
  load();
}


$(document).ready(load);
$('#save').on('click', save);
$('#reset').on('click', reset);
