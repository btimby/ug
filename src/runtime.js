/*
This script is injected into the iframe that hosts an application.

It exposes an API that the application can use.
*/

const { PrefixedLocalStorage, PrefixedSessionStorage } = require("./engine");


class Runtime {
  constructor(server) {
    const prefix = `c:${server.id}`;

    this.server = server;
    this.localStorage = new PrefixedLocalStorage(prefix);
    this.sessionStorage = new PrefixedSessionStorage(prefix);
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

  ping() {
    return 'pong';
  }
}

module.exports = Runtime;
