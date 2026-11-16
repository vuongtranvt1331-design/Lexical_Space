// Historical filename requested by the project layout. No Firebase SDK or remote reads.
// Shared Arcade Hub IndexedDB remains the only student vocabulary source.
    function getEffectiveUsernameStorageKey() {
      return LEXICALSPACE_CONFIG.usernameStorageKey || "username";
    }

    function detectStoredUsername() {
      try {
        const profile = sessionStorage.getItem("ls_active_profile");
        if (profile !== null) return profile.trim();
      } catch (_) {}

      // Check the primary LexicalSpace localStorage key and fallback keys
      const keysToCheck = [
        getEffectiveUsernameStorageKey(),
        ...LEXICALSPACE_CONFIG.fallbackUsernameKeys
      ];

      for (const key of keysToCheck) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const trimmed = raw.trim();
          if (!trimmed) continue;
          // Handle JSON object if LexicalSpace stored a user object
          if (trimmed.startsWith("{")) {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed.username === "string" && parsed.username.trim()) {
              return parsed.username.trim();
            }
          } else {
            return trimmed;
          }
        } catch (_) {}
      }
      return "";
    }

    function persistUsernameToStorage(username) {
      const key = getEffectiveUsernameStorageKey();
      try {
        localStorage.setItem(key, username);
      } catch (_) {}
    }


    function normalizeText(str) {
      return typeof str === "string" ? str.trim() : "";
    }

    function normalizeKey(str) {
      return normalizeText(str).toLowerCase();
    }

    function isEligibleMasteredWord(rawDoc, masteredOnly = true) {
      if (masteredOnly && rawDoc.memoryStatus !== "mastered") return null;

      // 1. Valid English word
      const word = normalizeText(rawDoc.word);
      if (!word) return null;

      // 2. Valid Vietnamese meaning hint
      const meaning = normalizeText(rawDoc.meaning || rawDoc.translation);
      if (!meaning) return null;

      // 3. Usable synonyms
      const syn1 = normalizeText(rawDoc.synonym1 || rawDoc.synonym);
      const syn2 = normalizeText(rawDoc.synonym2);
      const validSynonyms = [];

      if (syn1 && normalizeKey(syn1) !== normalizeKey(word)) {
        validSynonyms.push(syn1);
      }
      if (
        syn2 &&
        normalizeKey(syn2) !== normalizeKey(word) &&
        normalizeKey(syn2) !== normalizeKey(syn1)
      ) {
        validSynonyms.push(syn2);
      }

      if (Array.isArray(rawDoc.synonyms)) {
        for (const s of rawDoc.synonyms) {
          const sText = normalizeText(s);
          if (sText && normalizeKey(sText) !== normalizeKey(word) && !validSynonyms.some(v => normalizeKey(v) === normalizeKey(sText))) {
            validSynonyms.push(sText);
          }
        }
      }

      if (validSynonyms.length === 0) return null;

      return {
        word,
        meaning,
        synonyms: validSynonyms,
        memoryStatus: rawDoc.memoryStatus || "unknown",
        topics: [rawDoc.topic, ...(Array.isArray(rawDoc.topics) ? rawDoc.topics : [])].map(normalizeText).filter(Boolean)
      };
    }


    async function tryLoadFromIndexedDB(expectedUser, options = {}) {
      return new Promise((resolve) => {
        try {
          if (!window.indexedDB) return resolve({ words: [], masteredCount: 0, allUsers: [] });
          const req = indexedDB.open(LEXICALSPACE_CONFIG.dbName);
          req.onupgradeneeded = () => req.transaction.abort();
          req.onerror = () => resolve({ words: [], masteredCount: 0, allUsers: [] });
          req.onsuccess = (e) => {
            const db = e.target.result;
            db.onversionchange = () => db.close();
            if (!db.objectStoreNames.contains(LEXICALSPACE_CONFIG.wordsStore)) { db.close(); return resolve({ words: [], masteredCount: 0, allUsers: [] }); }
            const tx = db.transaction(LEXICALSPACE_CONFIG.wordsStore, "readonly");
            tx.oncomplete = () => db.close();
            tx.onabort = () => { db.close(); resolve({ words: [], masteredCount: 0, allUsers: [] }); };
            const store = tx.objectStore(LEXICALSPACE_CONFIG.wordsStore);
            const getReq = store.getAll();
            getReq.onerror = () => resolve({ words: [], masteredCount: 0, allUsers: [] });
            getReq.onsuccess = () => {
              const all = getReq.result || [];
              // LexicalSpace v3 keys profiles by exact username. Older libraries matched case-insensitively.
              const exactProfile = db.version >= 3;
              const normalizeOwner = exactProfile ? normalizeText : normalizeKey;
              const owner = normalizeOwner(expectedUser);
              const matchedMastered = [];
              let masteredCount = 0;
              const userSet = new Set();

              for (const item of all) {
                if (!item || item.deleted === true) continue;
                const username = normalizeText(item.username);
                if (username) userSet.add(username);
                if (!owner || normalizeOwner(username) !== owner) continue;
                const validated = isEligibleMasteredWord(item, options.masteredOnly !== false);
                if (validated) {
                  matchedMastered.push(validated);
                  if (item.memoryStatus === "mastered") masteredCount++;
                }
              }

              resolve({
                words: matchedMastered,
                masteredCount,
                allUsers: Array.from(userSet)
              });
            };
          };
        } catch (_) {
          resolve({ words: [], masteredCount: 0, allUsers: [] });
        }
      });
    }


    async function discoverLocalUsers() {
      const res = await tryLoadFromIndexedDB("");
      return res.allUsers || [];
    }
