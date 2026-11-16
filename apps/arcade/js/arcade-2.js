
    (function () {
      'use strict';

      // =========================================================================
      // 1. 8-BIT RETRO SOUND SYNTHESIZER (Pure Web Audio API)
      // =========================================================================
      class RetroAudioEngine {
        constructor() {
          this.ctx = null;
          this.muted = false;
        }

        init() {
          if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
          }
          if (this.ctx && this.ctx.state === "suspended") {
            this.ctx.resume();
          }
        }

        toggleMute() {
          this.muted = !this.muted;
          return this.muted;
        }

        playCoin() {
          if (this.muted) return;
          this.init();
          if (!this.ctx) return;

          const notes = [523.25, 659.25, 783.99, 1046.5];
          notes.forEach((freq, i) => {
            const start = this.ctx.currentTime + i * 0.055;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "square";
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.08, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(start);
            osc.stop(start + 0.15);
          });
        }

        playBlip() {
          if (this.muted) return;
          this.init();
          if (!this.ctx) return;

          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(480, now);
          osc.frequency.exponentialRampToValueAtTime(960, now + 0.05);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.07);
        }

        // Tactile Mechanical Keyboard / Gamepad Switch Sound
        playKeyClick() {
          if (this.muted) return;
          this.init();
          if (!this.ctx) return;
          const now = this.ctx.currentTime;
          const jitter = 0.92 + Math.random() * 0.16; // Subtle organic pitch variation

          // 1. Sharp microswitch transient snap (click)
          const clickOsc = this.ctx.createOscillator();
          const clickGain = this.ctx.createGain();
          clickOsc.type = "triangle";
          clickOsc.frequency.setValueAtTime(1200 * jitter, now);
          clickOsc.frequency.exponentialRampToValueAtTime(140 * jitter, now + 0.022);
          clickGain.gain.setValueAtTime(0.22, now);
          clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.024);
          clickOsc.connect(clickGain);
          clickGain.connect(this.ctx.destination);
          clickOsc.start(now);
          clickOsc.stop(now + 0.026);

          // 2. Plastic bottom-out resonant thump (gamepad button feel)
          const thudOsc = this.ctx.createOscillator();
          const thudGain = this.ctx.createGain();
          thudOsc.type = "sine";
          thudOsc.frequency.setValueAtTime(180 * jitter, now);
          thudOsc.frequency.exponentialRampToValueAtTime(45 * jitter, now + 0.035);
          thudGain.gain.setValueAtTime(0.16, now);
          thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
          thudOsc.connect(thudGain);
          thudGain.connect(this.ctx.destination);
          thudOsc.start(now);
          thudOsc.stop(now + 0.04);
        }

        playTypewriterTick() {
          this.playKeyClick();
        }

        playStartSound() {
          if (this.muted) return;
          try {
            const fileAudio = new Audio('assets/as-start.mp3');
            fileAudio.play().catch(() => {
              const wavAudio = new Audio('assets/as-start.wav');
              wavAudio.play().catch(() => {});
            });
          } catch (_) {}

          this.init();
          if (!this.ctx) return;
          const now = this.ctx.currentTime;

          // 1. Mechanical arcade microswitch click (0.0 to 0.09s)
          const clickOsc = this.ctx.createOscillator();
          const clickGain = this.ctx.createGain();
          clickOsc.type = "triangle";
          clickOsc.frequency.setValueAtTime(200, now);
          clickOsc.frequency.exponentialRampToValueAtTime(25, now + 0.08);
          clickGain.gain.setValueAtTime(0.32, now);
          clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          clickOsc.connect(clickGain);
          clickGain.connect(this.ctx.destination);
          clickOsc.start(now);
          clickOsc.stop(now + 0.09);

          // 2. 8-Bit Laser "Pew-Pew" Sweep (0.07s to 0.55s)
          const laserTime = now + 0.07;
          const laserOsc = this.ctx.createOscillator();
          const laserGain = this.ctx.createGain();
          laserOsc.type = "square";
          laserOsc.frequency.setValueAtTime(2400, laserTime);
          laserOsc.frequency.exponentialRampToValueAtTime(160, laserTime + 0.45);
          laserGain.gain.setValueAtTime(0.2, laserTime);
          laserGain.gain.exponentialRampToValueAtTime(0.001, laserTime + 0.48);
          laserOsc.connect(laserGain);
          laserGain.connect(this.ctx.destination);
          laserOsc.start(laserTime);
          laserOsc.stop(laserTime + 0.49);

          // 3. Second Laser & Power-Up Arpeggio Chime (0.50s to 2.0s)
          const arpTime = now + 0.50;
          const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
          notes.forEach((freq, idx) => {
            const t = arpTime + idx * 0.11;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "square";
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.12, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.36);
          });
        }

        playCartridgeSnap() {
          if (this.muted) return;
          this.init();
          if (!this.ctx) return;
          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(140, now);
          osc.frequency.exponentialRampToValueAtTime(35, now + 0.1);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.11);

          setTimeout(() => {
            if (!this.ctx || this.muted) return;
            const t = this.ctx.currentTime;
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = "square";
            osc2.frequency.setValueAtTime(1046.5, t);
            osc2.frequency.setValueAtTime(2093, t + 0.05);
            gain2.gain.setValueAtTime(0.1, t);
            gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc2.connect(gain2);
            gain2.connect(this.ctx.destination);
            osc2.start(t);
            osc2.stop(t + 0.13);
          }, 60);
        }
      }

      const audio = new RetroAudioEngine();

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

      function getBestDuelScore(username) {
        const u = username ? username.toLowerCase() : "guest";
        try {
          const val = parseInt(
            localStorage.getItem("quickDrawn_bestScore_" + u) ||
            localStorage.getItem("ls_qd_best_" + u),
            10
          );
          return Number.isFinite(val) && val > 0 ? val : null;
        } catch (_) {
          return null;
        }
      }

      // =========================================================================
      // 3. MOBILE INITIALIZATION & TOUCH EVENTS
      // =========================================================================
      window.addEventListener("DOMContentLoaded", async () => {
        const profile = window.lexicalVocabulary?.activeProfile() || "";
        const activeUser = profile || "Guest Cowboy";
        const domName = document.getElementById("playerName");
        const domAvatar = document.getElementById("playerAvatar");
        const domWordCount = document.getElementById("playerWordCount");
        const domBestDuel = document.getElementById("statBestDuel");
        const btnSoundToggle = document.getElementById("btnSoundToggle");
        const soundIcon = document.getElementById("soundIcon");
        const vocabModeSelect = document.getElementById("arcadeVocabModeSelect");
        const vocabModeBadge = document.getElementById("vocabModeBadge");
        const topicWrapper = document.getElementById("arcadeTopicWrapper");
        const topicSelect = document.getElementById("arcadeTopicSelect");
        const topicWordBadge = document.getElementById("topicWordCountBadge");
        const modeWarningMsg = document.getElementById("modeWarningMsg");
        const btnQD = document.getElementById("btnPlayQuickDrawn");
        const btnPK = document.getElementById("btnPlayPoker");
        const btnAS = document.getElementById("btnPlayAirStrike");

        // Set student info
        domName.textContent = activeUser;
        domAvatar.textContent = (activeUser.charAt(0) || "G").toUpperCase();

        // Best Duel Score
        const bestScore = getBestDuelScore(activeUser);
        if (domBestDuel) {
          domBestDuel.textContent = bestScore ? `Personal Best: ${bestScore.toLocaleString()}` : "Personal Best: --";
        }

        // Query words and topics dynamically from LexicalSpaceDB
        const wordData = await queryIndexedDBWordData(profile);
        domWordCount.textContent = wordData.totalCount > 0 ? String(wordData.totalCount) : "24+";

        // Restore saved mode & topic preferences
        const urlParams = new URLSearchParams(window.location.search);
        let selectedMode = (urlParams.get("mode") || sessionStorage.getItem("arcade_vocab_mode") || "full").trim().toLowerCase();
        if (!["full", "topic"].includes(selectedMode)) {
          selectedMode = "full";
          sessionStorage.setItem("arcade_vocab_mode", "full");
        }
        if (vocabModeSelect) {
          vocabModeSelect.value = selectedMode;
        }

        let selectedTopic = (urlParams.get("topic") || sessionStorage.getItem("arcade_selected_topic") || "").trim();

        // Populate topic dropdown
        if (topicSelect) {
          topicSelect.innerHTML = `<option value="">⚡ Select a Topic...</option>`;
          wordData.sortedTopics.forEach(t => {
            const count = wordData.topicMap.get(t) || 0;
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = `${t} (${count} words)`;
            topicSelect.appendChild(opt);
          });

          if (selectedTopic && wordData.sortedTopics.some(t => t.toLowerCase() === selectedTopic.toLowerCase())) {
            topicSelect.value = selectedTopic;
          } else {
            selectedTopic = "";
            topicSelect.value = "";
          }
        }

        function updateGameLinks(mode, topic) {
          const userParam = profile ? `user=${encodeURIComponent(profile)}` : "";
          const modeParam = `mode=${encodeURIComponent(mode)}`;
          const topicParam = (mode === "topic" && topic) ? `topic=${encodeURIComponent(topic)}` : "";
          const returnUrlParam = `returnUrl=${encodeURIComponent(window.location.href)}`;

          const queryParts = [userParam, modeParam, topicParam, returnUrlParam].filter(Boolean);
          const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";

          // Authoritative Production URLs
          const PROD_QUICK_DRAWN_URL = "https://vuongtranvt1331-design.github.io/QuickDrawn/";
          const PROD_POKER_URL = "https://vuongtranvt1331-design.github.io/Poker/";
          const PROD_AIR_STRIKE_URL = "https://vuongtranvt1331-design.github.io/Sky_Dominators/";

          // Automatically detect environment: GitHub Pages vs Local/File
          const isGitHubPages = window.location.hostname.endsWith("github.io");
          const qdUrl = window.SpaceSuite ? SpaceSuite.href("quick-drawn", {mode, topic}) : isGitHubPages
            ? `${PROD_QUICK_DRAWN_URL}${queryString}`
            : `fast_drawn_wilhelm_scream_instructions%20(1).html${queryString}`;
          const pkUrl = window.SpaceSuite ? SpaceSuite.href("poker", {mode, topic}) : isGitHubPages
            ? `${PROD_POKER_URL}${queryString}`
            : `wild_west_vocabulary_poker_fixed.html${queryString}`;
          const asUrl = window.SpaceSuite ? SpaceSuite.href("sky-dominators", {mode, topic}) : isGitHubPages
            ? `${PROD_AIR_STRIKE_URL}${queryString}`
            : `air_strike_arcade_game%20(1).html${queryString}`;

          if (btnQD) {
            btnQD.href = qdUrl;
          }
          if (btnPK) {
            btnPK.href = pkUrl;
          }
          if (btnAS) {
            btnAS.href = asUrl;
          }

          if (modeWarningMsg) {
            modeWarningMsg.style.display = "none";
          }

          if (mode === "full") {
            if (vocabModeBadge) {
              vocabModeBadge.textContent = "FULL VOCABULARY";
              vocabModeBadge.style.color = "var(--neon-yellow)";
              vocabModeBadge.style.borderColor = "var(--neon-yellow)";
            }
            if (topicWordBadge) topicWordBadge.textContent = `${wordData.totalCount || '24+'} WORDS`;
            if (topicWrapper) topicWrapper.style.opacity = "0.65";
          } else if (mode === "topic") {
            if (vocabModeBadge) {
              vocabModeBadge.textContent = "TOPIC";
              vocabModeBadge.style.color = "var(--neon-cyan)";
              vocabModeBadge.style.borderColor = "var(--neon-cyan)";
            }
            if (topicWrapper) topicWrapper.style.opacity = "1";
            if (topicWordBadge) {
              if (topic) {
                const count = wordData.topicMap.get(topic) || 0;
                topicWordBadge.textContent = `${count} WORDS`;
              } else {
                topicWordBadge.textContent = "SELECT TOPIC";
              }
            }
          }
        }

        // Initialize game links with current mode and topic
        updateGameLinks(selectedMode, selectedTopic);

        // Vocab mode change event
        vocabModeSelect?.addEventListener("change", () => {
          selectedMode = vocabModeSelect.value.trim().toLowerCase();
          if (!["full", "topic"].includes(selectedMode)) {
            selectedMode = "full";
          }
          sessionStorage.setItem("arcade_vocab_mode", selectedMode);
          updateGameLinks(selectedMode, selectedTopic);
          audio.playBlip();
        });

        // Topic select change event
        topicSelect?.addEventListener("change", () => {
          selectedTopic = topicSelect.value.trim();
          sessionStorage.setItem("arcade_selected_topic", selectedTopic);
          updateGameLinks(selectedMode, selectedTopic);
          audio.playBlip();
        });

        // Sound toggle
        btnSoundToggle.addEventListener("click", () => {
          const isMuted = audio.toggleMute();
          soundIcon.textContent = isMuted ? "🔇" : "🔊";
          if (!isMuted) audio.playBlip();
        });

        // Touch feedback on buttons & topic validation
        document.querySelectorAll(".mobile-btn-play").forEach(btn => {
          btn.addEventListener("click", (e) => {
            if (selectedMode === "topic" && !selectedTopic) {
              e.preventDefault();
              audio.playBlip();
              if (modeWarningMsg) {
                modeWarningMsg.style.display = "block";
                modeWarningMsg.textContent = "⚠️ Please select a vocabulary topic before starting in Topic mode!";
              }
              topicSelect?.focus();
              return;
            }
            audio.playCoin();
          });
        });

        // Configure return navigation to Lexical Space
        const PROD_LS_URL = "https://vuongtranvt1331-design.github.io/Lexical_Space/";
        const isGitHubPages = window.location.hostname.endsWith("github.io");
        const returnUrlParam = urlParams.get("returnUrl");
        const defaultLsUrl = isGitHubPages ? PROD_LS_URL : "index (1).html";
        const finalLsUrl = window.SpaceSuite ? SpaceSuite.href("lexical") : returnUrlParam || defaultLsUrl;

        const btnBackToLS = document.getElementById("btnBackToLS");
        if (btnBackToLS) {
          btnBackToLS.href = finalLsUrl;
          btnBackToLS.addEventListener("click", () => {
            audio.playBlip();
          });
        }

        // ArcadeSpace Retro Game Card Header Interaction
        const headerLogo = document.getElementById("headerLogoCard");
        if (headerLogo) {
          headerLogo.addEventListener("click", () => {
            /* The brand animation is silent; gameplay/button sound controls are unchanged. */
            headerLogo.style.transform = "scale(1.12)";
            setTimeout(() => {
              headerLogo.style.transform = "";
            }, 300 / 0.7);
          });
        }

        // 8-Bit Cartridge Bay Insert Interaction
        const btnCartridge = document.getElementById("btnInsertCartridge");
        if (btnCartridge) {
          btnCartridge.addEventListener("click", () => {
            audio.playCartridgeSnap();
            btnCartridge.innerHTML = "<span>💾</span> CARTRIDGE INSERTED! [READY]";
            btnCartridge.style.borderColor = "var(--neon-green)";
            btnCartridge.style.color = "var(--neon-green)";
            btnCartridge.style.boxShadow = "0 0 16px rgba(0, 255, 136, 0.4)";
            setTimeout(() => {
              btnCartridge.innerHTML = "<span>📼</span> PUT IN CARTRIDGE / PLUG CHIP";
              btnCartridge.style.borderColor = "";
              btnCartridge.style.color = "";
              btnCartridge.style.boxShadow = "";
            }, 2400);
          });
        }
        window.SpaceSuite?.ready();
      });
    })();
  