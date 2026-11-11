import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { shufflePracticeWords } from '../js/core/srs.js';

const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { JSDOM } = require('jsdom');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');

test('rounds shuffle once, preserve resume, finish with misses and restart only on request', async () => {
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const { window } = new JSDOM(html, { url: 'http://localhost:8787/', pretendToBeVisual: true });
  const originalRandom = Math.random;
  let seed = 121;
  Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage,
    sessionStorage: window.sessionStorage, indexedDB: new IDBFactory(), IDBKeyRange });
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
  const storage = await import('../js/core/idb-manager.js');
  const { context } = await import('../js/core/context.js');
  const { saveSettings } = await import('../js/core/settings.js');
  const flash = await import('../js/features/flashcard.js');
  const $ = id => document.getElementById(id);
  const user = 'Random rounds';
  const records = ['one', 'two', 'three', 'four'].map((id, i) => ({ id, username: user,
    patch: { word: id, meaning: id, topic: 'Round', ...(i > 1 ? { reviewCount: 1 } : {}) } }));
  saveSettings(user, { dailyNewLimit: 3, dailyReviewLimit: 3, autoPronounce: false });
  await storage.mutateWords(records);
  localStorage.setItem('vocab_user', user);
  await import('../js/features/application.js');
  async function until(check) {
    for (let i = 0; i < 200; i++) {
      if (check()) return;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.fail('Round state did not update.');
  }
  const state = () => flash.getSessionState();
  const ids = () => state().cardQueue.map(item => item.wordId);
  const failCard = async () => { await flash.revealCard(); await flash.gradeRecall(0); };
  try {
    await until(() => state() && !context.profileLoading);
    assert.equal(new Set(ids()).size, 4);
    assert.deepEqual(new Set(ids()), new Set(records.map(record => record.id)));
    const original = ids();
    await failCard();
    assert.equal(state().queueIndex, 1);
    assert.deepEqual(ids(), original);
    const firstMiss = original[0];
    const legacy = state();
    legacy.cardQueue.push({ ...legacy.cardQueue[0], entryId: 'old-retry', graded: false, revealed: false });
    await storage.idbPut('metadata', legacy);
    flash.resetForUser();
    await flash.startNewSession({ restore: true });
    assert.deepEqual(ids(), original);
    assert.equal(state().queueIndex, 1);
    const resumed = state();
    await flash.startNewSession({ restore: true });
    assert.deepEqual(state(), resumed);
    while (state().queueIndex < state().cardQueue.length) await failCard();
    assert.equal(state().completedAttempts, 4);
    assert.equal(state().pendingMisses.length, 4);
    assert.equal(context.sessionCompleted, true);
    assert.equal($('btn-session-continue').hidden, false);
    const done = state();
    await context.refreshVocabulary(user);
    assert.deepEqual(state(), done);
    assert.ok(state().pendingMisses.includes(firstMiss));
    $('btn-session-continue').click();
    await until(() => state().sessionId !== done.sessionId);
    assert.equal(state().queueIndex, 0);
    assert.equal(new Set(ids()).size, 4);
    assert.deepEqual(new Set(ids()), new Set(original));
    assert.notDeepEqual(ids(), original);
    while (state().queueIndex < state().cardQueue.length) await failCard();
    const ledger = await storage.idbGet('metadata', state().ledgerKey);
    assert.equal(ledger.completedAttempts, 8);
    assert.equal(ledger.dailyNewIds.length, 2);
    assert.equal(ledger.dailyReviewIds.length, 2);

    const cappedUser = 'Capped rounds';
    saveSettings(cappedUser, { dailyNewLimit: 2, dailyReviewLimit: 0, autoPronounce: false });
    await storage.mutateWords(['a', 'b'].map(id => ({ id, username: cappedUser, patch: { word: id, meaning: id } })));
    await context.activateUser(cappedUser);
    await failCard(); await failCard();
    assert.equal(context.sessionCompleted, true);
    assert.equal($('btn-session-continue').hidden, true);
    assert.equal($('empty-state-title').textContent, 'Daily limit reached');
    saveSettings(cappedUser, { dailyNewLimit: 3, dailyReviewLimit: 0, autoPronounce: false });
    await flash.reconcileSession();
    assert.equal(state().queueIndex, 2);
    assert.equal($('btn-session-continue').hidden, false);
    $('btn-session-continue').click();
    await until(() => state().queueIndex === 0);
    await failCard(); await failCard();
    assert.equal((await storage.idbGet('metadata', state().ledgerKey)).dailyReviewIds.length, 0);

    const reviewUser = 'Unlimited due replay';
    saveSettings(reviewUser, { dailyNewLimit: 0, dailyReviewLimit: 1, autoPronounce: false });
    await storage.mutateWords([
      { id: 'blue', username: reviewUser, patch: { word: 'blue', meaning: 'xanh', reviewCount: 1, lastGrade: 3 } },
      { id: 'later', username: reviewUser, patch: { word: 'later', meaning: 'sau',
        reviewCount: 1, lastGrade: 3, masteredReviewPending: false, dueDate: new Date(Date.now() + 7 * 86400000).toISOString() } }
    ]);
    await context.activateUser(reviewUser);
    context.reviewMode = 'review';
    await flash.startNewSession();
    assert.deepEqual(ids(), ['blue']);
    for (let round = 0; round < 4; round++) {
      await flash.revealCard(); await flash.gradeRecall(2);
      assert.equal(context.sessionCompleted, true);
      assert.equal($('btn-session-continue').hidden, false);
      const doneId = state().sessionId;
      await context.refreshVocabulary(reviewUser);
      assert.equal(state().sessionId, doneId);
      $('btn-session-continue').click();
      await until(() => state().sessionId !== doneId);
      assert.deepEqual(ids(), ['blue']);
    }
    const reviewLedger = await storage.idbGet('metadata', state().ledgerKey);
    assert.deepEqual(reviewLedger.dailyReviewIds, ['blue']);
    assert.equal(reviewLedger.completedAttempts, 4);
  } finally {
    flash.resetForUser();
    context.clearActivityTimers();
    window.close();
    Math.random = originalRandom;
  }
});

test('shuffle preserves every item exactly once without changing the source', () => {
  const random = Math.random;
  try {
    Math.random = () => 0;
    const source = ['a', 'b', 'c', 'd'];
    assert.deepEqual(shufflePracticeWords(source), ['b', 'c', 'd', 'a']);
    assert.deepEqual(source, ['a', 'b', 'c', 'd']);
  } finally { Math.random = random; }
});
