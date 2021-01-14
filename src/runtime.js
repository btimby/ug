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

  install(window) {
    // Provide prefixed storage.
    Object.defineProperty(window, 'localStorage', {
      value: this.localStorage,
    });
    Object.defineProperty(window, 'sessionStorage', {
      value: this.sessionStorage,
    });

    window.ug = {
      ping: this.ping,
    };
  }

  // Methods exposed to scripts.
  ping() {
    return 'pong';
  }
}

module.exports = Runtime;
