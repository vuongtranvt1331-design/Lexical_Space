/* One installed application; each feature keeps its own page, code and storage. */
(() => {
  'use strict';
  const base = new URL('../../', document.currentScript.src);
  const paths = Object.freeze({ lexical: './', grammar: 'apps/grammar/', arcade: 'apps/arcade/', 'quick-ears': 'apps/quick-ears/', 'quick-drawn': 'apps/quick-drawn/', 'sky-dominators': 'apps/sky-dominators/', poker: 'apps/poker/', 'vocabulary-test': 'apps/vocabulary-test/' });
  const clean = value => typeof value === 'string' ? value.trim() : '';
  function profile() {
    try { const value = sessionStorage.getItem('ls_active_profile'); if (value !== null) return clean(value); } catch {}
    try { const value = localStorage.getItem('vocab_user'); if (value !== null) return clean(value); } catch {}
    return clean(new URL(location.href).searchParams.get('user'));
  }
  function href(app, params = {}) {
    if (!Object.hasOwn(paths, app)) throw new TypeError('Unknown application');
    const url = new URL(paths[app], base), user = profile();
    if (user) url.searchParams.set('user', user);
    for (const key of ['mode', 'topic']) if (typeof params[key] === 'string' && params[key]) url.searchParams.set(key, params[key]);
    if (['quick-drawn', 'sky-dominators', 'poker', 'grammar', 'vocabulary-test'].includes(app)) {
      const back = new URL(paths.arcade, base);
      if (user) back.searchParams.set('user', user);
      for (const key of ['mode', 'topic']) if (url.searchParams.has(key)) back.searchParams.set(key, url.searchParams.get(key));
      url.searchParams.set('returnUrl', back.href);
    }
    return url.href;
  }
  function safeReturn(value, fallback = 'arcade') {
    try {
      const url = new URL(value, base);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return href(fallback);
      const relative = url.pathname.slice(base.pathname.length);
      if (!['', 'index.html'].includes(relative) && !Object.values(paths).some(path => path !== './' && [path, path + 'index.html'].includes(relative))) return href(fallback);
      url.searchParams.delete('returnUrl');
      const user = profile(); if (user) url.searchParams.set('user', user); else url.searchParams.delete('user');
      return url.href;
    } catch { return href(fallback); }
  }
  function legacyTarget(value) {
    try {
      const url = new URL(value, location.href), last = decodeURIComponent(url.pathname).toLowerCase();
      if (url.origin !== base.origin && url.origin !== 'https://vuongtranvt1331-design.github.io') return null;
      const relative = url.origin === base.origin && url.pathname.startsWith(base.pathname) ? url.pathname.slice(base.pathname.length) : null;
      if (relative !== null && (['', 'index.html'].includes(relative) || Object.values(paths).some(path => path !== './' && relative.startsWith(path)))) return null;
      const known = [['lexical', /\/(lexical_space|lexicalspace)(\/|$)|\/index \(1\)\.html$/], ['grammar', /\/(grammar_space|grammarspace)(\/|$)/], ['arcade', /\/(arcadehub)(\/|$)|\/arcade\.html$/], ['quick-drawn', /\/quickdrawn(\/|$)|\/fast_drawn_wilhelm_scream_instructions/], ['poker', /\/poker(\/|$)|\/wild_west_vocabulary_poker/], ['sky-dominators', /\/sky_dominators(\/|$)|\/air_strike_arcade_game/]];
      for (const [app, pattern] of known) if (pattern.test(last)) return { app, params: Object.fromEntries(url.searchParams) };
      return null;
    } catch { return null; }
  }
  function rewrite(anchor) {
    if (!anchor?.getAttribute('href') || anchor.hasAttribute('download')) return;
    if (anchor.hasAttribute('data-suite-return')) {
      const target = safeReturn(new URL(location.href).searchParams.get('returnUrl'));
      if (anchor.href !== target) anchor.href = target;
    }
    const mapped = legacyTarget(anchor.href);
    if (mapped) { const target = href(mapped.app, mapped.params); if (anchor.href !== target) anchor.href = target; }
    try {
      const url = new URL(anchor.href);
      if (url.origin === base.origin && url.pathname.startsWith(base.pathname) && anchor.target === '_blank') anchor.target = '_self';
    } catch {}
  }
  function ready() { window.__spaceSuiteReady = true; document.dispatchEvent(new CustomEvent('spacesuite:ready')); }
  window.SpaceSuite = Object.freeze({ version: '43.3.0', base: base.href, paths, profile, href, safeReturn, legacyTarget, ready, go: (app, params) => location.assign(href(app, params)) });
  // A remembered tab profile wins over stale user parameters from old bookmarks.
  try {
    const selected = sessionStorage.getItem('ls_active_profile');
    if (selected !== null && document.documentElement.dataset.suiteModule !== 'lexical') {
      const url = new URL(location.href), previous = url.href;
      if (clean(selected)) url.searchParams.set('user', clean(selected)); else url.searchParams.delete('user');
      if (url.href !== previous) history.replaceState(history.state, '', url.href);
    }
  } catch {}
  document.addEventListener('click', event => { const a = event.target.closest?.('a[href]'); if (a) rewrite(a); }, true);
  const mount = () => {
    document.querySelectorAll('a[href]').forEach(rewrite);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'attributes') rewrite(record.target);
        else for (const element of record.addedNodes) if (element.nodeType === 1) {
          if (element.matches('a[href]')) rewrite(element);
          element.querySelectorAll('a[href]').forEach(rewrite);
        }
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['href', 'target'] });
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
    document.documentElement.dataset.spaceSuite = '43.3.0';
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
