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
    console.log('foo');
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

  execute(html, scripts) {
    debug('Creating host iframe, sandbox: %s, runtime: %O.', this.sandbox, this);

    return new Promise((resolve, reject) => {
      try {
        const iframe = document.createElement('iframe');
        iframe.setAttribute('id', 'host');
        document.body.appendChild(iframe);
    
        const win = iframe.contentWindow, doc = win.document, F = win.Function;
    
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
    
        // Sandbox AFTER making our modifications, we can be more restrictive.
        if (this.sandbox) {
          debug('Sandboxing iframe: %s', SANDBOX_ARGS);
          iframe.setAttribute('sandbox', SANDBOX_ARGS);
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  destroy() {
    $('#host').remove();
  }

  ping() {
    return 'pong';
  }
}

module.exports = {
  Runtime,
};
