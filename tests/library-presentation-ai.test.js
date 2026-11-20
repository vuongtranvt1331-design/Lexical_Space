import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { context } from '../js/core/context.js';
import { mutateWords, readUserWords } from '../js/core/idb-manager.js';
import { isLibraryMastered, renderLibrary, renderVocabularyCardHtml, setupLibraryModule, updateWordMemory } from '../js/features/library.js';
import { setupPracticeControls } from '../js/features/flashcard.js';
import { parseAIBatch, validateAIWord } from '../js/core/ai-vocabulary.js';
import { escapeHtml } from '../js/utils/helpers.js';
import { recallLevelFor } from '../js/core/vocabulary.js';

const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { JSDOM } = require('jsdom');
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');

test('library presentation: known/unknown grouping, sorting order, and level 3 demotion to level 2', async () => {
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const { window } = new JSDOM(html, { url: 'http://localhost:8771/' });
  Object.assign(globalThis, { window, document: window.document, indexedDB, IDBKeyRange });
  const $ = id => document.getElementById(id);

  const user = 'PresentationFixture';
  // Create fixture words covering all levels: unreviewed, level 1, level 2, level 3, level 4
  // and varying reviewCount and alphabetical words
  const records = await mutateWords([
    // Unreviewed (null level) - reviewCount 0
    { id: 'w-unrev-b', username: user, patch: { word: 'banana', meaning: 'chuối', topic: 'Food', reviewCount: 0 } },
    { id: 'w-unrev-a', username: user, patch: { word: 'apple', meaning: 'táo', topic: 'Food', reviewCount: 0 } },
    // Level 1 (lastGrade 0) - reviewCount 3 vs reviewCount 1
    { id: 'w-lvl1-c', username: user, patch: { word: 'cherry', meaning: 'anh đào', topic: 'Food', lastGrade: 0, reviewCount: 3 } },
    { id: 'w-lvl1-d', username: user, patch: { word: 'date', meaning: 'chà là', topic: 'Food', lastGrade: 0, reviewCount: 1 } },
    // Level 2 (lastGrade 1)
    { id: 'w-lvl2-e', username: user, patch: { word: 'elderberry', meaning: 'cơm cháy', topic: 'Food', lastGrade: 1, reviewCount: 2 } },
    // Level 3 (lastGrade 2) - should be in Known/Mastered!
    { id: 'w-lvl3-f', username: user, patch: { word: 'fig', meaning: 'sung', topic: 'Food', lastGrade: 2, reviewCount: 4 } },
    { id: 'w-lvl3-g', username: user, patch: { word: 'grape', meaning: 'nho', topic: 'Food', lastGrade: 2, reviewCount: 2 } },
    // Level 4 (autoMastered / easy) - in Known/Mastered
    { id: 'w-lvl4-h', username: user, patch: { word: 'honeydew', meaning: 'dưa mật', topic: 'Food', memoryStatus: 'mastered', lastGrade: 3, reviewCount: 5 } }
  ]);

  Object.assign(context, {
    currentUser: user, accountGeneration: 1, DEFAULT_TOPIC: 'Food',
    wordsData: records, userTopics: ['Food'], libraryTab: 'unknown', librarySelectedTopic: 'ALL',
    escapeHtml, syncPendingOperations: async () => {}, reconcileSession: async () => {}, updateStatusBadge() {}
  });

  try {
    setupLibraryModule();
    $('view-library').classList.remove('hidden');

    // 1. Check known vs unknown grouping
    // Known should contain level 3 ('fig', 'grape') and level 4 ('honeydew')
    // Unknown should contain unreviewed ('apple', 'banana'), level 1 ('cherry', 'date'), level 2 ('elderberry')
    context.libraryTab = 'unknown';
    renderLibrary();
    const unknownCardIds = [...document.querySelectorAll('#library-list-container .library-flip-card')].map(c => c.dataset.wordId);
    assert.deepEqual(unknownCardIds, ['w-unrev-a', 'w-unrev-b', 'w-lvl1-d', 'w-lvl1-c', 'w-lvl2-e']);

    // Check sorting: ascending display level (unreviewed [0] before level 1 before level 2),
    // then ascending reviewCount (date [1] before cherry [3]), then alphabetical (apple before banana)
    assert.equal(unknownCardIds[0], 'w-unrev-a'); // unreviewed, count 0, apple
    assert.equal(unknownCardIds[1], 'w-unrev-b'); // unreviewed, count 0, banana
    assert.equal(unknownCardIds[2], 'w-lvl1-d');   // level 1, count 1
    assert.equal(unknownCardIds[3], 'w-lvl1-c');   // level 1, count 3
    assert.equal(unknownCardIds[4], 'w-lvl2-e');   // level 2, count 2

    // Now switch to Known tab
    context.libraryTab = 'known';
    renderLibrary();
    const knownCardIds = [...document.querySelectorAll('#library-list-container .library-flip-card')].map(c => c.dataset.wordId);
    // Level 3 cards sorted by reviewCount: grape (2) before fig (4), then level 4 (honeydew [5])
    assert.deepEqual(knownCardIds, ['w-lvl3-g', 'w-lvl3-f', 'w-lvl4-h']);

    // Check badge and button for level 3 card
    const grapeCard = document.querySelector('[data-word-id="w-lvl3-g"]');
    assert.equal(grapeCard.querySelector('[data-action="mastery"]').getAttribute('aria-pressed'), 'true');
    const grapeMasteryBtn = grapeCard.querySelector('[data-action="mastery"]');
    assert.equal(grapeMasteryBtn.getAttribute('aria-pressed'), 'true');
    assert.equal(grapeMasteryBtn.title, 'Mark as Unknown');

    // 2. Manual toggle: demote level 3 card ('w-lvl3-g') from Mastered to Unknown
    const committed = new Promise(resolve => { context.updateStatusBadge = resolve; });
    grapeMasteryBtn.click();
    await committed;

    // Word should have moved out of known tab
    assert.equal(document.querySelector('[data-word-id="w-lvl3-g"]'), null);

    // Check stored word in IndexedDB: recallLevel must be 2, masteryOverride 'not_remembered'
    const [demotedWord] = (await readUserWords(user)).filter(w => w.id === 'w-lvl3-g');
    assert.equal(demotedWord.recallLevel, 2);
    assert.equal(demotedWord.masteryOverride, 'not_remembered');
    assert.equal(demotedWord.memoryStatus, 'not_remembered');
    assert.equal(demotedWord.masteredReviewPending, false);

    // Switch to unknown tab and verify grape is now in Unknown view with grade-1 (level 2)
    context.libraryTab = 'unknown';
    renderLibrary();
    const grapeInUnknown = document.querySelector('[data-word-id="w-lvl3-g"]');
    assert.ok(grapeInUnknown);
    assert.ok(grapeInUnknown.classList.contains('grade-1'));
    assert.equal(grapeInUnknown.querySelector('[data-action="mastery"]').getAttribute('aria-pressed'), 'false');
    const grapeUnknownBtn = grapeInUnknown.querySelector('[data-action="mastery"]');
    assert.equal(grapeUnknownBtn.getAttribute('aria-pressed'), 'false');
    assert.equal(grapeUnknownBtn.title, 'Mark as Mastered');
  } finally {
    window.close();
  }
});

test('topic-picker auto-close on surface scroll (wheel and touch paths) in Library and Review', async () => {
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const { window } = new JSDOM(html, { url: 'http://localhost:8771/' });
  Object.assign(globalThis, { window, document: window.document, indexedDB, IDBKeyRange });
  const $ = id => document.getElementById(id);

  Object.assign(context, {
    currentUser: 'ScrollUser', accountGeneration: 1, DEFAULT_TOPIC: 'TopicA',
    wordsData: [], userTopics: ['TopicA', 'TopicB'], libraryTab: 'unknown', librarySelectedTopic: 'ALL',
    activeTopic: 'ALL', reviewMode: 'learning',
    escapeHtml, syncPendingOperations: async () => {}, reconcileSession: async () => {}, updateStatusBadge() {},
    renderReviewTopicUpwardMenu() {}, renderEntryTopicCards() {}
  });

  try {
    setupLibraryModule();
    setupPracticeControls();

    // --- LIBRARY TEST ---
    const libMenu = $('lib-topic-upward-menu');
    const libSelector = $('btn-lib-topic-selector');
    const libList = $('library-list-container');
    const libSurface = $('view-library');

    // Initially hidden
    assert.ok(libMenu.classList.contains('hidden'));

    // Open the menu
    libSelector.click();
    assert.equal(libMenu.classList.contains('hidden'), false);

    // 1. Wheel on main surface outside menu -> closes menu
    libList.dispatchEvent(new window.WheelEvent('wheel', { deltaY: 20, bubbles: true }));
    assert.equal(libMenu.classList.contains('hidden'), true);

    // Open again
    libSelector.click();
    assert.equal(libMenu.classList.contains('hidden'), false);

    // 2. Wheel INSIDE menu (e.g. on lib-topic-options-list) -> does NOT close
    const libOptionsList = $('lib-topic-options-list');
    libOptionsList.dispatchEvent(new window.WheelEvent('wheel', { deltaY: 20, bubbles: true }));
    assert.equal(libMenu.classList.contains('hidden'), false);

    // 3. Touch scroll on main surface outside menu (> 8px movement) -> closes menu
    libList.dispatchEvent(new window.TouchEvent('touchstart', {
      touches: [{ clientX: 100, clientY: 100 }], bubbles: true
    }));
    libList.dispatchEvent(new window.TouchEvent('touchmove', {
      touches: [{ clientX: 100, clientY: 120 }], bubbles: true
    }));
    assert.equal(libMenu.classList.contains('hidden'), true);

    // Open again
    libSelector.click();
    assert.equal(libMenu.classList.contains('hidden'), false);

    // 4. Touch scroll INSIDE menu -> does NOT close menu
    libOptionsList.dispatchEvent(new window.TouchEvent('touchstart', {
      touches: [{ clientX: 50, clientY: 50 }], bubbles: true
    }));
    libOptionsList.dispatchEvent(new window.TouchEvent('touchmove', {
      touches: [{ clientX: 50, clientY: 80 }], bubbles: true
    }));
    assert.equal(libMenu.classList.contains('hidden'), false);

    // 5. Native scroll event on libList -> closes menu
    libList.dispatchEvent(new window.Event('scroll', { bubbles: false }));
    assert.equal(libMenu.classList.contains('hidden'), true);

    // --- REVIEW TEST ---
    const reviewMenu = $('review-topic-upward-menu');
    const reviewSelector = $('btn-review-topic-selector');
    const reviewStage = $('review-flashcard-stage');
    const reviewOptions = $('review-topic-options-list');

    // Open Review menu
    reviewSelector.click();
    assert.equal(reviewMenu.classList.contains('hidden'), false);

    // Wheel on review stage closes menu
    reviewStage.dispatchEvent(new window.WheelEvent('wheel', { deltaY: 15, bubbles: true }));
    assert.equal(reviewMenu.classList.contains('hidden'), true);

    // Open again
    reviewSelector.click();
    assert.equal(reviewMenu.classList.contains('hidden'), false);

    // Wheel inside review menu does NOT close
    reviewOptions.dispatchEvent(new window.WheelEvent('wheel', { deltaY: 15, bubbles: true }));
    assert.equal(reviewMenu.classList.contains('hidden'), false);

    // Touch on review stage closes menu
    reviewStage.dispatchEvent(new window.TouchEvent('touchstart', {
      touches: [{ clientX: 200, clientY: 200 }], bubbles: true
    }));
    reviewStage.dispatchEvent(new window.TouchEvent('touchmove', {
      touches: [{ clientX: 200, clientY: 230 }], bubbles: true
    }));
    assert.equal(reviewMenu.classList.contains('hidden'), true);
  } finally {
    window.close();
  }
});

test('AI plain-text parser: 5-column IPA, 6-column original, corrections, and collision handling', () => {
  // 1. Plain text with 5 columns (includes phonetic)
  const fiveCol = 'resilient | kiên cường | adj | A resilient team adapts. | /rɪˈzɪliənt/';
  const [c5] = parseAIBatch(fiveCol, 'resilient');
  assert.equal(c5.word, 'resilient');
  assert.equal(c5.meaning, 'kiên cường');
  assert.equal(c5.pos, 'adj');
  assert.equal(c5.phonetic, '/rɪˈzɪliənt/');

  // 2. Plain text with 6 columns: typo correction (resilinet -> resilient)
  const sixCol = 'resilient | kiên cường | adj | A resilient team adapts. | /rɪˈzɪliənt/ | resilinet';
  let corrections = [];
  const [c6] = parseAIBatch(sixCol, 'resilinet', { onCorrections: c => { corrections = c; } });
  assert.equal(c6.word, 'resilient');
  assert.equal(c6.phonetic, '/rɪˈzɪliənt/');
  assert.equal(Object.hasOwn(c6, 'original'), false); // never persisted
  assert.deepEqual(corrections, [{ original: 'resilinet', corrected: 'resilient' }]);

  // 3. Optional empty fields in 6 columns
  const emptyFields = 'resilient | kiên cường |||| resilinet';
  const [cEmpty] = parseAIBatch(emptyFields, 'resilinet');
  assert.equal(cEmpty.word, 'resilient');
  assert.equal(cEmpty.meaning, 'kiên cường');
  assert.equal(cEmpty.pos, '');
  assert.equal(cEmpty.phonetic, '');

  // 4. Collision handling: exact match and corrected input collide on same word/sense
  // Input list has both 'resilient' and typo 'resilinet'
  const collidingBatch = [
    'resilient | kiên cường | adj | A resilient team adapts. | /rɪˈzɪliənt/ | resilient',
    'resilient | kiên cường | adj | A resilient team adapts. | /rɪˈzɪliənt/ | resilinet'
  ].join('\n');
  let collCorrections = [];
  const collEntries = parseAIBatch(collidingBatch, 'resilient\nresilinet', { onCorrections: c => { collCorrections = c; } });
  // Keeps ONE card in entries
  assert.equal(collEntries.length, 1);
  assert.equal(collEntries[0].word, 'resilient');
  // Accounts for both sources: 'resilinet' is marked as covered and corrected, 'resilient' is covered
  assert.deepEqual(collCorrections, [{ original: 'resilinet', corrected: 'resilient' }]);

  // 5. Reject claiming unknown input (unrequested replacement with unknown source)
  const unrequestedWithBadSource = 'resilient | kiên cường | adj | A resilient team adapts. | /rɪˈzɪliənt/ | unknown_source';
  assert.throws(() => parseAIBatch(unrequestedWithBadSource, 'resilient'), /Unexpected word: resilient/);

  // 6. Reject unrequested replacement without source
  const unrequestedNoSource = 'different | khác biệt | adj | A different context. | /dɪfrənt/ | ';
  assert.throws(() => parseAIBatch(unrequestedNoSource, 'resilient'), /Unexpected word: different/);

  // 7. General import without expected word list: no auto-correction, duplicates produce errors
  const duplicateGeneral = [
    'resilient | kiên cường | adj | A resilient team adapts. | /rɪˈzɪliənt/',
    'resilient | kiên cường | adj | A resilient team adapts. | /rɪˈzɪliənt/'
  ].join('\n');
  assert.throws(() => parseAIBatch(duplicateGeneral, ''), /Row 2: Duplicate word and sense/);

  // 8. JSON with original metadata supported and stripped from output record
  for (const field of ['original', 'originalInput', 'original_word']) {
    const jsonInput = JSON.stringify([{
      word: 'resilient', meaning: 'kiên cường', pos: 'adj', [field]: 'resilinet',
      exampleSentence: 'A resilient team adapts.', phonetic: '/rɪˈzɪliənt/'
    }]);
    let jsonCorrections = [];
    const [jsonCard] = parseAIBatch(jsonInput, 'resilinet', { onCorrections: c => { jsonCorrections = c; } });
    assert.equal(jsonCard.word, 'resilient');
    assert.equal(Object.hasOwn(jsonCard, field), false);
    assert.deepEqual(jsonCorrections, [{ original: 'resilinet', corrected: 'resilient' }]);
  }
});

test('AI import UI preview: displays before->after corrections prior to saving and does not persist original', async () => {
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const { window } = new JSDOM(html, { url: 'http://localhost:8771/' });
  Object.assign(globalThis, { window, document: window.document, indexedDB, IDBKeyRange });
  const $ = id => document.getElementById(id);

  const user = 'AIImportUIFixture';
  Object.assign(context, {
    currentUser: user, accountGeneration: 1, DEFAULT_TOPIC: 'New Words',
    wordsData: [], userTopics: ['New Words'], navigationGeneration: 1,
    escapeHtml, syncPendingOperations: async () => {}, reconcileSession: async () => {}, updateStatusBadge() {},
    addUserTopic() {}, commitVocabularyChanges: async changes => changes.map(c => ({ id: c.id, ...c.patch }))
  });

  const { setupQuickImport } = await import('../js/features/entry.js');
  try {
    $('view-entry').classList.remove('hidden');
    setupQuickImport();
    $('btn-toggle-ai-library').click();

    $('ai-raw-words').value = 'resilinet\naccomodate';
    const pasted = [
      'resilient | kiên cường | adj | A resilient team adapts. | /rɪˈzɪliənt/ | resilinet',
      'accommodate | đáp ứng | v | We accommodate all requests. | /əˈkɒmədeɪt/ | accomodate'
    ].join('\n');
    $('import-raw-input').value = pasted;

    // Trigger preview
    $('btn-preview-import').click();

    // Check preview is visible and editor is hidden
    assert.equal($('ai-import-preview').hidden, false);
    assert.equal($('ai-import-editor').hidden, true);

    // Verify before->after corrections shown in preview summary and status
    const summary = $('ai-import-preview-summary').textContent;
    assert.match(summary, /Corrected 2 spellings: resilinet → resilient, accomodate → accommodate\./);
    const statusText = $('batch-import-status').textContent;
    assert.match(statusText, /Corrected: resilinet → resilient, accomodate → accommodate/);

    // Verify list items show 'Corrected from' in details dl
    const previewItems = $('ai-import-preview-list').querySelectorAll('li');
    assert.equal(previewItems.length, 2);
    assert.match(previewItems[0].querySelector('dl').textContent, /Corrected fromresilinet/);
    assert.match(previewItems[1].querySelector('dl').textContent, /Corrected fromaccomodate/);

    // Verify execute import does not persist original
    let committedChanges = [];
    context.commitVocabularyChanges = async changes => {
      committedChanges = changes;
      return changes.map(c => ({ id: c.id, ...c.patch }));
    };

    $('btn-execute-import').click();
    assert.equal(committedChanges.length, 2);
    for (const change of committedChanges) {
      assert.equal(Object.hasOwn(change.patch, 'original'), false);
      assert.equal(Object.hasOwn(change.patch, '_original'), false);
    }
  } finally {
    window.close();
  }
});
