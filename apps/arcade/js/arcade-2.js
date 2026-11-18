
    (function () {
      'use strict';

      // =========================================================================
      // 1. 8-BIT RETRO SOUND SYNTHESIZER (Pure Web Audio API)
      // =========================================================================
      class RetroAudioEngine {
        constructor() {
          this.ctx = null;
          this.muted = false;
          this.volume = 0.5;
          try {
            this.muted = localStorage.getItem('arcade_sound_muted') === 'true';
            const saved = localStorage.getItem('arcade_sound_volume');
            if (saved !== null && /^(100|[1-9]?\d)$/.test(saved)) this.volume = Number(saved) / 100;
          } catch { /* Settings still work for this visit. */ }
        }

        init() {
          if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
          }
          if (this.ctx && this.ctx.state !== "running" && this.ctx.state !== "closed") {
            return this.ctx.resume();
          }
        }


        async playBlip() {
          if (this.muted || !this.volume) return;
          try { await this.init(); } catch { return; }
          if (!this.ctx || this.muted || !this.volume || this.ctx.state !== "running") return;

          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(480, now);
          osc.frequency.exponentialRampToValueAtTime(960, now + 0.05);
          gain.gain.setValueAtTime(0.08 * SpaceEffects.gain(this.volume), now);
          gain.gain.exponentialRampToValueAtTime(0.001 * SpaceEffects.gain(this.volume), now + 0.06);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.07);
        }

        // Tactile Mechanical Keyboard / Gamepad Switch Sound



      }

      const audio = new RetroAudioEngine();
      const unavailableSound = document.querySelector('[data-unavailable-sound]');
      const switchSound = document.querySelector('[data-switch-sound]');
      function playSwitchSound() {
        if (audio.muted || switchSound.error) return;
        switchSound.currentTime = 0;
        switchSound.play().catch(() => {});
      }

      // =========================================================================
      // 2. USER PASSPORT & LOCAL WORDS DETECTION
      // =========================================================================
      function sortTopicsNumericFirst(topics) {
        return [...topics].sort((a, b) => {
          const parseTopic = (t) => {
            const match = String(t || "").trim().match(/^(\d+)(?:\.|\s|-|_)?(.*)$/);
            if (match) {
              return { hasNumber: true, num: parseInt(match[1], 10), rest: match[2].trim() };
            }
            return { hasNumber: false, num: Infinity, rest: String(t || "").trim() };
          };

          const parsedA = parseTopic(a);
          const parsedB = parseTopic(b);

          if (parsedA.hasNumber && parsedB.hasNumber) {
            if (parsedA.num !== parsedB.num) return parsedA.num - parsedB.num;
            return parsedA.rest.localeCompare(parsedB.rest, undefined, { sensitivity: 'base', numeric: true });
          }

          if (parsedA.hasNumber && !parsedB.hasNumber) return -1;
          if (!parsedA.hasNumber && parsedB.hasNumber) return 1;

          return parsedA.rest.localeCompare(parsedB.rest, undefined, { sensitivity: 'base', numeric: true });
        });
      }

      async function queryIndexedDBWordData(username) {
        const words = await window.lexicalVocabulary?.readWords(username) || [];
        const topicMap = new Map();
        let synonymCount = 0;
        for (const word of words) {
          for (const topic of window.lexicalVocabulary.topicsOf(word)) {
            topicMap.set(topic, (topicMap.get(topic) || 0) + 1);
          }
          const hasSynonyms = word.synonym1 || word.synonym || word.synonym2 || (Array.isArray(word.synonyms) && word.synonyms.length > 0);
          if (hasSynonyms) synonymCount++;
        }
        return { totalCount: words.length, synonymCount, topicMap, sortedTopics: sortTopicsNumericFirst(topicMap.keys()) };
      }


      // Console presentation only; no vocabulary, profile or game-state writes.
      function createHubControls() {
        const carousel = document.querySelector('[data-game-carousel]');
        const tiles = [...document.querySelectorAll('[data-game-tile]')];
        if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
          const demo = tiles.find(tile => tile.dataset.gameName === 'Quick Ears');
          const cover = demo?.querySelector('button.game-cover');
          if (cover) {
            const link = document.createElement('a');
            link.href = '../quick-ears/';
            link.className = 'game-cover mobile-btn-play';
            link.dataset.gameLaunch = '';
            link.dataset.loaderGame = 'quick-ears';
            link.setAttribute('aria-label', 'Play Quick Ears local preview');
            link.append(cover.querySelector('img'));
            cover.replaceWith(link);
            demo.classList.remove('is-coming-soon');
            demo.removeAttribute('tabindex');
            demo.setAttribute('aria-label', 'Quick Ears local preview');
          }
        }
        carousel.parentElement.querySelector('[data-library-count]').textContent = tiles.length + (tiles.length === 1 ? ' application' : ' applications');
        const previous = document.querySelector('[data-game-previous]');
        const next = document.querySelector('[data-game-next]');
        const play = document.querySelector('[data-hub-play]');
        const playLabel = document.querySelector('[data-play-label]');
        const summary = document.querySelector('[data-selection-summary]');
        const dialog = document.querySelector('[data-settings-dialog]');
        const settingsButton = document.querySelector('[data-open-settings]');
        const soundButton = document.getElementById('btnSoundToggle');
        const soundIcon = document.getElementById('soundIcon');
        const soundState = document.querySelector('[data-sound-state]');
        const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
        const switchInterval = 500;
        let nextSwitchAt = 0;
        let selected = 0, ready = false, swipe, suppressClickUntil = 0;
        const wrap = index => ((index % tiles.length) + tiles.length) % tiles.length;

        const volumeSlider = dialog.querySelector('[data-hub-volume]');
        const volumeValue = dialog.querySelector('[data-volume-value]');
        const soundClips = [...document.querySelectorAll('audio')];
        function renderSound() {
          const enabled = !audio.muted;
          volumeSlider.disabled = !enabled;
          volumeSlider.value = Math.round(audio.volume * 100);
          volumeValue.textContent = volumeSlider.value + '%';
          volumeSlider.setAttribute('aria-valuetext', volumeValue.textContent);
          for (const clip of soundClips) {
            clip.volume = SpaceEffects.gain(audio.volume) * (clip === switchSound ? 0.5 : 1.0);
            clip.muted = !enabled || audio.volume === 0;
          }
          soundIcon.classList.toggle('icon-sound-on', enabled);
          soundIcon.classList.toggle('icon-sound-off', !enabled);
          soundState.textContent = enabled ? 'On' : 'Off';
          soundButton.setAttribute('aria-pressed', String(enabled));
          soundButton.setAttribute('aria-label', enabled ? 'Turn sound effects off' : 'Turn sound effects on');
          soundButton.title = enabled ? 'Sound effects: on' : 'Sound effects: off';
        }
        function setSound(enabled) {
          audio.muted = !enabled;
          try { localStorage.setItem('arcade_sound_muted', String(audio.muted)); } catch {}
          if (!enabled) { switchSound.pause(); unavailableSound.pause(); }
          renderSound();
          if (enabled) audio.playBlip();
        }
        // Position is measured in cards, so crossing the last index has no seam.
        let position = 0, destination = 0, frame = 0, layoutCenter, pitch = 1;
        const edges = [-1, 1].map(() => {
          const edge = document.createElement('article');
          edge.className = 'game-tile ring-edge';
          edge.inert = true;
          edge.setAttribute('aria-hidden', 'true');
          carousel.append(edge);
          return edge;
        });
        function paint(value) {
          position = value;
          const center = Math.round(value);
          if (center !== layoutCenter) {
            layoutCenter = center;
            const count = Math.min(tiles.length, 3);
            const first = center - Math.floor((count - 1) / 2);
            tiles.forEach((tile, index) => {
              const slot = wrap(index - first);
              tile.hidden = slot >= count;
              tile.style.gridColumn = String(Math.min(slot, count - 1) + 1);
            });
            edges.forEach((edge, index) => {
              const source = tiles[wrap(first + (index ? count : -1))];
              const cover = document.createElement('span');
              cover.className = 'game-cover';
              cover.append(source.querySelector('img').cloneNode());
              edge.replaceChildren(cover, source.querySelector('.game-caption').cloneNode(true));
              edge.style.gridColumn = String(index ? count : 1);
              edge.style.setProperty('--edge-shift', index ? '1' : '-1');
            });
            pitch = tiles[wrap(center)].getBoundingClientRect().width + parseFloat(getComputedStyle(carousel).columnGap);
            carousel.style.setProperty('--ring-pitch', pitch + 'px');
          }
          carousel.style.setProperty('--ring-offset', ((center - value) * pitch) + 'px');
        }
        function renderSelection() {
          const tile = tiles[selected];
          tiles.forEach((item, index) => {
            item.classList.toggle('is-selected', index === selected);
            const link = item.querySelector('[data-game-launch]');
            if (link) {
              link.tabIndex = index === selected ? 0 : -1;
              if (index === selected) link.setAttribute('aria-current', 'true');
              else link.removeAttribute('aria-current');
            }
          });
          const playable = !!tile.querySelector('[data-game-launch]');
          play.disabled = !ready;
          play.toggleAttribute('data-coming-soon', !playable);
          play.setAttribute('aria-label', playable ? 'Play ' + tile.dataset.gameName : tile.dataset.gameName + ' — coming soon');
          playLabel.textContent = playable ? 'Play' : 'Coming soon';
          summary.textContent = tile.dataset.gameName + ' selected. ' + tile.dataset.gameDescription;
        }
        function triggerTileLift(tile) {
          const cover = tile?.querySelector('.game-cover');
          if (!cover || tile.classList.contains('ring-edge')) return;
          cover.classList.remove('is-lifting');
          void cover.offsetWidth;
          cover.classList.add('is-lifting');
          setTimeout(() => { cover.classList.remove('is-lifting'); }, 500);
        }

        function settle(target, focus = false, arrow = false, onSettled) {
          cancelAnimationFrame(frame);
          const start = position, distance = target - start;
          destination = target;
          selected = wrap(target);
          renderSelection();
          function finish() {
            paint(target);
            frame = 0;
            triggerTileLift(tiles[selected]);
            onSettled?.();
            if (focus) (tiles[selected].querySelector('[data-game-launch]') || tiles[selected]).focus({preventScroll:true});
          }
          if ((!arrow && reduceMotion.matches) || Math.abs(distance) < .001) { finish(); return; }
          const began = performance.now();
          const duration = arrow ? switchInterval : Math.min(switchInterval, 240 + Math.abs(distance) * 260);
          function advance(now) {
            const t = Math.max(0, Math.min(1, (now - began) / duration));
            if (t >= 1) { finish(); return; }
            const progress = arrow ? t * t * (3 - 2 * t) : 1 - (1 - t) ** 3;
            paint(start + distance * progress);
            frame = requestAnimationFrame(advance);
          }
          frame = requestAnimationFrame(advance);
        }
        function select(index, {focus = false, sound = false, arrow = false, onSettled} = {}) {
          const now = performance.now();
          if (now < nextSwitchAt || swipe?.dragging || wrap(index) === selected) return;
          let delta = index - selected;
          if (Math.abs(delta) > tiles.length / 2) delta -= Math.sign(delta) * tiles.length;
          nextSwitchAt = now + switchInterval;
          swipe = null;
          settle(destination + Math.sign(delta), focus, arrow, onSettled);
          if (delta && sound) playSwitchSound();
        }
        function launchSelected() {
          if (!ready || dialog.open) return;
          triggerTileLift(tiles[selected]);
          // Always reuse the original launch anchor and its topic validation.
          const link = tiles[selected].querySelector('[data-game-launch]');
          if (link) { link.click(); return; }
          if (audio.muted || unavailableSound.error || !unavailableSound.paused) return;
          switchSound.pause();
          unavailableSound.currentTime = 0;
          unavailableSound.play().catch(() => {});
        }
        volumeSlider.addEventListener('input', () => {
          audio.volume = Number(volumeSlider.value) / 100;
          renderSound();
        });
        volumeSlider.addEventListener('change', () => {
          try { localStorage.setItem('arcade_sound_volume', volumeSlider.value); } catch {}
          audio.playBlip();
        });
        soundButton.addEventListener('click', () => setSound(audio.muted));
        renderSound();
        settingsButton.addEventListener('click', () => { dialog.showModal(); audio.playBlip(); });
        document.querySelectorAll('[data-close-settings]').forEach(button => button.addEventListener('click', () => dialog.close()));
        dialog.addEventListener('close', () => settingsButton.focus({preventScroll: true}));
        dialog.addEventListener('click', event => {
          if (event.target !== dialog) return;
          const box = dialog.getBoundingClientRect();
          if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
        });
        play.addEventListener('click', launchSelected);
        tiles.forEach((tile, index) => {
          tile.addEventListener('click', event => {
            if (index !== selected) {
              event.preventDefault();
              event.stopPropagation();
              const unavailable = !tile.querySelector('[data-game-launch]');
              select(index, {sound:!unavailable, onSettled:unavailable ? launchSelected : undefined});
            } else if (!tile.querySelector('[data-game-launch]')) launchSelected();
          }, true);
          const link = tile.querySelector('[data-game-launch]');
          link?.addEventListener('click', event => {
            select(index);
            if (index === selected) triggerTileLift(tile);
            if (!ready) event.preventDefault();
          });
        });
        previous?.addEventListener('click', () => { if (!dialog.open) select(selected - 1, {sound: true, arrow:true}); });
        next?.addEventListener('click', () => { if (!dialog.open) select(selected + 1, {sound: true, arrow:true}); });
        function refreshLayout() { layoutCenter = undefined; paint(position); }
        refreshLayout();
        new ResizeObserver(refreshLayout).observe(carousel);
        carousel.addEventListener('dragstart', event => event.preventDefault());
        carousel.addEventListener('pointerdown', event => {
          if (performance.now() >= nextSwitchAt && event.isPrimary && event.button === 0) swipe = {id:event.pointerId, x:event.clientX, y:event.clientY, dragging:false};
        });
        function drag(event) {
          if (!swipe || swipe.id !== event.pointerId) return;
          const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
          if (!swipe.dragging) {
            if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; }
            if (Math.abs(dx) < 5 || Math.abs(dx) <= Math.abs(dy)) return;
            cancelAnimationFrame(frame);
            frame = 0;
            swipe.start = position;
            swipe.dragging = true;
            carousel.setPointerCapture(event.pointerId);
          }
          paint(Math.max(destination - 1, Math.min(destination + 1, swipe.start - dx / pitch)));
        }
        carousel.addEventListener('pointermove', drag);
        function release(event) {
          if (!swipe || swipe.id !== event.pointerId) return;
          const gesture = swipe;
          swipe = null;
          if (!gesture.dragging) return;
          suppressClickUntil = performance.now() + 300;
          const travel = position - destination;
          if (event.type === 'pointerup' && Math.abs(travel) * pitch >= Math.min(35, pitch / 2)) {
            select(selected + Math.sign(travel), {sound:true});
          } else {
            settle(destination);
          }
        }
        window.addEventListener('pointerup', release);
        window.addEventListener('pointercancel', release);
        let wheelDistance = 0, lastWheel = 0;
        carousel.addEventListener('wheel', event => {
          const delta = event.deltaX || (event.shiftKey ? event.deltaY : 0);
          if (!delta || event.ctrlKey || (!event.shiftKey && Math.abs(delta) < Math.abs(event.deltaY))) return;
          event.preventDefault();
          const now = performance.now();
          if (now < nextSwitchAt || swipe?.dragging) { wheelDistance = 0; return; }
          if (now - lastWheel > 200 || Math.sign(delta) !== Math.sign(wheelDistance)) wheelDistance = 0;
          lastWheel = now;
          wheelDistance += delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? carousel.clientWidth : 1);
          if (Math.abs(wheelDistance) >= 80) { select(selected + Math.sign(delta), {sound:true}); wheelDistance = 0; }
        }, {passive:false});
        carousel.addEventListener('click', event => {
          if (event.detail && (frame || performance.now() < suppressClickUntil)) {
            event.preventDefault();
            event.stopPropagation();
          }
        }, true);
        document.addEventListener('keydown', event => {
          if (dialog.open || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
          const target = event.target;
          if (target.closest('select, input, textarea, [contenteditable="true"]')) return;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            select(selected + (event.key === 'ArrowRight' ? 1 : -1), {focus: true, sound: true, arrow:true});
          } else if (event.key === 'Enter' && !event.repeat && (target === document.body || target === carousel || target.matches('[data-game-launch], .is-coming-soon.is-selected'))) {
            event.preventDefault();
            launchSelected();
          }
        });
        renderSelection();
        return {setReady() { ready = true; renderSelection(); }};
      }

      window.addEventListener('DOMContentLoaded', async () => {
        const hub = createHubControls();
        const profile = window.lexicalVocabulary?.activeProfile() || '';
        const activeUser = profile || 'Guest Cowboy';
        const domName = document.getElementById('playerName');
        const domAvatar = document.getElementById('playerAvatar');
        const domWordCount = document.getElementById('playerWordCount');
        const vocabModeSelect = document.getElementById('arcadeVocabModeSelect');
        const vocabModeBadge = document.getElementById('vocabModeBadge');
        const topicWrapper = document.getElementById('arcadeTopicWrapper');
        const topicSelect = document.getElementById('arcadeTopicSelect');
        const topicWordBadge = document.getElementById('topicWordCountBadge');
        const modeWarningMsg = document.getElementById('modeWarningMsg');
        const btnQD = document.getElementById('btnPlayQuickDrawn');
        const btnPK = document.getElementById('btnPlayPoker');
        const btnAS = document.getElementById('btnPlayAirStrike');
        domName.textContent = activeUser;
        domAvatar.textContent = (activeUser.charAt(0) || 'G').toUpperCase();

        const wordData = await queryIndexedDBWordData(profile);
        domWordCount.textContent = wordData.totalCount > 0 ? String(wordData.totalCount) : '24+';
        const urlParams = new URLSearchParams(window.location.search);
        let selectedMode = (urlParams.get('mode') || sessionStorage.getItem('arcade_vocab_mode') || 'full').trim().toLowerCase();
        if (!['full', 'topic'].includes(selectedMode)) {
          selectedMode = 'full';
          sessionStorage.setItem('arcade_vocab_mode', 'full');
        }
        vocabModeSelect.value = selectedMode;
        let selectedTopic = (urlParams.get('topic') || sessionStorage.getItem('arcade_selected_topic') || '').trim();
        topicSelect.replaceChildren(new Option('Choose a topic', ''));
        wordData.sortedTopics.forEach(topic => {
          const count = wordData.topicMap.get(topic) || 0;
          topicSelect.appendChild(new Option(`${topic} (${count} words)`, topic));
        });
        // Restore the canonical option text after the existing case-insensitive lookup.
        selectedTopic = wordData.sortedTopics.find(topic => topic.toLowerCase() === selectedTopic.toLowerCase()) || '';
        topicSelect.value = selectedTopic;

        function updateGameLinks(mode, topic) {
          const userParam = profile ? `user=${encodeURIComponent(profile)}` : '';
          const modeParam = `mode=${encodeURIComponent(mode)}`;
          const topicParam = mode === 'topic' && topic ? `topic=${encodeURIComponent(topic)}` : '';
          const returnUrlParam = `returnUrl=${encodeURIComponent(window.location.href)}`;
          const queryString = '?' + [userParam, modeParam, topicParam, returnUrlParam].filter(Boolean).join('&');
          const isGitHubPages = window.location.hostname.endsWith('github.io');
          const qdUrl = window.SpaceSuite ? SpaceSuite.href('quick-drawn', {mode, topic}) : isGitHubPages
            ? `https://vuongtranvt1331-design.github.io/QuickDrawn/${queryString}` : `../quick-drawn/${queryString}`;
          const pkUrl = window.SpaceSuite ? SpaceSuite.href('poker', {mode, topic}) : isGitHubPages
            ? `https://vuongtranvt1331-design.github.io/Poker/${queryString}` : `../poker/${queryString}`;
          const asUrl = window.SpaceSuite ? SpaceSuite.href('sky-dominators', {mode, topic}) : isGitHubPages
            ? `https://vuongtranvt1331-design.github.io/Sky_Dominators/${queryString}` : `../sky-dominators/${queryString}`;
          document.getElementById('btnPlayGrammar').href = window.SpaceSuite ? SpaceSuite.href('grammar', {mode, topic: mode === 'topic' ? topic : ''}) : '../grammar/' + queryString;
          document.getElementById('btnPlayVocabTest').href = window.SpaceSuite ? SpaceSuite.href('vocabulary-test', {mode, topic: mode === 'topic' ? topic : ''}) : '../vocabulary-test/' + queryString;
          btnQD.href = qdUrl;
          btnPK.href = pkUrl;
          btnAS.href = asUrl;
          modeWarningMsg.style.display = 'none';
          vocabModeBadge.textContent = mode === 'topic' ? 'TOPIC' : 'FULL VOCABULARY';
          topicWrapper.style.opacity = mode === 'full' ? '0.65' : '1';
          topicSelect.disabled = mode !== 'topic';
          topicSelect.options[0].textContent = mode === 'full' ? 'All topics' : 'Choose a topic';
          topicSelect.value = mode === 'topic' ? topic : '';
          topicWordBadge.textContent = mode === 'full' ? `${wordData.totalCount || '24+'} WORDS`
            : topic ? `${wordData.topicMap.get(topic) || 0} WORDS` : 'CHOOSE TOPIC';
        }
        updateGameLinks(selectedMode, selectedTopic);
        vocabModeSelect.addEventListener('change', () => {
          selectedMode = vocabModeSelect.value.trim().toLowerCase();
          if (!['full', 'topic'].includes(selectedMode)) selectedMode = 'full';
          sessionStorage.setItem('arcade_vocab_mode', selectedMode);
          updateGameLinks(selectedMode, selectedTopic);
          audio.playBlip();
        });
        topicSelect.addEventListener('change', () => {
          selectedTopic = topicSelect.value.trim();
          sessionStorage.setItem('arcade_selected_topic', selectedTopic);
          updateGameLinks(selectedMode, selectedTopic);
          audio.playBlip();
        });
        const launchSound = document.querySelector('[data-launch-sound]');
        let pendingLaunch;
        function launchGame(button) {
          if (pendingLaunch) return;
          unavailableSound.pause();
          switchSound.pause();
          const controller = new AbortController();
          pendingLaunch = controller;
          const options = {once:true, signal:controller.signal};
          let timer;
          function finish() {
            if (controller.signal.aborted) return;
            location.assign(button.href);
          }
          let loader;
          function cancel() {
            controller.abort();
            loader?.remove();
            clearTimeout(timer);
            launchSound.pause();
            pendingLaunch = null;
          }
          window.addEventListener('pagehide', cancel, options);

          if (!audio.muted && audio.volume && !launchSound.error) {
            launchSound.addEventListener('ended', finish, options);
            launchSound.addEventListener('error', finish, options);
            timer = setTimeout(finish, 1800);
            launchSound.addEventListener('playing', () => {
              clearTimeout(timer);
              const duration = Number.isFinite(launchSound.duration) ? launchSound.duration : 10;
              timer = setTimeout(finish, duration * 1000 + 1500);
            }, options);
            launchSound.currentTime = 0;
            launchSound.play().catch(finish);
          }

          const showLoader = () => {
            if (controller.signal.aborted) return;
            loader = document.createElement('section');
            loader.className = 'game-logo-loader';
            loader.dataset.gameLogoLoader = button.dataset.loaderGame;
            loader.setAttribute('role', 'status');
            const logo = button.querySelector('img').cloneNode();
            logo.removeAttribute('aria-hidden');
            logo.alt = 'Loading ' + button.closest('[data-game-tile]').dataset.gameName;
            loader.append(logo);
            document.body.append(loader);
            if (audio.muted || !audio.volume || launchSound.error) {
              finish();
            }
          };

          if (reduceMotion.matches) {
            showLoader();
          } else {
            setTimeout(showLoader, 500);
          }
        }
        document.querySelectorAll('.mobile-btn-play').forEach(button => {
          button.addEventListener('click', event => {
            if (!['grammar', 'vocab-test'].includes(button.dataset.loaderGame) && selectedMode === 'topic' && !selectedTopic) {
              event.preventDefault();
              audio.playBlip();
              modeWarningMsg.style.display = 'block';
              modeWarningMsg.textContent = 'Please select a vocabulary topic before playing.';
              topicSelect.focus();
              return;
            }
            if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            launchGame(button);
          });
        });
        const defaultLsUrl = window.location.hostname.endsWith('github.io')
          ? 'https://vuongtranvt1331-design.github.io/Lexical_Space/' : '../../';
        const finalLsUrl = window.SpaceSuite ? SpaceSuite.href('lexical') : urlParams.get('returnUrl') || defaultLsUrl;
        const back = document.getElementById('btnBackToLS');
        back.href = finalLsUrl;
        back.addEventListener('click', () => audio.playBlip());
        hub.setReady();
        window.SpaceSuite?.ready();
      });
    })();

import('./action-frames.js').catch(() => { document.documentElement.dataset.actionArt = 'fallback'; });
