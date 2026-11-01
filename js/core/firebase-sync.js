// Observe one student's vocabulary and apply only changes to the local cache.
export function createVocabularySync({ db, readWords, readPending, readServerIds, saveServerIds, putWord, deleteWord, onChange, onStatus }) {
  let unsubscribe = null;
  let generation = 0;
  let activeUser = '';
  let queue = Promise.resolve();

  function stop() {
    generation++;
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    activeUser = '';
  }

  function start(username) {
    if (!db || !username) { stop(); return; }
    if (unsubscribe && activeUser === username) return;
    stop();
    activeUser = username;
    const ticket = generation;
    let reconciledServerSnapshot = false;
    let firstSnapshot = true;
    const isCurrent = () => ticket === generation && activeUser === username;
    const normalize = (record, id) => {
      const word = { ...record, id };
      for (const field of ['hasBeenStudied','studiedAt','lastReviewedAt','createdAt','studyCount','reviewCount','lastStudied','reviewedAt']) delete word[field];
      word.isFavorite = Boolean(word.isFavorite);
      word.memoryStatus = ['known','mastered'].includes(word.memoryStatus) ? 'mastered' : 'not_remembered';
      return word;
    };
    const canonical = value => JSON.stringify(value, (key, item) => item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item);

    unsubscribe = db.collection('words').where('username', '==', username).onSnapshot({ includeMetadataChanges: true }, snapshot => {
      queue = queue.then(async () => {
        if (!isCurrent()) return;
        const [records, operations, previousServerIds] = await Promise.all([
          readWords(), readPending(), readServerIds ? readServerIds(username) : []
        ]);
        if (!isCurrent()) return;
        const pending = new Set(operations.map(op => op?.data?.id).filter(Boolean));
        const existing = new Map(records.map(record => [record.id, record]));
        let changed = false;
        // Initial snapshot can be from cache. Compare the full first view with IndexedDB;
        // subsequent snapshots contain only changed documents.
        const changes = firstSnapshot ? snapshot.docs.map(doc => ({ type: 'added', doc })) : snapshot.docChanges();
        firstSnapshot = false;
        for (const change of changes) {
          if (!isCurrent()) return;
          const id = change.doc.id;
          if (pending.has(id)) continue;
          if (change.type === 'removed') {
            const local = existing.get(id);
            if (local && String(local.username || '').toLowerCase() === username.toLowerCase()) {
              await deleteWord(id); existing.delete(id); changed = true;
            }
          } else {
            const remote = normalize(change.doc.data(), id);
            const previous = existing.get(id);
            if (!previous || canonical(previous) !== canonical(remote)) {
              await putWord(remote); existing.set(id, remote); changed = true;
            }
          }
        }
        // A cache snapshot is not authoritative. Remove stale remote-backed words only
        // after the first server snapshot; retain local-only and queued changes.
        if (!snapshot.metadata.fromCache && !reconciledServerSnapshot) {
          const remoteIds = new Set(snapshot.docs.map(doc => doc.id));
          const knownServerIds = new Set(previousServerIds || []);
          for (const local of records) {
            if (!isCurrent()) return;
            if (String(local.username || '').toLowerCase() !== username.toLowerCase() ||
                !knownServerIds.has(local.id) || remoteIds.has(local.id) || pending.has(local.id)) continue;
            await deleteWord(local.id); changed = true;
          }
          reconciledServerSnapshot = true;
        }
        if (!isCurrent()) return;
        if (!snapshot.metadata.fromCache && saveServerIds) await saveServerIds(username, snapshot.docs.map(doc => doc.id));
        if (!isCurrent()) return;
        if (changed) await onChange(username);
        onStatus(true, snapshot.metadata.fromCache ? 'Offline cache' : 'Connected');
      }).catch(error => { if (isCurrent()) { console.warn('Vocabulary listener update failed:', error); onStatus(false, 'Sync Error'); } });
    }, error => {
      if (isCurrent()) { console.warn('Vocabulary listener failed:', error); onStatus(false, 'Sync Error'); }
    });
  }
  return { start, stop };
}
