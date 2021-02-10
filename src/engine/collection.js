const { assert } = require('chai');
const debug = require('debug')('ug:engine:collection');


class Collection {
  constructor(storage, name, opts) {
    this.storage = storage;
    this._name = name;
    this._opts = opts;
    this._data = {};
    this._synched = null;
    this._version = 0;
  }

  _makeKey(name) {
    name = name || this._name;
    return `collection:${name}`;
  }

  static _load(storage, name) {
    const key = this._makeKey(name);
    debug('Loading %s', key);
    let str = storage.getItem(key);
    if (!str) {
      throw new Error(`Collection "${name}" does not exist.`);
    }
    const obj = JSON.parse(str);
    const c = new Collection(storage, name, obj.opts);
    c._data = obj.data;
    c._version = obj.version;
    return c;
  }

  _save() {
    const key = this._makeKey();
    if (this._synched === this._version) {
      debug('Skipping %s save version %i', key, this._version);
      return;
    }
    const str = JSON.stringify({
      opts: this._opts,
      data: this._data,
      version: this._version,
    });
    debug('Saving %s version %i, length: %i', key, this._version, str.length);
    this.storage.setItem(key, str);
    this._synched = this._version;
  }

  _destroy() {
    const key = this._makeKey();
    debug('Destroying %s', key);
    this.storage.removeItem(key);
  }

  get name() {
    return this._name;
  }

  get opts() {
    return this._opts || {};
  }

  set opts(opts) {
    // TODO: apply new options.
    this._opts = opts;
    this._version++;
  }

  get data() {
    return this._data;
  }

  set data(data) {
    this._data = data;
    this._version++;
    this._save();
  }

  set(key, value, opts) {
    if (opts && opts.value !== this._data[key]) {
      throw new Error('Value mismatch');
    }
    debug('Setting %s.%s to %s', this._name, key, value);
    this._data[key] = value;
    this._version++;
    this._save();
  }

  get(key) {
    return this._data[key];
  }

  list(opts) {
    const items = [];

    for (let key in this.data) {
      const obj = { key };
      if (opts && opts.values) {
        obj.value = this.data[key];
      }
      items.push(obj)
    }

    debug('Listing %i items from %s', items.length, this._name);
    return items;
  }

  remove(key, opts) {
    if (opts && opts.value !== this._data[key]) {
      throw new Error('Value mismatch');
    }
    debug('Removing %s.%s', this._name, key);
    delete this._data[key]
    this._version++;
    this._save();
  }

  clear(opts) {
    if (opts && opts.version !== this._version) {
      throw new Error('Version mismatch');
    }
    debug('Clearing %s', this._name);
    this._data = {};
    this._version++;
    this._save();
  }
}

class CollectionManager {
  constructor(storage) {
    this.storage = storage;
    this.collections = {};
    this._load();
  }

  _load() {
    let str = this.storage.getItem('collections');
    if (!str) {
      return;
    }
    const collections = JSON.parse(str);
    debug('Loading %i collections', collections.length);

    collections.forEach((name) => {
      this.collections[name] = Collection._load(this.storage, name);
    });
  }

  _save() {
    debug('Saving %i collections', this.collections.length);
    const str = JSON.stringify(Object.keys(this.collections));
    this.storage.setItem('collections', str);
    for (let name in this.collections) {
      this.collections[name]._save();
    }
  }

  get_collection(name) {
    const collection = this.collections[name];
    if (!collection) {
      throw new Error('Invalid collection name');
    }
    return collection;
  }

  create(name, opts) {
    assert.isUndefined(this.collections[name], 'Collection exists');
    debug('Adding new collection %s', name);
    this.collections[name] = new Collection(this.storage, name, opts);
    this._save();
  }

  update(name, opts) {
    this.get_collection(name).opts = opts;
    this._save();
  }

  clear(name, opts) {
    this.get_collection(name).clear(opts);
  }

  get(name, key) {
    return this.get_collection(name).get(key);
  }

  set(name, key, value, opts) {
    this.get_collection(name).set(key, value, opts);
  }

  list(name, opts) {
    return this.get_collection(name).list(opts);
  }

  remove(name, key, opts) {
    this.get_collection(name).remove(key, opts);
  }

  destroy(name, opts) {
    const collection = this.get_collection(name);
    if (opts && opts.version !== collection._version) {
      throw new Error('Version mismatch');
    }
    collection._destroy();
    delete this.collections[name];
    this._save();
  }
}


module.exports = {
  CollectionManager,
};
