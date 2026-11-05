import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { JSDOM } = require('jsdom');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');

async function waitFor(condition) {
  for (let i = 0; i < 120; i++) {
    if (condition()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.fail('Timed out waiting for startup state.');
}

test('storage failures and a blocked upgrade leave login recoverable and preserve the remembered profile', async () => {
  const markup = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const { window } = new JSDOM(markup, { url: 'http://localhost:8770/', pretendToBeVisual: true });
  const { document, localStorage, sessionStorage } = window;
  const indexedDB = new IDBFactory();
  Object.assign(globalThis, { window, document, localStorage, sessionStorage, indexedDB, IDBKeyRange });
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
  const { context } = await import('../js/core/context.js');
  const storage = await import('../js/core/idb-manager.js');
  const $ = id => document.getElementById(id);
  localStorage.setItem('vocab_user', 'Returning learner');
  const oldTab = await new Promise((resolve, reject) => {
    const request = indexedDB.open(storage.DB_NAME, 2);
    request.onupgradeneeded = () => request.result.createObjectStore('words', { keyPath: 'id' }).put({
      id: 'saved-word', username: 'Returning learner', word: 'resilient', meaning: 'kiên cường'
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    globalThis.indexedDB = { open() { throw new DOMException('Storage denied', 'SecurityError'); } };
    await import('../js/features/application.js');
    await waitFor(() => $('login-status')?.textContent.includes('Browser storage is unavailable'));
    assert.equal($('btn-login-submit').disabled, true);
    assert.equal($('btn-startup-retry').hidden, false);

    globalThis.indexedDB = indexedDB;
    $('btn-startup-retry').click();
    await waitFor(() => $('login-status')?.textContent.includes('other LexicalSpace tabs'));
    assert.equal($('modal-login').hidden, false);
    assert.equal($('btn-login-submit').disabled, true);
    assert.equal($('input-username').value, 'Returning learner');
    assert.equal(context.currentUser, '');

    oldTab.close();
    await waitFor(() => context.currentUser === 'Returning learner' && !context.profileLoading);
    assert.equal($('modal-login').hidden, true);
    assert.equal($('fc-front-word').textContent, 'resilient');
    assert.deepEqual(context.wordsData.map(word => word.id), ['saved-word']);

    const resetEntry = context.resetEntryForUser;
    context.resetEntryForUser = () => { throw new Error('Profile setup interrupted'); };
    try { assert.equal(await context.activateUser('Another learner'), false); }
    finally { context.resetEntryForUser = resetEntry; }
    assert.equal(context.profileLoading, false);
    assert.equal($('modal-login').hidden, false);
    assert.equal($('btn-login-submit').disabled, false);
    assert.equal(localStorage.getItem('vocab_user'), 'Returning learner');
    $('btn-login-submit').click();
    await waitFor(() => $('modal-login').hidden);
    assert.equal(localStorage.getItem('vocab_user'), 'Another learner');
    assert.deepEqual(context.wordsData, []);
  } finally {
    oldTab.close();
    context.resetForUser?.();
    context.clearActivityTimers?.();
    window.close();
  }
});

test('a synchronous IndexedDB access error does not poison later open attempts', async () => {
  const storage = await import('../js/core/idb-manager.js?access-retry');
  globalThis.indexedDB = { open() { throw new DOMException('Storage denied', 'SecurityError'); } };
  await assert.rejects(storage.openIndexedDB(), { name: 'SecurityError' });
  globalThis.indexedDB = new IDBFactory();
  const db = await storage.openIndexedDB();
  assert.equal(db.version, storage.DB_VERSION);
  db.close();
});
