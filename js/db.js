// Lille IndexedDB-hjælper. Alt gemmes lokalt på enheden.
const DB_NAME = 'fiske-app';
const DB_VERSION = 4;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('trips')) db.createObjectStore('trips', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('drone')) db.createObjectStore('drone', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('fish')) db.createObjectStore('fish', { keyPath: 'id' }); // kendte fisk (genfangster)
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const getAll = (store) => run(store, 'readonly', (s) => s.getAll());
export const get = (store, id) => run(store, 'readonly', (s) => s.get(id));
export const put = (store, obj) => run(store, 'readwrite', (s) => s.put(obj));
export const remove = (store, id) => run(store, 'readwrite', (s) => s.delete(id));
