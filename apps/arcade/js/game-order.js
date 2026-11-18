(function () {
  'use strict';

  function getProfile() {
    try {
      const q = new URLSearchParams(window.location.search).get('user');
      if (q && q.trim()) return q.trim();
    } catch (e) {}
    try {
      const tab = window.sessionStorage.getItem('ls_active_profile');
      if (tab !== null && tab.trim()) return tab.trim();
    } catch (e) {}
    try {
      for (const k of ['vocab_user', 'username', 'lexicalSpace_username', 'currentUser']) {
        const v = window.localStorage.getItem(k);
        if (!v) continue;
        const trimmed = v.trim();
        if (!trimmed) continue;
        if (!trimmed.startsWith('{')) return trimmed;
        try {
          const parsed = JSON.parse(trimmed)?.username;
          if (parsed && typeof parsed === 'string' && parsed.trim()) return parsed.trim();
        } catch (e) {}
      }
    } catch (e) {}
    return '';
  }

  const profile = getProfile();
  const storageKey = 'arcade_game_order' + (profile ? ':' + profile : '');

  function getSavedOrder() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return null;
  }

  function saveOrder(order) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(order));
    } catch (e) {}
  }

  function applyOrderToCarousel(carousel) {
    if (!carousel) return;
    const initialTiles = Array.from(carousel.querySelectorAll('[data-game-tile]'));
    if (!initialTiles.length) return;

    const savedOrder = getSavedOrder();
    if (savedOrder && savedOrder.length) {
      const tileMap = new Map();
      initialTiles.forEach(tile => {
        const name = tile.dataset.gameName;
        if (name) tileMap.set(name, tile);
      });

      const ordered = [];
      savedOrder.forEach(name => {
        if (tileMap.has(name)) {
          ordered.push(tileMap.get(name));
          tileMap.delete(name);
        }
      });

      // Append unknown/new entries safely
      initialTiles.forEach(tile => {
        if (tileMap.has(tile.dataset.gameName)) {
          ordered.push(tile);
          tileMap.delete(tile.dataset.gameName);
        }
      });

      ordered.forEach((tile, idx) => {
        tile.dataset.gameIndex = String(idx);
        carousel.appendChild(tile);
      });
    } else {
      initialTiles.forEach((tile, idx) => {
        tile.dataset.gameIndex = String(idx);
      });
    }
  }

  const carousel = document.querySelector('[data-game-carousel]');
  if (carousel) {
    applyOrderToCarousel(carousel);
  }

  window.ArcadeGameOrder = {
    getProfile,
    storageKey,
    getSavedOrder,
    saveOrder,
    applyOrderToCarousel
  };
})();
