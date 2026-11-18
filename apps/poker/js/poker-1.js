
    (function () {
      'use strict';

      /**
       * DEFAULT VOCABULARY LIBRARY (20 distinct, unambiguous academic English entries)
       * Follows the strict 3-field schema: word, translation, synonym.
       */
      const DEFAULT_VOCAB_JSON = [
        {
                "word": "substantial",
                "translation": "đáng kể",
                "synonym": "considerable"
        },
        {
                "word": "allocate",
                "translation": "phân bổ",
                "synonym": "assign"
        },
        {
                "word": "sustainable",
                "translation": "bền vững",
                "synonym": "viable"
        },
        {
                "word": "initiative",
                "translation": "sáng kiến",
                "synonym": "proposal"
        },
        {
                "word": "inevitable",
                "translation": "không thể tránh khỏi",
                "synonym": "unavoidable"
        },
        {
                "word": "meticulous",
                "translation": "tỉ mỉ",
                "synonym": "thorough"
        },
        {
                "word": "ambiguous",
                "translation": "mơ hồ",
                "synonym": "vague"
        },
        {
                "word": "deteriorate",
                "translation": "xấu đi",
                "synonym": "worsen"
        },
        {
                "word": "augment",
                "translation": "làm tăng thêm",
                "synonym": "increase"
        },
        {
                "word": "obsolete",
                "translation": "lỗi thời",
                "synonym": "outdated"
        },
        {
                "word": "resilient",
                "translation": "kiên cường",
                "synonym": "tough"
        },
        {
                "word": "scrutinize",
                "translation": "xem xét kỹ",
                "synonym": "examine"
        },
        {
                "word": "lucrative",
                "translation": "sinh lời cao",
                "synonym": "profitable"
        },
        {
                "word": "mitigate",
                "translation": "giảm nhẹ",
                "synonym": "alleviate"
        },
        {
                "word": "plausible",
                "translation": "hợp lý",
                "synonym": "believable"
        },
        {
                "word": "adversity",
                "translation": "nghịch cảnh",
                "synonym": "hardship"
        },
        {
                "word": "concur",
                "translation": "đồng tình",
                "synonym": "agree"
        },
        {
                "word": "reluctant",
                "translation": "miễn cưỡng",
                "synonym": "hesitant"
        },
        {
                "word": "pivotal",
                "translation": "then chốt",
                "synonym": "crucial"
        },
        {
                "word": "candid",
                "translation": "thẳng thắn",
                "synonym": "frank"
        },
        {
                "word": "accommodate",
                "translation": "thích nghi / đáp ứng",
                "synonym": "adapt"
        },
        {
                "word": "stabilize",
                "translation": "ổn định",
                "synonym": "steady"
        },
        {
                "word": "vital",
                "translation": "thiết yếu",
                "synonym": "essential"
        },
        {
                "word": "expand",
                "translation": "mở rộng",
                "synonym": "broaden"
        },
        {
                "word": "rapid",
                "translation": "nhanh chóng",
                "synonym": "swift"
        },
        {
                "word": "abundant",
                "translation": "dồi dào",
                "synonym": "plentiful"
        },
        {
                "word": "hazardous",
                "translation": "nguy hiểm",
                "synonym": "perilous"
        },
        {
                "word": "prohibit",
                "translation": "ngăn cấm",
                "synonym": "forbid"
        },
        {
                "word": "innovative",
                "translation": "sáng tạo đổi mới",
                "synonym": "creative"
        },
        {
                "word": "enhance",
                "translation": "nâng cao",
                "synonym": "improve"
        },
        {
                "word": "diminish",
                "translation": "giảm bớt",
                "synonym": "lessen"
        },
        {
                "word": "feasible",
                "translation": "khả thi",
                "synonym": "achievable"
        },
        {
                "word": "acquire",
                "translation": "thu được / đạt được",
                "synonym": "obtain"
        },
        {
                "word": "dormant",
                "translation": "ngủ yên / bất hoạt",
                "synonym": "inactive"
        },
        {
                "word": "comprehensive",
                "translation": "toàn diện",
                "synonym": "exhaustive"
        },
        {
                "word": "advocate",
                "translation": "ủng hộ",
                "synonym": "champion"
        },
        {
                "word": "prevalent",
                "translation": "phổ biến",
                "synonym": "widespread"
        },
        {
                "word": "commence",
                "translation": "bắt đầu",
                "synonym": "initiate"
        },
        {
                "word": "terminate",
                "translation": "chấm dứt",
                "synonym": "conclude"
        },
        {
                "word": "pragmatic",
                "translation": "thực dụng / thực tế",
                "synonym": "practical"
        },
        {
                "word": "elaborate",
                "translation": "chi tiết phức tạp",
                "synonym": "intricate"
        },
        {
                "word": "consecutive",
                "translation": "liên tiếp",
                "synonym": "successive"
        },
        {
                "word": "compel",
                "translation": "bắt buộc / ép buộc",
                "synonym": "coerce"
        },
        {
                "word": "disperse",
                "translation": "phân tán",
                "synonym": "scatter"
        },
        {
                "word": "emerge",
                "translation": "xuất hiện",
                "synonym": "surface"
        },
        {
                "word": "facilitate",
                "translation": "tạo điều kiện dễ dàng",
                "synonym": "expedite"
        },
        {
                "word": "genuine",
                "translation": "chân thật",
                "synonym": "authentic"
        },
        {
                "word": "hinder",
                "translation": "cản trở",
                "synonym": "impede"
        },
        {
                "word": "indifferent",
                "translation": "thờ ơ",
                "synonym": "unconcerned"
        },
        {
                "word": "mandatory",
                "translation": "bắt buộc",
                "synonym": "compulsory"
        },
        {
                "word": "negligible",
                "translation": "không đáng kể",
                "synonym": "trivial"
        },
        {
                "word": "optimistic",
                "translation": "lạc quan",
                "synonym": "hopeful"
        },
        {
                "word": "paramount",
                "translation": "tối quan trọng",
                "synonym": "foremost"
        },
        {
                "word": "reconcile",
                "translation": "hòa giải",
                "synonym": "harmonize"
        },
        {
                "word": "spontaneous",
                "translation": "tự phát / tự nhiên",
                "synonym": "unprompted"
        },
        {
                "word": "tentative",
                "translation": "thăm dò / chưa chắc chắn",
                "synonym": "provisional"
        },
        {
                "word": "unprecedented",
                "translation": "chưa từng có",
                "synonym": "unmatched"
        },
        {
                "word": "vulnerable",
                "translation": "dễ bị tổn thương",
                "synonym": "susceptible"
        },
        {
                "word": "benevolent",
                "translation": "nhân từ / từ tâm",
                "synonym": "charitable"
        },
        {
                "word": "dismantle",
                "translation": "tháo dỡ",
                "synonym": "demolish"
        }
];

      /**
       * EXPLICIT GAME STATES
       */
      const GAME_STATES = {
        READY: 'READY',
        DEALING: 'DEALING',
        PLAYING: 'PLAYING',
        RESOLVING: 'RESOLVING',
        ROUND_COMPLETE: 'ROUND_COMPLETE',
        VICTORY: 'VICTORY',
        DEFEAT: 'DEFEAT'
      };

      /**
       * DECORATIVE PLAYING CARD RANKS & SUITS
       */
      const CARD_RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];
      const CARD_SUITS = [
        { symbol: '♠', name: 'spades' },
        { symbol: '♥', name: 'hearts' },
        { symbol: '♦', name: 'diamonds' },
        { symbol: '♣', name: 'clubs' }
      ];

      /**
       * SINGLE SOURCE OF TRUTH GAME STATE
       */
      const state = {
        gameState: GAME_STATES.READY,
        chips: 5,
        round: 1,
        vocabLibrary: [],          // Array of { id, word, translation, synonym }
        pendingVocabLibrary: null, // Queued library if imported mid-round
        unusedPoolIds: [],         // Tracks unused vocabulary IDs in current deck cycle
        opponentHand: [],          // 4 cards: { slotIndex, vocabId, word, translation, rank, suit, resolved, outcome }
        studentHand: [],           // 4 cards: { slotIndex, vocabId, synonym, rank, suit, used, outcome }
        consecutiveCorrect: 0,
        roundStreakAwarded: false,
        totalPairs: 0,
        totalAttempts: 0,
        mistakes: [],
        roundsPlayed: 0,
        activeOpponentIndex: -1,   // No target until the dealer finishes drawing.
        roundCorrectCount: 0,
        roundIncorrectAttempts: 0,
        roundScored: false,        // Guard ensuring round bonus is applied once per round
        soundEnabled: true,
        sessionToken: 0,           // Incremented on restart/end to invalidate stale callbacks
        activeTimers: new Map()    // Timer ID to callback and deadline
      };

      /**
       * PROCEDURAL WILD WEST SOUND ENGINE (Web Audio API)
       */
      class WesternSoundEngine {
        constructor() {
          this.ctx = null;
        }

        ensureContext() {
          if (!state.soundEnabled) return null;
          if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
              this.ctx = new AudioCtx();
            }
          }
          if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
          }
          return this.ctx;
        }

        createNoiseBuffer(durationSec) {
          const ctx = this.ensureContext();
          if (!ctx) return null;
          const bufferSize = Math.floor(ctx.sampleRate * durationSec);
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          return buffer;
        }

        playCardShuffle() {
          const ctx = this.ensureContext();
          if (!ctx) return;
          for (let i = 0; i < 5; i++) {
            scheduleTimer(() => {
              if (!state.soundEnabled) return;
              this.playCardDeal(0.045, 900 + i * 110);
            }, i * 55);
          }
        }

        playCardDeal(duration = 0.07, filterFreq = 1200) {
          const ctx = this.ensureContext();
          if (!ctx) return;
          const now = ctx.currentTime;
          const noiseBuffer = this.createNoiseBuffer(duration);
          if (!noiseBuffer) return;

          const source = ctx.createBufferSource();
          source.buffer = noiseBuffer;

          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(filterFreq, now);
          filter.Q.setValueAtTime(1.8, now);

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.01, now);
          gain.gain.linearRampToValueAtTime(0.18, now + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

          source.connect(filter);
          filter.connect(gain);
          gain.connect(SpaceEffects.output(ctx));
          source.start(now);
        }

        playCardPlace() {
          const ctx = this.ensureContext();
          if (!ctx) return;
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(140, now);
          osc.frequency.exponentialRampToValueAtTime(55, now + 0.055);

          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

          osc.connect(gain);
          gain.connect(SpaceEffects.output(ctx));
          osc.start(now);
          osc.stop(now + 0.065);
        }

        playCorrectMatch() {
          const ctx = this.ensureContext();
          if (!ctx) return;
          const now = ctx.currentTime;
          const notes = [523.25, 659.25, 783.99];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.055);

            gain.gain.setValueAtTime(0.001, now + idx * 0.055);
            gain.gain.linearRampToValueAtTime(0.16, now + idx * 0.055 + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.32);

            osc.connect(gain);
            gain.connect(SpaceEffects.output(ctx));
            osc.start(now + idx * 0.055);
            osc.stop(now + idx * 0.055 + 0.34);
          });
        }

        playChipGain() {
          const ctx = this.ensureContext();
          if (!ctx) return;
          const now = ctx.currentTime;
          const freqs = [2200, 3300, 4180];
          freqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.06);

            gain.gain.setValueAtTime(0.14, now + i * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.22);

            osc.connect(gain);
            gain.connect(SpaceEffects.output(ctx));
            osc.start(now + i * 0.06);
            osc.stop(now + i * 0.06 + 0.24);
          });
        }

        playChipLoss() {
          const ctx = this.ensureContext();
          if (!ctx) return;
          const now = ctx.currentTime;
          const freqs = [392, 330, 261.6, 196];
          freqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now + i * 0.065);

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(900, now);

            gain.gain.setValueAtTime(0.12, now + i * 0.065);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.065 + 0.18);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(SpaceEffects.output(ctx));
            osc.start(now + i * 0.065);
            osc.stop(now + i * 0.065 + 0.2);
          });
        }

        playGunshot() {
          const ctx = this.ensureContext();
          if (!ctx) return;
          const now = ctx.currentTime;

          const noiseBuffer = this.createNoiseBuffer(0.38);
          if (noiseBuffer) {
            const noise = ctx.createBufferSource();
            noise.buffer = noiseBuffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(3200, now);
            filter.frequency.exponentialRampToValueAtTime(240, now + 0.35);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.52, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(SpaceEffects.output(ctx));
            noise.start(now);
          }

          const punchOsc = ctx.createOscillator();
          const punchGain = ctx.createGain();
          punchOsc.type = 'triangle';
          punchOsc.frequency.setValueAtTime(190, now);
          punchOsc.frequency.exponentialRampToValueAtTime(36, now + 0.16);

          punchGain.gain.setValueAtTime(0.45, now);
          punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

          punchOsc.connect(punchGain);
          punchGain.connect(SpaceEffects.output(ctx));
          punchOsc.start(now);
          punchOsc.stop(now + 0.19);
        }

        playBulletWhizz() {
          const ctx = this.ensureContext();
          if (!ctx) return;
          const now = ctx.currentTime;

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(2900, now);
          osc.frequency.exponentialRampToValueAtTime(520, now + 0.24);

          gain.gain.setValueAtTime(0.01, now);
          gain.gain.linearRampToValueAtTime(0.22, now + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

          osc.connect(gain);
          gain.connect(SpaceEffects.output(ctx));
          osc.start(now);
          osc.stop(now + 0.26);
        }

        playCowboyGuitarEnding(isVictory = false) {
          const ctx = this.ensureContext();
          if (!ctx) return;
          const now = ctx.currentTime;

          const notes = isVictory
            ? [
                { freq: 146.83, delay: 0.0, dur: 0.55 },
                { freq: 220.00, delay: 0.16, dur: 0.55 },
                { freq: 293.66, delay: 0.32, dur: 0.65 },
                { freq: 349.23, delay: 0.52, dur: 0.65 },
                { freq: 329.63, delay: 0.78, dur: 0.55 },
                { freq: 293.66, delay: 1.02, dur: 1.25 }
              ]
            : [
                { freq: 164.81, delay: 0.0, dur: 0.5 },
                { freq: 246.94, delay: 0.18, dur: 0.5 },
                { freq: 293.66, delay: 0.36, dur: 0.5 },
                { freq: 246.94, delay: 0.58, dur: 0.5 },
                { freq: 196.00, delay: 0.80, dur: 0.6 },
                { freq: 164.81, delay: 1.05, dur: 1.3 }
              ];

          notes.forEach((n) => {
            const start = now + n.delay;
            const osc = ctx.createOscillator();
            const subOsc = ctx.createOscillator();
            const filter = ctx.createBiquadFilter();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(n.freq, start);

            subOsc.type = 'triangle';
            subOsc.frequency.setValueAtTime(n.freq * 2, start);

            if (n.dur > 1.0) {
              const lfo = ctx.createOscillator();
              const lfoGain = ctx.createGain();
              lfo.frequency.setValueAtTime(5.5, start);
              lfoGain.gain.setValueAtTime(3.2, start);
              lfo.connect(lfoGain);
              lfoGain.connect(osc.frequency);
              lfo.start(start);
              lfo.stop(start + n.dur);
            }

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2400, start);
            filter.frequency.exponentialRampToValueAtTime(420, start + n.dur * 0.85);

            gain.gain.setValueAtTime(0.001, start);
            gain.gain.linearRampToValueAtTime(0.2, start + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.0008, start + n.dur);

            osc.connect(filter);
            subOsc.connect(filter);
            filter.connect(gain);
            gain.connect(SpaceEffects.output(ctx));

            osc.start(start);
            subOsc.start(start);
            osc.stop(start + n.dur + 0.02);
            subOsc.stop(start + n.dur + 0.02);
          });
        }
      }

      const sound = new WesternSoundEngine();

      /**
       * SAFE TIMER SCHEDULER
       */
      let pausedTimers = null;

      function scheduleTimer(callback, delayMs) {
        if (pausedTimers) {
          pausedTimers.push({callback, delayMs});
          return;
        }
        const token = state.sessionToken;
        const id = window.setTimeout(() => {
          if (!state.activeTimers.delete(id) || token !== state.sessionToken) return;
          callback();
        }, delayMs);
        state.activeTimers.set(id, {callback, deadline: performance.now() + delayMs});
        return id;
      }

      function parkTimers() {
        if (pausedTimers) return;
        const now = performance.now();
        pausedTimers = [];
        for (const [id, task] of state.activeTimers) {
          window.clearTimeout(id);
          pausedTimers.push({callback: task.callback, delayMs: Math.max(0, task.deadline - now)});
        }
        state.activeTimers.clear();
      }

      function resumeTimers() {
        const pending = pausedTimers || [];
        pausedTimers = null;
        for (const {callback, delayMs} of pending) scheduleTimer(callback, delayMs);
      }

      function clearAllScheduledTimers() {
        state.sessionToken += 1;
        for (const id of state.activeTimers.keys()) window.clearTimeout(id);
        state.activeTimers.clear();
        pausedTimers = null;
      }

      /**
       * DOM ELEMENT REFERENCES
       */
      const dom = {
        gameFrame: document.getElementById('gameFrame'),
        pokerTable: document.getElementById('pokerTable'),
        roundCounterText: document.getElementById('roundCounterText'),
        deckProgressText: document.getElementById('deckProgressText'),
        reshuffleBtn: document.getElementById('reshuffleBtn'),
        soundToggleBtn: document.getElementById('soundToggleBtn'),
        soundOnIcon: document.getElementById('soundOnIcon'),
        soundOffIcon: document.getElementById('soundOffIcon'),
        cowboySpeech: document.getElementById('cowboySpeech'),
        turnStatusSubtext: document.getElementById('turnStatusSubtext'),
        turnCounterBadge: document.getElementById('turnCounterBadge'),
        opponentGrid: document.getElementById('opponentGrid'),
        studentGrid: document.getElementById('studentGrid'),
        tableStatusText: document.getElementById('tableStatusText'),
        roundMatchTracker: document.getElementById('roundMatchTracker'),
        roundResultToast: document.getElementById('roundResultToast'),
        roundResultTitle: document.getElementById('roundResultTitle'),
        roundResultSub: document.getElementById('roundResultSub'),
        wrongShotOverlay: document.getElementById('wrongShotOverlay'),
        chipCountValue: document.getElementById('chipCountValue'),
        chipStackContainer: document.getElementById('chipStackContainer'),
        endingOverlay: document.getElementById('endingOverlay'),
        endingBulletHoles: document.getElementById('endingBulletHoles'),
        endingBadge: document.getElementById('endingBadge'),
        endingCardBox: document.getElementById('endingCardBox'),
        endingExactMessage: document.getElementById('endingExactMessage'),
        endingStatsSummary: document.getElementById('endingStatsSummary'),
        playAgainBtn: document.getElementById('playAgainBtn')
      };

      /**
       * FISHER-YATES INDEPENDENT SHUFFLE
       */
      function shuffleArray(array) {
        const arr = array.slice();
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = arr[i];
          arr[i] = arr[j];
          arr[j] = temp;
        }
        return arr;
      }

      /**
       * STRICT VOCABULARY JSON VALIDATION
       */
      function validateAndNormalizeVocabulary(rawList, { strict = false } = {}) {
        if (!Array.isArray(rawList)) {
          return { valid: false, error: 'Root JSON structure must be an Array of vocabulary objects.' };
        }

        if (rawList.length < 4) {
          return {
            valid: false,
            error: `At least 4 distinct vocabulary entries are required to build a round (found ${rawList.length}).`
          };
        }

        const seenWords = new Set();
        const seenSynonyms = new Set();
        const normalized = [];

        for (let i = 0; i < rawList.length; i++) {
          const item = rawList[i];
          const rowNum = i + 1;

          if (!item || typeof item !== 'object' || Array.isArray(item)) {
            if (strict) return { valid: false, error: `Entry #${rowNum} is not a valid JSON object.` };
            continue;
          }

          if (strict && 'synonyms' in item) {
            return {
              valid: false,
              error: `Entry #${rowNum} uses a "synonyms" field. Each entry must use the singular "synonym" string field only.`
            };
          }

          const word = String(item.word || '').trim();
          const translation = String(item.translation || item.meaning || '').trim();
          let synonym = String(item.synonym || (Array.isArray(item.synonyms) ? item.synonyms[0] : item.synonym1) || '').trim();
          if (!synonym) synonym = translation;

          if (strict) {
            const keys = Object.keys(item);
            const requiredKeys = ['word', 'translation', 'synonym'];
            for (const reqKey of requiredKeys) {
              if (!keys.includes(reqKey)) {
                return { valid: false, error: `Entry #${rowNum} is missing required field "${reqKey}".` };
              }
            }
            const extraKeys = keys.filter((k) => !requiredKeys.includes(k) && k !== 'id');
            if (extraKeys.length > 0) {
              return {
                valid: false,
                error: `Entry #${rowNum} contains unsupported field(s): ${extraKeys.join(', ')}. Only "word", "translation", and "synonym" are allowed.`
              };
            }
          }

          if (!word || (!translation && !synonym)) {
            if (strict) return { valid: false, error: `Entry #${rowNum} has empty field values.` };
            continue;
          }

          const wordKey = word.toLowerCase();
          const synKey = (synonym || translation).toLowerCase();

          if (wordKey === synKey && !translation) {
            if (strict) {
              return {
                valid: false,
                error: `Entry #${rowNum} ("${word}") cannot have the exact same word as its own synonym.`
              };
            }
            continue;
          }

          if (seenWords.has(wordKey)) {
            if (strict) return { valid: false, error: `Duplicate original word detected: "${word}" (Entry #${rowNum}).` };
            continue;
          }
          if (strict && seenSynonyms.has(synKey)) {
            return {
              valid: false,
              error: `Duplicate or ambiguous synonym detected: "${synonym}" (Entry #${rowNum}).`
            };
          }

          seenWords.add(wordKey);
          seenSynonyms.add(synKey);

          normalized.push({
            id: item.id || `vocab_${String(normalized.length + 1).padStart(3, '0')}`,
            word,
            translation: translation || synonym,
            synonym: synonym || translation
          });
        }

        if (normalized.length < 4) {
          return {
            valid: false,
            error: `Need at least 4 unique words to play (found ${normalized.length}).`
          };
        }

        return { valid: true, entries: normalized };
      }

      function selectFourRoundEntries() {
        if (state.vocabLibrary.length < 4) return null;

        if (state.pendingVocabLibrary) {
          state.vocabLibrary = state.pendingVocabLibrary;
          state.pendingVocabLibrary = null;
          state.unusedPoolIds = shuffleArray(state.vocabLibrary.map((e) => e.id));
        }

        if (state.unusedPoolIds.length < 4) {
          state.unusedPoolIds = shuffleArray(state.vocabLibrary.map((e) => e.id));
        }

        const chosen = [];
        const chosenLabels = new Set();
        const unchosenPool = [];

        for (const id of state.unusedPoolIds) {
          const entry = state.vocabLibrary.find((item) => item.id === id);
          if (!entry) continue;
          const matchLabel = (entry.synonym || entry.translation || '').trim().toLowerCase();
          if (chosen.length < 4 && !chosenLabels.has(matchLabel)) {
            chosen.push(entry);
            chosenLabels.add(matchLabel);
          } else {
            unchosenPool.push(id);
          }
        }

        if (chosen.length < 4) {
          const allShuffled = shuffleArray(state.vocabLibrary);
          for (const entry of allShuffled) {
            if (chosen.length === 4) break;
            if (chosen.some(c => c.id === entry.id)) continue;
            const matchLabel = (entry.synonym || entry.translation || '').trim().toLowerCase();
            if (!chosenLabels.has(matchLabel)) {
              chosen.push(entry);
              chosenLabels.add(matchLabel);
            }
          }
        }

        state.unusedPoolIds = unchosenPool;
        return chosen.length === 4 ? chosen : state.vocabLibrary.slice(0, 4);
      }

      function generateDecorativeCardFaces(count = 8) {
        const deck = [];
        for (const rank of CARD_RANKS) {
          for (const suit of CARD_SUITS) {
            deck.push({ rank, suit });
          }
        }
        return shuffleArray(deck).slice(0, count);
      }

      function buildHandsForRound(fourEntries) {
        const decorativeFaces = generateDecorativeCardFaces(8);
        const opponentEntries = shuffleArray(fourEntries);
        let studentEntries = shuffleArray(fourEntries);

        let attempts = 0;
        while (
          attempts < 6 &&
          studentEntries.every((entry, idx) => entry.id === opponentEntries[idx].id)
        ) {
          studentEntries = shuffleArray(fourEntries);
          attempts++;
        }

        const opponentHand = opponentEntries.map((entry, idx) => ({
          slotIndex: idx,
          vocabId: entry.id,
          word: entry.word,
          translation: entry.translation,
          rank: decorativeFaces[idx].rank,
          suit: decorativeFaces[idx].suit,
          resolved: false,
          outcome: null
        }));

        const studentHand = studentEntries.map((entry, idx) => ({
          slotIndex: idx,
          vocabId: entry.id,
          synonym: entry.synonym,
          rank: decorativeFaces[idx + 4].rank,
          suit: decorativeFaces[idx + 4].suit,
          used: false,
          outcome: null
        }));

        return { opponentHand, studentHand };
      }

      const ASSIST_COST = 2;
      const WRONG_PAIR_COST = 2;

      function payForAssist() {
        if (state.gameState !== GAME_STATES.PLAYING || state.chips < ASSIST_COST) return false;
        const previous = state.chips;
        state.chips -= ASSIST_COST;
        renderChipStack(previous);
        sound.playChipLoss();
        return true;
      }

      function stopPronunciation() {
        pronunciationToken += 1;
        const synth = window.speechSynthesis;
        try { if (pendingVoiceListener) synth?.removeEventListener('voiceschanged', pendingVoiceListener); } catch (_) {}
        pendingVoiceListener = null;
        try { synth?.cancel(); } catch (_) {}
      }
      function pronounceWord(word) {
        stopPronunciation();
        const synth = window.speechSynthesis;
        if (!state.soundEnabled || !synth || typeof window.SpeechSynthesisUtterance !== 'function') return false;
        const token = pronunciationToken, session = state.sessionToken;
        const current = () => token === pronunciationToken && session === state.sessionToken && state.soundEnabled && state.gameState === GAME_STATES.RESOLVING;
        const speak = () => {
          if (!current()) return false;
          try {
            const voice = synth.getVoices().find(v => v.localService === true && /^en(?:[-_]|$)/i.test(v.lang));
            if (!voice) return false;
            const utterance = new SpeechSynthesisUtterance(String(word));
            utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = .9;
            utterance.onerror = () => {}; synth.speak(utterance);
            return true;
          } catch (_) { return false; }
        };
        if (speak()) return true;
        if (typeof synth.addEventListener === 'function') {
          const listener = () => { if (!current() || speak()) { synth.removeEventListener('voiceschanged', listener); if (pendingVoiceListener === listener) pendingVoiceListener = null; } };
          pendingVoiceListener = listener; synth.addEventListener('voiceschanged', listener);
          scheduleTimer(() => { synth.removeEventListener('voiceschanged', listener); if (pendingVoiceListener === listener) pendingVoiceListener = null; }, 1200);
        }
        return false;
      }
      function vocabularyEntry(card) { return state.vocabLibrary.find(entry => entry.id === card?.vocabId); }
      function cardElement(side, index) { return document.getElementById(`${side === 'opponent' ? 'opp' : 'stu'}Card_${index}`); }
      function matchedCard(side, card) { return side === 'opponent' ? card?.resolved : card?.used; }
      function loadCardArtwork() {
        const script = document.currentScript?.src || new URL('./js/poker-1.js', location.href).href;
        return preloadPokerImage(new URL('../assets/poker_cards_spritesheet.png',script).href,3840,480).then(valid => {
          document.documentElement.classList.toggle('poker-cards-ready',valid);
          return valid;
        });
      }
      function preloadPokerImage(url,width,height) {
        return new Promise(resolve => {
          const image = new Image();
          image.onload = () => resolve(image.naturalWidth === width && image.naturalHeight === height);
          image.onerror = () => resolve(false);
          image.src = url;
        });
      }
      function loadCriticalArtwork() {
        const script = document.currentScript?.src || new URL('./js/poker-1.js',location.href).href;
        return Promise.all([
          loadCardArtwork(),
          preloadPokerImage(new URL('../assets/cowboy_dealer_spritesheet.png',script).href,1536,2304),
          preloadPokerImage(new URL('../assets/poker_elements_spritesheet.png',script).href,1024,64),
          preloadPokerImage(new URL('../../arcade/assets/ui_spritesheet.png',script).href,384,256)
        ]).then(result => {
          document.documentElement.classList.toggle('poker-dealer-unavailable',!result[1]);
          document.documentElement.classList.toggle('poker-elements-unavailable',!result[2]);
          document.documentElement.classList.toggle('poker-controls-unavailable',!result[3]);
          return result;
        });
      }
      function renderEndingSummary() {
        const accuracy = state.totalAttempts ? Math.round(state.totalPairs / state.totalAttempts * 100) : 0;
        const mistakes = state.mistakes.map(item => `<li><strong>${escapeHTML(item.word)}</strong> + ${escapeHTML(item.selectedSynonym)}<br><span>Correct: ${escapeHTML(item.correctSynonym)} · ${escapeHTML(item.translation)}</span></li>`).join('');
        dom.endingStatsSummary.innerHTML = `<div class="poker-run-stats"><span>Final chips<strong>${state.chips}</strong></span><span>Rounds played<strong>${state.roundsPlayed}</strong></span><span>Pairs matched<strong>${state.totalPairs}</strong></span><span>Accuracy<strong>${accuracy}%</strong></span></div>${mistakes ? `<details class="poker-mistakes" open><summary>Mistake review (${state.mistakes.length})</summary><ol>${mistakes}</ol></details>` : '<p class="poker-no-mistakes">No mistakes this run.</p>'}`;
      }
      function beginDealerTurn() {
        const unmatched = state.opponentHand.filter(card => !card.resolved);
        if (!unmatched.length) return;
        // A wrong answer or a restored page keeps the current challenge.
        const current = state.opponentHand[state.activeOpponentIndex];
        if (!current || current.resolved) {
          state.activeOpponentIndex = unmatched[Math.floor(Math.random() * unmatched.length)].slotIndex;
        }
        state.gameState = GAME_STATES.PLAYING;
        setDealerPose('idle');
        dom.turnStatusSubtext.textContent = 'Pick its matching synonym or meaning from your hand.';
        showTableStatus('MATCH THE HIGHLIGHTED WORD');
        updateActiveCardStates();
      }

      function useHint() {
        const index = state.activeOpponentIndex;
        const card = state.opponentHand[index];
        const element = cardElement('opponent', index);
        if (!card || card.resolved || !card.translation || !element ||
            element.classList.contains('meaning-visible') || !payForAssist()) return false;
        element.classList.add('meaning-visible');
        dom.turnStatusSubtext.textContent = card.translation;
        showTableStatus('MEANING HINT');
        updateAssistButtons();
        scheduleTimer(() => {
          if (!card.revealingMeaning) element.classList.remove('meaning-visible');
          if (state.gameState === GAME_STATES.PLAYING && state.activeOpponentIndex === index) {
            dom.turnStatusSubtext.textContent = 'Pick its matching synonym or meaning from your hand.';
            showTableStatus('MATCH THE HIGHLIGHTED WORD');
          }
          updateAssistButtons();
        }, 1200);
        return true;
      }

      function handleStudentChoice(studentIndex) {
        if (state.gameState !== GAME_STATES.PLAYING) return;
        const opponentIndex = state.activeOpponentIndex;
        const opp = state.opponentHand[opponentIndex], stu = state.studentHand[studentIndex];
        if (!opp || opp.resolved || !stu || stu.used) return;
        state.gameState = GAME_STATES.RESOLVING;
        state.totalAttempts += 1;
        stopPronunciation();
        updateActiveCardStates();
        const oppEl = cardElement('opponent', opponentIndex), stuEl = cardElement('student', studentIndex);
        if (opp.vocabId === stu.vocabId) resolveCorrectTurn(opponentIndex, studentIndex, oppEl, stuEl);
        else resolveIncorrectTurn(opponentIndex, studentIndex, oppEl, stuEl);
      }

      function awardCompletedRound() {
        if (state.roundScored || state.roundCorrectCount !== 4 || !state.opponentHand.every(card => card.resolved)) return false;
        state.roundScored = true;
        if (state.roundIncorrectAttempts === 0) {
          const previous = state.chips; state.chips += 2; renderChipStack(previous); sound.playChipGain();
          showRoundResultToast('ROYAL SHOWDOWN: +2 CHIPS','Four pairs. No mistakes.',true); showTableStatus('PERFECT HAND · ROYAL SHOWDOWN +2');
        } else { showRoundResultToast('ROUND COMPLETE','Four pairs matched!',true); showTableStatus('ROUND COMPLETE'); }
        return true;
      }
      let pronunciationToken = 0, pendingVoiceListener = null;

      function getWordFontSizeClass(text, isSynonym = false) {
        const len = (text || '').length;
        if (len >= 15) return isSynonym ? 'text-xs sm:text-sm' : 'text-xs sm:text-sm';
        if (len >= 11) return isSynonym ? 'text-sm sm:text-base' : 'text-sm sm:text-base';
        return isSynonym ? 'text-base sm:text-lg' : 'text-base sm:text-lg';
      }

      // Presentation state only. Pose resets use the SAME existing token-aware
      // scheduler; no independent animation timer can survive restart/end.
      let dealerPoseToken = 0;
      function setDealerPose(pose, restoreAfter = 0) {
        const valid = ['idle', 'deal', 'impressed', 'shoot', 'victory', 'defeat'];
        if (!valid.includes(pose)) return;
        const token = ++dealerPoseToken;
        const dealer = document.querySelector('[data-poker-dealer]');
        if (dealer) {
          dealer.style.animation = 'none';
          dealer.dataset.pose = pose;
          void dealer.offsetWidth;
          dealer.style.animation = '';
        }
        if (restoreAfter) scheduleTimer(() => {
          if (dealerPoseToken === token && state.gameState !== GAME_STATES.VICTORY && state.gameState !== GAME_STATES.DEFEAT) setDealerPose('idle');
        }, restoreAfter);
      }
      function placeDealerAtEnding(ending) {
        const dealer = document.querySelector('[data-dealer-sprite-wrap]');
        const target = document.querySelector(ending ? '[data-ending-dealer-slot]' : '[data-dealer-home]');
        if (dealer && target) target.appendChild(dealer);
        dom.gameFrame.classList.toggle('is-ending', ending);
      }

      function getBisonSkullCardBackHTML() {
        return '<div class="card-face card-back"><span class="poker-card-art card-art-back" aria-hidden="true"></span><span class="card-art-fallback">MATCHED</span></div>';
      }

      function renderHands(withDealAnimation = false) {
        const renderSide = (side, hand) => hand.map((card, index) => {
          const isMatched = matchedCard(side, card), label = side === 'opponent' ? card.word : card.synonym;
          const playable = side === 'student' && state.gameState === GAME_STATES.PLAYING && !isMatched;
          const selected = side === 'opponent' && state.activeOpponentIndex === index && !card.resolved;
          const classes = ['playing-card',side === 'opponent' ? 'opponent-card' : '',withDealAnimation ? 'dealing-start' : '',isMatched && !card.revealingMeaning ? 'is-flipped' : '',isMatched ? 'matched-card' : '',selected ? 'is-selected' : '',card.revealingMeaning ? 'meaning-visible' : '',playable ? 'student-selectable' : ''].filter(Boolean).join(' ');
          const entry = vocabularyEntry(card);
          const face = {diamonds:'diamond',spades:'spade',clubs:'club',hearts:'heart'}[card.suit.name] || 'spade';
          return `<div class="card-slot" data-${side === 'opponent' ? 'opponent' : 'student'}-slot="${index}"><div id="${side === 'opponent' ? 'opp' : 'stu'}Card_${index}" class="${classes}" data-poker-side="${side}" data-poker-index="${index}" ${side === 'student' ? `data-student-index="${index}"` : ''} data-vocab-id="${escapeHTML(card.vocabId)}" role="${side === 'student' ? 'button' : 'img'}" tabindex="${playable ? 0 : -1}" aria-disabled="${!playable}" aria-current="${selected}" aria-label="${side === 'opponent' ? 'Word' : 'Synonym'}: ${escapeHTML(label)}"><div class="card-face card-front"><span class="poker-card-art card-art-${face}" aria-hidden="true"></span><div class="card-live-content"><div class="${side === 'opponent' ? 'card-word-text font-card-word' : 'card-synonym-text'} ${getWordFontSizeClass(label, side === 'student')}">${escapeHTML(label)}</div><div class="card-meaning-text">${escapeHTML(entry?.translation || card.translation || '')}</div></div></div>${getBisonSkullCardBackHTML()}</div></div>`;
        }).join('');
        dom.opponentGrid.innerHTML = renderSide('opponent', state.opponentHand);
        dom.studentGrid.innerHTML = renderSide('student', state.studentHand);
        dom.studentGrid.querySelectorAll('[data-poker-index]').forEach(element => {
          const choose = () => handleStudentChoice(Number(element.dataset.pokerIndex));
          element.addEventListener('click', choose);
          element.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } });
        });
      }

      function renderChipStack(previousChips = state.chips) {
        dom.chipCountValue.textContent = String(state.chips);
        const slots = [];
        for (let i = 1; i <= 12; i++) {
          const isFilled = i <= state.chips;
          const wasFilled = i <= previousChips;
          let animClass = '';
          if (isFilled && !wasFilled) animClass = 'chip-gain-anim';
          if (!isFilled && wasFilled) animClass = 'chip-loss-anim';
          const color = i === 12 ? 'gold' : i % 2 ? 'red' : 'blue';
          slots.push(`<div class="chip-token poker-chip-slot ${animClass} ${!isFilled && !wasFilled ? 'is-empty' : ''}" title="${isFilled ? 'Chip' : 'Empty Chip Slot'} ${i}"><span class="poker-sprite sprite-chip-${color}" aria-hidden="true"></span></div>`);
        }
        dom.chipStackContainer.innerHTML = slots.join('');
        updateAssistButtons();
      }

      function updateHUD() {
        dom.roundCounterText.textContent = `ROUND ${state.round}`;
        const total = state.vocabLibrary.length, usedInCycle = total - state.unusedPoolIds.length;
        const params = new URLSearchParams(location.search), topic = params.get('topic')?.trim();
        dom.deckProgressText.textContent = params.get('mode')?.toLowerCase() === 'topic' && topic ? `${topic.toUpperCase()} (${Math.min(usedInCycle,total)}/${total})` : `FULL DECK (${Math.min(usedInCycle,total)}/${total})`;
        const target = state.opponentHand[state.activeOpponentIndex];
        dom.turnCounterBadge.textContent = target && !target.resolved ? 'DEALER’S PICK' : '';
        dom.roundMatchTracker.textContent = `${state.roundCorrectCount} / 4 MATCHED`;
        dom.cowboySpeech.textContent = target && !target.resolved ? `“${target.word}”` : '“Watch my hand.”';
        updateAssistButtons();
      }

      function startNewRound(preparedEntries = null) {
        if ([GAME_STATES.VICTORY,GAME_STATES.DEFEAT].includes(state.gameState)) return false;
        const fourEntries = preparedEntries || selectFourRoundEntries();
        if (!fourEntries || fourEntries.length !== 4) { showTableStatus('POKER REQUIRES FOUR VALID PAIRS'); return false; }
        clearAllScheduledTimers(); stopPronunciation();
        state.gameState = GAME_STATES.DEALING; setDealerPose('deal');
        state.activeOpponentIndex = -1;
        state.roundCorrectCount = 0; state.roundIncorrectAttempts = 0; state.roundScored = false;
        state.consecutiveCorrect = 0; state.roundStreakAwarded = false; state.roundsPlayed += 1;
        const hands = buildHandsForRound(fourEntries); state.opponentHand = hands.opponentHand; state.studentHand = hands.studentHand;
        hideRoundResultToast(); dom.wrongShotOverlay.classList.add('hidden'); dom.wrongShotOverlay.classList.remove('flex'); dom.wrongShotOverlay.innerHTML = '';
        updateHUD(); showTableStatus('DEALING NEW HAND...'); dom.turnStatusSubtext.textContent = 'Shuffling the deck...';
        renderHands(true); sound.playCardShuffle();
        const order = ['oppCard_0','stuCard_0','oppCard_1','stuCard_1','oppCard_2','stuCard_2','oppCard_3','stuCard_3'];
        order.forEach((id,index) => scheduleTimer(() => { const el = document.getElementById(id); if (!el) return; el.classList.remove('dealing-start'); el.parentElement.classList.add('dealing-animate'); sound.playCardDeal(); scheduleTimer(() => sound.playCardPlace(),260); },260 + index * 175));
        scheduleTimer(beginDealerTurn, 1940);
        return true;
      }

      function updateActiveCardStates() {
        ['opponent','student'].forEach(side => {
          const hand = side === 'opponent' ? state.opponentHand : state.studentHand;
          hand.forEach((card,index) => {
            const element = cardElement(side,index); if (!element) return;
            const matched = matchedCard(side,card), playable = side === 'student' && state.gameState === GAME_STATES.PLAYING && !matched;
            const selected = side === 'opponent' && state.activeOpponentIndex === index && !card.resolved;
            element.classList.toggle('is-selected',selected); element.classList.toggle('matched-card',matched); element.classList.toggle('student-selectable',playable);
            element.setAttribute('aria-disabled',String(!playable)); element.setAttribute('aria-current',String(selected)); element.tabIndex = playable ? 0 : -1;
          });
        });
        updateHUD();
      }


      function resolveCorrectTurn(oppIndex,studentIndex,oppEl,stuEl) {
        const opp = state.opponentHand[oppIndex], stu = state.studentHand[studentIndex];
        if (opp.resolved || stu.used) return;
        setDealerPose('impressed',520); opp.resolved = true; opp.outcome = 'correct'; opp.revealingMeaning = true; stu.used = true; stu.outcome = 'correct'; stu.revealingMeaning = true;
        state.roundCorrectCount += 1; state.totalPairs += 1; state.consecutiveCorrect += 1;
        let gain = 1;
        if (state.consecutiveCorrect >= 2 && !state.roundStreakAwarded) { state.roundStreakAwarded = true; gain += 1; showRoundResultToast('2x STREAK! +1 CHIP','Two consecutive pairs!',true); }
        const previous = state.chips; state.chips += gain; renderChipStack(previous);
        if (state.roundCorrectCount === 4) awardCompletedRound();
        [oppEl,stuEl].forEach(el => el?.classList.add('correct-flash','meaning-visible'));
        updateActiveCardStates(); sound.playCorrectMatch(); pronounceWord(opp.word);
        showTableStatus(gain === 2 ? 'MATCH +1 · STREAK +1' : 'MATCH: +1 CHIP'); dom.turnStatusSubtext.textContent = opp.translation;
        scheduleTimer(() => {
          opp.revealingMeaning = false; stu.revealingMeaning = false;
          [oppEl,stuEl].forEach(el => { el?.classList.remove('correct-flash','meaning-visible'); el?.classList.add('is-flipped'); });
          sound.playCardDeal(.06,1000); if (state.roundCorrectCount !== 4) hideRoundResultToast(); advanceToNextTurnOrCompleteRound();
        },1200);
      }

      function resolveIncorrectTurn(oppIndex,studentIndex,oppEl,stuEl) {
        setDealerPose('shoot',520); state.roundIncorrectAttempts += 1; state.consecutiveCorrect = 0;
        const opp = state.opponentHand[oppIndex], stu = state.studentHand[studentIndex], correct = vocabularyEntry(opp);
        state.mistakes.push({round:state.round,word:opp.word,selectedSynonym:stu.synonym,correctSynonym:correct?.synonym || '',translation:opp.translation});
        const previous = state.chips; state.chips = Math.max(0, state.chips - WRONG_PAIR_COST); renderChipStack(previous); sound.playChipLoss();
        [oppEl,stuEl].forEach(el => el?.classList.add('wrong-flash'));
        sound.playGunshot(); scheduleTimer(() => sound.playBulletWhizz(),95); triggerScreenShake(); showBriefTableBulletImpact();
        showTableStatus('WRONG PAIR: -' + WRONG_PAIR_COST + ' CHIPS'); dom.turnStatusSubtext.textContent = 'Try another card for the same word.';
        if (!state.chips) { scheduleTimer(() => triggerTerminalEnding(false),650); return; }
        scheduleTimer(() => { [oppEl,stuEl].forEach(el => el?.classList.remove('wrong-flash')); beginDealerTurn(); },580);
      }

      function triggerScreenShake() {
        dom.gameFrame.classList.remove('screen-shake');
        void dom.gameFrame.offsetWidth;
        dom.gameFrame.classList.add('screen-shake');
      }

      function showBriefTableBulletImpact() {
        dom.wrongShotOverlay.innerHTML = createBulletHoleSprite(50, 52, 1.1) + '<span class="poker-sprite sprite-muzzle-flash poker-shot-flash" aria-hidden="true"></span>';
        dom.wrongShotOverlay.classList.remove('hidden');
        dom.wrongShotOverlay.classList.add('flex');
        scheduleTimer(() => {
          dom.wrongShotOverlay.classList.add('hidden');
          dom.wrongShotOverlay.classList.remove('flex');
          dom.wrongShotOverlay.innerHTML = '';
        }, 620);
      }

      function advanceToNextTurnOrCompleteRound() {
        if (state.opponentHand.every(card => card.resolved)) { completeCurrentRound(); return; }
        if (state.chips >= 12) { scheduleTimer(() => triggerTerminalEnding(true), 520); return; }
        beginDealerTurn();
      }

      function completeCurrentRound() {
        if (state.gameState === GAME_STATES.ROUND_COMPLETE || [GAME_STATES.VICTORY,GAME_STATES.DEFEAT].includes(state.gameState) || state.roundCorrectCount !== 4 || !state.opponentHand.every(card => card.resolved)) return;
        awardCompletedRound();
        state.gameState = GAME_STATES.ROUND_COMPLETE;
        updateActiveCardStates();
        if (state.chips >= 12) { scheduleTimer(() => triggerTerminalEnding(true), 520); return; }
        scheduleTimer(() => { state.round += 1; startNewRound(); },1650);
      }


      function updateAssistButtons() {
        const enabled = state.gameState === GAME_STATES.PLAYING && state.chips >= ASSIST_COST;
        dom.reshuffleBtn.disabled = !enabled;
        dom.reshuffleBtn.classList.toggle('disabled', !enabled);
        const target = state.opponentHand[state.activeOpponentIndex];
        const showingHint = cardElement('opponent', state.activeOpponentIndex)?.classList.contains('meaning-visible');
        document.querySelector('[data-poker-hint]').disabled = !enabled || !target?.translation || showingHint;
      }

      function reshuffleDeck() {
        if (state.gameState !== GAME_STATES.PLAYING || state.chips < ASSIST_COST) return false;
        const current = new Set(state.opponentHand.map(card => card.vocabId));
        const fresh = shuffleArray(state.vocabLibrary.filter(entry => !current.has(entry.id)));
        const previous = shuffleArray(state.vocabLibrary.filter(entry => current.has(entry.id)));
        const chosen = fresh.concat(previous).slice(0, 4);
        if (chosen.length !== 4 || !payForAssist()) return false;
        const used = new Set(chosen.map(entry => entry.id));
        state.unusedPoolIds = state.unusedPoolIds.filter(id => !used.has(id));
        state.round += 1;
        return startNewRound(chosen);
      }

      function showRoundResultToast(title, subtitle, isWin) {
        dom.roundResultTitle.textContent = title;
        dom.roundResultTitle.className = isWin
          ? 'font-western text-sm sm:text-base tracking-wider text-[#F3D060]'
          : 'font-western text-sm sm:text-base tracking-wider text-[#FF6B6B]';
        dom.roundResultSub.textContent = subtitle;

        dom.roundResultToast.classList.remove('opacity-0', 'scale-90');
        dom.roundResultToast.classList.add('opacity-100', 'scale-100');
      }

      function hideRoundResultToast() {
        dom.roundResultToast.classList.remove('opacity-100', 'scale-100');
        dom.roundResultToast.classList.add('opacity-0', 'scale-90');
      }

      function showTableStatus(text) {
        dom.tableStatusText.textContent = text;
      }

      function createBulletHoleSprite(leftPct, topPct, scale = 1) {
        return `<span class="poker-sprite sprite-bullet-hole poker-bullet-hole" aria-hidden="true" style="left:${leftPct}%;top:${topPct}%;transform:translate(-50%,-50%) scale(${scale});"></span>`;
      }

      function triggerTerminalEnding(isVictory) {
        clearAllScheduledTimers();
        state.gameState = isVictory ? GAME_STATES.VICTORY : GAME_STATES.DEFEAT;
        placeDealerAtEnding(true);
        setDealerPose(isVictory ? 'defeat' : 'victory');
        hideRoundResultToast();
        stopPronunciation();

        const holesPositions = [
          { x: 22, y: 20, s: 1.05 },
          { x: 78, y: 26, s: 0.92 },
          { x: 18, y: 74, s: 0.88 },
          { x: 81, y: 78, s: 1.1 }
        ];
        dom.endingBulletHoles.innerHTML = '';

        if (isVictory) {
          dom.endingBadge.querySelector('[data-ending-badge-text]').textContent = '12 CHIPS REACHED · FINAL SHOWDOWN';
          dom.endingExactMessage.textContent = '“you won? but at what cost?”';
        } else {
          dom.endingBadge.querySelector('[data-ending-badge-text]').textContent = 'OUT OF CHIPS · BUSTED';
          dom.endingExactMessage.textContent = '“Reckon you need a bit more practice, partner.”';
        }

        renderEndingSummary();

        pauseButton.hidden = true;
        dom.endingOverlay.classList.remove('hidden');
        dom.endingOverlay.classList.add('flex');
        triggerScreenShake();

        sound.playGunshot();
        dom.endingBulletHoles.insertAdjacentHTML(
          'beforeend',
          createBulletHoleSprite(holesPositions[0].x, holesPositions[0].y, holesPositions[0].s)
        );
        dom.endingBulletHoles.insertAdjacentHTML(
          'beforeend',
          createBulletHoleSprite(holesPositions[1].x, holesPositions[1].y, holesPositions[1].s)
        );

        scheduleTimer(() => {
          sound.playBulletWhizz();
          dom.endingBulletHoles.insertAdjacentHTML(
            'beforeend',
            createBulletHoleSprite(holesPositions[2].x, holesPositions[2].y, holesPositions[2].s)
          );
          dom.endingBulletHoles.insertAdjacentHTML(
            'beforeend',
            createBulletHoleSprite(holesPositions[3].x, holesPositions[3].y, holesPositions[3].s)
          );
        }, 160);

        scheduleTimer(() => {
          dom.endingCardBox.classList.remove('opacity-0', 'translate-y-4');
          dom.endingCardBox.classList.add('opacity-100', 'translate-y-0');
          sound.playCowboyGuitarEnding(isVictory);
        }, 460);
      }

      function restartGame() {
        clearAllScheduledTimers(); stopPronunciation(); placeDealerAtEnding(false); setDealerPose('idle');
        if (state.pendingVocabLibrary) { state.vocabLibrary = state.pendingVocabLibrary; state.pendingVocabLibrary = null; }
        state.gameState = GAME_STATES.READY; state.chips = 5; state.round = 1; state.roundsPlayed = 0;
        state.activeOpponentIndex = -1; state.roundCorrectCount = 0; state.roundIncorrectAttempts = 0; state.roundScored = false;
        state.consecutiveCorrect = 0; state.roundStreakAwarded = false; state.totalPairs = 0; state.totalAttempts = 0; state.mistakes = [];
        state.opponentHand = []; state.studentHand = []; state.unusedPoolIds = shuffleArray(state.vocabLibrary.map(entry => entry.id));
        pauseButton.hidden = false;
        dom.endingOverlay.classList.add('hidden'); dom.endingOverlay.classList.remove('flex');
        dom.endingCardBox.classList.add('opacity-0','translate-y-4'); dom.endingCardBox.classList.remove('opacity-100','translate-y-0'); dom.endingBulletHoles.innerHTML = '';
        dom.wrongShotOverlay.innerHTML = ''; dom.wrongShotOverlay.classList.add('hidden'); dom.wrongShotOverlay.classList.remove('flex'); dom.gameFrame.classList.remove('screen-shake');
        hideRoundResultToast(); renderChipStack(5); startNewRound();
      }

      function toggleSound() {
        state.soundEnabled = !state.soundEnabled;
        if (!state.soundEnabled) stopPronunciation();
        dom.soundOnIcon.classList.toggle('hidden', !state.soundEnabled);
        dom.soundOffIcon.classList.toggle('hidden', state.soundEnabled);
        dom.soundToggleBtn.setAttribute('aria-pressed', String(state.soundEnabled));
        document.querySelector('[data-poker-sound-label]').textContent = state.soundEnabled ? 'Sound · On' : 'Sound · Off';

        if (!state.soundEnabled && sound.ctx && sound.ctx.state === 'running') {
          sound.ctx.suspend().catch(() => {});
        } else if (state.soundEnabled) {
          sound.ensureContext();
        }
      }

      function escapeHTML(str) {
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      async function loadLexicalSpaceVocabulary(silent = false) {
        const urlParams = new URLSearchParams(window.location.search);
        let urlMode = (urlParams.get("mode") || "full").trim().toLowerCase();
        if (!["full", "topic"].includes(urlMode)) {
          urlMode = "full";
        }
        const selectedTopic = (urlParams.get("topic") || "").trim();

        // 1. Resolve active user from suite / storage / URL
        let username = "";
        if (window.lexicalVocabulary && typeof window.lexicalVocabulary.activeProfile === 'function') {
          username = window.lexicalVocabulary.activeProfile();
        }
        if (!username) {
          username = (urlParams.get("user") || "").trim();
        }
        if (!username) {
          try {
            const profile = sessionStorage.getItem("ls_active_profile");
            username = (profile ?? (localStorage.getItem("vocab_user") || localStorage.getItem("username") || "")).trim();
          } catch (_) {}
        }

        // 2. Fetch raw words using shared reader or direct IndexedDB
        async function fetchSharedWords() {
          if (window.lexicalVocabulary && typeof window.lexicalVocabulary.readWords === 'function') {
            try {
              const res = await window.lexicalVocabulary.readWords(username, { includeLegacyUnassigned: true });
              if (Array.isArray(res) && res.length > 0) return { words: res };
            } catch (_) {}
          }

          return new Promise((resolve) => {
            try {
              if (!window.indexedDB) return resolve({ words: [], error: "IndexedDB not supported" });
              const req = indexedDB.open("LexicalSpaceDB");
              req.onupgradeneeded = () => req.transaction.abort();
              req.onerror = () => resolve({ words: [], error: "Could not open LexicalSpaceDB" });
              req.onsuccess = (e) => {
                const db = e.target.result;
                db.onversionchange = () => db.close();
                if (!db.objectStoreNames.contains("words")) {
                  db.close();
                  return resolve({ words: [], error: "Object store 'words' not found" });
                }
                const tx = db.transaction("words", "readonly");
                tx.oncomplete = () => db.close();
                tx.onabort = () => { db.close(); resolve({ words: [], error: "Word read was aborted" }); };
                const store = tx.objectStore("words");
                const exactProfile = db.version >= 3;
                const getReq = exactProfile && username && store.indexNames.contains("username")
                  ? store.index("username").getAll(username) : store.getAll();
                getReq.onerror = () => resolve({ words: [], error: "Failed to read words from store" });
                getReq.onsuccess = () => {
                  const expected = exactProfile ? username : username.toLowerCase();
                  const words = (getReq.result || []).filter(word => {
                    if (!word || word.deleted === true || typeof word.word !== 'string') return false;
                    const owner = typeof word?.username === "string" ? word.username.trim() : "";
                    if (!username) return true; // Guest or unassigned mode: load all available words
                    return (exactProfile ? owner : owner.toLowerCase()) === expected;
                  });
                  resolve({ words });
                };
              };
            } catch (err) {
              resolve({ words: [], error: err.message });
            }
          });
        }

        try {
          const idbResult = await fetchSharedWords();
          let rawWords = idbResult.words || [];

          // 3. Topic filtering if requested
          if (urlMode === "topic" && selectedTopic) {
            const topicKey = selectedTopic.toLowerCase();
            const topicFiltered = rawWords.filter(word => {
              const topics = [word.topic, ...(Array.isArray(word.topics) ? word.topics : [])];
              return topics.some(topic => typeof topic === "string" && topic.trim().toLowerCase() === topicKey);
            });
            if (topicFiltered.length > 0) {
              rawWords = topicFiltered;
            } else if (rawWords.length > 0) {
              showTableStatus(`TOPIC "${selectedTopic.toUpperCase()}" EMPTY`);
              dom.turnStatusSubtext.textContent = `Topic "${selectedTopic}" has no words. Using all available words.`;
            }
          }

          if (rawWords.length === 0) {
            showTableStatus("OFFLINE SALOON DECK");
            dom.turnStatusSubtext.textContent = `No local words found in Lexical Space. Running with Saloon IELTS Deck (60 words).`;
            return false;
          }

          // 4. Convert all eligible words to Poker pairs
          // Prioritize synonym; if no synonym, use Vietnamese meaning as the match!
          const converted = rawWords.map(w => {
            const word = (w.word || "").trim();
            const translation = (w.meaning || w.translation || "").trim();
            const synCandidates = [
              w.synonym1,
              w.synonym2,
              w.synonym,
              ...(Array.isArray(w.synonyms) ? w.synonyms : (typeof w.synonyms === 'string' ? w.synonyms.split(',') : []))
            ].map(s => typeof s === 'string' ? s.trim() : '').filter(s => s && s.toLowerCase() !== word.toLowerCase());

            const synonym = synCandidates[0] || translation;
            return {
              word,
              translation: translation || synonym,
              synonym: synonym || translation
            };
          }).filter(w => w.word && (w.synonym || w.translation));

          // Deduplicate by word
          const seen = new Set();
          const unique = [];
          for (const item of converted) {
            const k = item.word.toLowerCase();
            if (!seen.has(k)) {
              seen.add(k);
              unique.push(item);
            }
          }

          if (unique.length >= 4) {
            const validation = validateAndNormalizeVocabulary(unique, { strict: false });
            if (validation.valid) {
              state.vocabLibrary = validation.entries;
              state.pendingVocabLibrary = null;
              state.unusedPoolIds = shuffleArray(state.vocabLibrary.map(e => e.id));
              showTableStatus("VOCABULARY LOADED");
              const scopeLabel = urlMode === 'topic' && selectedTopic ? `topic "${selectedTopic}"` : "Lexical Space";
              dom.turnStatusSubtext.textContent = `Loaded ${unique.length} words from ${scopeLabel}!`;
              updateHUD();
              return true;
            }
          }

          showTableStatus("INSUFFICIENT WORDS");
          dom.turnStatusSubtext.textContent = `Found only ${unique.length} word(s). Poker requires at least 4. Using Saloon IELTS Deck.`;
          return false;
        } catch (err) {
          showTableStatus("INDEXEDDB READ ERROR");
          dom.turnStatusSubtext.textContent = `Error reading local database: ${err.message || 'Unknown'}. Using Saloon IELTS Deck.`;
          return false;
        }
      }

      const mainMenu = document.querySelector('[data-poker-menu]');
      const enterCasino = document.querySelector('[data-enter-casino]');
      const pauseMenu = document.querySelector('[data-poker-pause-menu]');
      const pauseButton = document.querySelector('[data-poker-pause]');

      function showMainMenu() {
        clearAllScheduledTimers();
        stopPronunciation();
        if (pauseMenu.open) pauseMenu.close();
        state.gameState = GAME_STATES.READY;
        dom.gameFrame.hidden = true;
        mainMenu.hidden = false;
        enterCasino.focus();
      }

      function enterTable() {
        if (enterCasino.disabled || mainMenu.hidden) return;
        mainMenu.hidden = true;
        dom.gameFrame.hidden = false;
        sound.ensureContext();
        restartGame();
        pauseButton.focus();
      }

      function openPauseMenu() {
        if (dom.gameFrame.hidden || pauseMenu.open || !dom.endingOverlay.classList.contains('hidden')) return;
        parkTimers();
        stopPronunciation();
        pauseMenu.showModal();
      }

      function resumePoker() {
        if (!pauseMenu.open) return;
        pauseMenu.close();
        resumeTimers();
        pauseButton.focus();
      }

      async function initGame() {
        const criticalArtwork = loadCriticalArtwork();
        const urlParams = new URLSearchParams(window.location.search);
        const returnUrl = window.SpaceSuite
          ? SpaceSuite.safeReturn(urlParams.get("returnUrl"), "arcade")
          : new URL("../arcade/", document.baseURI).href;
        const exitArcadeBtn = document.getElementById("exitArcadeBtn");
        if (exitArcadeBtn) exitArcadeBtn.href = returnUrl;
        document.querySelectorAll("a[href='arcade.html']").forEach(a => { a.href = returnUrl; });

        const initialValidation = validateAndNormalizeVocabulary(DEFAULT_VOCAB_JSON);
        if (initialValidation.valid) {
          state.vocabLibrary = initialValidation.entries;
          state.unusedPoolIds = shuffleArray(state.vocabLibrary.map((e) => e.id));
        }

        // Auto-load from LexicalSpace if available (with topic filtering)
        await loadLexicalSpaceVocabulary(true);

        const unlockAudio = () => {
          if (state.soundEnabled) {
            sound.ensureContext();
          }
        };
        document.addEventListener('pointerdown', unlockAudio, { once: true });

        dom.playAgainBtn?.addEventListener('click', () => {
          sound.ensureContext();
          restartGame();
        });

        dom.soundToggleBtn?.addEventListener('click', () => {
          toggleSound();
        });

        dom.reshuffleBtn?.addEventListener('click', () => {
          sound.ensureContext();
          reshuffleDeck();
        });

        document.querySelector('[data-poker-hint]')?.addEventListener('click', useHint);
        enterCasino.addEventListener('click', enterTable);
        pauseButton.addEventListener('click', openPauseMenu);
        document.querySelector('[data-poker-resume]').addEventListener('click', resumePoker);
        pauseMenu.addEventListener('cancel', event => { event.preventDefault(); resumePoker(); });
        document.querySelectorAll('[data-poker-main]').forEach(button => button.addEventListener('click', showMainMenu));
        await criticalArtwork;
        enterCasino.disabled = state.vocabLibrary.length < 4;
        window.__spaceGameReady = true;
        document.dispatchEvent(new Event('spacegame:ready'));
      }

      document.addEventListener('click', event => {
        const link = event.target.closest?.('a[href]');
        if (link && !event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0 && link.target !== '_blank') { clearAllScheduledTimers(); stopPronunciation(); }
      });
      window.addEventListener('pagehide', event => {
        if (event.persisted) parkTimers();
        else clearAllScheduledTimers();
        stopPronunciation();
      });
      window.addEventListener('pageshow', event => {
        if (event.persisted && !pauseMenu.open) resumeTimers();
      });
      window.addEventListener('DOMContentLoaded', initGame);
    })();
  
import('../../arcade/js/action-frames.js').catch(() => { document.documentElement.dataset.actionArt = 'fallback'; });
