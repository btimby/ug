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
const RUNTIME_VERSION = '1.0.0';


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
    const app = this.server.app;
    const serverAddr = bugout.encodeaddress(app.key.publicKey);
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

    const rpc = (name, args, cb) => {
      bugout.rpc(serverAddr, name, [], cb);
    }

    // Methods exposed to scripts.
    window.ug = {
      create(name, opts, cb) {
        if (typeof opts === 'function') {
          cb, opts = opts, null;
        }
        const args = {
          name, opts,
        };
        rpc('collection.create', args, (r) => {
          debug('callback: collection.create(%s) === %O', name, r);
          if (typeof cb === 'function') {
            cb(r);
          }
        })
      },

      update(name, opts, cb) {
        if (typeof opts === 'function') {
          cb, opts = opts, null;
        }
        const args = {
          name, opts,
        };
        rpc('collection.update', args, (r) => {
          debug('callback: collection.update(%s) === %O', name, r);
          if (typeof cb === 'function') {
            cb(r);
          }
        });
      },

      set(name, key, value, opts, cb) {
        if (typeof opts === 'function') {
          cb, opts = opts, null;
        }
        const args = {
          name, key, value, opts,
        };
        rpc('collection.write', args, (r) => {
          debug('callback: collection.write(%s, %s) === %O', name, key, r);
          if (typeof cb === 'function') {
            cb(r);
          }
        });
      },

      list(name, opts, cb) {
        if (typeof opts === 'function') {
          cb, opts = opts, null;
        }
        const args = {
          name, opts,
        };
        rpc('collection.list', args, (r) => {
          debug('callback: collection.list(%s) === %O', name, r);
          if (typeof cb === 'function') {
            cb(r);
          }
        });
      },

      clear(name, opts, cb) {
        if (typeof opts === 'function') {
          cb, opts = opts, null;
        }
        const args = {
          name, opts,
        };
        rpc('collection.clear', args, (r) => {
          debug('callback: collection.clear(%s) === %O', name, r);
          if (typeof cb === 'function') {
            cb(r);
          }
        });
      },

      get(name, key, opts, cb) {
        if (typeof opts === 'function') {
          cb, opts = opts, null;
        }
        const args = {
          name, key, opts,
        };
        rpc('collection.get', args, (r) => {
          debug('callback: collection.get(%s, %s) === %O', name, key, r);
          if (typeof cb === 'function') {
            cb(r);
          }
        });
      },

      remove(name, key, opts, cb) {
        if (typeof opts === 'function') {
          cp, opts = opts, null;
        }
        const args = {
          name, key, opts,
        };
        rpc('collection.remove', args, (r) => {
          debug('callback: collection.remove(%s, %s) === %O', name, key, r);
          if (typeof cb === 'function') {
            cb(r);
          }
        });
      },

      version() {
        return RUNTIME_VERSION;
      }
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
}

module.exports = {
  Runtime,
  RUNTIME_VERSION,
};
