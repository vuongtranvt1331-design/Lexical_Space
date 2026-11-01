/* Space family cinematic loader. Dependency-free module pattern; also works over file://. */
(() => {
  'use strict';

  const SPEED = 0.7;
  const TYPING_SPEED = SPEED * 1.7;
  const EASING = 'cubic-bezier(0.25, 1, 0.5, 1)';
  const slow = milliseconds => milliseconds / SPEED;
  const THEMES = Object.freeze({
    ls: { name: 'LexicalSpace', suffix: 'exicalSpace', fallbackSeconds: 2, fallbackFont: 'system-ui, sans-serif' },
    gs: { name: 'GrammarSpace', suffix: 'rammarSpace', fallbackSeconds: 2, fallbackFont: "'Comic Sans MS', cursive" },
    as: { name: 'ArcadeSpace', suffix: 'rcadeSpace', fallbackSeconds: 2, fallbackFont: "'Courier New', monospace" }
  });
  const mounted = new WeakMap();

  function delay(milliseconds, signal) {
    return new Promise(resolve => {
      const done = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', done);
        resolve();
      };
      const timer = setTimeout(done, milliseconds);
      if (signal?.aborted) done();
      else signal?.addEventListener('abort', done, { once: true });
    });
  }

  function metadata(audio, signal) {
    return new Promise(resolve => {
      const valid = () => Number.isFinite(audio.duration) && audio.duration > 0;
      const finish = () => {
        clearTimeout(timer);
        ['loadedmetadata', 'durationchange', 'error', 'abort'].forEach(type => audio.removeEventListener(type, update));
        signal.removeEventListener('abort', finish);
        resolve(valid());
      };
      const update = event => {
        if (valid() || event.type === 'error' || event.type === 'abort') finish();
      };
      const timer = setTimeout(finish, 4000);
      ['loadedmetadata', 'durationchange', 'error', 'abort'].forEach(type => audio.addEventListener(type, update));
      signal.addEventListener('abort', finish, { once: true });
      if (valid() || audio.error || signal.aborted) finish();
      else audio.load();
    });
  }

  async function run(root) {
    const theme = THEMES[root.dataset.spaceLoader];
    const audio = root.querySelector('[data-loader-audio]');
    const prompt = root.querySelector('.space-loader__prompt');
    const logo = root.querySelector('.space-loader__logo');
    const typed = root.querySelector('[data-loader-text]');
    const cursor = root.querySelector('[data-loader-cursor]');
    if (!theme || !audio || !prompt || !logo || !typed || !cursor) {
      root.remove();
      return { reason: 'invalid-markup' };
    }

    clearTimeout(window.__spaceLoaderFailsafe);
    const lifetime = new AbortController();
    const { signal } = lifetime;
    const animations = new Set();
    const startedAt = performance.now();
    const previousFocus = document.activeElement;
    const previousOverflow = document.documentElement.style.overflow;
    const previousInert = new Map();
    let reason = 'complete';
    let audioMode = 'silent';
    let phase = 'initial';
    let duration = theme.fallbackSeconds;
    let frame = 0;

    const emit = next => {
      phase = next;
      root.dataset.phase = next;
      root.dispatchEvent(new CustomEvent('space-loader:phase', { bubbles: true, detail: {
        app: root.dataset.spaceLoader, phase: next, at: performance.now(),
        audioDuration: duration, playbackRate: TYPING_SPEED, audioMode,
        mediaCharacterIntervalMs: duration * 1000 / theme.suffix.length,
        characterIntervalMs: duration * 1000 / TYPING_SPEED / theme.suffix.length
      } }));
    };
    const animate = async (element, frames, milliseconds, options = {}) => {
      if (signal.aborted) return;
      if (!element.animate) {
        Object.assign(element.style, frames[frames.length - 1]);
        return delay(milliseconds, signal);
      }
      const animation = element.animate(frames, {
        duration: milliseconds, easing: EASING, fill: 'forwards', ...options
      });
      animations.add(animation);
      try { await animation.finished; } catch (error) {
        if (error.name !== 'AbortError') throw error;
      }
    };
    const abort = () => {
      lifetime.abort();
      animations.forEach(animation => animation.cancel());
      cancelAnimationFrame(frame);
      audio.pause();
    };
    const watchdog = setTimeout(() => { reason = 'timeout'; abort(); }, 30000);
    const onPageHide = () => { reason = 'pagehide'; abort(); };
    window.addEventListener('pagehide', onPageHide, { once: true });

    try {
      // All active app surfaces are inert until the overlay resolves; preserve prior state.
      for (const child of document.body.children) {
        if (child !== root && !['SCRIPT', 'STYLE', 'LINK'].includes(child.tagName)) {
          previousInert.set(child, child.inert);
          child.inert = true;
        }
      }
      document.documentElement.style.overflow = 'hidden';
      root.tabIndex = -1;
      root.focus({ preventScroll: true });
      audio.preload = 'auto';
      audio.playbackRate = TYPING_SPEED;
      audio.defaultPlaybackRate = TYPING_SPEED;
      audio.preservesPitch = true;
      const ready = metadata(audio, signal);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const settledPrompt = 'translate3d(-50%, calc(-50% + 44px), 0) scale(1)';
      const initialLogo = 'translate3d(-50%, 68px, 0)';
      typed.textContent = '';

      if (reduced) {
        logo.style.opacity = '1';
        logo.style.transform = 'translate3d(-50%, 0, 0)';
        prompt.style.transform = settledPrompt;
      } else {
        // Set the responsive pose before blinking. Freeze a fallback on slow font networks.
        const pose = () => {
          const scale = Math.max(1, Math.min(3.7, (window.innerWidth - 40) / Math.max(1, prompt.offsetWidth)));
          return `translate3d(-50%, -50%, 0) scale(${scale})`;
        };
        prompt.style.transform = pose();
        if (document.fonts) {
          const fontReady = await Promise.race([
            document.fonts.ready.then(() => true), delay(1200, signal).then(() => false)
          ]);
          if (!fontReady) root.style.fontFamily = theme.fallbackFont;
        }
        if (signal.aborted) return;
        const initialPrompt = pose();
        prompt.style.transform = initialPrompt;
        emit('blinking');
        await Promise.all([
          animate(cursor, [
            { opacity: 1, offset: 0, easing: 'steps(1, end)' },
            { opacity: 0, offset: 0.5, easing: 'steps(1, end)' },
            { opacity: 1, offset: 1 }
          ], slow(600), { iterations: 3, easing: 'linear' }),
          ready
        ]);
        if (signal.aborted) return;

        emit('zooming');
        await Promise.all([
          animate(prompt, [{ transform: initialPrompt }, { transform: settledPrompt }], slow(2600)),
          animate(logo, [{ opacity: 0, transform: initialLogo }, {
            opacity: 1, transform: 'translate3d(-50%, 0, 0)'
          }], slow(2600))
        ]);
        if (signal.aborted) return;
      }
      await ready;
      if (signal.aborted) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) duration = audio.duration;

        // No accumulating setInterval: the media timeline is the typing clock.
        await new Promise(resolve => {
          const count = theme.suffix.length;
          const interval = duration / count;
          let lastCount = -1;
          let done = false;
          let fallbackAt = 0;
          let fallbackOffset = 0;
          let playbackTimer;
          let stallTimer;
          const render = amount => {
            if (amount !== lastCount) {
              typed.textContent = theme.suffix.slice(0, amount);
              lastCount = amount;
            }
          };
          const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(playbackTimer);
            clearTimeout(stallTimer);
            stallTimer = undefined;
            cancelAnimationFrame(frame);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', silent);
            audio.removeEventListener('waiting', waiting);
            audio.removeEventListener('playing', playing);
            signal.removeEventListener('abort', finish);
            if (!signal.aborted) render(count);
            resolve();
          };
          const onEnded = () => {
            // Reveal the last glyph in the same JS task as the media's ended event.
            render(count);
            finish();
          };
          const tick = now => {
            if (done) return;
            const mediaTime = audioMode === 'playing'
              ? audio.currentTime
              : fallbackOffset + (now - fallbackAt) / 1000 * TYPING_SPEED;
            // The final character is reserved for ended, including on a throttled tab.
            render(Math.min(count - 1, Math.max(0, Math.floor(mediaTime / interval))));
            if (audioMode !== 'playing' && mediaTime >= duration) finish();
            else if (audio.ended && audioMode === 'playing') onEnded();
            else frame = requestAnimationFrame(tick);
          };
          function silent() {
            if (done || audioMode === 'fallback') return;
            clearTimeout(playbackTimer);
            clearTimeout(stallTimer);
            fallbackOffset = Math.min(duration, Math.max(0, audio.currentTime || 0));
            audio.pause();
            audioMode = 'fallback';
            root.dataset.audio = 'fallback';
            fallbackAt = performance.now();
            emit('typing');
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(tick);
          }
          function waiting() {
            if (stallTimer === undefined) stallTimer = setTimeout(silent, slow(1400));
          }
          function playing() {
            if (done || audioMode === 'fallback') { audio.pause(); return; }
            clearTimeout(playbackTimer);
            clearTimeout(stallTimer);
            stallTimer = undefined;
            const firstStart = audioMode !== 'playing';
            audioMode = 'playing';
            root.dataset.audio = 'playing';
            if (firstStart) {
              emit('typing');
              frame = requestAnimationFrame(tick);
            }
          }
          audio.addEventListener('ended', onEnded);
          audio.addEventListener('error', silent);
          audio.addEventListener('waiting', waiting);
          audio.addEventListener('playing', playing);
          signal.addEventListener('abort', finish, { once: true });
          render(0);
          playbackTimer = setTimeout(silent, slow(1400));
          if (audio.error || !Number.isFinite(audio.duration) || audio.duration <= 0) silent();
          else {
            try {
              const playback = audio.play();
              if (playback?.catch) playback.catch(silent);
            } catch { silent(); }
          }
        });
        if (signal.aborted) return;
        emit('resolving');
        if (reduced) await delay(120, signal);
        else await animate(cursor, [
          { opacity: 1 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }
        ], slow(600));

      if (!signal.aborted) {
        emit('fading');
        await animate(root, [{ opacity: 1 }, { opacity: 0 }], slow(reduced ? 200 : 600));
      }
    } catch (error) {
      reason = 'error';
      console.warn('Space loading screen recovered:', error);
    } finally {
      const result = {
        app: root.dataset.spaceLoader, reason, audioMode, duration,
        elapsedMs: performance.now() - startedAt
      };
      clearTimeout(watchdog);
      window.removeEventListener('pagehide', onPageHide);
      abort();
      // Drop the media resource and every animation/listener before removing the overlay.
      audio.removeAttribute('src');
      audio.load();
      for (const [element, value] of previousInert) element.inert = value;
      document.documentElement.style.overflow = previousOverflow;
      root.setAttribute('aria-busy', 'false');
      emit('complete');
      root.remove();
      if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus({ preventScroll: true });
      document.dispatchEvent(new CustomEvent('space-loader:complete', { detail: result }));
    }
    return { reason, phase, audioMode };
  }

  function mount(root = document.querySelector('[data-space-loader]')) {
    if (!root) return Promise.resolve({ reason: 'absent' });
    if (!mounted.has(root)) mounted.set(root, run(root));
    return mounted.get(root);
  }
  window.SpaceLoader = Object.freeze({ mount, speed: SPEED, typingSpeed: TYPING_SPEED, themes: THEMES });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mount(), { once: true });
  else mount();
})();
