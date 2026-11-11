import test from 'node:test';
Math.random = () => 0.999999;
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { JSDOM } = require('jsdom');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');

async function waitFor(condition) {
  for (let i = 0; i < 160; i++) {
    if (condition()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.fail('Timed out waiting for the refreshed practice queue.');
}

test('Check for more cards reads newly eligible words from IndexedDB in the active practice scope', async () => {
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const { window } = new JSDOM(html, { url: 'http://localhost:8776/', pretendToBeVisual: true });
  const { document, localStorage, sessionStorage } = window;
  Object.assign(globalThis, { window, document, localStorage, sessionStorage, indexedDB: new IDBFactory(), IDBKeyRange });
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
  const storage = await import('../js/core/idb-manager.js');
  const { loadSettings, saveSettings } = await import('../js/core/settings.js');
  const { context } = await import('../js/core/context.js');
  const flash = await import('../js/features/flashcard.js');
  const user = 'More cards learner', otherUser = 'Different learner';
  const $ = id => document.getElementById(id);
  const checkMore = $('btn-session-restart');
  const practiceBadge = () => $('badge-review-count').textContent;
  const modePressed = mode => $(`btn-mode-${mode}`).getAttribute('aria-pressed') === 'true';
  const queue = () => {
    const state = flash.getSessionState();
    return state.cardQueue.slice(state.queueIndex).map(item => item.wordId);
  };
  const change = (id, value) => {
    $(id).value = value;
    $(id).dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  const readMore = async () => {
    checkMore.click();
    assert.equal(checkMore.disabled, true);
    await waitFor(() => !checkMore.disabled);
  };
  const passCard = async grade => {
    await flash.revealCard();
    await flash.gradeRecall(grade);
  };
  const word = (id, patch = {}, username = user) => ({ id, username, patch: { word: id, meaning: 'nghĩa', topic: 'A', ...patch } });
  saveSettings(user, { dailyNewLimit: 1, dailyReviewLimit: 1, autoPronounce: false, soundEffects: false });
  await storage.mutateWords([word('first-due', { reviewCount: 1 }), word('first-new')]);
  localStorage.setItem('vocab_user', user);
  await import('../js/features/application.js');

  try {
    await waitFor(() => flash.getSessionState() && !context.profileLoading);
    assert.deepEqual(queue(), ['first-new', 'first-due']);
    assert.equal(practiceBadge(), '2');
    const sessionId = flash.getSessionState().sessionId;
    await passCard(3);
    assert.deepEqual(queue(), ['first-due']);
    assert.equal(practiceBadge(), '1');
    await passCard(2);
    assert.deepEqual(queue(), []);
    assert.equal(practiceBadge(), '0');
    assert.equal(context.sessionCompleted, true);

    change('setting-daily-new-limit', '');
    change('setting-daily-review-limit', '');
    assert.equal(loadSettings(user).dailyNewLimit, null);
    assert.equal(loadSettings(user).dailyReviewLimit, null);
    await storage.mutateWords([
      word('second-due', { reviewCount: 1, topic: 'B' }), word('second-new'),
      word('future-review', { reviewCount: 1, dueDate: new Date(Date.now() + 86_400_000).toISOString() }),
      word('another-profile-word', {}, otherUser)
    ]);
    assert.equal(context.wordsData.some(record => record.id === 'second-due'), false);
    await readMore();
    await waitFor(() => queue().length === 2);
    assert.deepEqual(queue(), ['second-new', 'second-due']);
    assert.equal(practiceBadge(), '2');
    assert.equal(flash.getSessionState().sessionId, sessionId);
    assert.equal(flash.getSessionState().completedAttempts, 2);

    context.activeTopic = 'A';
    $('btn-mode-review').click();
    await waitFor(() => modePressed('review') && queue()[0] === 'first-new');
    context.reviewMode = 'learning';
    context.activeTopic = 'ALL';
    context.updateTopicDropdowns();
    await flash.startNewSession({ restore: true });
    assert.deepEqual(queue(), ['first-new']);
    assert.equal(practiceBadge(), '1');
    assert.equal(modePressed('review'), true);
    assert.equal(modePressed('learning'), false);
    assert.equal($('review-selected-topic-label').textContent, 'Topic: A');
    await passCard(2);
    assert.deepEqual(queue(), []);
    assert.equal(practiceBadge(), '0');
    assert.match($('empty-state-subtitle').textContent, /Start another round/);

    $('btn-mode-learning').click();
    await waitFor(() => modePressed('learning') && queue().length === 1);
    assert.deepEqual(queue(), ['second-new']);
    assert.equal(practiceBadge(), '1');
    assert.equal(modePressed('review'), false);
    $('btn-mode-review').click();
    await waitFor(() => modePressed('review') && queue().length === 0);
    await storage.mutateWords([
      word('topic-a-due', { reviewCount: 1 }), word('topic-b-due', { reviewCount: 1, topic: 'B' }), word('topic-a-new')
    ]);
    await readMore();
    assert.deepEqual(queue(), ['topic-a-due']);
    assert.equal(practiceBadge(), '1');
    assert.equal(context.reviewMode, 'review');
    assert.equal(context.activeTopic, 'A');

    change('setting-daily-review-limit', '0');
    await waitFor(() => queue().length === 0);
    await readMore();
    assert.deepEqual(queue(), []);
    assert.equal(practiceBadge(), '0');
    assert.equal(loadSettings(user).dailyReviewLimit, 0);

    change('setting-daily-review-limit', '');
    await waitFor(() => queue().length === 1);
    await flash.revealCard();
    await flash.gradeRecall(0);
    assert.equal(practiceBadge(), '0');
    await flash.previousCard();
    assert.deepEqual(queue(), ['topic-a-due']);
    assert.equal(practiceBadge(), '0');

    const refreshVocabulary = context.refreshVocabulary;
    let finishRead;
    const pendingRead = new Promise(resolve => { finishRead = resolve; });
    context.refreshVocabulary = async username => {
      await pendingRead;
      return refreshVocabulary(username);
    };
    try {
      checkMore.click();
      assert.equal(checkMore.disabled, true);
      await context.activateUser(otherUser);
      assert.equal(checkMore.disabled, false);
      finishRead();
      await pendingRead;
      assert.deepEqual(queue(), ['another-profile-word']);
      assert.equal(practiceBadge(), '1');
      assert.equal(flash.getSessionState().username, otherUser);
    } finally {
      finishRead();
      context.refreshVocabulary = refreshVocabulary;
    }
  } finally {
    flash.resetForUser();
    context.clearActivityTimers();
    window.close();
  }
});
