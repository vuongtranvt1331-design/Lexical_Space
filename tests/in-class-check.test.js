import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { selectInClassPool } from '../js/features/in-class-check.js';

const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { JSDOM } = require('jsdom');
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');

test('the check uses only green and blue cards, preferring the full 72-hour pool', () => {
  const now = Date.parse('2026-11-06T15:00:00.000Z'), windowMs = 72 * 60 * 60 * 1000;
  const words = [
    { id: 'boundary', recallLevel: 3, lastReviewedAt: now - windowMs },
    { id: 'iso', memoryStatus: 'mastered', lastReviewedAt: new Date(now - 1000).toISOString() },
    { id: 'firestore', lastGrade: 2, lastReviewedAt: { seconds: now / 1000 - 5 } },
    { id: 'old', recallLevel: 3, lastReviewedAt: now - windowMs - 1, reviewCount: 4 },
    { id: 'no-date', lastGrade: 2, reviewCount: 1 },
    { id: 'manual-green', masteryOverride: 'not_remembered' },
    { id: 'manual-blue', masteryOverride: 'mastered', memoryStatus: 'mastered' },
    { id: 'future', recallLevel: 3, lastReviewedAt: now + 1 },
    { id: 'deleted', recallLevel: 3, lastReviewedAt: now - 1, deleted: true },
    { id: 'recent-red', recallLevel: 1, lastReviewedAt: now - 1, reviewCount: 1 },
    { id: 'recent-yellow', lastGrade: 1, lastReviewedAt: now - 1, reviewCount: 1 },
    { id: 'edited-new', updatedAt: now, reviewCount: 1 }
  ];
  const recent = selectInClassPool(words, now);
  assert.equal(recent.kind, 'recent');
  assert.deepEqual(recent.words.map(word => word.id), ['boundary', 'iso', 'firestore']);
  assert.equal(selectInClassPool(Array.from({ length: 24 }, (_, id) => ({ id, recallLevel: 3, lastReviewedAt: now - 1 })), now).words.length, 24);

  const reviewed = Array.from({ length: 24 }, (_, id) => ({ id, recallLevel: 3, reviewCount: 1 }));
  const pool = selectInClassPool(reviewed, now, () => 0.9);
  assert.equal(pool.kind, 'previous');
  assert.equal(pool.words.length, 15);
  assert.equal(new Set(pool.words.map(word => word.id)).size, 15);
  assert.notDeepEqual(pool.words, reviewed.slice(0, 15));
  const fallback = selectInClassPool(words.slice(3), now, () => 0);
  assert.equal(fallback.kind, 'previous');
  assert.deepEqual(fallback.words.map(word => word.id), ['old', 'no-date', 'manual-green', 'manual-blue', 'future']);
  assert.deepEqual(selectInClassPool(words.slice(8), now), { kind: 'empty', words: [] });
});

test('a local check hides answers, reports results immediately, and queues only misses for this profile', async () => {
  const markup = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const { window } = new JSDOM(markup, { url: 'http://localhost:8789/', pretendToBeVisual: true });
  Object.assign(globalThis, { window, document: window.document, indexedDB, IDBKeyRange, localStorage: window.localStorage, sessionStorage: window.sessionStorage });
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
  const $ = id => document.getElementById(id);
  const { context } = await import('../js/core/context.js');
  const storage = await import('../js/core/idb-manager.js');
  const { saveSettings } = await import('../js/core/settings.js');
  const flash = await import('../js/features/flashcard.js');
  const user = 'Guest', other = 'Other profile', now = Date.now();
  const dueDate = new Date(now + 30 * 86400000).toISOString();
  const reviewed = { dueDate, lastReviewedAt: now - 60_000, reviewCount: 4, repetition: 2, lastGrade: 2 };
  saveSettings(user, { autoPronounce: false, soundEffects: false, dailyReviewLimit: 0 });
  saveSettings(other, { autoPronounce: false, soundEffects: false });
  await storage.mutateWords([
    { username: user, id: 'first', patch: { ...reviewed, masteryOverride: 'mastered', word: 'resilient', meaning: 'kiên cường', synonyms: ['tough'], clozeSentence: 'Stay [ _____ ] and resilient.' } },
    { username: user, id: 'second', patch: { ...reviewed, word: 'adapt', meaning: 'thích nghi', exampleSentence: 'They adapted quickly.' } },
    { username: user, id: 'old', patch: { ...reviewed, lastReviewedAt: 1, word: 'old', meaning: 'cũ' } },
    { username: user, id: 'yellow', patch: { ...reviewed, lastGrade: 1, word: 'cautious', meaning: 'thận trọng' } },
    { username: other, id: 'second', patch: { word: 'elsewhere', meaning: 'nơi khác' } }
  ]);
  localStorage.setItem('vocab_user', user);
  const waitFor = async predicate => {
    for (let i = 0; i < 150; i++) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.fail('Timed out waiting for the app.');
  };
  const submit = answer => {
    $('check-answer').value = answer;
    $('check-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  };

  try {
    await import('../js/features/application.js');
    await waitFor(() => context.currentUser === user && !context.profileLoading && flash.getSessionState());
    const daily = flash.getSessionState();
    const before = await storage.readUserWord(user, 'second');
    context.switchView('view-in-class-check');
    assert.equal($('check-intro').hidden, false);
    assert.equal($('check-available-count').textContent, '2');
    assert.equal($('check-pool-description').textContent, 'Green and blue words reviewed in the last 72 hours.');
    $('btn-check-start').click();
    assert.equal($('check-progress').textContent, 'Word 1 of 2');
    assert.equal($('check-meaning').textContent, 'kiên cường');
    assert.equal($('check-cloze').textContent, 'Stay [ _____ ] and [ _____ ].');
    assert.equal(document.activeElement, $('check-answer'));
    assert.equal($('check-question').querySelectorAll('button').length, 1);
    submit(' ');
    assert.equal($('check-progress').textContent, 'Word 1 of 2');
    submit('  TOUGH  ');
    assert.equal($('check-cloze').textContent, 'They [ _____ ] quickly.');
    assert.equal($('check-results').hidden, true);
    submit('adjusting');
    assert.equal($('check-results').hidden, false);
    assert.equal($('check-question').hidden, true);
    assert.equal($('check-score').textContent, '1 / 2 (50%)');
    assert.match($('check-time').textContent, /^\d+:\d\d$/);
    assert.deepEqual([...$('check-missed-list').children].map(item => item.textContent), ['adapt']);
    assert.equal(document.activeElement, $('check-results-heading'));
    assert.deepEqual(await storage.readUserWord(user, 'second'), before);
    assert.deepEqual(flash.getSessionState(), daily);

    $('btn-check-review-misses').click();
    $('btn-check-review-misses').click();
    await waitFor(() => !$('view-review').classList.contains('hidden') && flash.getSessionState()?.pendingMisses.includes('second') && !$('btn-fc-reveal').disabled);
    const queued = flash.getSessionState();
    assert.equal(queued.cardQueue[queued.queueIndex].wordId, 'second');
    assert.equal(queued.cardQueue.filter(item => item.wordId === 'second').length, 1);
    assert.deepEqual(queued.inClassMisses, ['second']);
    assert.deepEqual((await storage.idbGet('metadata', queued.key)).inClassMisses, ['second']);
    assert.deepEqual(await storage.readUserWord(user, 'second'), before);
    assert.deepEqual(await storage.idbGet('metadata', daily.key), daily);
    flash.resetForUser();
    await flash.startNewSession({ restore: true });
    assert.equal(flash.getSessionState().sessionId, queued.sessionId);
    assert.deepEqual(flash.getSessionState().pendingMisses, ['second']);
    await flash.revealCard();
    await flash.gradeRecall(2);
    assert.equal((await storage.readUserWord(user, 'second')).reviewCount, before.reviewCount + 1);
    assert.equal((await storage.readUserWord(user, 'second')).repetition, before.repetition);
    assert.deepEqual(flash.getSessionState().inClassMisses, []);
    assert.deepEqual(flash.getSessionState().pendingMisses, []);

    context.switchView('view-in-class-check');
    $('btn-check-start').click();
    submit('Resilient');
    submit('adapt');
    assert.equal($('check-score').textContent, '2 / 2 (100%)');
    assert.equal($('check-missed').hidden, true);
    assert.equal($('btn-check-review-misses').hidden, true);
    $('check-results').querySelector('[data-check-done]').click();
    assert.equal($('view-review').classList.contains('hidden'), false);

    context.switchView('view-in-class-check');
    $('btn-check-start').click();
    assert.equal($('check-question').hidden, false);
    assert.equal(await context.activateUser(other), true);
    context.switchView('view-in-class-check');
    assert.equal($('check-empty').hidden, false);
    assert.equal($('check-empty-heading').textContent, 'No green or blue words to check yet');
    assert.equal($('check-question').hidden, true);
    assert.equal($('check-meaning').textContent, '');
    assert.equal($('check-missed-list').textContent, '');
    assert.equal((await storage.readUserWord(other, 'second')).reviewCount, 0);
    $('check-empty').querySelector('[data-check-done]').click();
    assert.equal($('view-review').classList.contains('hidden'), false);
  } finally {
    flash.resetForUser();
    window.close();
  }
});
