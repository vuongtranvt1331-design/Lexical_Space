import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { selectInClassPool } from '../js/features/in-class-check.js';

const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { JSDOM } = require('jsdom');
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');

test('weekly check prioritizes 4/3/2, includes the seven-day boundary, and fills short checks oldest first', () => {
  const now = Date.now(), week = 7 * 86400000;
  const words = Array.from({length: 40}, (_, i) => ({id: String(i), recallLevel: 2 + i % 3, memoryStatus: i % 3 === 2 ? 'mastered' : 'not_remembered'}));
  const choose = history => selectInClassPool([...words, words[0], {id:'skip',recallLevel:1}], now, () => .999, history);
  const history = Object.fromEntries(words.map((w,i) => [w.id, now - week + 1 + i]));
  for (const count of [0, 1, 10, 14, 15, 16, 40]) {
    const times = {...history};
    for (let i=0; i<count; i++) times[String(i)] = now - week;
    const result = choose(times);
    assert.equal(result.words.length, count >= 15 ? 15 : 25);
    assert.equal(result.freshCount, Math.min(count,15));
    assert.equal(result.reviewCount, result.words.length-result.freshCount);
    assert.equal(new Set(result.words.map(w=>w.id)).size, result.words.length);
    const fresh = result.words.slice(0,result.freshCount);
    assert.deepEqual(fresh, words.slice(0,count).sort((a,b)=>b.recallLevel-a.recallLevel).slice(0,15));
    assert.deepEqual(result.words.slice(result.freshCount),words.slice(count,count+result.reviewCount));
  }
  assert.equal(selectInClassPool(words.slice(0,6), now, Math.random, history).words.length,6);
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
    { username: user, id: 'third', patch: { ...reviewed, lastReviewedAt: 1, word: 'old', meaning: 'cũ' } },
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
    await waitFor(() => !$('btn-check-start').disabled);
    assert.equal($('check-available-count').textContent, '4');
    assert.equal($('check-pool-description').textContent, '4 not checked in the past 7 days · 0 review.');
    $('btn-check-start').click();
    await waitFor(() => !$('check-question').hidden);
    assert.equal($('check-progress').textContent, 'Word 1 of 4');
    assert.equal($('check-meaning').textContent, 'kiên cường');
    assert.equal($('check-cloze').textContent, 'Stay [ _____ ] and [ _____ ].');
    assert.equal(document.activeElement, $('check-answer'));
    assert.equal($('check-question').querySelectorAll('button').length, 1);
    submit('  TOUGH  ');
    assert.equal($('check-cloze').textContent, 'They [ _____ ] quickly.');
    assert.equal($('check-results').hidden, true);
    submit('adjusting');
    submit('old');
    submit('cautious');
    assert.equal($('check-results').hidden, false);
    assert.equal($('check-question').hidden, true);
    assert.equal($('check-score').textContent, '3 / 4 (75%)');
    assert.match($('check-time').textContent, /^\d+:\d\d$/);
    assert.deepEqual([...$('check-missed-list').children].map(item => item.textContent), ['adapt']);
    assert.equal(document.activeElement, $('check-results-heading'));
    await waitFor(() => $('check-history-status').textContent === '');
    assert.deepEqual(Object.keys(await storage.idbGet('metadata', 'inclassCheckedAt_Guest')).sort(), ['first', 'second', 'third', 'yellow']);
    const comparisons = $('check-answer-list').querySelectorAll('.check-answer-item');
    assert.equal(comparisons.length, 4);
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
    await waitFor(() => !$('btn-check-start').disabled);
    $('btn-check-start').click();
    await waitFor(() => !$('check-question').hidden);
    submit('Resilient');
    submit('adapt');
    submit('old');
    submit('cautious');
    assert.equal($('check-score').textContent, '4 / 4 (100%)');
    assert.equal($('check-missed').hidden, true);
    assert.equal($('btn-check-review-misses').hidden, true);
    $('check-results').querySelector('[data-check-done]').click();
    assert.equal($('view-review').classList.contains('hidden'), false);

    context.switchView('view-in-class-check');
    await waitFor(() => !$('btn-check-start').disabled);
    $('btn-check-start').click();
    await waitFor(() => !$('check-question').hidden);
    assert.equal($('check-question').hidden, false);
    assert.equal(await context.activateUser(other), true);
    context.switchView('view-in-class-check');
    await waitFor(() => !$('check-empty').hidden);
    assert.equal($('check-empty-heading').textContent, 'No level 2–4 words to check yet');
    assert.equal($('check-question').hidden, true);
    assert.equal($('check-meaning').textContent, '');
    assert.equal($('check-missed-list').textContent, '');
    assert.equal((await storage.readUserWord(other, 'second')).reviewCount, 0);
    $('check-empty').querySelector('[data-check-done]').click();
    assert.equal($('view-review').classList.contains('hidden'), false);

    const student = 'History / A', studentB = 'History ? A';
    const key = `inclassCheckedAt_${encodeURIComponent(student)}`;
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
      await waitFor(() => !$('btn-check-start').disabled);
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
      for(let i=0,total=Number($('check-available-count').textContent);i<total;i++) {
        const num = Number($('check-meaning').textContent.slice('prompt'.length));
        selected.push(`h${String(num).padStart(2,'0')}`);
        submit(unsafe && i === 0 ? '' : unsafe && i === 1 ? '  <img src=x onerror="alert(1)"> & \'  ' : `target${num}`);
      }
      return selected;
    };
    const batch1 = await complete({unsafe:true});
    await waitFor(() => $('check-history-status').textContent === '');
    assert.deepEqual(Object.keys(await storage.idbGet('metadata',key)),batch1);
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
    assert.equal(Object.keys(await storage.idbGet('metadata',key)).length,30);
    doneCheck(); await start();
    const batch3 = await complete();
    await waitFor(() => $('check-history-status').textContent === '');
    assert.equal(batch3[0],'h30');
    const afterThree = await storage.idbGet('metadata',key);
    assert.equal(batch3.length,25);
    assert.equal(Object.keys(afterThree).length,31);
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
    assert.deepEqual(await storage.idbGet('metadata',key),afterThree);
    assert.equal(batch4.length,25);
    assert.equal($('check-results').hidden,false);
    $('btn-check-save-history').click(); $('btn-check-save-history').click();
    await waitFor(() => $('check-history-status').textContent === '');
    db.transaction = transaction;
    assert.equal(Object.keys(await storage.idbGet('metadata',key)).length,31);
    doneCheck(); await start();
    const latestHistory = await storage.idbGet('metadata',key);
    await storage.idbPut('metadata',{key,value:{...latestHistory,'parallel-check-word':Date.now()}});
    const concurrentBatch = await complete();
    await waitFor(() => $('check-history-status').textContent === '');
    const concurrentSaved = await storage.idbGet('metadata',key);
    assert.ok(concurrentSaved['parallel-check-word'], 'completion retains another tab history write');
    assert.ok(concurrentBatch.every(id=>concurrentSaved[id]));
    await context.activateUser(studentB);
    assert.equal(await storage.idbGet('metadata',`inclassCheckedAt_${encodeURIComponent(studentB)}`),null);
    assert.deepEqual(await storage.idbGet('metadata',key),concurrentSaved);
  } finally {
    Math.random = originalRandom;
    flash.resetForUser();
    window.close();
  }
});
