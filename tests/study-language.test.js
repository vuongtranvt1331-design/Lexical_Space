import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
Object.assign(globalThis, { indexedDB, IDBKeyRange });

test('a French page never queues student words for sync, even when another tab switches to English', async () => {
  globalThis.document = { documentElement: { dataset: { suiteModule: 'lexical' } } };
  let currentLanguage = 'fr';
  globalThis.localStorage = { getItem: () => currentLanguage };
  const storage = await import('../js/core/idb-manager.js');
  const { canSyncProfile } = await import('../js/core/context.js');
  const { flushMutationOutbox } = await import('../js/core/firebase-sync.js');
  const username = 'Language fixture';
  assert.equal(storage.DB_NAME, 'LexicalSpaceFrenchDB');
  currentLanguage = 'en';
  assert.equal(canSyncProfile(username), false);
  await storage.mutateWords([{username, id:'bonjour', type:'UPSERT', patch:{word:'bonjour', meaning:'xin chào'}}]);
  assert.equal((await storage.readUserWords(username))[0].word, 'bonjour');
  assert.deepEqual(await storage.pendingOperations(username), []);
  await flushMutationOutbox({db:new Proxy({}, {get:()=>assert.fail('French sync touched Firestore')}), username});
  assert.deepEqual((await indexedDB.databases()).map(db=>db.name), ['LexicalSpaceFrenchDB']);
});

test('teacher and Arcade consumers keep the shared English database preference', async () => {
  globalThis.document = { documentElement: { dataset: {} } };
  globalThis.localStorage = { getItem: () => 'fr' };
  const language = await import('../js/core/study-language.js?teacher-fixture');
  assert.equal(language.studyLanguage, 'en');
});
