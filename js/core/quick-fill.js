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
  const preferredPOS = normalizePartOfSpeech(options?.pos);
  const meaning = preferredPOS ? meanings.find(item => normalizePartOfSpeech(item?.partOfSpeech) === preferredPOS) : meanings[0];
  const relatedMeanings = meanings.filter(item => normalizePartOfSpeech(item?.partOfSpeech) === normalizePartOfSpeech(meaning?.partOfSpeech));
  const phonetics = data.flatMap(entry => list(entry?.phonetics));
  const ipa = phonetics.find(item => clean(item?.text) && isBritishPronunciation(item))?.text ||
    phonetics.find(item => clean(item?.text))?.text || data.map(entry => entry?.phonetic).find(value => clean(value));
  const synonyms = uniqueTerms(relatedMeanings.flatMap(item =>
    [...list(item?.synonyms), ...list(item?.definitions).flatMap(definition => list(definition?.synonyms))]), word, 4);
  const examples = relatedMeanings.flatMap(item => list(item?.definitions)).map(item => clean(item?.example))
    .filter(example => example && example.length <= 2000);
  const pair = examples.map(exampleSentence => ({ exampleSentence, clozeSentence: exampleCloze(exampleSentence, word) }))
    .find(example => example.clozeSentence);
  return { phonetic: clean(ipa).slice(0, 200), pos: normalizePartOfSpeech(meaning?.partOfSpeech), synonyms,
    ...(pair || { exampleSentence: examples[0] || '', clozeSentence: '' }) };
}

export async function quickFillSynonyms(word, pos, options) {
  const { ok, data } = await request(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&md=p&max=12`, options);
  if (!ok) return [];
  return uniqueTerms(list(data).filter(item => {
    const tags = list(item?.tags).filter(tag => ['n', 'v', 'adj', 'adv'].includes(tag));
    return !pos || !tags.length || tags.includes(pos);
  }).map(item => item?.word), word, 4);
}

const enrichmentFields = ['meaning', 'phonetic', 'pos', 'synonyms', 'collocations', 'exampleSentence', 'clozeSentence'];
export const missingVocabularyFields = word => enrichmentFields.filter(field =>
  Array.isArray(word[field]) ? !word[field].length : !clean(word[field]));

export async function lookupMissingVocabulary(word, options = {}) {
  const missing = new Set(missingVocabularyFields(word)), suggestions = {};
  const translation = missing.has('meaning') ? translateQuickFillWord(word.word, options).catch(() => '') : '';
  const needsDictionary = ['phonetic', 'pos', 'synonyms', 'exampleSentence'].some(field => missing.has(field));
  const dictionary = needsDictionary ? await dictionaryDetails(word.word, { ...options, pos: word.pos }).catch(() => null) : null;
  options.signal?.throwIfAborted();
  const pos = word.pos || dictionary?.pos || '';
  if (dictionary?.phonetic) suggestions.phonetic = dictionary.phonetic;
  if (dictionary?.pos) suggestions.pos = dictionary.pos;
  const synonyms = missing.has('synonyms') ? (dictionary?.synonyms.length ? dictionary.synonyms :
    await quickFillSynonyms(word.word, pos, options).catch(() => [])) : [];
  if (synonyms.length) suggestions.synonyms = synonyms;
  const collocations = missing.has('collocations') ? quickFillCollocations(word.word, pos, options).catch(() => []) : [];
  let sentence = dictionary?.clozeSentence ? dictionary : null;
  if (missing.has('exampleSentence') && !sentence) sentence = await quickFillSentence(word.word, options).catch(() => null);
  if (missing.has('exampleSentence') && sentence && (!word.clozeSentence || word.clozeSentence === sentence.clozeSentence)) {
    suggestions.exampleSentence = sentence.exampleSentence;
    if (sentence.exampleSourceId) suggestions.exampleSourceId = sentence.exampleSourceId;
  }
  const example = word.exampleSentence || suggestions.exampleSentence || '';
  const cloze = exampleCloze(example, word.word);
  if (missing.has('clozeSentence') && cloze) suggestions.clozeSentence = cloze;
  const [meaning, pairs] = await Promise.all([translation, collocations]);
  options.signal?.throwIfAborted();
  if (meaning) suggestions.meaning = meaning;
  if (pairs.length) suggestions.collocations = pairs;
  return Object.fromEntries(Object.entries(suggestions).filter(([field]) => missing.has(field) || field === 'exampleSourceId'));
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
