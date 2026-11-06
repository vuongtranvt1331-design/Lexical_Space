import { context } from '../core/context.js';
import { idbGet, updateMetadata } from '../core/idb-manager.js';
import { exampleSourceUrl, newId } from '../core/vocabulary.js';
import { scheduleReview, selectPracticeWords, calendarDay, isDue, isNewWord } from '../core/srs.js';
import { loadSettings, saveSettings } from '../core/settings.js';
import { pronunciation } from '../core/pronunciation.js';
import { targetSegments, clozeText, matchesRecallAnswer } from '../core/recall-utils.js';
import { trackIntentionalClicks } from '../utils/intentional-click.js';
const $ = id => document.getElementById(id);
let session = null, generation = 0, busy = false, loading = false, refreshRequested = false, dailyLimitReached = false;
let writes = Promise.resolve(), rollover, lastSpokenEntry = '', lastRenderedEntry = '', lastFocusedEntry = '';
const clone = value => JSON.parse(JSON.stringify(value));
const ledgerKey = (user, day) => `practice:v2:${encodeURIComponent(user)}:${day}`;
const activePointerKey = user => `session:active:${encodeURIComponent(user)}`;
const scopeKey = (user, day, scope) => `session:v2:${JSON.stringify([user, day, ...scope])}`;
const scopePointerKey = (user, scope) => `session:scope:${JSON.stringify([user, ...scope])}`;
const currentScope = () => [context.reviewMode, context.activeTopic, context.activeSpecialCollection];
const actionsBlocked = () => busy || loading;
const practiceIsVisible = card => card && $('view-review')?.classList.contains('hidden') === false && !card.closest('[inert]');
const entry = wordId => ({ wordId, entryId: newId(), revealed: false, graded: false });
const limitFields = { 'setting-daily-new-limit': 'dailyNewLimit', 'setting-daily-review-limit': 'dailyReviewLimit' };
export function getSessionState() { return session && clone(session); }
function syncLegacyState() {
  const byId = new Map(context.wordsData.map(word => [word.id, word]));
  context.activeSessionWords = session ? session.cardQueue.map(item => byId.get(item.wordId)).filter(Boolean) : [];
  context.sessionCurrentIndex = session?.queueIndex || 0;
  context.sessionCompleted = !!session && session.queueIndex >= session.cardQueue.length && session.pendingMisses.length === 0;
  const remaining = new Set();
  for (const item of session?.cardQueue.slice(session.queueIndex) ?? []) {
    if (!item.graded && byId.has(item.wordId)) remaining.add(item.wordId);
  }
  setText('badge-review-count', remaining.size);
}
function persist(next) {
  const ticket = generation;
  const expected = next.sessionVersion || 0;
  next.sessionVersion = expected + 1;
  const snapshot = clone(next);
  writes = writes.catch(() => {}).then(() => {
    if (ticket !== generation || snapshot.username !== context.currentUser) return;
    return updateMetadata([snapshot.key], values => {
      if ((values[snapshot.key]?.sessionVersion || 0) !== expected) throw new Error('This session changed in another tab. Reload this card.');
      return { records: [snapshot], result: snapshot };
    });
  });
  return writes;
}
function notifyFailure(error) { console.error(error); context.showToast(error.message || 'Could not save practice progress.', 'error'); }
export function resetForUser() {
  generation++; session = null; busy = false; loading = false; refreshRequested = false;
  dailyLimitReached = false;
  const checkMore = $('btn-session-restart');
  if (checkMore) checkMore.disabled = false;
  lastSpokenEntry = ''; lastRenderedEntry = ''; lastFocusedEntry = '';
  pronunciation.cancel(); clearTimeout(rollover);
  for (const id of ['recall-answer-input', 'fc-front-word', 'fc-front-topic-badge', 'fc-word-meta', 'fc-front-context', 'fc-prompt-collocations',
    'fc-answer-target', 'fc-back-meaning', 'fc-back-sense', 'fc-answer-context', 'fc-back-synonyms-list', 'fc-collocations', 'recall-feedback']) {
    const element = $(id);
    if (element?.tagName === 'INPUT') element.value = '';
    else if (element) element.textContent = '';
  }
  renderActiveCard();
}
function matchingSessionKey(key, user, scope) {
  if (typeof key !== 'string' || !key.startsWith('session:v2:')) return false;
  try {
    const [owner, day, ...storedScope] = JSON.parse(key.slice('session:v2:'.length));
    return owner === user && /^\d{4}-\d{2}-\d{2}$/.test(day) && JSON.stringify(storedScope) === JSON.stringify(scope);
  } catch { return false; }
}
function adjustDirection(next, direction) {
  if ((next.recallDirection || 'en-vi') === direction) return next;
  const cardQueue = [...next.cardQueue], item = cardQueue[next.queueIndex];
  if (item && !item.graded) cardQueue[next.queueIndex] = { ...item, revealed: false, answerCorrect: false, answerAttempt: '', assisted: false };
  return { ...next, recallDirection: direction, cardQueue };
}
function reconcileQueue(saved, words, selection, day, direction, inClassMisses, priorityIds) {
  const byId = new Map(words.map(word => [word.id, word]));
  const candidates = [...selection.review, ...selection.fresh];
  const eligibleIds = new Set(candidates.map(word => word.id));
  const pendingMisses = [...new Set([...saved.pendingMisses.filter(id => byId.has(id) && !(byId.get(id).lastGrade > 0)), ...inClassMisses])];
  const missing = new Set(pendingMisses);
  const cardQueue = [];
  let queueIndex = 0;
  saved.cardQueue.forEach((item, index) => {
    if (!byId.has(item.wordId)) return;
    if (index < saved.queueIndex) queueIndex++;
    else if (!item.graded && !eligibleIds.has(item.wordId) && !missing.has(item.wordId)) return;
    cardQueue.push(item);
  });
  const queued = new Set(cardQueue.slice(queueIndex).filter(item => !item.graded).map(item => item.wordId));
  for (const id of [...pendingMisses, ...candidates.map(word => word.id)]) {
    if (!queued.has(id)) { cardQueue.push(entry(id)); queued.add(id); }
  }
  if (priorityIds.length) {
    const priority = new Set(priorityIds);
    const tail = cardQueue.splice(queueIndex);
    const isPriority = item => !item.graded && priority.has(item.wordId);
    cardQueue.push(...tail.filter(isPriority), ...tail.filter(item => !isPriority(item)));
  }
  if (day === saved.day && direction === (saved.recallDirection || 'en-vi') && queueIndex === saved.queueIndex &&
      pendingMisses.length === saved.pendingMisses.length && pendingMisses.every((id, i) => id === saved.pendingMisses[i]) &&
      inClassMisses.length === (saved.inClassMisses?.length || 0) && inClassMisses.every((id, i) => id === saved.inClassMisses[i]) &&
      cardQueue.length === saved.cardQueue.length &&
      cardQueue.every((item, i) => item === saved.cardQueue[i])) return saved;
  const next = { ...saved, day, ledgerKey: ledgerKey(saved.username, day), queueIndex, cardQueue, pendingMisses, inClassMisses,
    sessionVersion: (saved.sessionVersion || 0) + 1 };
  return adjustDirection(next, direction);
}
export async function startNewSession(options = {}) {
  const user = context.currentUser;
  if (!user) return;
  if (busy) { refreshRequested = true; return; }
  const requestedMisses = options.inClassMisses || [];
  const ticket = ++generation;
  const isCurrent = () => ticket === generation && user === context.currentUser;
  loading = true;
  try {
    if (options.restore) {
      const active = await idbGet('metadata', activePointerKey(user));
      if (!isCurrent()) return;
      if (active && (!active.username || active.username === user) && ['learning', 'review', 'favorites'].includes(active.mode)) {
        context.reviewMode = active.mode;
        context.activeTopic = typeof active.topic === 'string' ? active.topic : 'ALL';
        context.activeSpecialCollection = active.special === 'FAVORITES' ? active.special : null;
      }
    }
    await writes.catch(() => {});
    if (!isCurrent()) return;
    const now = Date.now(), day = calendarDay(now), scope = requestedMisses.length ? ['review', 'ALL', null] : currentScope();
    const [mode, topic, special] = scope;
    const key = scopeKey(user, day, scope), scopeId = scopePointerKey(user, scope), dayLedgerKey = ledgerKey(user, day);
    const pointer = await idbGet('metadata', scopeId);
    if (!isCurrent()) return;
    const savedKey = matchingSessionKey(pointer?.sessionKey, user, scope) ? pointer.sessionKey : key;
    const active = { key: activePointerKey(user), username: user, mode, topic, special };
    const next = await updateMetadata([...new Set([key, savedKey, dayLedgerKey])], values => {
      if (!isCurrent()) return { records: [], result: null };
      const words = context.wordsData.filter(word => word.username === user && !word.deleted);
      const saved = [values[savedKey], values[key]].find(record => record?.username === user && record.schemaVersion === 2 &&
        (record.day === day || record.queueIndex < record.cardQueue.length || record.pendingMisses.length));
      const availableIds = new Set(words.map(word => word.id));
      const priorityIds = requestedMisses.filter(id => availableIds.has(id));
      if (requestedMisses.length && !priorityIds.length) return { records: [], result: null };
      const inClassMisses = [...new Set([...(saved?.inClassMisses || []), ...priorityIds])].filter(id => availableIds.has(id));
      const preferredIds = saved?.cardQueue.slice(saved.queueIndex).filter(item => !item.graded).map(item => item.wordId);
      const settings = loadSettings(user), ledger = values[dayLedgerKey];
      const selection = selectPracticeWords(words, { mode, topic, favorites: mode === 'favorites' || special === 'FAVORITES', now,
        ledger: !ledger?.username || ledger.username === user ? ledger : null, settings, preferredIds,
        retryIds: [...(saved?.pendingMisses || []), ...inClassMisses] });
      const direction = settings.recallDirection;
      const result = saved ? reconcileQueue(saved, words, selection, day, direction, inClassMisses, priorityIds) : {
        key, scopeId, schemaVersion: 2, sessionId: `${encodeURIComponent(user)}:${newId()}`, username: user, day, ledgerKey: dayLedgerKey,
        cardQueue: [...inClassMisses, ...selection.review.map(word => word.id), ...selection.fresh.map(word => word.id)].map(entry),
        queueIndex: 0, sessionVersion: 0, pendingMisses: inClassMisses, inClassMisses,
        completedAttempts: 0, successfulIds: [], createdAt: now, recallDirection: direction
      };
      const records = result === saved ? [] : [result];
      if (!options.refresh || result.key !== session?.key) records.push({ ...active, sessionKey: result.key }, { key: scopeId, username: user, sessionKey: result.key });
      return { records, result: { session: result, limited: selection.limited, queued: priorityIds.length } };
    });
    if (!isCurrent() || !next) return 0;
    if (next.queued) {
      context.reviewMode = mode;
      context.activeTopic = topic;
      context.activeSpecialCollection = special;
      context.updateTopicDropdowns();
    }
    session = next.session;
    dailyLimitReached = next.limited;
    clearTimeout(rollover);
    const midnight = new Date(); midnight.setHours(24, 0, 0, 20);
    rollover = setTimeout(() => { void startNewSession(); }, midnight.getTime() - Date.now());
    return next.queued;
  } catch (error) {
    if (requestedMisses.length) throw error;
    if (isCurrent()) notifyFailure(error);
  }
  finally {
    if (isCurrent()) {
      loading = false; renderActiveCard(); renderSettings();
      runRequestedRefresh();
    }
  }
}
export function queueInClassMisses(ids, username) {
  if (!username || username !== context.currentUser) return 0;
  if (actionsBlocked()) throw new Error('Practice is still updating. Try again in a moment.');
  return startNewSession({ inClassMisses: [...new Set(ids)] });
}
export async function reconcileSession() {
  if (actionsBlocked()) { refreshRequested = true; return; }
  if (session?.username === context.currentUser) await startNewSession({ refresh: true });
}
function runRequestedRefresh() {
  if (refreshRequested) { refreshRequested = false; void reconcileSession(); }
}
function finishAction(ticket) {
  if (ticket !== generation) return;
  busy = false; renderActiveCard(); runRequestedRefresh();
}
function current() { return session?.cardQueue[session.queueIndex]; }
function show(id, visible) { const element = $(id); if (element) { element.hidden = !visible; element.classList.toggle('hidden', !visible); } }
function setText(id, value) { if ($(id)) $(id).textContent = value; }
function reverseMode() { return session?.recallDirection === 'vi-en'; }
function renderSentence(container, sentence, word, cloze = false) {
  if (!container) return;
  container.replaceChildren();
  for (const part of targetSegments(sentence, word, { inflections: true })) {
    if (!part.target) container.append(document.createTextNode(part.text));
    else { const mark = document.createElement('mark'); mark.textContent = cloze ? '[ _____ ]' : part.text; container.append(mark); }
  }
}
export function canGradeRecall(grade) {
  const item = current();
  return !actionsBlocked() && !!item?.revealed && !item.graded &&
    (!reverseMode() || grade === 0 || (item.answerCorrect === true && !item.assisted));
}
export function renderActiveCard() {
  syncLegacyState();
  updatePracticeScope();
  const card = $('practice-card');
  if (!card) return;
  const item = current(), word = item && context.wordsData.find(w => w.id === item.wordId);
  const visibleView = practiceIsVisible(card);
  const reverse = session ? reverseMode() : loadSettings(context.currentUser).recallDirection === 'vi-en';
  const renderedKey = word ? `${session.sessionId}:${item.entryId}:${reverse}` : '';
  if (lastRenderedEntry !== renderedKey) {
    pronunciation.cancel(); lastFocusedEntry = ''; lastRenderedEntry = renderedKey;
    const content = card.querySelector('.recall-card-content');
    if (content) content.scrollTop = 0;
    if ($('recall-answer-input')) $('recall-answer-input').value = '';
  }
  show('practice-card', !!word); show('retrieval-controls', !!word); show('card-empty-state', !word);
  renderRecallSelector(reverse ? 'vi-en' : 'en-vi');
  if (!word) {
    pronunciation.cancel();
    setText('empty-state-title', session?.cardQueue.length ? 'Practice complete' : dailyLimitReached ? 'Daily limit reached' : 'No cards ready in this view');
    setText('empty-state-subtitle', dailyLimitReached ? 'More cards are ready after your daily limit resets. You can also change the limit in Practice & Progress.' :
      context.reviewMode === 'review' ? 'No reviews are due in this selection. You can switch to Daily practice for new words.' :
      'Check for newly due cards, choose another topic, or add new words.');
    show('empty-state-subtitle', true); show('session-stats-box', !!session?.cardQueue.length);
    setText('stat-known-count', session?.successfulIds.length || 0); setText('stat-unknown-count', session?.pendingMisses.length || 0);
    return;
  }
  card.dataset.recallDirection = reverse ? 'vi-en' : 'en-vi';
  setText('fc-front-word', reverse ? word.meaning : word.word); $('fc-front-word').lang = reverse ? 'vi' : 'en'; setText('fc-front-topic-badge', word.topic);
  setText('fc-word-meta', word.pos || '');
  setText('card-num-front', `${session.queueIndex + 1} / ${session.cardQueue.length}`);
  if (reverse && word.clozeSentence?.includes('[ _____ ]') && !targetSegments(word.clozeSentence, word.word, { inflections: true }).some(part => part.target)) {
    const prompt = $('fc-front-context'); prompt.replaceChildren();
    word.clozeSentence.split('[ _____ ]').forEach((part, i) => {
      if (i) { const blank = document.createElement('mark'); blank.textContent = '[ _____ ]'; prompt.append(blank); }
      prompt.append(document.createTextNode(part));
    });
  } else renderSentence($('fc-front-context'), word.exampleSentence, word.word, true);
  show('fc-prompt-collocations', reverse && word.collocations.length > 0);
  setText('fc-prompt-collocations', word.collocations.map(value => clozeText(value, word.word, { inflections: true })).join(' · '));
  const inputVisible = reverse && !item.revealed && !item.graded;
  show('reverse-recall-form', inputVisible);
  $('recall-answer-input').disabled = actionsBlocked(); $('reverse-recall-form').querySelector('button').disabled = actionsBlocked();
  show('fc-answer', item.revealed); $('fc-answer').setAttribute('aria-hidden', String(!item.revealed));
  setText('fc-answer-label', reverse ? 'English target' : 'Meaning');
  show('fc-answer-target', reverse && item.revealed);
  setText('fc-answer-target', reverse && item.revealed ? word.word : '');
  setText('fc-back-meaning', word.meaning); setText('fc-back-sense', word.sense);
  setText('fc-back-synonyms-list', (word.synonyms || [word.synonym1, word.synonym2]).filter(Boolean).join(' · '));
  setText('fc-collocations', word.collocations.join(' · '));
  renderSentence($('fc-answer-context'), word.exampleSentence, word.word);
  const source = $('fc-answer-source'), sourceUrl = exampleSourceUrl(word.exampleSourceId);
  if (source) {
    if (sourceUrl) source.href = sourceUrl;
    else source.removeAttribute('href');
    show('fc-answer-source', !!sourceUrl && item.revealed);
  }
  const feedback = !reverse || !item.revealed ? '' : item.graded && item.answerCorrect === false ?
    `Not quite. The answer is “${word.word}”. It is queued for another try.` : item.assisted ?
    'Answer hinted. Choose Again for a fresh recall attempt.' : item.answerCorrect ? 'Correct. Choose your recall grade.' : 'Answer shown. Choose Again to practise it.';
  show('recall-feedback', !!feedback); setText('recall-feedback', feedback);
  $('recall-feedback').dataset.correct = String(item.answerCorrect === true && !item.assisted);
  setText('recall-instruction', item.graded ? 'Continue when you have reviewed the answer.' : reverse ?
    (item.revealed ? 'Recall feedback' : 'Recall the English word from its meaning and context.') :
    (item.revealed ? 'Grade your first recall attempt honestly.' : 'Recall the meaning before flipping.'));
  const flip = $('btn-fc-reveal'), flipLabel = item.revealed ? 'Hide answer (Space)' : 'Flip card (Space)';
  flip.disabled = actionsBlocked();
  flip.setAttribute('aria-label', flipLabel); flip.title = flipLabel;
  flip.setAttribute('aria-expanded', String(!!item.revealed));
  const wordButton = $('fc-front-word');
  wordButton.disabled = actionsBlocked();
  wordButton.title = flipLabel;
  wordButton.setAttribute('aria-expanded', String(!!item.revealed));
  for (const id of ['btn-fc-fav', 'btn-fc-sound', 'btn-fc-edit', 'btn-fc-delete']) $(id).disabled = actionsBlocked();
  for (const button of document.querySelectorAll('[data-recall-grade]')) {
    button.hidden = Boolean(item.graded);
    button.disabled = !canGradeRecall(Number(button.dataset.recallGrade));
  }
  $('btn-fc-previous').disabled = actionsBlocked() || session.queueIndex === 0;
  $('btn-fc-next').hidden = !item.graded;
  $('btn-fc-next').disabled = actionsBlocked();
  updateCardFavoriteVisual(word.isFavorite);
  if (visibleView && !reverse && lastSpokenEntry !== renderedKey) {
    lastSpokenEntry = renderedKey;
    if (loadSettings(context.currentUser).autoPronounce) void pronunciation.say(word);
  }
  if (!inputVisible) lastFocusedEntry = '';
  if (visibleView && inputVisible && !actionsBlocked() && lastFocusedEntry !== renderedKey) {
    $('recall-answer-input').focus({ preventScroll: true });
    if (document.activeElement === $('recall-answer-input')) lastFocusedEntry = renderedKey;
  }
}
export async function setRecallDirection(direction) {
  const user = context.currentUser;
  if (!user || !['en-vi', 'vi-en'].includes(direction)) return;
  if (actionsBlocked()) { renderActiveCard(); renderSettings(); return; }
  busy = true;
  const ticket = generation;
  try {
    if (session) {
      const next = adjustDirection(session, direction);
      if (next !== session) {
        await persist(next);
        if (ticket !== generation) return;
        session = next;
      }
    }
    saveSettings(user, { ...loadSettings(user), recallDirection: direction });
  } catch (error) { if (ticket === generation) notifyFailure(error); }
  finally { finishAction(ticket); if (ticket === generation) renderSettings(); }
}
export async function submitReverseAnswer() {
  const item = current(), word = context.wordsData.find(w => w.id === item?.wordId);
  if (!reverseMode() || actionsBlocked() || !word || item.revealed || item.graded) return;
  const answer = $('recall-answer-input').value;
  if (!answer.trim()) { $('recall-answer-input').focus(); return; }
  if (!matchesRecallAnswer(answer, word)) {
    const ticket = generation;
    await gradeRecall(0, { submission: answer, holdCard: true });
    if (ticket === generation && current()?.graded) $('btn-fc-next').focus({ preventScroll: true });
    return;
  }
  busy = true;
  const ticket = generation, user = context.currentUser, navigation = context.navigationGeneration, next = clone(session);
  Object.assign(next.cardQueue[next.queueIndex], { revealed: true, answerCorrect: true, answerAttempt: answer });
  try { await persist(next); if (ticket === generation && user === context.currentUser) session = next; }
  catch (error) { if (ticket === generation) notifyFailure(error); }
  finally { finishAction(ticket); }
  if (ticket !== generation || session !== next || user !== context.currentUser ||
      navigation !== context.navigationGeneration || !practiceIsVisible($('practice-card'))) return;
  if (!document.hidden && loadSettings(user).autoPronounce) void pronunciation.say(word);
  document.querySelector(`[data-recall-grade="${current().assisted ? 0 : 2}"]`)?.focus({ preventScroll: true });
}
async function useWordHint(action) {
  const item = current(), word = context.wordsData.find(w => w.id === item?.wordId); if (!word || actionsBlocked()) return;
  if (reverseMode() && !item.revealed && !item.graded && !item.assisted) {
    busy = true; const ticket = generation, next = clone(session); next.cardQueue[next.queueIndex].assisted = true;
    try { await persist(next); if (ticket === generation) { session = next; action(word); } }
    catch (error) { if (ticket === generation) notifyFailure(error); }
    finally { finishAction(ticket); }
  } else action(word);
}
export function replayCurrentAudio() { return useWordHint(playAudio); }
export async function revealCard() {
  if (actionsBlocked() || !current()) return;
  if (session.day !== calendarDay()) { await startNewSession(); return; }
  busy = true; const ticket = generation, next = clone(session);
  const item = next.cardQueue[next.queueIndex];
  if (reverseMode() && !item.graded && !item.revealed && !item.answerCorrect) item.assisted = true;
  item.revealed = !item.revealed;
  try { await persist(next); if (ticket === generation) session = next; }
  catch (error) { if (ticket === generation) notifyFailure(error); }
  finally { finishAction(ticket); }
}
export async function gradeRecall(grade, { submission = null, holdCard = false } = {}) {
  const item = current();
  if (actionsBlocked() || !item || item.graded || ![0, 1, 2, 3].includes(grade)) return;
  if (!canGradeRecall(grade) && !(reverseMode() && grade === 0 && submission !== null && !item.revealed)) return;
  if (session.day !== calendarDay()) { await startNewSession(); return; }
  const word = context.wordsData.find(w => w.id === item.wordId); if (!word) return;
  busy = true; renderActiveCard();
  const ticket = generation, user = context.currentUser, next = clone(session), graded = next.cardQueue[next.queueIndex];
  try {
    await writes.catch(() => {});
    if (ticket !== generation || user !== context.currentUser) return;
    const now = Date.now();
    if (next.day !== calendarDay(now)) { refreshRequested = true; return; }
    const scheduled = scheduleReview(word, grade, now);
    const kind = isNewWord(word) ? 'new' : 'review';
    const settings = loadSettings(user);
    const limit = (kind === 'new' ? settings.dailyNewLimit : settings.dailyReviewLimit) ?? null;
    const retry = next.pendingMisses.includes(word.id);
    graded.graded = true; graded.grade = grade; graded.revealed = true; next.completedAttempts++;
    if (submission !== null) Object.assign(graded, { answerAttempt: submission, answerCorrect: false });
    if (grade === 0) {
      if (!next.pendingMisses.includes(word.id)) next.pendingMisses.push(word.id);
      next.cardQueue.splice(Math.min(next.cardQueue.length, next.queueIndex + 4), 0, entry(word.id));
    } else {
      next.pendingMisses = next.pendingMisses.filter(id => id !== word.id);
      if (next.inClassMisses) next.inClassMisses = next.inClassMisses.filter(id => id !== word.id);
      if (!next.successfulIds.includes(word.id)) next.successfulIds.push(word.id);
    }
    if (!holdCard) next.queueIndex++;
    const ledger = { key: next.ledgerKey, username: user, recallAttempt: { wordId: word.id, success: grade > 0, kind, limit, retry } };
    // No cloud wait: the word, outbox record and exact next card are one commit.
    await context.commitVocabularyChanges([{ id: word.id, patch: { ...scheduled, lastRecallDirection: next.recallDirection || 'en-vi' }, expectedVersion: word }], [next, ledger], user);
    if (ticket !== generation || user !== context.currentUser) return;
    session = next; context.recordLearningActivity('recall_attempt');
  } catch (error) {
    if (ticket !== generation) return;
    if (error?.code === 'daily-limit') {
      refreshRequested = true;
      context.showToast('Your daily limit for these cards was reached. The queue will refresh.', 'error');
      try { await context.refreshVocabulary(user); }
      catch (refreshError) { console.warn('Could not refresh daily practice vocabulary:', refreshError); }
    } else notifyFailure(error);
  }
  finally { finishAction(ticket); }
}
async function stepCard(offset) {
  if (actionsBlocked() || !session) return;
  busy = true; const ticket = generation, next = clone(session); next.queueIndex += offset;
  try { await persist(next); if (ticket === generation) session = next; }
  catch (error) { if (ticket === generation) notifyFailure(error); }
  finally { finishAction(ticket); }
}
export function previousCard() { if (session?.queueIndex > 0) return stepCard(-1); }
function continueCard() { if (current()?.graded) return stepCard(1); }
async function deleteCurrentWord() {
  const item = current(), user = context.currentUser, ticket = generation;
  const word = context.wordsData.find(record => record.id === item?.wordId && record.username === user);
  if (actionsBlocked() || !word || !window.confirm('Delete this vocabulary item?') || ticket !== generation) return;
  busy = true;
  renderActiveCard();
  const next = clone(session);
  next.queueIndex = next.cardQueue.slice(0, next.queueIndex).filter(entry => entry.wordId !== word.id).length;
  next.cardQueue = next.cardQueue.filter(entry => entry.wordId !== word.id);
  next.pendingMisses = next.pendingMisses.filter(id => id !== word.id);
  if (next.inClassMisses) next.inClassMisses = next.inClassMisses.filter(id => id !== word.id);
  try {
    await context.commitVocabularyChanges([{ id: word.id, type: 'DELETE', expectedVersion: word }], [next], user);
    if (ticket === generation && user === context.currentUser) {
      session = next;
      context.updateTopicDropdowns();
      context.showToast('Word deleted.');
    }
  } catch (error) { if (ticket === generation) notifyFailure(error); }
  finally { finishAction(ticket); }
}
export function isWordEligibleForReview(word) { return isDue(word); }
export function updateCardFavoriteVisual(favorite) {
  $('btn-fc-fav')?.setAttribute('aria-pressed', String(favorite));
}
export function updateQuickCollectionButtonsUI() {}
export function playAudio(word) { context.recordLearningActivity('audio_pronounce'); return pronunciation.say(word); }
export function pausePracticeAudio() { lastFocusedEntry = ''; pronunciation.cancel(); }
function updatePracticeScope() {
  for (const [id, mode] of [['btn-mode-learning', 'learning'], ['btn-mode-review', 'review'], ['btn-bottom-fav', 'favorites']]) $(id)?.setAttribute('aria-pressed', String(context.reviewMode === mode));
  setText('review-selected-topic-label', `Topic: ${context.activeTopic === 'ALL' ? 'All topics' : context.activeTopic}`);
}
export function renderReviewTopicUpwardMenu(topics) {
  const list = $('review-topic-options-list'); if (!list) return; list.replaceChildren();
  for (const topic of ['ALL', ...topics]) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'topic-choice'; button.textContent = topic === 'ALL' ? 'All topics' : topic;
    button.addEventListener('click', () => { context.activeTopic = topic; $('review-topic-upward-menu').classList.add('hidden'); context.updateTopicDropdowns(); void startNewSession(); });
    list.append(button);
  }
  setText('review-topic-menu-count', `${topics.length} topics`);
}
function renderRecallSelector(direction) {
  const selector = $('recall-direction');
  if (!selector) return;
  selector.disabled = actionsBlocked() || !context.currentUser;
  for (const option of selector.querySelectorAll('input[name="recall-direction"]')) {
    option.checked = option.value === direction;
  }
}
export function renderSettings() {
  const settings = loadSettings(context.currentUser);
  if ($('setting-auto-pronounce')) $('setting-auto-pronounce').checked = settings.autoPronounce;
  if ($('setting-sound-effects')) $('setting-sound-effects').checked = settings.soundEffects;
  for (const [id, field] of Object.entries(limitFields)) {
    const input = $(id);
    if (input && input !== document.activeElement) input.value = settings[field] ?? '';
  }
  renderRecallSelector(settings.recallDirection);
}
export function setupPracticeControls() {
  $('btn-fc-reveal')?.addEventListener('click', () => void revealCard());
  const card = $('practice-card'), content = card.querySelector('.recall-card-content');
  const isIntentionalClick = trackIntentionalClicks(content, target => {
    const control = target.closest('form,button,a,input,select,textarea,[contenteditable]');
    return !control || control.id === 'fc-front-word' ? content : null;
  });
  content.addEventListener('click', event => { if (isIntentionalClick(event)) void revealCard(); });
  $('btn-fc-previous')?.addEventListener('click', () => void previousCard());
  $('btn-fc-next')?.addEventListener('click', () => void continueCard());
  for (const button of document.querySelectorAll('[data-recall-grade]')) button.addEventListener('click', () => void gradeRecall(Number(button.dataset.recallGrade)));
  $('btn-fc-sound')?.addEventListener('click', () => void replayCurrentAudio());
  $('btn-fc-edit')?.addEventListener('click', () => void useWordHint(word => {
    if (!$('view-review').classList.contains('hidden') && !card.closest('[inert]')) context.openWordEditor(word);
  }));
  $('btn-fc-delete')?.addEventListener('click', () => void deleteCurrentWord());
  $('btn-fc-fav')?.addEventListener('click', () => {
    if (!current() || actionsBlocked()) return;
    const ticket = generation;
    context.toggleWordFavorite(current().wordId).catch(error => { if (ticket === generation) notifyFailure(error); });
  });
  for (const [id, mode] of [['btn-mode-learning', 'learning'], ['btn-mode-review', 'review'], ['btn-bottom-fav', 'favorites']]) $(id)?.addEventListener('click', () => { if (busy) return; context.reviewMode = mode; void startNewSession(); });
  $('btn-review-topic-selector')?.addEventListener('click', () => $('review-topic-upward-menu').classList.toggle('hidden'));
  document.addEventListener('keydown', event => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.('input,textarea,select,[contenteditable="true"]') ||
      !$('drawer')?.classList.contains('-translate-x-full') || $('profile-dropdown')?.hidden === false || context.deckDialogOpen || $('modal-user-guide')?.hidden === false ||
      $('view-review')?.classList.contains('hidden') || !$('modal-login')?.classList.contains('hidden') || !$('modal-merge-topics')?.classList.contains('hidden')) return;
    if (event.code === 'Space' || event.key === ' ') {
      if (event.target.closest?.('button,a[href],summary,[role="button"]')) return;
      event.preventDefault(); void revealCard();
    }
    else if (/^[1-4]$/.test(event.key)) { event.preventDefault(); void gradeRecall(Number(event.key) - 1); }
    else if (event.key.toLowerCase() === 'r') { event.preventDefault(); void replayCurrentAudio(); }
  });
  $('reverse-recall-form')?.addEventListener('submit', event => { event.preventDefault(); void submitReverseAnswer(); });
  $('recall-direction')?.addEventListener('change', event => {
    const input = event.target;
    if (input.matches('input[name="recall-direction"]:checked')) void setRecallDirection(input.value);
  });
  document.addEventListener('lexicalspace:interactive', () => renderActiveCard());
  document.addEventListener('click', pronunciation.unlock, { capture: true });
  document.addEventListener('keydown', pronunciation.unlock, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pronunciation.cancel();
    else if (session && session.day !== calendarDay()) void startNewSession();
  });
  window.addEventListener('pagehide', pronunciation.cancel);
  $('setting-auto-pronounce')?.addEventListener('change', event => {
    const user = context.currentUser, input = event.target;
    if (!user) return;
    const previous = loadSettings(user);
    try {
      saveSettings(user, { ...previous, autoPronounce: input.checked });
      if (!input.checked) pronunciation.cancel();
    } catch (error) {
      input.checked = previous.autoPronounce;
      notifyFailure(error);
    }
  });
  $('setting-sound-effects')?.addEventListener('change', event => {
    const user = context.currentUser, input = event.target;
    if (!user) return;
    const previous = loadSettings(user);
    try {
      saveSettings(user, { ...previous, soundEffects: input.checked });
      context.SoundManager.loadForUser(user);
    } catch (error) {
      input.checked = previous.soundEffects;
      notifyFailure(error);
    }
  });
  for (const [id, field] of Object.entries(limitFields)) {
    $(id)?.addEventListener('change', event => {
      const user = context.currentUser, input = event.target;
      if (!user) return;
      const previous = loadSettings(user);
      const limit = input.value === '' ? null : input.valueAsNumber;
      if (!input.checkValidity() || (limit !== null && (!Number.isSafeInteger(limit) || limit < 0))) {
        input.value = previous[field] ?? '';
        context.showToast('Enter a whole number from zero, or leave it blank for unlimited.', 'error');
        return;
      }
      try {
        saveSettings(user, { ...previous, [field]: limit });
        void reconcileSession();
      } catch (error) {
        input.value = previous[field] ?? '';
        notifyFailure(error);
      }
    });
  }
}
export function setupSessionEndButtons() {
  $('btn-session-add-words')?.addEventListener('click', () => context.switchView('view-entry'));
  const checkMore = $('btn-session-restart');
  checkMore?.addEventListener('click', async () => {
    const user = context.currentUser, profile = context.accountGeneration, navigation = context.navigationGeneration;
    if (!user || context.profileLoading || checkMore.disabled) return;
    const isCurrentProfile = () => user === context.currentUser && profile === context.accountGeneration;
    const isCurrentView = () => isCurrentProfile() && navigation === context.navigationGeneration && !$('view-review').classList.contains('hidden');
    checkMore.disabled = true;
    try {
      await context.refreshVocabulary(user);
      if (isCurrentView() && !session) await startNewSession();
    } catch (error) {
      if (isCurrentView()) notifyFailure(error);
    } finally {
      if (isCurrentProfile()) checkMore.disabled = false;
    }
  });
}
