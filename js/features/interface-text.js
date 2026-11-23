import { messages } from './interface-messages.js';
import { chineseMessages } from './interface-messages-zh.js';
import { studyLanguage } from '../core/study-language.js';

export const interfaceLanguageKey = 'lexical_ui_language';
function readInterfaceLanguage() {
  try {
    const value = localStorage.getItem(interfaceLanguageKey);
    return ['vi', 'zh'].includes(value) ? value : 'en';
  } catch { return 'en'; }
}
export const interfaceLanguage = readInterfaceLanguage();
const dictionary = { en: {}, vi: messages, zh: chineseMessages }[interfaceLanguage];
const english = new Map(Object.entries(messages).map(([en, vi]) => [vi, en]));
english.set('Quick Fill / Điền nhanh', 'Quick Fill');

const studyLabels = {
  fr: { en: 'French', vi: 'tiếng Pháp', zh: '法语' },
  zh: { en: 'Chinese', vi: 'tiếng Trung', zh: '中文' }
};

const patterns = [
  [/^Word (\d+) of (\d+)$/, 'Từ $1 trên $2', '第 $1 词，共 $2 词'],
  [/^(\d+) not checked in the past 7 days · (\d+) review\.$/, '$1 từ chưa kiểm tra trong 7 ngày · $2 từ ôn.', '过去 7 天内未检测 $1 个词 · 复习 $2 个词。'],
  [/^All eligible words were checked in the past 7 days. 0 new · (\d+) review\.$/, 'Tất cả đã được kiểm tra trong 7 ngày. 0 từ mới · $1 từ ôn.', '所有符合条件的词均已在过去 7 天内检测。新词 0 个 · 复习 $1 个词。'],
  [/^The answer is “([\s\S]+)”\.$/, 'Đáp án là “$1”.', '答案是“$1”。'],
  [/^Missed words will be available again at (.+)\.$/, 'Các từ sai sẽ có thể ôn lại lúc $1.', '答错的词将在 $1 再次开放复习。'],
  [/^Showing: (\d+) words?$/, 'Đang hiện: $1 từ', '显示 $1 个词'],
  [/^(\d+) topics?$/i, '$1 chủ đề', '$1 个主题']
];

export function interfaceText(source) {
  if (typeof source !== 'string') return source;
  if (interfaceLanguage !== 'en') {
    for (const [pattern, vi, zh] of patterns) {
      if (pattern.test(source)) return source.replace(pattern, interfaceLanguage === 'zh' ? zh : vi);
    }
  }
  const key = english.get(source) || source;
  let result = Object.hasOwn(dictionary, key) ? dictionary[key] : key;
  const label = studyLabels[studyLanguage]?.[interfaceLanguage];
  if (label && (Object.hasOwn(messages, key) || key === 'Recall the English word from its meaning and context.')) {
    result = result.replaceAll('English', label).replaceAll('英语', label).replace(/tiếng Anh/gi, original => original.startsWith('T') ?
      label[0].toUpperCase() + label.slice(1) : label);
  }
  return result;
}
