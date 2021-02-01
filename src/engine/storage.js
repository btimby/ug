const debug = require('debug')('ug:engine:storage');


class PrefixedStorage {
  constructor(backend, prefix) {
    debug('Setting up storage with prefix %s', prefix);
    this.backend = backend;
    this.prefix = prefix;
  }

  _makeKey(key) {
    return `${this.prefix}:${key}`;
  }

  setItem(key, value) {
    key = this._makeKey(key);
    debug('Setting: %s to %s', key, value);
    this.backend.setItem(key, value);
  }

  getItem(key) {
    key = this._makeKey(key);
    const value = this.backend.getItem(key);
    debug('Read: %s from %s', value, key);
    return value;
  }

  key(index) {
    let pos = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = this.backend.key(i);

      if (!key.startsWith(`${this.prefix}:`)) {
        continue;
      }

      if (index == pos++) {
        return key.substring(this.prefix.length + 1);
      }
    }
  }

  removeItem(key) {
    key = this._makeKey(key);
    debug('Removing: %s', key);
    this.backend.removeItem(key);
  }

  clear() {
    debug('Clearing storage with prefix %s', this.prefix);

    let toRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = this.backend.key(i);

      if (key.startsWith(`${this.prefix}:`)) {
        toRemove.push(key);
      }
    }

    for (let i = 0; i < toRemove.length; i++) {
      debug('Clearing %s', toRemove[i]);
      this.backend.removeItem(toRemove[i]);
    }
  }
}

class PrefixedLocalStorage extends PrefixedStorage {
  constructor(prefix) {
    super(localStorage, prefix);
  }
}

class PrefixedSessionStorage extends PrefixedStorage {
  constructor(prefix) {
    super(sessionStorage, prefix);
  }
}


module.exports = {
  PrefixedLocalStorage,
  PrefixedSessionStorage,
};
