import { chineseStudy, englishStudy, studyLanguage } from '../core/study-language.js';
import { interfaceLanguage as ui, interfaceLanguageKey as uiKey, interfaceText as translate } from './interface-text.js';

const uiLocale = ui === 'zh' ? 'zh-Hans' : ui;
document.documentElement.lang = uiLocale;
document.title = translate(document.title);
document.documentElement.dataset.learningLanguage = studyLanguage;
document.getElementById('modal-settings').lang = uiLocale;
// The original static DOM contains interface text only. Vocabulary is mounted by main.js afterwards.
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
for (let node; (node = walker.nextNode());) {
  if (node.parentElement.closest('script,style,svg,input,textarea')) continue;
  const original = node.data.trim();
  if (original) {
    node.data = node.data.replace(original, () => translate(original));
  }
}
for (const el of document.querySelectorAll('[aria-label],[title],[placeholder]')) {
  for (const attr of ['aria-label','title','placeholder']) {
    const source = el.getAttribute(attr);
    if (source) el.setAttribute(attr, translate(source));
  }
}
if (!englishStudy) {
  const placeholders = chineseStudy ? { 'input-word':'学校、学习', 'input-phonetic':'xuéxiào', 'input-synonyms':'学习, 研习', 'input-collocations':'去学校', 'input-example':'我明天去学校。', 'input-cloze':'我明天去[ _____ ]。', 'ai-raw-words':'学校\n学习\n老师', 'import-raw-input':'学校 | trường học' } : {'input-word':'école, apprendre','input-phonetic':'/e.kɔl/','input-synonyms':'étudier, apprendre','input-collocations':'aller à l’école','input-example':'Je vais à l’école.','input-cloze':'Je vais à l’[ _____ ].','ai-raw-words':'livre\nécole\napprendre','import-raw-input':'livre | sách | n | Je lis un livre.'};
  for (const [id, value] of Object.entries(placeholders)) document.getElementById(id)?.setAttribute('placeholder', value);
}
if (chineseStudy) {
  document.getElementById('input-phonetic-label').textContent = translate('Pinyin');
  for (const id of ['recall-answer-input', 'check-answer', 'input-word']) document.getElementById(id).lang = 'zh-Hans';
  for (const id of ['reverse-recall-form', 'check-form', 'single-entry-form']) {
    const form = document.getElementById(id);
    let composing = false, compositionEnter = false;
    form.addEventListener('compositionstart', () => { composing = true; });
    form.addEventListener('compositionend', () => { composing = false; });
    form.addEventListener('focusout', () => { composing = false; });
    form.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || !(composing || event.isComposing || event.keyCode === 229)) return;
      compositionEnter = true;
      // Let the IME commit its selection. Suppress only the resulting form submission.
      setTimeout(() => { compositionEnter = false; }, 0);
    });
    form.addEventListener('submit', event => {
      if (!composing && !compositionEnter) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true });
  }
}
for (const [id, key, previous] of [
  ['interface-language', uiKey, ui],
  ['learning-language', 'lexical_learning_language', studyLanguage]
]) {
  const group = document.getElementById(id);
  const selected = group.querySelector('input[value="' + previous + '"]');
  selected.checked = true;
  group.addEventListener('change', event => {
    const radio = event.target;
    if (!radio.checked || radio.value === previous) return;
    try { localStorage.setItem(key, radio.value); }
    catch { selected.checked = true; return; }
    location.reload();
  });
}
// These elements contain system labels only. Never translate user-created words, examples or topics.
for (const id of ['check-pool-description','check-progress','check-status','check-history-status','recall-feedback','empty-state-subtitle','empty-state-title','session-continue-label','connection-status-text','sync-status','lib-count-status','review-topic-menu-count']) {
  const el = document.getElementById(id);
  if (!el) continue;
  const update = () => {
    const source = el.textContent;
    const value = translate(source);
    if (source !== value) el.textContent = value;
  };
  update();
  new MutationObserver(update).observe(el, {childList:true, characterData:true, subtree:true});
}
