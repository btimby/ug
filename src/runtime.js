/*
This script is injected into the iframe that hosts an application.

It exposes an API that the application can use.
*/


class Runtime {
  constructor(server) {
    this.server = server;
  }

  ping() {
    return 'pong';
  }
}

module.exports = Runtime;
