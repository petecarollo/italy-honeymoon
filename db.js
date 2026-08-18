// db.js — IndexedDB storage layer
// Replaces localStorage for all trip data.
// IndexedDB: persistent, large capacity, never auto-cleared by browser.

const TripDB = (() => {

  const DB_NAME    = 'pete-elise-italy';
  const DB_VERSION = 1;
  const STORES     = ['stays', 'transport', 'restaurants', 'excursions', 'costs-manual', 'itinerary'];

  let _db = null;

  // ── Open / init DB ────────────────────────────────────────────
  function open() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);

      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = e => {
        const db = e.target.result;
        STORES.forEach(name => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'id', autoIncrement: true });
          }
        });
      };

      req.onsuccess = e => {
        _db = e.target.result;
        resolve(_db);
      };

      req.onerror = e => reject(e.target.error);
    });
  }

  // ── Get all records from a store ─────────────────────────────
  async function getAll(storeName) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req   = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = e  => reject(e.target.error);
    });
  }

  // ── Add one record ────────────────────────────────────────────
  async function add(storeName, record) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      // Remove id so autoIncrement works
      const { id, ...data } = record;
      const req = store.add(data);
      req.onsuccess = () => resolve(req.result);  // returns new id
      req.onerror   = e  => reject(e.target.error);
    });
  }

  // ── Delete one record by id ───────────────────────────────────
  async function remove(storeName, id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req   = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = e  => reject(e.target.error);
    });
  }

  // ── Replace all records in a store (used for itinerary text) ─
  async function replaceAll(storeName, records) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      records.forEach(r => {
        const { id, ...data } = r;
        store.add(data);
      });
      tx.oncomplete = () => resolve();
      tx.onerror    = e  => reject(e.target.error);
    });
  }

  // ── Update one record by id (put) ────────────────────────────
  async function update(storeName, record) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req   = store.put(record);   // put requires keyPath (id) to be present
      req.onsuccess = () => resolve();
      req.onerror   = e  => reject(e.target.error);
    });
  }

  // ── Get single record by id ───────────────────────────────────
  async function getById(storeName, id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req   = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = e  => reject(e.target.error);
    });
  }
  async function clearStore(storeName) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req   = store.clear();
      req.onsuccess = () => resolve();
      req.onerror   = e  => reject(e.target.error);
    });
  }

  return { open, getAll, getById, add, update, remove, replaceAll, clearStore };
})();
