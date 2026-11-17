// Apply the saved palette before the first paint, including on offline launches.
(() => {
  const key = 'lexical_theme';
  const choices = 'input[name="lexical-theme"]';
  function apply(value) {
    const theme = value === 'dark' || value === 'plum' ? 'plum'
      : value === 'light' || value === 'mist' ? 'mist' : 'ivory';
    document.documentElement.dataset.lexicalTheme = theme;
    document.querySelector('meta[name="theme-color"]').content = { ivory: '#F5F1E8', mist: '#EDF2F8', plum: '#252333' }[theme];
    document.querySelectorAll(choices).forEach(input => { input.checked = input.value === theme; });
  }
  function restore() {
    let saved;
    try { saved = localStorage.getItem(key); } catch { /* Storage may be unavailable. */ }
    apply(saved);
  }
  restore();
  document.addEventListener('DOMContentLoaded', () => {
    apply(document.documentElement.dataset.lexicalTheme);
    document.querySelectorAll(choices).forEach(input => input.addEventListener('change', () => {
      apply(input.value);
      try { localStorage.setItem(key, input.value); } catch { /* Keep the current page preference. */ }
    }));
  });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) restore();
  });
})();
