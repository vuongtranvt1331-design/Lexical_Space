import { context } from '../core/context.js';
import { fetchSharedDeck, importSharedDeck, prepareShareDeck, previewDeckImport, publishSharedDeck } from '../core/shared-decks.js';
import { validateImportTopic } from '../core/vocabulary.js';
import { renderImportTopicOptions } from './library.js';

const $ = id => document.getElementById(id);
const COPY_SUCCESS = 'Đã sao chép mã chia sẻ!';
const sharing = new Set();
const shareKey = (profile, topic) => JSON.stringify([profile, topic]);
let pendingDeck, preview, shareButton, requestVersion = 0;
let importing = false;

function toggleDialog(id, open) {
  $(id).hidden = !open;
  context.deckDialogOpen = !$('modal-import-deck').hidden || !$('modal-share-code').hidden;
  context.updateProfileLock();
}

function setImportStatus(text) {
  $('import-deck-status').textContent = text;
}

function updateImportTopicChoice() {
  const option = $('shared-import-topic').selectedOptions[0];
  const create = option?.hasAttribute('data-create-topic');
  const input = $('shared-import-new-topic');
  input.hidden = !create;
  $('shared-import-new-topic-label').hidden = !create;
  if (!create) input.value = '';
  $('shared-import-topic-help').textContent = create
    ? 'Create a new topic for this deck.'
    : option?.value ? 'Use this topic in your library.' : 'Use keywords for every imported word.';
}

function closeImport({ discard = true, restoreFocus = true } = {}) {
  requestVersion++;
  preview = null;
  if (discard) pendingDeck = null;
  toggleDialog('modal-import-deck', false);
  if (restoreFocus) context.focusNavigation();
}

function closeShareCode(restoreFocus = true) {
  toggleDialog('modal-share-code', false);
  $('shared-deck-code').value = '';
  if (restoreFocus && shareButton?.isConnected) shareButton.focus();
  shareButton = null;
}

export function resetDeckPreview() {
  pendingDeck = null; $('deck-code-status').textContent = ''; $('deck-code-input').value = '';
  importing = false;
  closeImport({ discard: false, restoreFocus: false });
  closeShareCode(false);
}

const copyCode = code => navigator.clipboard.writeText(code);

export function renderShareButton(topic, button) {
  const busy = sharing.has(shareKey(context.currentUser, topic));
  button.dataset.deckTopic = topic;
  button.disabled = busy;
  button.classList.toggle('is-sharing', busy);
  const label = busy ? 'Generating share code…' : 'Share Deck';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-busy', String(busy));
}

export async function shareTopic(topic, button) {
  const user = context.currentUser, ticket = context.accountGeneration;
  const key = shareKey(user, topic);
  if (sharing.has(key)) return;
  sharing.add(key);
  if (button) renderShareButton(topic, button);
  const isCurrent = () => ticket === context.accountGeneration && user === context.currentUser;
  let code, copied = false, errorMessage;
  try {
    if (!context.db) await context.connectCloud?.();
    if (!isCurrent()) return;
    if (!context.db) throw new Error('Connect to the internet to generate a share code.');
    const deck = await prepareShareDeck(user, topic);
    if (!isCurrent()) return;
    code = await publishSharedDeck(context.db, deck);
    if (!isCurrent()) return;
    try { await copyCode(code); copied = true; }
    catch { /* The published code is still available for manual copying. */ }
  } catch (error) {
    errorMessage = error.code === 'permission-denied'
      ? 'Firebase blocked publishing. Check that the shared deck rules are published.'
      : error.message || 'Could not generate the share code. Please try again.';
  } finally {
    sharing.delete(key);
    if (user === context.currentUser) {
      for (const control of document.querySelectorAll('[data-deck-action="share"]')) {
        if (control.dataset.deckTopic === topic) renderShareButton(topic, control);
      }
      if (button?.isConnected) renderShareButton(topic, button);
    }
  }
  if (!isCurrent()) return;
  if (errorMessage) { context.showToast(errorMessage, 'error'); return; }
  if (copied) context.showToast(COPY_SUCCESS, 'success');

  shareButton = button;
  const input = $('shared-deck-code');
  input.value = code;
  $('share-code-status').textContent = 'Valid for 72 hours. Enter this code in Add to your library → Code.';
  toggleDialog('modal-share-code', true);
  input.focus();
  input.select();
  if (!copied) context.showToast('Select and copy the code.', 'error');
}

export async function openDeckCode() {
  const code = $('deck-code-input').value.trim(), user = context.currentUser;
  const ticket = context.accountGeneration, version = ++requestVersion;
  const current = () => ticket === context.accountGeneration && version === requestVersion && user === context.currentUser;
  const status = $('deck-code-status');
  if (!/^\d{6}$/.test(code)) { status.textContent = 'Enter exactly six digits.'; return; }
  status.textContent = 'Checking code…';
  try {
    if (!context.db) await context.connectCloud?.();
    if (!current()) return;
    const deck = await fetchSharedDeck(context.db, code);
    if (!current()) return;
    pendingDeck = deck;
    status.textContent = '';
    await showPendingDeck();
  } catch (error) {
    if (current()) status.textContent = error.code === 'permission-denied' ? 'Code not found or expired.' : error.message;
  }
}

export async function showPendingDeck() {
  const user = context.currentUser, deck = pendingDeck, ticket = context.accountGeneration;
  if (!user || !deck || context.profileLoading || importing) return;
  const version = ++requestVersion;
  const isCurrent = () => version === requestVersion && ticket === context.accountGeneration && pendingDeck === deck;
  preview = null;
  $('import-deck-title').textContent = deck.title;
  $('import-deck-profile').textContent = user;
  $('import-deck-total').textContent = deck.wordCount;
  $('import-deck-new').textContent = '–';
  $('import-deck-existing').textContent = '–';
  $('btn-confirm-deck-import').disabled = true;
  $('btn-cancel-deck-import').disabled = false;
  const topicSelect = $('shared-import-topic'), newTopic = $('shared-import-new-topic');
  renderImportTopicOptions(topicSelect, 'keywords (default)');
  const createOption = document.createElement('option');
  createOption.dataset.createTopic = '';
  createOption.textContent = 'Create a new topic…';
  topicSelect.append(createOption);
  topicSelect.disabled = true; newTopic.disabled = true;
  updateImportTopicChoice();
  setImportStatus('Checking your library…');
  toggleDialog('modal-import-deck', true);
  $('btn-cancel-deck-import').focus();
  try {
    const counts = await previewDeckImport(user, deck);
    if (!isCurrent()) return;
    preview = { user, ticket, deck };
    $('import-deck-new').textContent = counts.added;
    $('import-deck-existing').textContent = counts.merged + counts.unchanged;
    $('btn-confirm-deck-import').disabled = counts.alreadyImported;
    topicSelect.disabled = counts.alreadyImported;
    newTopic.disabled = counts.alreadyImported;
    const duplicateSpellings = !counts.alreadyImported && counts.added + counts.merged + counts.unchanged < deck.wordCount;
    setImportStatus(counts.alreadyImported ? 'You already imported this deck.' :
      duplicateSpellings ? 'Duplicate spellings count once. Existing cards keep their review schedule.' : 'Existing cards keep their review schedule.');
  } catch (error) {
    if (isCurrent()) setImportStatus(error.message || 'Could not check your library.');
  }
}

async function confirmImport() {
  if (!preview || importing || preview.ticket !== context.accountGeneration) return;
  const topicSelect = $('shared-import-topic'), newTopic = $('shared-import-new-topic');
  if ($('btn-confirm-deck-import').disabled) return;
  const create = topicSelect.selectedOptions[0]?.hasAttribute('data-create-topic');
  if (create && !newTopic.value.trim()) {
    setImportStatus('Enter a name for the new topic.');
    newTopic.focus();
    return;
  }
  let targetTopic;
  try { targetTopic = validateImportTopic(create ? newTopic.value : (topicSelect.value || 'keywords')); }
  catch (error) { setImportStatus(error.message); if (create) newTopic.focus(); return; }
  const { user, deck, ticket } = preview;
  const version = requestVersion;
  const isCurrent = () => version === requestVersion && ticket === context.accountGeneration && pendingDeck === deck;
  importing = true;
  $('btn-confirm-deck-import').disabled = true;
  $('btn-cancel-deck-import').disabled = true;
  topicSelect.disabled = true; newTopic.disabled = true;
  setImportStatus('Importing deck…');
  let result;
  try {
    result = await importSharedDeck(user, deck, { targetTopic });
  } catch (error) {
    if (isCurrent()) {
      importing = false;
      $('btn-confirm-deck-import').disabled = false;
      $('btn-cancel-deck-import').disabled = false;
      topicSelect.disabled = false; newTopic.disabled = false;
      setImportStatus(error.message || 'The deck could not be imported. Try again.');
    }
    return;
  }
  if (!isCurrent()) return;
  importing = false;
  closeImport();
  context.showToast(result.alreadyImported ? 'You already imported this deck.' :
    `Deck imported to “${targetTopic || deck.title}”. ${result.added} added, ${result.merged} updated.`, 'success');
  try { await context.refreshVocabulary(user); }
  catch { if (ticket === context.accountGeneration) context.showToast('Deck saved. Reopen the library to refresh it.', 'error'); }
  finally { if (ticket === context.accountGeneration) void context.syncPendingOperations(); }
}

export function setupDeckSharing() {
  $('deck-code-form').addEventListener('submit', event => { event.preventDefault(); void openDeckCode(); });
  $('shared-import-topic').addEventListener('change', updateImportTopicChoice);
  $('btn-confirm-deck-import').addEventListener('click', () => void confirmImport());
  $('btn-cancel-deck-import').addEventListener('click', () => { if (!importing) closeImport(); });
  $('btn-close-share-code').addEventListener('click', () => closeShareCode());
  $('btn-copy-share-code').addEventListener('click', async () => {
    const input = $('shared-deck-code'), ticket = context.accountGeneration;
    try {
      await copyCode(input.value);
      if (ticket !== context.accountGeneration || $('modal-share-code').hidden) return;
      context.showToast(COPY_SUCCESS, 'success');
      closeShareCode();
    }
    catch {
      if (ticket !== context.accountGeneration || $('modal-share-code').hidden) return;
      $('share-code-status').textContent = 'Select and copy the code manually.';
      input.focus();
      input.select();
      context.showToast('Clipboard access failed. Select and copy the code manually.', 'error');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!$('modal-import-deck').hidden && !importing) closeImport();
    else if (!$('modal-share-code').hidden) closeShareCode();
  });
}
