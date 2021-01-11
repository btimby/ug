/*
Communication bus.

Allows browser action pages to communicate with the engine. During testing,
this script is replaced with a mock.
*/

function _doPromise(name, ...args) {
  return new Promise((resolve, reject) => {
    browser.runtime
      .getBackgroundPage()
      .then((bg) => {
        bg.engine[name](...args)
          .then(resolve)
          .catch(reject);
      });
  });
}

window.createServer = function createServer(app) {
  return _doPromise('createServer', app);
};

window.remove = function remove(id) {
  return _doPromise('remove', id);
};

window.flushServer = function flushServer(id) {
  return _doPromise('flush', id);
};

window.fetch = function fetch(id) {
  return _doPromise('fetch', id);
};

window.stats = function stats(id) {
  return _doPromise('stats', id);
};
