import test from 'node:test';
Math.random = () => 0.999999;
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { JSDOM } = require('jsdom');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');

async function waitFor(condition) {
  for (let i = 0; i < 160; i++) {
    if (condition()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.fail('Timed out waiting for practice queue.');
}

test('daily limits follow the profile across scopes, keep retries at midnight, and update from settings', async () => {
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const { window } = new JSDOM(html, { url: 'http://localhost:8776/', pretendToBeVisual: true });
  const { document, localStorage, sessionStorage } = window;
  Object.assign(globalThis, { window, document, localStorage, sessionStorage, indexedDB: new IDBFactory(), IDBKeyRange });
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
  const storage = await import('../js/core/idb-manager.js');
  const { loadSettings, saveSettings } = await import('../js/core/settings.js');
  const { context } = await import('../js/core/context.js');
  const user = 'Budget learner', otherUser = 'Second budget learner';
  const NativeDate = globalThis.Date;
  const $ = id => document.getElementById(id);
  const queue = state => state.cardQueue.slice(state.queueIndex).map(item => item.wordId);
  const change = (id, value) => {
    $(id).value = value;
    $(id).dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  saveSettings(user, { dailyNewLimit: 1, dailyReviewLimit: 1, autoPronounce: false });
  await storage.mutateWords([
    { username: user, id: 'due_a', patch: { word: 'adapt', meaning: 'thích nghi', topic: 'A', reviewCount: 1 } },
    { username: user, id: 'due_b', patch: { word: 'expand', meaning: 'mở rộng', topic: 'B', reviewCount: 1 } },
    { username: user, id: 'new_a', patch: { word: 'review', meaning: 'ôn tập', topic: 'A' } },
    { username: user, id: 'new_b', patch: { word: 'learn', meaning: 'học', topic: 'B' } },
    { username: otherUser, id: 'new_b', patch: { word: 'practise', meaning: 'luyện tập' } },
  ]);
  localStorage.setItem('vocab_user', user);
  await import('../js/features/application.js');
  const flash = await import('../js/features/flashcard.js');
  try {
    await waitFor(() => flash.getSessionState() && !context.profileLoading);
    const initial = flash.getSessionState();
    assert.deepEqual(queue(initial), ['new_a', 'due_a']);
    await flash.revealCard();
    $('setting-daily-new-limit').value = '2';
    $('setting-sound-effects').checked = false;
    $('setting-sound-effects').dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal($('setting-daily-new-limit').value, '2');
    assert.equal(loadSettings(user).soundEffects, false);
    assert.equal(context.SoundManager.enabled, false);
    change('setting-daily-new-limit', '2');
    await waitFor(() => queue(flash.getSessionState()).length === 3);
    assert.equal(flash.getSessionState().cardQueue[0].entryId, initial.cardQueue[0].entryId);
    assert.equal(flash.getSessionState().cardQueue[0].revealed, true);
    change('setting-daily-new-limit', '1');
    await waitFor(() => queue(flash.getSessionState()).length === 2);
    context.reviewMode = 'review';
    await flash.startNewSession();
    assert.deepEqual(queue(flash.getSessionState()), ['due_a']);
    await flash.revealCard();
    await flash.gradeRecall(3);

    context.reviewMode = 'learning';
    context.activeTopic = 'B';
    await flash.startNewSession();
    assert.deepEqual(queue(flash.getSessionState()), ['new_b']);
    await flash.revealCard();
    await flash.gradeRecall(0);
    const pending = flash.getSessionState();
    const ledger = await storage.idbGet('metadata', pending.ledgerKey);
    assert.deepEqual(ledger.dailyReviewIds, ['due_a']);
    assert.deepEqual(ledger.dailyNewIds, ['new_b']);

    context.activeTopic = 'ALL';
    await flash.startNewSession();
    assert.deepEqual(queue(flash.getSessionState()), []);
    assert.match($('empty-state-subtitle').textContent, /daily limit resets/);
    context.activeTopic = 'B';
    await flash.startNewSession();
    change('setting-daily-new-limit', '0');
    change('setting-daily-review-limit', '0');
    assert.equal(loadSettings(user).dailyNewLimit, 0);
    assert.equal(loadSettings(user).dailyReviewLimit, 0);

    const now = new NativeDate(), tomorrow = new NativeDate(now);
    tomorrow.setDate(now.getDate() + 1);
    const offset = tomorrow.getTime() - now.getTime();
    globalThis.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [NativeDate.now() + offset])); }
      static now() { return NativeDate.now() + offset; }
    };
    flash.resetForUser();
    await flash.startNewSession({ restore: true });
    const rollover = flash.getSessionState();
    assert.notEqual(rollover.ledgerKey, pending.ledgerKey);
    assert.notEqual(rollover.sessionId, pending.sessionId);
    assert.deepEqual(queue(rollover), []);
    assert.equal(await storage.idbGet('metadata', rollover.ledgerKey), null);

    context.activeTopic = 'ALL';
    await flash.startNewSession();
    assert.deepEqual(queue(flash.getSessionState()), []);
    change('setting-daily-new-limit', '');
    await waitFor(() => queue(flash.getSessionState()).length === 1);
    assert.deepEqual(queue(flash.getSessionState()), ['new_a']);
    change('setting-daily-new-limit', '-1');
    assert.equal(loadSettings(user).dailyNewLimit, null);
    assert.equal($('setting-daily-new-limit').value, '');

    await context.activateUser(otherUser);
    assert.equal(loadSettings(otherUser).dailyReviewLimit, null);
    assert.deepEqual(queue(flash.getSessionState()), ['new_b']);
    assert.equal(await storage.idbGet('metadata', flash.getSessionState().ledgerKey), null);

    const roundUser = 'Round learner';
    const future = new Date(Date.now() + 2 * 86400000).toISOString();
    saveSettings(roundUser, { dailyNewLimit: 1, dailyReviewLimit: 3, autoPronounce: false });
    await storage.mutateWords([
      { username: roundUser, id: 'a-new', patch: { word: 'new', meaning: 'mới' } },
      { username: roundUser, id: 'b-new', patch: { word: 'fresh', meaning: 'tươi' } },
      { username: roundUser, id: 'y-hard', patch: { word: 'hard', meaning: 'khó', reviewCount: 1, lastGrade: 1, dueDate: future } },
      { username: roundUser, id: 'x-good', patch: { word: 'good', meaning: 'tốt', reviewCount: 1, lastGrade: 2, dueDate: future } },
      { username: roundUser, id: 'due', patch: { word: 'due', meaning: 'đến hạn', reviewCount: 1 } },
    ]);
    await context.activateUser(roundUser);
    const pass = async grade => { await flash.revealCard(); await flash.gradeRecall(grade); };
    assert.deepEqual(queue(flash.getSessionState()), ['a-new', 'due', 'x-good', 'y-hard']);
    await pass(1);
    await pass(3);
    await pass(2);
    await pass(1);
    assert.deepEqual(queue(flash.getSessionState()), []);
    const roundLedgerKey = flash.getSessionState().ledgerKey;
    assert.deepEqual((await storage.idbGet('metadata', roundLedgerKey)).dailyReviewIds, ['due', 'x-good', 'y-hard']);
    assert.equal($('empty-state-title').textContent, 'Daily limit reached');
    assert.equal($('btn-adjust-daily-limits').hidden, false);
    $('btn-adjust-daily-limits').click();
    assert.equal($('modal-settings').hidden, false);
    assert.equal(document.activeElement, $('practice-daily-limits'));
    change('setting-daily-review-limit', '');
    await waitFor(() => !$('btn-session-continue').hidden);
    assert.deepEqual(queue(flash.getSessionState()), []);
    $('btn-close-settings').click();
    $('btn-session-continue').click();
    await waitFor(() => queue(flash.getSessionState()).length === 2);
    assert.deepEqual(queue(flash.getSessionState()), ['x-good', 'y-hard']);
    await pass(2);
    const partway = flash.getSessionState();
    flash.resetForUser();
    await flash.startNewSession({ restore: true });
    assert.deepEqual(flash.getSessionState(), partway);
    await pass(2);
    assert.equal((await storage.readUserWord(roundUser, 'x-good')).recallLevel, 4);
    assert.deepEqual(queue(flash.getSessionState()), []);
    assert.equal($('btn-session-continue').hidden, false);
    $('btn-session-continue').click();
    await waitFor(() => queue(flash.getSessionState()).length === 1);
    assert.deepEqual(queue(flash.getSessionState()), ['y-hard']);
    assert.equal(flash.getSessionState().queueIndex, 0);
    assert.equal(flash.getSessionState().cardQueue.length, 1);
    assert.equal(flash.getSessionState().completedAttempts, 0);
    const ledgerAfterRepeat = await storage.idbGet('metadata', roundLedgerKey);
    assert.deepEqual(ledgerAfterRepeat.dailyNewIds, ['a-new']);
    assert.deepEqual(ledgerAfterRepeat.dailyReviewIds, ['due', 'x-good', 'y-hard']);
  } finally {
    flash.resetForUser();
    context.clearActivityTimers();
    globalThis.Date = NativeDate;
    window.close();
  }
});
