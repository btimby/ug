const WebTorrent = require('webtorrent');
const { Engine } = require('../src/engine/index');
const { atob, localStorage } = require('../src/index');
const { PrefixedLocalStorage } = require('../src/engine/storage');
const { assert } = require('chai');

const FIELDS = {
  "name": "todo",
  "description": "Web Underground test application :: todo",
  "version": "1.0.0",
  "author": "Ben Timby <btimby@gmail.com>",
  "key": "38bRGbZ84SwAaFaWBEfJmccJYikuqrWcYZR4gFyFZXW6xQC5XnmhmW3mYZbgrYNypGB3JZvr6wVexjn2xCxf1mD",
  "files":[
    {
      "name": "index.html",
      "hash": "28RHnREYzSbzTdCxcPsXYHHTYp8AnU9aBrBTpbrTrahSNYaED5gpFcubiWqKfU7ibykSKk7hbVouWQrHuTtkFLGd"
    },
  ],
  "index": "index.html",
  "signature": "5skCdUXXvwNwSVSMnSvDmBS1xnRemAagaPdfzKmQYXBvk7qfVL1TwGhAJDjMW2xqq7eRq9KdJSxrGN5ry8bXbxAQ",
};
const APP = `UEsDBAoACAAAADogSVIAAAAAAAAAAAAAAAAIAAAAYXBwLmpzb257Im5hbWUiOiJ0b2RvIiwiZGVz
Y3JpcHRpb24iOiJXZWIgVW5kZXJncm91bmQgdGVzdCBhcHBsaWNhdGlvbiA6OiB0b2RvIiwidmVy
c2lvbiI6IjEuMC4wIiwiYXV0aG9yIjoiQmVuIFRpbWJ5IDxidGltYnlAZ21haWwuY29tPiIsImZp
bGVzIjpbeyJuYW1lIjoiaW5kZXguaHRtbCIsImhhc2giOiIyOFJIblJFWXpTYnpUZEN4Y1BzWFlI
SFRZcDhBblU5YUJyQlRwYnJUcmFoU05ZYUVENWdwRmN1YmlXcUtmVTdpYnlrU0trN2hiVm91V1Fy
SHVUdGtGTEdkIn1dLCJpbmRleCI6ImluZGV4Lmh0bWwiLCJzaWduYXR1cmUiOiI1c2tDZFVYWHZ3
TndTVlNNblN2RG1CUzF4blJlbUFhZ2FQZGZ6S21RWVhCdms3cWZWTDFUd0doQUpEak1XMnhxcTdl
UnE5S2RKU3hyR041cnk4YlhieEFRIiwia2V5IjoiMzhiUkdiWjg0U3dBYUZhV0JFZkptY2NKWWlr
dXFyV2NZWlI0Z0Z5RlpYVzZ4UUM1WG5taG1XM21ZWmJncllOeXBHQjNKWnZyNndWZXhqbjJ4Q3hm
MW1EIn1QSwcI/s2W3eABAADgAQAAUEsDBAoACAAAADogSVIAAAAAAAAAAAAAAAAKAAAAaW5kZXgu
aHRtbDwhRE9DVFlQRSBodG1sPgo8aHRtbD4KPGhlYWQ+CiAgPHRpdGxlPldlbGNvbWUgdG8gVnVl
PC90aXRsZT4KICA8c2NyaXB0IHNyYz0iaHR0cHM6Ly91bnBrZy5jb20vdnVlIj48L3NjcmlwdD4K
PC9oZWFkPgo8Ym9keT4KICA8ZGl2IGlkPSJhcHAiPgogICAgPGltZyBzcmM9Imh0dHBzOi8vZXh0
ZXJuYWwtY29udGVudC5kdWNrZHVja2dvLmNvbS9pdS8/dT1odHRwcyUzQSUyRiUyRmkuaW1ndXIu
Y29tJTJGT3ZNWkJzOS5qcGcmZj0xJm5vZmI9MSIgYWx0PSJUT0RPIGxvZ28iPgogICAgPGgyPnt7
IGdyZWV0aW5nIH19PC9oMj4KICAgIDxpbnB1dAogICAgICB2LW1vZGVsPSJ0b2RvLnRpdGxlIgog
ICAgICB0eXBlPSJ0ZXh0IgogICAgICBuYW1lPSJ0aXRsZSIKICAgIC8+CiAgICA8YnV0dG9uIEBj
bGljaz0iYWRkVG9kbyIgdGl0bGU9IkFkZCBhIG5ldyB0b2RvIGl0ZW0iPkFkZDwvYnV0dG9uPgog
ICAgPHVsPgogICAgICA8bGkgdi1mb3I9InRvZG8gaW4gdG9kb3MiIDprZXk9InRvZG8uaWQiPgog
ICAgICAgIHt7IHRvZG8udGl0bGUgfX0KICAgICAgICA8YnV0dG9uIEBjbGljaz0iZGVsVG9kbyh0
b2RvLmlkKSIgdGl0bGU9IkRlbGV0ZSB0b2RvIGl0ZW0uIj5EZWw8L2J1dHRvbj4KICAgICAgPC9s
aT4KICAgIDwvdWw+CiAgPC9kaXY+CgogIDxzY3JpcHQ+CiAgICB2YXIgYXBwID0gbmV3IFZ1ZSh7
CiAgICAgIGVsOiAnI2FwcCcsCgogICAgICBkYXRhKCkgewogICAgICAgIHJldHVybiB7CiAgICAg
ICAgICBncmVldGluZzogJ1dlbGNvbWUgdG8gdGhlIFdlYiBVbmRlcmdyb3VuZCEnLAogICAgICAg
ICAgdG9kbzogewogICAgICAgICAgICB0aXRsZTogbnVsbCwKICAgICAgICAgIH0sCiAgICAgICAg
ICB0b2RvczogW10sCiAgICAgICAgfQogICAgICB9LAoKICAgICAgbW91bnRlZCgpIHsKICAgICAg
ICB3aW5kb3cudWcucGluZygpOwogICAgICAgIHRoaXMuZ2V0VG9kb3MoKTsKICAgICAgfSwKCiAg
ICAgIHdhdGNoOiB7CiAgICAgICAgdG9kb3M6IHsKICAgICAgICAgIGhhbmRsZXIoKSB7CiAgICAg
ICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3RvZG9zJywgSlNPTi5zdHJpbmdpZnkodGhp
cy50b2RvcykpOwogICAgICAgICAgICB9LAogICAgICAgICAgZGVlcDogdHJ1ZSwKICAgICAgICB9
LAogICAgICB9LAoKICAgICAgbWV0aG9kczogewogICAgICAgIGdldFRvZG9zKCkgewogICAgICAg
ICAgY29uc3QgdG9kb3MgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCd0b2Rvcycp
KTsKICAgICAgICAgIHRoaXMudG9kb3MgPSB0b2RvcyB8fCBbXTsKICAgICAgICB9LAoKICAgICAg
ICBhZGRUb2RvKCkgewogICAgICAgICAgdGhpcy50b2Rvcy5wdXNoKHsKICAgICAgICAgICAgaWQ6
IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoKS5zdWJzdHIoMiwgOCksCiAgICAgICAgICAgIHRpdGxl
OiB0aGlzLnRvZG8udGl0bGUsCiAgICAgICAgICB9KTsKICAgICAgICAgIHRoaXMudG9kbyA9IHsK
ICAgICAgICAgICAgdGl0bGU6IG51bGwsCiAgICAgICAgICB9OwogICAgICAgIH0sCgogICAgICAg
IGRlbFRvZG8oaWQpIHsKICAgICAgICAgIHRoaXMudG9kb3MgPSB0aGlzLnRvZG9zLmZpbHRlcigo
b2JqKSA9PiAob2JqLmlkICE9PSBpZCkpOwogICAgICAgIH0sCiAgICAgIH0sCgogICAgfSkKICA8
L3NjcmlwdD4KPC9ib2R5Pgo8L2h0bWw+ClBLBwg6+2NSigYAAIoGAABQSwECFAAKAAgAAAA6IElS
/s2W3eABAADgAQAACAAAAAAAAAAAAAAAAAAAAAAAYXBwLmpzb25QSwECFAAKAAgAAAA6IElSOvtj
UooGAACKBgAACgAAAAAAAAAAAAAAAAAWAgAAaW5kZXguaHRtbFBLBQYAAAAAAgACAG4AAADYCAAA
AAA=`;


describe('engine', () => {
  describe('#Engine', () => {
    let engine, wt;

    beforeEach(() => {
      // Disable all discovery mechanisms (private mode).
      wt = new WebTorrent({ dht: false, tracker: false, lsd: false});
      engine = new Engine({ wt: wt });
    });

    afterEach(() => {
      wt.destroy();
    });

    it('can load an application', (done) => {
      engine
        .serve(atob(APP))
        .then((server) => {
          // Ensure a torrent and bugout instance were created.
          assert(server.torrent);
          assert(server.bugout);

          // Ensure fields are present.
          assert.deepStrictEqual(server.app.fields, FIELDS);

          // Ensure we can read the index file.
          assert(server.app.readFile(server.app.fields.index));

          // Ensure server is stored in engine.
          assert.deepStrictEqual(Object.keys(engine.entries), [server.id]);

          // Ensure wt is serving the torrent.
          assert.strictEqual(wt.torrents[0], server.torrent);

          // Ensure stats are present.
          engine
            .stats()
            .then((stats) => {
              assert.deepStrictEqual(stats[server.id], server.stats);
              done();
            })
            .catch(done);
        })
        .catch(done);
    });

    describe('#PrefixedLocalStorage', () => {
      let storageA, storageB;

      beforeEach(() => {
        storageA = new PrefixedLocalStorage('a');
        storageB = new PrefixedLocalStorage('b');
      });

      afterEach(() => {
        storageA.clear();
        storageB.clear();
      });

      it('can set item', () => {
        storageA.setItem('test', 'foo');
        storageB.setItem('test', 'bar')

        // Ensure storage objects can read keys.
        assert.strictEqual(storageA.getItem('test'), 'foo');
        assert.strictEqual(storageB.getItem('test'), 'bar');

        // Ensure keys have proper prefixes.
        assert.strictEqual(localStorage.getItem('a:test'), 'foo');
        assert.strictEqual(localStorage.getItem('b:test'), 'bar');
      });

      it('can be cleared', () => {
        storageA.setItem('test', 'foo');
        storageB.setItem('test', 'bar')

        storageA.clear();

        // Ensure storageA is cleared, but not storageB.
        assert.isNull(storageA.getItem('test'));
        assert.strictEqual(storageB.getItem('test'), 'bar');
      });

      it('can remove item', () => {
        storageA.setItem('test', 'foo');
        storageB.setItem('test', 'bar')

        storageB.removeItem('test');

        // Ensure storageB is cleared, but not storageA.
        assert.strictEqual(storageA.getItem('test'), 'foo');
        assert.isNull(storageB.getItem('test'));
      });

      it('handles key() properly', () => {
        storageA.setItem('test', 'foo');
        storageA.setItem('quux', 'bar');
        localStorage.setItem('test', 'baz');

        // Order is not guarenteed.
        assert.deepStrictEqual(
          [storageA.key(0), storageA.key(1)].sort(),
          ['quux', 'test']
        );
        assert.isUndefined(storageA.key(2));
      });
    });
  });
});