import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { context } from '../js/core/context.js';
import { mutateWords, pendingOperations, readUserWords } from '../js/core/idb-manager.js';
import { getAlphabeticalTopics, install_deleteTopicDirectly, renderLibraryTopicUpwardMenu, resetLibraryForUser, renderLibrary, renderVocabularyCardHtml, setupLibraryModule, setupMergeTopicsModal } from '../js/features/library.js';
import { escapeHtml } from '../js/utils/helpers.js';
import { wordTopics } from '../js/core/vocabulary.js';

const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { JSDOM } = require('jsdom');
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');

test('library flips from either face, preserves rail focus, and clears profile-local view state', async () => {
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const { window } = new JSDOM(html, { url: 'http://localhost:8771/' });
  Object.assign(globalThis, { window, document: window.document, indexedDB, IDBKeyRange });
  const $ = id => document.getElementById(id);
  const card = () => document.querySelector('[data-word-id="shared"]');
  const user = 'LibraryFixture';
  const pronunciations = [];
  const records = await mutateWords([{ id: 'shared', username: user, patch: {
    word: 'adapt', meaning: 'thích nghi', topic: 'One profile', exampleSentence: 'They adapted quickly.',
    audioUrl: 'https://recording.test/adapt.mp3', reviewCount: 2, lastGrade: 1, repetition: 2, interval: 6,
    easeFactor: 2.4, successfulDays: ['2026-10-27', '2026-10-28'],
    lastReviewedAt: Date.parse('2026-10-28T12:00:00Z'), dueDate: '2026-11-03T12:00:00Z'
  } }]);
  Object.assign(context, { currentUser: user, accountGeneration: 1, DEFAULT_TOPIC: 'New Words',
    wordsData: records, userTopics: ['One profile'], libraryTab: 'unknown', librarySelectedTopic: 'ALL',
    escapeHtml, syncPendingOperations: async () => {}, reconcileSession: async () => {},
    playAudio: word => pronunciations.push(word), showToast: message => assert.fail(message)
  });
  try {
    setupLibraryModule();
    setupMergeTopicsModal();
    $('view-library').classList.remove('hidden');
    renderLibrary();
    assert.deepEqual([...card().querySelectorAll('.library-toolbar button')].map(button => button.dataset.action),
      ['flip', 'mastery', 'favorite', 'audio', 'edit', 'delete']);
    assert.ok(card().classList.contains('grade-1'));
    const sample = document.createElement('div');
    for (const grade of [undefined, 0, 1, 2, 3]) {
      const memoryStatus = grade === 3 ? 'mastered' : 'not_remembered';
      sample.innerHTML = renderVocabularyCardHtml({ ...records[0], recallLevel: undefined, lastGrade: grade, memoryStatus });
      const gradeClasses = [...sample.firstElementChild.classList].filter(name => name.startsWith('grade-'));
      assert.deepEqual(gradeClasses, [`grade-${grade ?? 0}`]);
    }
    sample.innerHTML = renderVocabularyCardHtml({ ...records[0], memoryStatus: 'mastered', lastGrade: 2, recallLevel: undefined });
    assert.ok(sample.firstElementChild.classList.contains('grade-3'));

    const heading = card().querySelector('.library-card-front h3');
    const selection = window.getSelection();
    selection.selectAllChildren(heading);
    heading.click();
    assert.equal(card().classList.contains('is-flipped'), false);
    selection.removeAllRanges();
    heading.click();
    assert.equal(card().querySelector('.library-card-front').hasAttribute('inert'), true);
    card().querySelector('.library-card-back h3').click();
    assert.equal(card().querySelector('.library-card-back').hasAttribute('inert'), true);
    card().querySelector('[data-action="flip"]').click();
    assert.equal(card().querySelector('[data-action="flip"]').getAttribute('aria-pressed'), 'true');
    card().querySelector('[data-action="audio"]').click();
    assert.equal(pronunciations.length, 1);
    assert.equal(pronunciations[0].word, 'adapt');
    assert.equal(pronunciations[0].audioUrl, 'https://recording.test/adapt.mp3');
    assert.equal(card().classList.contains('is-flipped'), true);

    const favorite = card().querySelector('[data-action="favorite"]');
    favorite.focus();
    const saved = new Promise(resolve => { context.updateStatusBadge = resolve; });
    favorite.click();
    await saved;
    assert.equal(card().classList.contains('is-flipped'), true);
    assert.equal(document.activeElement, card().querySelector('[data-action="favorite"]'));
    assert.equal((await readUserWords(user))[0].isFavorite, true);

    async function toggleMastery(pressed, title, expectedLevel) {
      const button = card().querySelector('[data-action="mastery"]');
      assert.equal(button.getAttribute('aria-label'), 'Mastered');
      assert.equal(button.getAttribute('aria-pressed'), String(pressed));
      assert.equal(button.title, title);
      button.focus();
      const committed = new Promise(resolve => { context.updateStatusBadge = resolve; });
      button.click();
      await committed;
      assert.equal(card(), null);
      assert.equal(document.activeElement, $('lib-search-input'));
      const [updated] = await readUserWords(user);
      assert.equal(updated.recallLevel, expectedLevel);
      assert.equal(updated.masteredReviewPending, expectedLevel === 4);
      for (const field of ['reviewCount', 'lastGrade', 'goodReviewCount', 'autoMastered', 'repetition', 'interval', 'easeFactor', 'successfulDays', 'lastReviewedAt', 'dueDate']) {
        assert.deepEqual(updated[field], records[0][field], field);
      }
      return updated.memoryStatus;
    }

    assert.equal(await toggleMastery(false, 'Mark as Mastered', 4), 'mastered');
    const tabs = ['unknown', 'favorites', 'known'].map(tab => $(`btn-lib-tab-${tab}`));
    assert.ok(tabs.every(tab => tab.classList.contains('practice-mode-button') && !tab.classList.contains('bg-indigo-600')));
    const selectedTabs = () => tabs.filter(tab => tab.getAttribute('aria-pressed') === 'true');
    $('btn-lib-tab-known').click();
    assert.deepEqual(selectedTabs(), [tabs[2]]);
    assert.match(card().querySelector('footer').textContent, /Mastered$/);
    assert.ok(card().classList.contains('grade-3'));
    assert.equal(await toggleMastery(true, 'Mark as Unknown', 3), 'not_remembered');
    $('btn-lib-tab-unknown').click();
    assert.deepEqual(selectedTabs(), [tabs[0]]);
    assert.match(card().querySelector('footer').textContent, /Unknown$/);
    assert.ok(card().classList.contains('grade-2'));
    assert.equal(card().classList.contains('is-flipped'), true);

    $('lib-search-input').value = 'ad';
    context.librarySelectedTopic = 'One profile';
    window.openMergeModalForTopic('One profile');
    context.accountGeneration++;
    resetLibraryForUser();
    assert.equal(card(), null);
    assert.equal($('lib-search-input').value, '');
    assert.equal(context.librarySelectedTopic, 'ALL');
    assert.equal($('modal-merge-topics').classList.contains('hidden'), true);
    assert.equal($('merge-topic-checkboxes').childElementCount, 0);
    renderLibrary();
    assert.equal(card().classList.contains('is-flipped'), false);
  } finally { window.close(); }
});

test('deck actions are icon controls and deleting or merging a deck preserves other memberships', async () => {
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const { window } = new JSDOM(html, { url: 'http://localhost:8771/' });
  const originalConfirm = globalThis.confirm;
  Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage, indexedDB, IDBKeyRange,
    confirm: () => true });
  const $ = id => document.getElementById(id);
  const user = 'DeckFixture';
  const shared = [], toasts = [];
  const records = await mutateWords([
    { id: 'primary', topic: 'Research', topics: ['Practice'], interval: 7 },
    { id: 'only', topic: 'Research' },
    { id: 'secondary', topic: 'Other', topics: ['Research', 'Weekly'] },
    { id: 'additional', topic: 'Archive', topics: ['Practice'] },
    { id: 'inbox', topic: 'New Words' },
    { id: 'shared-inbox', topic: 'Independent', topics: ['New Words'] },
    { id: 'keep', topic: 'Independent' }
  ].map(({ id, ...patch }) => ({ id, username: user, patch: { word: id, meaning: id, ...patch } })));
  Object.assign(context, { currentUser: user, accountGeneration: 2, DEFAULT_TOPIC: 'New Words',
    wordsData: records, userTopics: [], libraryTab: 'unknown', librarySelectedTopic: 'ALL', activeTopic: 'ALL',
    escapeHtml, syncPendingOperations: async () => {}, reconcileSession: async () => {}, updateStatusBadge() {},
    renderReviewTopicUpwardMenu() {}, renderEntryTopicCards() {},
    shareTopic: (topic, button) => shared.push({ topic, button }), showToast: (message, type) => {
      if (type === 'error') assert.fail(message);
      toasts.push(message);
    }
  });
  try {
    resetLibraryForUser();
    install_deleteTopicDirectly();
    setupMergeTopicsModal();
    $('view-library').classList.remove('hidden');
    const topics = getAlphabeticalTopics();
    assert.ok(topics.includes('Practice'));
    assert.ok(topics.includes('Weekly'));
    renderLibraryTopicUpwardMenu(topics);
    const group = [...document.querySelectorAll('.topic-option-actions')].find(element => element.getAttribute('aria-label') === 'Research deck actions');
    const buttons = [...group.querySelectorAll('button')];
    assert.deepEqual(buttons.map(button => button.title), ['Merge Decks', 'Clear Topic Words', 'Delete Deck', 'Share Deck']);
    assert.ok(buttons.every(button => button.title === button.getAttribute('aria-label') && button.querySelector('svg') && !button.textContent.trim()));
    buttons[3].click();
    assert.deepEqual(shared, [{ topic: 'Research', button: buttons[3] }]);
    assert.equal(context.librarySelectedTopic, 'ALL');
    const defaultActions = [...document.querySelectorAll('.topic-option-actions')].find(element => element.getAttribute('aria-label') === 'New Words deck actions');
    assert.deepEqual([...defaultActions.querySelectorAll('button')].map(button => button.title), ['Clear Topic Words', 'Share Deck']);

    context.librarySelectedTopic = 'Practice';
    renderLibrary();
    assert.deepEqual([...document.querySelectorAll('.library-flip-card')].map(card => card.dataset.wordId), ['additional', 'primary']);
    await window.deleteTopicDirectly('Research');
    let byId = new Map((await readUserWords(user)).map(word => [word.id, word]));
    assert.equal(byId.has('only'), false);
    assert.equal(byId.get('primary').topic, 'Practice');
    assert.equal(byId.get('primary').interval, 7);
    assert.deepEqual(wordTopics(byId.get('secondary')), ['Other', 'Weekly']);
    assert.ok(!getAlphabeticalTopics().includes('Research'));

    window.openMergeModalForTopic('Practice');
    [...document.querySelectorAll('#merge-topic-checkboxes input')].find(input => input.value === 'Weekly').checked = true;
    $('input-merge-new-name').value = 'Consolidated';
    const saved = new Promise(resolve => { context.updateStatusBadge = resolve; });
    $('btn-confirm-merge').click();
    await saved;
    byId = new Map((await readUserWords(user)).map(word => [word.id, word]));
    assert.deepEqual(wordTopics(byId.get('primary')), ['Consolidated']);
    assert.deepEqual(wordTopics(byId.get('secondary')), ['Other', 'Consolidated']);
    assert.deepEqual(wordTopics(byId.get('additional')), ['Archive', 'Consolidated']);
    assert.equal(context.librarySelectedTopic, 'Consolidated');

    globalThis.confirm = message => { assert.match(message, /other topics/); return false; };
    await window.deleteTopicDirectly('New Words');
    assert.equal((await readUserWords(user)).filter(word => wordTopics(word).includes('New Words')).length, 2);
    globalThis.confirm = () => true;
    await window.deleteTopicDirectly('New Words');
    assert.deepEqual(context.wordsData.map(word => word.id).sort(), ['additional', 'keep', 'primary', 'secondary']);
    assert.ok(getAlphabeticalTopics().includes('New Words'));
    const clear = document.querySelector('[aria-label="Consolidated deck actions"] [data-deck-action="clear"]');
    clear.click();
    for (let i = 0; i < 100 && !toasts.includes('Cleared 3 vocabulary items.'); i++) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.ok(toasts.includes('Cleared 3 vocabulary items.'));
    assert.deepEqual((await readUserWords(user)).map(word => word.id), ['keep']);
    assert.ok(getAlphabeticalTopics().includes('Consolidated'));
    assert.equal(document.querySelectorAll('.library-flip-card').length, 0);
    assert.ok((await pendingOperations(user)).some(op => op.wordId === 'shared-inbox' && op.type === 'DELETE'));
  } finally {
    globalThis.confirm = originalConfirm;
    window.close();
  }
});
