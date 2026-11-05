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
      assert.equal(flash.getSessionState().cardQueue.length, 40); assert.equal(spoken.length, 1);
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
      assert.equal(state.cardQueue.length, 41); assert.equal(spoken.length, 2);
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
      await flash.gradeRecall(2);
      context.activeTopic = 'ALL';
      await flash.startNewSession();
      assert.deepEqual(flash.getSessionState().cardQueue.map(item => item.wordId), ['late_b']);
      await flash.revealCard();
      await flash.gradeRecall(2);
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
  } finally { flash.resetForUser(); context.clearActivityTimers(); window.close(); }
});
