import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { indexedDB, IDBKeyRange } = require('fake-indexeddb'); Object.assign(globalThis, { indexedDB, IDBKeyRange });
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
const storage = await import('../js/core/idb-manager.js');
const { normalizeRemoteVocabulary: normalize, compareVersions, validateVocabulary, parseVocabularyImport } = await import('../js/core/vocabulary.js');
const { scheduleReview, selectPracticeWords, addCalendarDays, calendarDay, isNewWord, isDue } = await import('../js/core/srs.js');
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
test('SRS intervals still graduate on scheduled calendar days and Again resets graduation', () => {
  const firstDay = new Date(2026, 10, 6, 10).getTime(); let word = normalize({ id: 'x', word: 'word', meaning: 'meaning' });
  word = scheduleReview(word, 2, firstDay); assert.equal(word.repetition, 1); assert.equal(word.interval, 1);
  word = scheduleReview(word, 1, firstDay + 1000); assert.equal(word.repetition, 1); assert.equal(word.successfulDays.length, 1);
  word = scheduleReview(word, 2, Date.parse(addCalendarDays(firstDay, 1))); assert.equal(word.repetition, 2); assert.equal(word.memoryStatus, 'not_remembered');
  word = scheduleReview(word, 2, Date.parse(word.dueDate)); assert.equal(word.repetition, 3); assert.equal(word.memoryStatus, 'mastered');
  const failed = scheduleReview(word, 0, Date.parse(word.dueDate)); assert.equal(failed.repetition, 0); assert.equal(failed.memoryStatus, 'not_remembered');
  assert.equal(Date.parse(failed.dueDate) - failed.lastReviewedAt, 600000); assert.ok(failed.easeFactor >= 1.3);
});
test('manual mastery persists through reviews and sync without changing scheduled history', async () => {
  await clear();
  const history = { repetition: 3, interval: 6, easeFactor: 2.4, reviewCount: 3, lapses: 1,
    successfulDays: ['2026-11-01', '2026-11-02', '2026-11-03'],
    lastReviewedAt: Date.parse('2026-11-03T12:00:00Z'), dueDate: '2026-11-09T12:00:00.000Z' };
  const [earned] = await storage.mutateWords([{ id: 'manual', username: 'User', patch: { ...patch, ...history, due: null } }]);
  assert.equal(earned.memoryStatus, 'mastered');
  const server = cloud();
  let updated = earned;
  for (const status of ['not_remembered', 'mastered']) {
    [updated] = await storage.mutateWords([{ id: earned.id, username: 'User', expectedVersion: updated, patch: { masteryOverride: status } }]);
    const stored = await storage.readUserWord('User', earned.id);
    assert.equal(stored.memoryStatus, status);
    assert.equal(stored.masteryOverride, status);
    assert.deepEqual(Object.fromEntries(Object.keys(history).map(key => [key, stored[key]])), history);
    await flushMutationOutbox({ db: server.db, username: 'User' });
    assert.equal(server.records.get('words/manual').masteryOverride, status);
    const review = scheduleReview(stored, status === 'mastered' ? 1 : 2, Date.parse(history.dueDate));
    assert.equal(review.memoryStatus, status);
    assert.notEqual(review.repetition, stored.repetition);
  }
  const legacy = normalize({ ...patch, id: 'legacy', memoryStatus: 'known', masteryOverride: 'unsupported' });
  assert.equal(Object.hasOwn(legacy, 'masteryOverride'), false);
  assert.equal(legacy.selfReportedKnown, true);
  assert.equal(legacy.memoryStatus, 'not_remembered');
  const marked = normalize({ ...patch, id: 'new', masteryOverride: 'mastered' });
  assert.equal(normalize(marked).selfReportedKnown, false);
  assert.equal(normalize(marked).memoryStatus, 'mastered');
});
test('Easy or three Good grades promote a card and Again clears both mastery and the Good count', async () => {
  await clear();
  const now = new Date(2026, 10, 6, 10).getTime();
  const username = 'User', id = 'good';
  let [word] = await storage.mutateWords([{ id, username, patch: {
    word: 'resilient', meaning: 'kiên cường', reviewCount: 8, lastGrade: 2, repetition: 1, interval: 1,
    lastReviewedAt: now, dueDate: addCalendarDays(now, 1), successfulDays: [calendarDay(now)], masteryOverride: 'not_remembered'
  } }]);
  assert.equal(word.goodReviewCount, 1);
  assert.equal(word.memoryStatus, 'not_remembered');
  const saveReview = async grade => {
    await storage.mutateWords([{ id, username, expectedVersion: word, patch: scheduleReview(word, grade, now) }]);
    word = await storage.readUserWord(username, id);
  };
  await saveReview(2);
  assert.equal(word.goodReviewCount, 2);
  assert.equal(word.memoryStatus, 'not_remembered');
  await saveReview(1);
  assert.equal(word.goodReviewCount, 2);
  assert.equal(word.masteryOverride, 'not_remembered');
  await saveReview(2);
  assert.equal(word.goodReviewCount, 3);
  assert.equal(word.memoryStatus, 'mastered');
  assert.equal(word.recallLevel, 4);
  assert.equal(word.lastGrade, 2);
  assert.equal(word.masteredReviewPending, true);
  assert.equal(word.repetition, 1);
  assert.equal(Object.hasOwn(word, 'masteryOverride'), false);
  const server = cloud();
  await flushMutationOutbox({ db: server.db, username });
  assert.equal(server.records.get('words/good').goodReviewCount, 3);
  assert.equal(server.records.get('words/good').autoMastered, true);
  assert.equal(server.records.get('words/good').recallLevel, 4);
  assert.equal(server.records.get('words/good').masteredReviewPending, true);

  [word] = await storage.mutateWords([{ id, username, expectedVersion: word, patch: { masteryOverride: 'mastered' } }]);
  await saveReview(0);
  assert.equal(word.memoryStatus, 'not_remembered');
  assert.equal(word.recallLevel, 3);
  assert.equal(word.lastGrade, 0);
  assert.equal(word.masteredReviewPending, false);
  assert.equal(word.goodReviewCount, 0);
  assert.equal(word.autoMastered, false);
  assert.equal(Object.hasOwn(word, 'masteryOverride'), false);
  await flushMutationOutbox({ db: server.db, username });
  assert.equal(server.records.get('words/good').goodReviewCount, 0);
  assert.equal(server.records.get('words/good').autoMastered, false);
  assert.equal(server.records.get('words/good').recallLevel, 3);
  assert.equal(server.records.get('words/good').masteredReviewPending, false);
  assert.equal(Object.hasOwn(server.records.get('words/good'), 'masteryOverride'), false);

  const easy = scheduleReview({ ...word, masteryOverride: 'not_remembered' }, 3, now);
  assert.equal(easy.memoryStatus, 'mastered');
  assert.equal(easy.recallLevel, 4);
  assert.equal(easy.masteryOverride, null);
  assert.equal(easy.goodReviewCount, 0);
  assert.equal(normalize({ ...patch, id: 'legacy-easy', lastGrade: 3 }).memoryStatus, 'mastered');
});
test('recall levels group every mastered word with Easy and return demoted words to level three', () => {
  const now = new Date(2026, 10, 6, 9).getTime();
  const manual = normalize({ id: 'manual', word: 'known', meaning: 'đã thuộc', masteryOverride: 'mastered', dueDate: null });
  const learned = normalize({ ...patch, id: 'earned', lastGrade: 2, goodReviewCount: 3, dueDate: addCalendarDays(now, 1) });
  assert.deepEqual([manual.recallLevel, learned.recallLevel], [4, 4]);
  assert.equal(isNewWord(manual), false);
  assert.equal(manual.masteredReviewPending, true);
  assert.equal(isDue(manual, now), true);
  const mastered = [manual, learned];
  const empty = { review: [], fresh: [], limited: false };
  assert.deepEqual(selectPracticeWords(mastered, { now }), empty);
  assert.deepEqual(selectPracticeWords(mastered, { now, repeat: true, settings: { dailyReviewLimit: 0 } }), empty);
  assert.deepEqual(selectPracticeWords(mastered, { now, mode: 'review' }).review, mastered);
  const firstRealReview = scheduleReview(manual, 2, now);
  assert.equal(firstRealReview.lastGrade, 2);
  assert.equal(firstRealReview.recallLevel, 4);
  assert.equal(firstRealReview.masteredReviewPending, false);
  assert.equal(firstRealReview.dueDate, addCalendarDays(now, 1));
  const demoted = normalize({ ...manual, masteryOverride: 'not_remembered' });
  assert.equal(demoted.recallLevel, 3);
  assert.deepEqual(selectPracticeWords([demoted], { now }).review, [demoted]);
  const secondMiss = scheduleReview(scheduleReview(learned, 0, now), 0, now);
  assert.equal(secondMiss.recallLevel, 1);
});
test('a pending Mastered review is immediately available once and preserves the future schedule when recalled', () => {
  const now = new Date(2026, 10, 6, 9).getTime(), future = addCalendarDays(now, 2);
  const legacy = normalize({ ...patch, id: 'legacy-blue', lastGrade: 3, reviewCount: 2, dueDate: future });
  assert.equal(legacy.masteredReviewPending, true);
  assert.equal(isDue(legacy, now), true);
  assert.deepEqual(selectPracticeWords([legacy], { now, mode: 'review' }).review, [legacy]);
  assert.deepEqual(selectPracticeWords([{ ...legacy, isFavorite: true }], { now, mode: 'favorites', favorites: true }).review, []);
  const checked = normalize(scheduleReview(legacy, 2, now, { inDueReview: true }));
  assert.equal(checked.recallLevel, 4);
  assert.equal(checked.masteredReviewPending, false);
  assert.equal(checked.dueDate, future);
  assert.equal(checked.repetition, legacy.repetition);
  assert.equal(checked.interval, legacy.interval);
  assert.equal(checked.reviewCount, legacy.reviewCount + 1);
  assert.equal(checked.lastGrade, 2);
  assert.equal(isDue(checked, now), false);
  assert.equal(isDue(checked, Date.parse(future)), true);
  assert.deepEqual(selectPracticeWords([checked], { now, mode: 'review' }).review, []);

  const failed = scheduleReview(legacy, 0, now, { inDueReview: true });
  assert.equal(failed.recallLevel, 3);
  assert.equal(failed.masteredReviewPending, false);
  assert.equal(failed.dueDate, new Date(now + 10 * 60_000).toISOString());
});
test('a card promoted in Due Reviews satisfies its immediate review in the same attempt', () => {
  const now = new Date(2026, 10, 6, 9).getTime();
  const due = normalize({ ...patch, id: 'due', lastGrade: 1, dueDate: addCalendarDays(now, -1) });
  const promotion = scheduleReview(due, 3, now, { inDueReview: true });
  assert.equal(promotion.recallLevel, 4);
  assert.equal(promotion.masteredReviewPending, false);
  assert.deepEqual(selectPracticeWords([promotion], { now, mode: 'review' }).review, []);

  const dailyPromotion = scheduleReview(due, 3, now);
  assert.equal(dailyPromotion.masteredReviewPending, true);
  assert.equal(dailyPromotion.dueDate, promotion.dueDate);
  assert.deepEqual(selectPracticeWords([dailyPromotion], { now, mode: 'review' }).review, [dailyPromotion]);
  assert.deepEqual(selectPracticeWords([dailyPromotion], { now, repeat: true }).review, []);
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
test('Daily practice gives Hard and Good review priority and budgets early reviews separately from new words', () => {
  const now = new Date(2026, 10, 6, 9).getTime();
  const card = (id, lastGrade, days, extra = {}) => normalize({
    ...patch, id, lastGrade, reviewCount: 1, lastReviewedAt: now - 60_000, dueDate: addCalendarDays(now, days), ...extra
  });
  const words = [
    card('easy-due', 3, -10), card('easy-future', 3, 3, { masteredReviewPending: false }),
    card('again-due', 0, -9), card('good-due', 2, -8), card('good-future', 2, 1),
    card('hard-due', 1, -2), card('hard-new-today', 1, 2), card('hard-future', '1', 4), card('already-reviewed', 2, 3),
    card('retry', 1, 5), card('fresh', null, 0, { reviewCount: 0, lastReviewedAt: null })
  ];
  const ledger = { dailyNewIds: ['hard-new-today'], dailyReviewIds: ['already-reviewed'] };
  const ids = words => words.map(word => word.id);
  const daily = selectPracticeWords(words, { now, ledger, retryIds: ['retry'] });
  assert.deepEqual(ids(daily.fresh), ['fresh']);
  assert.deepEqual(ids(daily.review), ['hard-due', 'hard-new-today', 'hard-future', 'good-due', 'good-future', 'again-due']);
  assert.equal(daily.limited, false);
  const limited = selectPracticeWords(words, { now, ledger, settings: { dailyReviewLimit: 2 }, preferredIds: ['good-due', 'hard-new-today'] });
  assert.deepEqual(ids(limited.review), ['hard-new-today']);
  assert.equal(limited.limited, true);
  const exhausted = selectPracticeWords(words, { now, ledger, settings: { dailyReviewLimit: 1 } });
  assert.deepEqual(ids(exhausted.review), []);
  const dueOnly = selectPracticeWords(words, { now, ledger, mode: 'review' });
  assert.deepEqual(ids(dueOnly.review), ['easy-due', 'again-due', 'good-due', 'hard-due']);
  assert.deepEqual(dueOnly.fresh, []);
  const favoriteWords = words.map(word => ({ ...word, isFavorite: true }));
  const favorites = selectPracticeWords(favoriteWords, { now, ledger, mode: 'favorites', favorites: true });
  assert.deepEqual(ids(favorites.review), ids(dueOnly.review));
  assert.deepEqual(ids(favorites.fresh), ['fresh']);
  assert.deepEqual(ids(selectPracticeWords(favoriteWords, { now, ledger, favorites: true }).review), ['again-due', 'good-due', 'hard-due']);
});
test('manual Daily practice rounds can repeat counted cards without adding new cards or bypassing a zero review cap', () => {
  const now = new Date(2026, 10, 6, 9).getTime();
  const card = (id, lastGrade, reviewCount = 1) => normalize({
    ...patch, id, lastGrade, reviewCount, lastReviewedAt: reviewCount ? now - 60_000 : null, dueDate: addCalendarDays(now, 1)
  });
  const words = [card('again-counted', 0), card('easy', 3), card('hard', 1), card('good', 2), card('fresh', null, 0)];
  const options = { now, repeat: true, ledger: { dailyNewIds: ['hard'], dailyReviewIds: ['again-counted'] } };
  const reviewIds = settings => selectPracticeWords(words, { ...options, settings }).review.map(word => word.id);
  assert.deepEqual(selectPracticeWords(words, options).fresh, []);
  assert.deepEqual(reviewIds({}), ['hard', 'good', 'again-counted']);
  assert.deepEqual(reviewIds({ dailyReviewLimit: 2 }), ['hard', 'good', 'again-counted']);
  assert.deepEqual(reviewIds({ dailyReviewLimit: 1 }), ['hard']);
  assert.deepEqual(reviewIds({ dailyReviewLimit: 0 }), ['hard']);
  assert.equal(selectPracticeWords(words, { ...options, settings: { dailyReviewLimit: 0 } }).limited, true);
  assert.deepEqual(selectPracticeWords(words, { ...options, mode: 'review' }).review.map(word => word.id).sort(), ['again-counted', 'easy', 'hard']);
});
test('successful early reviews record a grade without moving scheduled repetition or due date', () => {
  const now = new Date(2026, 10, 6, 9).getTime();
  const word = normalize({ ...patch, id: 'early', reviewCount: 4, lastGrade: 2, goodReviewCount: 2,
    repetition: 2, interval: 6, dueDate: addCalendarDays(now, 2), successfulDays: ['2026-11-01', '2026-11-02'] });
  const good = scheduleReview(word, 2, now, { earlyReview: true });
  assert.equal(good.dueDate, word.dueDate);
  assert.equal(good.repetition, word.repetition);
  assert.equal(good.interval, word.interval);
  assert.deepEqual(good.successfulDays, word.successfulDays);
  assert.equal(good.lastReviewedAt, now);
  assert.equal(good.lastGrade, 2);
  assert.equal(good.reviewCount, 5);
  assert.equal(good.goodReviewCount, 3);
  assert.equal(good.memoryStatus, 'mastered');
  const hard = scheduleReview(word, 1, now, { earlyReview: true });
  assert.ok(hard.easeFactor < word.easeFactor);
  const lapse = scheduleReview(good, 0, now, { earlyReview: true });
  assert.equal(lapse.dueDate, new Date(now + 10 * 60_000).toISOString());
  assert.equal(lapse.repetition, 0);
  assert.equal(lapse.interval, 0);
  assert.equal(lapse.memoryStatus, 'not_remembered');
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
test('long examples use sequential browser speech and stop when a newer audio attempt starts', () => {
  const spoken = [];
  const speech = { cancel() {}, speak: utterance => spoken.push(utterance) };
  class Utterance { constructor(text) { this.text = text; } }
  const controller = createPronunciationController({
    speech, Utterance, AudioClass: class {},
    fetcher: () => assert.fail('Full examples use speech directly')
  });
  const example = 'Hundreds of excited students gathered in the auditorium for the graduation ceremony. '.repeat(14).trim();
  assert.equal(controller.sayExample(example), true);
  assert.equal(spoken.length, 1);
  for (let i = 0; i < spoken.length; i++) {
    assert.ok(i < 20 && spoken[i].text.length <= 150);
    assert.equal(spoken[i].lang, 'en-GB');
    spoken[i].onend();
  }
  assert.equal(spoken.map(utterance => utterance.text).join(' '), example);
  controller.sayExample(example);
  const finishOldChunk = spoken.at(-1).onend;
  controller.sayExample('Read this new example.');
  const count = spoken.length;
  finishOldChunk();
  assert.equal(spoken.length, count);
  assert.equal(spoken.at(-1).text, 'Read this new example.');
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
