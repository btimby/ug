const fs = require('fs');
const { assert } = require('chai');
const { compile, extract } = require('../../src/index');


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
              assert.throws(() => { app.privateKey }, 'No private key');

              // Ensure we can read a file.
              app.readFile(app.fields.index);

              done();
            })
            .catch(done);
        })
        .catch(done);
    });
  });
});
