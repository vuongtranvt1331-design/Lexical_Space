import { loadSettings } from './settings.js';

    /* ================= SOUND MANAGER ================= */
    const SoundManager = {
      enabled: true,
      ctx: null,
      lastSoundTime: 0,
      ensureContext() {
        if (!this.enabled) return null;
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === "suspended") {
          this.ctx.resume().catch(() => {});
        }
        return this.ctx;
      },
      loadForUser(username) {
        this.enabled = loadSettings(username).soundEffects;
      },
      playSelect() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        if (now - this.lastSoundTime < 0.04) return;
        this.lastSoundTime = now;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.035);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
      },
      playFlip() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const bufferSize = Math.floor(ctx.sampleRate * 0.11);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI) * 0.4;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(700, now);
        filter.frequency.exponentialRampToValueAtTime(1650, now + 0.1);
        filter.Q.setValueAtTime(1.4, now);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.005, now);
        gain.gain.linearRampToValueAtTime(0.085, now + 0.045);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
      },
      playSuccess() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + idx * 0.045);
          gain.gain.setValueAtTime(0.001, now + idx * 0.045);
          gain.gain.linearRampToValueAtTime(0.09, now + idx * 0.045 + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.045);
          osc.stop(now + idx * 0.045 + 0.24);
        });
      },
      playError() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.16);
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
      },
      playLevelUp() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        if (now - this.lastSoundTime < 0.08) return;
        this.lastSoundTime = now;

        // Satisfying retro 8-bit arcade level-up arpeggio: C5 -> E5 -> G5 -> B5 -> C6 -> E6
        const notes = [
          { f: 523.25, t: 0.00, d: 0.07 },
          { f: 659.25, t: 0.07, d: 0.07 },
          { f: 783.99, t: 0.14, d: 0.07 },
          { f: 987.77, t: 0.21, d: 0.07 },
          { f: 1046.50, t: 0.28, d: 0.09 },
          { f: 1318.51, t: 0.36, d: 0.28 }
        ];

        notes.forEach(({ f, t, d }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.setValueAtTime(f, now + t);

          gain.gain.setValueAtTime(0.001, now + t);
          gain.gain.linearRampToValueAtTime(0.08, now + t + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + t);
          osc.stop(now + t + d + 0.02);
        });
      },
      playEncouragement() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        if (now - this.lastSoundTime < 0.08) return;
        this.lastSoundTime = now;

        // Warm retro encouraging arpeggio: F4 -> A4 -> C5 -> E5 -> G5
        const notes = [
          { f: 349.23, t: 0.00, d: 0.08 },
          { f: 440.00, t: 0.08, d: 0.08 },
          { f: 523.25, t: 0.16, d: 0.08 },
          { f: 659.25, t: 0.24, d: 0.09 },
          { f: 783.99, t: 0.32, d: 0.26 }
        ];

        notes.forEach(({ f, t, d }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(f, now + t);

          gain.gain.setValueAtTime(0.001, now + t);
          gain.gain.linearRampToValueAtTime(0.085, now + t + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + t);
          osc.stop(now + t + d + 0.02);
        });
      }
    };


export { SoundManager };
