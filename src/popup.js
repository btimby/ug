const $ = require('cash-dom');


function openView() {
    var hash = $('#url').val();

    console.log(`Opening UG tab: ${hash}`);
    browser.tabs.create({
      'url': `/dist/html/view.html?url=${hash}`,
    });

    // Close the popup
    window.close();
}

function openServe() {
    console.log('Opening serve page');
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

// Set up event handlers.
$('#go').on('click', openView);
$('#serve').on('click', openServe);
$('#url').on('keyup', keyUp);
