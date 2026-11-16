/* js/systems/audio.js — ordered classic script; entrypoints declare dependency order. */
class SoundFX {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.noiseBuffer = null;
        this.shotSounds = null;
        this.playerShotPools = null;
        // Preload before combat; shooting never awaits loading or an earlier voice.
        this.setPlayerGunshotSources(PLAYER_GUNSHOT_SOURCES);
    }

    init() {
        if (!this.shotSounds) {
            const samples = {
                bossBullet: ['assets/audio/boss-pkm-shot.mp3', 0.45],
                rocket: ['assets/audio/boss-rocket-launch.mp3', 0.65]
            };
            // A bounded pool permits overlapping shots without new timers or listeners.
            this.shotSounds = Object.fromEntries(Object.entries(samples).map(([key, [src, volume]]) => [key, {
                cursor: 0,
                voices: Array.from({length: 4}, () => {
                    const voice = new Audio(src);
                    voice.preload = 'auto';
                    voice.volume = volume;
                    return voice;
                })
            }]));
        }
        if (!this.playerShotPools) this.setPlayerGunshotSources(PLAYER_GUNSHOT_SOURCES);
        if (!this.ghidorahRoar) {
            this.ghidorahRoar = new Audio('assets/audio/king-ghidorah-roar-1.mp3');
            this.ghidorahRoar.preload = 'auto';
            this.ghidorahRoar.volume = 0.8;
        }
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
                this.generateNoiseBuffer();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    generateNoiseBuffer() {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 1.0;
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    }

    playGhidorahRoar() {
        if (this.muted) return false;
        this.init();
        if (!this.ghidorahRoar) return false;
        this.ghidorahRoar.pause();
        this.ghidorahRoar.currentTime = 0;
        const playing = this.ghidorahRoar.play();
        if (playing && playing.catch) playing.catch(() => {});
        return true;
    }

    setPlayerGunshotSources(sources) {
        this.playerShotPools = [...new Set(sources.filter(src => typeof src === 'string' && src.trim()))].slice(0, 2).map(src => ({src, voices: []}));
        for(const pool of this.playerShotPools)for(let i=0;i<4;i++)pool.voices.push(this.createPlayerVoice(pool));
    }

    createPlayerVoice(pool) {
        const voice=new Audio(pool.src);voice.preload='auto';voice.volume=.65;voice.shotBusy=false;
        const release=()=>{voice.shotBusy=false;if(pool.voices.length>4)pool.voices=pool.voices.filter(v=>v!==voice);};
        voice.addEventListener('ended',release);voice.addEventListener('error',release);voice.releaseShot=release;
        return voice;
    }

    playPlayerShot() {
        if(this.muted)return false;
        this.init();const pools=this.playerShotPools;if(!pools.length)return false;
        const pool=pools[Math.min(pools.length-1,Math.floor(Math.random()*pools.length))];
        let voice=pool.voices.find(v=>!v.shotBusy&&(v.paused||v.ended));
        if(!voice){voice=this.createPlayerVoice(pool);pool.voices.push(voice);}
        // Reserve synchronously: rapid shots never restart an active voice.
        voice.shotBusy=true;
        try{if(voice.currentTime>0||voice.ended)voice.currentTime=0;const playing=voice.play();if(playing?.catch)playing.catch(()=>voice.releaseShot());return true;}
        catch(e){voice.releaseShot();return false;}
    }

    playShotSample(key) {
        if (this.muted) return false;
        this.init();
        const pool = this.shotSounds[key];
        if (!pool) return false;
        const voice = pool.voices.find(v => v.paused || v.ended) || pool.voices[pool.cursor];
        pool.cursor = (pool.voices.indexOf(voice) + 1) % pool.voices.length;
        try {
            voice.pause();
            if (voice.currentTime > 0 || voice.ended) voice.currentTime = 0;
            const playing = voice.play();
            if (playing && playing.catch) playing.catch(() => {});
            return true;
        } catch (e) { return false; }
    }

    playBulletShoot(isPlayer = false) {
        return isPlayer ? this.playPlayerShot() : this.playShotSample('bossBullet');
    }

    playRocketLaunch() {
        return this.playShotSample('rocket');
    }

    playShoot() {
        return this.playBulletShoot(true);
    }

    playExplosion(isBig = false) {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        const duration = isBig ? 0.6 : 0.35;

        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(isBig ? 120 : 90, now);
        subOsc.frequency.exponentialRampToValueAtTime(30, now + duration);
        subGain.gain.setValueAtTime(isBig ? 0.45 : 0.25, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        subOsc.connect(subGain).connect(this.ctx.destination);
        subOsc.start(now);
        subOsc.stop(now + duration);

        if (this.noiseBuffer) {
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(isBig ? 1200 : 750, now);
            filter.frequency.exponentialRampToValueAtTime(50, now + duration);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(isBig ? 0.35 : 0.2, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noise.connect(filter).connect(noiseGain).connect(this.ctx.destination);
            noise.start(now);
            noise.stop(now + duration);
        }
    }

    playArmorLock() {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        for (const [offset, frequency] of [[0, 185], [0.075, 95]]) {
            const start = now + offset;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(frequency, start);
            osc.frequency.exponentialRampToValueAtTime(frequency / 2, start + 0.13);
            gain.gain.setValueAtTime(0.24, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.13);
            osc.connect(gain).connect(this.ctx.destination);
            osc.start(start);
            osc.stop(start + 0.13);
        }
    }

    playTargetHit() {
        if (!this.ctx || this.muted) return;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const startTime = this.ctx.currentTime + idx * 0.07;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.2, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

            osc.connect(gain).connect(this.ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + 0.3);
        });
    }

    playPlayerHit() {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(45, now + 0.22);
        gain.gain.setValueAtTime(0.32, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.22);

        osc.connect(gain).connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
    }

    playWarning() {
        if (!this.ctx || this.muted) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(750, now);
            osc.frequency.setValueAtTime(580, now + 0.08);
            gain.gain.setValueAtTime(0.14, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.16);

            osc.connect(gain).connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.16);
        } catch (e) {}
    }

    playEnemyShoot() {
        if (!this.ctx || this.muted) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(340, now);
            osc.frequency.exponentialRampToValueAtTime(90, now + 0.11);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

            osc.connect(gain).connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.11);
        } catch (e) {}
    }
}

const audio = new SoundFX();
