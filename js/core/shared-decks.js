import { idbGet, mergeUserVocabulary, readUserWords } from './idb-manager.js';
import { newId, normalizeRemoteVocabulary, text, withoutLegacyLevel, wordTopics } from './vocabulary.js';

const DECK_COLLECTION = 'shared_decks';
const DECK_FIELDS = ['deckId', 'title', 'createdAt', 'wordCount', 'words'];
const CARD_FIELDS = ['word', 'ipa', 'pos', 'vietnamese', 'example', 'cloze', 'synonyms', 'collocations', 'topics'];
const DOCUMENT_BUDGET = 950_000;
const RESERVED_TOPICS = new Set(['ALL', 'FAVORITES']);
const trimmedTerm = value => value.trim().toLowerCase();

function requireProfile(username) {
  if (typeof username !== 'string' || !username || username !== username.trim()) {
    throw new Error('Choose your profile before using shared decks.');
  }
}

function validateDeckId(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id)) {
    throw new Error('This deck link is invalid.');
  }
  return id;
}

function requireShape(value, fields, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) {
    throw new Error(message);
  }
}

function readString(value, maxLength, label, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > maxLength || (required && !value.trim())) {
    throw new Error(`Invalid ${label} in the shared deck.`);
  }
  return value.trim();
}

function readList(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`Invalid ${label} in the shared deck.`);
  return [...new Set(value.map(item => readString(item, 200, label, true)))];
}

function validateTopic(topic) {
  if (RESERVED_TOPICS.has(topic.toUpperCase())) throw new Error('This shared deck uses a reserved topic name.');
  return topic;
}

function validateCard(input) {
  const card = input && typeof input === 'object' && !Array.isArray(input) ? withoutLegacyLevel(input) : input;
  requireShape(card, CARD_FIELDS, 'The shared deck contains an invalid card.');
  return {
    word: readString(card.word, 200, 'target word', true),
    ipa: readString(card.ipa, 200, 'IPA'),
    pos: readString(card.pos, 40, 'part of speech'),
    vietnamese: readString(card.vietnamese, 2000, 'Vietnamese meaning', true),
    example: readString(card.example, 2000, 'example'),
    cloze: readString(card.cloze, 2000, 'cloze'),
    synonyms: readList(card.synonyms, 'synonyms'),
    collocations: readList(card.collocations, 'collocations'),
    topics: readList(card.topics, 'topics').map(validateTopic)
  };
}

function validateDeck(input) {
  requireShape(input, DECK_FIELDS, 'This shared deck has an invalid format.');
  const deckId = validateDeckId(input.deckId);
  const title = validateTopic(readString(input.title, 200, 'deck title', true));
  if (!Number.isSafeInteger(input.createdAt) || input.createdAt < 0 ||
      !Array.isArray(input.words) || !input.words.length || input.wordCount !== input.words.length) {
    throw new Error('This shared deck has invalid metadata.');
  }
  const bytes = new TextEncoder().encode(JSON.stringify(input)).byteLength;
  // Leave room for Firestore's document overhead and the nested card maps.
  if (bytes + 32 * input.words.length > DOCUMENT_BUDGET) {
    throw new Error('This deck is too large for one share link. Choose a smaller topic.');
  }
  return { deckId, title, createdAt: input.createdAt, wordCount: input.wordCount, words: input.words.map(validateCard) };
}

export async function prepareShareDeck(username, topic) {
  requireProfile(username);
  const title = validateTopic(readString(topic, 200, 'deck title', true));
  const words = (await readUserWords(username))
    .filter(word => wordTopics(word).includes(title))
    .map(word => ({
      word: word.word,
      ipa: word.phonetic,
      pos: word.pos,
      vietnamese: word.meaning,
      example: word.exampleSentence,
      cloze: word.clozeSentence,
      synonyms: word.synonyms,
      collocations: word.collocations,
      topics: wordTopics(word)
    }));
  if (!words.length) throw new Error('This topic has no words to share.');
  return validateDeck({ deckId: newId(), title, createdAt: Date.now(), wordCount: words.length, words });
}

export async function publishSharedDeck(db, input) {
  if (!db) throw new Error('Connect to the cloud to create a share link.');
  const deck = validateDeck(input);
  const ref = db.collection(DECK_COLLECTION).doc(deck.deckId);
  await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (snapshot.exists) throw new Error('That link already exists. Create a new share link.');
    tx.set(ref, deck);
  });
  return deck.deckId;
}

export async function fetchSharedDeck(db, id) {
  const deckId = validateDeckId(id);
  if (!db) throw new Error('Connect to the cloud to open this share link.');
  const snapshot = await db.collection(DECK_COLLECTION).doc(deckId).get();
  if (!snapshot.exists) throw new Error('This shared deck could not be found.');
  const deck = validateDeck(snapshot.data());
  if (deck.deckId !== deckId) throw new Error('The shared deck does not match this link.');
  return deck;
}

const importKey = (username, deckId) => `importedDecks:${encodeURIComponent(username)}:${deckId}`;

function importedCards(words) {
  const byTerm = new Map();
  for (const card of words) {
    const key = trimmedTerm(card.word);
    const previous = byTerm.get(key);
    if (!previous) {
      byTerm.set(key, card);
      continue;
    }
    const sameExample = !previous.example || previous.example === card.example;
    byTerm.set(key, {
      ...previous,
      example: previous.example || card.example,
      cloze: previous.cloze || (sameExample ? card.cloze : ''),
      collocations: previous.collocations.length ? previous.collocations : card.collocations,
      topics: [...new Set([...previous.topics, ...card.topics])]
    });
  }
  return byTerm;
}

function mergeCard(word, card, title) {
  const existingTopics = wordTopics(word);
  const topics = [...new Set([...existingTopics, title, ...card.topics])];
  const patch = {};
  if (topics.length !== existingTopics.length) patch.topics = topics;
  if (!word.exampleSentence && card.example) patch.exampleSentence = card.example;
  if (!word.clozeSentence && card.cloze && (!word.exampleSentence || word.exampleSentence === card.example)) patch.clozeSentence = card.cloze;
  if (!word.collocations.length && card.collocations.length) patch.collocations = card.collocations;
  return patch;
}

function newCard(card, title) {
  return {
    word: card.word,
    phonetic: card.ipa,
    pos: card.pos,
    meaning: card.vietnamese,
    exampleSentence: card.example,
    clozeSentence: card.cloze,
    synonyms: card.synonyms,
    collocations: card.collocations,
    topic: title,
    topics: [...new Set([title, ...card.topics])],
    status: 'new',
    repetition: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: null,
    createdAt: Date.now()
  };
}

function planImport(existingWords, marker, deck) {
  const incoming = importedCards(deck.words);
  const result = { added: 0, merged: 0, unchanged: 0, alreadyImported: !!marker };
  const byTerm = new Map();
  for (const record of existingWords) {
    if (record.deleted || !text(record.word)) continue;
    const word = normalizeRemoteVocabulary(record);
    const key = trimmedTerm(word.word);
    if (!byTerm.has(key)) byTerm.set(key, []);
    byTerm.get(key).push(word);
  }
  if (marker) {
    const missing = [...incoming.keys()].filter(key => !byTerm.has(key)).length;
    return { changes: [], result: { ...result, unchanged: incoming.size - missing, missing } };
  }
  const changes = [];
  for (const [key, card] of incoming) {
    const matches = byTerm.get(key);
    const existing = matches?.find(word => trimmedTerm(word.meaning) === trimmedTerm(card.vietnamese)) || matches?.[0];
    if (!existing) {
      result.added++;
      changes.push({ id: `word_${newId()}`, patch: newCard(card, deck.title) });
      continue;
    }
    const patch = mergeCard(existing, card, deck.title);
    if (!Object.keys(patch).length) {
      result.unchanged++;
      continue;
    }
    result.merged++;
    changes.push({ id: existing.id, patch, expectedVersion: existing });
  }
  return { changes, result, marker: { deckId: deck.deckId, title: deck.title, importedAt: Date.now() } };
}

export async function previewDeckImport(username, input) {
  requireProfile(username);
  const deck = validateDeck(input);
  const [words, marker] = await Promise.all([
    readUserWords(username),
    idbGet('metadata', importKey(username, deck.deckId))
  ]);
  return planImport(words, marker, deck).result;
}

export function importSharedDeck(username, input) {
  requireProfile(username);
  const deck = validateDeck(input);
  return mergeUserVocabulary(username, importKey(username, deck.deckId), (words, marker) => planImport(words, marker, deck));
}
