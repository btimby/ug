const WebTorrent = require('webtorrent');
const { Engine, PrefixedLocalStorage } = require('../../src/engine');
const { assert } = require('chai');

const FIELDS = {
  "name":"todo",
  "description":"Web Underground test application :: todo",
  "version":"1.0.0",
  "author":"Ben Timby <btimby@gmail.com>",
  "key":"-----BEGIN PUBLIC KEY-----\r\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3i0CHh" +
        "37ERt0S6OUVDW5\r\nivMOiYACEoO99jQ54vwb+rMx1MFjyg9AHKD6dq3XqJviv4J4u9v+SyraSNXMMH" +
        "KF\r\nPYtBa75MRz3s+J8v2C+00sCZPe3jDIW+eThJJI6DrzmE9iHS6LPkOegsOujQ9Qqw\r\nJkSqAt" +
        "zAVC0J0ox/2xGxjc47HYnd0AiAuCEelYWlO0Nmlq77qlJ4sfqLi+3J1WUh\r\nF3VjoTnz+LuCg5LZK/" +
        "0rxzUey9ys/fDS6urqGqS2fgoSGmaQ50JjCFETFLJYJSH8\r\nGR/FDJWyUWoBFjNirswx/zI5Xwu6aC" +
        "ZU9Bs5KzwPEYVwdw35KW5+HRA6Dvb8HLxv\r\nEwIDAQAB\r\n-----END PUBLIC KEY-----\r\n",
  "files":[
    {
      "name":"index.html",
      "hash":"2fecb986848f1d01dad4829fa60600bc11cc2b3465a02b46b73f7ab10df36775"
    },
  ],
  "index":"index.html",
  "signature":"a9162a5c9268cef56b169605c5d3cf57c02ec44d050fcb8f707b3e68730d797a3c43737250" +
              "5bcb07d234462d8661d3e1b077ab30c0656dfa4494bcd300017741b58a4a210403d8defd2e" + 
              "e8405cb97a182437d05b35706a0b50decb0ab8a13532823aadc51530d8534c83759fdbb1c8" +
              "fc67f6aea7195701a1a200c57a03aeb4a19c260332fc08fe8d44e1edfeda78a6656d780f81" +
              "5ecb60edaf8b05893e56c86aeec2809f41d04983561fc6f0161bf66cd43dcca0fc32e3b9bb" +
              "a8985c0d945852608276aa7bba2f5e49a2636e1aa0fd3d999e11c6c389a29826fe3560f5e7" +
              "a0eb37a1591bc751af56ef7fc296eba79f68a2758d53dc4b8ddb68a39a7f53f1e521",
};
const APP = "UEsDBAoACAAAAGSqLVIAAAAAAAAAAAAAAAAIAAAAYXBwLmpzb257Im5hbWUiOiJ0b2RvIiwiZGVz" +
            "Y3JpcHRpb24iOiJXZWIgVW5kZXJncm91bmQgdGVzdCBhcHBsaWNhdGlvbiA6OiB0b2RvIiwidmVy" +
            "c2lvbiI6IjEuMC4wIiwiYXV0aG9yIjoiQmVuIFRpbWJ5IDxidGltYnlAZ21haWwuY29tPiIsImtl" +
            "eSI6Ii0tLS0tQkVHSU4gUFVCTElDIEtFWS0tLS0tXHJcbk1JSUJJakFOQmdrcWhraUc5dzBCQVFF" +
            "RkFBT0NBUThBTUlJQkNnS0NBUUVBM2kwQ0hoMzdFUnQwUzZPVVZEVzVcclxuaXZNT2lZQUNFb085" +
            "OWpRNTR2d2Irck14MU1GanlnOUFIS0Q2ZHEzWHFKdml2NEo0dTl2K1N5cmFTTlhNTUhLRlxyXG5Q" +
            "WXRCYTc1TVJ6M3MrSjh2MkMrMDBzQ1pQZTNqRElXK2VUaEpKSTZEcnptRTlpSFM2TFBrT2Vnc091" +
            "alE5UXF3XHJcbkprU3FBdHpBVkMwSjBveC8yeEd4amM0N0hZbmQwQWlBdUNFZWxZV2xPME5tbHE3" +
            "N3FsSjRzZnFMaSszSjFXVWhcclxuRjNWam9UbnorTHVDZzVMWksvMHJ4elVleTl5cy9mRFM2dXJx" +
            "R3FTMmZnb1NHbWFRNTBKakNGRVRGTEpZSlNIOFxyXG5HUi9GREpXeVVXb0JGak5pcnN3eC96STVY" +
            "d3U2YUNaVTlCczVLendQRVlWd2R3MzVLVzUrSFJBNkR2YjhITHh2XHJcbkV3SURBUUFCXHJcbi0t" +
            "LS0tRU5EIFBVQkxJQyBLRVktLS0tLVxyXG4iLCJmaWxlcyI6W3sibmFtZSI6ImluZGV4Lmh0bWwi" +
            "LCJoYXNoIjoiMmZlY2I5ODY4NDhmMWQwMWRhZDQ4MjlmYTYwNjAwYmMxMWNjMmIzNDY1YTAyYjQ2" +
            "YjczZjdhYjEwZGYzNjc3NSJ9XSwiaW5kZXgiOiJpbmRleC5odG1sIiwic2lnbmF0dXJlIjoiYTkx" +
            "NjJhNWM5MjY4Y2VmNTZiMTY5NjA1YzVkM2NmNTdjMDJlYzQ0ZDA1MGZjYjhmNzA3YjNlNjg3MzBk" +
            "Nzk3YTNjNDM3MzcyNTA1YmNiMDdkMjM0NDYyZDg2NjFkM2UxYjA3N2FiMzBjMDY1NmRmYTQ0OTRi" +
            "Y2QzMDAwMTc3NDFiNThhNGEyMTA0MDNkOGRlZmQyZWU4NDA1Y2I5N2ExODI0MzdkMDViMzU3MDZh" +
            "MGI1MGRlY2IwYWI4YTEzNTMyODIzYWFkYzUxNTMwZDg1MzRjODM3NTlmZGJiMWM4ZmM2N2Y2YWVh" +
            "NzE5NTcwMWExYTIwMGM1N2EwM2FlYjRhMTljMjYwMzMyZmMwOGZlOGQ0NGUxZWRmZWRhNzhhNjY1" +
            "NmQ3ODBmODE1ZWNiNjBlZGFmOGIwNTg5M2U1NmM4NmFlZWMyODA5ZjQxZDA0OTgzNTYxZmM2ZjAx" +
            "NjFiZjY2Y2Q0M2RjY2EwZmMzMmUzYjliYmE4OTg1YzBkOTQ1ODUyNjA4Mjc2YWE3YmJhMmY1ZTQ5" +
            "YTI2MzZlMWFhMGZkM2Q5OTllMTFjNmMzODlhMjk4MjZmZTM1NjBmNWU3YTBlYjM3YTE1OTFiYzc1" +
            "MWFmNTZlZjdmYzI5NmViYTc5ZjY4YTI3NThkNTNkYzRiOGRkYjY4YTM5YTdmNTNmMWU1MjEifVBL" +
            "BwgtCBco9wQAAPcEAABQSwMECgAIAAAAZKotUgAAAAAAAAAAAAAAAAoAAABpbmRleC5odG1sPGh0" +
            "bWw+CiAgICA8Ym9keT4KICAgICAgICA8aDE+VUcgOjogdG9kbzwvaDE+CiAgICA8L2JvZHk+CiAg" +
            "ICA8c2NyaXB0PgogICAgICAgIC8vIFRoaXMgaXMganVzdCBhIHNtYWxsIHNuaXBwZXQgb2YgamF2" +
            "YXNjcmlwdC4KICAgICAgICBhbGVydCgnaGVsbG8nKTsKICAgIDwvc2NyaXB0Pgo8L2h0bWw+UEsH" +
            "CB0nPc+rAAAAqwAAAFBLAQIUAAoACAAAAGSqLVItCBco9wQAAPcEAAAIAAAAAAAAAAAAAAAAAAAA" +
            "AABhcHAuanNvblBLAQIUAAoACAAAAGSqLVIdJz3PqwAAAKsAAAAKAAAAAAAAAAAAAAAAAC0FAABp" +
            "bmRleC5odG1sUEsFBgAAAAACAAIAbgAAABAGAAAAAA==";


describe('engine.js', () => {
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
        .createServer(atob(APP))
        .then((server) => {
          // Ensure a torrent and bugout instance were created.
          assert(server.torrent);
          assert(server.bugout);

          // Ensure fields are present.
          assert.deepStrictEqual(server.app.fields, FIELDS);

          // Ensure we can read the index file.
          assert(server.app.readFile(server.app.fields.index));

          // Ensure server is stored in engine.
          assert.deepStrictEqual(Object.keys(engine.servers), [server.id]);

          // Ensure wt is serving the torrent.
          assert.strictEqual(wt.torrents[0], server.torrent);

          // Ensure stats are present.
          engine
            .stats()
            .then((stats) => {
              assert.deepStrictEqual(stats[server.id], server.stats);
              done();
            });
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
        assert.strictEqual(localStorage.getItem('a-test'), 'foo');
        assert.strictEqual(localStorage.getItem('b-test'), 'bar');
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
    });
  });
});