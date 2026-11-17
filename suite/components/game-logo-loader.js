/* Logo-only game startup. Navigation, game state, audio and storage stay owned by each game. */
(() => {
  'use strict';
  if (window.SpaceGameLoader) return;
  const READY_EVENT = 'spacegame:ready';
  const MAX_WAIT_MS = 8000;
  const savedInert = new Map();
  let overlay, image, watchdog, bodyObserver, mountObserver;
  let mounted = false, finished = false, decoding = false, logoSettled = false;
  let gameReady = window.__spaceGameReady === true;
  let pageLoaded = document.readyState === 'complete';
  let restoreFocusTo, originalBusy;

  function lock(element) {
    if (element === overlay || !(element instanceof HTMLElement) || savedInert.has(element)) return;
    savedInert.set(element, {
      attribute: element.getAttribute('inert'),
      hadAttribute: element.hasAttribute('inert'),
      hadProperty: 'inert' in element,
      property: element.inert
    });
    element.inert = true;
    element.setAttribute('inert', '');
  }
  function lockBackground() {
    if (!finished) [...document.body.children].forEach(lock);
  }
  function holdFocus(event) {
    if (finished || !mounted || overlay.contains(event.target)) return;
    // Preserve a late promo/modal's own requested focus for after startup.
    if (event.target instanceof HTMLElement && event.target !== document.body) restoreFocusTo = event.target;
    lockBackground();
    overlay.focus({preventScroll: true});
  }
  function cleanup() {
    clearTimeout(watchdog);
    bodyObserver?.disconnect();
    mountObserver?.disconnect();
    document.removeEventListener(READY_EVENT, onReady);
    document.removeEventListener('DOMContentLoaded', mount);
    document.removeEventListener('focusin', holdFocus, true);
    window.removeEventListener('load', onWindowLoad);
    image?.removeEventListener('load', decodeLogo);
    image?.removeEventListener('error', onLogoError);
  }
  function finish(reason) {
    if (finished) return;
    finished = true;
    cleanup();
    for (const [element, original] of savedInert) {
      if (original.hadProperty) element.inert = original.property;
      else delete element.inert;
      if (original.hadAttribute) element.setAttribute('inert', original.attribute);
      else element.removeAttribute('inert');
    }
    savedInert.clear();
    if (mounted) {
      if (originalBusy === null) document.body.removeAttribute('aria-busy');
      else document.body.setAttribute('aria-busy', originalBusy);
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
    }
    document.documentElement.dataset.gameLogoLoaderState = reason;
    if (restoreFocusTo?.isConnected && !restoreFocusTo.closest('[inert]')) restoreFocusTo.focus({preventScroll: true});
  }
  function maybeFinish() {
    if (mounted && gameReady && pageLoaded && logoSettled) finish('ready');
  }
  function settleLogo(failed = false) {
    if (finished || logoSettled) return;
    logoSettled = true;
    if (failed && image) image.style.visibility = 'hidden';
    maybeFinish();
  }
  function onLogoError() { settleLogo(true); }
  function decodeLogo() {
    if (finished || decoding || logoSettled) return;
    decoding = true;
    if (typeof image.decode !== 'function') { settleLogo(!image.naturalWidth); return; }
    Promise.resolve().then(() => image.decode()).then(() => settleLogo(), () => settleLogo(!image.naturalWidth));
  }
  function onReady() {
    gameReady = window.__spaceGameReady = true;
    maybeFinish();
  }
  function onWindowLoad() {
    pageLoaded = true;
    maybeFinish();
  }
  function mount() {
    if (mounted || finished) return;
    overlay = document.querySelector('[data-game-logo-loader]');
    if (!overlay) {
      if (document.readyState !== 'loading') { finished = true; cleanup(); }
      return;
    }
    mounted = true;
    mountObserver?.disconnect();
    image = overlay.querySelector('img');
    restoreFocusTo = document.activeElement;
    originalBusy = document.body.getAttribute('aria-busy');
    // CSS also fails open at8s if this script was unavailable or delayed.
    if (overlay.hidden || getComputedStyle(overlay).visibility === 'hidden') { finish('fallback'); return; }
    overlay.tabIndex = -1;
    document.body.setAttribute('aria-busy', 'true');
    lockBackground();
    bodyObserver = new MutationObserver(lockBackground);
    bodyObserver.observe(document.body, {childList: true});
    document.addEventListener('focusin', holdFocus, true);
    watchdog = setTimeout(() => finish('fallback'), MAX_WAIT_MS);
    if (!image) settleLogo(true);
    else {
      image.addEventListener('load', decodeLogo);
      image.addEventListener('error', onLogoError);
      if (image.complete) {
        if (image.naturalWidth) decodeLogo();
        else onLogoError();
      }
    }
    // A local bootstrap may have finished before the shared script mounted.
    gameReady = gameReady || window.__spaceGameReady === true;
    pageLoaded = pageLoaded || document.readyState === 'complete';
    maybeFinish();
  }
  window.SpaceGameLoader = Object.freeze({
    ready() {
      window.__spaceGameReady = true;
      document.dispatchEvent(new Event(READY_EVENT));
    }
  });
  document.addEventListener(READY_EVENT, onReady);
  window.addEventListener('load', onWindowLoad, {once: true});
  document.addEventListener('DOMContentLoaded', mount, {once: true});
  if (document.documentElement) {
    mountObserver = new MutationObserver(mount);
    mountObserver.observe(document.documentElement, {childList: true, subtree: true});
  }
  mount();
})();
