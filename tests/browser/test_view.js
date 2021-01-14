const { parseHtml, parseQs, absURL } = require('../../src/view');
const { Runtime } = require('../../src/runtime');


// Building blocks.
const H1 = '<h1>Hi</h1>';
const BODY = `<body>${H1}</body>`;
const CODE = 'alert("Hi");';
const SCRIPT = `<script>${CODE}</script>`;

// Documents - various formats.
const DOCUMENTS = [
  `<html>${BODY}</html>`,
  `<html foo=bar bar="foo">${BODY}</html>`,
  `<html><body charset="utf-8">${H1}</body></html>`,
];
const DOCSCRIPTS = [
  `<html>${BODY}${SCRIPT}</html>`,
  `<html><BODY>${H1}</BODY><SCRIPT>${CODE}</SCRIPT></html>`,
  `<html>${BODY}<script type="text/javascript">${CODE}</script></html>`,
];
// Two script blocks.
const DOC0 = `<html>${BODY}${SCRIPT}${SCRIPT}</html>`;
// External script reference (src attr).
const DOC1 = `<html>${BODY}<script src="https://cdnjs.com/jquery.js"></script>${SCRIPT}</html>`;

// Querystrings -- not sure what else to test.
const QUERYSTRINGS = [
  'foo=foo&FOO=FOO',
  'FOO=FOO&foo=foo',
];

// Sandobx tests.
const SANDBOX = [
  {
    html: '<h1>Hi</h1>',
    scripts: [
      `
window.foo = 'foo';
      `
    ],
  }
];

describe('view.js', () => {
  describe('#parseHtml()', () => {
    it('parses body and script', () => {
      let body, scripts;
      for (let i = 0; i < DOCUMENTS.length; i++) {
        [body] = parseHtml(DOCUMENTS[i]);
        // We are not as concerned with the body tag (it should be returned as it was provided)
        // but we want to ensure the CONTENTS of the body tag are present.
        assert.include(body, H1);
      }
      for (let i = 0; i < DOCSCRIPTS.length; i++) {
        [body, scripts] = parseHtml(DOCSCRIPTS[i]);
        assert.include(body, H1);
        // Each ocument contains one script. The script should be returned as a function
        // which is wrapped by sandboxing preamble. Just check that it contains the code.
        assert.strictEqual(scripts.length, 1);
        assert.strictEqual(typeof(scripts[0]), 'string');
        assert.include(scripts[0].toString(), CODE);
      }
    });

    it('parses body and multiple scripts', () => {
      let [body, scripts] = parseHtml(DOC0);
      assert.include(body, H1);
      assert.strictEqual(scripts.length, 2);
      for (let i = 0; i < scripts.length; i++) {
        assert.strictEqual(typeof(scripts[i]), 'string');
        assert.include(scripts[i].toString(), CODE);
      }
    });

    it('leaves external references', () => {
      let [body, scripts] = parseHtml(DOC1);
      assert.include(body, H1);
      assert.include(body, 'https://cdnjs.com/jquery.js');
      assert.strictEqual(scripts.length, 1);
      assert.strictEqual(typeof(scripts[0]), 'string');
      assert.include(scripts[0].toString(), CODE);
    });
  });

  describe('#parseQs()', () => {
    it('can parse querystrings', () => {
      for (let i = 0; i < QUERYSTRINGS.length; i++) {
        let obj = parseQs(QUERYSTRINGS[i]);
        assert.hasAllKeys(obj, ['foo', 'FOO']);
        Object.keys(obj).forEach((key) => {
          assert.strictEqual(key, obj[key]);
        })
      }
    });
  });

  describe('#absURL()', () => {
    it('can create an absolute URL.', () => {
      const url = absURL('/dist/js/runtime.js');

      // NOTE: the base URL may change if karma.config.js is modified.
      assert.strictEqual(url, 'http://localhost:9876/dist/js/runtime.js');
    });
  });

  describe('#execute()', () => {
    let runtime;

    beforeEach(() => {
      const server = {
        id: 'foo',
      };
      runtime = new Runtime(server, true);
    });

    afterEach(() => {
      // NOTE: this is necessary because execute() is not intended to run more than once.
      runtime.destroy();
    });

    it('isolates parent window', () => {
      runtime.execute('<h1>Hi</h1>', [
        'document.foo = window.parent.foo = window.foo = "foo"',
      ]);

      const frame = document.getElementById('host');
      // Ensure script can access it's own document, window.
      assert.strictEqual(frame.contentWindow.foo, 'foo');
      assert.strictEqual(frame.contentDocument.foo, 'foo');

      // But not ours.
      assert.isUndefined(window.foo);
      assert.isUndefined(document.foo);
    });

    it('injects runtime', () => {
      // A runtime for our test run.
      runtime.execute('<h1>Hi</h1>', [
        'window.ping = ug.ping();',
      ]);

      const frame = document.getElementById('host');
      // Ensure script can access it's own document, window.
      assert.strictEqual(frame.contentWindow.ping, 'pong');
    });
  });
});
