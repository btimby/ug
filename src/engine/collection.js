const { assert } = require('chai');


class Collection {
  constructor(storage, name, opts) {
    this.storage = storage;
    this._name = name;
    this._opts = opts;
    this._data = {};
    this._synched = null;
    this._version = 0;
  }

  static _load(storage, name) {
    let str = storage.getItem(`collection:${name}`);
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
    if (this._synched === this._version) {
      return;
    }
    const str = JSON.stringify({
      opts: this._opts,
      data: this._data,
      version: this._version,
    });
    this.storage.setItem(`collection:${this.name}`, str);
    this._synched = this._version;
  }

  _destroy() {
    this.storage.removeItem(`collection:${this.name}`);
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

    return items;
  }

  remove(key, opts) {
    if (opts && opts.value !== this._data[key]) {
      throw new Error('Value mismatch');
    }
    delete this._data[key]
    this._version++;
    this._save();
  }

  clear(opts) {
    if (opts && opts.version !== this._version) {
      throw new Error('Version mismatch');
    }
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

    collections.forEach((name) => {
      this.collections[name] = Collection._load(this.storage, name);
    });
  }

  _save() {
    const str = JSON.stringify(Object.keys(this.collections));
    this.storage.setItem('collections', str);
    for (let name in this.collections) {
      this.collections[name]._save();
    }
  }

  create(name, opts) {
    assert.isUndefined(this.collections[name], 'Collection exists');
    this.collections[name] = new Collection(this.storage, name, opts);
    this._save();
  }

  update(name, opts) {
    this.collections[name].opts = opts;
    this._save();
  }

  clear(name, opts) {
    this.collections[name].clear(opts);
  }

  get(name, key) {
    return this.collections[name].get(key);
  }

  set(name, key, value, opts) {
    this.collections[name].set(key, value, opts);
  }

  list(name, opts) {
    return this.collections[name].list(opts);
  }

  remove(name, key, opts) {
    this.collections[name].remove(key, opts);
  }

  destroy(name, opts) {
    const collection = this.collections[name];
    if (!collection) {
      throw new Error('Invalid collection name');
    }
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
