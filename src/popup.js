const $ = require('cash-dom');
const debug = require('debug')('ug:popup');


function openView() {
  var hash = $('#url').val();

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

function keyUp(ev) {
  var charCode = (typeof ev.which === 'number') ? ev.which : ev.keyCode;

  if (charCode === 13) {
    openView();
  }
}

if (document) {
  $(document).ready(() => {
    // Set up event handlers.
    $('#go').on('click', openView);
    $('#serve').on('click', openServe);
    $('#url').on('keyup', keyUp);
  });
}
