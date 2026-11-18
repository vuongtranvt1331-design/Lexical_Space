import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const { JSDOM } = createRequire(import.meta.url)('jsdom');
const html = await readFile(new URL('../apps/vocabulary-test/index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../apps/vocabulary-test/js/exam.js', import.meta.url), 'utf8');
const appearance = await readFile(new URL('../js/features/appearance.js', import.meta.url), 'utf8');
const bank = JSON.parse(await readFile(new URL('../apps/vocabulary-test/assets/vocabulary_test_bank.json', import.meta.url), 'utf8'));
test('five question sets reset progress and timer and retain custom import support', async () => {
  assert.equal(bank.sets.length, 5);
  for (const [index, set] of bank.sets.entries()) {
    assert.match(set.testCode, new RegExp(` · Bộ ${index + 1}$`));
    assert.doesNotMatch(set.testTitle, /\?/);
    for (const q of set.questions) {
      assert.doesNotMatch(q.explanation, /\?/);
    }
    assert.equal(set.questions.length, 10);
    for (const q of set.questions) {
      assert.deepEqual(q.options.map(o => o.key), ['A','B','C','D']);
      assert.ok(q.options.some(o => o.key === q.correctAnswer));
      assert.ok(q.explanation.trim());
    }
  }
  const dom = new JSDOM(html, {url:'https://example.test/suite/apps/vocabulary-test/', runScripts:'outside-only'});
  const w=dom.window, d=w.document;
  w.fetch=async()=>({ok:true,json:async()=>bank});w.eval(script);
  await new Promise(resolve=>setTimeout(resolve,0));
  const buttons=[...d.querySelectorAll('[data-question-set]')];
  d.querySelector('#optionsGrid button').click(); d.querySelector('#btnFlagQuestion').click();
  w.Date.now = () => Date.parse('2030-01-01T00:00:00Z');
  buttons[4].click();
  assert.equal(d.querySelector('#answeredRatioText').textContent,'0/10');
  assert.equal(d.querySelector('#paletteGrid').children.length,10);
  assert.equal(d.querySelector('#paletteGrid .flagged'),null);
  assert.equal(d.querySelector('#qPromptText').textContent,bank.sets[4].questions[0].question);
  assert.equal(d.querySelector('#examCodeDisplay').textContent, 'Bộ 5 · B2/C1');
  assert.ok(d.querySelector('.question-card .palette-strip #paletteGrid'));
  assert.equal(d.querySelector('#timerDigits').textContent,'15:00');
  assert.deepEqual(buttons.map(b=>b.getAttribute('aria-pressed')),['false','false','false','false','true']);
  dom.window.close();
});
test('exam themes, shortcuts, flagging, submission, review and custom JSON', async () => {
  const dom = new JSDOM(html, {url:'https://example.test/suite/apps/vocabulary-test/', runScripts:'outside-only'});
  const {window:w}=dom, d=w.document, el=id=>d.getElementById(id);
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  w.localStorage.setItem('lexical_theme','plum');w.eval(appearance);
  w.fetch=async()=>({ok:true,json:async()=>bank});w.eval(script);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(el('paletteGrid').children.length,10);assert.equal(el('timerDigits').textContent,'15:00');
  assert.equal(d.documentElement.dataset.lexicalTheme,'plum');
  w.localStorage.setItem('lexical_theme','mist');
  w.dispatchEvent(new w.StorageEvent('storage',{key:'lexical_theme',newValue:'mist'}));
  assert.equal(d.documentElement.dataset.lexicalTheme,'mist');
  d.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:'2',bubbles:true}));assert.equal(el('answeredRatioText').textContent,'1/10');
  assert.equal(el('optionsGrid').children[1].getAttribute('aria-pressed'),'true');
  el('btnFlagQuestion').click();assert.equal(el('paletteGrid').children[0].classList.contains('flagged'),true);
  el('btnOpenSubmitModal').click();assert.match(el('submitWarningMsg').textContent,/9 unanswered/);el('btnConfirmFinalSubmit').click();
  assert.equal(el('resUnansweredVal').textContent,'9');assert.equal(el('reviewListContainer').children.length,10);assert.match(el('reviewListContainer').textContent,/Explanation:/);
  el('btnRestartExam').click();assert.equal(el('answeredRatioText').textContent,'0/10');
  const input=el('jsonFileInput');const bad={name:'bad.json',text:async()=>JSON.stringify({questions:[]})};Object.defineProperty(input,'files',{value:[bad],configurable:true});input.dispatchEvent(new w.Event('change'));await new Promise(resolve=>setTimeout(resolve,0));assert.match(el('status').textContent,/non-empty/);assert.equal(el('paletteGrid').children.length,10);
  const custom={...bank,questions:[{...bank.questions[0], question:'<img src=x onerror=alert(1)>',explanation:'Custom explanation'}]};const good={name:'test.json',text:async()=>JSON.stringify(custom)};Object.defineProperty(input,'files',{value:[good],configurable:true});input.dispatchEvent(new w.Event('change'));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(el('paletteGrid').children.length,1);assert.equal(el('qPromptText').querySelector('img'),null);el('btnOpenSubmitModal').click();el('btnConfirmFinalSubmit').click();assert.match(el('reviewListContainer').textContent,/Custom explanation/);assert.equal(el('reviewListContainer').querySelector('img'),null);dom.window.close();
});
