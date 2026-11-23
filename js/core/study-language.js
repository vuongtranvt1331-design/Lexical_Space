// A page owns one study library for its lifetime, including pending async writes.
// Settings switches libraries by reloading. Another tab cannot retarget this page.
function readStudyLanguage() {
  if (globalThis.document?.documentElement?.dataset.suiteModule !== 'lexical') return 'en';
  try {
    const saved = localStorage.getItem('lexical_learning_language');
    return ['fr', 'zh'].includes(saved) ? saved : 'en';
  } catch { return 'en'; }
}
export const studyLanguage = readStudyLanguage();
export const englishStudy = studyLanguage === 'en';
export const chineseStudy = studyLanguage === 'zh';
export const studyName = { en: 'English', fr: 'French', zh: 'Mandarin Chinese' }[studyLanguage];
export const studyLocale = { en: 'en-GB', fr: 'fr-FR', zh: 'zh-CN' }[studyLanguage];
export const studyStorageKey = key => englishStudy ? key : `lexical:${studyLanguage}:${key}`;
