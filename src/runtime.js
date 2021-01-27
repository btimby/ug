/*
This script is injected into the iframe that hosts an application.

It exposes an API that the application can use.
*/

const debug = require('debug')('ug:runtime');
const { PrefixedLocalStorage, PrefixedSessionStorage } = require("./engine/storage");

// Attempt to set up a safe environment.
const PREAMBLE = `
// Set up.
let [window, document, runtime] = arguments;
window.bus = window.top = window.parent = {};
runtime.install(window, document);
// Clean up.
delete runtime;
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

  install(window, document) {
    const bugout = this.server.bugout;
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
      ping: this.ping.bind(this),
      send: bugout.send,
      rpc: bugout.rpc,
      on: bugout.on,
    };
  }

  execute(html, scripts) {
    debug('Creating host iframe, sandbox: %s, runtime: %O.', this.sandbox, this);

    return new Promise((resolve, reject) => {
      try {
        const iframe = document.createElement('iframe');
        iframe.setAttribute('id', 'host');
        document.body.appendChild(iframe);

        const win = iframe.contentWindow, doc = win.document, F = win.Function;

        // Sandbox AFTER making our modifications, we can be more restrictive.
        if (this.sandbox) {
          debug('Sandboxing iframe: %s', SANDBOX_ARGS);
          iframe.setAttribute('sandbox', SANDBOX_ARGS);
        }

        // Wait for iframe to load remote resources. Otherwise our scripts run before potential
        // dependencies are available.
        iframe.addEventListener('load', () => {
          // Execute scripts in context of iframe.
          debug('Executing %i scripts.', scripts.length);
          for (var i = 0; i < scripts.length; i++) {
            F(PREAMBLE + scripts[i])(win, doc, this);
          }
          resolve();
        });

        debug('Writing HTML.');
        doc.write(html);
        doc.close();
      } catch (e) {
        reject(e);
      }
    });
  }

  destroy() {
    debug('Destroying application.')
    const iframe = document.getElementById('host');

    if (iframe) {
      debug('Removing host iframe.');
      iframe.remove();
    }
  }

  ping(callback) {
    const bugout = this.server.bugout;

    bugout.rpc('ping', {}, (result) => {
      debug('ping result: %O', result);
      if (typeof(callback) === 'function') {
        callback(result);
      }
    });
  }
}

module.exports = {
  Runtime,
};
