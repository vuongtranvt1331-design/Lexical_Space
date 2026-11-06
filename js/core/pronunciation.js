const DICTIONARY_ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const CACHE_LIMIT = 128;
const EXAMPLE_CHUNK_LENGTH = 150;

function exampleChunks(text) {
  const chunks = [];
  let chunk = '';
  for (const word of text.split(/\s+/)) {
    if (chunk && chunk.length + word.length + 1 > EXAMPLE_CHUNK_LENGTH) {
      chunks.push(chunk);
      chunk = '';
    }
    chunk = chunk ? `${chunk} ${word}` : word;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

export function pronunciationUrl(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > 2048) return '';
  try {
    const url = new URL(text.startsWith('//') ? 'https:' + text : text);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

function trustedDictionaryUrl(value) {
  const url = pronunciationUrl(value);
  if (!url) return '';
  const host = new URL(url).hostname;
  const trustedDomains = ['dictionaryapi.dev', 'oxforddictionaries.com', 'oxfordlearnersdictionaries.com', 'oup.com'];
  return host === 'ssl.gstatic.com' || trustedDomains.some(domain => host === domain || host.endsWith('.' + domain)) ? url : '';
}

export function isBritishPronunciation(phonetic, url = pronunciationUrl(phonetic?.audio)) {
  const accent = String(phonetic?.locale || phonetic?.language || phonetic?.dialect || phonetic?.accent || '');
  return /^(?:en[-_])?(?:gb|uk)$|^british(?: english)?$/i.test(accent) ||
    (!!url && /(?:^|[\/_-])(?:uk|gb)(?=[\/_\-.]|$)/i.test(new URL(url).pathname));
}

function dictionaryRecordings(entries) {
  const british = [], other = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    for (const phonetic of Array.isArray(entry?.phonetics) ? entry.phonetics : []) {
      const url = pronunciationUrl(phonetic?.audio);
      if (!url) continue;
      (isBritishPronunciation(phonetic, url) ? british : other).push(url);
    }
  }
  return { british, other };
}

async function beforeDeadline(operation, signal, delay) {
  signal.throwIfAborted();
  let timer, abort;
  const interrupted = new Promise((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => reject(new DOMException('Pronunciation timed out.', 'TimeoutError')), delay);
  });
  try { return await Promise.race([operation(), interrupted]); }
  finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}

// One controller owns the lookup, recording player, native speech, and gesture retry.
export function createPronunciationController({
  speech = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance,
  AudioClass = globalThis.Audio, fetcher = globalThis.fetch?.bind(globalThis),
  lookupTimeout = 3000, playbackTimeout = 4500
} = {}) {
  const cache = new Map();
  let active, player, utterance;

  function stopPlayer() {
    if (!player) return;
    player.pause();
    player.removeAttribute('src');
    player.load();
  }

  function cancel() {
    const previous = active;
    active = null;
    previous?.abort.abort();
    stopPlayer();
    if (utterance) utterance.onend = utterance.onerror = null;
    utterance = null;
    speech?.cancel();
  }

  async function lookup(term, signal) {
    const request = new AbortController();
    const abortRequest = () => request.abort();
    signal.addEventListener('abort', abortRequest, { once: true });
    try {
      const sources = await beforeDeadline(async () => {
        const response = await fetcher(DICTIONARY_ENDPOINT + encodeURIComponent(term), { signal: request.signal });
        if (!response.ok && response.status !== 404) return null;
        return dictionaryRecordings(response.ok ? await response.json() : []);
      }, signal, lookupTimeout);
      if (sources && !signal.aborted) {
        const ttl = sources.british.length || sources.other.length ? 60 * 60000 : 5 * 60000;
        cache.set(term, { sources, expires: Date.now() + ttl });
        if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
      }
      return sources;
    } catch { return null; }
    finally { signal.removeEventListener('abort', abortRequest); request.abort(); }
  }

  function speak(attempt) {
    if (active !== attempt || !speech || !Utterance) return;
    try {
      const next = new Utterance(attempt.chunks?.[attempt.chunkIndex] ?? attempt.word);
      next.lang = 'en-GB';
      const voice = speech.getVoices?.()?.find(candidate => /^en[-_]gb$/i.test(candidate.lang));
      if (voice) next.voice = voice;
      utterance = next;
      next.onerror = event => {
        if (active === attempt && utterance === next && ['not-allowed', 'audio-busy'].includes(event.error)) attempt.blocked = 'speech';
      };
      next.onend = () => {
        if (active !== attempt || utterance !== next) return;
        utterance = null;
        if (attempt.chunks && ++attempt.chunkIndex < attempt.chunks.length) speak(attempt);
      };
      speech.speak(next);
    } catch (error) {
      if (active === attempt && error?.name === 'NotAllowedError') attempt.blocked = 'speech';
    }
  }

  async function playNext(attempt) {
    while (active === attempt && attempt.index < attempt.urls.length) {
      const url = attempt.urls[attempt.index];
      try {
        player ||= new AudioClass();
        if (player.src !== url) player.src = url;
        await beforeDeadline(() => player.play(), attempt.abort.signal, playbackTimeout);
        return;
      } catch (error) {
        if (active !== attempt) return;
        if (error?.name === 'NotAllowedError') {
          attempt.blocked = 'recording';
          return;
        }
        stopPlayer();
        attempt.index++;
      }
    }
    speak(attempt);
  }

  function playRecordings(attempt, sources) {
    if (active !== attempt) return;
    const ordered = [...(sources?.british || []), ...attempt.dictionary, ...(sources?.other || []), attempt.custom];
    attempt.urls = [...new Set(ordered.filter(Boolean))];
    return playNext(attempt);
  }

  function run(attempt, action) {
    attempt.running = true;
    attempt.task = Promise.resolve(action()).finally(() => { attempt.running = false; });
    return attempt.task;
  }

  function unlock() {
    const attempt = active;
    if (!attempt?.blocked || attempt.running) return attempt?.task;
    const blocked = attempt.blocked;
    attempt.blocked = '';
    return run(attempt, () => blocked === 'recording' ? playNext(attempt) : speak(attempt));
  }

  function say(value) {
    const card = typeof value === 'string' ? { word: value } : value;
    const word = typeof card?.word === 'string' ? card.word.trim() : '';
    const dictionary = [card?.dictionaryAudioUrl, card?.oxfordAudioUrl].map(trustedDictionaryUrl).filter(Boolean);
    const custom = [card?.audioUrl, card?.audioURL, card?.customAudioUrl].map(pronunciationUrl).find(Boolean);
    const identity = JSON.stringify([word, dictionary, custom]);
    if (active?.identity === identity) {
      if (active.running) return active.task;
      if (active.blocked) return unlock();
    }
    cancel();
    if (!word) return Promise.resolve();
    const attempt = { identity, word, dictionary, custom, abort: new AbortController(), urls: [], index: 0 };
    active = attempt;
    return run(attempt, () => {
      if (!AudioClass) return speak(attempt);
      const term = word.toLowerCase();
      const cached = cache.get(term);
      if (cached?.expires > Date.now()) return playRecordings(attempt, cached.sources);
      cache.delete(term);
      return fetcher ? lookup(term, attempt.abort.signal).then(sources => playRecordings(attempt, sources)) : playRecordings(attempt);
    });
  }

  function sayExample(value) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text || !speech || !Utterance) return false;
    cancel();
    const attempt = { chunks: exampleChunks(text), chunkIndex: 0, abort: new AbortController() };
    active = attempt;
    speak(attempt);
    return true;
  }

  return { say, sayExample, cancel, unlock };
}

export const pronunciation = createPronunciationController();
