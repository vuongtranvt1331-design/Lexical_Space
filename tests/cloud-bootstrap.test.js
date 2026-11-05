import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { JSDOM, requestInterceptor } = require('jsdom');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');
const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');

async function waitFor(condition) {
  for (let i = 0; i < 160; i++) {
    if (condition()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.fail('Timed out waiting for startup state.');
}

test('the local application can start while optional CDN requests remain pending', async () => {
  // jsdom does not execute module scripts. Use a deferred classic script with
  // the same DOMContentLoaded startup path to exercise resource ordering.
  const markup = html.replace('type="module" src="./js/main.js"', 'defer src="./js/main.js"');
  const url = 'http://127.0.0.1:8780';
  const failsafeCode = await fs.readFile(new URL('../js/features/loading-failsafe.js', import.meta.url), 'utf8');
  let watchdog;
  const { window } = new JSDOM(markup, {
    url, runScripts: 'dangerously',
    beforeParse(window) {
      const set = window.setTimeout;
      window.setTimeout = (callback, delay, ...args) => {
        if (delay === 8000) { watchdog = callback; return 1; }
        return set(callback, delay, ...args);
      };
    },
    resources: { interceptors: [requestInterceptor(request => {
      const resource = new URL(request.url);
      if (resource.origin !== url) return new Promise(() => {});
      if (resource.pathname.endsWith('/loading-failsafe.js')) return new Response(failsafeCode);
      if (resource.pathname === '/js/main.js') return new Response(`document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('btn-login-submit').disabled = false;
        window.__lexicalSpaceReady = true;
      });`);
      return new Response('');
    })] }
  });
  try {
    await waitFor(() => window.__lexicalSpaceReady);
    assert.equal(typeof watchdog, 'function');
    watchdog();
    assert.equal(window.document.getElementById('btn-login-submit').disabled, false);
    assert.equal(window.document.getElementById('link-startup-reload').hidden, true);
  } finally { window.close(); }
});

test('local login is ready before Firebase loads, then late cloud startup opens the requested deck', async () => {
  const { window } = new JSDOM(html, { url: 'http://127.0.0.1:8780/?deck=delayed-deck', pretendToBeVisual: true });
  const { document, localStorage, sessionStorage } = window;
  Object.assign(globalThis, { window, document, localStorage, sessionStorage, indexedDB: new IDBFactory(), IDBKeyRange });
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
  const { context } = await import('../js/core/context.js');
  const $ = id => document.getElementById(id);
  try {
    await import('../js/features/application.js');
    await waitFor(() => window.__lexicalSpaceReady && ! $('btn-login-submit').disabled);
    assert.equal($('btn-continue-guest').disabled, false);
    assert.equal(context.db, null);
    const coreSdk = document.querySelector('script[src$="/firebase-app-compat.js"]');
    assert.ok(coreSdk);
    assert.equal(document.querySelector('script[src$="/firebase-firestore-compat.js"]'), null);
    assert.equal(await context.activateUser('Local learner'), true);
    assert.equal($('modal-login').hidden, true);
    assert.equal(window.location.search, '?deck=delayed-deck');

    globalThis.firebase = { apps: [], initializeApp() { this.apps.push({}); } };
    coreSdk.dispatchEvent(new window.Event('load'));
    await waitFor(() => document.querySelector('script[src$="/firebase-firestore-compat.js"]'));
    const subscriptions = [], db = {
      collection(name) {
        return {
          where: (_field, _op, username) => ({ onSnapshot() { subscriptions.push(username); return () => {}; } }),
          doc: id => ({ get: async () => ({
            exists: name === 'shared_decks' && id === 'delayed-deck',
            data: () => ({ deckId: id, title: 'Late deck', createdAt: 1, wordCount: 1, words: [{ word: 'local', vietnamese: 'địa phương' }] })
          }) })
        };
      }
    };
    globalThis.firebase.firestore = () => db;
    document.querySelector('script[src$="/firebase-firestore-compat.js"]').dispatchEvent(new window.Event('load'));
    await waitFor(() => !$('modal-import-deck').hidden && !$('btn-confirm-deck-import').disabled);
    assert.equal(context.db, db);
    assert.deepEqual(subscriptions, ['Local learner']);
    assert.equal($('import-deck-title').textContent, 'Late deck');
  } finally {
    delete globalThis.firebase;
    context.resetForUser?.();
    context.clearActivityTimers?.();
    window.close();
  }
});
