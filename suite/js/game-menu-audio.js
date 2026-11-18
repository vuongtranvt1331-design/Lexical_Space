// Shared interface cues for the three games. Gameplay audio remains game-owned.
(() => {
  const exitOnly = Boolean(document.currentScript?.dataset && 'exitOnly' in document.currentScript.dataset);
  const assets = new URL('../../apps/arcade/assets/audio/', document.currentScript.src);
  function cue(file) {
    const player = new Audio();
    player.preload = 'auto';
    player.src = new URL(file, assets).href;
    return player;
  }
  const menu = cue('menu-select.mp3'), exit = cue('menu-exit.mp3');
  const toggles = '[data-word-sound], [data-sky-sound], #soundToggleBtn';
  const exits = 'a[data-menu-hub], a[data-suite-return]';
  const gameInputs = '#answers,[data-chess-board],#studentGrid,#opponentGrid,#inGameSkillBtn,main[data-quiet-exercise][data-scene="exercise"]';
  let leaving = false;
  function handle(event) {
    if (!event.isTrusted || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const button = event.target.closest?.('button,a[href],summary,[role="button"]');
    if (!button || button.closest(gameInputs) || button.matches(':disabled,[aria-disabled="true"]')) return;
    if (exitOnly && !button.matches(exits)) return;
    if (leaving) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    const isMute = document.querySelector(toggles)?.getAttribute('aria-pressed') === 'false';
    menu.pause(); exit.pause();
    if (button.matches(toggles) ? !isMute : isMute) return;
    const player = button.matches(exits) ? exit : menu;
    if (player.error) return;
    player.volume = SpaceEffects.gain();
            player.currentTime = 0;
    if (player === exit && button.matches('a[href]') && (!button.target || button.target === '_self')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      leaving = true;
      const controller = new AbortController();
      const opts = {once:true, signal:controller.signal};
      let timeout;
      function reset() { controller.abort(); clearTimeout(timeout); leaving = false; }
      function finish() {
        if (controller.signal.aborted) return;
        reset();
        button.click(); // Preserve the game's existing exit cleanup and destination.
      }
      window.addEventListener('pagehide', reset, opts);
      player.addEventListener('ended', finish, opts);
      player.addEventListener('error', finish, opts);
      timeout = setTimeout(finish, 2000);
      player.addEventListener('playing', () => {
        clearTimeout(timeout);
        timeout = setTimeout(finish, (Number.isFinite(player.duration) ? player.duration : 2) * 1000 + 600);
      }, opts);
      player.play().catch(finish);
    } else {
      player.play().catch(() => {});
    }
  }
  document.addEventListener('click', handle, true);
  // Sky handles touchstart directly on Pause and suppresses the native click.
  document.addEventListener('touchstart', event => {
    if (event.target.closest?.('#inGamePauseBtn')) handle(event);
  }, {capture:true, passive:true});
})();
