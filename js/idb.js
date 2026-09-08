/* Key-value minúsculo sobre IndexedDB. Serve página E service worker
   (o SW não enxerga localStorage). window.p90idb / self.p90idb. */
(function (glob) {
  var DB = 'p90', STORE = 'kv', _open;

  function open() {
    if (_open) return _open;
    _open = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return _open;
  }

  function run(mode, op) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, mode);
        var r = op(t.objectStore(STORE));
        t.oncomplete = function () { resolve(r && 'result' in r ? r.result : undefined); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }

  glob.p90idb = {
    get: function (k) { return run('readonly', function (s) { return s.get(k); }); },
    set: function (k, v) { return run('readwrite', function (s) { return s.put(v, k); }); },
    del: function (k) { return run('readwrite', function (s) { return s.delete(k); }); },
  };
})(typeof self !== 'undefined' ? self : window);
