const fs = require('fs');
const { assert } = require('chai');
const { compile } = require('../../src/index');


describe('index.js', () => {
  describe('#compile()', () => {
    it('can compile a single bundle', (done) => {
      compile('todo/app.json')
        .then((path) => {
          assert(fs.existsSync(path));
          done();
        })
        .catch((e) => {
          done(e);
        });
    });
  });
});
