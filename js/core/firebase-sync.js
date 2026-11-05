import { canSyncProfile } from './context.js';
import { normalizeRemoteVocabulary, withoutLegacyLevel, compareVersions } from './vocabulary.js';
import { nextPendingOperation, readUserWord, acknowledgeOperation, applyRemoteWord } from './idb-manager.js';
import { getStudentKey, getLegacyStudentKey } from '../utils/helpers.js';
const flights = new Map();

export const studentStatsId = username => `userWordStats_v3:${getStudentKey(username)}`;
export async function readStudentStats(db, username, get = ref => ref.get()) {
  const collection = db.collection('metadata');
  const ref = collection.doc(studentStatsId(username));
  const snapshot = await get(ref);
  if (snapshot.exists) {
    const data = snapshot.data();
    if (data.username !== username) throw new Error('Student metadata ownership mismatch.');
    return { ref, data };
  }
  // A lossy legacy key may belong to a different username. Only migrate an exact owner.
  const legacy = await get(collection.doc(`userWordStats_${getLegacyStudentKey(username)}`));
  const data = legacy.exists ? legacy.data() : null;
  return { ref, data: data?.username === username ? data : {} };
}

// All writes use Firestore transactions: a remote winner is never replaced by an older revision.
export function flushMutationOutbox({ db, username, onStatus = () => {}, onChange = () => {} }) {
  if (!db || !canSyncProfile(username) || !navigator.onLine) return Promise.resolve();
  if (flights.has(username)) return flights.get(username);
  const flight = (async () => {
    let changed = false;
    try {
      for (;;) {
        const op = await nextPendingOperation(username);
        if (!navigator.onLine) break;
        if (!op) {
          if (changed) { await onChange(username); changed = false; continue; }
          break;
        }
        if (op.username !== username || op.record?.username !== username || op.record.id !== op.wordId) {
          throw new Error('Queued word ownership mismatch.');
        }
        const local = await readUserWord(username, op.wordId);
        // Discard superseded snapshots in FIFO order rather than sending stale state.
        if (local && compareVersions(local, op.record) > 0) { await acknowledgeOperation(op); continue; }
        const ref = db.collection('words').doc(op.wordId);
        const winner = await db.runTransaction(async tx => {
          const snapshot = await tx.get(ref);
          const remote = snapshot.exists ? normalizeRemoteVocabulary(snapshot.data(), snapshot.id || op.wordId) : null;
          if (remote && remote.username !== username) throw new Error('Remote word ownership mismatch.');
          if (remote && (op.legacy || compareVersions(remote, op.record) >= 0)) return remote;
          const { ref: metaRef, data: stats } = await readStudentStats(db, username, doc => tx.get(doc));
          const countDelta = Number(!op.record.deleted) - Number(!!remote && !remote.deleted);
          const nextStats = { username, wordCount: Math.max(0, (Number(stats.wordCount) || 0) + countDelta) };
          if (stats.activityLogTimestamp != null) nextStats.activityLogTimestamp = stats.activityLogTimestamp;
          // A tombstone carries a revision, preventing delayed writes from resurrecting it.
          const outgoing = withoutLegacyLevel(op.record);
          tx.set(ref, outgoing);
          tx.set(metaRef, nextStats, { merge: true });
          return outgoing;
        });
        changed = (await acknowledgeOperation(op, winner)) || changed;
      }
      onStatus(true, 'Synced');
    } catch (error) {
      onStatus(false, 'Saved locally · sync pending');
      throw error; // Keep this operation and all later operations queued.
    } finally {
      if (changed) await onChange(username);
    }
  })().finally(() => flights.delete(username));
  flights.set(username, flight);
  return flight;
}
export function createVocabularySync({ db, onChange, onStatus }) {
  let unsubscribe, generation = 0, activeUser = '';
  function stop() { generation++; unsubscribe?.(); unsubscribe = null; activeUser = ''; }
  function start(username) {
    if (!db || !canSyncProfile(username)) { stop(); return; }
    if (unsubscribe && activeUser === username) return;
    stop(); activeUser = username;
    let queue = Promise.resolve();
    const ticket = generation;
    const current = () => ticket === generation && activeUser === username;
    unsubscribe = db.collection('words').where('username', '==', username).onSnapshot({ includeMetadataChanges: true }, snapshot => {
      queue = queue.then(async () => {
        if (!current()) return;
        let changed = false;
        for (const change of snapshot.docChanges()) {
          if (!current()) return;
          // Physical removal has no revision. Updated clients delete using tombstones.
          // Never infer a destructive local mutation from a non-authoritative cache view.
          if (change.type === 'removed' || change.doc.metadata?.hasPendingWrites) continue;
          changed = (await applyRemoteWord(normalizeRemoteVocabulary(change.doc.data(), change.doc.id), username)) || changed;
        }
        if (current() && changed) await onChange(username);
        if (current()) onStatus(!snapshot.metadata.fromCache, snapshot.metadata.fromCache ? 'Offline cache' : 'Connected');
      }).catch(error => { if (current()) { console.warn('Vocabulary reconciliation failed:', error); onStatus(false, 'Sync error'); } });
    }, error => { if (current()) { console.warn('Vocabulary listener failed:', error); onStatus(false, 'Sync error'); } });
  }
  return { start, stop };
}
