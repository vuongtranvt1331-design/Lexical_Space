import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { JSDOM } = require('jsdom');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');

test('saving a library edit returns to the same library context', async t => {
  const markup = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const { window } = new JSDOM(markup, { url: 'http://localhost:8790/', pretendToBeVisual: true });
  const { document, localStorage, sessionStorage } = window;
  Object.assign(globalThis, { window, document, localStorage, sessionStorage, indexedDB: new IDBFactory(), IDBKeyRange });
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
  const storage = await import('../js/core/idb-manager.js');
  const { context } = await import('../js/core/context.js');
  const { saveSettings } = await import('../js/core/settings.js');
  const $ = id => document.getElementById(id);
  const visible = id => !$(id).classList.contains('hidden');
  const submit = () => $('single-entry-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  const editButton = () => document.querySelector('[data-word-id="tracked"] [data-action="edit"]');
  const pauseSaveCompletion = () => {
    const commit = context.commitVocabularyChanges;
    let committed, release;
    const ready = new Promise(resolve => { committed = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    context.commitVocabularyChanges = async (...args) => {
      const records = await commit(...args);
      committed();
      await gate;
      return records;
    };
    return { ready, finish: () => { context.commitVocabularyChanges = commit; release(); } };
  };
  const until = async check => {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (check()) return;
      await new Promise(resolve => setTimeout(resolve, 8));
    }
    assert.fail('Timed out waiting for the editor.');
  };
  await storage.mutateWords([
    { id: 'tracked', username: 'Editor', patch: { word: 'resilient', meaning: 'original meaning', topic: 'Exam words', isFavorite: true } },
    { id: 'other', username: 'Editor', patch: { word: 'other', meaning: 'another word', topic: 'Exam words', isFavorite: true } },
    { id: 'tracked', username: 'Other profile', patch: { word: 'another profile', meaning: 'untouched' } }
  ]);
  saveSettings('Editor', { autoPronounce: false });
  saveSettings('Other profile', { autoPronounce: false });
  const ready = new Promise(resolve => document.addEventListener('lexicalspace:ready', resolve, { once: true }));
  await import('../js/features/application.js');
  await ready;
  try {
    assert.equal(await context.activateUser('Editor'), true);
    context.switchView('view-library');
    $('btn-lib-tab-favorites').click();
    [...$('lib-topic-options-list').querySelectorAll('button')].find(button => button.textContent === 'Exam words').click();
    $('lib-search-input').value = 'resi';
    $('lib-search-input').dispatchEvent(new window.Event('input', { bubbles: true }));

    await t.test('failed saves keep the edit open, then success restores filters and focuses the changed card', async () => {
      editButton().click();
      assert.equal(visible('view-entry'), true);
      $('confirm-input-meaning').value = '';
      submit();
      await until(() => $('entry-save-status').dataset.error === 'true');
      assert.equal(visible('view-entry'), true);
      assert.equal($('btn-confirm-save-text').textContent, 'Save changes');

      $('confirm-input-meaning').value = 'updated meaning';
      submit();
      await until(() => visible('view-library'));
      assert.equal(context.libraryTab, 'favorites');
      assert.equal(context.librarySelectedTopic, 'Exam words');
      assert.equal($('lib-search-input').value, 'resi');
      assert.equal($('library-list-container').querySelectorAll('[data-word-id]').length, 1);
      assert.match($('library-list-container').textContent, /updated meaning/);
      assert.equal(document.activeElement, editButton());
      assert.equal((await storage.readUserWord('Editor', 'tracked')).meaning, 'updated meaning');
    });

    await t.test('creating a new word stays in the entry view', async () => {
      context.switchView('view-entry');
      assert.equal($('btn-confirm-save-text').textContent, 'Save word');
      $('input-word').value = 'coherent';
      $('confirm-input-meaning').value = 'mạch lạc';
      submit();
      await until(() => $('entry-save-status').textContent === 'Saved to your library.');
      assert.equal(visible('view-entry'), true);
      assert.equal($('input-word').value, '');
      assert.ok((await storage.readUserWords('Editor')).some(word => word.word === 'coherent'));
    });

    await t.test('an edit that finishes after navigating to Practice leaves Practice open', async () => {
      context.switchView('view-library');
      editButton().click();
      $('confirm-input-meaning').value = 'saved while away';
      const pending = pauseSaveCompletion();
      try {
        submit();
        await pending.ready;
        context.switchView('view-review');
      } finally { pending.finish(); }
      await until(() => !$('btn-confirm-save').disabled);
      assert.equal(visible('view-review'), true);
      assert.equal((await storage.readUserWord('Editor', 'tracked')).meaning, 'saved while away');
    });

    await t.test('a previous profile’s save completion cannot redirect or clear the new profile’s draft', async () => {
      context.switchView('view-library');
      editButton().click();
      $('confirm-input-meaning').value = 'saved to original profile';
      const pending = pauseSaveCompletion();
      try {
        submit();
        await pending.ready;
        assert.equal(await context.activateUser('Other profile'), true);
        context.switchView('view-entry');
        $('input-word').value = 'independent draft';
      } finally { pending.finish(); }
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(context.currentUser, 'Other profile');
      assert.equal(visible('view-entry'), true);
      assert.equal($('input-word').value, 'independent draft');
      assert.equal((await storage.readUserWord('Other profile', 'tracked')).meaning, 'untouched');
      assert.equal((await storage.readUserWord('Editor', 'tracked')).meaning, 'saved to original profile');
    });
  } finally {
    context.resetForUser();
    context.clearActivityTimers();
    window.close();
  }
});
