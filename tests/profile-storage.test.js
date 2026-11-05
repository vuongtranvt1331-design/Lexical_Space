import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
Object.assign(globalThis, { indexedDB, IDBKeyRange });

const storage = await import('../js/core/idb-manager.js');
const { createVocabularySync, readStudentStats, studentStatsId } = await import('../js/core/firebase-sync.js');
const { context } = await import('../js/core/context.js');
const activity = await import('../js/features/activity.js');
const { getStudentKey } = await import('../js/utils/helpers.js');

test('v2 upgrade keeps the exact owner, SRS, queue and outbox, and isolates identical word IDs', async () => {
  const username = 'A B';
  const word = {
    id: 'shared', username, word: 'resilient', meaning: 'kiên cường',
    revision: 4, interval: 6, repetition: 2, lastReviewedAt: 100, dueDate: '2026-11-06T00:00:00.000Z'
  };
  const session = { key: 'session:active:A%20B', mode: 'review', sessionKey: 'existing-session' };
  await new Promise((resolve, reject) => {
    const request = indexedDB.open(storage.DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      const words = db.createObjectStore('words', { keyPath: 'id' });
      words.put(word);
      words.put({ id: 'unassigned', word: 'preserved for recovery' });
      db.createObjectStore('metadata', { keyPath: 'key' }).put(session);
      db.createObjectStore('pendingOps', { keyPath: 'id' }).put({ id: 'op-one', username, sequence: 1, wordId: word.id, record: word });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { request.result.close(); resolve(); };
  });

  assert.deepEqual(await storage.readUserWord(username, word.id), word);
  assert.deepEqual(await storage.idbGet('metadata', session.key), session);
  assert.equal((await storage.pendingOperations(username))[0].id, 'op-one');
  assert.equal((await storage.readUserWords(username))[0].dueDate, word.dueDate);
  assert.ok(await storage.idbGet('unassignedWords', 'unassigned'));
  assert.equal(await storage.readUserWord(username, 'unassigned'), null);

  const other = 'A_B';
  await storage.mutateWords([{ username: other, id: word.id, patch: { word: 'adapt', meaning: 'thích nghi' } }]);
  assert.equal((await storage.readUserWord(other, word.id)).word, 'adapt');
  assert.equal((await storage.readUserWord(username, word.id)).revision, 4);
  assert.equal((await storage.pendingOperations(other)).length, 1);
  assert.equal((await storage.pendingOperations(username)).length, 1);

  await storage.idbPut('pendingOps', { id: 'legacy-delete', type: 'DELETE', data: { id: word.id } });
  await storage.migrateLegacyOutbox();
  assert.equal((await storage.idbGet('pendingOps', 'legacy-delete')).sequence, undefined);
  assert.equal((await storage.readUserWords(other)).length, 1);
  assert.equal((await storage.readUserWords(username)).length, 1);
});

test('a new cloud listener starts independently of an old profile and checks incoming ownership', async () => {
  const listeners = new Map(), touched = [];
  const db = { collection: () => ({ where: (_field, _op, user) => ({
    onSnapshot: (_options, read) => { listeners.set(user, read); return () => {}; }
  }) }) };
  const snapshot = (id, username) => ({
    metadata: { fromCache: false },
    docChanges: () => [{ type: 'added', doc: { id, data: () => ({ username, word: 'sample' }) } }]
  });
  let enteredA, resolveA, enteredB;
  const oldReached = new Promise(resolve => { enteredA = resolve; });
  const oldPending = new Promise(resolve => { resolveA = resolve; });
  const newReached = new Promise(resolve => { enteredB = resolve; });
  const sync = createVocabularySync({ db, onStatus: () => {}, onChange: async username => {
    touched.push(username);
    if (username === 'old') { enteredA(); await oldPending; }
    else enteredB();
  } });
  sync.start('old');
  listeners.get('old')(snapshot('first', 'old'));
  await oldReached;
  sync.start('new');
  listeners.get('old')(snapshot('late', 'old'));
  listeners.get('new')(snapshot('foreign', 'old'));
  listeners.get('new')(snapshot('first', 'new'));
  try {
    await newReached;
    assert.deepEqual(touched, ['old', 'new']);
    assert.equal(await storage.readUserWord('old', 'late'), null);
    assert.equal(await storage.readUserWord('old', 'foreign'), null);
    assert.equal((await storage.readUserWord('new', 'first')).username, 'new');
  } finally { resolveA(); sync.stop(); }
});

test('cloud stats only inherit legacy counts and activity from an exact username match', async () => {
  const records = new Map([['userWordStats_A_B', { username: 'A B', wordCount: 12, activityLogTimestamp: 100 }]]);
  const db = { collection: () => ({ doc: id => ({
    id, get: async () => ({ exists: records.has(id), data: () => records.get(id) })
  }) }) };
  const original = await readStudentStats(db, 'A B');
  const other = await readStudentStats(db, 'A_B');
  assert.notEqual(original.ref.id, other.ref.id);
  assert.equal(original.data.wordCount, 12);
  assert.deepEqual(other.data, {});
  records.set(studentStatsId('A_B'), { username: 'A_B', wordCount: 1 });
  assert.equal((await readStudentStats(db, 'A_B')).data.wordCount, 1);
});

test('activity reset and legacy recovery keep similarly named profiles separate', async () => {
  Object.assign(context, storage, { getStudentKey, logActivityDebug() {} });
  activity.resetActivityForUser();
  await storage.idbPut('metadata', { key: 'studentActivity_A_B', username: 'A B', activityLogTimestamp: 100, pendingSync: true });
  assert.equal(await activity.loadLocalActivityState('A_B'), null);
  const recovered = await activity.loadLocalActivityState('A B');
  assert.equal(recovered.activityLogTimestamp, 100);
  assert.equal(recovered.pendingSync, true);
  activity.resetActivityForUser();
  await activity.saveLocalActivityState({ username: 'A_B', studentKey: getStudentKey('A_B'), activityLogTimestamp: 200, pendingSync: true });
  assert.equal((await activity.loadLocalActivityState('A_B')).activityLogTimestamp, 200);
  assert.equal((await activity.loadLocalActivityState('A B')).activityLogTimestamp, 100);
  activity.resetActivityForUser();
});
