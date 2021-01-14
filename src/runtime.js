/*
This script is injected into the iframe that hosts an application.

It exposes an API that the application can use.
*/

const $ = require('cash-dom');
const debug = require('debug')('ug:runtime');
const { PrefixedLocalStorage, PrefixedSessionStorage } = require("./engine");


// Attempt to set up a safe environment.
const PREAMBLE = `
let [window, document, runtime] = arguments;
window.top = window.parent = {};
runtime.install(window, document);
`;
const SANDBOX_ARGS = 'allow-forms allow-popups allow-modals allow-scripts';


class Runtime {
  constructor(server, sandbox) {
    const prefix = `c:${server.id}`;

    this.server = server;
    this.sandbox = sandbox;
    this.localStorage = new PrefixedLocalStorage(prefix);
    this.sessionStorage = new PrefixedSessionStorage(prefix);
  }

  execute(html, scripts) {
    debug('Creating host iframe, sandbox: %s, runtime: %O.', this.sandbox, this);

    const frame = $('<iframe id="host">');
    frame.appendTo($('body'));
    const doc = frame[0].contentDocument, win = frame[0].contentWindow, F = win.Function;

    debug('Writing HTML.');
    doc.write(html);

    // Sandbox AFTER making our modifications, we can be more restrictive.
    if (this.sandbox) {
      debug('Sandboxing iframe: %s', SANDBOX_ARGS);
      frame.attr('sandbox', SANDBOX_ARGS);
    }

    // Execute scripts in context of iframe.
    frame.show();
    debug('Executing %i scripts.', scripts.length);
    for (var i = 0; i < scripts.length; i++) {
      F(PREAMBLE + scripts[i])(win, doc, this);
    }
    doc.close();
  }

  install(window, document) {
    const windowAttrs = {
      // Provide prefixed storage.
      localStorage: this.localStorage,
      sessionStorage: this.sessionStorage,
    };

    for (let key in windowAttrs) {
      Object.defineProperty(window, key, {
        value: windowAttrs[key],
        configurable: true,
      })
    }

    // Methods exposed to scripts.
    window.ug = {
      ping: this.ping,
    };
  }

  destroy() {
    $('#host').remove();
  }

  ping() {
    return 'pong';
  }
}

module.exports = Runtime;
