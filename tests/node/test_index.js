const fs = require('fs');
const { assert } = require('chai');
const { compile, extract, isBrowser, isNode, isExtension } = require('../../src/index');


describe('index.js', () => {
  describe('#compile()', () => {
    it('can compile an Application', (done) => {
      const app = compile('todo/app.json');

      // Ensure we can read the index file.
      app.readFile(app.fields.index);

      // Ensure signature is verifiable.
      app.sign();
      app.verify();

      app.save()
        .then((path) => {
          assert(fs.existsSync(path));

          // Load the application from disk.
          extract(path)
            .then((app) => {
              // Ensure signature is valid.
              app.verify();

              // Ensure private key is not leaked.
              assert.isUndefined(app.key.privateKey);

              // Ensure we can read a file.
              app.readFile(app.fields.index);

              done();
            })
            .catch(done);
        })
        .catch(done);
    });
  });

  describe('#iBrowser()', () => {
    it('returns false under node', () => {
      assert.isFalse(isBrowser());
    });
  });

  describe('#isNode()', () => {
    it('returns true under node', () => {
      assert.isTrue(isNode());
    });
  });

  describe('#isExtension()', () => {
    it('returns false under node', () => {
      assert.isFalse(isExtension());
    });
  });
});
