const { localStorage } = require('../src/index');
const { CollectionManager } = require('../src/engine/collection');
const { assert } = require('chai');

const COLLECTION = {
  version: 0,
  data: {},
};


describe('collection.js', () => {
  describe('#CollectionManager', () => {
    let cm;

    beforeEach(() => {
      cm = new CollectionManager(localStorage);
      cm.create('foobar');
    });

    afterEach(() => {
      cm.destroy('foobar');
    });

    it('can create', () => {
      assert.throws(() => {
        cm.create('foobar');
      }, 'Collection exists');

      assert.strictEqual(localStorage.getItem('collections'), '["foobar"]');
      const collection = JSON.parse(localStorage.getItem('collection:foobar'));
      assert.deepStrictEqual(collection, COLLECTION);
    });

    it('can set and get', () => {
      cm.set('foobar', 'foo', 'bar');

      assert.throws(() => {
        cm.set('foobar', 'foo', 'quux', { value: 'quux' })
      }, 'Value mismatch');

      assert.strictEqual(cm.get('foobar', 'foo'), 'bar');
      const left = JSON.parse(localStorage.getItem('collection:foobar'));
      const right = { version: 1, data: { 'foo': 'bar' }};
      assert.deepStrictEqual(left, right);
    });

    it('can clear', () => {
      cm.set('foobar', 'foo', 'bar');

      assert.throws(() => {
        cm.clear('foobar', { version: 0 });
      }, 'Version mismatch');

      cm.clear('foobar');
      const collection = JSON.parse(localStorage.getItem('collection:foobar'));
      assert.deepStrictEqual(collection, { ...COLLECTION, version: 2});
    });

    it('can remove', () => {
      cm.set('foobar', 'foo', 'bar');

      assert.throws(() => {
        cm.remove('foobar', 'foo', { value: 'quux' });
      }, 'Value mismatch');

      cm.remove('foobar', 'foo');
      const collection = JSON.parse(localStorage.getItem('collection:foobar'));
      assert.deepStrictEqual(collection, { ...COLLECTION, version: 2});
    });

    it('can list', () => {
      cm.set('foobar', 'foo', 'bar');
      let items = cm.list('foobar', { values: true });
      assert.deepStrictEqual(items, [{ key: 'foo', value: 'bar'  }]);

      cm.set('foobar', 'bar', 'quux');
      items = cm.list('foobar');
      assert.deepStrictEqual(items, [{ key: 'foo' }, { key: 'bar' }]);
    });
  });
});