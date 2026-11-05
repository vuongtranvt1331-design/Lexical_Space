import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { indexedDB, IDBKeyRange } = require('fake-indexeddb'); Object.assign(globalThis, { indexedDB, IDBKeyRange });
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
const storage = await import('../js/core/idb-manager.js');
const { normalizeRemoteVocabulary: normalize, compareVersions, validateVocabulary, parseVocabularyImport } = await import('../js/core/vocabulary.js');
const { scheduleReview, selectPracticeWords, addCalendarDays, calendarDay } = await import('../js/core/srs.js');
const { flushMutationOutbox } = await import('../js/core/firebase-sync.js');
const { createPronunciationController } = await import('../js/core/pronunciation.js');
async function clear() {
  const db = await storage.openIndexedDB();
  await new Promise((resolve, reject) => { const tx = db.transaction(['words', 'metadata', 'pendingOps'], 'readwrite'); for (const name of tx.objectStoreNames) tx.objectStore(name).clear(); tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); });
}
const patch = { word: 'resilient', meaning: 'kiên cường', topic: 'Test', lastReviewedAt: 100, interval: 6, repetition: 2, easeFactor: 2.5, due: 1234 };
function cloud(initial = {}) {
  const records = new Map(Object.entries(initial)), writes = [], state = { fail: false, beforeCommit: null };
  const db = { collection: collection => ({ doc: id => ({ path: `${collection}/${id}`, id }) }), runTransaction: async callback => {
    if (state.fail) throw new Error('network failure');
    const staged = [];
    const result = await callback({ get: async ref => ({ id: ref.id, exists: records.has(ref.path), data: () => structuredClone(records.get(ref.path)) }),
      set: (ref, value, options) => staged.push({ ref, value: structuredClone(value), options }) });
    if (state.beforeCommit) { const action = state.beforeCommit; state.beforeCommit = null; await action(); }
    for (const change of staged) { records.set(change.ref.path, change.options?.merge ? { ...records.get(change.ref.path), ...change.value } : change.value); writes.push(change.ref.path); }
    return result;
  } };
  return { db, records, writes, state };
}
test('mutations and outbox are atomic, monotonically versioned and FIFO across concurrent callers', async () => {
  await clear();
  const [a] = await storage.mutateWords([{ id: 'a', username: 'User', patch }]);
  await Promise.all([storage.mutateWords([{ id: 'a', username: 'User', patch: { meaning: 'new' } }]), storage.mutateWords([{ id: 'b', username: 'User', patch }])]);
  const local = await storage.readUserWord('User', 'a'), ops = await storage.pendingOperations('User');
  assert.equal(local.revision, 2); assert.ok(local.updatedAt > a.updatedAt); assert.deepEqual(ops.map(o => o.sequence), [1, 2, 3]);
  assert.equal(local.lastReviewedAt, 100); assert.equal(local.interval, 6); assert.equal(local.due, 1234);
  await assert.rejects(storage.mutateWords([{ id: 'a', username: 'Other', expectedVersion: local, patch: {} }], [{ key: 'should-not-exist', value: true }]));
  assert.equal(await storage.idbGet('metadata', 'should-not-exist'), null); assert.equal((await storage.pendingOperations('User')).length, 3);
  await assert.rejects(storage.mutateWords([{ id: 'a', username: 'User', expectedVersion: a, patch: { meaning: 'stale' } }]));
  assert.equal((await storage.readUserWord('User', 'a')).meaning, 'new');
});
test('failed cloud writes stay queued; FIFO replay skips superseded state and retains learning metadata', async () => {
  await clear(); const server = cloud();
  await storage.mutateWords([{ id: 'a', username: 'User', patch }]);
  server.state.fail = true;
  await assert.rejects(flushMutationOutbox({ db: server.db, username: 'User' }));
  assert.equal((await storage.pendingOperations('User')).length, 1);
  await storage.mutateWords([{ id: 'b', username: 'User', patch }, { id: 'a', username: 'User', patch: { meaning: 'latest', repetition: 3 } }]);
  server.state.fail = false; await flushMutationOutbox({ db: server.db, username: 'User' });
  assert.deepEqual(server.writes.filter(p => p.startsWith('words/')), ['words/b', 'words/a']);
  assert.equal(server.records.get('words/a').meaning, 'latest'); assert.equal(server.records.get('words/a').lastReviewedAt, 100);
  assert.equal((await storage.pendingOperations('User')).length, 0);
});
test('a newer remote revision wins; stale snapshots cannot overwrite newer local records', async () => {
  await clear(); const [local] = await storage.mutateWords([{ id: 'a', username: 'User', patch }]);
  const newer = { ...local, revision: 9, updatedAt: local.updatedAt + 100, meaning: 'remote winner' };
  const server = cloud({ 'words/a': newer }); await flushMutationOutbox({ db: server.db, username: 'User' });
  assert.equal((await storage.readUserWord('User', 'a')).meaning, 'remote winner'); assert.equal(server.writes.length, 0);
  assert.equal(await storage.applyRemoteWord(local), false);
  const [latest] = await storage.mutateWords([{ id: 'a', username: 'User', patch: { meaning: 'new local' } }]);
  assert.equal(latest.revision, 10); assert.ok(compareVersions(latest, newer) > 0);
});
test('an acknowledgement cannot overwrite a mutation made while the cloud transaction was in flight', async () => {
  await clear(); await storage.mutateWords([{ id: 'a', username: 'User', patch }]); const server = cloud();
  server.state.beforeCommit = () => storage.mutateWords([{ id: 'a', username: 'User', patch: { meaning: 'changed during push' } }]);
  await flushMutationOutbox({ db: server.db, username: 'User' });
  assert.equal(server.records.get('words/a').meaning, 'changed during push'); assert.equal((await storage.readUserWord('User', 'a')).revision, 2);
});
test('delete tombstones prevent stale offline resurrection and remain hidden from user reads', async () => {
  await clear(); const [old] = await storage.mutateWords([{ id: 'a', username: 'User', patch }]);
  await storage.mutateWords([{ id: 'a', username: 'User', type: 'DELETE' }]); const server = cloud();
  await flushMutationOutbox({ db: server.db, username: 'User' });
  assert.equal(server.records.get('words/a').deleted, true); assert.equal((await storage.readUserWords('User')).length, 0);
  assert.equal(await storage.applyRemoteWord(old), false);
});
test('review and session advancement roll back together on a stale grade', async () => {
  await clear(); const [first] = await storage.mutateWords([{ id: 'a', username: 'User', patch }]);
  await storage.mutateWords([{ id: 'a', username: 'User', patch: { meaning: 'edited' } }]);
  await assert.rejects(storage.mutateWords([{ id: 'a', username: 'User', patch: scheduleReview(first, 2), expectedVersion: first }], [{ key: 'session', queueIndex: 1 }]));
  assert.equal(await storage.idbGet('metadata', 'session'), null); assert.equal((await storage.readUserWord('User', 'a')).reviewCount, 0);
});
test('cross-tab session conflicts abort the word and outbox; daily attempt increments merge atomically', async () => {
  await clear(); const [word] = await storage.mutateWords([{ id: 'a', username: 'User', patch }]);
  await storage.idbPut('metadata', { key: 'session', schemaVersion: 2, sessionId: 'one', sessionVersion: 2, queueIndex: 1 });
  const before = (await storage.pendingOperations('User')).length;
  await assert.rejects(storage.mutateWords([{ id: 'a', username: 'User', expectedVersion: word, patch: { reviewCount: 1 } }],
    [{ key: 'session', schemaVersion: 2, sessionId: 'one', sessionVersion: 1, queueIndex: 0 }]));
  assert.equal((await storage.pendingOperations('User')).length, before); assert.equal((await storage.readUserWord('User', 'a')).reviewCount, 0);
  await Promise.all(['a', 'b'].map(id => storage.mutateWords([], [{ key: 'daily', recallAttempt: { wordId: id, success: true } }])));
  const ledger = await storage.idbGet('metadata', 'daily'); assert.equal(ledger.completedAttempts, 2); assert.deepEqual(ledger.successfulIds, ['a', 'b']);
});
test('legacy queue migration preserves learning metadata and keeps the sequence above existing operations', async () => {
  await clear(); await storage.idbPut('words', { id: 'legacy', username: 'User', ...patch });
  await storage.idbPut('pendingOps', { id: 'upd_legacy_1700000000000', type: 'UPDATE', data: { id: 'legacy', updates: { memoryStatus: 'mastered' } } });
  await storage.idbPut('pendingOps', { id: 'existing', sequence: 50, wordId: 'other', username: 'User', record: normalize({ id: 'other', username: 'User' }) });
  await storage.migrateLegacyOutbox();
  const ops = await storage.pendingOperations('User'); assert.deepEqual(ops.map(op => op.sequence), [50, 51]);
  assert.equal(ops[1].record.interval, 6); assert.equal(ops[1].record.lastReviewedAt, 100); assert.equal(ops[1].record.due, 1234);
  await storage.mutateWords([{ id: 'next', username: 'User', patch }]); assert.equal((await storage.pendingOperations('User')).at(-1).sequence, 52);
});
test('legacy levels are omitted from local reads, edits and queued cloud writes without changing review history', async () => {
  await clear();
  const old = { ...normalize({ ...patch, id: 'legacy', username: 'User', revision: 1, reviewCount: 4 }), cefr: 'B2' };
  await storage.idbPut('words', old);
  await storage.idbPut('pendingOps', { id: 'legacy-sequenced', sequence: 1, wordId: old.id, username: old.username, record: old });
  assert.equal(Object.hasOwn(await storage.readUserWord('User', old.id), 'cefr'), false);
  assert.equal(Object.hasOwn((await storage.readUserWords('User'))[0], 'cefr'), false);

  const server = cloud();
  await flushMutationOutbox({ db: server.db, username: 'User' });
  const sent = server.records.get('words/legacy');
  assert.deepEqual(sent, normalize(old));
  assert.equal((await storage.idbGet('words', ['User', old.id])).cefr, 'B2');

  const [edited] = await storage.mutateWords([{ id: old.id, username: 'User', patch: { sense: 'a changed sense', cefr: 'A1' } }]);
  assert.equal(Object.hasOwn(edited, 'cefr'), false);
  assert.equal(Object.hasOwn((await storage.pendingOperations('User'))[0].record, 'cefr'), false);
  for (const key of ['lastReviewedAt', 'interval', 'repetition', 'easeFactor', 'dueDate', 'reviewCount']) assert.equal(edited[key], old[key]);
});
test('SRS requires scheduled successes on three distinct days and Again resets graduation', () => {
  const firstDay = new Date(2026, 10, 6, 10).getTime(); let word = normalize({ id: 'x', word: 'word', meaning: 'meaning' });
  word = scheduleReview(word, 2, firstDay); assert.equal(word.repetition, 1); assert.equal(word.interval, 1);
  word = scheduleReview(word, 3, firstDay + 1000); assert.equal(word.repetition, 1); assert.equal(word.successfulDays.length, 1);
  word = scheduleReview(word, 2, Date.parse(addCalendarDays(firstDay, 1))); assert.equal(word.repetition, 2); assert.equal(word.memoryStatus, 'not_remembered');
  word = scheduleReview(word, 2, Date.parse(word.dueDate)); assert.equal(word.repetition, 3); assert.equal(word.memoryStatus, 'mastered');
  const failed = scheduleReview(word, 0, Date.parse(word.dueDate)); assert.equal(failed.repetition, 0); assert.equal(failed.memoryStatus, 'not_remembered');
  assert.equal(Date.parse(failed.dueDate) - failed.lastReviewedAt, 600000); assert.ok(failed.easeFactor >= 1.3);
});
test('practice queues the full eligible backlog and prioritizes oldest due reviews', () => {
  const now = 5000;
  const words = Array.from({ length: 1000 }, (_, i) => normalize({ id: String(i).padStart(4, '0'), word: 'word', meaning: 'meaning', reviewCount: i < 900 ? 1 : 0, dueDate: new Date(i).toISOString() }));
  words.push(normalize({ id: 'future', word: 'future', reviewCount: 1, dueDate: new Date(now + 1).toISOString() }));
  const chosen = selectPracticeWords(words, { now });
  assert.equal(chosen.review.length, 900); assert.equal(chosen.fresh.length, 100); assert.equal(chosen.review[0].id, '0000');
  const reviewOnly = selectPracticeWords(words, { mode: 'review', now });
  assert.equal(reviewOnly.review.length, 900); assert.equal(reviewOnly.fresh.length, 0);
});
test('content validation and both import formats retain sense-specific fields without levels', () => {
  const value = { ...patch, pos: 'adj', sense: 'able to recover', collocations: ['highly resilient', 'resilient economy'], exampleSentence: 'The economy is resilient.' };
  assert.equal(validateVocabulary(value, { requireContext: true }).valid, true);
  assert.equal(validateVocabulary({ ...value, collocations: ['one'] }).valid, true);
  assert.equal(validateVocabulary({ ...value, collocations: ['one'] }, { requireContext: true }).valid, false);
  assert.equal(validateVocabulary({ ...value, collocations: ['one', 'two', 'three', 'four'] }).valid, false);
  assert.equal(validateVocabulary(null).valid, false);
  const json = parseVocabularyImport(JSON.stringify([{ ...value, cefr: 'B9' }]));
  assert.equal(json.errors.length, 0);
  assert.deepEqual(json.entries[0].collocations, value.collocations);
  assert.equal(Object.hasOwn(json.entries[0], 'cefr'), false);
  const pipe = parseVocabularyImport('Topic: Test\nresilient | kiên cường | robust | adj | able to recover | highly resilient; resilient economy | The economy is resilient.');
  const legacyPipe = parseVocabularyImport('Topic: Test\nresilient | kiên cường | robust | adj | B2 | able to recover | highly resilient; resilient economy | The economy is resilient.');
  assert.equal(pipe.entries[0].sense, value.sense);
  assert.deepEqual(legacyPipe, pipe);
  assert.equal(parseVocabularyImport('bad\nword | meaning').errors.length, 1);
});
test('speech remains available without a recording player and cancellation drops older blocked utterances', async () => {
  const spoken = []; let cancels = 0;
  const speech = { cancel: () => cancels++, speak: u => spoken.push(u) }; class Utterance { constructor(text) { this.text = text; } }
  const controller = createPronunciationController({ speech, Utterance, AudioClass: null });
  const promise = controller.say('first'); assert.equal(spoken[0].text, 'first'); await promise;
  spoken[0].onerror({ error: 'not-allowed' }); await controller.say('second'); controller.unlock();
  assert.deepEqual(spoken.map(u => u.text), ['first', 'second']); assert.equal(cancels, 2);
});
test('dictionary lookup cancellation stops late recordings playing out of order', async () => {
  const requests = [], played = []; class Audio { pause() {} removeAttribute() {} load() {} async play() { played.push(this.src); } }
  const fetcher = (url, options) => new Promise(resolve => requests.push({ url, options, resolve }));
  const controller = createPronunciationController({ speech: null, Utterance: null, AudioClass: Audio, fetcher });
  const first = controller.say('first'), second = controller.say('second'); assert.equal(requests[0].options.signal.aborted, true);
  const response = url => ({ ok: true, json: async () => [{ phonetics: [{ audio: url }] }] });
  requests[1].resolve(response('https://audio.test/second')); await second; requests[0].resolve(response('https://audio.test/first')); await first;
  assert.deepEqual(played, ['https://audio.test/second']); controller.cancel();
});
test('pronunciation tries British dictionary, trusted Oxford, other dictionary, custom audio, then en-GB speech', async () => {
  const trace = [];
  class Audio {
    pause() {} removeAttribute() { this.src = ''; } load() {}
    async play() { trace.push(this.src); throw new DOMException('Unsupported audio', 'NotSupportedError'); }
  }
  class Utterance { constructor(text) { this.text = text; } }
  const controller = createPronunciationController({ AudioClass: Audio, Utterance,
    speech: { cancel() {}, speak: utterance => trace.push(`${utterance.lang}:${utterance.text}`) },
    fetcher: async url => {
      assert.equal(url, 'https://api.dictionaryapi.dev/api/v2/entries/en/hello');
      return { ok: true, json: async () => [
        { phonetics: [{ audio: 'https://audio.test/hello-us.mp3' }] },
        { phonetics: [{ audio: '//ssl.gstatic.com/hello--_gb_1.mp3' }] }
      ] };
    }
  });
  await controller.say({ word: 'Hello', dictionaryAudioUrl: 'https://bad-oxforddictionaries.com/untrusted.mp3',
    oxfordAudioUrl: 'https://www.oxfordlearnersdictionaries.com/hello.mp3', audioUrl: 'https://custom.test/hello.mp3' });
  assert.deepEqual(trace, ['https://ssl.gstatic.com/hello--_gb_1.mp3', 'https://www.oxfordlearnersdictionaries.com/hello.mp3',
    'https://audio.test/hello-us.mp3', 'https://custom.test/hello.mp3', 'en-GB:Hello']);
});
test('a blocked recording is retried from the same source on user activation without falling through', async () => {
  const trace = [];
  class Audio {
    pause() {} removeAttribute() { this.src = ''; } load() {}
    async play() {
      trace.push(this.src);
      if (trace.length === 1) throw new DOMException('Gesture required', 'NotAllowedError');
    }
  }
  const controller = createPronunciationController({ AudioClass: Audio,
    speech: { cancel() {}, speak: () => assert.fail('The recording can play after a gesture') }, Utterance: class {},
    fetcher: async () => ({ ok: true, json: async () => [{ phonetics: [{ audio: 'https://audio.test/hello-uk.mp3' }] }] })
  });
  const word = { word: 'hello', audioUrl: 'https://custom.test/hello.mp3' };
  await controller.say(word);
  assert.deepEqual(trace, ['https://audio.test/hello-uk.mp3']);
  await controller.unlock();
  assert.deepEqual(trace, ['https://audio.test/hello-uk.mp3', 'https://audio.test/hello-uk.mp3']);
});
test('a lookup that exceeds its deadline cannot prevent a card recording from playing', async () => {
  let signal;
  const played = [];
  class Audio {
    pause() {} removeAttribute() { this.src = ''; } load() {} async play() { played.push(this.src); }
  }
  const controller = createPronunciationController({ AudioClass: Audio, lookupTimeout: 20,
    fetcher: (_url, options) => { signal = options.signal; return new Promise(() => {}); }
  });
  await controller.say({ word: 'hello', customAudioUrl: 'https://custom.test/hello.mp3' });
  assert.equal(signal.aborted, true);
  assert.deepEqual(played, ['https://custom.test/hello.mp3']);
});
