import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { JSDOM } = require('jsdom');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');

test('the guide updates blank legacy fields, preserves review history, and cancels on profile switch', async () => {
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const { window } = new JSDOM(html, { url: 'http://localhost:8788/', pretendToBeVisual: true });
  Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage,
    sessionStorage: window.sessionStorage, indexedDB: new IDBFactory(), IDBKeyRange });
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
  const originalFetch = globalThis.fetch;
  let paused, requested;
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(url);
    const parsed = new URL(url), term = decodeURIComponent(parsed.pathname.split('/').at(-1));
    if (parsed.hostname === 'api.dictionaryapi.dev') {
      if (paused) { requested?.(); await paused; }
      return { ok: true, status: 200, json: async () => [{ phonetic: '/test/', meanings: [
        { partOfSpeech: 'noun', synonyms: [], definitions: [{ example: `We use ${term} every day.` }] }
      ] }] };
    }
    if (parsed.searchParams.has('rel_syn')) return { ok: true, status: 200,
      json: async () => [{ word: 'item', tags: ['n'] }, { word: 'quickly', tags: ['adv'] }] };
    if (parsed.hostname === 'api.datamuse.com') return { ok: true, status: 200, json: async () => [{ word: 'collection' }] };
    return { ok: true, status: 200, json: async () => ({ responseData: { translatedText: 'nghĩa' } }) };
  };
  const storage = await import('../js/core/idb-manager.js');
  const { context } = await import('../js/core/context.js');
  const { saveSettings } = await import('../js/core/settings.js');
  const updater = await import('../js/features/vocabulary-update.js');
  const flash = await import('../js/features/flashcard.js');
  const user = 'Legacy library', other = 'Other library';
  saveSettings(user, { autoPronounce: false }); saveSettings(other, { autoPronounce: false });
  await storage.mutateWords([
    { id: 'legacy', username: user, patch: { word: 'library', meaning: 'thư viện', pos: 'noun',
      reviewCount: 8, interval: 12, repetition: 3, easeFactor: 2.9, lastReviewedAt: 123456789,
      dueDate: new Date(Date.now() + 12 * 86400000).toISOString(), lastGrade: 3, isFavorite: true,
      topic: 'Old topic', topics: ['Old topic', 'Keep'] } },
    { id: 'complete', username: user, patch: { word: 'complete', meaning: 'đầy đủ', pos: 'adj', phonetic: '/full/',
      synonyms: ['full'], collocations: ['complete set'], exampleSentence: 'A complete set.', clozeSentence: 'A [ _____ ] set.' } },
    { id: 'foreign', username: other, patch: { word: 'foreign', meaning: 'khác' } }
  ]);
  localStorage.setItem('vocab_user', user);
  await import('../js/features/application.js');
  async function until(check) {
    for (let i = 0; i < 200; i++) {
      if (check()) return;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.fail('Vocabulary update did not settle.');
  }
  const $ = id => document.getElementById(id);
  try {
    await until(() => context.currentUser === user && !context.profileLoading);
    const before = await storage.readUserWord(user, 'legacy');
    const full = await storage.readUserWord(user, 'complete');
    $('btn-user-guide').click();
    assert.equal($('modal-user-guide').hidden, false);
    $('btn-update-old-vocabulary').click();
    assert.equal($('btn-update-old-vocabulary').disabled, true);
    await until(() => !$('btn-update-old-vocabulary').disabled);
    const updated = await storage.readUserWord(user, 'legacy');
    assert.equal(updated.phonetic, '/test/');
    assert.deepEqual(updated.synonyms, ['item']);
    assert.deepEqual(updated.collocations, ['library collection']);
    assert.equal(updated.exampleSentence, 'We use library every day.');
    assert.equal(updated.clozeSentence, 'We use [ _____ ] every day.');
    for (const field of ['meaning', 'reviewCount', 'interval', 'repetition', 'easeFactor', 'lastReviewedAt', 'dueDate',
      'lastGrade', 'isFavorite', 'topic', 'topics']) assert.deepEqual(updated[field], before[field], field);
    assert.deepEqual(await storage.readUserWord(user, 'complete'), full);
    assert.ok(urls.some(url => url.includes('rel_syn=library')));
    assert.ok(!urls.some(url => url.includes('/complete') || url.includes('rel_syn=foreign')));
    assert.ok((await storage.pendingOperations(user)).some(op => op.wordId === 'legacy' && op.record.phonetic === '/test/'));
    assert.match($('vocabulary-update-status').textContent, /Đã bổ sung 1 từ/);

    await storage.mutateWords([{ id: 'pending', username: user, patch: { word: 'pending', meaning: 'chờ', pos: 'n' } }]);
    const pause = Promise.withResolvers();
    const started = Promise.withResolvers();
    paused = pause.promise; requested = started.resolve;
    const task = updater.updateOldVocabulary();
    await started.promise;
    await storage.mutateWords([{ id: 'pending', username: user, patch: { word: 'pending', meaning: 'tự sửa', pos: 'n' } }]);
    pause.resolve(); paused = null;
    await task;
    assert.equal((await storage.readUserWord(user, 'pending')).meaning, 'tự sửa');
    assert.equal((await storage.readUserWord(user, 'pending')).phonetic, '');

    const nextPause = Promise.withResolvers(), nextStarted = Promise.withResolvers();
    paused = nextPause.promise; requested = nextStarted.resolve;
    const interrupted = updater.updateOldVocabulary();
    await nextStarted.promise;
    await context.activateUser(other);
    await interrupted;
    nextPause.resolve(); paused = null;
    assert.equal(context.currentUser, other);
    assert.equal((await storage.readUserWord(user, 'pending')).phonetic, '');
    assert.equal((await storage.readUserWord(other, 'foreign')).phonetic, '');
    assert.equal($('vocabulary-update-status').textContent, '');
  } finally {
    updater.cancelVocabularyUpdate();
    flash.resetForUser(); context.clearActivityTimers(); window.close(); globalThis.fetch = originalFetch;
  }
});
