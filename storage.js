/* ============ Anchor — IndexedDB storage ============
   Plain indexedDB, no libraries. One object store per data type.
   Everything here stays on the device; nothing is ever sent anywhere. */
"use strict";

const AnchorStore = (() => {
  const DB_NAME = "anchor";
  const DB_VERSION = 1;
  const STORES = ["persons", "voice", "songs", "words", "techniques", "log", "meta"];

  let dbPromise = null;

  function available() {
    try { return typeof indexedDB !== "undefined" && !!indexedDB; } catch { return false; }
  }

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!available()) { reject(new Error("IndexedDB unavailable")); return; }
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (err) { reject(err); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        STORES.forEach((name) => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        });
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };
        db.onclose = () => { dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
      req.onblocked = () => reject(new Error("IndexedDB open blocked"));
    });
    dbPromise.catch(() => { dbPromise = null; });
    return dbPromise;
  }

  function wrap(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /* Run `fn(stores)` inside one transaction. `fn` must issue all its
     requests synchronously (no awaits) so the transaction stays alive. */
  function transact(storeNames, mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      let t;
      try { t = db.transaction(storeNames, mode); }
      catch (err) { reject(err); return; }
      const stores = {};
      storeNames.forEach((n) => { stores[n] = t.objectStore(n); });
      let result;
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error || new Error("transaction failed"));
      t.onabort = () => reject(t.error || new Error("transaction aborted"));
      try { result = fn(stores, t); }
      catch (err) { try { t.abort(); } catch {} reject(err); }
    }));
  }

  function get(store, key) {
    return transact([store], "readonly", (s) => {
      let out;
      s[store].get(key).onsuccess = (e) => { out = e.target.result; };
      return { get value() { return out; } };
    }).then((r) => r.value);
  }

  function set(store, key, value) {
    return transact([store], "readwrite", (s) => { s[store].put(value, key); });
  }

  function del(store, key) {
    return transact([store], "readwrite", (s) => { s[store].delete(key); });
  }

  function clear(store) {
    return transact([store], "readwrite", (s) => { s[store].clear(); });
  }

  /* All entries of one or more stores, in one transaction:
     { storeName: [{ key, value }, …] } */
  function readAll(storeNames) {
    const out = {};
    return transact(storeNames, "readonly", (s) => {
      storeNames.forEach((name) => {
        out[name] = [];
        s[name].openCursor().onsuccess = (e) => {
          const cur = e.target.result;
          if (cur) { out[name].push({ key: cur.key, value: cur.value }); cur.continue(); }
        };
      });
    }).then(() => out);
  }

  /* Batch of writes in ONE transaction — all or nothing.
     ops: [{ store, op: "put"|"delete"|"clear", key?, value? }] */
  function write(ops) {
    const names = [...new Set(ops.map((o) => o.store))];
    if (!names.length) return Promise.resolve();
    return transact(names, "readwrite", (s) => {
      ops.forEach((o) => {
        if (o.op === "put") s[o.store].put(o.value, o.key);
        else if (o.op === "delete") s[o.store].delete(o.key);
        else if (o.op === "clear") s[o.store].clear();
      });
    });
  }

  function wipe() {
    return transact(STORES, "readwrite", (s) => { STORES.forEach((n) => s[n].clear()); });
  }

  /* Ask the browser to keep this origin's data out of eviction.
     Resolves true/false, or null when the API is missing. Never throws. */
  async function requestPersist() {
    try {
      if (!navigator.storage || typeof navigator.storage.persist !== "function") return null;
      let granted = false;
      if (typeof navigator.storage.persisted === "function") {
        granted = await navigator.storage.persisted();
      }
      if (!granted) granted = await navigator.storage.persist();
      console.log(`[Anchor] storage persistence ${granted ? "granted" : "not granted"}`);
      return !!granted;
    } catch {
      return null;
    }
  }

  return { STORES, available, open, get, set, del, clear, readAll, write, wipe, requestPersist };
})();
