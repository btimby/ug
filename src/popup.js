const GO = document.getElementById('go');
const KEYWORD = document.getElementById('keyword');
const SERVE = document.getElementById('serve');

function openView() {
    var hash = KEYWORD.value;

    console.log(`Opening UG tab: ${hash}`);
    browser.tabs.create({
      'url': `/dist/html/view.html?hash=${hash}`,
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
        openClient();
    }
}

// Focus input field.
KEYWORD.focus();

// Set up event handlers.
GO.addEventListener('click', openView);
SERVE.addEventListener('click', openServe);
KEYWORD.addEventListener('keyup', onKeyup);
