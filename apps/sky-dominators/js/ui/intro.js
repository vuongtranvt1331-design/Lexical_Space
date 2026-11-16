/* Ten-second intro. The media clock drives every visual frame and survives buffering. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else {
        root.SkyIntro = api;
        const script = document.currentScript;
        const preview = script?.dataset.introMode === 'preview';
        if (preview || new URLSearchParams(location.search).get('intro') !== 'skip') {
            api.instance = new api.IntroController({ preview });
        }
    }
})(globalThis, function () {
    'use strict';

    const CONFIG = Object.freeze({
        duration: 10,
        ignition: 8.5,
        sourceIgnition: 11.85,
        sourceClanks: [.95, 1.75, 2.85, 3.9],
        audio: 'assets/audio/sky-dominators-intro.mp3',
        logo: 'assets/logo/sky_dominators_logo.png'
    });
    const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

    function timelineTime(sourceSeconds, sourceDuration) {
        if (sourceSeconds <= CONFIG.sourceIgnition) {
            return sourceSeconds * CONFIG.ignition / CONFIG.sourceIgnition;
        }
        const tail = Math.max(.01, sourceDuration - CONFIG.sourceIgnition);
        return Math.min(CONFIG.duration, CONFIG.ignition +
            (sourceSeconds - CONFIG.sourceIgnition) * (CONFIG.duration - CONFIG.ignition) / tail);
    }

    const CLANKS = CONFIG.sourceClanks.map(seconds => seconds * CONFIG.ignition / CONFIG.sourceIgnition);

    function markup() {
        const blades = Array.from({ length: 12 }, (_, i) =>
            `<i class="sd-intro__blade" style="--blade-angle:${i * 30}deg"></i>`).join('');
        const plates = ['nw', 'ne', 'sw', 'se'].map(side =>
            `<div class="sd-intro__plate sd-intro__plate--${side}" data-intro-plate="${side}"></div>`).join('');
        const arms = ['left', 'right', 'upper', 'lower'].map(side =>
            `<div class="sd-intro__arm sd-intro__arm--${side}" data-intro-arm="${side}"></div>`).join('');
        const sparks = Array.from({ length: 18 }, () => '<i class="sd-intro__spark"></i>').join('');
        return `
            <div class="sd-intro__scene" aria-hidden="true">
                <div class="sd-intro__grid"></div>
                <div class="sd-intro__reticle"><span class="sd-intro__coordinates">SD / FLIGHT SYSTEMS<br>CORE ASSEMBLY • 06 / ONLINE</span></div>
                <div class="sd-intro__shake"><div class="sd-intro__rig">
                    ${plates}${arms}
                    <div class="sd-intro__reactor">
                        <div class="sd-intro__turbine">${blades}</div>
                        <div class="sd-intro__bloom"></div>
                        <div class="sd-intro__energy-ring"></div>
                        <div class="sd-intro__core"></div><div class="sd-intro__core-hot"></div>
                    </div>
                    <div class="sd-intro__readout">
                        <span class="sd-intro__phase">MECHANICAL ASSEMBLY</span>
                        <div class="sd-intro__charge-track"><div class="sd-intro__charge"></div></div>
                        <div class="sd-intro__status"><span>REACTOR / 01</span><span class="sd-intro__percent">000%</span></div>
                    </div>
                </div></div>
                <div class="sd-intro__veil"></div>
                <div class="sd-intro__shockwave"></div>${sparks}
                <div class="sd-intro__reveal">
                    <img class="sd-intro__logo" src="${CONFIG.logo}" alt="" width="1536" height="1024">
                    <span class="sd-intro__logo-fallback" hidden>SKY<br>DOMINATORS</span>
                    <span class="sd-intro__reveal-line"></span><span class="sd-intro__reveal-caption">AIRSPACE IS EARNED.</span>
                </div>
                <div class="sd-intro__flash"></div>
            </div>
            <div class="sd-intro__gate">
                <p class="sd-intro__eyebrow">SKY DOMINATORS / LAUNCH SEQUENCE</p>
                <h1 class="sd-intro__title">Bring the reactor online.</h1>
                <p class="sd-intro__note">A 10-second cinematic with sound.</p>
                <button class="sd-intro__start" type="button">Initialize</button>
                <p class="sd-intro__message sd-intro__note" role="status" aria-live="polite"></p>
                <button class="sd-intro__silent" type="button" hidden>Continue without sound</button>
            </div>
            <div class="sd-intro__header">
                <span class="sd-intro__brand">SD / AEROSPACE DIVISION</span>
                <button class="sd-intro__skip" type="button">Skip intro ↗</button>
            </div>
            <div class="sd-intro__preview-actions" hidden>
                <button class="sd-intro__skip sd-intro__replay" type="button">Replay intro</button>
                <a href="index.html?intro=skip">Enter game ↗</a>
            </div>
            <audio preload="auto" src="${CONFIG.audio}"></audio>`;
    }

    class IntroController {
        constructor({ preview = false } = {}) {
            this.preview = preview;
            this.state = 'ready';
            this.animations = [];
            this.frame = 0;
            this.generation = 0;
            this.time = 0;
            this.silent = false;
            this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
            this.previousFocus = document.activeElement;
            this.game = document.querySelector('.game-wrapper');
            this.previousInert = this.game?.inert;
            if (this.game) this.game.inert = true;
            this.root = document.createElement('section');
            this.root.className = 'sd-intro' + (this.reduced ? ' sd-intro--minimal' : '');
            this.root.setAttribute('role', 'dialog');
            this.root.setAttribute('aria-modal', 'true');
            this.root.setAttribute('aria-label', 'Sky Dominators launch cinematic');
            this.root.innerHTML = markup();
            document.body.append(this.root);
            this.audio = this.$('audio');
            this.audio.preservesPitch = true;
            this.audio.volume = .8;
            this.gate = this.$('.sd-intro__gate');
            this.startButton = this.$('.sd-intro__start');
            this.message = this.$('.sd-intro__message');
            this.silentButton = this.$('.sd-intro__silent');
            this.actions = this.$('.sd-intro__preview-actions');
            this.phase = this.$('.sd-intro__phase');
            this.percent = this.$('.sd-intro__percent');
            this.turbine = this.$('.sd-intro__turbine');
            this.shake = this.$('.sd-intro__shake');
            this.bloom = this.$('.sd-intro__bloom');
            this.hot = this.$('.sd-intro__core-hot');
            this.buildMotion();
            this.render(0);
            this.startButton.addEventListener('click', () => this.start());
            this.silentButton.addEventListener('click', () => this.start(true));
            this.$('.sd-intro__skip').addEventListener('click', () => this.finish('skip'));
            this.$('.sd-intro__replay').addEventListener('click', () => this.replay());
            this.root.addEventListener('keydown', event => this.onKey(event));
            for (const event of ['pointerdown', 'touchstart', 'click']) {
                this.root.addEventListener(event, e => e.stopPropagation());
            }
            this.onVisibility = () => {
                if (document.hidden && this.state === 'playing') this.pause();
            };
            document.addEventListener('visibilitychange', this.onVisibility);
            this.audio.addEventListener('ended', () => {
                if (this.state === 'playing') this.finish('complete');
            });
            this.audio.addEventListener('error', () => this.audioError());
            this.$('.sd-intro__logo').addEventListener('error', event => {
                event.target.hidden = true;
                this.$('.sd-intro__logo-fallback').hidden = false;
            });
            const enter = this.$('.sd-intro__preview-actions a');
            const gameUrl = new URL(enter.href);
            for (const [key, value] of new URLSearchParams(location.search)) {
                if (key !== 'intro') gameUrl.searchParams.set(key, value);
            }
            enter.href = gameUrl.href;
            this.startButton.focus({ preventScroll: true });
        }

        $(selector) { return this.root.querySelector(selector); }

        motion(selector, poses) {
            for (const element of this.root.querySelectorAll(selector)) {
                const animation = element.animate(poses.map(([seconds, pose]) =>
                    ({ ...pose, offset: seconds / CONFIG.duration })), { duration: CONFIG.duration * 1000, fill: 'both' });
                animation.pause();
                this.animations.push(animation);
            }
        }

        buildMotion() {
            ['nw', 'ne', 'sw', 'se'].forEach((side, i) => {
                const x = i % 2 ? '115%' : '-115%';
                const enter = this.reduced ? 'none' : `translate3d(${x},0,0)`;
                const end = CLANKS[i], at = end - .42;
                this.motion(`[data-intro-plate="${side}"]`, [
                    [0, { transform: enter }], [at, { transform: enter, easing: 'cubic-bezier(.2,.7,.3,1)' }],
                    [end, { transform: 'translate3d(0,0,0)' }], [end + .045, { transform: this.reduced ? 'none' : 'translate3d(-3px,2px,0)' }],
                    [end + .12, { transform: 'none' }], [8.5, { opacity: 1 }], [8.59, { opacity: 0 }], [10, { opacity: 0 }]
                ]);
            });
            ['left', 'right', 'upper', 'lower'].forEach((side, i) => {
                const off = this.reduced ? 'none' : 'translate3d(-115%,0,0)';
                const at = CLANKS[i] - .42;
                this.motion(`[data-intro-arm="${side}"]`, [
                    [0, { transform: off }], [at, { transform: off, easing: 'cubic-bezier(.16,.8,.3,1)' }],
                    [at + .42, { transform: 'none' }], [at + .49, { transform: this.reduced ? 'none' : 'translate3d(-5px,0,0)' }],
                    [at + .6, { transform: 'none' }], [8.5, { transform: 'none' }], [8.7, { transform: off }], [10, { transform: off }]
                ]);
            });
            this.motion('.sd-intro__reactor', [
                [0, { transform: this.reduced ? 'none' : 'scale(.72)', opacity: .3 }],
                [2.95, { transform: 'scale(1)', opacity: 1 }], [8.5, { transform: 'scale(1)', opacity: 1 }],
                [8.68, { transform: this.reduced ? 'none' : 'scale(1.8)', opacity: 0 }], [10, { opacity: 0 }]
            ]);
            this.motion('.sd-intro__grid, .sd-intro__reticle', [
                [0, { opacity: 0, transform: 'scaleY(.05)' }], [3, { opacity: 0, transform: 'scaleY(.05)' }],
                [3.4, { opacity: .25, transform: 'scaleY(.45)' }], [4.1, { opacity: .75, transform: 'scaleY(1)' }],
                [6, { opacity: .5 }], [8.5, { opacity: 1 }], [8.6, { opacity: 0 }], [10, { opacity: 0 }]
            ]);
            this.motion('.sd-intro__energy-ring', [
                [0, { opacity: 0, transform: 'rotate(0deg)' }], [3, { opacity: 0, transform: 'rotate(0deg)' }],
                [3.2, { opacity: .8 }], [8.5, { opacity: 1, transform: `rotate(${this.reduced ? 0 : 430}deg)` }],
                [8.6, { opacity: 0 }], [10, { opacity: 0 }]
            ]);
            this.motion('.sd-intro__charge', [[0, { transform: 'scaleX(0)' }], [3, { transform: 'scaleX(.03)' }], [6, { transform: 'scaleX(.6)' }], [8.5, { transform: 'scaleX(1)' }], [10, { transform: 'scaleX(1)' }]]);
            this.motion('.sd-intro__readout', [[0, { opacity: .75 }], [8.5, { opacity: 1 }], [8.58, { opacity: 0 }], [10, { opacity: 0 }]]);
            this.motion('.sd-intro__veil', [[0, { opacity: 0 }], [8.5, { opacity: 0 }], [8.58, { opacity: 1 }], [10, { opacity: 1 }]]);
            this.motion('.sd-intro__flash', [[0, { opacity: 0 }], [8.499, { opacity: 0 }], [8.5, { opacity: .95 }], [8.64, { opacity: 0 }], [10, { opacity: 0 }]]);
            this.motion('.sd-intro__shockwave', [[0, { opacity: 0, transform: 'scale(.2)' }], [8.499, { opacity: 0, transform: 'scale(.2)' }], [8.5, { opacity: 1, transform: 'scale(.25)' }], [9.12, { opacity: 0, transform: 'scale(7)' }], [10, { opacity: 0, transform: 'scale(7)' }]]);
            this.motion('.sd-intro__reveal', [[0, { opacity: 0 }], [8.56, { opacity: 0 }], [8.57, { opacity: 1 }], [10, { opacity: 1 }]]);
            this.motion('.sd-intro__logo, .sd-intro__logo-fallback', [[0, { transform: 'scale(1.18)' }], [8.57, { transform: this.reduced ? 'none' : 'scale(1.18)', easing: 'cubic-bezier(.1,.85,.2,1)' }], [8.75, { transform: 'scale(.985)' }], [8.88, { transform: 'scale(1)' }], [10, { transform: 'scale(1)' }]]);
            this.root.querySelectorAll('.sd-intro__spark').forEach((spark, i) => {
                const angle = i * Math.PI * 2 / 18, radius = 350 + i % 3 * 70;
                const end = `translate3d(${Math.cos(angle) * radius}px,${Math.sin(angle) * radius}px,0) rotate(${angle * 180 / Math.PI + 90}deg)`;
                const animation = spark.animate([
                    { offset: 0, opacity: 0, transform: 'scale(.1)' }, { offset: .8499, opacity: 0, transform: 'scale(.1)' },
                    { offset: .85, opacity: .9 }, { offset: .93, opacity: 0, transform: end }, { offset: 1, opacity: 0, transform: end }
                ], { duration: 10000, fill: 'both' });
                animation.pause();this.animations.push(animation);
            });
        }

        render(seconds) {
            const t = clamp(seconds, 0, CONFIG.duration);
            this.time = t;
            this.root.dataset.phase = t < 3 ? 'assembly' : t < 6 ? 'power' : t < 8.5 ? 'spool' : 'ignition';
            for (const animation of this.animations) animation.currentTime = t * 1000;
            const power = clamp((t - 3) / 3), spool = clamp((t - 6) / 2.5);
            const rotation = t < 3 ? t * 9 : t < 6 ? 27 + (t - 3) * 65 : 222 + 65 * (t - 6) + 430 * (t - 6) ** 2;
            this.turbine.style.transform = `rotate(${this.reduced ? 0 : rotation}deg)`;
            const pulse = .85 + .15 * Math.sin(t * 12);
            this.bloom.style.opacity = t >= 8.5 ? '0' : String(power * (.38 + spool * .6) * pulse);
            this.bloom.style.transform = `scale(${1 + spool * .18})`;
            this.hot.style.opacity = t >= 8.5 ? '0' : String(power * pulse);
            const kick = CLANKS.reduce((amount, at) => amount + Math.max(0, 1 - (t - at) / .14) * (t >= at ? 2.5 : 0), 0);
            const shake = this.reduced || t >= 8.5 ? 0 : kick + spool * spool * 3;
            this.shake.style.transform = `translate3d(${Math.sin(t * 153) * shake}px,${Math.cos(t * 181) * shake * .6}px,0)`;
            const phase = t < 3 ? 'MECHANICAL ASSEMBLY' : t < 6 ? 'REACTOR CHARGING' : t < 8.5 ? 'TURBINE SPIN-UP' : 'IGNITION / FLIGHT READY';
            if (this.phase.textContent !== phase) this.phase.textContent = phase;
            const value = String(Math.round(clamp(t / 8.5) * 100)).padStart(3, '0') + '%';
            if (this.percent.textContent !== value) this.percent.textContent = value;
        }

        async start(silent = false) {
            if (!['ready', 'paused', 'error'].includes(this.state)) return;
            const resuming = this.state === 'paused';
            const retrying = this.state === 'error';
            this.state = 'starting';
            const generation = ++this.generation;
            this.startButton.disabled = true;
            this.message.textContent = 'Initializing audio…';
            this.silent = silent || (resuming && this.silent);
            if (retrying && !this.silent) this.audio.load();
            if (!resuming) this.audio.currentTime = 0;
            if (!this.silent) {
                this.audio.volume = .8;
                this.audio.playbackRate = this.audio.currentTime < CONFIG.sourceIgnition
                    ? CONFIG.sourceIgnition / CONFIG.ignition
                    : (this.audio.duration - CONFIG.sourceIgnition) / (CONFIG.duration - CONFIG.ignition);
                try { await this.audio.play(); }
                catch {
                    if (generation === this.generation) this.audioError();
                    return;
                }
            }
            if (generation !== this.generation) { this.audio.pause();return; }
            if (this.silent) this.audio.pause();
            this.silentStartedAt = performance.now() - this.time * 1000;
            this.state = 'playing';
            this.gate.hidden = true;
            this.message.textContent = '';
            this.$('.sd-intro__skip').focus({ preventScroll: true });
            if (document.hidden) { this.pause();return; }
            this.tick();
        }

        tick() {
            if (this.state !== 'playing') return;
            const t = this.silent ? (performance.now() - this.silentStartedAt) / 1000
                : timelineTime(this.audio.currentTime, this.audio.duration);
            if (!this.silent && this.audio.currentTime >= CONFIG.sourceIgnition) {
                const tailRate = (this.audio.duration - CONFIG.sourceIgnition) / (CONFIG.duration - CONFIG.ignition);
                if (this.audio.playbackRate !== tailRate) this.audio.playbackRate = tailRate;
            }
            this.render(t);
            if (t >= CONFIG.duration) { this.finish('complete');return; }
            if (!this.silent) this.audio.volume = .8 * clamp((CONFIG.duration - t) / .2);
            this.frame = requestAnimationFrame(() => this.tick());
        }

        pause() {
            cancelAnimationFrame(this.frame);
            this.audio.pause();
            this.state = 'paused';
            this.gate.hidden = false;
            this.startButton.disabled = false;
            this.startButton.textContent = 'Resume sequence';
            this.message.textContent = 'Sequence paused while this tab is in the background.';
        }

        audioError() {
            if (this.state === 'finished') return;
            cancelAnimationFrame(this.frame);
            this.audio.pause();
            this.state = 'error';
            this.gate.hidden = false;
            this.startButton.disabled = false;
            this.startButton.textContent = 'Retry audio';
            this.message.textContent = 'Audio could not start. Retry, continue silently, or skip.';
            this.silentButton.hidden = false;
        }

        onKey(event) {
            event.stopPropagation();
            if (event.key === 'Escape') { event.preventDefault();this.finish('skip'); }
            if (event.key !== 'Tab') return;
            const controls = [...this.root.querySelectorAll('button:not(:disabled), a[href]')].filter(el => el.offsetParent !== null);
            const next = controls[(controls.indexOf(document.activeElement) + (event.shiftKey ? -1 : 1) + controls.length) % controls.length];
            if (next) { event.preventDefault();next.focus(); }
        }

        finish(reason) {
            if (this.state === 'finished') return;
            this.generation++;
            this.state = 'finished';
            cancelAnimationFrame(this.frame);
            this.audio.pause();
            this.render(CONFIG.duration);
            this.gate.hidden = true;
            if (this.preview) {
                this.actions.hidden = false;
                this.$('.sd-intro__replay').focus({ preventScroll: true });
            } else {
                document.removeEventListener('visibilitychange', this.onVisibility);
                for (const animation of this.animations) animation.cancel();
                this.root.remove();
                if (this.game) this.game.inert = this.previousInert;
                if (typeof resetMobileControls === 'function') resetMobileControls();
                const target = this.game?.querySelector('.modal-overlay:not(.hidden) button:not(:disabled)') || this.previousFocus;
                target?.focus({ preventScroll: true });
            }
            window.dispatchEvent(new CustomEvent('sky-intro-end', { detail: { reason } }));
        }

        replay() {
            this.actions.hidden = true;
            this.state = 'ready';
            this.time = 0;
            this.render(0);
            this.start(this.silent);
        }
    }

    return { IntroController, CONFIG, timelineTime };
});
