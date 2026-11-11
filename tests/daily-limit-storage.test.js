import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');
Object.assign(globalThis, { indexedDB: new IDBFactory(), IDBKeyRange });
const storage = await import('../js/core/idb-manager.js');

const day = '2026-11-06';
const ledgerKey = (username, date = day) => `practice:v2:${encodeURIComponent(username)}:${date}`;
const recall = (username, wordId, options = {}, date) => ({
  key: ledgerKey(username, date), username,
  recallAttempt: { wordId, kind: 'new', limit: null, retry: false, success: true, ...options }
});
const word = (username, id) => ({ username, id, patch: { word: id, meaning: 'definition' } });
const grade = (username, id) => ({ username, id, patch: { reviewCount: 1 } });
const session = (username, id) => ({
  key: `test-session:${username}:${id}`, username, sessionId: id, schemaVersion: 2, sessionVersion: 0, queueIndex: 1
});

test('competing tabs cannot exceed the last slot or persist the rejected grade, session, or outbox', async () => {
  const username = 'Practice & review';
  await storage.mutateWords([word(username, 'one'), word(username, 'two')]);
  await storage.idbPut('metadata', {
    key: ledgerKey(username), username, completedAttempts: 2, successfulIds: ['legacy'],
    reviewIds: ['reserved-previously']
  });
  const ids = ['one', 'two'], sessions = ids.map(id => session(username, id));
  const settled = await Promise.allSettled(ids.map((id, i) => storage.mutateWords(
    [grade(username, id)], [sessions[i], recall(username, id, { limit: 1 })]
  )));
  const winner = settled.findIndex(result => result.status === 'fulfilled');
  const loser = 1 - winner;
  assert.ok(winner >= 0);
  assert.equal(settled[loser].status, 'rejected');
  assert.equal(settled[loser].reason.code, 'daily-limit');
  assert.equal((await storage.readUserWord(username, ids[winner])).reviewCount, 1);
  assert.equal((await storage.readUserWord(username, ids[loser])).reviewCount, 0);
  assert.equal((await storage.pendingOperations(username)).length, 3);
  assert.equal((await storage.idbGet('metadata', sessions[winner].key)).sessionVersion, 1);
  assert.equal(sessions[winner].sessionVersion, 1);
  assert.equal(await storage.idbGet('metadata', sessions[loser].key), null);
  assert.equal(sessions[loser].sessionVersion, 0);
  const ledger = await storage.idbGet('metadata', ledgerKey(username));
  assert.deepEqual(ledger.dailyNewIds, [ids[winner]]);
  assert.deepEqual(ledger.dailyReviewIds, []);
  assert.deepEqual(ledger.reviewIds, ['reserved-previously']);
  assert.equal(ledger.completedAttempts, 3);
  assert.deepEqual(ledger.successfulIds, ['legacy', ids[winner]]);
});

test('uncapped practice still tracks distinct words, without double charging or charging midnight retries', async () => {
  const username = 'Uncapped';
  await storage.mutateWords([word(username, 'a'), word(username, 'b')]);
  await storage.mutateWords([grade(username, 'a')], [recall(username, 'a', { success: false })]);
  await storage.mutateWords([grade(username, 'a')], [recall(username, 'a', { kind: 'review', limit: 0 })]);
  await assert.rejects(
    storage.mutateWords([grade(username, 'b')], [recall(username, 'b', { kind: 'review', limit: 0 })]),
    { code: 'daily-limit' }
  );
  await storage.mutateWords([grade(username, 'b')], [recall(username, 'b', { kind: 'review', retry: true, limit: 0 })]);
  const today = await storage.idbGet('metadata', ledgerKey(username));
  assert.deepEqual(today.dailyNewIds, ['a']);
  assert.deepEqual(today.dailyReviewIds, []);
  assert.equal(today.completedAttempts, 3);
  assert.deepEqual(today.successfulIds, ['a', 'b']);

  const tomorrow = '2026-11-07';
  await storage.mutateWords([grade(username, 'a')], [recall(username, 'a', { kind: 'review', retry: true, limit: 0 }, tomorrow)]);
  await storage.mutateWords([grade(username, 'b')], [recall(username, 'b', { kind: 'review', limit: 1 }, tomorrow)]);
  const next = await storage.idbGet('metadata', ledgerKey(username, tomorrow));
  assert.deepEqual(next.dailyNewIds, []);
  assert.deepEqual(next.dailyReviewIds, ['b']);
  assert.equal(next.completedAttempts, 2);
});

test('an early review consumes a separate slot for a word learned today and competing reviews commit only once', async () => {
  const username = 'Extra review';
  await storage.mutateWords([word(username, 'a'), word(username, 'b')]);
  await storage.mutateWords([grade(username, 'a')], [recall(username, 'a')]);
  const early = (id, options) => recall(username, id, { kind: 'review', extraReview: true, limit: 1, ...options });
  const patch = { username, id: 'a', patch: { reviewCount: 2 } };
  await assert.rejects(storage.mutateWords([patch], [early('a', { limit: 0 })]), { code: 'daily-limit' });
  const sessions = ['first', 'second'].map(id => session(username, id));
  const results = await Promise.allSettled(sessions.map(state => storage.mutateWords(
    [patch], [state, early('a', { success: false })]
  )));
  const accepted = results.findIndex(result => result.status === 'fulfilled');
  assert.ok(accepted >= 0);
  const rejected = results[1 - accepted];
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.reason.code, 'daily-review-complete');
  assert.equal((await storage.readUserWord(username, 'a')).reviewCount, 2);
  assert.equal(await storage.idbGet('metadata', sessions[1 - accepted].key), null);
  assert.equal((await storage.pendingOperations(username)).length, 4);
  await assert.rejects(storage.mutateWords([grade(username, 'b')], [early('b')]), { code: 'daily-limit' });
  await storage.mutateWords([{ ...patch, patch: { reviewCount: 3 } }], [recall(username, 'a', { kind: 'review', retry: true, limit: 0 })]);
  const ledger = await storage.idbGet('metadata', ledgerKey(username));
  assert.deepEqual(ledger.dailyNewIds, ['a']);
  assert.deepEqual(ledger.dailyReviewIds, ['a']);
  assert.equal(ledger.completedAttempts, 3);
  assert.deepEqual(ledger.successfulIds, ['a']);
});

test('manual rounds reuse review slots until disabled and reserve slots for newly reviewed cards', async () => {
  const username = 'Voluntary rounds';
  await storage.mutateWords([word(username, 'a'), word(username, 'b')]);
  await storage.mutateWords([grade(username, 'a'), grade(username, 'b')], [recall(username, 'a'), recall(username, 'b')]);
  const repeat = (id, options) => recall(username, id, { kind: 'review', repeat: true, limit: 1, ...options });
  const patch = (id, reviewCount) => ({ username, id, patch: { reviewCount } });
  await storage.mutateWords([patch('a', 2)], [repeat('a', { extraReview: true })]);
  await storage.mutateWords([patch('a', 3)], [repeat('a')]);
  await storage.mutateWords([patch('a', 4)], [repeat('a', { extraReview: true })]);
  await storage.mutateWords([patch('a', 5)], [repeat('a', { limit: 0 })]);
  await storage.mutateWords([patch('b', 2)], [repeat('b')]);
  await assert.rejects(storage.mutateWords([patch('a', 5)], [repeat('a', { retry: true })]), /Invalid daily practice attempt/);
  const ledger = await storage.idbGet('metadata', ledgerKey(username));
  assert.deepEqual(ledger.dailyNewIds, ['a', 'b']);
  assert.deepEqual(ledger.dailyReviewIds, []);
  assert.equal(ledger.completedAttempts, 7);
  assert.equal((await storage.readUserWord(username, 'a')).reviewCount, 5);
  assert.equal((await storage.readUserWord(username, 'b')).reviewCount, 2);
});

test('categorized attempts cannot use a foreign key and a rejected batch reserves no slots', async () => {
  const username = 'One profile', other = 'Another profile';
  await storage.mutateWords([word(username, 'a'), word(username, 'b'), word(other, 'a')]);
  await assert.rejects(storage.mutateWords([grade(username, 'a')], [{
    ...recall(username, 'a'), key: ledgerKey(other)
  }]), /match the vocabulary change and profile/);
  assert.equal(await storage.idbGet('metadata', ledgerKey(other)), null);
  await assert.rejects(storage.mutateWords([grade(username, 'a'), grade(username, 'b')], [
    recall(username, 'a', { limit: 1 }), recall(username, 'b', { limit: 1 })
  ]), { code: 'daily-limit' });
  assert.equal(await storage.idbGet('metadata', ledgerKey(username)), null);
  assert.equal((await storage.readUserWord(username, 'a')).reviewCount, 0);
  assert.equal((await storage.readUserWord(username, 'b')).reviewCount, 0);
  assert.equal((await storage.pendingOperations(username)).length, 2);
  await storage.mutateWords([grade(username, 'a')], [recall(username, 'a', { limit: 1 })]);
  await storage.mutateWords([grade(other, 'a')], [recall(other, 'a', { limit: 1 })]);
  assert.deepEqual((await storage.idbGet('metadata', ledgerKey(username))).dailyNewIds, ['a']);
  assert.deepEqual((await storage.idbGet('metadata', ledgerKey(other))).dailyNewIds, ['a']);
});
