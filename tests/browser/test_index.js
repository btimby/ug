const { isBrowser, isNode, isExtension } = require('../../src/index');


describe('index.js', () => {
  describe('#isBrowser()', () => {
    it('returns true under browser', () => {
      assert.isTrue(isBrowser());
    });
  });

  describe('#isNode()', () => {
    it('returns false under browser', () => {
      assert.isFalse(isNode());
    });
  });

  describe('#isExtension()', () => {
    it('returns false under browser', () => {
      assert.isFalse(isExtension());
    });
  });
});
