import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAIPrompt, parseAIBatch, validateAIWord } from '../js/core/ai-vocabulary.js';
import { dictionaryDetails, quickFillCollocations, quickFillSentence, translateQuickFillWord } from '../js/core/quick-fill.js';
const word = { word: 'resilient', phonetic: '/rɪˈzɪliənt/', pos: 'adj', meaning: 'kiên cường',
  collocations: ['highly resilient', 'resilient community'], synonyms: ['hardy', 'adaptable'],
  exampleSentence: 'A resilient community can recover.', clozeSentence: 'A [ _____ ] community can recover.' };
const response = data => ({ ok: true, status: 200, json: async () => data });
test('batch prompt contains the user list and exact JSON schema; copied generation never needs an API key', () => {
  const prompt = buildAIPrompt('1. resilient\n- give up'); assert.ok(prompt.includes('["resilient","give up"]'));
  assert.ok(prompt.includes('"additionalProperties": false')); assert.ok(prompt.includes('"clozeSentence"')); assert.ok(prompt.includes('[ _____ ]'));
  assert.doesNotMatch(prompt, /cefr/i);
  assert.throws(() => buildAIPrompt(''), /Enter your word list/);
});
test('strict JSON rejects wrong shapes, cloze leaks, unwanted SRS fields and incomplete batches', () => {
  assert.equal(validateAIWord(word).valid, true);
  assert.throws(() => parseAIBatch(JSON.stringify({ ...word })), /array/);
  assert.throws(() => parseAIBatch(JSON.stringify([{ ...word, collocations: 'not an array' }])), /array of nonempty strings/);
  assert.throws(() => parseAIBatch(JSON.stringify([{ ...word, interval: 100 }])), /Unknown field interval/);
  assert.throws(() => parseAIBatch(JSON.stringify([{ ...word, clozeSentence: 'A resilient [ _____ ].' }])), /Cloze/);
  assert.throws(() => parseAIBatch(JSON.stringify([word]), 'resilient\nrecall'), /Missing requested word: recall/);
  assert.throws(() => parseAIBatch(JSON.stringify([word, word])), /Duplicate word and sense/);
  const [valid] = parseAIBatch('```json\n' + JSON.stringify([word]) + '\n```', 'resilient');
  assert.equal(valid.clozeSentence, word.clozeSentence); assert.deepEqual(valid.synonyms, word.synonyms);
  const [legacy] = parseAIBatch(JSON.stringify([{ ...word, cefr: 'B2' }]), 'resilient');
  assert.equal(Object.hasOwn(legacy, 'cefr'), false);
});
test('Free Dictionary prefers British IPA, uses the first part of speech and masks inflections in the first example', async () => {
  const info = await dictionaryDetails('adapt', { fetcher: async (url, options) => {
    assert.equal(url, 'https://api.dictionaryapi.dev/api/v2/entries/en/adapt');
    assert.equal(options.credentials, 'omit');
    return response([{ phonetic: '/top-level/', phonetics: [{ text: '/us/', locale: 'en-US' },
      { text: '/uk/', audio: '//example.com/adapt-uk.mp3' }], meanings: [
      { partOfSpeech: 'verb', synonyms: ['adjust', 'ADJUST', 'adapt'], definitions: [{ example: 'An unusable sentence.', synonyms: ['acclimate', 'modify'] },
        { example: 'They adapted quickly and continue to adapt.', synonyms: ['tailor', 'change'] }] },
      { partOfSpeech: 'noun', definitions: [{ example: 'Do not pick this later example.' }] }
    ] }]);
  } });
  assert.deepEqual(info, { phonetic: '/uk/', pos: 'v', synonyms: ['adjust', 'acclimate', 'modify', 'tailor'],
    exampleSentence: 'They adapted quickly and continue to adapt.', clozeSentence: 'They [ _____ ] quickly and continue to [ _____ ].' });
});

test('dictionary lookups encode phrases, report missing entries, and never create an answer-revealing cloze', async () => {
  const info = await dictionaryDetails('give up', { fetcher: async url => {
    assert.equal(url, 'https://api.dictionaryapi.dev/api/v2/entries/en/give%20up');
    return response([{ phonetic: '/top-level/', phonetics: [{ text: '/first/' }],
      meanings: [{ partOfSpeech: 'phrasal verb', definitions: [{ example: 'This context has no target word.' }] }] }]);
  } });
  assert.equal(info.phonetic, '/first/');
  assert.equal(info.pos, 'v');
  assert.equal(info.clozeSentence, '');
  assert.equal(await dictionaryDetails('missing', { fetcher: async () => ({ ok: false, status: 404 }) }), null);
  assert.equal(await dictionaryDetails('missing', { fetcher: async () => response([]) }), null);
});

test('Tatoeba returns an attributable English example only when the word and its inflections can be masked', async () => {
  const info = await quickFillSentence('give up', { fetcher: async (url, options) => {
    assert.equal(url, 'https://api.tatoeba.org/v1/sentences?lang=eng&q=give%20up&sort=relevance&is_unapproved=no&limit=10');
    assert.equal(options.credentials, 'omit');
    return response({ data: [
      { id: '2', text: 'We never give up.' },
      { id: 3, lang: 'fra', text: 'I give up.' },
      { id: 4, text: 'We never [ _____ ].' },
      { id: 5, text: 'They asked me to give updates.' },
      { id: 6, text: 'Give up.' },
      { id: 12345, lang: 'eng', text: '  They gave up but we will never give up.  ' }
    ] });
  } });
  assert.deepEqual(info, { exampleSentence: 'They gave up but we will never give up.',
    clozeSentence: 'They [ _____ ] but we will never [ _____ ].', exampleSourceId: 12345 });
  assert.equal(await quickFillSentence('missing', { fetcher: async () => response({ data: [] }) }), null);
  assert.equal(await quickFillSentence('missing', { fetcher: async () => ({ ok: false, status: 503 }) }), null);
});

test('MyMemory and Datamuse request no credentials and ignore quota or malformed results', async () => {
  const translated = await translateQuickFillWord('give up', { fetcher: async url => {
    assert.equal(url, 'https://api.mymemory.translated.net/get?q=give%20up&langpair=en|vi');
    return response({ responseStatus: 200, responseData: { translatedText: 'translation' } });
  } });
  assert.equal(translated, 'translation');
  const quota = await translateQuickFillWord('resilient', { fetcher: async () => response({
    responseStatus: '429', responseData: { translatedText: 'Quota exceeded' }
  }) });
  assert.equal(quota, '');
  const pairs = await quickFillCollocations('resilient', 'adj', { fetcher: async url => {
    assert.equal(url, 'https://api.datamuse.com/words?rel_jja=resilient&max=3');
    return response([{ word: 'community' }, { word: 'Community' }, { word: null }, { word: 'systems' }, { word: 'children' }, { word: 'people' }]);
  } });
  assert.deepEqual(pairs, ['resilient community', 'resilient systems', 'resilient children']);
  assert.deepEqual(await quickFillCollocations('give up', 'v', { fetcher: async url => {
    assert.equal(url, 'https://api.datamuse.com/words?rel_bga=give%20up&max=3');
    return response({ error: 'Unavailable' });
  } }), []);
});

test('aborting Quick Fill also interrupts a provider whose response never settles', async () => {
  const controller = new AbortController();
  const pending = dictionaryDetails('adapt', { signal: controller.signal, fetcher: () => new Promise(() => {}) });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
