import { canSyncProfile } from './context.js';
import { normalizeRemoteVocabulary, withoutLegacyLevel, compareVersions, newId } from './vocabulary.js';
export const DB_NAME = 'LexicalSpaceDB', DB_VERSION = 3;
let connection, upgradeBlocked = false;
const blockedListeners = new Set();
const owned = value => typeof value === 'string' && value.trim() !== '';
const wordKey = (username, id) => [username, id];

function createWordStore(db) {
  const words = db.createObjectStore('words', { keyPath: ['username', 'id'] });
  words.createIndex('username', 'username');
  words.createIndex('usernameDue', ['username', 'dueDate']);
  words.createIndex('id', 'id'); // Resolves owners of pre-v2 outbox entries.
  return words;
}

export function openIndexedDB({ onBlocked } = {}) {
  if (connection) {
    if (typeof onBlocked === 'function') {
      if (upgradeBlocked) onBlocked();
      else blockedListeners.add(onBlocked);
      void connection.then(() => blockedListeners.delete(onBlocked), () => blockedListeners.delete(onBlocked));
    }
    return connection;
  }
  if (typeof onBlocked === 'function') blockedListeners.add(onBlocked);
  const attempt = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result, tx = request.transaction;
      const oldWords = db.objectStoreNames.contains('words') ? tx.objectStore('words') : null;
      if (oldWords) oldWords.name = 'unassignedWords';
      const words = createWordStore(db);
      if (oldWords) {
        const request = oldWords.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          const record = cursor.value;
          // Keep rows without a known owner out of every account's vocabulary.
          if (owned(record.username) && owned(record.id)) {
            words.put({ ...record, username: record.username.trim() });
            cursor.delete();
          }
          cursor.continue();
        };
      }
      const meta = db.objectStoreNames.contains('metadata') ? tx.objectStore('metadata') : db.createObjectStore('metadata', { keyPath: 'key' });
      const ops = db.objectStoreNames.contains('pendingOps') ? tx.objectStore('pendingOps') : db.createObjectStore('pendingOps', { keyPath: 'id' });
      if (!ops.indexNames.contains('sequence')) ops.createIndex('sequence', 'sequence', { unique: true });
      if (!ops.indexNames.contains('usernameSequence')) ops.createIndex('usernameSequence', ['username', 'sequence']);
      const savedSequence = meta.get('_outbox_sequence');
      const newestOp = ops.index('sequence').openKeyCursor(null, 'prev');
      newestOp.onsuccess = () => {
        const sequence = newestOp.result?.key;
        if (Number.isSafeInteger(sequence) && sequence > (savedSequence.result?.value || 0)) {
          meta.put({ key: '_outbox_sequence', value: sequence });
        }
      };
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => { if (connection === attempt) connection = null; };
      db.onversionchange = () => { db.close(); if (connection === attempt) connection = null; };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      upgradeBlocked = true;
      for (const notify of blockedListeners) notify();
    };
  });
  connection = attempt;
  const clearBlockedState = () => { upgradeBlocked = false; blockedListeners.clear(); };
  // Reset on synchronous exceptions from indexedDB.open as well as request errors.
  void attempt.then(clearBlockedState, () => {
    clearBlockedState();
    if (connection === attempt) connection = null;
  });
  return attempt;
}
function completed(tx, result) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(typeof result === 'function' ? result() : result);
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('Storage transaction aborted.'));
  });
}
export async function idbGet(store, key) {
  const db = await openIndexedDB(), tx = db.transaction(store), req = tx.objectStore(store).get(key);
  return completed(tx, () => req.result == null ? null : (Object.prototype.hasOwnProperty.call(req.result, 'value') ? req.result.value : req.result));
}
export async function idbGetAll(store) {
  const db = await openIndexedDB(), tx = db.transaction(store), req = tx.objectStore(store).getAll();
  return completed(tx, () => req.result || []);
}
export async function idbPut(store, value) {
  const db = await openIndexedDB(), tx = db.transaction(store, 'readwrite'), req = tx.objectStore(store).put(value);
  return completed(tx, () => req.result);
}
export async function idbDelete(store, key) {
  const db = await openIndexedDB(), tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); return completed(tx);
}
export async function readUserWords(username, { includeDeleted = false } = {}) {
  if (!owned(username)) return [];
  const db = await openIndexedDB(), tx = db.transaction('words'), req = tx.objectStore('words').index('username').getAll(username);
  return completed(tx, () => req.result.map(w => normalizeRemoteVocabulary(w)).filter(w => includeDeleted || !w.deleted));
}
export async function readUserWord(username, id) {
  if (!owned(username) || !owned(id)) return null;
  const record = await idbGet('words', wordKey(username, id));
  return record && withoutLegacyLevel(record);
}
function validateWordMutations(changes, metadataRecords) {
  if (changes.some(change => !owned(change.username) || change.username !== change.username.trim() || !owned(change.id) || change.id !== change.id.trim())) {
    throw new Error('Word mutations require a username and word ID.');
  }
  const owners = new Set(changes.map(change => change.username));
  if (owners.size && metadataRecords.some(record => record.username && (owners.size !== 1 || !owners.has(record.username)))) {
    throw new Error('Practice progress and vocabulary must belong to the same profile.');
  }
  for (const record of metadataRecords) {
    const attempt = record.recallAttempt;
    if (attempt?.kind == null) continue;
    if (!['new', 'review'].includes(attempt.kind) || !owned(attempt.wordId) ||
        (attempt.limit != null && (!Number.isSafeInteger(attempt.limit) || attempt.limit < 0))) {
      throw new Error('Invalid daily practice attempt.');
    }
    if (!owned(record.username) || typeof record.key !== 'string') throw new Error('Daily practice requires a profile and date.');
    const prefix = `practice:v2:${encodeURIComponent(record.username)}:`;
    if (!record.key.startsWith(prefix) || !/^\d{4}-\d{2}-\d{2}$/.test(record.key.slice(prefix.length)) ||
        !changes.some(change => change.username === record.username && change.id === attempt.wordId && change.type !== 'DELETE')) {
      throw new Error('Daily practice must match the vocabulary change and profile.');
    }
  }
}
function updateRecallLedger(ledger, attempt) {
  const { wordId, kind, retry, limit, success } = attempt;
  if (kind != null) {
    if (!Array.isArray(ledger.dailyNewIds)) ledger.dailyNewIds = [];
    if (!Array.isArray(ledger.dailyReviewIds)) ledger.dailyReviewIds = [];
    const alreadyCounted = ledger.dailyNewIds.includes(wordId) || ledger.dailyReviewIds.includes(wordId);
    if (!retry && !alreadyCounted) {
      const ids = kind === 'new' ? ledger.dailyNewIds : ledger.dailyReviewIds;
      if (limit != null && ids.length >= limit) {
        const error = new Error(`Today's ${kind === 'new' ? 'new word' : 'review'} limit has been reached.`);
        error.code = 'daily-limit';
        throw error;
      }
      ids.push(wordId);
    }
  }
  ledger.completedAttempts = (Number(ledger.completedAttempts) || 0) + 1;
  if (!Array.isArray(ledger.successfulIds)) ledger.successfulIds = [];
  if (success && !ledger.successfulIds.includes(wordId)) ledger.successfulIds.push(wordId);
}
function queueMetadataMutations(meta, metadataRecords, afterCommit, fail) {
  const records = metadataRecords.values();
  // Each read sees any earlier write to the same ledger in this transaction.
  const writeNext = () => {
    for (const record of records) {
      const session = record.schemaVersion === 2 && record.sessionId;
      if (!session && !record.recallAttempt) { meta.put(record); continue; }
      const req = meta.get(record.key);
      req.onsuccess = () => {
        try {
          const previous = req.result;
          if (previous?.username && previous.username !== record.username) {
            throw new Error('Practice progress belongs to a different profile.');
          }
          if (session) {
            if ((previous?.sessionVersion || 0) !== (record.sessionVersion || 0)) {
              throw new Error('This session changed in another tab. Reload this card.');
            }
            const sessionVersion = (record.sessionVersion || 0) + 1;
            meta.put({ ...record, sessionVersion });
            afterCommit.push(() => { record.sessionVersion = sessionVersion; });
          } else {
            const ledger = previous || { key: record.key };
            if (record.username) ledger.username = record.username;
            updateRecallLedger(ledger, record.recallAttempt);
            meta.put(ledger);
          }
          writeNext();
        } catch (error) { fail(error); }
      };
      return;
    }
  };
  writeNext();
}
function queueWordMutations(tx, changes, metadataRecords, results, afterCommit, fail) {
  validateWordMutations(changes, metadataRecords);
  const words = tx.objectStore('words'), outbox = tx.objectStore('pendingOps'), meta = tx.objectStore('metadata');
  const sequenceReq = meta.get('_outbox_sequence');
  sequenceReq.onsuccess = () => {
    let sequence = sequenceReq.result?.value || 0, remaining = changes.length;
    const finish = () => {
      meta.put({ key: '_outbox_sequence', value: sequence });
      queueMetadataMutations(meta, metadataRecords, afterCommit, fail);
    };
    if (!remaining) { finish(); return; }
    for (const change of changes) {
      const req = words.get(wordKey(change.username, change.id));
      req.onsuccess = () => {
        try {
          const previous = req.result || {};
          if (change.expectedVersion && (
            !req.result || (change.expectedVersion.username && change.expectedVersion.username !== change.username) ||
            compareVersions(previous, change.expectedVersion) !== 0
          )) throw new Error('This word changed in another tab. Reload this card before grading.');
          const now = Math.max(Date.now(), Number(previous.updatedAt || 0) + 1);
          const record = normalizeRemoteVocabulary({ ...previous, ...change.patch, id: change.id, username: change.username,
            deleted: change.type === 'DELETE', revision: Number(previous.revision || 0) + 1, updatedAt: now, mutationId: newId() });
          words.put(record);
          if (canSyncProfile(record.username)) {
            outbox.put({ id: `op_${String(++sequence).padStart(16, '0')}_${newId()}`, sequence, wordId: record.id, username: record.username,
              type: record.deleted ? 'DELETE' : 'UPSERT', record, createdAt: now });
          }
          results.push(record); if (--remaining === 0) finish();
        } catch (error) { fail(error); }
      };
    }
  };
}
async function runWordMutation(prepare) {
  const db = await openIndexedDB();
  const tx = db.transaction(['words', 'pendingOps', 'metadata'], 'readwrite');
  const results = [], afterCommit = [];
  let failure, result = results;
  const fail = error => { failure = error; tx.abort(); };
  const finished = completed(tx);
  const write = (changes, metadataRecords, response = results) => {
    result = response;
    if (changes.length || metadataRecords.length) queueWordMutations(tx, changes, metadataRecords, results, afterCommit, fail);
  };
  try { prepare(tx, write, fail); } catch (error) { fail(error); }
  try { await finished; } catch (error) { throw failure || error; }
  for (const update of afterCommit) update();
  return result;
}
// Local record, FIFO outbox and any session advancement commit or abort together.
export function mutateWords(changes, metadataRecords = []) {
  return runWordMutation((_tx, write) => write(changes, metadataRecords));
}
// Plan the merge after acquiring the write transaction so another tab cannot
// change the recipient's library or write the import marker between read and commit.
export function mergeUserVocabulary(username, markerKey, plan) {
  return runWordMutation((tx, write, fail) => {
    const words = tx.objectStore('words').index('username').getAll(username);
    const marker = tx.objectStore('metadata').get(markerKey);
    marker.onsuccess = () => {
      try {
        const { changes, marker: nextMarker, result } = plan(words.result, marker.result);
        const records = nextMarker ? [{ ...nextMarker, key: markerKey, username }] : [];
        write(changes.map(change => ({ ...change, username })), records, result);
      } catch (error) { fail(error); }
    };
  });
}
export async function pendingOperations(username) {
  if (!owned(username)) return [];
  const db = await openIndexedDB(), tx = db.transaction('pendingOps');
  const req = tx.objectStore('pendingOps').index('usernameSequence').getAll(outboxRange(username));
  return completed(tx, () => req.result);
}
const outboxRange = username => IDBKeyRange.bound([username, 0], [username, Number.MAX_SAFE_INTEGER]);
export async function nextPendingOperation(username) {
  if (!owned(username)) return null;
  const db = await openIndexedDB(), tx = db.transaction('pendingOps');
  const req = tx.objectStore('pendingOps').index('usernameSequence').openCursor(outboxRange(username));
  return completed(tx, () => req.result?.value || null);
}
export async function applyRemoteWord(input, username = input.username) {
  const record = normalizeRemoteVocabulary(input);
  if (!owned(username) || !canSyncProfile(username) || record.username !== username || !owned(record.id)) return false;
  const db = await openIndexedDB();
  const tx = db.transaction('words', 'readwrite'), store = tx.objectStore('words'), req = store.get(wordKey(username, record.id)); let changed = false;
  req.onsuccess = () => {
    if (!req.result || compareVersions(record, req.result) > 0 ||
      (compareVersions(record, req.result) === 0 && JSON.stringify(record) !== JSON.stringify(normalizeRemoteVocabulary(req.result)))) {
      store.put(record); changed = true;
    }
  };
  return completed(tx, () => changed);
}
export async function acknowledgeOperation(op, remoteRecord) {
  if (remoteRecord && (remoteRecord.username !== op.username || remoteRecord.id !== op.wordId)) {
    throw new Error('Remote acknowledgement does not match the queued word.');
  }
  const db = await openIndexedDB(), tx = db.transaction(['words', 'pendingOps'], 'readwrite');
  const words = tx.objectStore('words'), req = words.get(wordKey(op.username, op.wordId)); let changed = false;
  req.onsuccess = () => {
    if (remoteRecord && (!req.result || compareVersions(remoteRecord, req.result) > 0)) { words.put(normalizeRemoteVocabulary(remoteRecord)); changed = true; }
    tx.objectStore('pendingOps').delete(op.id);
  };
  return completed(tx, () => changed);
}
export async function updateMetadata(keys, update) {
  const db = await openIndexedDB(), tx = db.transaction('metadata', 'readwrite'), store = tx.objectStore('metadata');
  const values = {}; let remaining = keys.length, result, failure;
  for (const key of keys) {
    const req = store.get(key);
    req.onsuccess = () => {
      values[key] = req.result || null;
      if (--remaining === 0) {
        try { const change = update(values); change.records.forEach(r => store.put(r)); result = change.result; }
        catch (error) { failure = error; tx.abort(); }
      }
    };
  }
  try { return await completed(tx, () => result); } catch (error) { throw failure || error; }
}
export async function migrateLegacyOutbox() {
  const db = await openIndexedDB(), tx = db.transaction(['words', 'pendingOps', 'metadata'], 'readwrite');
  const words = tx.objectStore('words'), ops = tx.objectStore('pendingOps'), meta = tx.objectStore('metadata');
  const seq = meta.get('_outbox_sequence'), all = ops.getAll();
  all.onsuccess = () => {
    let sequence = all.result.reduce((max, op) => Math.max(max, Number(op.sequence) || 0), seq.result?.value || 0);
    const legacy = all.result.filter(op => !Number.isSafeInteger(op.sequence));
    legacy.sort((a, b) => (a.createdAt || Number(a.id.match(/\d{13}/)?.[0]) || 0) - (b.createdAt || Number(b.id.match(/\d{13}/)?.[0]) || 0) || a.id.localeCompare(b.id));
    for (const op of legacy) {
      if (!owned(op.data?.id)) { console.warn('Unrecognized legacy operation retained:', op.id); continue; }
      const owners = new Set([op.username, op.data.username].filter(owned).map(owner => owner.trim()));
      if (owners.size > 1) { console.warn('Legacy operation has conflicting owners; retained:', op.id); continue; }
      const [owner] = owners;
      const req = owner ? words.get(wordKey(owner, op.data.id)) : words.index('id').getAll(op.data.id);
      req.onsuccess = () => {
        const existing = owner ? req.result : req.result.length === 1 ? req.result[0] : null;
        const input = existing || (owner && ['ADD', 'DELETE'].includes(op.type) ? { ...op.data, username: owner } : null);
        if (!input) { console.warn('Legacy operation needs a unique owner; retained:', op.id); return; }
        const record = normalizeRemoteVocabulary({ ...input, deleted: input.deleted || op.type === 'DELETE' });
        ops.put({ id: op.id, sequence: ++sequence, wordId: record.id, username: record.username, type: record.deleted ? 'DELETE' : 'UPSERT', record, legacy: true });
        words.put(record); meta.put({ key: '_outbox_sequence', value: sequence });
      };
    }
  };
  return completed(tx);
}
