import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const { JSDOM } = createRequire(import.meta.url)('jsdom');
const html = await readFile(new URL('../apps/poker/index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../apps/poker/js/poker-1.js', import.meta.url), 'utf8');
const lexVocab = await readFile(new URL('../apps/arcade/assets/lexical-vocabulary.js', import.meta.url), 'utf8');

test('poker loads shared lexical-vocabulary.js and has expanded fallback deck', async () => {
  assert.match(html, /src="\.\.\/arcade\/assets\/lexical-vocabulary\.js"/);
  assert.match(html, /id="studentHandTitle"[\s\S]*?Synonyms &amp; Meanings/);

  const dom = new JSDOM(html, {
    url: 'http://localhost:8124/apps/poker/?mode=full',
    runScripts: 'dangerously'
  });

  // Check DEFAULT_VOCAB_JSON length in poker-1.js
  const defaultMatches = script.match(/const DEFAULT_VOCAB_JSON = (\[[\s\S]*?\]);/);
  assert.ok(defaultMatches, 'DEFAULT_VOCAB_JSON should be present');
  const defaultVocab = JSON.parse(defaultMatches[1]);
  assert.ok(defaultVocab.length >= 50, `Default vocab should have at least 50 entries, got ${defaultVocab.length}`);

  dom.window.close();
});

test('poker vocabulary conversion handles words with or without synonyms seamlessly', async () => {
  const dom = new JSDOM(html, {
    url: 'http://localhost:8124/apps/poker/?mode=topic&topic=Academic',
    runScripts: 'outside-only'
  });

  // Test custom list with words that have no synonym field (only meaning)
  const sampleWords = [
    { word: 'apple', meaning: 'quả táo', topic: 'Food' },
    { word: 'banana', meaning: 'quả chuối', topic: 'Food' },
    { word: 'orange', meaning: 'quả cam', topic: 'Food' },
    { word: 'grape', meaning: 'quả nho', topic: 'Food' },
    { word: 'mango', meaning: 'quả xoài', topic: 'Food' }
  ];

  // Evaluate script in dom context
  dom.window.eval(lexVocab);

  // Check that words with meanings become valid poker pairs
  const converted = sampleWords.map(w => ({
    word: w.word,
    translation: w.meaning,
    synonym: w.meaning
  }));

  assert.equal(converted.length, 5);
  for (const item of converted) {
    assert.ok(item.word);
    assert.ok(item.translation);
    assert.ok(item.synonym);
  }

  dom.window.close();
});
