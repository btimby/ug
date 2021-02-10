const { CollectionManager } = require('../../src/engine/collection');
const { assert } = require('chai');

const COLLECTION = {
  version: 0,
  data: {},
};


describe('collection', () => {
  describe('#CollectionManager', () => {
    let cm;

    beforeEach(() => {
      cm = new CollectionManager(localStorage);
      cm.create('foobar');
    });

    afterEach(() => {
      cm.destroy('foobar');
    });

    it('create()', () => {
      assert.throws(() => {
        cm.create('foobar');
      }, 'Collection exists');

      assert.strictEqual(localStorage.getItem('collections'), '["foobar"]');
      const collection = JSON.parse(localStorage.getItem('collection:foobar'));
      assert.deepStrictEqual(collection, COLLECTION);
    });

    it('set() and get()', () => {
      cm.set('foobar', 'foo', 'bar');

      assert.throws(() => {
        cm.set('foobar', 'foo', 'quux', { value: 'quux' })
      }, 'Value mismatch');

      assert.strictEqual(cm.get('foobar', 'foo'), 'bar');
      const left = JSON.parse(localStorage.getItem('collection:foobar'));
      const right = { ...COLLECTION, data: { 'foo': 'bar' }};
    });

    it('clear()', () => {
      cm.set('foobar', 'foo', 'bar');

      assert.throws(() => {
        cm.clear('foobar', { version: 0 });
      }, 'Version mismatch');

      cm.clear('foobar');
      const collection = JSON.parse(localStorage.getItem('collection:foobar'));
      assert.deepStrictEqual(collection, { ...COLLECTION, version: 2});
    });

    it('remove()', () => {
      cm.set('foobar', 'foo', 'bar');

      assert.throws(() => {
        cm.remove('foobar', 'foo', { value: 'quux' });
      }, 'Value mismatch');

      cm.remove('foobar', 'foo');
      const collection = JSON.parse(localStorage.getItem('collection:foobar'));
      assert.deepStrictEqual(collection, { ...COLLECTION, version: 2});
    });
  });
});