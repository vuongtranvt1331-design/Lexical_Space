import { canSyncProfile, context } from '../core/context.js';
import { mutateWords, readUserWords, idbPut } from '../core/idb-manager.js';
import { exampleSourceUrl, recallLevelFor, validateVocabulary, wordTopics } from '../core/vocabulary.js';
import { icon } from '../core/icons.js';
import { targetSegments } from '../core/recall-utils.js';
import { trackIntentionalClicks } from '../utils/intentional-click.js';
const flippedCards = new Set();
const $ = id => document.getElementById(id);
const esc = value => context.escapeHtml(value);
const isActiveUser = (user, generation) => user === context.currentUser && generation === context.accountGeneration;
function report(error) { console.error(error); context.showToast(error.message || 'Could not save this change.', 'error'); }
function closeMergeModal() {
  const modal = $('modal-merge-topics');
  modal?.classList.add('hidden');
  modal?.classList.remove('flex');
}
export function resetLibraryForUser() {
  flippedCards.clear();
  context.libraryTab = 'unknown';
  context.librarySelectedTopic = 'ALL';
  context.userTopics = [];
  for (const id of ['lib-search-input', 'input-lib-topic-name', 'input-merge-new-name']) {
    if ($(id)) $(id).value = '';
  }
  for (const id of ['btn-lib-clear-search', 'lib-topic-create-box', 'lib-topic-upward-menu']) $(id)?.classList.add('hidden');
  for (const id of ['library-list-container', 'lib-topic-options-list', 'merge-topic-checkboxes']) $(id)?.replaceChildren();
  if ($('lib-count-status')) $('lib-count-status').textContent = 'Showing: 0 words';
  if ($('lib-selected-topic-label')) $('lib-selected-topic-label').textContent = 'Topic: All topics';
  if ($('lib-topic-menu-count')) $('lib-topic-menu-count').textContent = '0 topics';
  updateLibraryTabsUI();
  closeMergeModal();
}
export function loadUserTopics() {
  const user = context.currentUser;
  try {
    const saved = user ? JSON.parse(localStorage.getItem(`vocab_topics_${user}`) || '[]') : [];
    context.userTopics = Array.isArray(saved) ? saved.filter(topic => typeof topic === 'string') : [];
  }
  catch { context.userTopics = []; }
  if (!context.userTopics.includes(context.DEFAULT_TOPIC)) context.userTopics.unshift(context.DEFAULT_TOPIC);
}
export function saveUserTopics() {
  if (!context.currentUser) return;
  try { localStorage.setItem(`vocab_topics_${context.currentUser}`, JSON.stringify(context.userTopics)); }
  catch { /* Keep the active topics available when browser storage is restricted. */ }
}
export function addUserTopic(name) {
  const topic = String(name || '').trim();
  if (!context.currentUser || !topic) return false;
  if (!context.userTopics.includes(topic)) context.userTopics.push(topic);
  saveUserTopics(); updateTopicDropdowns(); return true;
}
export function checkAndCleanupEmptyTopics() {
  // Empty topics are intentional destinations for the next word; rendering must not delete them.
  context.userTopics = [...new Set([context.DEFAULT_TOPIC, ...context.userTopics, ...context.wordsData.flatMap(wordTopics)])];
}
export const sortTopicsNumericFirst = topics => [...topics].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' }));
export function getAlphabeticalTopics() { checkAndCleanupEmptyTopics(); return sortTopicsNumericFirst(context.userTopics); }
export function renderImportTopicOptions(select, defaultLabel) {
  select.replaceChildren();
  for (const [value, label] of [['', defaultLabel], ...getAlphabeticalTopics().map(topic => [topic, topic])]) {
    const option = document.createElement('option');
    option.value = value; option.textContent = label; select.append(option);
  }
}
export async function updateStudentMetadataCount() {
  if (context.currentUser) await idbPut('metadata', { key: `studentWordCount_${encodeURIComponent(context.currentUser)}`, count: context.wordsData.length });
  // Remote wordCount is updated in the same Firestore transaction as the word mutation.
}
export async function cleanupAndMigrateVocabularyData() {
  // Schema defaults are applied non-destructively by readUserWords/normalizeRemoteVocabulary.
  // Historical due/interval/repetition/easeFactor/review timestamps are never stripped.
}
export async function loadIndexedDBWordsData() {
  const user = context.currentUser;
  if (!user) return;
  const generation = context.accountGeneration;
  const ticket = ++context.userLoadGeneration;
  const isCurrent = () => isActiveUser(user, generation) && ticket === context.userLoadGeneration;
  try {
    const records = await readUserWords(user);
    if (!isCurrent()) return;
    context.wordsData = records; context.dbSyncError = null;
    updateTopicDropdowns();
    updateBadges();
    if (!$('view-library')?.classList.contains('hidden')) renderLibrary();
    await context.startNewSession({ restore: true });
  } catch (error) {
    if (!isCurrent()) return;
    context.dbSyncError = error;
    context.showToast('Storage unavailable. Your session has not been started.', 'error');
    return;
  }
  if (!isCurrent()) return;
  try {
    checkStudentVocabularyMetadata();
    void context.resumePendingActivitySyncForCurrentUser().catch(error => console.warn('Activity sync unavailable:', error));
    void context.syncPendingOperations();
  } catch (error) {
    console.warn('Cloud sync unavailable:', error);
    context.updateStatusBadge(false, 'Local library ready · sync unavailable');
  }
}
export function checkStudentVocabularyMetadata() {
  if (context.db && canSyncProfile(context.currentUser)) context.vocabularySync.start(context.currentUser);
}
export async function commitVocabularyChanges(changes, metadata = [], user = context.currentUser) {
  if (!user || user !== context.currentUser) throw new Error('The active profile changed before this edit could be saved.');
  const generation = context.accountGeneration;
  const prepared = changes.map(change => ({ ...change, username: user }));
  const records = await mutateWords(prepared, metadata);
  if (isActiveUser(user, generation)) {
    const byId = new Map(context.wordsData.map(w => [w.id, w]));
    records.forEach(w => w.deleted ? byId.delete(w.id) : byId.set(w.id, w));
    context.wordsData = [...byId.values()]; updateBadges();
    if (!$('view-library')?.classList.contains('hidden')) renderLibrary();
    context.updateStatusBadge(false, canSyncProfile(user) ? 'Saved locally · sync pending' : 'Guest library · saved on this device');
    void context.syncPendingOperations();
    if (!metadata.length) void context.reconcileSession().catch(error => { if (isActiveUser(user, generation)) report(error); });
  } else if (user === context.currentUser) {
    // The transaction finished after this profile was reopened. Read the latest
    // data for the new activation rather than applying an old in-memory patch.
    const currentGeneration = context.accountGeneration;
    void context.refreshVocabulary(user).catch(error => { if (isActiveUser(user, currentGeneration)) report(error); });
  }
  return records;
}
export function updateBadges() {
  if ($('badge-library-count')) $('badge-library-count').textContent = context.wordsData.length;
}
export function renderLibraryTopicUpwardMenu(topics) {
  const list = $('lib-topic-options-list'); if (!list) return;
  list.replaceChildren();
  for (const topic of new Set(['ALL', 'FAVORITES', ...topics])) {
    const row = document.createElement('div'); row.className = 'topic-option';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'topic-option-label';
    button.textContent = topic === 'ALL' ? 'All topics' : topic === 'FAVORITES' ? 'Favorites' : topic;
    button.addEventListener('click', () => { context.librarySelectedTopic = topic; $('lib-topic-upward-menu').classList.add('hidden'); renderLibrary(); updateTopicDropdowns(); });
    row.append(button);
    if (!['ALL', 'FAVORITES'].includes(topic)) {
      const actions = document.createElement('div');
      actions.className = 'topic-option-actions';
      actions.setAttribute('role', 'group');
      actions.setAttribute('aria-label', `${topic} deck actions`);
      const controls = [];
      if (topic !== context.DEFAULT_TOPIC) controls.push(['merge', 'Merge Decks', () => window.openMergeModalForTopic(topic)]);
      controls.push(['clear', 'Clear Topic Words', control => void clearTopicWords(topic, control)]);
      if (topic !== context.DEFAULT_TOPIC) controls.push(['delete', 'Delete Deck', () => window.deleteTopicDirectly(topic)]);
      controls.push(['share', 'Share Deck', control => context.shareTopic(topic, control)]);
      for (const [symbol, label, action] of controls) {
        const control = document.createElement('button');
        control.type = 'button';
        control.className = 'topic-option-action';
        control.dataset.deckAction = symbol;
        control.title = label;
        control.setAttribute('aria-label', label);
        control.innerHTML = icon(symbol === 'clear' ? 'again' : symbol);
        if (symbol === 'share') context.renderShareButton?.(topic, control);
        control.addEventListener('click', () => action(control));
        actions.append(control);
      }
      row.append(actions);
    }
    list.append(row);
  }
  $('lib-topic-menu-count').textContent = `${topics.length} topics`;
  $('lib-selected-topic-label').textContent = `Topic: ${context.librarySelectedTopic === 'ALL' ? 'All topics' : context.librarySelectedTopic}`;
}
export function updateTopicDropdowns() {
  const topics = getAlphabeticalTopics(); saveUserTopics();
  context.renderReviewTopicUpwardMenu(topics); context.renderEntryTopicCards(topics); renderLibraryTopicUpwardMenu(topics);
}
export async function toggleWordFavorite(id) {
  const word = context.wordsData.find(w => w.id === id); if (!word) return;
  await commitVocabularyChanges([{ id, patch: { isFavorite: !word.isFavorite } }]);
}
export async function editWord(id, patch) {
  const word = context.wordsData.find(w => w.id === id); if (!word) throw new Error('Word not found.');
  const validation = validateVocabulary({ ...word, ...patch }); if (!validation.valid) throw new Error(validation.errors.join(' '));
  return commitVocabularyChanges([{ id, expectedVersion: word, patch: validation.word }]);
}
export async function updateWordMemory(id, status) {
  if (status !== 'mastered' && status !== 'not_remembered') throw new Error('Invalid mastery status.');
  const word = context.wordsData.find(w => w.id === id); if (!word) return;
  const mastered = status === 'mastered';
  const patch = { masteryOverride: status, recallLevel: mastered ? 4 : 3, masteredReviewPending: mastered };
  await commitVocabularyChanges([{ id, expectedVersion: word, patch }]);
}
export function updateLibraryTabsUI() {
  for (const [id, tab] of [['btn-lib-tab-known', 'known'], ['btn-lib-tab-unknown', 'unknown'], ['btn-lib-tab-favorites', 'favorites']]) $(id)?.setAttribute('aria-pressed', String(context.libraryTab === tab));
}
export function renderVocabularyCardHtml(word) {
  const flipped = flippedCards.has(word.id), id = esc(word.id);
  const level = recallLevelFor(word);
  const gradeClass = level === null ? '' : ` grade-${level - 1}`;
  const mastered = word.memoryStatus === 'mastered';
  const status = mastered ? 'Mastered' : word.masteryOverride === 'not_remembered' ? 'Unknown' : word.reviewCount ? 'Learning' : 'New';
  const highlighted = targetSegments(word.exampleSentence, word.word, { inflections: true }).map(part => part.target ? `<mark>${esc(part.text)}</mark>` : esc(part.text)).join('');
  const sourceUrl = exampleSourceUrl(word.exampleSourceId);
  const actions = [
    { action: 'flip', label: 'Flip library card', pressed: flipped, controls: `library-flip-${id}` },
    { action: 'mastery', symbol: mastered ? 'again' : 'check', label: 'Mastered',
      title: mastered ? 'Mark as Unknown' : 'Mark as Mastered', pressed: mastered },
    { action: 'favorite', symbol: 'heart', label: 'Favorite word', pressed: Boolean(word.isFavorite) },
    { action: 'audio', label: 'Pronounce word' },
    { action: 'edit', label: 'Edit word' },
    { action: 'delete', label: 'Delete word' }
  ];
  const rail = actions.map(({ action, symbol, label, title = label, pressed, controls }) => {
    const toggle = pressed === undefined ? '' : ` aria-pressed="${pressed}"`;
    const controlsAttribute = controls ? ` aria-controls="${controls}"` : '';
    return `<button type="button" class="library-rail-button" data-action="${action}" data-id="${id}" aria-label="${label}" title="${title}"${toggle}${controlsAttribute}>${icon(symbol || action)}</button>`;
  }).join('');
  return `<article class="library-flip-card${gradeClass}${flipped ? ' is-flipped' : ''}" data-word-id="${id}" aria-label="${esc(word.word)} vocabulary card">
    <div class="library-toolbar" role="toolbar" aria-label="Word actions" aria-orientation="vertical">${rail}</div>
    <div class="library-flip-inner" id="library-flip-${id}">
      <section class="library-card-face library-card-front" aria-hidden="${flipped}"${flipped ? ' inert' : ''}>
        <div class="library-face-content">
          <div class="library-card-heading"><div>
            <p class="library-meta">${esc(word.pos)}</p>
            <h3>${esc(word.word)}</h3>
          </div></div>
          ${word.phonetic ? `<p class="library-phonetic">${esc(word.phonetic)}</p>` : ''}
          <p class="library-meaning" lang="vi">${esc(word.meaning)}</p>
          <div class="library-word-details"><h4>Synonyms</h4><p>${esc((word.synonyms || [word.synonym1, word.synonym2]).filter(Boolean).join(' · ')) || '—'}</p>
          <h4>Collocations</h4><p>${word.collocations.map(esc).join(' · ') || '—'}</p></div>
          <footer>${wordTopics(word).map(esc).join(' · ')} · ${status}</footer>
        </div>
      </section>
      <section class="library-card-face library-card-back" aria-hidden="${!flipped}"${!flipped ? ' inert' : ''}>
        <div class="library-face-content"><p class="library-meta">In context</p><h3>${esc(word.word)}</h3>
          <blockquote class="library-example">${highlighted || 'Add an example sentence using Edit.'}</blockquote>
          ${sourceUrl ? `<a class="example-source" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Example from Tatoeba</a>` : ''}
          <h4>Usage notes</h4><p class="library-usage">${esc(word.usageNotes) || 'No usage notes yet.'}</p>
          ${word.sense ? `<h4>Target sense</h4><p>${esc(word.sense)}</p>` : ''}
        </div>
      </section>
    </div>
  </article>`;
}
export function flipLibraryCard(id) {
  const card = [...($('library-list-container')?.querySelectorAll('.library-flip-card') || [])].find(card => card.dataset.wordId === id);
  if (!card) return;
  const flipped = card.classList.toggle('is-flipped');
  if (flipped) flippedCards.add(id);
  else flippedCards.delete(id);
  for (const face of card.querySelectorAll('.library-card-face')) {
    const hidden = face.classList.contains('library-card-front') ? flipped : !flipped;
    face.inert = hidden; face.toggleAttribute('inert', hidden); face.setAttribute('aria-hidden', String(hidden));
  }
  card.querySelector('[data-action="flip"]').setAttribute('aria-pressed', String(flipped));
}
export function renderLibrary() {
  updateLibraryTabsUI(); const container = $('library-list-container'); if (!container) return;
  const query = ($('lib-search-input')?.value || '').toLocaleLowerCase();
  $('btn-lib-clear-search')?.classList.toggle('hidden', !query);
  const activeButton = container.contains(document.activeElement) ? document.activeElement.closest('button[data-action]') : null;
  const filtered = context.wordsData.filter(w => (context.libraryTab !== 'known' || w.memoryStatus === 'mastered') &&
    (context.libraryTab !== 'unknown' || w.memoryStatus !== 'mastered') && (context.libraryTab !== 'favorites' || w.isFavorite) &&
    (context.librarySelectedTopic !== 'FAVORITES' || w.isFavorite) &&
    (['ALL', 'FAVORITES'].includes(context.librarySelectedTopic) || wordTopics(w).includes(context.librarySelectedTopic)) &&
    [w.word, w.meaning, w.sense, w.pos].some(v => v.toLowerCase().includes(query))).sort((a, b) => a.word.localeCompare(b.word));
  $('lib-count-status').textContent = `Showing: ${filtered.length} words`;
  container.innerHTML = filtered.length ? filtered.map(renderVocabularyCardHtml).join('') : '<p class="empty-library">No matching words. Add vocabulary or change your filters.</p>';
  if (activeButton) {
    const { id, action } = activeButton.dataset;
    const replacement = [...container.querySelectorAll('button[data-action]')].find(button => button.dataset.id === id && button.dataset.action === action);
    (replacement || $('lib-search-input'))?.focus({ preventScroll: true });
  }
}
export function setupLibraryModule() {
  for (const [id, tab] of [['btn-lib-tab-known', 'known'], ['btn-lib-tab-unknown', 'unknown'], ['btn-lib-tab-favorites', 'favorites']]) $(id)?.addEventListener('click', () => { context.libraryTab = tab; renderLibrary(); });
  $('btn-lib-create-topic')?.addEventListener('click', () => $('lib-topic-create-box').classList.toggle('hidden'));
  $('btn-close-lib-topic-box')?.addEventListener('click', () => $('lib-topic-create-box').classList.add('hidden'));
  $('btn-save-lib-topic')?.addEventListener('click', () => { if (addUserTopic($('input-lib-topic-name').value)) { $('input-lib-topic-name').value = ''; $('lib-topic-create-box').classList.add('hidden'); } });
  $('lib-search-input')?.addEventListener('input', renderLibrary);
  $('btn-lib-clear-search')?.addEventListener('click', () => { $('lib-search-input').value = ''; renderLibrary(); });
  $('btn-lib-topic-selector')?.addEventListener('click', () => $('lib-topic-upward-menu').classList.toggle('hidden'));
  const list = $('library-list-container');
  if (!list) return;
  const isIntentionalClick = trackIntentionalClicks(list, target => {
    if (target.closest('button,a,input,select,textarea,[contenteditable]')) return null;
    return target.closest('.library-card-face:not([inert])');
  });
  list.addEventListener('click', async event => {
    const flipFromFace = isIntentionalClick(event);
    const button = event.target.closest('button[data-action]');
    if (!button) {
      if (flipFromFace) flipLibraryCard(event.target.closest('.library-flip-card').dataset.wordId);
      return;
    }
    const word = context.wordsData.find(w => w.id === button.dataset.id); if (!word) return;
    const user = context.currentUser, generation = context.accountGeneration;
    try {
      if (button.dataset.action === 'mastery') await updateWordMemory(word.id, word.memoryStatus === 'mastered' ? 'not_remembered' : 'mastered');
      if (button.dataset.action === 'favorite') await toggleWordFavorite(word.id);
      if (button.dataset.action === 'flip') flipLibraryCard(word.id);
      if (button.dataset.action === 'audio') context.playAudio(word);
      if (button.dataset.action === 'delete') await window.deleteWordDirectly(word.id);
      if (button.dataset.action === 'edit') context.openWordEditor(word);
    } catch (error) { if (isActiveUser(user, generation)) report(error); }
  });
}
export function install_deleteWordDirectly() {
  window.deleteWordDirectly = async id => {
    if (!context.wordsData.some(word => word.id === id) || !confirm('Delete this vocabulary item?')) return;
    const user = context.currentUser, generation = context.accountGeneration;
    await commitVocabularyChanges([{ id, type: 'DELETE' }]);
    if (isActiveUser(user, generation)) updateTopicDropdowns();
  };
}
export function install_deleteTopicDirectly() {
  window.deleteTopicDirectly = async topic => {
    if (topic === context.DEFAULT_TOPIC) return clearTopicWords(topic);
    if (!context.currentUser || ['ALL', 'FAVORITES'].includes(topic) ||
      !confirm(`Delete "${topic}"? Words in other decks will stay in those decks. Words only in this deck will be deleted.`)) return;
    const user = context.currentUser, generation = context.accountGeneration;
    try {
      const changes = [];
      for (const word of context.wordsData) {
        const topics = wordTopics(word);
        if (!topics.includes(topic)) continue;
        const remaining = topics.filter(name => name !== topic);
        const change = { id: word.id, expectedVersion: word };
        changes.push(remaining.length ? { ...change, patch: { topic: remaining[0], topics: remaining } } : { ...change, type: 'DELETE' });
      }
      if (changes.length) await commitVocabularyChanges(changes);
      if (!isActiveUser(user, generation)) return;
      context.userTopics = context.userTopics.filter(t => t !== topic);
      if (context.librarySelectedTopic === topic) context.librarySelectedTopic = 'ALL';
      if (context.activeTopic === topic) context.activeTopic = 'ALL';
      updateTopicDropdowns(); renderLibrary();
    } catch (error) { if (isActiveUser(user, generation)) report(error); }
  };
}
export async function clearTopicWords(topic, control) {
  const user = context.currentUser, generation = context.accountGeneration;
  if (!user || !topic || ['ALL', 'FAVORITES'].includes(topic) || control?.disabled) return;
  if (control) control.disabled = true;
  try {
    const words = (await readUserWords(user)).filter(word => wordTopics(word).includes(topic));
    if (!isActiveUser(user, generation)) return;
    if (!words.length) { context.showToast('This topic is already empty.'); return; }
    if (!confirm(`Delete all ${words.length} vocabulary items in "${topic}"? This also removes these items from any other topics. The topic itself will stay.`)) return;
    await commitVocabularyChanges(words.map(word => ({ id: word.id, type: 'DELETE', expectedVersion: word })), [], user);
    if (!isActiveUser(user, generation)) return;
    addUserTopic(topic);
    context.refreshInClassCheckPool?.();
    context.showToast(`Cleared ${words.length} vocabulary items.`, 'success');
  } catch (error) { if (isActiveUser(user, generation)) report(error); }
  finally { if (control?.isConnected) control.disabled = false; }
}
export function setupMergeTopicsModal() {
  window.openMergeModalForTopic = topic => {
    if (!context.currentUser) return;
    const container = $('merge-topic-checkboxes'); container.replaceChildren();
    for (const name of getAlphabeticalTopics().filter(t => t !== context.DEFAULT_TOPIC)) {
      const label = document.createElement('label'), input = document.createElement('input'); input.type = 'checkbox'; input.value = name; input.checked = name === topic;
      label.append(input, document.createTextNode(name)); container.append(label);
    }
    $('input-merge-new-name').value = topic || ''; $('modal-merge-topics').classList.remove('hidden'); $('modal-merge-topics').classList.add('flex');
  };
  for (const id of ['btn-cancel-merge', 'btn-close-merge-modal']) $(id)?.addEventListener('click', closeMergeModal);
  $('btn-confirm-merge')?.addEventListener('click', async () => {
    const sources = [...$('merge-topic-checkboxes').querySelectorAll('input:checked')].map(i => i.value), topic = $('input-merge-new-name').value.trim();
    if (!context.currentUser || !sources.length || !topic || ['ALL', 'FAVORITES'].includes(topic)) return;
    const user = context.currentUser, generation = context.accountGeneration;
    const sourceSet = new Set(sources);
    try {
      const changes = [];
      for (const word of context.wordsData) {
        const topics = wordTopics(word);
        if (!topics.some(name => sourceSet.has(name))) continue;
        const merged = [...new Set(topics.map(name => sourceSet.has(name) ? topic : name))];
        changes.push({ id: word.id, expectedVersion: word, patch: { topic: merged[0], topics: merged } });
      }
      if (changes.length) await commitVocabularyChanges(changes);
      if (!isActiveUser(user, generation)) return;
      context.userTopics = context.userTopics.filter(t => !sources.includes(t));
      if (sourceSet.has(context.librarySelectedTopic)) context.librarySelectedTopic = topic;
      if (sourceSet.has(context.activeTopic)) context.activeTopic = topic;
      addUserTopic(topic);
      renderLibrary();
      closeMergeModal();
    } catch (error) { if (isActiveUser(user, generation)) report(error); }
  });
}
