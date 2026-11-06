import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { JSDOM } = require('jsdom'), { indexedDB, IDBKeyRange } = require('fake-indexeddb');
const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:8767/', pretendToBeVisual: true });
const { window } = dom, spoken = [], copied = [];
Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage, indexedDB, IDBKeyRange,
  speechSynthesis: { cancel() {}, speak(u) { spoken.push(u.text); } }, SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } } });
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async text => copied.push(text) } });
const storage = await import('../js/core/idb-manager.js');
const { context } = await import('../js/core/context.js');
const fixtureWord = { word: 'resilient', phonetic: '/rɪˈzɪliənt/', pos: 'adj', meaning: 'kiên cường',
  collocations: ['highly resilient', 'resilient community'], synonyms: ['hardy', 'adaptable', 'robust'],
  exampleSentence: 'A resilient community can recover.', clozeSentence: 'A [ _____ ] community can recover.', usageNotes: 'Used for people and systems. <b>Literal text</b>' };
const lookupResponse = data => ({ ok: true, status: 200, json: async () => data });
const dictionaryResponse = lookupResponse([{ phonetic: fixtureWord.phonetic, meanings: [{ partOfSpeech: 'adjective',
  synonyms: fixtureWord.synonyms, definitions: [{ example: fixtureWord.exampleSentence }] }] }]);
const translationResponse = lookupResponse({ responseStatus: 200, responseData: { translatedText: fixtureWord.meaning } });
await storage.mutateWords(Array.from({ length: 6 }, (_, i) => ({ id: `fixture_${i}`, username: 'UIFixture', patch: i === 0 ? fixtureWord :
  { word: `term${i}`, meaning: `nghĩa ${i}`, exampleSentence: `Use term${i} in context.`, synonyms: [`alias ${i}`], collocations: [`term${i} first`, `term${i} second`] } })));
localStorage.setItem('vocab_user', 'UIFixture');
await import('../js/features/application.js');
const flash = await import('../js/features/flashcard.js'), entry = await import('../js/features/entry.js');
const $ = id => document.getElementById(id);
const gradeButton = grade => document.querySelector(`[data-recall-grade="${grade}"]`);
const current = () => { const s = flash.getSessionState(); return s.cardQueue[s.queueIndex]; };
async function until(predicate) { for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); } throw new Error('Timed out waiting for UI state.'); }
await until(() => flash.getSessionState()?.cardQueue.length > 0);
test('practice, library, and entry workflows', async t => {
  try {
    await t.test('the four labeled rating buttons grade only after reveal and dragging has no effect', async () => {
      const labels = ['Again', 'Hard', 'Good', 'Easy'];
      assert.ok([...document.querySelectorAll('[data-recall-grade]')].every(button => button.disabled));
      assert.deepEqual([...document.querySelectorAll('.recall-card-tools button')].map(button => button.dataset.action),
        ['flip', 'previous', 'favorite', 'audio', 'edit', 'delete']);
      assert.ok($('btn-fc-previous').closest('.recall-card-tools'));
      assert.ok($('btn-fc-previous').disabled);
      assert.equal($('session-progress'), null);
      assert.equal($('action-guidance'), null);
      assert.equal(document.querySelector('.practice-progress-row'), null);
      assert.equal($('practice-card').lastElementChild, $('recall-instruction'));
      assert.ok($('btn-fc-next').closest('.recall-action-bar'));
      assert.ok($('btn-fc-next').hidden);
      const prompt = $('fc-front-context');
      for (const [type, y] of [['pointerdown', 50], ['pointermove', 62], ['pointerup', 50]]) {
        const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: 40, clientY: y });
        Object.assign(event, { pointerId: 1, pointerType: 'touch', isPrimary: true });
        assert.equal(prompt.dispatchEvent(event), true);
      }
      prompt.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 }));
      assert.equal(current().revealed, false);
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(prompt);
      selection.addRange(range);
      prompt.click();
      assert.equal(current().revealed, false);
      selection.removeAllRanges();
      for (const type of ['pointerdown', 'pointercancel']) {
        const event = new window.MouseEvent(type, { bubbles: true, clientX: 40, clientY: 50 });
        Object.assign(event, { pointerId: 1, pointerType: 'touch', isPrimary: true });
        prompt.dispatchEvent(event);
      }
      // The canceled pointer produces no click. Keyboard activation must still work.
      $('fc-front-word').click();
      await until(() => current().revealed);
      assert.equal($('btn-fc-reveal').getAttribute('aria-expanded'), 'true');
      assert.equal($('recall-instruction').textContent, 'Grade your first recall attempt honestly.');
      $('btn-fc-reveal').click();
      await until(() => !current().revealed);
      prompt.click();
      await until(() => current().revealed);
      $('fc-back-meaning').click();
      await until(() => !current().revealed);
      for (let grade = 0; grade < 4; grade++) {
        await flash.revealCard(); const s = flash.getSessionState();
        assert.match(gradeButton(grade).textContent, new RegExp(labels[grade]));
        if (grade === 0) {
          const card = $('practice-card');
          for (const [type, x] of [['pointerdown', 150], ['pointermove', 25], ['pointerup', 25]]) {
            const event = new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: 150 });
            Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: 'touch' }, isPrimary: { value: true } });
            card.dispatchEvent(event);
          }
          assert.equal(flash.getSessionState().queueIndex, s.queueIndex);
        }
        gradeButton(grade).click(); await until(() => flash.getSessionState().queueIndex === s.queueIndex + 1);
        assert.equal(flash.getSessionState().cardQueue[s.queueIndex].grade, grade);
      }
    });
    await t.test('reverse mode masks the target and audio, autofocuses, and queues wrong answers atomically', async () => {
      const before = flash.getSessionState(), target = context.wordsData.find(word => word.id === current().wordId), count = spoken.length;
      await flash.setRecallDirection('vi-en'); assert.equal(flash.getSessionState().sessionId, before.sessionId);
      assert.equal($('fc-front-word').textContent, target.meaning); assert.match($('fc-front-context').textContent, /\[ _____ \]/);
      assert.ok(!$('fc-prompt-collocations').textContent.toLowerCase().includes(target.word.toLowerCase()));
      assert.equal(document.activeElement, $('recall-answer-input')); assert.equal(spoken.length, count);
      $('recall-answer-input').value = 'not the word'; $('reverse-recall-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
      await until(() => current().graded); const failed = flash.getSessionState();
      assert.equal(current().grade, 0); assert.equal(failed.queueIndex, before.queueIndex); assert.ok(failed.pendingMisses.includes(target.id));
      assert.match($('recall-feedback').textContent, /Not quite/); assert.equal($('fc-answer-target').textContent, target.word);
      assert.equal((await storage.readUserWord('UIFixture', target.id)).lastGrade, 0);
      assert.equal((await storage.idbGet('metadata', failed.key)).queueIndex, before.queueIndex);
      assert.equal(document.activeElement, $('btn-fc-next'));
      await flash.revealCard(); assert.equal(flash.getSessionState().queueIndex, before.queueIndex);
      assert.equal($('fc-answer').hidden, true);
      assert.equal($('btn-fc-next').hidden, false);
      assert.ok([...document.querySelectorAll('[data-recall-grade]')].every(button => button.hidden));
      $('btn-fc-next').click();
      await until(() => flash.getSessionState().queueIndex === before.queueIndex + 1);
      assert.ok($('btn-fc-next').hidden);
      assert.ok([...document.querySelectorAll('[data-recall-grade]')].every(button => !button.hidden));
    });
    await t.test('correct reverse answers unlock grades; reload retains direction and the exact card', async () => {
      const target = context.wordsData.find(word => word.id === current().wordId), before = flash.getSessionState();
      $('recall-answer-input').value = ` ${target.word.toUpperCase()} `; await flash.submitReverseAnswer();
      assert.equal(current().answerCorrect, true); assert.equal(gradeButton(2).disabled, false);
      flash.resetForUser(); await flash.startNewSession({ restore: true });
      assert.equal(flash.getSessionState().recallDirection, 'vi-en'); assert.equal(flash.getSessionState().queueIndex, before.queueIndex);
      assert.equal(current().answerCorrect, true); assert.equal($('fc-answer').hidden, false);
      await flash.gradeRecall(2); assert.equal((await storage.readUserWord('UIFixture', target.id)).lastRecallDirection, 'vi-en');
    });
    await t.test('reverse recall accepts a synonym and keeps the English target on the answer', async () => {
      const target = context.wordsData.find(word => word.id === current().wordId);
      $('recall-answer-input').value = ` ${target.synonyms[0].toUpperCase()} `;
      await flash.submitReverseAnswer();
      assert.equal(current().answerCorrect, true); assert.equal(gradeButton(2).disabled, false);
      assert.equal($('fc-answer-target').textContent, target.word);
      await flash.gradeRecall(2);
    });
    await t.test('manual reveal and pronunciation hints cannot earn positive reverse grades', async () => {
      const target = context.wordsData.find(word => word.id === current().wordId);
      $('btn-fc-sound').click(); await until(() => current().assisted);
      $('recall-answer-input').value = target.word; await flash.submitReverseAnswer();
      assert.equal(gradeButton(0).disabled, false); assert.equal(gradeButton(2).disabled, true);
      const count = flash.getSessionState().completedAttempts; await flash.gradeRecall(3); assert.equal(flash.getSessionState().completedAttempts, count);
      await flash.revealCard(); assert.equal($('reverse-recall-form').hidden, false); await flash.revealCard(); assert.equal(gradeButton(3).disabled, true);
    });
    await t.test('library right toolbar and text flip only that card; hidden face is inert and content is escaped', () => {
      context.switchView('view-library'); const card = document.querySelector('[data-word-id="fixture_0"]');
      assert.ok(card.querySelector('.library-card-front').textContent.includes(fixtureWord.phonetic));
      assert.ok(card.querySelector('.library-card-front').textContent.includes('robust'));
      assert.deepEqual([...card.querySelectorAll('.library-toolbar button')].map(b => b.dataset.action), ['flip', 'mastery', 'favorite', 'audio', 'edit', 'delete']);
      assert.equal(card.querySelector('.library-card-back').hasAttribute('inert'), true);
      card.querySelector('[data-action="flip"]').click(); assert.equal(card.classList.contains('is-flipped'), true);
      assert.equal(card.querySelector('.library-card-front').hasAttribute('inert'), true);
      assert.equal(card.querySelector('.library-card-back').hasAttribute('inert'), false);
      assert.equal(card.querySelector('.library-example mark').textContent, fixtureWord.word);
      assert.match(card.querySelector('.library-usage').textContent, /people and systems/);
      assert.ok(card.querySelector('.library-usage').textContent.includes('<b>Literal text</b>')); assert.equal(card.querySelector('.library-usage b'), null);
      card.querySelector('[data-action="audio"]').click(); assert.equal(card.classList.contains('is-flipped'), true);
      card.querySelector('.library-example mark').click(); assert.equal(card.classList.contains('is-flipped'), false);
      card.querySelector('.library-card-front h3').click(); assert.equal(card.classList.contains('is-flipped'), true);
    });
    await t.test('library cards ignore scrolling, dragging, cancellation, and text selection but accept a tap', () => {
      const card = document.querySelector('[data-word-id="fixture_1"]');
      const front = card.querySelector('.library-card-front h3');
      const flipped = () => card.classList.contains('is-flipped');
      const pointerClick = () => front.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 }));
      const pointer = (type, x, y, pointerType = 'touch') => {
        const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
        Object.assign(event, { pointerId: 1, pointerType, isPrimary: true });
        assert.equal(front.dispatchEvent(event), true, `${type} must leave native scrolling and selection alone`);
      };

      pointer('pointerdown', 40, 50);
      pointer('pointermove', 40, 61);
      pointer('pointerup', 40, 50);
      pointerClick();
      assert.equal(flipped(), false);

      pointer('pointerdown', 40, 50, 'mouse');
      pointer('pointerup', 70, 50, 'mouse');
      pointerClick();
      assert.equal(flipped(), false);

      pointer('pointerdown', 40, 50);
      pointer('pointercancel', 40, 50);
      pointerClick();
      assert.equal(flipped(), false);

      const selection = window.getSelection();
      const selectedText = document.createRange();
      selectedText.selectNodeContents(front);
      selection.removeAllRanges();
      selection.addRange(selectedText);
      front.click();
      assert.equal(flipped(), false);
      selection.removeAllRanges();

      pointer('pointerdown', 40, 50);
      pointer('pointerup', 41, 55);
      pointerClick();
      assert.equal(flipped(), true);
      card.querySelector('[data-action="flip"]').click();
      assert.equal(flipped(), false);
    });
    await t.test('keyless Quick Fill populates the reviewable form without saving the word', async () => {
      context.switchView('view-entry'); assert.equal(document.activeElement, $('input-word'));
      $('input-word').value = fixtureWord.word;
      const before = (await storage.readUserWords('UIFixture')).length, oldFetch = globalThis.fetch;
      const calls = [];
      globalThis.fetch = async url => {
        calls.push(url);
        if (url.includes('dictionaryapi.dev')) return dictionaryResponse;
        if (url.includes('mymemory.translated.net')) return translationResponse;
        if (url.includes('datamuse.com')) return lookupResponse([{ word: 'community' }]);
        throw new Error('Unexpected lookup URL');
      };
      try {
        const pending = entry.quickFillEntry();
        assert.equal($('btn-entry-quickfill').getAttribute('aria-busy'), 'true');
        assert.equal($('btn-entry-quickfill').disabled, true);
        await pending;
      } finally { globalThis.fetch = oldFetch; }
      assert.equal($('btn-entry-quickfill').hasAttribute('aria-busy'), false);
      assert.equal($('btn-entry-quickfill').disabled, false);
      assert.equal($('confirm-input-meaning').value, fixtureWord.meaning);
      assert.equal($('input-pos').value, 'adj');
      assert.equal($('input-phonetic').value, fixtureWord.phonetic);
      assert.equal($('input-synonyms').value, fixtureWord.synonyms.join(', '));
      assert.equal($('input-cloze').value, fixtureWord.clozeSentence);
      assert.equal($('input-collocations').value, 'resilient community');
      assert.equal($('entry-details').open, true);
      assert.equal(calls.length, 3);
      assert.ok(calls.includes('https://api.datamuse.com/words?rel_jja=resilient&max=3'));
      assert.equal((await storage.readUserWords('UIFixture')).length, before);
    });
    await t.test('Quick Fill retains dictionary details and manual values when optional providers are unavailable', async () => {
      $('input-word').value = fixtureWord.word;
      $('confirm-input-meaning').value = 'manual meaning';
      $('input-phonetic').value = '';
      $('input-collocations').value = 'manual collocation';
      const oldFetch = globalThis.fetch;
      globalThis.fetch = async url => url.includes('dictionaryapi.dev') ? lookupResponse([{ phonetic: fixtureWord.phonetic }]) :
        { ok: false, status: 503 };
      try { await entry.quickFillEntry(); } finally { globalThis.fetch = oldFetch; }
      assert.equal($('input-phonetic').value, fixtureWord.phonetic);
      assert.equal($('confirm-input-meaning').value, 'manual meaning');
      assert.equal($('input-collocations').value, 'manual collocation');
      assert.match($('quickfill-status').textContent, /Filled available details/);
    });
    await t.test('offline or missing dictionary entries show the friendly toast and re-enable the form', async () => {
      const oldFetch = globalThis.fetch, toast = context.showToast, messages = [];
      context.showToast = message => messages.push(message);
      $('input-word').value = 'missingword';
      try {
        Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
        let fetched = 0;
        globalThis.fetch = async () => { fetched++; return { ok: false, status: 404 }; };
        await entry.quickFillEntry();
        assert.equal(fetched, 0);
        delete window.navigator.onLine;
        await entry.quickFillEntry();
        assert.deepEqual(messages, ['Word not found in free dictionary.', 'Word not found in free dictionary.']);
        assert.equal($('btn-entry-quickfill').disabled, false);
        assert.equal($('confirm-input-meaning').value, 'manual meaning');
      } finally { delete window.navigator.onLine; globalThis.fetch = oldFetch; context.showToast = toast; }
    });
    await t.test('an old Quick Fill response cannot overwrite a different word or a manual edit', async () => {
      $('input-word').value = fixtureWord.word; $('confirm-input-meaning').value = '';
      const originalFetch = globalThis.fetch;
      let resolveTranslation;
      globalThis.fetch = async url => {
        if (url.includes('dictionaryapi.dev')) return dictionaryResponse;
        if (url.includes('datamuse.com')) return lookupResponse([]);
        return new Promise(resolve => { resolveTranslation = resolve; });
      };
      try {
        const pending = entry.quickFillEntry(); await until(() => !!resolveTranslation);
        $('confirm-input-meaning').value = 'edited while looking up';
        resolveTranslation(translationResponse);
        await pending;
        assert.equal($('confirm-input-meaning').value, 'edited while looking up');
        resolveTranslation = null;
        const stale = entry.quickFillEntry(); await until(() => !!resolveTranslation);
        $('input-word').value = 'new target'; $('input-word').dispatchEvent(new window.Event('input', { bubbles: true }));
        assert.equal($('btn-entry-quickfill').disabled, false);
        await stale;
        resolveTranslation(translationResponse);
        assert.equal($('confirm-input-meaning').value, 'edited while looking up');
        assert.equal($('input-word').value, 'new target');
      } finally { globalThis.fetch = originalFetch; }
    });
    await t.test('a pending context fallback preserves a manually edited example or cloze pair', async () => {
      entry.resetEntryForUser();
      $('input-word').value = 'absorb';
      $('input-example').value = 'The paper absorbs ink.';
      const originalFetch = globalThis.fetch;
      let resolveSentence;
      globalThis.fetch = async url => {
        if (url.includes('tatoeba.org')) return new Promise(resolve => { resolveSentence = resolve; });
        if (url.includes('dictionaryapi.dev')) return lookupResponse([{ meanings: [{ partOfSpeech: 'verb' }] }]);
        return { ok: false, status: 503 };
      };
      try {
        const pending = entry.quickFillEntry(); await until(() => !!resolveSentence);
        $('input-cloze').value = 'The paper [ _____ ] ink.';
        resolveSentence(lookupResponse({ data: [{ id: 12345, text: 'Plants absorb water.' }] }));
        await pending;
        assert.equal($('input-example').value, 'The paper absorbs ink.');
        assert.equal($('input-cloze').value, 'The paper [ _____ ] ink.');
      } finally { globalThis.fetch = originalFetch; }
    });
    await t.test('Quick Fill saves fallback attribution and keeps it only while the example remains unchanged', async () => {
      entry.resetEntryForUser();
      $('input-word').value = 'absorb';
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async url => {
        if (url.includes('dictionaryapi.dev')) return lookupResponse([{ meanings: [{ partOfSpeech: 'verb' }] }]);
        if (url.includes('tatoeba.org')) return lookupResponse({ data: [{ id: 12345, text: 'Plants absorb water.' }] });
        return { ok: false, status: 503 };
      };
      try { await entry.quickFillEntry(); } finally { globalThis.fetch = originalFetch; }
      assert.equal($('input-example').value, 'Plants absorb water.');
      assert.equal($('input-cloze').value, 'Plants [ _____ ] water.');
      assert.equal($('entry-details').open, true);
      const submit = () => $('single-entry-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
      const find = () => context.wordsData.find(word => word.word === 'absorb');
      $('confirm-input-meaning').value = 'hấp thụ'; submit();
      await until(() => !!find() && !$('btn-confirm-save').disabled);
      const id = find().id;
      assert.equal((await storage.readUserWord('UIFixture', id)).exampleSourceId, 12345);

      context.switchView('view-library'); entry.openWordEditor(find());
      $('input-usage-notes').value = 'Common with liquids.'; submit();
      await until(() => find().usageNotes === 'Common with liquids.' && !$('btn-confirm-save').disabled);
      assert.equal((await storage.readUserWord('UIFixture', id)).exampleSourceId, 12345);

      entry.openWordEditor(find());
      $('input-example').value = 'Sponges absorb water.'; $('input-cloze').value = 'Sponges [ _____ ] water.'; submit();
      await until(() => find().exampleSentence === 'Sponges absorb water.' && !$('btn-confirm-save').disabled);
      assert.equal((await storage.readUserWord('UIFixture', id)).exampleSourceId, undefined);
      context.switchView('view-entry');
    });
    await t.test('AI tab copies a dynamic prompt, rejects the whole invalid batch and imports a valid batch once', async () => {
      const candidate = { ...fixtureWord, word: 'adapt', pos: 'v', meaning: 'thích nghi', phonetic: '/əˈdæpt/',
        collocations: ['adapt quickly', 'adapt to change'], synonyms: ['adjust'], exampleSentence: 'We adapt to change.', clozeSentence: 'We [ _____ ] to change.' };
      $('btn-toggle-ai-library').click(); $('ai-raw-words').value = 'adapt'; $('btn-copy-ai-prompt').click(); await until(() => copied.length === 1);
      assert.ok(copied[0].includes('["adapt"]')); assert.ok(copied[0].includes('"clozeSentence"'));
      const before = (await storage.readUserWords('UIFixture')).length;
      $('import-raw-input').value = JSON.stringify([candidate, { ...candidate, pos: 'invalid' }]); $('btn-execute-import').click();
      await until(() => $('batch-import-status').dataset.error === 'true'); assert.equal((await storage.readUserWords('UIFixture')).length, before);
      const second = { ...candidate, word: 'stable', meaning: 'ổn định', pos: 'adj', collocations: ['stable growth', 'remain stable'],
        exampleSentence: 'Prices remain stable.', clozeSentence: 'Prices remain [ _____ ].' };
      $('ai-raw-words').value = 'adapt\nstable'; $('import-raw-input').value = JSON.stringify([candidate, second]);
      const commit = context.commitVocabularyChanges; let commits = 0;
      context.commitVocabularyChanges = (...args) => { commits++; assert.equal(args[0].length, 2); return commit(...args); };
      try { $('btn-execute-import').click(); await until(() => $('batch-import-status').textContent.includes('2 added')); }
      finally { context.commitVocabularyChanges = commit; }
      assert.equal(commits, 1);
      const imported = (await storage.readUserWords('UIFixture')).find(word => word.word === 'adapt');
      assert.equal(imported.interval, 0); assert.equal(imported.repetition, 0); assert.equal(imported.easeFactor, 2.5); assert.equal(imported.clozeSentence, candidate.clozeSentence);
      assert.ok((await storage.pendingOperations('UIFixture')).some(op => op.wordId === imported.id));
    });
  } finally { flash.resetForUser(); context.clearActivityTimers(); window.close(); }
});
