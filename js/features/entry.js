import { context } from '../core/context.js';
import { validateVocabulary, senseKey, newId, wordTopics } from '../core/vocabulary.js';
import { buildAIPrompt, parseAIBatch } from '../core/ai-vocabulary.js';
import { DICTIONARY_NOT_FOUND, dictionaryDetails, quickFillCollocations, translateQuickFillWord } from '../core/quick-fill.js';
const $ = id => document.getElementById(id);
const fields = { word: 'input-word', phonetic: 'input-phonetic', pos: 'input-pos', meaning: 'confirm-input-meaning',
  collocations: 'input-collocations', synonyms: 'input-synonyms', exampleSentence: 'input-example', clozeSentence: 'input-cloze',
  sense: 'input-sense', usageNotes: 'input-usage-notes' };
const listFields = new Set(['collocations', 'synonyms']);
const contentFields = [...Object.keys(fields), 'topic', 'synonym1', 'synonym2'];
const newReviewState = () => ({ createdAt: Date.now(), dueDate: new Date().toISOString(), interval: 0, repetition: 0, easeFactor: 2.5,
  reviewCount: 0, successfulDays: [], memoryStatus: 'not_remembered', isFavorite: false });
const contentPatch = word => Object.fromEntries(contentFields.map(key => [key, word[key]]));
let editor = null, saving = false, importing = false, quickFillRequest;
function status(id, message = '', error = false) { const element = $(id); if (element) { element.textContent = message; element.dataset.error = String(error); } }
function asFieldValue(key, value) { return listFields.has(key) ? (Array.isArray(value) ? value.join(', ') : '') : String(value ?? ''); }
function formData() {
  const values = {};
  for (const [key, id] of Object.entries(fields)) {
    const value = $(id).value.trim(); values[key] = listFields.has(key) ? value.split(/[,;]+/).map(part => part.trim()).filter(Boolean) : value;
  }
  values.topic = $('select-entry-topic').value || context.DEFAULT_TOPIC;
  return values;
}
const viewIsVisible = id => $(id)?.classList.contains('hidden') === false;
const singleEntryIsVisible = () => viewIsVisible('view-entry') && $('entry-phase-1')?.hidden === false;
export function focusEntryWord() { if (singleEntryIsVisible()) $('input-word')?.focus({ preventScroll: true }); }
export function cancelQuickFill() {
  if (!quickFillRequest) return;
  quickFillRequest.abort();
  quickFillRequest = undefined;
  const button = $('btn-entry-quickfill');
  button.disabled = false;
  button.removeAttribute('aria-busy');
}
function clearForm() {
  cancelQuickFill(); editor = null;
  for (const id of Object.values(fields)) $(id).value = '';
  context.draftWord = { topic: context.DEFAULT_TOPIC };
  $('entry-details').open = false; $('inline-create-topic-box').hidden = true;
  $('entry-heading').textContent = 'Add to your library'; $('btn-confirm-save-text').textContent = 'Save word';
  status('quickfill-status'); renderEntryTopicCards();
}
export function renderEntryTopicCards(topics = context.getAlphabeticalTopics()) {
  const select = $('select-entry-topic'); if (!select) return;
  const selected = context.draftWord.topic || context.DEFAULT_TOPIC;
  select.replaceChildren();
  for (const topic of topics) {
    const option = document.createElement('option'); option.value = topic; option.textContent = topic; select.append(option);
  }
  select.value = topics.includes(selected) ? selected : context.DEFAULT_TOPIC;
}
export function openWordEditor(word) {
  cancelQuickFill();
  const returnView = ['view-library', 'view-review'].find(viewIsVisible);
  editor = { word, returnView };
  context.draftWord = { ...word };
  context.switchView('view-entry');
  for (const [key, id] of Object.entries(fields)) $(id).value = asFieldValue(key, word[key]);
  $('entry-heading').textContent = 'Edit vocabulary'; $('btn-confirm-save-text').textContent = 'Save changes'; $('entry-details').open = true;
  status('entry-save-status'); status('quickfill-status'); renderEntryTopicCards(); focusEntryWord();
}
export async function saveWord(input, id = editor?.word.id) {
  const ticket = context.accountGeneration, validation = validateVocabulary(input);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const previous = id && context.wordsData.find(word => word.id === id);
  if (id && !previous) throw new Error('This word was removed. Refresh the library.');
  if (context.wordsData.some(word => word.id !== id && senseKey(word) === senseKey(validation.word))) throw new Error('This word and sense already exist. Edit that item or choose another sense.');
  const patch = contentPatch(validation.word);
  if (!previous) Object.assign(patch, newReviewState());
  else if (patch.topic !== previous.topic) {
    const secondary = wordTopics(previous).filter(topic => topic !== previous.topic && topic !== patch.topic);
    patch.topics = [patch.topic, ...secondary];
  }
  const expectedVersion = previous && (id === editor?.word.id ? editor.word : previous);
  const [record] = await context.commitVocabularyChanges([{ id: id || `word_${newId()}`, patch, ...(expectedVersion ? { expectedVersion } : {}) }]);
  if (ticket === context.accountGeneration) context.addUserTopic(record.topic);
  return record;
}
export async function importVocabulary(entries, { overwrite = false } = {}) {
  const ticket = context.accountGeneration, unique = new Map(), changes = []; let skipped = 0, added = 0, updated = 0;
  for (const input of entries) {
    const result = validateVocabulary(input); if (!result.valid) throw new Error(result.errors.join(' '));
    unique.set(senseKey(result.word), result.word);
  }
  const existing = new Map(context.wordsData.map(word => [senseKey(word), word]));
  for (const word of unique.values()) {
    const previous = existing.get(senseKey(word));
    if (previous && !overwrite) { skipped++; continue; }
    const patch = contentPatch(word);
    if (previous) updated++; else { Object.assign(patch, newReviewState()); added++; }
    changes.push({ id: previous?.id || `word_${newId()}`, patch, ...(previous ? { expectedVersion: previous } : {}) });
  }
  // One commit for the complete validated batch and its outbox records.
  const records = changes.length ? await context.commitVocabularyChanges(changes) : [];
  if (ticket === context.accountGeneration) for (const topic of new Set(records.map(word => word.topic))) context.addUserTopic(topic);
  return { added, updated, skipped };
}
export async function quickFillEntry() {
  if (!context.currentUser) return;
  const word = $('input-word').value.trim(), ticket = context.accountGeneration, activeEditor = editor;
  if (!word || word.length > 200) { status('quickfill-status', 'Enter a target word or phrase first.', true); focusEntryWord(); return; }
  cancelQuickFill();
  function wordNotFound() {
    status('quickfill-status', DICTIONARY_NOT_FOUND, true);
    context.showToast(DICTIONARY_NOT_FOUND, 'error');
  }
  if (navigator.onLine === false) { wordNotFound(); return; }

  const controller = new AbortController(); quickFillRequest = controller;
  const options = { signal: controller.signal };
  const button = $('btn-entry-quickfill'), original = new Map(Object.values(fields).map(id => [id, $(id).value]));
  const current = () => quickFillRequest === controller && !controller.signal.aborted &&
    ticket === context.accountGeneration && activeEditor === editor && word === $('input-word').value.trim();
  let filled = false;
  const fill = (key, value) => {
    const id = fields[key], element = $(id), suggestion = asFieldValue(key, value);
    if (!current() || !suggestion || element.value !== original.get(id)) return;
    element.value = suggestion;
    filled = true;
  };
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  status('quickfill-status', 'Looking up dictionary, translation and collocation suggestions...');
  try {
    const translation = translateQuickFillWord(word, options).then(meaning => fill('meaning', meaning)).catch(() => {});
    const dictionary = await dictionaryDetails(word, options).catch(() => undefined);
    if (!current()) return;
    if (navigator.onLine === false) {
      wordNotFound();
      return;
    }
    if (dictionary === null) wordNotFound();
    if (dictionary) {
      fill('phonetic', dictionary.phonetic);
      fill('pos', dictionary.pos);
      fill('synonyms', dictionary.synonyms);
      fill('exampleSentence', dictionary.exampleSentence);
      if ($('input-example').value.trim() === dictionary.exampleSentence) fill('clozeSentence', dictionary.clozeSentence);
      $('entry-details').open = true;
    }
    const collocations = quickFillCollocations(word, $('input-pos').value, options)
      .then(pairs => fill('collocations', pairs)).catch(() => {});
    await Promise.all([translation, collocations]);
    if (!current()) return;
    if (filled) $('entry-details').open = true;
    if (dictionary === null) return;
    if (!dictionary && !filled) { wordNotFound(); return; }
    status('quickfill-status', filled ? 'Filled available details. Review before saving.' : 'No suggestions available. You can enter the details manually.', !filled);
  } finally {
    if (quickFillRequest === controller) cancelQuickFill();
  }
}
function showSavedLibraryCard(id) {
  context.switchView('view-library');
  const cards = $('library-list-container')?.querySelectorAll('[data-word-id]') || [];
  const card = [...cards].find(item => item.dataset.wordId === id);
  const focus = card?.querySelector('[data-action="edit"]') || $('lib-search-input');
  focus?.focus({ preventScroll: true });
  card?.scrollIntoView?.({ block: 'nearest' });
  context.showToast('Changes saved.');
}
export function setupEntryModule() {
  $('single-entry-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || !context.currentUser) return;
    saving = true;
    const ticket = context.accountGeneration, submittedEditor = editor, button = $('btn-confirm-save');
    const sameForm = () => ticket === context.accountGeneration && submittedEditor === editor;
    button.disabled = true;
    status('entry-save-status');
    try {
      const record = await saveWord(formData());
      if (!sameForm()) return;
      const stillEditing = singleEntryIsVisible();
      clearForm();
      if (submittedEditor?.returnView === 'view-library' && stillEditing) showSavedLibraryCard(record.id);
      else if (submittedEditor?.returnView === 'view-review' && stillEditing) {
        context.switchView('view-review');
        context.showToast('Changes saved.');
      } else { status('entry-save-status', 'Saved to your library.'); focusEntryWord(); }
    } catch (error) {
      if (sameForm()) status('entry-save-status', error.message, true);
    } finally {
      if (ticket === context.accountGeneration) { saving = false; button.disabled = false; }
    }
  });
  $('btn-entry-quickfill')?.addEventListener('click', () => void quickFillEntry());
  $('input-word')?.addEventListener('input', () => { cancelQuickFill(); status('quickfill-status'); status('entry-save-status'); });
  $('select-entry-topic')?.addEventListener('change', event => { context.draftWord.topic = event.target.value; });
  $('btn-quick-create-topic')?.addEventListener('click', () => { const box = $('inline-create-topic-box'); box.hidden = !box.hidden; if (!box.hidden) $('input-inline-topic-name').focus(); });
  $('btn-save-inline-topic')?.addEventListener('click', () => {
    const name = $('input-inline-topic-name').value.trim(); if (!context.addUserTopic(name)) return;
    context.draftWord.topic = name; $('input-inline-topic-name').value = ''; $('inline-create-topic-box').hidden = true; renderEntryTopicCards();
  });
}
function selectTab(ai) {
  $('entry-phase-1').hidden = ai; $('section-ai-library').hidden = !ai;
  $('btn-entry-single').setAttribute('aria-selected', String(!ai)); $('btn-toggle-ai-library').setAttribute('aria-selected', String(ai));
  if (ai) $('ai-raw-words').focus({ preventScroll: true }); else focusEntryWord();
}
export function setupQuickImport() {
  window.toggleAiLibrarySection = ai => selectTab(Boolean(ai));
  $('btn-entry-single')?.addEventListener('click', () => selectTab(false));
  $('btn-toggle-ai-library')?.addEventListener('click', () => selectTab(true));
  $('btn-copy-ai-prompt')?.addEventListener('click', async () => {
    const ticket = context.accountGeneration;
    let prompt;
    try { prompt = buildAIPrompt($('ai-raw-words').value); }
    catch (error) { status('batch-import-status', error.message, true); return; }
    try {
      await navigator.clipboard.writeText(prompt);
      if (ticket === context.accountGeneration) status('batch-import-status', 'Prompt copied. Paste it into your AI, then bring back the JSON.');
    } catch {
      if (ticket !== context.accountGeneration) return;
      const preview = $('ai-prompt-preview');
      preview.hidden = false; $('ai-prompt-preview-label').hidden = false; preview.value = prompt; preview.focus(); preview.select();
      status('batch-import-status', 'Clipboard unavailable. Copy the selected prompt manually.');
    }
  });
  $('btn-execute-import')?.addEventListener('click', async () => {
    if (importing || !context.currentUser) return;
    importing = true;
    const button = $('btn-execute-import'), ticket = context.accountGeneration;
    button.disabled = true;
    try {
      const entries = parseAIBatch($('import-raw-input').value, $('ai-raw-words').value);
      const result = await importVocabulary(entries, { overwrite: $('import-opt-overwrite').checked });
      if (ticket !== context.accountGeneration) return;
      status('batch-import-status', `${result.added} added · ${result.updated} updated · ${result.skipped} already in your library.`);
      $('import-raw-input').value = '';
    } catch (error) {
      if (ticket === context.accountGeneration) status('batch-import-status', error.message, true);
    } finally {
      if (ticket === context.accountGeneration) { importing = false; button.disabled = false; }
    }
  });
}
export function resetEntryForUser() {
  clearForm();
  saving = false; importing = false; quickFillRequest = null;
  for (const id of ['btn-confirm-save', 'btn-entry-quickfill', 'btn-execute-import']) $(id).disabled = false;
  for (const id of ['ai-raw-words', 'import-raw-input', 'ai-prompt-preview', 'input-inline-topic-name']) $(id).value = '';
  $('ai-prompt-preview').hidden = true; $('ai-prompt-preview-label').hidden = true; $('import-opt-overwrite').checked = false;
  status('entry-save-status'); status('batch-import-status'); selectTab(false);
}
