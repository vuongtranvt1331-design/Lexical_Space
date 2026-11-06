import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { JSDOM } = require('jsdom'); const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:8765/', pretendToBeVisual: true });
const { window } = dom; const spoken = [];
Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage, indexedDB, IDBKeyRange,
  speechSynthesis: { cancel() {}, speak(u) { spoken.push(u.text); } }, SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } } });
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
const storage = await import('../js/core/idb-manager.js');
await storage.mutateWords(Array.from({ length: 40 }, (_, i) => ({ id: `fixture_${String(i).padStart(2, '0')}`, username: 'Fixture',
  patch: { word: `word${i}`, meaning: `meaning${i}`, topic: 'Test topic', pos: 'n', sense: 'target sense',
    exampleSentence: `Use word${i} in context.`, collocations: ['first pairing', 'second pairing'], reviewCount: i < 30 ? 1 : 0, dueDate: new Date(0).toISOString() } })));
window.localStorage.setItem('vocab_user', 'Fixture');
const { context } = await import('../js/core/context.js');
await import('../js/features/application.js');
const flash = await import('../js/features/flashcard.js');
const entry = await import('../js/features/entry.js');
const $ = id => window.document.getElementById(id);
async function until(predicate) { for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); } throw new Error('Timed out waiting for app state.'); }
await until(() => flash.getSessionState()?.cardQueue.length > 0);
test('integrated recall flow, keyboard, exact resume, import and missed-card completion', async t => {
  try {
    await t.test('first card auto-pronounces once and answer/grades start hidden/disabled', () => {
      assert.equal(flash.getSessionState().cardQueue.length, 10); assert.deepEqual(spoken, ['word30']);
      assert.equal($('fc-answer').classList.contains('hidden'), true);
      assert.ok([...document.querySelectorAll('[data-recall-grade]')].every(b => b.disabled));
      flash.renderActiveCard(); assert.equal(spoken.length, 1);
    });
    await t.test('instant grading is rejected; Space reveals, number keys grade and Again queues a later retry', async () => {
      const first = flash.getSessionState().cardQueue[0].wordId;
      await flash.gradeRecall(2); assert.equal(flash.getSessionState().queueIndex, 0);
      document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
      await until(() => !$('fc-answer').classList.contains('hidden'));
      assert.equal(spoken.length, 1);
      document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: '1', bubbles: true }));
      await until(() => flash.getSessionState().queueIndex === 1);
      const state = flash.getSessionState(); assert.equal(state.pendingMisses[0], first); assert.equal(state.cardQueue[4].wordId, first);
      assert.equal(state.cardQueue.length, 11); assert.equal(spoken.length, 2);
      const stored = await storage.idbGet('metadata', state.key); assert.equal(stored.queueIndex, 1); assert.equal(stored.pendingMisses[0], first);
    });
    await t.test('navigation and reload restore the exact card and reveal state', async () => {
      await flash.revealCard(); const before = flash.getSessionState();
      context.switchView('view-library'); context.switchView('view-review');
      assert.equal(flash.getSessionState().sessionId, before.sessionId); assert.equal(flash.getSessionState().queueIndex, before.queueIndex);
      flash.resetForUser(); await flash.startNewSession({ restore: true });
      const after = flash.getSessionState(); assert.equal(after.sessionId, before.sessionId); assert.equal(after.queueIndex, 1);
      assert.equal(after.cardQueue[1].revealed, true); assert.equal($('fc-answer').classList.contains('hidden'), false);
    });
    await t.test('unfinished queues and unresolved misses carry across midnight without losing the current card', async () => {
      const before = flash.getSessionState();
      await storage.idbPut('metadata', { ...before, day: '2000-01-01' });
      flash.resetForUser(); await flash.startNewSession({ restore: true });
      const after = flash.getSessionState(); assert.equal(after.sessionId, before.sessionId); assert.equal(after.queueIndex, before.queueIndex);
      assert.deepEqual(after.pendingMisses, before.pendingMisses); assert.notEqual(after.day, '2000-01-01');
    });
    await t.test('Previous revisits without double-counting, typing ignores shortcuts, R replays, auto-pronounce can be disabled', async () => {
      await flash.previousCard(); assert.equal(flash.getSessionState().queueIndex, 0);
      const attempts = flash.getSessionState().completedAttempts; await flash.gradeRecall(2); assert.equal(flash.getSessionState().completedAttempts, attempts);
      $('btn-fc-next').click(); await until(() => flash.getSessionState().queueIndex === 1);
      $('input-word').dispatchEvent(new window.KeyboardEvent('keydown', { key: '3', bubbles: true })); assert.equal(flash.getSessionState().queueIndex, 1);
      const count = spoken.length; document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'r', bubbles: true })); assert.equal(spoken.length, count + 1);
      $('setting-auto-pronounce').checked = false; $('setting-auto-pronounce').dispatchEvent(new window.Event('change', { bubbles: true }));
      await flash.gradeRecall(2); assert.equal(spoken.length, count + 1);
    });
    await t.test('every missed item requires successful retrieval before completion and the completed session survives reload', async () => {
      let guard = 0;
      while (flash.getSessionState().queueIndex < flash.getSessionState().cardQueue.length && guard++ < 100) {
        await flash.revealCard(); await flash.gradeRecall(2);
      }
      const done = flash.getSessionState(); assert.equal(done.pendingMisses.length, 0); assert.equal(done.queueIndex, done.cardQueue.length);
      assert.equal(context.sessionCompleted, true); assert.equal($('empty-state-title').textContent, 'Practice complete');
      flash.resetForUser(); await flash.startNewSession({ restore: true }); assert.equal(context.sessionCompleted, true);
      await flash.startNewSession({ fresh: true }); assert.equal(flash.getSessionState().sessionId, done.sessionId);
    });
    await t.test('sense fields survive save/edit/import, overwrite works, and content edits preserve SRS', async () => {
      const payload = { word: 'bank', meaning: 'ngân hàng', topic: 'Finance', pos: 'n', cefr: 'A2', sense: 'a financial organization', collocations: ['bank account', 'bank loan'], exampleSentence: 'She went to the bank.' };
      const saved = await entry.saveWord(payload, null); assert.equal(Object.hasOwn(saved, 'cefr'), false);
      assert.equal((await storage.readUserWord('Fixture', saved.id)).exampleSentence, payload.exampleSentence);
      const skipped = await entry.importVocabulary([payload]); assert.equal(skipped.skipped, 1);
      const updated = await entry.importVocabulary([{ ...payload, exampleSentence: 'The bank approved her loan.' }], { overwrite: true }); assert.equal(updated.updated, 1);
      await assert.rejects(entry.saveWord({ ...payload, pos: 'invalid' }, null));
      const reviewed = context.wordsData.find(w => w.reviewCount > 0); const history = reviewed.lastReviewedAt;
      await context.editWord(reviewed.id, { sense: 'updated targeted sense' });
      assert.equal((await storage.readUserWord('Fixture', reviewed.id)).lastReviewedAt, history);
    });
    await t.test('different scopes restore their active pointer after reload and remain isolated by user', async () => {
      context.activeTopic = 'Finance'; await flash.startNewSession(); const finance = flash.getSessionState();
      flash.resetForUser(); context.activeTopic = 'ALL'; context.reviewMode = 'review'; await flash.startNewSession({ restore: true });
      assert.equal(context.activeTopic, 'Finance'); assert.equal(flash.getSessionState().sessionId, finance.sessionId);
      await context.activateUser('Second user');
      assert.equal(flash.getSessionState().username, 'Second user'); assert.equal(flash.getSessionState().cardQueue.length, 0);
    });
    await t.test('late vocabulary joins an existing session and an overlapping scope skips a completed review', async () => {
      const user = 'Second user';
      const empty = flash.getSessionState();
      await storage.mutateWords([{ id: 'late_a', username: user, patch: { word: 'first', meaning: 'first meaning', topic: 'Shared topic' } }]);
      await context.refreshVocabulary(user);
      const first = flash.getSessionState();
      assert.equal(first.sessionId, empty.sessionId);
      assert.deepEqual(first.cardQueue.map(item => item.wordId), ['late_a']);
      await flash.revealCard();
      await storage.mutateWords([{ id: 'late_b', username: user, patch: { word: 'second', meaning: 'second meaning', topic: 'Shared topic' } }]);
      await context.refreshVocabulary(user);
      const expanded = flash.getSessionState();
      assert.deepEqual(expanded.cardQueue.map(item => item.wordId), ['late_a', 'late_b']);
      assert.equal(expanded.cardQueue[0].entryId, first.cardQueue[0].entryId);
      assert.equal(expanded.cardQueue[0].revealed, true);

      context.activeTopic = 'Shared topic';
      await flash.startNewSession();
      assert.deepEqual(flash.getSessionState().cardQueue.map(item => item.wordId), ['late_a', 'late_b']);
      await flash.revealCard();
      await flash.gradeRecall(3);
      context.activeTopic = 'ALL';
      await flash.startNewSession();
      assert.deepEqual(flash.getSessionState().cardQueue.map(item => item.wordId), ['late_b']);
      await flash.revealCard();
      await flash.gradeRecall(3);
      assert.equal(context.sessionCompleted, true);
      await storage.mutateWords([{ id: 'late_c', username: user, patch: { word: 'third', meaning: 'third meaning', topic: 'Shared topic' } }]);
      await context.refreshVocabulary(user);
      const resumed = flash.getSessionState();
      assert.equal(resumed.sessionId, empty.sessionId);
      assert.equal(resumed.cardQueue[resumed.queueIndex].wordId, 'late_c');
      assert.equal(resumed.completedAttempts, 1);
      const daily = await storage.idbGet('metadata', resumed.ledgerKey);
      assert.equal(daily.completedAttempts, 2);
      assert.deepEqual(daily.successfulIds, ['late_a', 'late_b']);
    });
    await t.test('practice edit returns to the same card and deletion advances without discarding other retries', async () => {
      const user = 'Practice editor';
      await storage.mutateWords(['alpha', 'bravo', 'charlie'].map(word => ({ id: word, username: user, patch: { word, meaning: `Meaning of ${word}` } })));
      await context.activateUser(user);
      await flash.revealCard();
      const opened = flash.getSessionState();
      const first = opened.cardQueue[0];
      $('btn-fc-edit').click();
      assert.equal($('view-entry').classList.contains('hidden'), false);
      assert.equal($('input-word').value, first.wordId);
      $('confirm-input-meaning').value = 'Updated meaning';
      $('single-entry-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
      await until(() => !$('view-review').classList.contains('hidden') && $('fc-back-meaning').textContent === 'Updated meaning');
      assert.equal(flash.getSessionState().sessionId, opened.sessionId);
      assert.deepEqual(flash.getSessionState().cardQueue[0], first);
      assert.equal((await storage.readUserWord(user, first.wordId)).reviewCount, 0);

      await flash.gradeRecall(0);
      await flash.revealCard();
      await flash.gradeRecall(0);
      $('btn-fc-previous').click();
      await until(() => flash.getSessionState().queueIndex === 1);
      const before = flash.getSessionState(), removed = before.cardQueue[before.queueIndex].wordId;
      const next = before.cardQueue[before.queueIndex + 1];
      const realConfirm = window.confirm;
      try {
        window.confirm = () => false;
        $('btn-fc-delete').click();
        assert.deepEqual(flash.getSessionState(), before);
        assert.equal((await storage.readUserWord(user, removed)).deleted, false);

        window.confirm = () => true;
        $('btn-fc-delete').click();
        await until(() => flash.getSessionState().cardQueue.every(item => item.wordId !== removed));
        const after = flash.getSessionState();
        assert.deepEqual(after.cardQueue[after.queueIndex], next);
        assert.deepEqual(after.pendingMisses, [first.wordId]);
        assert.equal(after.completedAttempts, before.completedAttempts);
        assert.deepEqual(await storage.idbGet('metadata', after.key), after);
        assert.equal((await storage.readUserWord(user, removed)).deleted, true);
        assert.ok((await storage.pendingOperations(user)).some(op => op.type === 'DELETE' && op.wordId === removed));
      } finally { window.confirm = realConfirm; }
    });
    await t.test('switching directions rotates pending cards and preserves an Again retry and graded history', async () => {
      const user = 'Direction switch fixture';
      await storage.mutateWords(['alpha', 'bravo', 'charlie'].map(word => ({ id: word, username: user, patch: { word, meaning: `Nghĩa của ${word}` } })));
      await context.activateUser(user);
      await flash.revealCard();
      await flash.gradeRecall(0);
      await flash.revealCard();
      await flash.previousCard();
      const before = flash.getSessionState();
      assert.equal(before.cardQueue[before.queueIndex].wordId, 'alpha');
      assert.equal(before.cardQueue[1].revealed, true);

      $('recall-vi-en').click();
      await until(() => flash.getSessionState().recallDirection === 'vi-en');
      const reverse = flash.getSessionState();
      assert.equal(reverse.sessionId, before.sessionId);
      assert.deepEqual(reverse.cardQueue.map(item => item.wordId), ['alpha', 'bravo', 'charlie', 'alpha']);
      assert.deepEqual(reverse.cardQueue[0], before.cardQueue[0]);
      assert.equal(reverse.queueIndex, 1);
      assert.equal(reverse.cardQueue[1].revealed, false);
      assert.equal($('fc-front-word').textContent, 'Nghĩa của bravo');
      assert.deepEqual(reverse.pendingMisses, ['alpha']);
      assert.equal(reverse.completedAttempts, before.completedAttempts);
      $('recall-answer-input').value = 'unfinished answer';

      $('recall-en-vi').click();
      await until(() => flash.getSessionState().recallDirection === 'en-vi');
      const switchedBack = flash.getSessionState();
      assert.equal($('fc-front-word').textContent, 'charlie');
      assert.equal($('recall-answer-input').value, '');
      assert.equal($('fc-answer').hidden, true);
      assert.deepEqual(switchedBack.cardQueue.map(item => item.wordId), ['alpha', 'charlie', 'alpha', 'bravo']);
      assert.deepEqual(await storage.idbGet('metadata', switchedBack.key), switchedBack);
      flash.resetForUser();
      await flash.startNewSession({ restore: true });
      assert.deepEqual(flash.getSessionState(), switchedBack);
    });
    await t.test('a direction switch defers duplicate spellings and equivalent Vietnamese prompts', async () => {
      const user = 'Duplicate direction fixture';
      await storage.mutateWords([
        { id: 'a', username: user, patch: { word: 'auditorium', meaning: 'hội trường' } },
        { id: 'b', username: user, patch: { word: 'Auditorium', meaning: 'khán phòng' } },
        { id: 'c', username: user, patch: { word: 'hall', meaning: 'Hội trường' } },
        { id: 'd', username: user, patch: { word: 'stage', meaning: 'sân khấu' } }
      ]);
      await context.activateUser(user);
      assert.equal($('fc-front-word').textContent, 'auditorium');
      await flash.setRecallDirection('vi-en');
      assert.equal($('fc-front-word').textContent, 'sân khấu');
      assert.equal($('fc-answer').hidden, true);
      assert.deepEqual(flash.getSessionState().cardQueue.map(item => item.wordId), ['d', 'a', 'b', 'c']);
    });
    await t.test('a direction switch waits if it would show the same remaining word', async () => {
      const user = 'One-card direction fixture';
      await storage.mutateWords([{ id: 'only', username: user, patch: { word: 'only', meaning: 'duy nhất' } }]);
      await context.activateUser(user);
      const before = flash.getSessionState();
      $('recall-vi-en').click();
      assert.equal($('recall-en-vi').checked, true);
      assert.equal($('fc-front-word').textContent, 'only');
      assert.equal($('fc-answer').hidden, true);
      assert.deepEqual(flash.getSessionState(), before);
      await flash.revealCard();
      await flash.gradeRecall(3);
      await flash.setRecallDirection('vi-en');
      assert.equal(flash.getSessionState().recallDirection, 'vi-en');
      assert.equal(context.sessionCompleted, true);

      const { saveSettings } = await import('../js/core/settings.js');
      saveSettings(user, { recallDirection: 'en-vi' });
      await storage.mutateWords([{ id: 'new', username: user, patch: { word: 'new', meaning: 'mới' } }]);
      await context.refreshVocabulary(user);
      assert.equal(flash.getSessionState().recallDirection, 'en-vi');
      assert.equal($('fc-front-word').textContent, 'new');
    });
    await t.test('a sole missed word can be retried in English to Vietnamese without losing progress', async () => {
      const { saveSettings } = await import('../js/core/settings.js');
      for (const miss of ['typed', 'continued', 'again']) {
        const user = `Single missed word fixture ${miss}`;
        saveSettings(user, { recallDirection: 'vi-en', autoPronounce: false });
        await storage.mutateWords([{ id: 'only', username: user, patch: { word: 'auditorium', meaning: 'hội trường' } }]);
        await context.activateUser(user);
        await flash.setRecallDirection('en-vi');
        assert.equal(flash.getSessionState().recallDirection, 'vi-en');

        if (miss === 'again') {
          await flash.revealCard();
          await flash.gradeRecall(0);
        } else {
          $('recall-answer-input').value = 'incorrect';
          await flash.submitReverseAnswer();
          assert.match($('recall-feedback').textContent, /switch to English/);
        }
        const failed = flash.getSessionState();
        assert.equal(failed.cardQueue[0].grade, 0);
        const retry = failed.cardQueue[1];
        const ledger = await storage.idbGet('metadata', failed.ledgerKey);
        if (miss === 'continued') {
          $('btn-fc-next').click();
          await until(() => flash.getSessionState().queueIndex === 1);
        }
        $('recall-en-vi').click();
        await until(() => flash.getSessionState().recallDirection === 'en-vi');
        const switched = flash.getSessionState();
        assert.equal(switched.sessionId, failed.sessionId);
        assert.equal(switched.completedAttempts, failed.completedAttempts);
        assert.deepEqual(switched.pendingMisses, ['only']);
        assert.deepEqual(switched.cardQueue[switched.queueIndex], retry);
        assert.equal($('fc-front-word').textContent, 'auditorium');
        assert.equal($('fc-answer').hidden, true);
        assert.deepEqual(await storage.idbGet('metadata', failed.ledgerKey), ledger);

        flash.resetForUser();
        await flash.startNewSession({ restore: true });
        assert.deepEqual(flash.getSessionState(), switched);
        await flash.revealCard();
        await flash.gradeRecall(2);
        assert.deepEqual(flash.getSessionState().pendingMisses, []);
      }
    });
    await t.test('Mastered words leave saved Daily queues and open in Due Reviews when eligible', async () => {
      const user = 'Mastered queue fixture';
      const future = new Date(Date.now() + 86400000).toISOString();
      await storage.mutateWords([
        { id: 'manual', username: user, patch: { word: 'manual', meaning: 'bằng tay', masteryOverride: 'mastered', dueDate: null } },
        { id: 'due', username: user, patch: { word: 'due', meaning: 'đến hạn', reviewCount: 1, lastGrade: 3 } },
        { id: 'future', username: user, patch: { word: 'future', meaning: 'tương lai', reviewCount: 1, lastGrade: 3, dueDate: future } },
        { id: 'scheduled', username: user, patch: { word: 'scheduled', meaning: 'có lịch', reviewCount: 1, lastGrade: 3, dueDate: future, masteredReviewPending: false } },
        { id: 'fresh', username: user, patch: { word: 'fresh', meaning: 'mới' } },
        { id: 'yellow', username: user, patch: { word: 'yellow', meaning: 'vàng', reviewCount: 1, lastGrade: 1 } }
      ]);
      await context.activateUser(user);
      const queue = () => {
        const state = flash.getSessionState();
        return state.cardQueue.slice(state.queueIndex).map(item => item.wordId);
      };
      assert.deepEqual(queue(), ['fresh']);
      await flash.revealCard();
      await flash.gradeRecall(3);
      assert.deepEqual(queue(), ['yellow']);
      assert.equal($('btn-fc-previous').disabled, true);
      await flash.revealCard();
      await flash.gradeRecall(0);
      assert.deepEqual(flash.getSessionState().pendingMisses, ['yellow']);
      const { updateWordMemory } = await import('../js/features/library.js');
      await updateWordMemory('yellow', 'mastered');
      await until(() => flash.getSessionState().pendingMisses.length === 0);
      assert.deepEqual(queue(), []);
      assert.equal($('btn-session-continue').hidden, true);
      assert.match($('empty-state-subtitle').textContent, /Due Reviews/);
      flash.resetForUser();
      await flash.startNewSession({ restore: true });
      assert.deepEqual(queue(), []);
      context.reviewMode = 'review';
      await flash.startNewSession();
      assert.deepEqual(queue().sort(), ['due', 'fresh', 'future', 'manual', 'yellow']);
      for (let i = 0; i < 5; i++) {
        await flash.revealCard();
        await flash.gradeRecall(2);
      }
      assert.deepEqual(queue(), []);
      assert.equal((await storage.readUserWord(user, 'future')).dueDate, future);
      assert.equal((await storage.readUserWord(user, 'future')).masteredReviewPending, false);
    });
    await t.test('reverse recall auto-pronounces only after a correct typed answer in the active view', async () => {
      const user = 'Reverse audio fixture';
      const { saveSettings } = await import('../js/core/settings.js');
      saveSettings(user, { recallDirection: 'vi-en', autoPronounce: true });
      await storage.mutateWords(['alpha', 'bravo', 'charlie', 'delta'].map(word => ({ id: word, username: user, patch: { word, meaning: `Nghĩa của ${word}` } })));
      const count = spoken.length;
      await context.activateUser(user);
      assert.equal(flash.getSessionState().recallDirection, 'vi-en');
      assert.equal(spoken.length, count);

      await flash.revealCard();
      assert.equal(spoken.length, count);
      await flash.revealCard();
      $('recall-answer-input').value = 'incorrect';
      await flash.submitReverseAnswer();
      assert.equal(flash.getSessionState().cardQueue[0].grade, 0);
      assert.equal(spoken.length, count);

      $('btn-fc-next').click();
      await until(() => flash.getSessionState().queueIndex === 1);
      $('recall-answer-input').value = 'bravo';
      await flash.submitReverseAnswer();
      assert.deepEqual(spoken.slice(count), ['bravo']);
      flash.renderActiveCard();
      flash.resetForUser();
      await flash.startNewSession({ restore: true });
      assert.equal(flash.getSessionState().cardQueue[1].answerCorrect, true);
      await flash.gradeRecall(2);
      await flash.previousCard();
      assert.deepEqual(spoken.slice(count), ['bravo']);
      $('btn-fc-next').click();
      await until(() => flash.getSessionState().queueIndex === 2);

      $('setting-auto-pronounce').checked = false;
      $('setting-auto-pronounce').dispatchEvent(new window.Event('change', { bubbles: true }));
      $('recall-answer-input').value = 'charlie';
      await flash.submitReverseAnswer();
      assert.deepEqual(spoken.slice(count), ['bravo']);
      await flash.replayCurrentAudio();
      assert.deepEqual(spoken.slice(count), ['bravo', 'charlie']);
      await flash.gradeRecall(2);

      $('setting-auto-pronounce').checked = true;
      $('setting-auto-pronounce').dispatchEvent(new window.Event('change', { bubbles: true }));
      $('recall-answer-input').value = 'delta';
      const pending = flash.submitReverseAnswer();
      context.switchView('view-library');
      await pending;
      context.switchView('view-review');
      flash.resetForUser();
      await flash.startNewSession({ restore: true });
      assert.equal(flash.getSessionState().cardQueue[3].answerCorrect, true);
      assert.deepEqual(spoken.slice(count), ['bravo', 'charlie']);
    });
  } finally { flash.resetForUser(); context.clearActivityTimers(); window.close(); }
});
