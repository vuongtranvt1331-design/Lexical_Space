// Restore the hub before its styles load, including on an offline visit.
(() => {
  const key = 'arcade_theme';
  const selector = 'input[name="arcade-theme"]';
  const backgrounds = new Map([['twicelight', '#171A30'], ['pocket', '#F5EEDC'], ['neon', '#10121C'], ['ivory', '#F5F1E8']]);
  function apply(value) {
    const theme = backgrounds.has(value) ? value : value === 'light' ? 'pocket' : 'twicelight';
    document.documentElement.dataset.arcadeTheme = theme;
    document.querySelector('meta[name="theme-color"]').content = backgrounds.get(theme);
    document.querySelectorAll(selector).forEach(input => { input.checked = input.value === theme; });
  }
  function restore() {
    let value;
    try { value = localStorage.getItem(key); } catch { /* Private browsing. */ }
    apply(value);
  }
  restore();
  document.addEventListener('DOMContentLoaded', () => {
    apply(document.documentElement.dataset.arcadeTheme);
    document.querySelectorAll(selector).forEach(input => input.addEventListener('change', () => {
      apply(input.value);
      try { localStorage.setItem(key, input.value); } catch { /* Keep this session's choice. */ }
    }));
  });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) restore();
  });
})();
