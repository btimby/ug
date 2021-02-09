const WebTorrent = require('webtorrent');
const { Engine } = require('../../src/engine/index');
const { PrefixedLocalStorage } = require('../../src/engine/storage');
const { assert } = require('chai');

const FIELDS = {
  "name": "todo",
  "description": "Web Underground test application :: todo",
  "version": "1.0.0",
  "author": "Ben Timby <btimby@gmail.com>",
  "key": "2BuRr1F3bVpfjfATwN8sS7KSfmEDQrN8x9ryHa2QmPxLqAvioiQx3f77cxqvVBnZRTMymXpo2eLTFqT1uWBgBXQa",
  "files":[
    {
      "name": "index.html",
      "hash": "28RHnREYzSbzTdCxcPsXYHHTYp8AnU9aBrBTpbrTrahSNYaED5gpFcubiWqKfU7ibykSKk7hbVouWQrHuTtkFLGd"
    },
  ],
  "index": "index.html",
  "signature": "4RYooec68UmCaZovCwcquWt8RnxJ7NAvWgeo71t2UeFDCVBDk4w7XBsqqPm4VE4PZtjKCZoh46tsBTa74ota6sBC",
};
const APP = `UEsDBAoACAAAAAcWSVIAAAAAAAAAAAAAAAAIAAAAYXBwLmpzb257Im5hbWUiOiJ0b2RvIiwiZGVz
Y3JpcHRpb24iOiJXZWIgVW5kZXJncm91bmQgdGVzdCBhcHBsaWNhdGlvbiA6OiB0b2RvIiwidmVy
c2lvbiI6IjEuMC4wIiwiYXV0aG9yIjoiQmVuIFRpbWJ5IDxidGltYnlAZ21haWwuY29tPiIsImtl
eSI6IjJCdVJyMUYzYlZwZmpmQVR3TjhzUzdLU2ZtRURRck44eDlyeUhhMlFtUHhMcUF2aW9pUXgz
Zjc3Y3hxdlZCblpSVE15bVhwbzJlTFRGcVQxdVdCZ0JYUWEiLCJmaWxlcyI6W3sibmFtZSI6Imlu
ZGV4Lmh0bWwiLCJoYXNoIjoiMjhSSG5SRVl6U2J6VGRDeGNQc1hZSEhUWXA4QW5VOWFCckJUcGJy
VHJhaFNOWWFFRDVncEZjdWJpV3FLZlU3aWJ5a1NLazdoYlZvdVdRckh1VHRrRkxHZCJ9XSwiaW5k
ZXgiOiJpbmRleC5odG1sIiwic2lnbmF0dXJlIjoiNFJZb29lYzY4VW1DYVpvdkN3Y3F1V3Q4Um54
SjdOQXZXZ2VvNzF0MlVlRkRDVkJEazR3N1hCc3FxUG00VkU0UFp0aktDWm9oNDZ0c0JUYTc0b3Rh
NnNCQyJ9UEsHCA1xAo3hAQAA4QEAAFBLAwQKAAgAAAAHFklSAAAAAAAAAAAAAAAACgAAAGluZGV4
Lmh0bWw8IURPQ1RZUEUgaHRtbD4KPGh0bWw+CjxoZWFkPgogIDx0aXRsZT5XZWxjb21lIHRvIFZ1
ZTwvdGl0bGU+CiAgPHNjcmlwdCBzcmM9Imh0dHBzOi8vdW5wa2cuY29tL3Z1ZSI+PC9zY3JpcHQ+
CjwvaGVhZD4KPGJvZHk+CiAgPGRpdiBpZD0iYXBwIj4KICAgIDxpbWcgc3JjPSJodHRwczovL2V4
dGVybmFsLWNvbnRlbnQuZHVja2R1Y2tnby5jb20vaXUvP3U9aHR0cHMlM0ElMkYlMkZpLmltZ3Vy
LmNvbSUyRk92TVpCczkuanBnJmY9MSZub2ZiPTEiIGFsdD0iVE9ETyBsb2dvIj4KICAgIDxoMj57
eyBncmVldGluZyB9fTwvaDI+CiAgICA8aW5wdXQKICAgICAgdi1tb2RlbD0idG9kby50aXRsZSIK
ICAgICAgdHlwZT0idGV4dCIKICAgICAgbmFtZT0idGl0bGUiCiAgICAvPgogICAgPGJ1dHRvbiBA
Y2xpY2s9ImFkZFRvZG8iIHRpdGxlPSJBZGQgYSBuZXcgdG9kbyBpdGVtIj5BZGQ8L2J1dHRvbj4K
ICAgIDx1bD4KICAgICAgPGxpIHYtZm9yPSJ0b2RvIGluIHRvZG9zIiA6a2V5PSJ0b2RvLmlkIj4K
ICAgICAgICB7eyB0b2RvLnRpdGxlIH19CiAgICAgICAgPGJ1dHRvbiBAY2xpY2s9ImRlbFRvZG8o
dG9kby5pZCkiIHRpdGxlPSJEZWxldGUgdG9kbyBpdGVtLiI+RGVsPC9idXR0b24+CiAgICAgIDwv
bGk+CiAgICA8L3VsPgogIDwvZGl2PgoKICA8c2NyaXB0PgogICAgdmFyIGFwcCA9IG5ldyBWdWUo
ewogICAgICBlbDogJyNhcHAnLAoKICAgICAgZGF0YSgpIHsKICAgICAgICByZXR1cm4gewogICAg
ICAgICAgZ3JlZXRpbmc6ICdXZWxjb21lIHRvIHRoZSBXZWIgVW5kZXJncm91bmQhJywKICAgICAg
ICAgIHRvZG86IHsKICAgICAgICAgICAgdGl0bGU6IG51bGwsCiAgICAgICAgICB9LAogICAgICAg
ICAgdG9kb3M6IFtdLAogICAgICAgIH0KICAgICAgfSwKCiAgICAgIG1vdW50ZWQoKSB7CiAgICAg
ICAgd2luZG93LnVnLnBpbmcoKTsKICAgICAgICB0aGlzLmdldFRvZG9zKCk7CiAgICAgIH0sCgog
ICAgICB3YXRjaDogewogICAgICAgIHRvZG9zOiB7CiAgICAgICAgICBoYW5kbGVyKCkgewogICAg
ICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd0b2RvcycsIEpTT04uc3RyaW5naWZ5KHRo
aXMudG9kb3MpKTsKICAgICAgICAgICAgfSwKICAgICAgICAgIGRlZXA6IHRydWUsCiAgICAgICAg
fSwKICAgICAgfSwKCiAgICAgIG1ldGhvZHM6IHsKICAgICAgICBnZXRUb2RvcygpIHsKICAgICAg
ICAgIGNvbnN0IHRvZG9zID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgndG9kb3Mn
KSk7CiAgICAgICAgICB0aGlzLnRvZG9zID0gdG9kb3MgfHwgW107CiAgICAgICAgfSwKCiAgICAg
ICAgYWRkVG9kbygpIHsKICAgICAgICAgIHRoaXMudG9kb3MucHVzaCh7CiAgICAgICAgICAgIGlk
OiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCkuc3Vic3RyKDIsIDgpLAogICAgICAgICAgICB0aXRs
ZTogdGhpcy50b2RvLnRpdGxlLAogICAgICAgICAgfSk7CiAgICAgICAgICB0aGlzLnRvZG8gPSB7
CiAgICAgICAgICAgIHRpdGxlOiBudWxsLAogICAgICAgICAgfTsKICAgICAgICB9LAoKICAgICAg
ICBkZWxUb2RvKGlkKSB7CiAgICAgICAgICB0aGlzLnRvZG9zID0gdGhpcy50b2Rvcy5maWx0ZXIo
KG9iaikgPT4gKG9iai5pZCAhPT0gaWQpKTsKICAgICAgICB9LAogICAgICB9LAoKICAgIH0pCiAg
PC9zY3JpcHQ+CjwvYm9keT4KPC9odG1sPgpQSwcIOvtjUooGAACKBgAAUEsBAhQACgAIAAAABxZJ
Ug1xAo3hAQAA4QEAAAgAAAAAAAAAAAAAAAAAAAAAAGFwcC5qc29uUEsBAhQACgAIAAAABxZJUjr7
Y1KKBgAAigYAAAoAAAAAAAAAAAAAAAAAFwIAAGluZGV4Lmh0bWxQSwUGAAAAAAIAAgBuAAAA2QgA
AAAA`;


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