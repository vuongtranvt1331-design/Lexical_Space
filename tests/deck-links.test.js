import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { JSDOM } = require('jsdom');
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');

test('deck import preserves progress and sharing works without Firebase Auth, with loading and clipboard recovery', async () => {
  const url = 'https://lexical.example/notebook/?deck=fixture-deck';
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const { window } = new JSDOM(html, { url, pretendToBeVisual: true });
  const { document, localStorage, sessionStorage } = window;
  Object.assign(globalThis, { window, document, localStorage, sessionStorage, indexedDB, IDBKeyRange });
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
  const copied = [];
  let clipboardBlocked = false;
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => {
    if (clipboardBlocked) throw new Error('Clipboard unavailable');
    copied.push(text);
  } } });
  const imported = {
    deckId: 'fixture-deck',
    title: 'Field Notes',
    createdAt: 1700000000000,
    wordCount: 2,
    words: [
      { word: 'GLADE', ipa: '', pos: 'n', vietnamese: 'khoảng rừng trống', example: 'We rested in a glade.',
        cloze: 'We rested in a [ _____ ].', synonyms: ['clearing'], collocations: ['sunny glade'], topics: ['Nature'] },
      { word: 'thicket', ipa: '', pos: 'n', vietnamese: 'bụi cây rậm', example: 'A bird hid in the thicket.',
        cloze: 'A bird hid in the [ _____ ].', synonyms: ['brush'], collocations: ['dense thicket'], topics: ['Nature'] }
    ]
  };
  const docs = new Map([['shared_decks/fixture-deck', imported]]);
  let commitDelay, attempts = 0, rejectPublish = false;
  const db = {
    collection(name) {
      return {
        where: () => ({ onSnapshot: () => () => {} }),
        doc(id) {
          const path = `${name}/${id}`;
          return { path, get: async () => ({ exists: docs.has(path), data: () => docs.get(path), id }) };
        }
      };
    },
    async runTransaction(handler) {
      const writes = [];
      const result = await handler({ get: ref => ref.get(), set: (ref, data) => writes.push([ref.path, data]) });
      if (writes.some(([path]) => path.startsWith('shared_decks/'))) {
        attempts++;
        if (rejectPublish) throw Object.assign(new Error('Denied'), { code: 'permission-denied' });
        if (commitDelay) await commitDelay;
      }
      for (const [path, data] of writes) docs.set(path, data);
      return result;
    }
  };
  globalThis.firebase = { apps: [], initializeApp() { this.apps.push({}); }, firestore: () => db };
  const storage = await import('../js/core/idb-manager.js');
  await storage.mutateWords([{ id: 'local-glade', username: 'Learner', patch: {
    word: 'glade', meaning: 'khoảng rừng trống', topic: 'Existing topic', repetition: 4, interval: 17, easeFactor: 2.8,
    dueDate: '2031-09-10T00:00:00.000Z', reviewCount: 8
  } }]);
  const { context } = await import('../js/core/context.js');
  const flash = await import('../js/features/flashcard.js');
  const $ = id => document.getElementById(id);
  async function until(check) {
    for (let i = 0; i < 150; i++) {
      if (check()) return;
      await new Promise(resolve => setTimeout(resolve, 8));
    }
    assert.fail('Timed out waiting for deck UI.');
  }
  await import('../js/features/application.js');
  try {
    await until(() => window.location.search === '');
    assert.equal($('modal-import-deck').hidden, true);
    $('input-username').value = 'Learner';
    $('btn-login-submit').click();
    await until(() => !$('btn-confirm-deck-import').disabled);
    assert.equal($('import-deck-profile').textContent, 'Learner');
    assert.equal($('import-deck-title').textContent, 'Field Notes');
    assert.equal($('import-deck-total').textContent, '2');
    assert.equal($('import-deck-new').textContent, '1');
    assert.equal($('import-deck-existing').textContent, '1');
    assert.equal((await storage.readUserWords('Learner')).length, 1);
    const topicSelect = $('shared-import-topic'), newTopic = $('shared-import-new-topic');
    const changeTopic = value => {
      topicSelect.value = value;
      topicSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    };
    const createTopic = topicSelect.querySelector('[data-create-topic]').value;
    assert.deepEqual([...topicSelect.options].map(option => option.value), ['', 'Existing topic', 'New Words', createTopic]);
    assert.match(topicSelect.selectedOptions[0].textContent, /Keep sender’s topics \(Field Notes\)/);
    assert.ok(newTopic.hidden);
    changeTopic(createTopic);
    assert.equal(newTopic.hidden, false);
    $('btn-confirm-deck-import').click();
    assert.match($('import-deck-status').textContent, /Enter a name/);
    newTopic.value = 'Discarded topic';
    changeTopic('Existing topic');
    assert.ok(newTopic.hidden);
    assert.equal(newTopic.value, '');
    changeTopic(createTopic);
    newTopic.value = 'My Field Notes';
    $('btn-confirm-deck-import').click();
    await until(() => $('modal-import-deck').hidden && context.wordsData.length === 2);
    const existing = await storage.readUserWord('Learner', 'local-glade');
    assert.deepEqual([existing.repetition, existing.interval, existing.easeFactor, existing.dueDate, existing.reviewCount],
      [4, 17, 2.8, '2031-09-10T00:00:00.000Z', 8]);
    assert.deepEqual(existing.topics, ['Existing topic', 'My Field Notes']);
    assert.equal(existing.exampleSentence, 'We rested in a glade.');
    assert.equal(context.wordsData.find(word => word.word === 'thicket').dueDate, null);
    assert.deepEqual(context.wordsData.find(word => word.word === 'thicket').topics, ['My Field Notes']);
    assert.equal((await storage.readUserWords('Another profile')).length, 0);

    window.history.replaceState({}, '', '/notebook/?deck=fixture-deck');
    await context.loadDeckFromLocation();
    assert.match($('import-deck-status').textContent, /already imported/);
    assert.equal($('btn-confirm-deck-import').disabled, true);
    $('btn-cancel-deck-import').click();
    $('btn-open-drawer').click();
    document.querySelector('#drawer-navigation [data-target="view-library"]').click();
    $('btn-lib-topic-selector').click();
    const share = () => [...$('lib-topic-options-list').children].find(el => el.firstElementChild.textContent === 'My Field Notes')
      .querySelector('[data-deck-action="share"]');
    let finishCommit;
    commitDelay = new Promise(resolve => { finishCommit = resolve; });
    share().click();
    assert.equal(share().disabled, true);
    assert.equal(share().classList.contains('is-sharing'), true);
    assert.equal(share().getAttribute('aria-busy'), 'true');
    await until(() => attempts === 1);
    context.updateTopicDropdowns();
    assert.equal(share().disabled, true);
    share().click();
    assert.equal(attempts, 1);
    assert.equal(copied.length, 0);
    finishCommit();
    commitDelay = null;
    await until(() => copied.length === 1 && !share().disabled);
    assert.equal($('toast-msg').textContent, 'Link đã được lưu vào clipboard!');
    const link = new URL(copied[0]);
    assert.equal(link.origin + link.pathname, 'https://lexical.example/notebook/');
    const exported = docs.get(`shared_decks/${link.searchParams.get('deck')}`);
    assert.equal(exported.title, 'My Field Notes');
    assert.equal(exported.wordCount, 2);
    assert.ok(exported.words.every(word => !('dueDate' in word) && !('username' in word) && !('interval' in word)));

    rejectPublish = true;
    share().click();
    await until(() => attempts === 2 && !share().disabled);
    assert.match($('toast-msg').textContent, /Firebase blocked publishing/);
    assert.equal(copied.length, 1);

    rejectPublish = false;
    clipboardBlocked = true;
    share().click();
    await until(() => !$('modal-share-link').hidden);
    assert.equal(share().disabled, false);
    assert.match($('toast-msg').textContent, /clipboard access failed/);
    const manualLink = new URL($('shared-deck-url').value);
    assert.ok(docs.has(`shared_decks/${manualLink.searchParams.get('deck')}`));
    $('btn-close-share-link').click();

    assert.ok(await context.activateUser('Another profile'));
    window.history.replaceState({}, '', '/notebook/?deck=fixture-deck');
    await context.loadDeckFromLocation();
    assert.equal(topicSelect.value, '');
    assert.ok(newTopic.hidden);
    $('btn-confirm-deck-import').click();
    await until(() => $('modal-import-deck').hidden && context.wordsData.length === 2);
    const received = await storage.readUserWords('Another profile');
    assert.ok(received.every(word => word.topic === 'Field Notes' && word.topics.includes('Nature')));
    assert.ok(context.getAlphabeticalTopics().includes('Field Notes'));
    assert.match($('toast-msg').textContent, /imported to “Field Notes”/);
  } finally {
    flash.resetForUser();
    context.clearActivityTimers();
    window.close();
    delete globalThis.firebase;
  }
});
