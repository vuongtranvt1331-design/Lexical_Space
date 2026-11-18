// A page owns one study library for its lifetime, including pending async writes.
// Settings switches libraries by reloading. Another tab cannot retarget this page.
function readStudyLanguage() {
  if (globalThis.document?.documentElement?.dataset.suiteModule !== 'lexical') return 'en';
  try { return localStorage.getItem('lexical_learning_language') === 'fr' ? 'fr' : 'en'; }
  catch { return 'en'; }
}
export const studyLanguage = readStudyLanguage();
export const localFrench = studyLanguage === 'fr';
export const studyName = localFrench ? 'French' : 'English';
export const studyStorageKey = key => localFrench ? 'lexical:fr:' + key : key;
