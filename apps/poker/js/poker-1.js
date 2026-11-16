
    (function () {
      'use strict';

      /**
       * DEFAULT VOCABULARY LIBRARY (20 distinct, unambiguous academic English entries)
       * Follows the strict 3-field schema: word, translation, synonym.
       */
      const DEFAULT_VOCAB_JSON = [
        { word: "substantial", translation: "đáng kể", synonym: "considerable" },
        { word: "allocate", translation: "phân bổ", synonym: "assign" },
        { word: "sustainable", translation: "bền vững", synonym: "viable" },
        { word: "initiative", translation: "sáng kiến", synonym: "proposal" },
        { word: "inevitable", translation: "không thể tránh khỏi", synonym: "unavoidable" },
        { word: "meticulous", translation: "tỉ mỉ", synonym: "thorough" },
        { word: "ambiguous", translation: "mơ hồ", synonym: "vague" },
        { word: "deteriorate", translation: "xấu đi", synonym: "worsen" },
        { word: "augment", translation: "làm tăng thêm", synonym: "increase" },
        { word: "obsolete", translation: "lỗi thời", synonym: "outdated" },
        { word: "resilient", translation: "kiên cường", synonym: "tough" },
        { word: "scrutinize", translation: "xem xét kỹ", synonym: "examine" },
        { word: "lucrative", translation: "sinh lời cao", synonym: "profitable" },
        { word: "mitigate", translation: "giảm nhẹ", synonym: "alleviate" },
        { word: "plausible", translation: "hợp lý", synonym: "believable" },
        { word: "adversity", translation: "nghịch cảnh", synonym: "hardship" },
        { word: "concur", translation: "đồng tình", synonym: "agree" },
        { word: "reluctant", translation: "miễn cưỡng", synonym: "hesitant" },
        { word: "pivotal", translation: "then chốt", synonym: "crucial" },
        { word: "candid", translation: "thẳng thắn", synonym: "frank" }
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
        { symbol: '♠', colorClass: 'suit-black', name: 'spades' },
        { symbol: '♥', colorClass: 'suit-red', name: 'hearts' },
        { symbol: '♦', colorClass: 'suit-red', name: 'diamonds' },
        { symbol: '♣', colorClass: 'suit-black', name: 'clubs' }
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
        activeOpponentIndex: 0,    // Current opponent card index (0..3)
        roundCorrectCount: 0,
        roundIncorrectAttempts: 0,
        roundScored: false,        // Guard ensuring round bonus is applied once per round
        soundEnabled: true,
        sessionToken: 0,           // Incremented on restart/end to invalidate stale callbacks
        activeTimers: new Set()    // Tracks all pending setTimeout IDs
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
          gain.connect(ctx.destination);
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
          gain.connect(ctx.destination);
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
            gain.connect(ctx.destination);
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
            gain.connect(ctx.destination);
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
            gain.connect(ctx.destination);
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
            gain.connect(ctx.destination);
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
          punchGain.connect(ctx.destination);
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
          gain.connect(ctx.destination);
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
            gain.connect(ctx.destination);

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
      function scheduleTimer(callback, delayMs) {
        const capturedToken = state.sessionToken;
        const timerId = window.setTimeout(() => {
          state.activeTimers.delete(timerId);
          if (state.sessionToken !== capturedToken) return;
          callback();
        }, delayMs);
        state.activeTimers.add(timerId);
        return timerId;
      }

      function clearAllScheduledTimers() {
        state.sessionToken += 1;
        state.activeTimers.forEach((id) => window.clearTimeout(id));
        state.activeTimers.clear();
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
      function validateAndNormalizeVocabulary(rawList) {
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
            return { valid: false, error: `Entry #${rowNum} is not a valid JSON object.` };
          }

          if ('synonyms' in item) {
            return {
              valid: false,
              error: `Entry #${rowNum} uses a "synonyms" field. Each entry must use the singular "synonym" string field only.`
            };
          }

          const keys = Object.keys(item);
          const requiredKeys = ['word', 'translation', 'synonym'];
          for (const reqKey of requiredKeys) {
            if (!keys.includes(reqKey)) {
              return { valid: false, error: `Entry #${rowNum} is missing required field "${reqKey}".` };
            }
          }

          const extraKeys = keys.filter((k) => !requiredKeys.includes(k));
          if (extraKeys.length > 0) {
            return {
              valid: false,
              error: `Entry #${rowNum} contains unsupported field(s): ${extraKeys.join(', ')}. Only "word", "translation", and "synonym" are allowed.`
            };
          }

          if (
            typeof item.word !== 'string' ||
            typeof item.translation !== 'string' ||
            typeof item.synonym !== 'string'
          ) {
            return {
              valid: false,
              error: `Entry #${rowNum} must have string values for "word", "translation", and "synonym".`
            };
          }

          const word = item.word.trim();
          const translation = item.translation.trim();
          const synonym = item.synonym.trim();

          if (!word || !translation || !synonym) {
            return { valid: false, error: `Entry #${rowNum} has empty field values.` };
          }

          const wordKey = word.toLowerCase();
          const synKey = synonym.toLowerCase();

          if (wordKey === synKey) {
            return {
              valid: false,
              error: `Entry #${rowNum} ("${word}") cannot have the exact same word as its own synonym.`
            };
          }

          if (seenWords.has(wordKey)) {
            return { valid: false, error: `Duplicate original word detected: "${word}" (Entry #${rowNum}).` };
          }
          if (seenSynonyms.has(synKey)) {
            return {
              valid: false,
              error: `Duplicate or ambiguous synonym detected: "${synonym}" (Entry #${rowNum}).`
            };
          }

          seenWords.add(wordKey);
          seenSynonyms.add(synKey);

          normalized.push({
            id: `vocab_${String(i + 1).padStart(3, '0')}`,
            word,
            translation,
            synonym
          });
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

        const chosenIds = state.unusedPoolIds.slice(0, 4);
        const chosenEntries = chosenIds
          .map((id) => state.vocabLibrary.find((item) => item.id === id))
          .filter(Boolean);

        state.unusedPoolIds = state.unusedPoolIds.slice(4);
        return chosenEntries;
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

      function getWordFontSizeClass(text, isSynonym = false) {
        const len = (text || '').length;
        if (len >= 15) return isSynonym ? 'text-xs sm:text-sm' : 'text-xs sm:text-sm';
        if (len >= 11) return isSynonym ? 'text-sm sm:text-base' : 'text-sm sm:text-base';
        return isSynonym ? 'text-base sm:text-lg' : 'text-base sm:text-lg';
      }

      function getBisonSkullCardBackHTML() {
        return `
          <div class="card-face card-back">
            <div class="relative w-full h-full flex flex-col items-center justify-center p-2">
              <div class="absolute top-2.5 left-2.5 w-2.5 h-2.5 border-t border-l border-[#D4AF37]"></div>
              <div class="absolute top-2.5 right-2.5 w-2.5 h-2.5 border-t border-r border-[#D4AF37]"></div>
              <div class="absolute bottom-2.5 left-2.5 w-2.5 h-2.5 border-b border-l border-[#D4AF37]"></div>
              <div class="absolute bottom-2.5 right-2.5 w-2.5 h-2.5 border-b border-r border-[#D4AF37]"></div>

              <svg viewBox="0 0 80 72" class="w-11 h-11 sm:w-12 sm:h-12 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                <circle cx="40" cy="37" r="24" fill="#1E0B06" stroke="#D4AF37" stroke-width="1.5" stroke-dasharray="3 2"/>
                <path d="M14 25 C6 15, 14 5, 22 14 C25 18, 25 24, 25 24 L55 24 C55 24, 55 18, 58 14 C66 5, 74 15, 66 25 C60 31, 53 30, 53 30 L27 30 C27 30, 20 31, 14 25 Z" fill="#D4AF37" stroke="#1E110A" stroke-width="1.6"/>
                <path d="M26 22 L54 22 L50 44 L44 60 L36 60 L30 44 Z" fill="#F6EBD8" stroke="#1E110A" stroke-width="1.8"/>
                <polygon points="40,26 43,31 40,36 37,31" fill="#9E2A2B"/>
                <circle cx="32" cy="37" r="3.6" fill="#1E110A"/>
                <circle cx="48" cy="37" r="3.6" fill="#1E110A"/>
                <polygon points="40,44 36.5,53 43.5,53" fill="#1E110A"/>
              </svg>
              <span class="mt-0.5 font-western text-[8px] tracking-widest text-[#D4AF37] uppercase">MATCHED</span>
            </div>
          </div>
        `;
      }

      function renderHands(withDealAnimation = false) {
        dom.opponentGrid.innerHTML = state.opponentHand
          .map((card, idx) => {
            const wordSize = getWordFontSizeClass(card.word, false);
            const isFlipped = card.resolved && card.outcome === 'correct';
            const isActive =
              (state.gameState === GAME_STATES.PLAYING || state.gameState === GAME_STATES.RESOLVING) &&
              idx === state.activeOpponentIndex &&
              !card.resolved;

            const stateClasses = [
              'playing-card opponent-card',
              withDealAnimation ? 'dealing-start' : '',
              isFlipped ? 'is-flipped' : '',
              isActive ? 'active-target' : ''
            ]
              .filter(Boolean)
              .join(' ');

            return `
              <div class="card-slot" data-opponent-slot="${idx}">
                <div id="oppCard_${idx}" class="${stateClasses}" data-vocab-id="${card.vocabId}">
                  <div class="card-face card-front">
                    <div class="card-corner top-left ${card.suit.colorClass}">
                      <span>${card.rank}</span>
                      <span>${card.suit.symbol}</span>
                    </div>

                    <div class="corner-ornament tr"></div>
                    <div class="corner-ornament bl"></div>

                    ${
                      isActive
                        ? `<div data-target-badge="true" class="absolute top-1.5 px-2 py-0.2 rounded-full bg-[#9E2A2B] border border-[#D4AF37] text-[8px] font-bold tracking-widest text-[#F6EBD8] uppercase shadow-sm">TARGET</div>`
                        : ''
                    }

                    <div class="card-word-text font-card-word ${wordSize}">${escapeHTML(card.word)}</div>
                    <div class="card-vi-text text-[11px] sm:text-xs">${escapeHTML(card.translation)}</div>

                    <div class="card-corner bottom-right ${card.suit.colorClass}">
                      <span>${card.rank}</span>
                      <span>${card.suit.symbol}</span>
                    </div>
                  </div>
                  ${getBisonSkullCardBackHTML()}
                </div>
              </div>
            `;
          })
          .join('');

        dom.studentGrid.innerHTML = state.studentHand
          .map((card, idx) => {
            const synSize = getWordFontSizeClass(card.synonym, true);
            const isFlipped = card.used && card.outcome === 'correct';
            const isSelectable = state.gameState === GAME_STATES.PLAYING && !card.used;

            const stateClasses = [
              'playing-card',
              withDealAnimation ? 'dealing-start' : '',
              isFlipped ? 'is-flipped' : '',
              isSelectable ? 'student-selectable' : 'cursor-default'
            ]
              .filter(Boolean)
              .join(' ');

            return `
              <div class="card-slot" data-student-slot="${idx}">
                <div id="stuCard_${idx}" class="${stateClasses}" data-student-index="${idx}" data-vocab-id="${card.vocabId}" role="button" tabindex="${isSelectable ? '0' : '-1'}" aria-disabled="${!isSelectable}">
                  <div class="card-face card-front">
                    <div class="card-corner top-left ${card.suit.colorClass}">
                      <span>${card.rank}</span>
                      <span>${card.suit.symbol}</span>
                    </div>

                    <div class="corner-ornament tr"></div>
                    <div class="corner-ornament bl"></div>

                    <div class="card-synonym-text ${synSize}">${escapeHTML(card.synonym)}</div>

                    <div class="card-corner bottom-right ${card.suit.colorClass}">
                      <span>${card.rank}</span>
                      <span>${card.suit.symbol}</span>
                    </div>
                  </div>
                  ${getBisonSkullCardBackHTML()}
                </div>
              </div>
            `;
          })
          .join('');

        const studentCardEls = dom.studentGrid.querySelectorAll('[data-student-index]');
        studentCardEls.forEach((el) => {
          el.addEventListener('click', () => {
            const idx = parseInt(el.getAttribute('data-student-index'), 10);
            handleStudentCardSelect(idx);
          });
        });
      }

      function renderChipStack(previousChips = state.chips) {
        dom.chipCountValue.textContent = String(state.chips);
        const slots = [];
        for (let i = 1; i <= 10; i++) {
          const isFilled = i <= state.chips;
          const wasFilled = i <= previousChips;
          let animClass = '';
          if (isFilled && !wasFilled) animClass = 'chip-gain-anim';
          if (!isFilled && wasFilled) animClass = 'chip-loss-anim';

          if (isFilled || (!isFilled && wasFilled)) {
            slots.push(`
              <div class="chip-token w-4 h-4 sm:w-4.5 sm:h-4.5 ${animClass}" title="Chip ${i}">
                <svg viewBox="0 0 28 28" class="w-full h-full">
                  <circle cx="14" cy="14" r="12" fill="${i === 10 ? '#D4AF37' : '#9E2A2B'}" stroke="#F3D060" stroke-width="2"/>
                  <circle cx="14" cy="14" r="9" fill="none" stroke="#F6EBD8" stroke-width="1.5" stroke-dasharray="3 2.5"/>
                  <circle cx="14" cy="14" r="4" fill="#1E110A"/>
                </svg>
              </div>
            `);
          } else {
            slots.push(`
              <div class="w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full border border-[#D4AF37]/25 bg-[#1B0E08]/60" title="Empty Chip Slot ${i}"></div>
            `);
          }
        }
        dom.chipStackContainer.innerHTML = slots.join('');
        updateReshuffleButtonState();
      }

      function updateHUD() {
        dom.roundCounterText.textContent = `ROUND ${state.round}`;
        const total = state.vocabLibrary.length;
        const usedInCycle = total - state.unusedPoolIds.length;
        const urlParams = new URLSearchParams(window.location.search);
        let urlMode = (urlParams.get("mode") || "full").trim().toLowerCase();
        if (!["full", "topic"].includes(urlMode)) {
          urlMode = "full";
        }
        const topicParam = (urlParams.get("topic") || "").trim();
        if (urlMode === "topic" && topicParam) {
          dom.deckProgressText.textContent = `${topicParam.toUpperCase()} (${Math.min(usedInCycle, total)}/${total})`;
        } else {
          dom.deckProgressText.textContent = `FULL DECK (${Math.min(usedInCycle, total)}/${total})`;
        }

        const currentCardNum = Math.min(state.activeOpponentIndex + 1, 4);
        dom.turnCounterBadge.textContent = `CARD ${currentCardNum} OF 4`;
        dom.roundMatchTracker.textContent = `${state.roundCorrectCount} / 4 MATCHED`;
        dom.cowboySpeech.textContent = '“Make your move.”';
        updateReshuffleButtonState();
      }

      function startNewRound() {
        if (state.gameState === GAME_STATES.VICTORY || state.gameState === GAME_STATES.DEFEAT) {
          return;
        }

        const fourEntries = selectFourRoundEntries();
        if (!fourEntries) {
          showTableStatus('INVALID VOCABULARY POOL - IMPORT VALID JSON');
          return;
        }

        state.gameState = GAME_STATES.DEALING;
        state.activeOpponentIndex = 0;
        state.roundCorrectCount = 0;
        state.roundIncorrectAttempts = 0;
        state.roundScored = false;

        const { opponentHand, studentHand } = buildHandsForRound(fourEntries);
        state.opponentHand = opponentHand;
        state.studentHand = studentHand;

        hideRoundResultToast();
        updateHUD();
        showTableStatus('DEALING NEW HAND...');
        dom.turnStatusSubtext.textContent = 'Shuffling the deck...';

        renderHands(true);
        sound.playCardShuffle();

        const dealOrder = [
          'oppCard_0',
          'stuCard_0',
          'oppCard_1',
          'stuCard_1',
          'oppCard_2',
          'stuCard_2',
          'oppCard_3',
          'stuCard_3'
        ];

        const baseDelay = 260;
        const stepDelay = 175;

        dealOrder.forEach((cardDomId, index) => {
          scheduleTimer(() => {
            const el = document.getElementById(cardDomId);
            if (!el) return;
            el.classList.remove('dealing-start');
            el.classList.add('dealing-animate');
            sound.playCardDeal();

            scheduleTimer(() => {
              sound.playCardPlace();
            }, 260);
          }, baseDelay + index * stepDelay);
        });

        const totalDealDuration = baseDelay + dealOrder.length * stepDelay + 280;

        scheduleTimer(() => {
          state.gameState = GAME_STATES.PLAYING;
          dom.turnStatusSubtext.textContent = 'Match the highlighted card';
          showTableStatus('TAP THE MATCHING SYNONYM');
          updateActiveCardStates();
        }, totalDealDuration);
      }

      function updateActiveCardStates() {
        state.opponentHand.forEach((card, idx) => {
          const el = document.getElementById(`oppCard_${idx}`);
          if (!el) return;
          const isActive =
            (state.gameState === GAME_STATES.PLAYING || state.gameState === GAME_STATES.RESOLVING) &&
            idx === state.activeOpponentIndex &&
            !card.resolved;
          el.classList.toggle('active-target', isActive);

          const front = el.querySelector('.card-front');
          const existingBadge = front.querySelector('[data-target-badge]');
          if (existingBadge) existingBadge.remove();
          if (isActive) {
            const badge = document.createElement('div');
            badge.setAttribute('data-target-badge', 'true');
            badge.className =
              'absolute top-1.5 px-2 py-0.2 rounded-full bg-[#9E2A2B] border border-[#D4AF37] text-[8px] font-bold tracking-widest text-[#F6EBD8] uppercase shadow-sm';
            badge.textContent = 'TARGET';
            front.appendChild(badge);
          }
        });

        state.studentHand.forEach((card, idx) => {
          const el = document.getElementById(`stuCard_${idx}`);
          if (!el) return;
          const isSelectable = state.gameState === GAME_STATES.PLAYING && !card.used;
          el.classList.toggle('student-selectable', isSelectable);
          el.setAttribute('aria-disabled', String(!isSelectable));
        });

        updateHUD();
      }

      function handleStudentCardSelect(studentIndex) {
        if (state.gameState !== GAME_STATES.PLAYING) return;

        const oppIndex = state.activeOpponentIndex;
        const oppCard = state.opponentHand[oppIndex];
        const stuCard = state.studentHand[studentIndex];

        if (!oppCard || !stuCard) return;
        if (oppCard.resolved || stuCard.used) return;

        state.gameState = GAME_STATES.RESOLVING;
        updateActiveCardStates();

        const oppEl = document.getElementById(`oppCard_${oppIndex}`);
        const stuEl = document.getElementById(`stuCard_${studentIndex}`);

        const isCorrect = oppCard.vocabId === stuCard.vocabId;

        if (isCorrect) {
          resolveCorrectTurn(oppIndex, studentIndex, oppEl, stuEl);
        } else {
          resolveIncorrectTurn(oppIndex, studentIndex, oppEl, stuEl);
        }
      }

      function resolveCorrectTurn(oppIndex, studentIndex, oppEl, stuEl) {
        const oppCard = state.opponentHand[oppIndex];
        const stuCard = state.studentHand[studentIndex];

        oppCard.resolved = true;
        oppCard.outcome = 'correct';
        stuCard.used = true;
        stuCard.outcome = 'correct';
        state.roundCorrectCount += 1;

        if (oppEl) {
          oppEl.classList.remove('active-target');
          oppEl.classList.add('correct-flash');
        }
        if (stuEl) {
          stuEl.classList.add('correct-flash');
        }

        sound.playCorrectMatch();
        showTableStatus('SHARP SHOOTING! MATCH CONFIRMED');
        dom.turnStatusSubtext.textContent = `${oppCard.word} = ${stuCard.synonym}`;
        updateHUD();

        scheduleTimer(() => {
          if (oppEl) {
            oppEl.classList.remove('correct-flash');
            oppEl.classList.add('is-flipped');
          }
          if (stuEl) {
            stuEl.classList.remove('correct-flash');
            stuEl.classList.add('is-flipped');
          }
          sound.playCardDeal(0.06, 1000);
        }, 280);

        scheduleTimer(() => {
          advanceToNextTurnOrCompleteRound();
        }, 820);
      }

      function resolveIncorrectTurn(oppIndex, studentIndex, oppEl, stuEl) {
        state.roundIncorrectAttempts += 1;
        const prevChips = state.chips;
        const newChips = Math.max(0, prevChips - 2);
        state.chips = newChips;

        renderChipStack(prevChips);
        sound.playChipLoss();

        if (stuEl) {
          stuEl.classList.add('wrong-flash');
        }

        sound.playGunshot();
        scheduleTimer(() => {
          sound.playBulletWhizz();
        }, 95);

        triggerScreenShake();
        showBriefTableBulletImpact();

        showTableStatus('MISFIRE! -2 CHIPS — TRY AGAIN');
        dom.turnStatusSubtext.textContent = 'Wrong card — try another synonym!';
        updateHUD();

        // Check if chip penalty resulted in immediate defeat (0 chips)
        if (state.chips <= 0) {
          scheduleTimer(() => {
            triggerTerminalEnding(false);
          }, 650);
          return;
        }

        // Return student card to selectable state for retry
        scheduleTimer(() => {
          if (stuEl) {
            stuEl.classList.remove('wrong-flash');
          }
          state.gameState = GAME_STATES.PLAYING;
          dom.turnStatusSubtext.textContent = 'Match the highlighted card';
          showTableStatus('SELECT MATCHING SYNONYM');
          updateActiveCardStates();
        }, 580);
      }

      function triggerScreenShake() {
        dom.gameFrame.classList.remove('screen-shake');
        void dom.gameFrame.offsetWidth;
        dom.gameFrame.classList.add('screen-shake');
      }

      function showBriefTableBulletImpact() {
        dom.wrongShotOverlay.innerHTML = createBulletHoleSVG(50, 52, 1.1);
        dom.wrongShotOverlay.classList.remove('hidden');
        dom.wrongShotOverlay.classList.add('flex');
        scheduleTimer(() => {
          dom.wrongShotOverlay.classList.add('hidden');
          dom.wrongShotOverlay.classList.remove('flex');
          dom.wrongShotOverlay.innerHTML = '';
        }, 620);
      }

      function advanceToNextTurnOrCompleteRound() {
        const nextIndex = state.opponentHand.findIndex((c) => !c.resolved);
        if (nextIndex !== -1) {
          state.activeOpponentIndex = nextIndex;
          state.gameState = GAME_STATES.PLAYING;
          dom.turnStatusSubtext.textContent = 'Match the highlighted card';
          showTableStatus('SELECT MATCHING SYNONYM');
          updateActiveCardStates();
        } else {
          completeCurrentRound();
        }
      }

      function completeCurrentRound() {
        if (state.roundScored) return;
        state.roundScored = true;
        state.gameState = GAME_STATES.ROUND_COMPLETE;

        const prevChips = state.chips;
        const newChips = Math.min(10, prevChips + 1);
        state.chips = newChips;

        renderChipStack(prevChips);
        sound.playChipGain();
        showRoundResultToast('ROUND BONUS: +1 CHIP', 'All 4 pairs correctly matched!', true);
        showTableStatus('ROUND BONUS: +1 CHIP');

        if (state.chips >= 10) {
          scheduleTimer(() => {
            triggerTerminalEnding(true);
          }, 950);
          return;
        }

        scheduleTimer(() => {
          state.round += 1;
          startNewRound();
        }, 1650);
      }

      let isReshuffling = false;

      function updateReshuffleButtonState() {
        if (!dom.reshuffleBtn) return;
        const canReshuffle = state.chips >= 2 && state.gameState === GAME_STATES.PLAYING && !isReshuffling;
        dom.reshuffleBtn.disabled = !canReshuffle;
        if (canReshuffle) {
          dom.reshuffleBtn.classList.remove('disabled');
        } else {
          dom.reshuffleBtn.classList.add('disabled');
        }
      }

      function reshuffleDeck() {
        if (isReshuffling) return;
        if (state.gameState !== GAME_STATES.PLAYING) {
          showTableStatus('CAN ONLY RESHUFFLE DURING ACTIVE PLAY');
          return;
        }

        if (state.chips < 2) {
          showTableStatus('INSUFFICIENT CHIPS (NEED 2 CHIPS TO RESHUFFLE)');
          dom.turnStatusSubtext.textContent = 'You have ' + state.chips + ' chip(s), but reshuffle costs 2 chips.';
          sound.playBulletWhizz?.();
          return;
        }

        // Deduct exactly 2 chips immediately
        isReshuffling = true;
        state.gameState = GAME_STATES.DEALING;
        const prevChips = state.chips;
        state.chips = Math.max(0, state.chips - 2);
        renderChipStack(prevChips);
        sound.playChipLoss();
        updateReshuffleButtonState();

        showTableStatus('RESHUFFLING DECK (-2 CHIPS)...');
        dom.turnStatusSubtext.textContent = 'Randomizing remaining cards...';

        // Find unresolved opponent cards
        const unresolvedOpponentIndices = [];
        state.opponentHand.forEach((card, idx) => {
          if (!card.resolved) {
            unresolvedOpponentIndices.push(idx);
          }
        });

        if (unresolvedOpponentIndices.length === 0) {
          isReshuffling = false;
          state.gameState = GAME_STATES.PLAYING;
          updateReshuffleButtonState();
          return;
        }

        // Return unresolved cards back to unused pool
        unresolvedOpponentIndices.forEach(idx => {
          const vocabId = state.opponentHand[idx].vocabId;
          if (vocabId && !state.unusedPoolIds.includes(vocabId)) {
            state.unusedPoolIds.push(vocabId);
          }
        });

        // Exclude cards already resolved in this round
        const resolvedVocabIds = new Set(
          state.opponentHand.filter(c => c.resolved).map(c => c.vocabId)
        );

        let eligiblePool = state.unusedPoolIds.filter(id => !resolvedVocabIds.has(id));
        if (eligiblePool.length < unresolvedOpponentIndices.length) {
          const allLibIds = state.vocabLibrary.map(e => e.id).filter(id => !resolvedVocabIds.has(id));
          eligiblePool = shuffleArray(allLibIds);
        } else {
          eligiblePool = shuffleArray(eligiblePool);
        }

        const chosenIds = eligiblePool.slice(0, unresolvedOpponentIndices.length);
        state.unusedPoolIds = eligiblePool.slice(unresolvedOpponentIndices.length);

        const newEntries = chosenIds.map(id => state.vocabLibrary.find(e => e.id === id)).filter(Boolean);
        const decorativeFaces = generateDecorativeCardFaces(8);

        unresolvedOpponentIndices.forEach((oppIdx, i) => {
          const entry = newEntries[i];
          if (!entry) return;
          state.opponentHand[oppIdx] = {
            slotIndex: oppIdx,
            vocabId: entry.id,
            word: entry.word,
            translation: entry.translation,
            rank: decorativeFaces[i].rank,
            suit: decorativeFaces[i].suit,
            resolved: false,
            outcome: null
          };
        });

        // Find matching unused student cards
        const unusedStudentIndices = [];
        state.studentHand.forEach((card, idx) => {
          if (!card.used) {
            unusedStudentIndices.push(idx);
          }
        });

        const shuffledStudentEntries = shuffleArray(newEntries);
        unusedStudentIndices.forEach((stuIdx, i) => {
          const entry = shuffledStudentEntries[i] || newEntries[i];
          if (!entry) return;
          state.studentHand[stuIdx] = {
            slotIndex: stuIdx,
            vocabId: entry.id,
            synonym: entry.synonym,
            rank: decorativeFaces[i + 4].rank,
            suit: decorativeFaces[i + 4].suit,
            used: false,
            outcome: null
          };
        });

        state.activeOpponentIndex = state.opponentHand.findIndex(c => !c.resolved);

        sound.playCardShuffle();
        renderHands(true);

        const dealOrder = [];
        unresolvedOpponentIndices.forEach(idx => dealOrder.push(`oppCard_${idx}`));
        unusedStudentIndices.forEach(idx => dealOrder.push(`stuCard_${idx}`));

        const baseDelay = 180;
        const stepDelay = 110;
        dealOrder.forEach((domId, idx) => {
          scheduleTimer(() => {
            const el = document.getElementById(domId);
            if (!el) return;
            el.classList.remove('dealing-start');
            el.classList.add('dealing-animate');
            sound.playCardDeal();
          }, baseDelay + idx * stepDelay);
        });

        const totalDuration = baseDelay + dealOrder.length * stepDelay + 240;
        scheduleTimer(() => {
          isReshuffling = false;
          state.gameState = GAME_STATES.PLAYING;
          dom.turnStatusSubtext.textContent = 'Match the highlighted card';
          showTableStatus('TAP THE MATCHING SYNONYM');
          updateActiveCardStates();
          updateHUD();
          updateReshuffleButtonState();
        }, totalDuration);
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

      function createBulletHoleSVG(leftPct, topPct, scale = 1) {
        return `
          <div style="position:absolute; left:${leftPct}%; top:${topPct}%; transform:translate(-50%,-50%) scale(${scale});" class="w-16 h-16 pointer-events-none">
            <svg viewBox="0 0 80 80" class="w-full h-full drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
              <path d="M40 40 L12 18 M40 40 L68 15 M40 40 L74 44 M40 40 L62 70 M40 40 L25 72 M40 40 L8 48 M40 40 L38 8" stroke="#D4AF37" stroke-width="1.4" opacity="0.75"/>
              <path d="M40 40 L22 10 M40 40 L55 12 M40 40 L68 58 M40 40 L15 62" stroke="#F6EBD8" stroke-width="1" opacity="0.5"/>
              <circle cx="40" cy="40" r="14" fill="#2A160B" stroke="#9A7B2C" stroke-width="2"/>
              <polygon points="40,27 47,30 52,37 50,45 44,52 36,52 29,46 28,37 33,30" fill="#0B0503" stroke="#E8D5B5" stroke-width="1.2"/>
              <circle cx="40" cy="40" r="6" fill="#000000"/>
            </svg>
          </div>
        `;
      }

      function triggerTerminalEnding(isVictory) {
        clearAllScheduledTimers();
        state.gameState = isVictory ? GAME_STATES.VICTORY : GAME_STATES.DEFEAT;
        hideRoundResultToast();

        const holesPositions = [
          { x: 22, y: 20, s: 1.05 },
          { x: 78, y: 26, s: 0.92 },
          { x: 18, y: 74, s: 0.88 },
          { x: 81, y: 78, s: 1.1 }
        ];
        dom.endingBulletHoles.innerHTML = '';

        if (isVictory) {
          dom.endingBadge.textContent = '10 CHIPS REACHED · FINAL SHOWDOWN';
          dom.endingExactMessage.textContent = '“you won? but at what cost?”';
        } else {
          dom.endingBadge.textContent = 'OUT OF CHIPS · BUSTED';
          dom.endingExactMessage.textContent = '“Reckon you need a bit more practice, partner.”';
        }

        dom.endingStatsSummary.textContent = `Final Chips: ${state.chips} · Rounds Completed: ${state.round}`;

        dom.endingOverlay.classList.remove('hidden');
        dom.endingOverlay.classList.add('flex');
        triggerScreenShake();

        sound.playGunshot();
        dom.endingBulletHoles.insertAdjacentHTML(
          'beforeend',
          createBulletHoleSVG(holesPositions[0].x, holesPositions[0].y, holesPositions[0].s)
        );
        dom.endingBulletHoles.insertAdjacentHTML(
          'beforeend',
          createBulletHoleSVG(holesPositions[1].x, holesPositions[1].y, holesPositions[1].s)
        );

        scheduleTimer(() => {
          sound.playBulletWhizz();
          dom.endingBulletHoles.insertAdjacentHTML(
            'beforeend',
            createBulletHoleSVG(holesPositions[2].x, holesPositions[2].y, holesPositions[2].s)
          );
          dom.endingBulletHoles.insertAdjacentHTML(
            'beforeend',
            createBulletHoleSVG(holesPositions[3].x, holesPositions[3].y, holesPositions[3].s)
          );
        }, 160);

        scheduleTimer(() => {
          dom.endingCardBox.classList.remove('opacity-0', 'translate-y-4');
          dom.endingCardBox.classList.add('opacity-100', 'translate-y-0');
          sound.playCowboyGuitarEnding(isVictory);
        }, 460);
      }

      function restartGame() {
        clearAllScheduledTimers();

        if (state.pendingVocabLibrary) {
          state.vocabLibrary = state.pendingVocabLibrary;
          state.pendingVocabLibrary = null;
        }

        // Leave terminal state before starting a new round; startNewRound()
        // intentionally refuses to deal while VICTORY/DEFEAT is active.
        state.gameState = GAME_STATES.READY;
        state.chips = 5;
        state.round = 1;
        state.activeOpponentIndex = 0;
        state.roundCorrectCount = 0;
        state.roundIncorrectAttempts = 0;
        state.roundScored = false;
        state.opponentHand = [];
        state.studentHand = [];
        state.unusedPoolIds = shuffleArray(state.vocabLibrary.map((e) => e.id));

        dom.endingOverlay.classList.add('hidden');
        dom.endingOverlay.classList.remove('flex');
        dom.endingCardBox.classList.add('opacity-0', 'translate-y-4');
        dom.endingCardBox.classList.remove('opacity-100', 'translate-y-0');
        dom.endingBulletHoles.innerHTML = '';
        dom.wrongShotOverlay.innerHTML = '';
        dom.wrongShotOverlay.classList.add('hidden');
        dom.wrongShotOverlay.classList.remove('flex');
        dom.gameFrame.classList.remove('screen-shake');

        hideRoundResultToast();
        renderChipStack(5);
        startNewRound();
      }

      function toggleSound() {
        state.soundEnabled = !state.soundEnabled;
        dom.soundOnIcon.classList.toggle('hidden', !state.soundEnabled);
        dom.soundOffIcon.classList.toggle('hidden', state.soundEnabled);

        if (!state.soundEnabled && sound.ctx && sound.ctx.state === 'running') {
          sound.ctx.suspend().catch(() => {});
        } else if (state.soundEnabled) {
          sound.ensureContext();
          sound.playCardPlace();
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
        let username = (urlParams.get("user") || "").trim();
        if (!username) {
          try {
            const profile = sessionStorage.getItem("ls_active_profile");
            username = (profile ?? (localStorage.getItem("vocab_user") || localStorage.getItem("username") || "")).trim();
          } catch (_) {}
        }

        async function fetchFromIDB() {
          return new Promise((resolve) => {
            try {
              if (!username) return resolve({ words: [] });
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
                const getReq = exactProfile && store.indexNames.contains("username")
                  ? store.index("username").getAll(username) : store.getAll();
                getReq.onerror = () => resolve({ words: [], error: "Failed to read words from store" });
                getReq.onsuccess = () => {
                  const expected = exactProfile ? username : username.toLowerCase();
                  const words = (getReq.result || []).filter(word => {
                    const owner = typeof word?.username === "string" ? word.username.trim() : "";
                    return word?.deleted !== true && (exactProfile ? owner : owner.toLowerCase()) === expected;
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
          const idbResult = await fetchFromIDB();
          let rawWords = idbResult.words || [];

          // Apply vocabulary mode rules:
          if (urlMode === "topic") {
            if (!selectedTopic) {
              showTableStatus("NO TOPIC SELECTED IN ARCADEHUB");
              dom.turnStatusSubtext.textContent = "Please return to Arcadehub and choose a topic.";
              return false;
            }
            const topicKey = selectedTopic.toLowerCase();
            const topicFiltered = rawWords.filter(word => {
              const topics = [word.topic, ...(Array.isArray(word.topics) ? word.topics : [])];
              return topics.some(topic => typeof topic === "string" && topic.trim().toLowerCase() === topicKey);
            });
            if (topicFiltered.length === 0) {
              showTableStatus(`TOPIC "${selectedTopic.toUpperCase()}" HAS NO WORDS`);
              dom.turnStatusSubtext.textContent = "Please add words in Lexical Space or choose another topic in Arcadehub.";
              return false;
            }
            rawWords = topicFiltered;
          }
          // "full" mode uses all eligible words from student's vocabulary library across all topics

          if (rawWords.length === 0) {
            showTableStatus("NO LOCAL VOCABULARY IN INDEXEDDB");
            dom.turnStatusSubtext.textContent = `No words found in LexicalSpaceDB for "${username || 'student'}". Running in Demo Mode (Saloon Starter Deck).`;
            return false;
          }

          // Filter mastered first, fallback to all if < 4
          let eligible = rawWords.filter(w => w.memoryStatus === "mastered");
          if (eligible.length < 4) eligible = rawWords;

          // Convert to Poker schema
          const converted = eligible.map(w => {
            const word = (w.word || "").trim();
            const translation = (w.meaning || w.translation || "").trim();
            const syn = (w.synonym1 || w.synonym || w.synonym2 || (Array.isArray(w.synonyms) ? w.synonyms[0] : "") || "").trim();
            return { word, translation, synonym: syn };
          }).filter(w => w.word && w.translation && w.synonym && w.word.toLowerCase() !== w.synonym.toLowerCase());

          // Deduplicate
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
            const validation = validateAndNormalizeVocabulary(unique);
            if (validation.valid) {
              state.vocabLibrary = validation.entries;
              state.pendingVocabLibrary = null;
              state.unusedPoolIds = shuffleArray(state.vocabLibrary.map(e => e.id));
              showTableStatus("STUDENT VOCABULARY LOADED");
              dom.turnStatusSubtext.textContent = `Loaded ${unique.length} words from local IndexedDB (LexicalSpaceDB)!`;
              return true;
            }
          }

          showTableStatus("INSUFFICIENT LOCAL VOCABULARY");
          dom.turnStatusSubtext.textContent = `Found only ${unique.length} valid pair(s). Poker requires at least 4 pairs. Running in Demo Mode.`;
          return false;
        } catch (err) {
          showTableStatus("INDEXEDDB READ ERROR");
          dom.turnStatusSubtext.textContent = `Error reading local database: ${err.message || 'Unknown'}. Running in Demo Mode.`;
          return false;
        }
      }

      async function initGame() {
        const urlParams = new URLSearchParams(window.location.search);
        const defaultReturn = window.location.hostname.endsWith("github.io")
          ? "https://vuongtranvt1331-design.github.io/Arcadehub/"
          : "arcade.html";
        const returnUrl = window.SpaceSuite ? SpaceSuite.safeReturn(urlParams.get("returnUrl"), "arcade") : urlParams.get("returnUrl") || defaultReturn;
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

        renderChipStack(5);
        updateReshuffleButtonState();
        startNewRound();
      }

      window.addEventListener('DOMContentLoaded', initGame);
    })();
  