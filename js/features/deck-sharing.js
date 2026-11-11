import { context } from '../core/context.js';
import { fetchSharedDeck, importSharedDeck, prepareShareDeck, previewDeckImport, publishSharedDeck } from '../core/shared-decks.js';
import { validateImportTopic } from '../core/vocabulary.js';
import { renderImportTopicOptions } from './library.js';

const $ = id => document.getElementById(id);
const COPY_SUCCESS = 'Link đã được lưu vào clipboard!';
const sharing = new Set();
const shareKey = (profile, topic) => JSON.stringify([profile, topic]);
let pendingDeck, preview, shareButton, requestVersion = 0;
let importing = false;

function toggleDialog(id, open) {
  $(id).hidden = !open;
  context.deckDialogOpen = !$('modal-import-deck').hidden || !$('modal-share-link').hidden;
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
    : option?.value ? 'Use this topic in your library.' : 'Keep the sender’s topic name and any additional topic tags.';
}

function closeImport({ discard = true, restoreFocus = true } = {}) {
  requestVersion++;
  preview = null;
  if (discard) pendingDeck = null;
  toggleDialog('modal-import-deck', false);
  if (restoreFocus) context.focusNavigation();
}

function closeShareLink(restoreFocus = true) {
  toggleDialog('modal-share-link', false);
  $('shared-deck-url').value = '';
  if (restoreFocus && shareButton?.isConnected) shareButton.focus();
  shareButton = null;
}

export function resetDeckPreview() {
  if (importing) pendingDeck = null;
  importing = false;
  closeImport({ discard: false, restoreFocus: false });
  closeShareLink(false);
}

const copyLink = url => navigator.clipboard.writeText(url);

export function renderShareButton(topic, button) {
  const busy = sharing.has(shareKey(context.currentUser, topic));
  button.dataset.deckTopic = topic;
  button.disabled = busy;
  button.classList.toggle('is-sharing', busy);
  const label = busy ? 'Generating share link…' : 'Share Deck';
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
  let shareUrl, copied = false, errorMessage;
  try {
    if (!context.db) await context.connectCloud?.();
    if (!isCurrent()) return;
    if (!context.db) throw new Error('Connect to the internet to generate a share link.');
    const deck = await prepareShareDeck(user, topic);
    if (!isCurrent()) return;
    const deckId = await publishSharedDeck(context.db, deck);
    if (!isCurrent()) return;
    shareUrl = `${window.location.origin}${window.location.pathname}?deck=${encodeURIComponent(deckId)}`;
    try { await copyLink(shareUrl); copied = true; }
    catch { /* The published link is still available for manual copying. */ }
  } catch (error) {
    errorMessage = error.code === 'permission-denied'
      ? 'Firebase blocked publishing. Check that the shared deck rules are published.'
      : error.message || 'Could not generate the share link. Please try again.';
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
  if (copied) { context.showToast(COPY_SUCCESS, 'success'); return; }

  shareButton = button;
  const input = $('shared-deck-url');
  input.value = shareUrl;
  $('share-link-status').textContent = 'The link is ready. Copy it manually or try Copy Link.';
  toggleDialog('modal-share-link', true);
  input.focus();
  input.select();
  context.showToast('Deck shared, but clipboard access failed. Copy the link manually.', 'error');
}

export async function loadDeckFromLocation() {
  const deckId = new URLSearchParams(window.location.search).get('deck');
  if (deckId === null) return;
  try {
    pendingDeck = await fetchSharedDeck(context.db, deckId);
    window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
    await showPendingDeck();
  } catch (error) {
    context.showToast(error.message || 'Could not load the shared deck. Check the link and try again.', 'error');
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
  renderImportTopicOptions(topicSelect, `Keep sender’s topics (${deck.title})`);
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
  try { targetTopic = validateImportTopic(create ? newTopic.value : topicSelect.value); }
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
  $('shared-import-topic').addEventListener('change', updateImportTopicChoice);
  $('btn-confirm-deck-import').addEventListener('click', () => void confirmImport());
  $('btn-cancel-deck-import').addEventListener('click', () => { if (!importing) closeImport(); });
  $('btn-close-share-link').addEventListener('click', () => closeShareLink());
  $('btn-copy-share-link').addEventListener('click', async () => {
    const input = $('shared-deck-url'), ticket = context.accountGeneration;
    try {
      await copyLink(input.value);
      if (ticket !== context.accountGeneration || $('modal-share-link').hidden) return;
      context.showToast(COPY_SUCCESS, 'success');
      closeShareLink();
    }
    catch {
      if (ticket !== context.accountGeneration || $('modal-share-link').hidden) return;
      $('share-link-status').textContent = 'Select and copy the link manually.';
      input.focus();
      input.select();
      context.showToast('Clipboard access failed. Select and copy the link manually.', 'error');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!$('modal-import-deck').hidden && !importing) closeImport();
    else if (!$('modal-share-link').hidden) closeShareLink();
  });
}
