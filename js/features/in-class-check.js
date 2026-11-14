import { context } from '../core/context.js';
import { clozeText, matchesRecallAnswer } from '../core/recall-utils.js';
import { recallLevelFor, timestamp } from '../core/vocabulary.js';

const WINDOW_MS = 72 * 60 * 60 * 1000;
const FALLBACK_SIZE = 15;
const BLANK = '[ _____ ]';
const $ = id => document.getElementById(id);
const stages = ['intro', 'empty', 'question', 'results'];
let attempt = null;

export function selectInClassPool(words, now = Date.now(), random = Math.random) {
  const recent = [], previous = [];
  for (const word of words) {
    if (word.deleted) continue;
    const level = recallLevelFor(word);
    if (level !== 3 && level !== 4) continue;
    const reviewedAt = timestamp(word.lastReviewedAt);
    if (reviewedAt > 0 && reviewedAt <= now && now - reviewedAt <= WINDOW_MS) recent.push(word);
    else previous.push(word);
  }
  if (recent.length) return { kind: 'recent', words: recent };

  // A partial Fisher–Yates shuffle samples without replacement.
  const size = Math.min(FALLBACK_SIZE, previous.length);
  for (let i = 0; i < size; i++) {
    const j = i + Math.floor(random() * (previous.length - i));
    [previous[i], previous[j]] = [previous[j], previous[i]];
  }
  return { kind: size ? 'previous' : 'empty', words: previous.slice(0, size) };
}

function currentPool() {
  return selectInClassPool(context.wordsData.filter(word => word.username === context.currentUser));
}

function showStage(stage) {
  for (const name of stages) $(`check-${name}`).hidden = name !== stage;
}

function renderIntro(focus) {
  const pool = currentPool();
  const empty = pool.words.length === 0;
  showStage(empty ? 'empty' : 'intro');
  $('check-available-count').textContent = pool.words.length;
  $('check-pool-description').textContent = pool.kind === 'recent'
    ? 'Green and blue words reviewed in the last 72 hours.' : 'A random sample of up to 15 green and blue words.';
  if (focus) $(empty ? 'check-empty-heading' : 'check-heading').focus();
}

export function refreshInClassCheckPool() {
  if (!attempt && !$('view-in-class-check').classList.contains('hidden')) renderIntro(false);
}

function renderQuestion({ clearAnswer = false } = {}) {
  const word = attempt.words[attempt.index];
  const stored = clozeText(word.clozeSentence, word.word, { inflections: true });
  const example = stored.includes(BLANK) ? stored : clozeText(word.exampleSentence, word.word, { inflections: true });
  $('check-progress').textContent = `Word ${attempt.index + 1} of ${attempt.words.length}`;
  $('check-meaning').textContent = word.meaning;
  $('check-cloze').textContent = example.includes(BLANK) ? example : BLANK;
  showStage('question');
  const input = $('check-answer');
  if (clearAnswer) input.value = '';
  input.focus({ preventScroll: true });
}

function elapsedText(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const tail = String(seconds % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${tail}` : `${minutes}:${tail}`;
}

function renderResults() {
  const total = attempt.words.length, score = total - attempt.missed.length;
  $('check-score').textContent = `${score} / ${total} (${Math.round(score / total * 100)}%)`;
  $('check-time').textContent = elapsedText(attempt.elapsed);
  const list = $('check-missed-list');
  list.replaceChildren();
  for (const word of attempt.missed) {
    const item = document.createElement('li');
    item.textContent = word.word;
    list.append(item);
  }
  $('check-missed').hidden = attempt.missed.length === 0;
  $('btn-check-review-misses').hidden = attempt.missed.length === 0;
  showStage('results');
  $('check-results-heading').focus();
}

export function resetInClassCheck() {
  attempt = null;
  for (const id of ['check-progress', 'check-meaning', 'check-cloze', 'check-score', 'check-time', 'check-missed-list', 'check-status']) {
    $(id).textContent = '';
  }
  $('check-status').hidden = true;
  $('check-answer').value = '';
  $('btn-check-review-misses').disabled = false;
  showStage(null);
}

export function renderInClassCheck() {
  if (!attempt) renderIntro(true);
  else if (attempt.elapsed === null) renderQuestion();
  else renderResults();
}

function canUseCheck() {
  const view = $('view-in-class-check');
  return context.currentUser && !context.profileLoading && !view.classList.contains('hidden') && !view.closest('[inert]');
}

export function setupInClassCheck() {
  $('check-progress-panel').addEventListener('toggle', event => {
    if (event.currentTarget.open && canUseCheck()) void context.renderStats();
  });
  $('btn-check-start').addEventListener('click', () => {
    if (!canUseCheck() || attempt) return;
    const { words } = currentPool();
    if (!words.length) { renderIntro(true); return; }
    attempt = { user: context.currentUser, words, index: 0, missed: [], startedAt: performance.now(), elapsed: null };
    renderQuestion({ clearAnswer: true });
  });
  $('check-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!canUseCheck() || !attempt || attempt.user !== context.currentUser || attempt.elapsed !== null) return;
    const input = $('check-answer'), answer = input.value.trim();
    if (!answer) { input.focus(); return; }
    const word = attempt.words[attempt.index++];
    if (!matchesRecallAnswer(answer, word)) attempt.missed.push(word);
    input.value = '';
    if (attempt.index < attempt.words.length) { renderQuestion(); return; }
    attempt.elapsed = Math.floor((performance.now() - attempt.startedAt) / 1000);
    $('check-meaning').textContent = '';
    $('check-cloze').textContent = '';
    renderResults();
  });
  for (const button of $('view-in-class-check').querySelectorAll('[data-check-done]')) {
    button.addEventListener('click', () => {
      if (!canUseCheck()) return;
      resetInClassCheck();
      context.switchView('view-review');
    });
  }
  $('btn-check-review-misses').addEventListener('click', async event => {
    const button = event.currentTarget, finished = attempt;
    if (!canUseCheck() || finished?.elapsed == null || !finished.missed.length || button.disabled) return;
    const status = $('check-status');
    const navigation = context.navigationGeneration;
    button.disabled = true;
    status.hidden = true;
    try {
      const count = await context.queueInClassMisses(finished.missed.map(word => word.id), finished.user);
      if (attempt !== finished) return;
      if (!count) {
        status.textContent = 'These words are no longer available for review.';
        status.hidden = false;
        return;
      }
      resetInClassCheck();
      context.showToast(`${count} ${count === 1 ? 'word added' : 'words added'} to review.`);
      if (navigation === context.navigationGeneration) context.switchView('view-review');
    } catch (error) {
      if (attempt === finished) {
        status.textContent = error.message || 'Could not add these words to review. Try again.';
        status.hidden = false;
      }
    } finally { if (attempt === finished) button.disabled = false; }
  });
}
