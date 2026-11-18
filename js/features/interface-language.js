import { messages } from './interface-messages.js';
import { localFrench, studyLanguage } from '../core/study-language.js';

const uiKey = 'lexical_ui_language';
let ui = 'en';
try { if (localStorage.getItem(uiKey) === 'vi') ui = 'vi'; } catch {}
const english = new Map(Object.entries(messages).map(([en, vi]) => [vi, en]));
english.set('Quick Fill / Điền nhanh', 'Quick Fill');

function translate(source) {
  if (ui === 'vi') {
    const patterns = [
      [/^Word (\d+) of (\d+)$/, 'Từ $1 trên $2'],
      [/^(\d+) not checked in the past 7 days · (\d+) review\.$/, '$1 từ chưa kiểm tra trong 7 ngày · $2 từ ôn.'],
      [/^All eligible words were checked in the past 7 days. 0 new · (\d+) review\.$/, 'Tất cả đã được kiểm tra trong 7 ngày. 0 từ mới · $1 từ ôn.'],
      [/^Not quite\. The answer is “(.+)”\. (Choose Again \(1\) or Hard \(2\) to continue\.)?$/, 'Đáp án là “$1”.']
    ];
    for (const [pattern, replacement] of patterns) if (pattern.test(source)) return source.replace(pattern, replacement);
  }
  const key = english.get(source) || source;
  let result = ui === 'vi' ? (messages[key] || source) : key;
  if (localFrench && (Object.hasOwn(messages, key) || key === 'Type the English word…')) result = result.replaceAll('English', 'French').replaceAll('tiếng Anh', 'tiếng Pháp').replaceAll('Tiếng Anh', 'Tiếng Pháp');
  return result;
}

document.documentElement.lang = ui;
document.documentElement.dataset.learningLanguage = studyLanguage;
document.getElementById('modal-settings').lang = ui;
// The original static DOM contains interface text only. Vocabulary is mounted by main.js afterwards.
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
for (let node; (node = walker.nextNode());) {
  if (node.parentElement.closest('script,style,svg,input,textarea,.language-settings option')) continue;
  const original = node.data.trim();
  if (original && (english.has(original) || Object.hasOwn(messages, original))) {
    node.data = node.data.replace(original, () => translate(original));
  }
}
for (const el of document.querySelectorAll('[aria-label],[title],[placeholder]')) {
  for (const attr of ['aria-label','title','placeholder']) {
    const source = el.getAttribute(attr);
    if (source) el.setAttribute(attr, translate(source));
  }
}
if (localFrench) {
  const placeholders = {'input-word':'école, apprendre','input-phonetic':'/e.kɔl/','input-synonyms':'étudier, apprendre','input-collocations':'aller à l’école','input-example':'Je vais à l’école.','input-cloze':'Je vais à l’[ _____ ].','ai-raw-words':'livre\nécole\napprendre','import-raw-input':'livre | sách | n | Je lis un livre.'};
  for (const [id, value] of Object.entries(placeholders)) document.getElementById(id)?.setAttribute('placeholder', value);
}
const uiSelect = document.getElementById('interface-language');
const studySelect = document.getElementById('learning-language');
uiSelect.value = ui;
studySelect.value = studyLanguage;
document.getElementById('french-storage-note').hidden = !localFrench;
for (const [select, key, previous] of [[uiSelect, uiKey, ui], [studySelect, 'lexical_learning_language', studyLanguage]]) {
  select.addEventListener('change', () => {
    try { localStorage.setItem(key, select.value); }
    catch { select.value = previous; return; }
    location.reload();
  });
}
// These elements contain system labels only. Never translate user-created words, examples or topics.
for (const id of ['check-pool-description','check-progress','check-status','check-history-status','recall-feedback','empty-state-subtitle','empty-state-title','session-continue-label','fc-answer-label','recall-instruction','connection-status-text']) {
  const el = document.getElementById(id);
  if (!el) continue;
  const update = () => {
    const source = el.textContent;
    const value = translate(source);
    if (source !== value) el.textContent = value;
  };
  new MutationObserver(update).observe(el, {childList:true, characterData:true, subtree:true});
}
