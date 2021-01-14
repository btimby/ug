/*
This script is injected into the iframe that hosts an application.

It exposes an API that the application can use.
*/

module.exports = {
  ping: () => {
    return 'pong';
  },
};
