import { context } from '../core/context.js';
import { idbGet, updateMetadata } from '../core/idb-manager.js';
import { escapeHtml, getStudentKey } from '../utils/helpers.js';
import { clozeText, matchesRecallAnswer } from '../core/recall-utils.js';
import { recallLevelFor, timestamp } from '../core/vocabulary.js';

const WINDOW_MS = 72 * 60 * 60 * 1000;
const CHECK_SIZE = 15;
const BLANK = '[ _____ ]';
const $ = id => document.getElementById(id);
const stages = ['intro', 'empty', 'question', 'results'];
let attempt = null, opening = false, generation = 0;
const historyKey = user => `inclassCheckedIds_${getStudentKey(user)}`;
const uniqueIds = value => [...new Set((Array.isArray(value) ? value : []).filter(id => typeof id === 'string'))];
function shuffled(words, random) {
  const pool = [...words];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export function selectInClassPool(words, now = Date.now(), random = Math.random, checkedIds = []) {
  const recent = [], previous = [];
  const ids = new Set();
  for (const word of words) {
    if (word.deleted || typeof word.id !== 'string' || ids.has(word.id)) continue;
    ids.add(word.id);
    const level = recallLevelFor(word);
    if (level !== 3 && level !== 4) continue;
    const reviewedAt = timestamp(word.lastReviewedAt);
    if (reviewedAt > 0 && reviewedAt <= now && now - reviewedAt <= WINDOW_MS) recent.push(word);
    else previous.push(word);
  }
  const pool = recent.length ? recent : previous;
  const history = new Set(uniqueIds(checkedIds));
  const unseen = shuffled(pool.filter(word => !history.has(word.id)), random);
  const resetHistory = unseen.length < CHECK_SIZE;
  const selected = unseen.slice(0, CHECK_SIZE);
  if (resetHistory) selected.push(...shuffled(pool.filter(word => history.has(word.id)), random).slice(0, CHECK_SIZE - selected.length));
  return { kind: selected.length ? (recent.length ? 'recent' : 'previous') : 'empty', words: selected, resetHistory };
}

function currentPool(history = []) {
  return selectInClassPool(context.wordsData.filter(word => word.username === context.currentUser), Date.now(), Math.random, history);
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
    ? 'Up to 15 green and blue words from the last 72 hours; unchecked words first.' : 'Up to 15 green and blue words; unchecked words first.';
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
  $('check-answer-list').innerHTML = attempt.answers.map(({ word, answer, correct }, index) => `
    <li class="check-answer-item">
      <p class="check-answer-badge ${correct ? 'is-correct' : 'is-incorrect'}">${correct ? 'Correct' : 'Incorrect'}</p>
      <div class="check-answer-grid grid-cols-2 gap-2">
        <div class="check-answer-cell check-answer-yours ${correct ? 'is-correct' : ''}">
          <h5>Your Answer</h5><p class="check-typed-answer" dir="auto">${escapeHtml(answer || '(Empty)')}</p>
        </div>
        <div class="check-answer-cell check-answer-target">
          <h5>Correct Answer</h5><p class="check-target-word" lang="en">${escapeHtml(word.word)}</p>
          <p lang="vi" dir="auto">${escapeHtml(word.meaning)}</p>
          ${typeof context.playAudio === 'function' ? `<button type="button" class="check-answer-audio" data-answer-index="${index}" aria-label="Pronounce ${escapeHtml(word.word)}">&#128266;</button>` : ''}
        </div>
      </div>
    </li>`).join('');
  $('check-missed-list').replaceChildren();
  for (const word of attempt.missed) {
    const item = document.createElement('li'); item.textContent = word.word; $('check-missed-list').append(item);
  }
  $('check-missed').hidden = attempt.missed.length === 0;
  $('btn-check-review-misses').hidden = attempt.missed.length === 0;
  showStage('results');
  $('check-results-heading').focus();
}

async function saveCompletedHistory(finished) {
  if (finished.historySaving || finished.historySaved) return;
  finished.historySaving = true;
  const active = () => attempt === finished && context.currentUser === finished.user;
  const status = $('check-history-status'), retry = $('btn-check-save-history');
  if (active()) { status.textContent = 'Saving check history…'; retry.hidden = true; }
  try {
    const selected = finished.words.map(word => word.id);
    // One local metadata transaction; merge the latest history if another tab completed meanwhile.
    await updateMetadata([finished.historyKey], values => {
      const latest = uniqueIds(values[finished.historyKey]?.value);
      const previous = new Set(finished.historyBefore);
      const unchanged = latest.length === previous.size && latest.every(id => previous.has(id));
      const ids = uniqueIds([...(finished.resetHistory && unchanged ? [] : latest), ...selected]);
      return { records: [{ key: finished.historyKey, value: ids }], result: ids };
    });
    finished.historySaved = true;
    if (active()) status.textContent = '';
  } catch (error) {
    if (active()) {
      status.textContent = 'Your results are ready, but check history could not be saved. Retry to avoid repeated words.';
      retry.hidden = false;
    }
  } finally { finished.historySaving = false; }
}

async function startCheck() {
  if (!canUseCheck() || attempt || opening) return;
  opening = true;
  const user = context.currentUser, ticket = generation;
  $('btn-check-start').disabled = true;
  $('check-status').hidden = true;
  try {
    const history = uniqueIds(await idbGet('metadata', historyKey(user)));
    if (ticket !== generation || user !== context.currentUser || !canUseCheck()) return;
    const { words, resetHistory } = currentPool(history);
    if (!words.length) { renderIntro(true); return; }
    attempt = { user, words, index: 0, missed: [], answers: [], historyKey: historyKey(user), historyBefore: history,
      resetHistory, historySaved: false, historySaving: false, startedAt: performance.now(), elapsed: null };
    renderQuestion({ clearAnswer: true });
  } catch (error) {
    if (ticket === generation && user === context.currentUser) {
      $('check-status').textContent = 'Could not load check history. Try starting the check again.';
      $('check-status').hidden = false;
    }
  } finally {
    if (ticket === generation) { opening = false; $('btn-check-start').disabled = false; }
  }
}

export function resetInClassCheck() {
  generation++; opening = false; attempt = null;
  $('btn-check-start').disabled = false;
  $('btn-check-save-history').hidden = true;
  for (const id of ['check-progress', 'check-meaning', 'check-cloze', 'check-score', 'check-time', 'check-missed-list', 'check-answer-list', 'check-history-status', 'check-status']) {
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
  $('btn-check-start').addEventListener('click', () => { void startCheck(); });
  $('btn-check-save-history').addEventListener('click', () => {
    if (canUseCheck() && attempt?.elapsed != null && attempt?.words) void saveCompletedHistory(attempt);
  });
  $('check-answer-list').addEventListener('click', event => {
    const button = event.target.closest('button[data-answer-index]');
    if (!button || !canUseCheck() || attempt?.elapsed == null || attempt.user !== context.currentUser) return;
    const answer = attempt.answers[Number(button.dataset.answerIndex)];
    if (answer && typeof context.playAudio === 'function') context.playAudio(answer.word);
  });
  $('check-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!canUseCheck() || !attempt || attempt.user !== context.currentUser || attempt.elapsed !== null) return;
    const input = $('check-answer'), answer = input.value;
    const word = attempt.words[attempt.index++];
    const correct = matchesRecallAnswer(answer, word);
    attempt.answers.push({ word, answer, correct });
    if (!correct) attempt.missed.push(word);
    input.value = '';
    if (attempt.index < attempt.words.length) { renderQuestion(); return; }
    attempt.elapsed = Math.floor((performance.now() - attempt.startedAt) / 1000);
    $('check-meaning').textContent = '';
    $('check-cloze').textContent = '';
    renderResults();
    void saveCompletedHistory(attempt);
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
