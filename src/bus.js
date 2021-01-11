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
        bg[name](args)
          .then((res) => resolve(res))
          .catch((e) => reject(e));
      });
  });
}

window.engineServe = function engineServe(file) {
  return _doPromise('serveApp', file);
};

window.engineStop = function engineStop() {
  return _doPromise('stopApp', id);
};

window.engineRemove = function engineRemove() {
  return _doPromise('removeApp', id);
};

window.engineFetch = function engineFetch() {
  return _doPromise('fetchApp', id);
};

window.engineStats = function engineStats(id) {
  return _doPromise('stats', id);
};
