import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
Object.assign(globalThis, { indexedDB, IDBKeyRange });

const storage = await import('../js/core/idb-manager.js');
const {
  fetchSharedDeck, importSharedDeck, prepareShareDeck, previewDeckImport, publishSharedDeck
} = await import('../js/core/shared-decks.js');

const resilient = {
  word: 'Resilient', ipa: '/rɪˈzɪliənt/', pos: 'adj', vietnamese: 'kiên cường',
  example: 'She is resilient.', cloze: 'She is [ _____ ].', synonyms: ['adaptable'],
  collocations: ['highly resilient', 'resilient economy'], topics: ['People']
};
const deck = (deckId, title, words) => ({ deckId, title, createdAt: Date.now(), wordCount: words.length, words });

test('sharing selects one local profile and topic and exports only public vocabulary fields', async () => {
  await storage.idbPut('words', {
    username: 'Sender', id: 'reviewed', word: 'resilient', meaning: 'kiên cường', topic: 'People', topics: ['Review'],
    exampleSentence: 'She is resilient.', revision: 3, interval: 8, reviewCount: 4,
    lastReviewedAt: 200, successfulDays: ['2026-11-06'], isFavorite: true, cefr: 'B2', usageNotes: 'private'
  });
  await storage.mutateWords([
    { username: 'Sender', id: 'unrelated', patch: { word: 'other', meaning: 'khác', topic: 'Misc' } },
    { username: 'Different user', id: 'unrelated', patch: { word: 'foreign', meaning: 'xa lạ', topic: 'Review' } }
  ]);
  const payload = await prepareShareDeck('Sender', 'Review');
  assert.deepEqual(Object.keys(payload), ['deckId', 'title', 'createdAt', 'wordCount', 'words']);
  assert.equal(payload.wordCount, 1);
  assert.deepEqual(payload.words[0], {
    word: 'resilient', ipa: '', pos: '', vietnamese: 'kiên cường',
    example: 'She is resilient.', cloze: 'She is [ _____ ].', synonyms: [], collocations: [], topics: ['People', 'Review']
  });
  assert.notEqual((await prepareShareDeck('Sender', 'Review')).deckId, payload.deckId);
});

test('import merges spelling matches, fills blank context, and creates fresh cards without sender progress', async () => {
  const reviewed = {
    word: ' resilient ', meaning: 'kiên cường', topic: 'My words', topics: ['Favorites from class'],
    status: 'learning', interval: 6, repetition: 2, easeFactor: 2.7, reviewCount: 5,
    dueDate: '2026-11-09T00:00:00.000Z', lastReviewedAt: 12345, isFavorite: true, successfulDays: ['2026-11-06']
  };
  await storage.mutateWords([
    { username: 'Receiver', id: 'a-meaning', patch: { word: 'resilient', meaning: 'different sense', topic: 'Other sense' } },
    { username: 'Receiver', id: 'b-progress', patch: reviewed }
  ]);
  const payload = deck('vocab-1', 'Shared topic', [resilient, {
    ...resilient, word: ' RESILIENT ', topics: ['Class notes']
  }, {
    word: 'adjust', vietnamese: 'điều chỉnh', topics: ['People']
  }]);
  assert.deepEqual(await previewDeckImport('Receiver', payload), { added: 1, merged: 1, unchanged: 0, alreadyImported: false });
  assert.deepEqual(await importSharedDeck('Receiver', payload), { added: 1, merged: 1, unchanged: 0, alreadyImported: false });
  const words = await storage.readUserWords('Receiver');
  const existing = words.find(word => word.id === 'b-progress');
  const fresh = words.find(word => word.word === 'adjust');
  assert.equal(words.length, 3);
  assert.deepEqual(existing.topics, ['My words', 'Favorites from class', 'Shared topic', 'People', 'Class notes']);
  assert.equal(existing.exampleSentence, resilient.example);
  assert.equal(existing.clozeSentence, resilient.cloze);
  assert.deepEqual(existing.collocations, resilient.collocations);
  for (const field of ['status', 'interval', 'repetition', 'easeFactor', 'reviewCount', 'dueDate', 'lastReviewedAt', 'successfulDays', 'isFavorite']) {
    assert.deepEqual(existing[field], reviewed[field]);
  }
  assert.deepEqual(words.find(word => word.id === 'a-meaning').topics, ['Other sense']);
  assert.deepEqual(fresh.topics, ['Shared topic', 'People']);
  assert.deepEqual([fresh.status, fresh.repetition, fresh.interval, fresh.easeFactor, fresh.dueDate], ['new', 0, 0, 2.5, null]);
  assert.equal((await storage.pendingOperations('Receiver')).length, 4);
  assert.equal((await previewDeckImport('Receiver', payload)).alreadyImported, true);
  assert.equal((await previewDeckImport('Different user', payload)).alreadyImported, false);
  await storage.mutateWords([{ username: 'Receiver', id: fresh.id, type: 'DELETE' }]);
  assert.deepEqual(await previewDeckImport('Receiver', payload), { added: 0, merged: 0, unchanged: 1, missing: 1, alreadyImported: true });
});

test('concurrent imports do not duplicate words or import history', async () => {
  const one = deck('race-1', 'Deck One', [resilient]);
  const two = deck('race-2', 'Deck Two', [{ ...resilient, word: 'resilient', example: 'A resilient rival.', collocations: ['a resilient rival'] }]);
  const [first, replay, overlapping] = await Promise.all([
    importSharedDeck('Race', one), importSharedDeck('Race', one), importSharedDeck('Race', two)
  ]);
  assert.equal(first.added, 1);
  assert.equal(replay.alreadyImported, true);
  assert.equal(overlapping.merged, 1);
  const [word] = await storage.readUserWords('Race');
  assert.equal((await storage.readUserWords('Race')).length, 1);
  assert.equal(word.exampleSentence, resilient.example);
  assert.deepEqual(word.collocations, resilient.collocations);
  assert.deepEqual(word.topics, ['Deck One', 'People', 'Deck Two']);
  assert.equal((await storage.pendingOperations('Race')).length, 2);
});

test('shared example attribution follows the matching sentence and is exported again', async () => {
  await storage.mutateWords([{
    username: 'Source recipient', id: 'existing', patch: {
      word: 'resilient', meaning: 'kiên cường', exampleSentence: 'The town proved resilient.'
    }
  }]);
  const payload = deck('attributed-example', 'Sourced deck', [
    { ...resilient, exampleSourceId: 13247655 },
    { word: 'adapt', vietnamese: 'thích nghi', example: 'We adapt.', exampleSourceId: 98765 }
  ]);
  await assert.rejects(previewDeckImport('Source recipient', {
    ...payload, words: [{ ...payload.words[0], exampleSourceId: 'https://example.com/' }, payload.words[1]]
  }), /Invalid example source/);
  await importSharedDeck('Source recipient', payload);
  const exported = await prepareShareDeck('Source recipient', payload.title);
  const existing = exported.words.find(word => word.word === 'resilient');
  const added = exported.words.find(word => word.word === 'adapt');
  assert.equal(existing.example, 'The town proved resilient.');
  assert.equal(existing.exampleSourceId, undefined);
  assert.equal(added.example, 'We adapt.');
  assert.equal(added.exampleSourceId, 98765);
});

test('a failed outbox write rolls back the word and import marker', async () => {
  const payload = deck('failed-import', 'Deck', [resilient]);
  const sequence = await storage.idbGet('metadata', '_outbox_sequence');
  await storage.idbPut('metadata', { key: '_outbox_sequence', value: sequence - 1 });
  try {
    await assert.rejects(importSharedDeck('Rollback', payload));
    assert.deepEqual(await storage.readUserWords('Rollback'), []);
    assert.deepEqual(await storage.pendingOperations('Rollback'), []);
    assert.equal((await previewDeckImport('Rollback', payload)).alreadyImported, false);
  } finally {
    await storage.idbPut('metadata', { key: '_outbox_sequence', value: sequence });
  }
});

test('six-digit codes retry collisions and preserve deck identity independently of the code', async () => {
  const records = new Map();
  globalThis.firebase = {firestore:{FieldValue:{serverTimestamp:()=>new Date()}}};
  let writes = 0;
  const db = {collection(name) {
    assert.equal(name, 'shared_decks');
    return {doc: id => ({
      async set(data) {
        if (!writes++) throw Object.assign(Error('Code reserved'), {code:'permission-denied'});
        records.set(id,data);
      },
      async get(options) {
        assert.equal(options.source,'server');
        return {exists: records.has(id),data:()=>records.get(id)};
      }
    })};
  }};
  const payload = deck('public-deck', 'Deck', [resilient]);
  const code = await publishSharedDeck(db,payload);
  assert.match(code,/^\d{6}$/);
  assert.equal(writes,2);
  assert.deepEqual(await fetchSharedDeck(db, code), payload);
  await assert.rejects(fetchSharedDeck(db,'invalid'), /six digits/);
  await assert.rejects(publishSharedDeck(db, { ...payload, words: [{ ...resilient, reviewCount: 3 }] }), /invalid card/);
  await assert.rejects(publishSharedDeck(db, { ...payload, title: 'All' }), /reserved topic/);
  await assert.rejects(publishSharedDeck(db, { ...payload, words: [{ ...resilient, topics: ['FAVORITES'] }] }), /reserved topic/);
  const largeWords = Array.from({ length: 400 }, (_, index) => ({
    ...resilient, word: `word ${index}`, vietnamese: 'a'.repeat(2000), example: 'x'.repeat(2000)
  }));
  await assert.rejects(publishSharedDeck(db, deck('oversized', 'Large', largeWords)), /too large/);
});
