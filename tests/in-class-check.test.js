import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { selectInClassPool } from '../js/features/in-class-check.js';

const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { JSDOM } = require('jsdom');
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');

test('the check samples at most 15 green and blue cards from either the recent or previous pool', () => {
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
  const recent = selectInClassPool(words, now, () => 0.999);
  assert.equal(recent.kind, 'recent');
  assert.deepEqual(recent.words.map(word => word.id), ['boundary', 'iso', 'firestore']);
  const recentWords = Array.from({ length: 24 }, (_, id) => ({ id: String(id), recallLevel: 3, lastReviewedAt: now - 1 }));
  const recentSample = selectInClassPool(recentWords, now, () => 0.9);
  assert.equal(recentSample.words.length, 15);
  assert.equal(new Set(recentSample.words.map(word => word.id)).size, 15);
  assert.notDeepEqual(recentSample.words, recentWords.slice(0, 15));
  assert.deepEqual(recentWords.map(word => word.id), Array.from({ length: 24 }, (_, id) => String(id)));

  const reviewed = Array.from({ length: 24 }, (_, id) => ({ id: String(id), recallLevel: 3, reviewCount: 1 }));
  const pool = selectInClassPool(reviewed, now, () => 0.9);
  assert.equal(pool.kind, 'previous');
  assert.equal(pool.words.length, 15);
  assert.equal(new Set(pool.words.map(word => word.id)).size, 15);
  assert.notDeepEqual(pool.words, reviewed.slice(0, 15));
  const fallback = selectInClassPool(words.slice(3), now, () => 0.999);
  assert.equal(fallback.kind, 'previous');
  assert.deepEqual(fallback.words.map(word => word.id), ['old', 'no-date', 'manual-green', 'manual-blue', 'future']);
  assert.deepEqual(selectInClassPool(words.slice(8), now), { kind: 'empty', words: [], resetHistory: true });
});

test('history prioritizes unchecked IDs, rolls over to the selected batch, and never duplicates a word within a check', () => {
  const words = Array.from({length: 31}, (_, i) => ({ id: `w${i}`, recallLevel: 3 }));
  const first = selectInClassPool(words, Date.now(), () => .999);
  assert.equal(first.resetHistory, false);
  assert.equal(first.words.length, 15);
  const ids = pool => pool.words.map(word => word.id);
  const second = selectInClassPool(words, Date.now(), () => .999, ids(first));
  assert.equal(second.resetHistory, false);
  assert.equal(second.words.length, 15);
  assert.ok(ids(second).every(id => !ids(first).includes(id)));
  const checked = [...ids(first), ...ids(second)];
  const rollover = selectInClassPool(words, Date.now(), () => .999, checked);
  assert.equal(rollover.resetHistory, true);
  assert.equal(rollover.words.length, 15);
  assert.equal(rollover.words[0].id, 'w30');
  assert.equal(new Set(ids(rollover)).size, 15);
  const next = selectInClassPool(words, Date.now(), () => .999, ids(rollover));
  assert.ok(ids(next).every(id => !ids(rollover).includes(id)));
  assert.equal(next.resetHistory, false);
  const exhausted = selectInClassPool(words.slice(0, 4), Date.now(), () => .999, ['w0','w1','w2','w3']);
  assert.equal(exhausted.words.length, 4);
  assert.equal(new Set(ids(exhausted)).size, 4);
  assert.equal(exhausted.resetHistory, true);
  assert.equal(selectInClassPool([...words, words[0]], Date.now(), () => .999).words.length, 15);
  assert.equal(selectInClassPool(words, Date.now(), () => .999, 'malformed').words.length, 15);
});

test('a local check hides answers, reports results immediately, and queues only misses for this profile', async () => {
  const originalRandom = Math.random;
  Math.random = () => 0.999;
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
    assert.equal($('check-pool-description').textContent, 'Up to 15 green and blue words from the last 72 hours; unchecked words first.');
    $('btn-check-start').click();
    await waitFor(() => !$('check-question').hidden);
    assert.equal($('check-progress').textContent, 'Word 1 of 2');
    assert.equal($('check-meaning').textContent, 'kiên cường');
    assert.equal($('check-cloze').textContent, 'Stay [ _____ ] and [ _____ ].');
    assert.equal(document.activeElement, $('check-answer'));
    assert.equal($('check-question').querySelectorAll('button').length, 1);
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
    await waitFor(() => $('check-history-status').textContent === '');
    assert.deepEqual(await storage.idbGet('metadata', 'inclassCheckedIds_Guest'), ['first', 'second']);
    const comparisons = $('check-answer-list').querySelectorAll('.check-answer-item');
    assert.equal(comparisons.length, 2);
    assert.equal(comparisons[0].querySelector('.check-typed-answer').textContent, '  TOUGH  ');
    assert.equal(comparisons[0].querySelector('.check-answer-badge').textContent, 'Correct');
    assert.equal(comparisons[1].querySelector('.check-typed-answer').textContent, 'adjusting');
    assert.equal(comparisons[1].querySelector('.check-target-word').textContent, 'adapt');
    const previousAudio = context.playAudio;
    let pronounced;
    context.playAudio = word => { pronounced = word.id; };
    comparisons[1].querySelector('button').click();
    assert.equal(pronounced, 'second');
    context.playAudio = previousAudio;
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
    await waitFor(() => !$('check-question').hidden);
    submit('Resilient');
    submit('adapt');
    assert.equal($('check-score').textContent, '2 / 2 (100%)');
    assert.equal($('check-missed').hidden, true);
    assert.equal($('btn-check-review-misses').hidden, true);
    $('check-results').querySelector('[data-check-done]').click();
    assert.equal($('view-review').classList.contains('hidden'), false);

    context.switchView('view-in-class-check');
    $('btn-check-start').click();
    await waitFor(() => !$('check-question').hidden);
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

    const student = 'History / A', studentB = 'History ? A';
    const key = `inclassCheckedIds_${encodeURIComponent(student)}`;
    saveSettings(student, {autoPronounce:false, soundEffects:false});
    saveSettings(studentB, {autoPronounce:false, soundEffects:false});
    await storage.mutateWords(Array.from({length:31}, (_, i) => ({username:student, id:`h${String(i).padStart(2,'0')}`, patch:{
      word:`target${i}`, meaning:`prompt${i}`, recallLevel:3, lastGrade:2, lastReviewedAt:Date.now(), reviewCount:2
    }})));
    await context.activateUser(student);
    const beforeWords = await storage.readUserWords(student);
    const beforeOutbox = await storage.pendingOperations(student);
    const start = async () => {
      context.switchView('view-in-class-check');
      $('btn-check-start').click(); $('btn-check-start').click();
      await waitFor(() => !$('check-question').hidden);
    };
    await start();
    submit('abandoned answer');
    context.resetInClassCheck();
    assert.equal(await storage.idbGet('metadata', key), null, 'abandoned checks never change history');
    await start();
    const complete = async ({unsafe = false} = {}) => {
      const selected = [];
      for(let i=0;i<15;i++) {
        const num = Number($('check-meaning').textContent.slice('prompt'.length));
        selected.push(`h${String(num).padStart(2,'0')}`);
        submit(unsafe && i === 0 ? '' : unsafe && i === 1 ? '  <img src=x onerror="alert(1)"> & \'  ' : `target${num}`);
      }
      return selected;
    };
    const batch1 = await complete({unsafe:true});
    await waitFor(() => $('check-history-status').textContent === '');
    assert.deepEqual(await storage.idbGet('metadata',key),batch1);
    assert.equal($('check-answer-list').querySelector('.check-typed-answer').textContent,'(Empty)');
    assert.equal($('check-answer-list').querySelectorAll('.check-typed-answer')[1].textContent, '  <img src=x onerror="alert(1)"> & \'  ');
    assert.equal($('check-answer-list').querySelectorAll('img, script, [onerror]').length,0);
    assert.equal($('check-answer-list').querySelectorAll('.is-incorrect.check-answer-badge').length,2);
    assert.equal($('check-answer-list').querySelectorAll('.is-correct.check-answer-badge').length,13);
    assert.deepEqual(await storage.readUserWords(student),beforeWords);
    assert.deepEqual(await storage.pendingOperations(student),beforeOutbox);
    const doneCheck = () => $('check-results').querySelector('[data-check-done]').click();
    doneCheck(); await start();
    const batch2 = await complete();
    await waitFor(() => $('check-history-status').textContent === '');
    assert.ok(batch2.every(id=>!batch1.includes(id)));
    assert.equal((await storage.idbGet('metadata',key)).length,30);
    doneCheck(); await start();
    const batch3 = await complete();
    await waitFor(() => $('check-history-status').textContent === '');
    assert.equal(batch3[0],'h30');
    assert.deepEqual(await storage.idbGet('metadata',key),batch3,'rollover retains only the newly checked batch');
    doneCheck(); await start();
    const db = await storage.openIndexedDB();
    const transaction = db.transaction;
    let failSave = true;
    db.transaction = function(stores, mode, ...rest) {
      if(stores === 'metadata' && mode === 'readwrite' && failSave) { failSave=false; throw new Error('simulated storage failure'); }
      return transaction.call(this,stores,mode,...rest);
    };
    const batch4 = await complete();
    await waitFor(() => !$('btn-check-save-history').hidden);
    assert.deepEqual(await storage.idbGet('metadata',key),batch3);
    assert.ok(batch4.every(id=>!batch3.includes(id)));
    assert.equal($('check-results').hidden,false);
    $('btn-check-save-history').click(); $('btn-check-save-history').click();
    await waitFor(() => $('check-history-status').textContent === '');
    db.transaction = transaction;
    assert.equal(new Set(await storage.idbGet('metadata',key)).size,30);
    doneCheck(); await start();
    const latestHistory = await storage.idbGet('metadata',key);
    await storage.idbPut('metadata',{key,value:[...latestHistory,'parallel-check-word']});
    const concurrentBatch = await complete();
    await waitFor(() => $('check-history-status').textContent === '');
    const concurrentSaved = await storage.idbGet('metadata',key);
    assert.ok(concurrentSaved.includes('parallel-check-word'), 'completion retains another tab history write');
    assert.ok(concurrentBatch.every(id=>concurrentSaved.includes(id)));
    await context.activateUser(studentB);
    assert.equal(await storage.idbGet('metadata',`inclassCheckedIds_${encodeURIComponent(studentB)}`),null);
    assert.deepEqual(await storage.idbGet('metadata',key),concurrentSaved);
  } finally {
    Math.random = originalRandom;
    flash.resetForUser();
    window.close();
  }
});
