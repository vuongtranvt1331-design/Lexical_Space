import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
Object.assign(globalThis, { indexedDB, IDBKeyRange });

test('French bootstraps existing words once and syncs only its own library after reconnect', async () => {
  globalThis.document = { documentElement: { dataset: { suiteModule: 'lexical' } } };
  let currentLanguage = 'fr', online = false;
  globalThis.localStorage = { getItem: () => currentLanguage };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { get onLine() { return online; } } });
  const storage = await import('../js/core/idb-manager.js');
  const { canSyncProfile } = await import('../js/core/context.js');
  const { flushMutationOutbox } = await import('../js/core/firebase-sync.js');
  const username = 'Language fixture';
  assert.equal(storage.DB_NAME, 'LexicalSpaceFrenchDB');
  currentLanguage = 'en';
  assert.equal(canSyncProfile(username), true);
  assert.equal(canSyncProfile('Guest'), false);

  const existing = { id:'bonjour', username, word:'bonjour', meaning:'xin chào', revision:2, updatedAt:123, reviewCount:3 };
  await storage.idbPut('words', existing);
  await storage.idbPut('words', { ...existing, id:'salut', word:'salut' });
  await storage.idbPut('words', { ...existing, id:'other', username:'Other profile' });
  await storage.mutateWords([{username, id:'merci', type:'UPSERT', patch:{word:'merci', meaning:'cảm ơn'}}]);
  const cloud = new Map([
    ['words/bonjour', { ...existing, word:'hello', revision:99 }],
    ['words_fr/bonjour', { ...existing, revision:3, reviewCount:4 }]
  ]);
  let unavailable = true;
  const db = {
    collection: name => ({ doc: id => name + '/' + id }),
    async runTransaction(run) {
      if (unavailable) throw new Error('offline');
      return run({
        async get(path) { return { id:path.split('/').at(-1), exists:cloud.has(path), data:()=>cloud.get(path) }; },
        set(path, data, options) { cloud.set(path, options?.merge ? { ...cloud.get(path), ...data } : data); }
      });
    }
  };
  await flushMutationOutbox({db, username});
  assert.equal((await storage.pendingOperations(username)).length, 1);
  online = true;
  await assert.rejects(flushMutationOutbox({db, username}), /offline/);
  await assert.rejects(flushMutationOutbox({db, username}), /offline/);
  assert.equal((await storage.pendingOperations(username)).length, 3, 'existing words were queued once');
  unavailable = false;
  await flushMutationOutbox({db, username});
  assert.deepEqual(await storage.pendingOperations(username), []);
  assert.equal((await storage.readUserWord(username, 'bonjour')).reviewCount, 4);
  assert.equal(cloud.get('words_fr/salut').reviewCount, 3);
  assert.equal(cloud.get('words_fr/merci').word, 'merci');
  assert.equal(cloud.get('words/bonjour').word, 'hello');
  assert.equal(cloud.has('words_fr/other'), false);
  assert.equal(cloud.has('metadata/userWordStats_v3:Language%20fixture'), false);
  assert.deepEqual((await indexedDB.databases()).map(db=>db.name), ['LexicalSpaceFrenchDB']);

  const { createPronunciationController } = await import('../js/core/pronunciation.js');
  const remoteFrench = { lang:'fr-FR', localService:false }, english = { lang:'en-GB', localService:true };
  let voices = [english, remoteFrench];
  const spoken = [];
  const audio = createPronunciationController({
    speech:{ getVoices:()=>voices, speak:utterance=>spoken.push(utterance), cancel() {} },
    Utterance:class { constructor(text) { this.text = text; } },
    fetcher:()=>assert.fail('French speech must bypass the English dictionary')
  });
  await audio.say('bonjour');
  assert.equal(spoken[0].voice, remoteFrench);
  voices = [];
  assert.equal(audio.sayExample('Je vais à l’école.'), true);
  assert.equal(spoken[1].lang,'fr-FR');
  assert.equal(spoken[1].text,'Je vais à l’école.');
});

test('teacher and Arcade consumers keep the shared English database preference', async () => {
  globalThis.document = { documentElement: { dataset: {} } };
  globalThis.localStorage = { getItem: () => 'fr' };
  const language = await import('../js/core/study-language.js?teacher-fixture');
  assert.equal(language.studyLanguage, 'en');
});
