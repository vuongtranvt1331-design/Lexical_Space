    /* ================= INDEXEDDB STORAGE MANAGER ================= */
    const DB_NAME = "LexicalSpaceDB";
    const DB_VERSION = 1;
    let idbConn = null;

    function openIndexedDB() {
      return new Promise((resolve, reject) => {
        if (idbConn) return resolve(idbConn);
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
          const database = event.target.result;
          if (!database.objectStoreNames.contains("words")) {
            database.createObjectStore("words", { keyPath: "id" });
          }
          if (!database.objectStoreNames.contains("metadata")) {
            database.createObjectStore("metadata", { keyPath: "key" });
          }
          if (!database.objectStoreNames.contains("pendingOps")) {
            database.createObjectStore("pendingOps", { keyPath: "id" });
          }
        };
        request.onsuccess = (event) => {
          idbConn = event.target.result;
          resolve(idbConn);
        };
        request.onerror = (event) => {
          reject(event.target.error);
        };
      });
    }

    async function idbGet(storeName, key) {
      const conn = await openIndexedDB();
      return new Promise((resolve, reject) => {
        const tx = conn.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value || req.result : null);
        req.onerror = () => reject(req.error);
      });
    }

    async function idbPut(storeName, value) {
      const conn = await openIndexedDB();
      return new Promise((resolve, reject) => {
        const tx = conn.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.put(value);
        let result;
        req.onsuccess = () => { result = req.result; };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error || req.error);
        tx.onabort = () => reject(tx.error || new Error('IndexedDB write aborted'));
      });
    }

    async function idbDelete(storeName, key) {
      const conn = await openIndexedDB();
      return new Promise((resolve, reject) => {
        const tx = conn.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || req.error);
        tx.onabort = () => reject(tx.error || new Error('IndexedDB deletion aborted'));
      });
    }

    async function idbGetAll(storeName) {
      const conn = await openIndexedDB();
      return new Promise((resolve, reject) => {
        const tx = conn.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }


export { DB_NAME, DB_VERSION, openIndexedDB, idbGet, idbPut, idbDelete, idbGetAll };
