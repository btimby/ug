const GO = document.getElementById('go');
const URL = document.getElementById('url');
const SERVE = document.getElementById('serve');

function openView() {
    var hash = URL.value;

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

function onKeyup(ev) {
    var charCode = (typeof ev.which === 'number') ? ev.which : ev.keyCode;

    if (charCode === 13) {
        openView();
    }
}

// Set up event handlers.
GO.addEventListener('click', openView);
SERVE.addEventListener('click', openServe);

// Focus input field.
URL.focus();
URL.addEventListener('keyup', onKeyup);
