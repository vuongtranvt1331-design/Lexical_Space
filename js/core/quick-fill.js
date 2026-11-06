import { exampleSourceUrl, normalizePartOfSpeech, normalizeTerm } from './vocabulary.js';
import { clozeText } from './recall-utils.js';
import { isBritishPronunciation } from './pronunciation.js';

export const DICTIONARY_NOT_FOUND = 'Word not found in free dictionary.';
const LOOKUP_TIMEOUT = 4000;
const list = value => Array.isArray(value) ? value : [];
const clean = value => typeof value === 'string' ? value.trim() : '';

function uniqueTerms(items, target, limit) {
  const seen = new Set([normalizeTerm(target)]), result = [];
  for (const item of items) {
    const term = clean(item), key = normalizeTerm(term);
    if (!term || term.length > 200 || /[,;]/.test(term) || seen.has(key)) continue;
    seen.add(key);
    result.push(term);
    if (result.length === limit) break;
  }
  return result;
}

async function request(url, { signal, fetcher = globalThis.fetch } = {}) {
  signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT);
  let interrupted;
  const cancellation = new Promise((_, reject) => {
    interrupted = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', interrupted, { once: true });
  });
  try {
    const fetchData = async () => {
      const response = await fetcher(url, { signal: controller.signal, credentials: 'omit' });
      return { ok: response.ok, status: response.status, data: response.ok ? await response.json() : null };
    };
    return await Promise.race([fetchData(), cancellation]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', interrupted);
  }
}

function exampleCloze(example, word) {
  if (example.includes('[ _____ ]')) return '';
  const cloze = clozeText(example, word, { inflections: true });
  return cloze !== example && cloze.length <= 2000 && /\p{L}/u.test(cloze) ? cloze : '';
}

export async function dictionaryDetails(word, options) {
  const { ok, status, data } = await request('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word), options);
  if (status === 404) return null;
  if (!ok || !Array.isArray(data)) throw new Error('Free Dictionary could not be reached.');
  if (!data.length) return null;
  const meanings = data.flatMap(entry => list(entry?.meanings));
  const meaning = meanings[0];
  const phonetics = data.flatMap(entry => list(entry?.phonetics));
  const ipa = phonetics.find(item => clean(item?.text) && isBritishPronunciation(item))?.text ||
    phonetics.find(item => clean(item?.text))?.text || data.map(entry => entry?.phonetic).find(value => clean(value));
  const synonyms = uniqueTerms([...list(meaning?.synonyms), ...list(meaning?.definitions).flatMap(item => list(item?.synonyms))], word, 4);
  const examples = meanings.flatMap(item => list(item?.definitions)).map(item => clean(item?.example))
    .filter(example => example && example.length <= 2000);
  const pair = examples.map(exampleSentence => ({ exampleSentence, clozeSentence: exampleCloze(exampleSentence, word) }))
    .find(example => example.clozeSentence);
  return { phonetic: clean(ipa).slice(0, 200), pos: normalizePartOfSpeech(meaning?.partOfSpeech), synonyms,
    ...(pair || { exampleSentence: examples[0] || '', clozeSentence: '' }) };
}

export async function quickFillSentence(word, options) {
  const { data } = await request(`https://api.tatoeba.org/v1/sentences?lang=eng&q=${encodeURIComponent(word)}&sort=relevance&is_unapproved=no&limit=10`, options);
  for (const sentence of list(data?.data)) {
    const exampleSourceId = sentence?.id;
    const exampleSentence = clean(sentence?.text);
    if (!exampleSourceUrl(exampleSourceId) || !exampleSentence || exampleSentence.length > 2000 ||
      (sentence.lang != null && sentence.lang !== 'eng')) continue;
    const clozeSentence = exampleCloze(exampleSentence, word);
    if (clozeSentence) return { exampleSentence, clozeSentence, exampleSourceId };
  }
  return null;
}

export async function translateQuickFillWord(word, options) {
  if (new TextEncoder().encode(word).length > 500) return '';
  const { ok, data } = await request(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|vi`, options);
  if (!ok || (data?.responseStatus != null && Number(data.responseStatus) !== 200)) return '';
  return clean(data?.responseData?.translatedText).slice(0, 2000);
}

export async function quickFillCollocations(word, pos, options) {
  const relation = pos === 'adj' ? 'rel_jja' : 'rel_bga';
  const { data } = await request(`https://api.datamuse.com/words?${relation}=${encodeURIComponent(word)}&max=3`, options);
  return uniqueTerms(list(data).map(item => item?.word), word, 3).map(follower => `${word} ${follower}`)
    .filter(collocation => collocation.length <= 200);
}
