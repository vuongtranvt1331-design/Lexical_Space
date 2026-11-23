import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const { JSDOM } = require('jsdom');
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('Chinese study translates the settings independently, retains pinyin, and lets the IME commit before submitting', async () => {
  const { window } = new JSDOM(html, { url:'https://lexical.test/' });
  const { document } = window;
  try {
    Object.assign(globalThis, { document, localStorage:window.localStorage, NodeFilter:window.NodeFilter,
      MutationObserver:window.MutationObserver, indexedDB, IDBKeyRange });
    Object.defineProperty(globalThis, 'navigator', { configurable:true, value: { onLine:true } });
    localStorage.setItem('lexical_learning_language', 'zh');
    localStorage.setItem('lexical_ui_language', 'zh');
    const { interfaceText } = await import('../js/features/interface-text.js');
    await import('../js/features/interface-language.js');
    const { clozeText, matchesRecallAnswer } = await import('../js/core/recall-utils.js');
    const storage = await import('../js/core/idb-manager.js');
    const { buildAIPrompt, validateAIWord } = await import('../js/core/ai-vocabulary.js');
    assert.equal(document.documentElement.lang, 'zh-Hans');
    assert.equal(document.getElementById('input-phonetic-label').textContent, '拼音');
    assert.equal(document.getElementById('settings-heading').textContent.trim(), '设置');
    assert.equal(interfaceText('English → Vietnamese'), '中文 → 越南语');
    assert.equal(interfaceText('Synced'), '已同步');
    assert.equal(clozeText('我明天去学校。', '学校'), '我明天去[ _____ ]。');
    assert.equal(matchesRecallAnswer('学校', { word:'学校' }), true);
    assert.match(buildAIPrompt('学校'), /standard Mandarin pinyin with tone marks/);
    const card = validateAIWord({ word:'学校', meaning:'trường học', pinyin:'xuéxiào', exampleSentence:'我明天去学校。' });
    assert.ok(card.valid);
    assert.equal(storage.DB_NAME, 'LexicalSpaceChineseDB');

    const form = document.getElementById('reverse-recall-form');
    const input = document.getElementById('recall-answer-input');
    let submits = 0;
    form.addEventListener('submit', () => { submits++; });
    const commit = () => form.dispatchEvent(new window.Event('submit', { bubbles:true, cancelable:true }));
    input.dispatchEvent(new window.CompositionEvent('compositionstart', { bubbles:true }));
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Enter', isComposing:true, bubbles:true }));
    input.dispatchEvent(new window.CompositionEvent('compositionend', { bubbles:true }));
    assert.equal(commit(), false);
    assert.equal(submits, 0);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(commit(), true);
    assert.equal(submits, 1);

    await storage.mutateWords([{ username:'Pilot', id:'zh1', type:'UPSERT',
      patch:{ word:'学校', meaning:'trường học', phonetic:'xuéxiào' } }]);
    const { createVocabularySync, flushMutationOutbox } = await import('../js/core/firebase-sync.js');
    const writes = new Map();
    const db = {
      collection: name => ({ doc: id => name + '/' + id }),
      runTransaction: callback => callback({ get: async () => ({ exists:false }), set: (ref, data) => writes.set(ref, data) })
    };
    await flushMutationOutbox({ db, username:'Pilot' });
    assert.equal(writes.get('words_zh/zh1').phonetic, 'xuéxiào');
    assert.equal(writes.size, 2);
    assert.equal(writes.get('vocabulary_stats_zh/userWordStats_v3:Pilot').wordCount, 1);

    // A clean local library receives the record through the same callback as another device.
    await storage.idbDelete('words', ['Pilot', 'zh1']);
    let loaded;
    const refresh = new Promise(resolve => { loaded = resolve; });
    const listener = createVocabularySync({
      db: { collection(name) {
        assert.equal(name, 'words_zh');
        return { where(field, op, profile) {
          assert.deepEqual([field, op, profile], ['username', '==', 'Pilot']);
          return { onSnapshot(_options, read) {
            read({ metadata:{ fromCache:false }, docChanges: () => [
              { type:'added', doc:{ id:'zh1', data:() => writes.get('words_zh/zh1') } }
            ] });
            return () => {};
          } };
        } };
      } },
      onStatus: () => {},
      onChange: loaded
    });
    listener.start('Pilot');
    await refresh;
    listener.stop();
    assert.equal((await storage.readUserWord('Pilot', 'zh1')).phonetic, 'xuéxiào');
  } finally { window.close(); }
});
