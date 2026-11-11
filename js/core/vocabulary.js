// Content and wire schema. Learning history and unknown fields are retained.
import { clozeText, targetSegments } from './recall-utils.js';
export const PARTS_OF_SPEECH = ['n', 'v', 'adj', 'adv', 'pron', 'prep', 'conj', 'det', 'interj', 'phrase'];
const POS_ALIASES = { noun: 'n', verb: 'v', adjective: 'adj', adverb: 'adv', pronoun: 'pron', preposition: 'prep',
  conjunction: 'conj', determiner: 'det', article: 'det', interjection: 'interj', exclamation: 'interj',
  'noun phrase': 'n', 'verb phrase': 'v', 'phrasal verb': 'v', 'adjective phrase': 'adj', 'adverb phrase': 'adv', idiom: 'phrase' };
export function normalizePartOfSpeech(value) {
  const key = typeof value === 'string' ? value.trim().toLowerCase().replace(/\.$/, '') : '';
  return PARTS_OF_SPEECH.includes(key) ? key : Object.hasOwn(POS_ALIASES, key) ? POS_ALIASES[key] : '';
}
export const text = value => String(value ?? '').trim();
export function validateImportTopic(value = '') {
  const topic = text(value);
  if (topic.length > 200 || ['ALL', 'FAVORITES'].includes(topic.toUpperCase())) {
    throw new Error('Choose a topic name of up to 200 characters. All and Favorites are reserved.');
  }
  return topic;
}
export const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
export const normalizeTerm = value => text(value).normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase('en');
export const senseKey = word => [normalizeTerm(word.word), normalizeTerm(word.pos), normalizeTerm(word.sense || word.meaning)].join('\0');
export function exampleSourceUrl(id) {
  return Number.isSafeInteger(id) && id > 0 ? `https://tatoeba.org/en/sentences/show/${id}` : '';
}
export function wordTopics(word) {
  const secondary = Array.isArray(word.topics) ? word.topics : [];
  const topics = [word.topic, ...secondary].filter(value => typeof value === 'string').map(value => value.trim()).filter(Boolean);
  return [...new Set(topics)];
}
export function timestamp(value, fallback = 0) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value && typeof value.seconds === 'number') return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
  const n = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(n) ? n : fallback;
}
const integer = value => Math.max(0, Math.trunc(Number(value) || 0));
export function withoutLegacyLevel(record) {
  const { cefr: _legacyLevel, ...fields } = record;
  return fields;
}
export function memoryStatusFor({ masteryOverride, autoMastered }) {
  return masteryOverride ?? (autoMastered ? 'mastered' : 'not_remembered');
}
export function recallLevelFor(word) {
  if (word.memoryStatus === 'mastered') return 4;
  if ([1, 2, 3].includes(word.recallLevel)) return word.recallLevel;
  if (word.masteryOverride === 'not_remembered') return 3;
  const grade = Number(word.lastGrade ?? NaN);
  return [0, 1, 2, 3].includes(grade) ? Math.min(grade + 1, 3) : null;
}
export function normalizeRemoteVocabulary(record, id = record.id) {
  const word = { ...withoutLegacyLevel(record), id: text(id), username: text(record.username), word: text(record.word), meaning: text(record.meaning) };
  for (const field of ['pos', 'sense', 'exampleSentence', 'synonym1', 'synonym2', 'phonetic', 'usageNotes', 'clozeSentence']) word[field] = text(record[field]);
  if (!word.exampleSentence || !exampleSourceUrl(word.exampleSourceId)) delete word.exampleSourceId;
  word.synonyms = [...new Set((Array.isArray(record.synonyms) ? record.synonyms : [word.synonym1, word.synonym2]).map(text).filter(Boolean))];
  word.synonym1 = word.synonyms[0] || ''; word.synonym2 = word.synonyms[1] || '';
  if (!word.clozeSentence && targetSegments(word.exampleSentence, word.word, { inflections: true }).some(part => part.target)) word.clozeSentence = clozeText(word.exampleSentence, word.word, { inflections: true });
  word.pos = word.pos.toLowerCase().replace(/\.$/, '');
  word.collocations = Array.isArray(record.collocations) ? record.collocations.map(text).filter(Boolean) : [];
  const topics = wordTopics(record);
  word.topic = topics[0] || 'New Words';
  word.topics = topics.length ? topics : [word.topic];
  word.isFavorite = record.isFavorite === true; word.deleted = record.deleted === true;
  word.revision = integer(record.revision); word.updatedAt = integer(timestamp(record.updatedAt)); word.mutationId = text(record.mutationId);
  word.interval = Math.max(0, Number(record.interval) || 0); word.repetition = integer(record.repetition);
  word.easeFactor = Math.max(1.3, Number(record.easeFactor) || 2.5);
  word.reviewCount = integer(record.reviewCount); word.lapses = integer(record.lapses);
  word.successfulDays = [...new Set(Array.isArray(record.successfulDays) ? record.successfulDays.filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)) : [])].sort();
  const lastGrade = Number(record.lastGrade);
  // Legacy records retained the last grade but no per-grade history.
  word.goodReviewCount = integer(record.goodReviewCount ?? Number(lastGrade === 2));
  const legacyMastered = lastGrade === 3 || (word.repetition >= 3 && word.successfulDays.length >= 3);
  word.autoMastered = word.goodReviewCount >= 3 || (typeof record.autoMastered === 'boolean' ? record.autoMastered : legacyMastered);
  word.dueDate = record.dueDate === null && record.due == null ? null : new Date(timestamp(record.dueDate ?? record.due, 0)).toISOString();
  if (record.createdAt != null) word.createdAt = timestamp(record.createdAt);
  if (record.lastReviewedAt != null) word.lastReviewedAt = timestamp(record.lastReviewedAt);
  if (!['mastered', 'not_remembered'].includes(word.masteryOverride)) delete word.masteryOverride;
  word.selfReportedKnown = record.selfReportedKnown === true || record.memoryStatus === 'known' ||
    (!word.masteryOverride && record.memoryStatus === 'mastered');
  word.memoryStatus = memoryStatusFor(word);
  word.recallLevel = recallLevelFor(word);
  word.masteredReviewPending = word.memoryStatus === 'mastered' && record.masteredReviewPending !== false;
  return word;
}
export function compareVersions(a = {}, b = {}) {
  return (integer(a.revision) - integer(b.revision)) || (timestamp(a.updatedAt) - timestamp(b.updatedAt)) || text(a.mutationId).localeCompare(text(b.mutationId));
}
export function validateVocabulary(input, { requireContext = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { word: null, errors: ['Expected a vocabulary object.'], valid: false };
  const errors = [], word = normalizeRemoteVocabulary(input);
  if (!word.word || word.word.length > 200) errors.push('Word must contain 1–200 characters.');
  if (!word.meaning || word.meaning.length > 2000) errors.push('Meaning must contain 1–2,000 characters.');
  if (word.pos && !PARTS_OF_SPEECH.includes(word.pos)) errors.push('Invalid part of speech.');
  if (input.collocations != null && !Array.isArray(input.collocations)) errors.push('Collocations must be an array.');
  if (word.collocations.length > 3) errors.push('Provide at most 3 collocations.');
  if (word.sense.length > 2000 || word.exampleSentence.length > 2000 || word.collocations.some(c => c.length > 200)) errors.push('Context fields are too long.');
  if (word.phonetic.length > 200 || word.usageNotes.length > 4000) errors.push('Phonetic must be at most 200 characters and usage notes at most 4,000.');
  if (input.synonyms != null && (!Array.isArray(input.synonyms) || input.synonyms.some(v => typeof v !== 'string'))) errors.push('Synonyms must be an array of strings.');
  if (word.synonyms.length > 8 || word.synonyms.some(v => v.length > 200)) errors.push('Provide at most 8 synonyms, each at most 200 characters.');
  if (word.clozeSentence.length > 2000 || (word.clozeSentence && (!word.clozeSentence.includes('[ _____ ]') || targetSegments(word.clozeSentence, word.word, { inflections: true }).some(part => part.target)))) errors.push('Cloze must hide the target and its inflections using [ _____ ].');
  if (requireContext && (!word.pos || !word.sense || !word.exampleSentence || word.collocations.length < 2)) errors.push('Part of speech, sense, example and 2–3 collocations are required.');
  return { word, errors, valid: errors.length === 0 };
}
export function parseVocabularyImport(raw) {
  const entries = [], errors = [];
  const add = (value, line) => { const r = validateVocabulary(value); if (r.valid) entries.push(r.word); else errors.push({ line, message: r.errors.join(' ') }); };
  if (text(raw).startsWith('[')) {
    try { const values = JSON.parse(raw); if (!Array.isArray(values)) throw new Error('Expected a JSON array.'); values.forEach((v, i) => add(v, i + 1)); }
    catch (error) { errors.push({ line: 0, message: error.message }); }
  } else {
    let topic = 'New Words';
    text(raw).split(/\r?\n/).forEach((rawLine, i) => {
      const line = rawLine.trim(); if (!line) return;
      const match = line.match(/^Topic\s*:\s*(.+)$/i); if (match) { topic = match[1].trim(); return; }
      const columns = line.split('|').map(text);
      // Ignore the old fifth column when importing a recognizable older row.
      if (columns.length === 10 || /^[ABC][12]$/i.test(columns[4] || '')) columns.splice(4, 1);
      if (columns.length < 2 || columns.length > 9) { errors.push({ line: i + 1, message: 'Expected word | meaning | synonyms | pos | sense | collocations | exampleSentence | phonetic | usageNotes.' }); return; }
      const [word, meaning, related = '', pos, sense, pairings = '', exampleSentence, phonetic, usageNotes] = columns;
      const synonyms = related.split(',').map(text).filter(Boolean);
      add({ word, meaning, synonym1: synonyms[0], synonym2: synonyms[1], pos, sense, collocations: pairings.split(';').map(text).filter(Boolean), exampleSentence, phonetic, usageNotes, topic }, i + 1);
    });
  }
  const unique = new Map(); for (const entry of entries) unique.set(senseKey(entry), entry);
  return { entries: [...unique.values()], errors, duplicates: entries.length - unique.size };
}
