import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { JSDOM } = require('jsdom');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');

test('new cards have red borders without review history, and dragging neither grades nor navigates', async () => {
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const { window } = new JSDOM(html, { url: 'http://localhost:8791/', pretendToBeVisual: true });
  Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage,
    sessionStorage: window.sessionStorage, indexedDB: new IDBFactory(), IDBKeyRange });
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
  const storage = await import('../js/core/idb-manager.js');
  const { context } = await import('../js/core/context.js');
  const { saveSettings } = await import('../js/core/settings.js');
  const { renderVocabularyCardHtml } = await import('../js/features/library.js');
  const flash = await import('../js/features/flashcard.js');
  const user = 'Card borders';
  saveSettings(user, { autoPronounce: false });
  await storage.mutateWords(['one', 'two'].map(id => ({ id, username: user,
    patch: { word: id, meaning: id, isFavorite: true } })));
  localStorage.setItem('vocab_user', user);
  await import('../js/features/application.js');
  const $ = id => document.getElementById(id), card = $('practice-card');
  async function until(check) {
    for (let i = 0; i < 200; i++) {
      if (check()) return;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.fail('Practice card did not update.');
  }
  try {
    await until(() => flash.getSessionState() && !context.profileLoading);
    assert.equal(card.dataset.recallLevel, 'new');
    assert.ok(card.classList.contains('grade-0'));
    assert.equal(card.querySelector('.practice-swipe-badge'), null);
    const initial = flash.getSessionState();
    const id = initial.cardQueue[initial.queueIndex].wordId;
    const fresh = await storage.readUserWord(user, id);
    assert.equal(fresh.reviewCount, 0);
    assert.equal(fresh.recallLevel, null);
    assert.match(renderVocabularyCardHtml(fresh), /grade-0/);
    $('fc-front-word').click();
    await until(() => flash.getSessionState().cardQueue[initial.queueIndex].revealed);
    const before = flash.getSessionState(), target = $('fc-front-word');
    for (const [dx, dy] of [[-100, 0], [-90, -90], [90, -90], [100, 0], [0, 100]]) {
      for (const [type, x, y] of [['pointerdown', 150, 150], ['pointermove', 150 + dx, 150 + dy], ['pointerup', 150 + dx, 150 + dy]]) {
        const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
        Object.assign(event, { pointerId: 1, pointerType: 'touch', isPrimary: true });
        target.dispatchEvent(event);
        assert.equal(event.defaultPrevented, false);
      }
      target.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 }));
      assert.deepEqual(flash.getSessionState(), before);
    }
    context.reviewMode = 'favorites';
    await flash.startNewSession();
    const currentId = flash.getSessionState().cardQueue[0].wordId;
    for (let grade = 0; grade < 4; grade++) {
      await storage.mutateWords([{ id: currentId, username: user, patch: {
        lastGrade: grade, reviewCount: 1, dueDate: new Date(0).toISOString(),
        autoMastered: grade === 3, masteryOverride: null, goodReviewCount: 0, recallLevel: grade + 1
      } }]);
      await context.refreshVocabulary(user);
      assert.ok(card.classList.contains(`grade-${grade}`));
      assert.equal([...card.classList].filter(name => /^grade-[0-3]$/.test(name)).length, 1);
    }
  } finally { flash.resetForUser(); context.clearActivityTimers(); window.close(); }
});
