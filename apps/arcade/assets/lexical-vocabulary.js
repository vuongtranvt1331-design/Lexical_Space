(function () {
  const clean = value => typeof value === 'string' ? value.trim() : '';

  function activeProfile() {
    const queryProfile = clean(new URLSearchParams(window.location.search).get('user'));
    if (queryProfile) return queryProfile;

    try {
      const tabProfile = window.sessionStorage.getItem('ls_active_profile');
      if (tabProfile !== null) return clean(tabProfile);
    } catch { /* Browser storage can be unavailable. */ }

    try {
      for (const key of ['vocab_user', 'username', 'lexicalSpace_username', 'currentUser']) {
        const value = clean(window.localStorage.getItem(key));
        if (!value) continue;
        if (!value.startsWith('{')) return value;
        try {
          const profile = clean(JSON.parse(value)?.username);
          if (profile) return profile;
        } catch { /* Ignore invalid legacy session data. */ }
      }
    } catch { /* Browser storage can be unavailable. */ }
    return '';
  }

  function topicsOf(record) {
    const additional = Array.isArray(record.topics) ? record.topics : [];
    return [...new Set([record.topic, ...additional].map(clean).filter(Boolean))];
  }

  function readWords(username, { includeLegacyUnassigned = false } = {}) {
    const profile = clean(username);
    return new Promise(resolve => {
      let finished = false;
      let db;
      const finish = result => {
        db?.close();
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        resolve(result);
      };
      const timeout = setTimeout(() => finish(null), 1200);

      try {
        // LexicalSpace owns migrations. A game only reads an existing version.
        const request = window.indexedDB.open('LexicalSpaceDB');
        request.onupgradeneeded = () => request.transaction.abort();
        request.onerror = request.onblocked = () => finish(null);
        request.onsuccess = () => {
          db = request.result;
          if (finished || !db.objectStoreNames.contains('words')) { finish(null); return; }
          db.onversionchange = () => db.close();
          try {
            const tx = db.transaction('words', 'readonly');
            const store = tx.objectStore('words');
            const scoped = Array.isArray(store.keyPath);
            if (scoped && !profile) { finish([]); return; }
            const read = scoped && store.indexNames.contains('username')
              ? store.index('username').getAll(profile) : store.getAll();
            tx.onabort = tx.onerror = () => finish(null);
            tx.oncomplete = () => finish(read.result.filter(word => {
              if (!word || !clean(word.word) || word.deleted) return false;
              const owner = clean(word.username);
              if (scoped) return owner === profile;
              return !profile || (includeLegacyUnassigned && !owner) || owner.toLowerCase() === profile.toLowerCase();
            }));
          } catch { finish(null); }
        };
      } catch { finish(null); }
    });
  }

  window.lexicalVocabulary = { activeProfile, readWords, topicsOf };
})();
