import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAIPrompt, parseAIBatch, validateAIWord } from '../js/core/ai-vocabulary.js';
import { dictionaryDetails, quickFillCollocations, quickFillSentence, translateQuickFillWord } from '../js/core/quick-fill.js';
const word = { word: 'resilient', phonetic: '/rɪˈzɪliənt/', pos: 'adj', meaning: 'kiên cường',
  collocations: ['highly resilient', 'resilient community'], synonyms: ['hardy', 'adaptable'],
  exampleSentence: 'A resilient community can recover.', clozeSentence: 'A [ _____ ] community can recover.' };
const response = data => ({ ok: true, status: 200, json: async () => data });
test('batch prompt contains the user list and a short JSON example; generation needs no API key', () => {
  const prompt = buildAIPrompt('1. resilient\n- give up'); assert.ok(prompt.includes('["resilient","give up"]'));
  assert.match(prompt, /Only word and meaning are required/);
  assert.ok(prompt.includes('"clozeSentence"')); assert.ok(prompt.includes('[ _____ ]'));
  assert.match(prompt, /\bvocabulary\.json\b/i);
  const sample = prompt.split('FORMAT EXAMPLE (do not add this term unless it appears in WORD LIST):\n')[1]
    ?.split('\nWORD LIST (JSON data):')[0];
  assert.ok(sample);
  assert.ok(Array.isArray(JSON.parse(sample)));
  assert.equal(parseAIBatch(sample).length, 1);
  assert.doesNotMatch(prompt, /cefr/i);
  assert.throws(() => buildAIPrompt(''), /Enter your word list/);
});
test('strict JSON rejects wrong shapes, unwanted SRS fields and incomplete batches', () => {
  assert.equal(validateAIWord(word).valid, true);
  assert.throws(() => parseAIBatch(JSON.stringify({ metadata: true })), /array/);
  assert.throws(() => parseAIBatch(JSON.stringify([{ ...word, collocations: 'not an array' }])), /array of nonempty strings/);
  assert.throws(() => parseAIBatch(JSON.stringify([{ ...word, interval: 100 }])), /Unknown field interval/);
  assert.throws(() => parseAIBatch(JSON.stringify([{ ...word, clozeSentence: ['[ _____ ]'] }])), /clozeSentence.*string/i);
  assert.throws(() => parseAIBatch(JSON.stringify([{ ...word, exampleSentence: 'The community can recover.' }])), /example.*target/i);
  assert.throws(() => parseAIBatch(JSON.stringify([word]), 'resilient\nrecall'), /Missing requested word: recall/);
  assert.throws(() => parseAIBatch(JSON.stringify([word, word])), /Duplicate word and sense/);
  const [valid] = parseAIBatch('```json\n' + JSON.stringify([word]) + '\n```', 'resilient');
  assert.equal(valid.clozeSentence, word.clozeSentence); assert.deepEqual(valid.synonyms, word.synonyms);
  const [legacy] = parseAIBatch(JSON.stringify([{ ...word, cefr: 'B2' }]), 'resilient');
  assert.equal(Object.hasOwn(legacy, 'cefr'), false);
});

test('one words wrapper and common AI aliases produce canonical vocabulary fields', () => {
  const portable = { word: word.word, ipa: word.phonetic, partOfSpeech: 'Adjective', vietnamese: word.meaning,
    collocations: word.collocations, example: word.exampleSentence, cloze: word.clozeSentence };
  const [record] = parseAIBatch(JSON.stringify({ words: [portable] }), word.word);
  for (const key of ['word', 'phonetic', 'pos', 'meaning', 'collocations', 'exampleSentence', 'clozeSentence']) {
    assert.deepEqual(record[key], word[key]);
  }
  assert.deepEqual(record.synonyms, []);
  for (const key of ['ipa', 'partOfSpeech', 'vietnamese', 'example', 'cloze']) assert.equal(Object.hasOwn(record, key), false);
  assert.throws(() => parseAIBatch(JSON.stringify({ words: { words: [portable] } })), /array|words/i);
  assert.throws(() => parseAIBatch(JSON.stringify({ words: [portable] }), 'resilient\nadapt'), /Missing requested word: adapt/);
});

test('optional fields default and cloze is derived from the example without leaking the target', () => {
  const { phonetic, synonyms, clozeSentence, ...minimum } = word;
  const [withoutOptional, withBadCloze] = [minimum, { ...word, clozeSentence: 'A resilient [ _____ ].' }]
    .map(input => parseAIBatch(JSON.stringify([input]), word.word)[0]);
  assert.equal(withoutOptional.phonetic, '');
  assert.deepEqual(withoutOptional.synonyms, []);
  assert.equal(withoutOptional.clozeSentence, clozeSentence);
  assert.equal(withBadCloze.clozeSentence, clozeSentence);
  assert.throws(() => parseAIBatch(JSON.stringify([{ ...minimum, phonetic: false }])), /phonetic.*string/i);
  assert.throws(() => parseAIBatch(JSON.stringify([{ ...minimum, synonyms: null }])), /synonyms.*array/i);
});

test('conflicting aliases are rejected instead of silently choosing one value', () => {
  assert.throws(() => parseAIBatch(JSON.stringify([{ ...word, partOfSpeech: 'noun' }])), /conflict.*(?:pos|partOfSpeech)|(?:pos|partOfSpeech).*conflict/i);
  assert.throws(() => parseAIBatch(JSON.stringify([{ ...word, vietnamese: 'một nghĩa khác' }])), /conflict.*(?:meaning|vietnamese)|(?:meaning|vietnamese).*conflict/i);
});

const withStrayWordSlash = records => JSON.stringify(records, null, 2)
  .replace('"word": "resilient",', String.raw`"word": "resilient\",`);

test('a CRLF paste repairs the stray word slash without modifying valid JSON escapes', () => {
  const usageNotes = String.raw`The entry contains a literal backslash \ and the word "example".`;
  const literal = { ...word, word: 'path\\', exampleSentence: 'We typed path\\ in the note.',
    clozeSentence: 'We typed [ _____ ] in the note.' };
  const paste = withStrayWordSlash([{ ...word, usageNotes }, literal]).replaceAll('\n', '\r\n');
  const repairs = [];
  assert.throws(() => JSON.parse(paste), SyntaxError);

  const [repaired, unchanged] = parseAIBatch(paste, 'resilient\npath\\', { onRepair: count => repairs.push(count) });
  assert.equal(repaired.word, 'resilient');
  assert.equal(repaired.usageNotes, usageNotes);
  assert.equal(unchanged.word, literal.word);
  assert.equal(unchanged.exampleSentence, literal.exampleSentence);
  assert.deepEqual(repairs, [1]);
});

test('a possible repair still needs valid rows and the complete requested word list', () => {
  const repairs = [], options = { onRepair: count => repairs.push(count) };
  assert.throws(() => parseAIBatch(withStrayWordSlash([{ ...word, pos: 'invalid' }]), 'resilient', options), /Row 1:.*part of speech/i);
  assert.throws(() => parseAIBatch(withStrayWordSlash([word]), 'resilient\nadapt', options), /Missing requested word: adapt/);
  assert.deepEqual(repairs, []);
});

test('unrecoverable syntax preserves the native JSON diagnostic', () => {
  const malformed = JSON.stringify([word], null, 2).replace('"pos": "adj",', String.raw`"pos": "adj\",`);
  const repairs = [];
  let nativeMessage;
  assert.throws(() => JSON.parse(malformed), error => {
    nativeMessage = error.message;
    return error instanceof SyntaxError;
  });
  assert.throws(() => parseAIBatch(malformed, '', { onRepair: count => repairs.push(count) }),
    error => /Invalid JSON/i.test(error.message) && error.message.includes(nativeMessage));
  assert.deepEqual(repairs, []);
});

test('one explicit JSON fence can be pasted with surrounding prose', () => {
  const fenced = '```json\n' + JSON.stringify([word], null, 2) + '\n```';
  const [record] = parseAIBatch('Here is [your vocabulary].\n' + fenced + '\nI hope this helps.', 'resilient');
  assert.equal(record.word, word.word);
  assert.throws(() => parseAIBatch('First draft:\n' + fenced + '\nSecond draft:\n' + fenced), /Invalid JSON/i);
});

test('the seven-word clipboard paste is repaired without changing data in JSON strings', () => {
  const terms = ['see', 'chair', 'fox', 'rice', 'we', 'have', 'some'];
  const meanings = ['nhìn thấy', 'cái ghế', 'con cáo', 'gạo', 'chúng tôi', 'có', 'một vài'];
  const words = terms.map((word, i) => ({ word, meaning: meanings[i] }));
  words[0].exampleSentence = 'I can see the mountains from my bedroom window.';
  words[0].usageNotes = 'Keep "quotes", a slash \\, and literal &#x20; text.';
  const lines = JSON.stringify(words, null, 2).split('\n');
  const raw = lines.map((line, i) => (i && i < lines.length - 1 ? '&#x20; ' : '') +
    line + (i < lines.length - 1 ? '\\' : '')).join('\r\n');
  let cleaned = false;
  const cards = parseAIBatch(raw, terms.join('\n'), { onCleanup: () => { cleaned = true; } });
  assert.equal(cleaned, true);
  assert.deepEqual(cards.map(card => [card.word, card.meaning]), terms.map((term, i) => [term, meanings[i]]));
  assert.equal(cards[0].clozeSentence, 'I can [ _____ ] the mountains from my bedroom window.');
  assert.equal(cards[0].usageNotes, words[0].usageNotes);
});

test('accepts common wrappers, aliases, comma lists and trailing commas without modifying strings', () => {
  const raw = '{"vocabulary":[{"word":"fox","translation":"con cáo,}",' +
    '"part_of_speech":"noun","collocations":"red fox; wild fox",},],}';
  const [fox] = parseAIBatch('Here is the result.\n~~~\n' + raw + '\n~~~');
  assert.equal(fox.meaning, 'con cáo,}');
  assert.equal(fox.pos, 'n');
  assert.deepEqual(fox.collocations, ['red fox', 'wild fox']);
  assert.equal(parseAIBatch(JSON.stringify(JSON.stringify({ word: 'fox', meaning: 'con cáo' })))[0].word, 'fox');
  assert.throws(() => parseAIBatch('{"words":[{}],"cards":[{}]}'), /array/);
});

test('partial preview reports invalid and missing entries and excludes unexpected entries', () => {
  const raw = JSON.stringify([word, { word: 'fox', meaning: 'con cáo' }, { word: 'chair' }]);
  const issues = [];
  const cards = parseAIBatch(raw, 'resilient\nchair', { onIssues: errors => issues.push(...errors) });
  assert.deepEqual(cards.map(card => card.word), ['resilient']);
  assert.match(issues.join('\n'), /Row 2: Unexpected word: fox/);
  assert.match(issues.join('\n'), /Row 3: Missing meaning/);
  assert.match(issues.join('\n'), /Missing requested word: chair/);
  assert.throws(() => parseAIBatch('[{"word":"chair"}]', 'chair', { onIssues: () => assert.fail() }), /Missing meaning/);
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

test('dictionary synonyms include later matching POS entries and omit unrelated parts of speech', async () => {
  const details = await dictionaryDetails('record', { pos: 'n', fetcher: async () => response([
    { meanings: [
      { partOfSpeech: 'verb', synonyms: ['register'], definitions: [{ example: 'We record the sound.' }] },
      { partOfSpeech: 'noun', synonyms: [], definitions: [] },
      { partOfSpeech: 'noun', synonyms: ['account'], definitions: [{ synonyms: ['report'], example: 'Keep a record of the visit.' }] }
    ] }
  ]) });
  assert.equal(details.pos, 'n');
  assert.deepEqual(details.synonyms, ['account', 'report']);
  assert.equal(details.exampleSentence, 'Keep a record of the visit.');
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
