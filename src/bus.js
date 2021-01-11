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
        bg.engine[name](args)
          .then((res) => resolve(res));
      });
  });
}

window.createServer = function createServer(file) {
  return _doPromise('createServer', app);
};

window.remove = function remove() {
  return _doPromise('remove', id);
};

window.flushServer = function flushServer() {
  return _doPromise('flush', id);
};

window.fetch = function fetch() {
  return _doPromise('fetch', id);
};

window.stats = function stats(id) {
  return _doPromise('stats', id);
};
