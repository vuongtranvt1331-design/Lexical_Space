/* Instant startup. Type immediately; storage readiness, not animation duration, ends it. */
(() => {
  'use strict';
  let mounted = false, root, typing, removal, finished = false, announced = false;
  const previousInert = new Map();
  function cleanup() {
    clearInterval(typing); clearTimeout(removal); clearTimeout(window.__spaceLoaderFailsafe);
    document.removeEventListener('lexicalspace:ready', finish);
    window.removeEventListener('pagehide', remove);
  }
  function restore() {
    for (const [element, value] of previousInert) if (element.isConnected) element.inert = value;
    previousInert.clear(); document.body?.removeAttribute('aria-busy');
  }
  function announceInteractive() {
    if (announced) return; announced = true;
    document.dispatchEvent(new CustomEvent('lexicalspace:interactive'));
  }
  function remove(event) {
    cleanup(); restore(); root?.remove();
    if (event?.type !== 'pagehide') announceInteractive();
  }
  function finish() {
    if (finished) return; finished = true;
    cleanup(); restore();
    root ||= document.getElementById('space-loader');
    if (!root) { announceInteractive(); return; }
    root.classList.add('is-ready'); root.setAttribute('aria-busy', 'false');
    // Restore controls immediately; the overlay cannot intercept input while fading.
    announceInteractive();
    removal = setTimeout(remove, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
  }
  function mount() {
    if (mounted) return; mounted = true;
    root = document.getElementById('space-loader'); if (!root) return;
    if (finished) { root.remove(); return; }
    root.setAttribute('aria-busy', 'true'); document.body.setAttribute('aria-busy', 'true');
    for (const element of document.body.children) {
      if (element !== root && !['SCRIPT', 'STYLE', 'LINK'].includes(element.tagName)) { previousInert.set(element, element.inert); element.inert = true; }
    }
    const typed = root.querySelector('[data-loader-text]'), text = 'LexicalSpace'; let index = 1;
    if (typed) typed.textContent = text.slice(0, index);
    typing = setInterval(() => {
      if (typed) typed.textContent = text.slice(0, ++index);
      if (index >= text.length) clearInterval(typing);
    }, 35);
    document.addEventListener('lexicalspace:ready', finish, { once: true });
    window.addEventListener('pagehide', remove, { once: true });
    if (window.__lexicalSpaceReady) finish();
  }
  window.SpaceLoader = Object.freeze({ mount, finish });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
