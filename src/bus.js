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

window.bus = {
  serve(file) {
    return _doPromise('serve', file);
  },

  fetch(file) {
    return _doPromise('fetch', file);
  },

  remove(id) {
    return _doPromise('remove', id);
  },

  flush(id) {
    return _doPromise('flush', id);
  },

  stats() {
    return _doPromise('stats');
  },
};
