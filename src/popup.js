const $ = require('cash-dom');
const debug = require('debug')('ug:popup');
const { isExtension } = require('./index');


function openView() {
  var hash = $('#url').val();

  if (!hash.startsWith('web+ug://')) {
    $('#url')
      .addClass('invalid')
      .val('');
    return false;
  } else {
    $('#url').removeClass('invalid');
  }

  debug('Opening UG tab: %s', hash);
  browser.tabs.create({
    'url': `/dist/html/view.html?url=${hash}`,
  });

  // Close the popup
  window.close();
}

function openServe() {
  debug('Opening serve page');
  browser.tabs.create({
      'url': '/dist/html/serve.html',
  });

  // Close the popup
  window.close();
}

if (isExtension()) {
  $(document).ready(() => {
    // Set up event handlers.
    $('#go').on('click', (ev) => {
      ev.preventDefault();
      return openView();
    });
    $('#serve').on('click', openServe);
    $('#url')
      .on('keyup', (ev) => {
        $('#url').removeClass('invalid');
        var charCode = (typeof ev.which === 'number') ? ev.which : ev.keyCode;

        if (charCode === 13) {
          ev.preventDefault();
          return openView();
        }
      })
      .on('focus', () => {
        $('#url').removeClass('invalid');
      });
    $('#help').on('click', () => $('#readme').show());
  });
}
