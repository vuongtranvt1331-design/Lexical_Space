const state = {
      db: null,
      activeUsername: "",
      vocabMode: "full",
      eligibleWords: [],      // Strictly filtered mastered words for activeUsername
      questionBank: [],       // Pre-validated 4-option questions for the current run
      currentRunQuestions: [],
      questionNumber: 0,      // 1-indexed during active run
      score: 0,
      hasCelebrated25: false,
      hasTriggeredFlowState: false, // Guard against re-triggering Flow State notification
      missedTries: 0,         // Missed tries counter (loses after 3 misses)
      isTerminalLoss: false,  // Terminal loss state guard against re-entry
      attemptedCount: 0,
      correctCount: 0,
      timeLimitSec: 10,
      questionStartTime: 0,
      rafId: null,
      isQuestionLocked: true,
      isRunActive: false,
      currentTargetWord: "",
      lastTickSecond: 0
    };

    // Each actor owns one image and one canvas. The duel only coordinates their states.
    const playerAnimator = new CowboyAnimator(document.getElementById("playerCanvas"), true);
    const enemyAnimator = new CowboyAnimator(document.getElementById("enemyCanvas"), false);
    const duelAnimator = new SpriteAnimator(document.getElementById("duelStage"), playerAnimator, enemyAnimator);
    duelAnimator.readyPromise = Promise.allSettled([
      playerAnimator.load("./assets/images/player_spritesheet.png?v=independent-sprites-v4")
        .then(() => playerAnimator.start()),
      enemyAnimator.load("./assets/images/enemy_spritesheet.png?v=independent-sprites-v4")
        .then(() => enemyAnimator.start())
    ]).then(results => {
      if (results.some(result => result.status === "rejected")) {
        document.getElementById("duelStage").setAttribute("aria-label",
          "Some cowboy artwork could not load. The vocabulary duel is still playable.");
      }
      return duelAnimator;
    });
    const dom = {
      hudScore: document.getElementById("hudScore"),
      hudUsername: document.getElementById("hudUsername"),
      hudTimerBadge: document.getElementById("hudTimerBadge"),
      hudTimerText: document.getElementById("hudTimerText"),
      hudMisses: document.getElementById("hudMisses"),
      btnAudioToggle: document.getElementById("btnAudioToggle"),
      svgSpeakerOn: document.getElementById("svgSpeakerOn"),
      svgSpeakerOff: document.getElementById("svgSpeakerOff"),
      feedbackBanner: document.getElementById("feedbackBanner"),
      flowStateBanner: document.getElementById("flowStateNotification"),
      duelStage: document.getElementById("duelStage"),
      fuseFill: document.getElementById("fuseFill"),
      fuseSpark: document.getElementById("fuseSpark"),
      targetWordCard: document.getElementById("targetWordCard"),
      targetWordText: document.getElementById("targetWordText"),
      targetMeaningText: document.getElementById("targetMeaningText"),
      btnWordSpeaker: document.getElementById("btnWordSpeaker"),
      answersGrid: document.getElementById("answersGrid"),
      answerButtons: Array.from(document.querySelectorAll(".answer-btn")),

      // Screens
      titleScreen: document.getElementById("titleScreen"),
      resultScreen: document.getElementById("resultScreen"),
      celebrationScreen: document.getElementById("celebrationScreen"),
      btnDismissCelebration: document.getElementById("btnDismissCelebration"),
      celebrationScoreVal: document.getElementById("celebrationScoreVal"),

      // Title controls
      usernameInput: document.getElementById("usernameInput"),
      vocabStatusBox: document.getElementById("vocabStatusBox"),
      deckBadge: document.getElementById("deckBadge"),
      quickUserPills: document.getElementById("quickUserPills"),
      btnLoadVocab: document.getElementById("btnLoadVocab"),
      btnStartGame: document.getElementById("btnStartGame"),


      // Result controls
      resultTitleBadge: document.getElementById("resultTitleBadge"),
      resultSubtitle: document.getElementById("resultSubtitle"),
      statFinalScore: document.getElementById("statFinalScore"),
      statBestScore: document.getElementById("statBestScore"),
      statMisses: document.getElementById("statMisses"),
      statAttempted: document.getElementById("statAttempted"),
      statCorrect: document.getElementById("statCorrect"),
      statAccuracy: document.getElementById("statAccuracy"),
      resultDetailBox: document.getElementById("resultDetailBox"),
      btnPlayAgain: document.getElementById("btnPlayAgain"),
      btnReturnTitle: document.getElementById("btnReturnTitle")
    };


    function updateLifeSeals(misses) {
      const seals = document.getElementById("lifeSeals");
      if (!seals) return;
      seals.setAttribute("aria-label", `${Math.max(0, 3 - misses)} sinh mệnh còn lại`);
      seals.querySelectorAll(".seal").forEach((seal, index) => {
        seal.classList.toggle("broken", index >= 3 - misses);
      });
      if (misses > 0) {
        dom.duelStage.classList.remove("life-hit");
        void dom.duelStage.offsetWidth;
        dom.duelStage.classList.add("life-hit");
      }
    }

    /*************************************************************************
     * 4. USERNAME RESOLUTION & LOCAL-FIRST REPOSITORY
     *************************************************************************/
    function getBestScore(username) {
      if (!username) return 0;
      try {
        const val = parseInt(localStorage.getItem(LOCAL_KEYS.BEST_SCORE_PREFIX + username.toLowerCase()), 10);
        return Number.isFinite(val) && val > 0 ? val : 0;
      } catch (_) {
        return 0;
      }
    }

    function saveBestScore(username, score) {
      if (!username) return 0;
      const currentBest = getBestScore(username);
      const nextBest = Math.max(currentBest, score);
      try {
        localStorage.setItem(LOCAL_KEYS.BEST_SCORE_PREFIX + username.toLowerCase(), String(nextBest));
      } catch (_) {}
      return nextBest;
    }

    /*************************************************************************
     * 5. WESTERN STARTER DECK & VOCABULARY ENGINE
     *************************************************************************/
    const DEFAULT_DUEL_DECK = [
      { word: "substantial", meaning: "đáng kể", synonyms: ["considerable", "significant"] },
      { word: "allocate", meaning: "phân bổ", synonyms: ["assign", "distribute"] },
      { word: "sustainable", meaning: "bền vững", synonyms: ["viable", "enduring"] },
      { word: "initiative", meaning: "sáng kiến", synonyms: ["proposal", "enterprise"] },
      { word: "inevitable", meaning: "không thể tránh khỏi", synonyms: ["unavoidable", "inescapable"] },
      { word: "meticulous", meaning: "tỉ mỉ", synonyms: ["thorough", "precise"] },
      { word: "ambiguous", meaning: "mơ hồ", synonyms: ["vague", "unclear"] },
      { word: "deteriorate", meaning: "xấu đi", synonyms: ["worsen", "decline"] },
      { word: "augment", meaning: "làm tăng thêm", synonyms: ["increase", "expand"] },
      { word: "obsolete", meaning: "lỗi thời", synonyms: ["outdated", "archaic"] },
      { word: "resilient", meaning: "kiên cường", synonyms: ["tough", "strong"] },
      { word: "scrutinize", meaning: "xem xét kỹ", synonyms: ["examine", "inspect"] },
      { word: "lucrative", meaning: "sinh lời cao", synonyms: ["profitable", "rewarding"] },
      { word: "mitigate", meaning: "giảm nhẹ", synonyms: ["alleviate", "reduce"] },
      { word: "plausible", meaning: "hợp lý", synonyms: ["believable", "credible"] },
      { word: "adversity", meaning: "nghịch cảnh", synonyms: ["hardship", "misfortune"] },
      { word: "concur", meaning: "đồng tình", synonyms: ["agree", "accord"] },
      { word: "reluctant", meaning: "miễn cưỡng", synonyms: ["hesitant", "unwilling"] },
      { word: "pivotal", meaning: "then chốt", synonyms: ["crucial", "essential"] },
      { word: "candid", meaning: "thẳng thắn", synonyms: ["frank", "honest"] },
      { word: "abundant", meaning: "dồi dào", synonyms: ["plentiful", "copious"] },
      { word: "perilous", meaning: "nguy hiểm", synonyms: ["dangerous", "hazardous"] },
      { word: "tenacious", meaning: "ngoan cường", synonyms: ["persistent", "stubborn"] },
      { word: "pragmatic", meaning: "thực tế", synonyms: ["practical", "realistic"] }
    ];

    function shuffleArray(arr) {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    }

    /**
     * Dynamically builds 4-option multiple choice questions.
     * If the pool of synonyms is small (< 3 distractors), candidate distractors
     * are seamlessly drawn from DEFAULT_DUEL_DECK so every single word is playable.
     */
    function buildQuestionBank(eligibleWords) {
      if (!eligibleWords || eligibleWords.length === 0) {
        eligibleWords = DEFAULT_DUEL_DECK;
      }

      const wordMap = new Map();

      for (const item of eligibleWords) {
        const key = normalizeKey(item.word);
        if (!wordMap.has(key)) {
          wordMap.set(key, {
            word: item.word,
            meaning: item.meaning,
            synonyms: [...item.synonyms],
            forbiddenKeys: new Set([
              key,
              ...item.synonyms.map(normalizeKey)
            ])
          });
        } else {
          const existing = wordMap.get(key);
          for (const syn of item.synonyms) {
            const synKey = normalizeKey(syn);
            if (!existing.forbiddenKeys.has(synKey)) {
              existing.synonyms.push(syn);
              existing.forbiddenKeys.add(synKey);
            }
          }
        }
      }

      const uniqueEntries = Array.from(wordMap.values());

      // Collect all candidate distractor synonyms across pool
      const allPoolSynonyms = [];
      for (const entry of uniqueEntries) {
        for (const syn of entry.synonyms) {
          allPoolSynonyms.push({
            text: syn,
            key: normalizeKey(syn),
            sourceWordKey: normalizeKey(entry.word)
          });
        }
      }

      const questions = [];

      for (const entry of uniqueEntries) {
        const chosenCorrect =
          entry.synonyms[Math.floor(Math.random() * entry.synonyms.length)];
        const chosenCorrectKey = normalizeKey(chosenCorrect);

        const distractorCandidates = [];
        const seenKeys = new Set(entry.forbiddenKeys);
        seenKeys.add(chosenCorrectKey);

        // 1. Try pool distractors first
        for (const candidate of shuffleArray(allPoolSynonyms)) {
          if (candidate.sourceWordKey === normalizeKey(entry.word)) continue;
          if (seenKeys.has(candidate.key)) continue;
          seenKeys.add(candidate.key);
          distractorCandidates.push(candidate.text);
          if (distractorCandidates.length === 3) break;
        }

        // 2. If fewer than 3 distractors, supplement from DEFAULT_DUEL_DECK
        if (distractorCandidates.length < 3) {
          for (const fallbackItem of shuffleArray(DEFAULT_DUEL_DECK)) {
            for (const syn of fallbackItem.synonyms) {
              const synKey = normalizeKey(syn);
              if (!seenKeys.has(synKey) && synKey !== normalizeKey(entry.word)) {
                seenKeys.add(synKey);
                distractorCandidates.push(syn);
                if (distractorCandidates.length === 3) break;
              }
            }
            if (distractorCandidates.length === 3) break;
          }
        }

        if (distractorCandidates.length === 3) {
          const options = shuffleArray([chosenCorrect, ...distractorCandidates]);
          questions.push({
            word: entry.word,
            meaning: entry.meaning,
            correctAnswer: chosenCorrect,
            options
          });
        }
      }

      return shuffleArray(questions);
    }

    async function loadStudentVocabulary(isSilent = false) {
      if (!isSilent) sound.playClick();
      const username = normalizeText(dom.usernameInput.value);

      if (!username) {
        // Quick Play / Guest Mode
        state.activeUsername = "Guest Cowboy";
        state.eligibleWords = [...DEFAULT_DUEL_DECK];
        state.questionBank = buildQuestionBank(state.eligibleWords);
        dom.hudUsername.textContent = "Guest Cowboy";
        if (dom.deckBadge) dom.deckBadge.textContent = "Starter Deck (24 words)";
        setVocabStatus("⚡ Quick Play active: Using Western Starter Deck (24 academic words). Ready to duel!", "success");
        dom.btnStartGame.disabled = false;
        const users = await discoverLocalUsers();
        renderQuickUserChips(users);
        return;
      }

      if (!isSilent) {
        dom.vocabStatusBox.className = "status-box";
        dom.vocabStatusBox.innerHTML = `<div class="revolver-spinner"></div><div>Loading vocabulary for <strong>${escapeHtml(username)}</strong>...</div>`;
        dom.btnLoadVocab.disabled = true;
      }

      try {
        // 1. Check local IndexedDB exclusively (no automatic Firebase reads)
        const localResult = await tryLoadFromIndexedDB(username);
        let words = localResult.words || [];

        state.activeUsername = username;
        persistUsernameToStorage(username);
        dom.hudUsername.textContent = username;

        if (words.length >= 4) {
          state.eligibleWords = words;
          if (dom.deckBadge) dom.deckBadge.textContent = `${words.length} Student Words`;
          setVocabStatus(
            `⭐ Loaded ${words.length} vocabulary words for "${username}" from IndexedDB (LexicalSpaceDB)! Ready to duel!`,
            "success"
          );
        } else if (words.length > 0) {
          state.eligibleWords = [...DEFAULT_DUEL_DECK];
          if (dom.deckBadge) dom.deckBadge.textContent = "Demo Mode (Starter Deck)";
          setVocabStatus(
            `⚠️ Found only ${words.length} word(s) in IndexedDB for "${username}". Quick Drawn requires at least 4 words to duel. Please add more words in Lexical Space. (Running in Demo Mode).`,
            "warning"
          );
        } else {
          state.eligibleWords = [...DEFAULT_DUEL_DECK];
          if (dom.deckBadge) dom.deckBadge.textContent = "Demo Mode (Starter Deck)";
          setVocabStatus(
            `ℹ️ No vocabulary found in local IndexedDB (LexicalSpaceDB) for "${username}". Open Lexical Space on this browser to add or sync words. (Running in Demo Mode).`,
            "info"
          );
        }

        state.questionBank = buildQuestionBank(state.eligibleWords);
        dom.btnStartGame.disabled = false;
        dom.btnLoadVocab.disabled = false;
        dom.btnLoadVocab.textContent = "🔄 Reload IDB";

        renderQuickUserChips(localResult.allUsers || []);
      } catch (err) {
        state.eligibleWords = [...DEFAULT_DUEL_DECK];
        state.questionBank = buildQuestionBank(state.eligibleWords);
        dom.btnStartGame.disabled = false;
        dom.btnLoadVocab.disabled = false;
        dom.btnLoadVocab.textContent = "🔄 Reload IDB";
        setVocabStatus(`⚠️ Could not access IndexedDB: ${err.message || "Database error"}. Using Western Starter Deck in Demo Mode.`, "error");
      }
    }

    function renderQuickUserChips(users) {
      if (!dom.quickUserPills) return;
      dom.quickUserPills.innerHTML = "";

      const guestChip = document.createElement("button");
      guestChip.type = "button";
      const isGuest = !state.activeUsername || state.activeUsername === "Guest Cowboy";
      guestChip.className = "quick-chip" + (isGuest ? " active" : "");
      guestChip.textContent = "🤠 Guest";
      guestChip.onclick = () => {
        dom.usernameInput.value = "";
        loadStudentVocabulary(false);
      };
      dom.quickUserPills.appendChild(guestChip);

      (users || []).slice(0, 6).forEach((uname) => {
        const chip = document.createElement("button");
        chip.type = "button";
        const isActive = state.activeUsername && normalizeKey(state.activeUsername) === normalizeKey(uname);
        chip.className = "quick-chip" + (isActive ? " active" : "");
        chip.textContent = `⭐ ${uname}`;
        chip.onclick = () => {
          dom.usernameInput.value = uname;
          loadStudentVocabulary(false);
        };
        dom.quickUserPills.appendChild(chip);
      });
    }

    function setVocabStatus(message, type = "") {
      dom.vocabStatusBox.className = "status-box" + (type ? ` ${type}` : "");
      dom.vocabStatusBox.textContent = message;
    }

    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, (ch) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[ch]));
    }

    /*************************************************************************
     * 6. EXACT GAME RULES, COUNTDOWN ENGINE & DUEL ANIMATIONS
     *************************************************************************/
    /**
     * Strict 1-second minimum countdown formula:
     * - Minimum duration strictly enforced at MIN_TIMER_SECONDS = 1
     * - Decreases by 0.5s per question from 10.0s down to 1.0s
     * - Clamped with Math.max(MIN_TIMER_SECONDS, calculatedDuration)
     */
    const MIN_TIMER_SECONDS = 1;

    function calculateQuestionTimeLimit(questionNumber) {
      return Math.max(1, 10 - (questionNumber - 1) * 0.5);
    }

    let flowStateTimer = null;

    function triggerFlowStateNotification() {
      if (!dom.flowStateBanner) return;
      sound.playFlowStateSound?.();
      clearTimeout(flowStateTimer);
      dom.flowStateBanner.classList.add("active");
      dom.flowStateBanner.setAttribute("aria-hidden", "false");

      // Auto-dismiss after 2.6 seconds (unobtrusive, readable)
      flowStateTimer = setTimeout(() => {
        dismissFlowStateNotification();
      }, 2600);
    }

    function dismissFlowStateNotification() {
      if (!dom.flowStateBanner) return;
      dom.flowStateBanner.classList.remove("active");
      dom.flowStateBanner.setAttribute("aria-hidden", "true");
    }

    function stopCountdownTimer() {
      if (state.rafId !== null) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
    }

    function startNewRun() {
      sound.init();
      pronunciationEngine.init();
      pronunciationEngine.stop();
      sound.playClick();

      if (!state.activeUsername) {
        state.activeUsername = "Guest Cowboy";
      }
      if (!state.eligibleWords || state.eligibleWords.length === 0) {
        state.eligibleWords = [...DEFAULT_DUEL_DECK];
      }

      // Rebuild & shuffle question bank for this run
      state.currentRunQuestions = buildQuestionBank(state.eligibleWords);
      if (state.currentRunQuestions.length === 0) {
        state.eligibleWords = [...DEFAULT_DUEL_DECK];
        state.currentRunQuestions = buildQuestionBank(state.eligibleWords);
      }

      stopCountdownTimer();
      dismissFlowStateNotification();
      state.score = 10;
      state.missedTries = 0;
      state.isTerminalLoss = false;
      state.hasCelebrated25 = false;
      state.hasTriggeredFlowState = false;
      state.questionNumber = 0;
      state.attemptedCount = 0;
      state.correctCount = 0;
      state.isRunActive = true;
      state.isQuestionLocked = true;
      state.currentTargetWord = "";
      state.lastTickSecond = 0;

      dom.hudScore.textContent = String(state.score);
      if (dom.hudMisses) dom.hudMisses.textContent = "0/3";
      updateLifeSeals(0);
      dom.hudUsername.textContent = state.activeUsername;

      dom.titleScreen.classList.add("hidden");
      dom.resultScreen.classList.add("hidden");
      dom.celebrationScreen?.classList.add("hidden");

      presentNextQuestion();
    }

    function presentNextQuestion() {
      stopCountdownTimer();
      pronunciationEngine.stop();

      // Recycle the available mastered-word questions until the player wins or loses.
      if (state.questionNumber >= state.currentRunQuestions.length) {
        state.currentRunQuestions = shuffleArray(buildQuestionBank(state.eligibleWords));
        state.questionNumber = 0;
        if (state.currentRunQuestions.length === 0) {
          endRun(false, "No more valid vocabulary questions are available.");
          return;
        }
      }

      state.questionNumber += 1;
      const currentQ = state.currentRunQuestions[state.questionNumber - 1];
      state.currentTargetWord = currentQ.word;
      state.timeLimitSec = calculateQuestionTimeLimit(state.questionNumber);
      state.lastTickSecond = 0;

      // Trigger "Flow Stateeeeeeeeee!" notification on first transition to the 1-second minimum
      if (state.timeLimitSec <= MIN_TIMER_SECONDS && !state.hasTriggeredFlowState) {
        state.hasTriggeredFlowState = true;
        triggerFlowStateNotification();
      }

      // Reset cowboy duel stage to Idle Standoff (Reference Image 3)
      duelAnimator.setState("state-idle");
      dom.feedbackBanner.className = "feedback-banner";

      // Populate target word and Vietnamese meaning hint
      dom.targetWordText.textContent = currentQ.word;
      dom.targetMeaningText.textContent = `(${currentQ.meaning})`;

      // Populate and unlock 4 answer buttons
      dom.answerButtons.forEach((btn, idx) => {
        btn.className = "answer-btn";
        btn.disabled = false;
        btn.textContent = currentQ.options[idx];
      });

      // Reset fuse countdown visuals
      updateTimerVisuals(state.timeLimitSec, state.timeLimitSec);

      // Automatically pronounce target word for this question
      pronunciationEngine.pronounce(currentQ.word);

      // Preload next two upcoming words predictively
      if (state.currentRunQuestions.length > 0) {
        const nextIdx1 = state.questionNumber % state.currentRunQuestions.length;
        const nextIdx2 = (state.questionNumber + 1) % state.currentRunQuestions.length;
        const upcomingWords = [
          state.currentRunQuestions[nextIdx1]?.word,
          state.currentRunQuestions[nextIdx2]?.word
        ].filter(Boolean);
        pronunciationEngine.preloadUpcoming(upcomingWords);
      }

      state.isQuestionLocked = false;
      state.questionStartTime = performance.now();

      const tick = (now) => {
        if (!state.isRunActive || state.isQuestionLocked) return;

        const elapsedSec = (now - state.questionStartTime) / 1000;
        const remainingSec = Math.max(0, state.timeLimitSec - elapsedSec);

        updateTimerVisuals(remainingSec, state.timeLimitSec);

        if (remainingSec <= 0) {
          handleTimeout();
          return;
        }

        // Subtle countdown tick exactly once per elapsed integer second
        const currentSecond = Math.floor(elapsedSec);
        if (currentSecond > state.lastTickSecond) {
          const isSingleStep = (currentSecond - state.lastTickSecond) === 1;
          state.lastTickSecond = currentSecond;
          if (isSingleStep && remainingSec > 0.05 && !sound.muted) {
            // Prioritize target-word pronunciation: suppress tick in early window if speaking
            if (!pronunciationEngine.isSpeaking || elapsedSec > 1.2) {
              sound.playTick();
            }
          }
        }

        state.rafId = requestAnimationFrame(tick);
      };

      state.rafId = requestAnimationFrame(tick);
    }

    function updateTimerVisuals(remainingSec, totalSec) {
      const clampedRemaining = Math.max(0, remainingSec);
      const ratio = totalSec > 0 ? Math.max(0, Math.min(1, clampedRemaining / totalSec)) : 0;
      const percent = ratio * 100;

      dom.hudTimerText.textContent = `Q${state.questionNumber} • ${clampedRemaining.toFixed(1)}s`;
      dom.fuseFill.style.width = `${percent}%`;
      dom.fuseSpark.style.left = `${percent}%`;

      // Urgent visual state when <= 3 seconds remain
      const isUrgent = clampedRemaining <= 3.0;
      dom.hudTimerText.classList.toggle("urgent", isUrgent);
      if (dom.hudTimerBadge) {
        dom.hudTimerBadge.classList.toggle("urgent", isUrgent);
      }
      dom.fuseFill.classList.toggle("urgent", isUrgent);

      if (isUrgent && dom.duelStage.classList.contains("state-idle")) {
        dom.duelStage.classList.add("state-urgent");
      } else {
        dom.duelStage.classList.remove("state-urgent");
      }
    }

    function lockAllAnswerButtons() {
      state.isQuestionLocked = true;
      stopCountdownTimer();
      pronunciationEngine.stop();
      dom.answerButtons.forEach((btn) => {
        btn.disabled = true;
      });
    }

    function showBannerFeedback(text, isHit) {
      dom.feedbackBanner.textContent = text;
      dom.feedbackBanner.className = `feedback-banner show ${isHit ? "hit" : "miss"}`;
    }

    function handleAnswerSelection(selectedIndex) {
      // Strictly ignore clicks if locked, animation running, terminal loss, or run already ended
      if (!state.isRunActive || state.isQuestionLocked || state.isTerminalLoss) return;

      const now = performance.now();
      const elapsedSec = (now - state.questionStartTime) / 1000;
      if (elapsedSec >= state.timeLimitSec) {
        // Late click after timer expiration must never count
        handleTimeout();
        return;
      }

      lockAllAnswerButtons();

      const currentQ = state.currentRunQuestions[state.questionNumber - 1];
      const chosenOption = currentQ.options[selectedIndex];
      const isCorrect = normalizeKey(chosenOption) === normalizeKey(currentQ.correctAnswer);

      state.attemptedCount += 1;

      if (isCorrect) {
        // Correct answer: +1 point. Miss counter does NOT increment.
        state.score += 1;
        state.correctCount += 1;
        dom.hudScore.textContent = String(state.score);

        dom.answerButtons[selectedIndex].classList.add("correct");
        // Trigger Player Shooting AI Cowboy animation (Reference Image 2)
        duelAnimator.setState("state-player-win");
        showBannerFeedback("BULLSEYE! +1", true);
        sound.playGunshot(true);

        setTimeout(() => {
          if (!state.isRunActive || state.isTerminalLoss) return;

          // 25-Point Sharpshooter Milestone Celebration (triggered once per game session at end of sequence)
          if (state.score >= 25 && !state.hasCelebrated25) {
            trigger25PointCelebration();
            return;
          }

          presentNextQuestion();
        }, 780);
      } else {
        // Missed try: increment counter and deduct points
        state.missedTries += 1;
        if (dom.hudMisses) dom.hudMisses.textContent = `${state.missedTries}/3`;
        updateLifeSeals(state.missedTries);

        state.score = Math.max(0, state.score - 3);
        dom.hudScore.textContent = String(state.score);
        dom.answerButtons[selectedIndex].classList.add("wrong");
        dom.answerButtons.forEach((btn, idx) => {
          if (normalizeKey(currentQ.options[idx]) === normalizeKey(currentQ.correctAnswer)) {
            btn.classList.add("correct");
          }
        });

        // Trigger AI Opponent Shooting Player animation
        duelAnimator.setState("state-enemy-win");
        sound.playScream();

        // 3 MISSED TRIES: Immediate Terminal Loss Trigger
        if (state.missedTries >= 3) {
          state.isRunActive = false;
          state.isQuestionLocked = true;
          state.isTerminalLoss = true;
          stopCountdownTimer();
          showBannerFeedback("OUTDRAWN! (3/3 MISSES)", false);

          setTimeout(() => {
            endRun(false, `Duel Over! You lost after 3 missed tries (3/3). The correct synonym was "${currentQ.correctAnswer}".`);
          }, 1150);
          return;
        }

        showBannerFeedback(`MISSED SHOT! (${state.missedTries}/3)`, false);

        setTimeout(() => {
          if (state.score <= 0) {
            endRun(false, `You lost 3 points for a wrong answer and reached 0 score (${state.missedTries}/3 misses). The correct synonym was "${currentQ.correctAnswer}".`);
          } else if (state.isRunActive && !state.isTerminalLoss) {
            presentNextQuestion();
          }
        }, 1150);
      }
    }

    function handleTimeout() {
      if (!state.isRunActive || state.isQuestionLocked || state.isTerminalLoss) return;
      lockAllAnswerButtons();
      stopCountdownTimer();
      updateTimerVisuals(0, state.timeLimitSec);

      state.attemptedCount += 1;
      state.missedTries += 1;
      if (dom.hudMisses) dom.hudMisses.textContent = `${state.missedTries}/3`;
        updateLifeSeals(state.missedTries);

      state.score = Math.max(0, state.score - 3);
      dom.hudScore.textContent = String(state.score);
      const currentQ = state.currentRunQuestions[state.questionNumber - 1];

      // Reveal correct synonym
      dom.answerButtons.forEach((btn, idx) => {
        if (normalizeKey(currentQ.options[idx]) === normalizeKey(currentQ.correctAnswer)) {
          btn.classList.add("correct");
        }
      });

      // Trigger AI Opponent Shooting Player animation
      duelAnimator.setState("state-enemy-win");
      sound.playScream();

      // 3 MISSED TRIES: Immediate Terminal Loss Trigger
      if (state.missedTries >= 3) {
        state.isRunActive = false;
        state.isQuestionLocked = true;
        state.isTerminalLoss = true;
        stopCountdownTimer();
        showBannerFeedback("OUTDRAWN! (3/3 MISSES)", false);

        setTimeout(() => {
          endRun(false, `Duel Over! You ran out of time and reached 3 missed tries (3/3). The correct synonym was "${currentQ.correctAnswer}".`);
        }, 1150);
        return;
      }

      showBannerFeedback(`TOO SLOW! (${state.missedTries}/3)`, false);

      setTimeout(() => {
        if (state.score <= 0) {
          endRun(false, `You ran out of time and lost 3 points, reaching 0 score (${state.missedTries}/3 misses). The correct synonym was "${currentQ.correctAnswer}".`);
        } else if (state.isRunActive && !state.isTerminalLoss) {
          presentNextQuestion();
        }
      }, 1150);
    }

    function endRun(isFullVictory, detailMessage) {
      stopCountdownTimer();
      dismissFlowStateNotification();
      pronunciationEngine.stop();
      state.isRunActive = false;
      state.isQuestionLocked = true;
      state.isTerminalLoss = true;

      const bestScore = saveBestScore(state.activeUsername, state.score);
      const accuracy =
        state.attemptedCount > 0
          ? Math.round((state.correctCount / state.attemptedCount) * 100)
          : 0;

      if (isFullVictory) {
        dom.resultTitleBadge.textContent = "SHERIFF VICTORY!";
        dom.resultSubtitle.textContent = "Every Mastered Word Flawlessly Drawn!";
        sound.playVictoryFanfare();
      } else {
        dom.resultTitleBadge.textContent = "DUEL OVER";
        dom.resultSubtitle.textContent = state.missedTries >= 3
          ? "Outdrawn after 3 Missed Tries!"
          : "Outdrawn in the Canyon!";
      }

      dom.statFinalScore.textContent = String(state.score);
      dom.statBestScore.textContent = String(bestScore);
      dom.statAttempted.textContent = String(state.attemptedCount);
      dom.statCorrect.textContent = String(state.correctCount);
      if (dom.statMisses) dom.statMisses.textContent = `${state.missedTries}/3`;
      dom.statAccuracy.textContent = `${accuracy}%`;
      dom.resultDetailBox.textContent = detailMessage;

      dom.celebrationScreen?.classList.add("hidden");
      dom.resultScreen.classList.remove("hidden");
    }

    /*************************************************************************
     * 6B. 25-POINT SHARPSHOOTER CELEBRATION
     *************************************************************************/
    function trigger25PointCelebration() {
      state.hasCelebrated25 = true;
      dismissFlowStateNotification();
      stopCountdownTimer();
      pronunciationEngine.stop();
      sound.playVictoryFanfare();

      if (dom.celebrationScoreVal) {
        dom.celebrationScoreVal.textContent = String(state.score);
      }

      if (dom.celebrationScreen) {
        dom.celebrationScreen.classList.remove("hidden");
        setTimeout(() => {
          dom.btnDismissCelebration?.focus();
        }, 50);
      }
    }

    function dismissCelebration() {
      if (!dom.celebrationScreen || dom.celebrationScreen.classList.contains("hidden")) return;
      sound.playClick();
      dom.celebrationScreen.classList.add("hidden");

      // Seamlessly continue gameplay after celebration without capping score
      if (state.isRunActive && !state.isTerminalLoss) {
        presentNextQuestion();
      }
    }

    /*************************************************************************
     * 7. EVENT LISTENERS & INITIALIZATION
     *************************************************************************/
    // Unlock Web Audio & Speech on first user gesture anywhere on screen
    const unlockAllAudio = () => {
      sound.init();
      pronunciationEngine.init();
    };
    document.addEventListener("pointerdown", unlockAllAudio, { once: true });
    document.addEventListener("touchstart", unlockAllAudio, { once: true });

    dom.answerButtons.forEach((btn, idx) => {
      btn?.addEventListener("click", () => {
        unlockAllAudio();
        handleAnswerSelection(idx);
      });
    });

    dom.btnWordSpeaker?.addEventListener("click", (e) => {
      e.stopPropagation();
      unlockAllAudio();
      if (state.currentTargetWord) {
        pronunciationEngine.pronounce(state.currentTargetWord);
      }
    });

    dom.targetWordCard?.addEventListener("click", () => {
      unlockAllAudio();
      if (state.currentTargetWord) {
        pronunciationEngine.pronounce(state.currentTargetWord);
      }
    });

    dom.btnAudioToggle?.addEventListener("click", () => {
      const muted = sound.toggleMute();
      dom.btnAudioToggle.classList.toggle("muted", muted);
      if (dom.svgSpeakerOn) dom.svgSpeakerOn.style.display = muted ? "none" : "block";
      if (dom.svgSpeakerOff) dom.svgSpeakerOff.style.display = muted ? "block" : "none";
      if (muted) {
        pronunciationEngine.stop();
      } else {
        sound.playClick();
      }
    });

    dom.btnLoadVocab?.addEventListener("click", () => {
      unlockAllAudio();
      loadStudentVocabulary();
    });

    dom.usernameInput?.addEventListener("input", () => {
      const entered = normalizeText(dom.usernameInput.value);
      if (entered && entered !== state.activeUsername) {
        setVocabStatus(`Press '⚡ Sync' or Enter to load words for "${entered}", or tap 'START DUEL' to play right away!`, "success");
      }
    });

    dom.usernameInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        loadStudentVocabulary(false);
      }
    });

    dom.btnStartGame?.addEventListener("click", () => {
      unlockAllAudio();
      startNewRun();
    });

    dom.btnPlayAgain?.addEventListener("click", () => {
      unlockAllAudio();
      startNewRun();
    });

    dom.btnReturnTitle?.addEventListener("click", async (e) => {
      e.preventDefault();
      sound.playClick();
      stopCountdownTimer();
      pronunciationEngine.stop();
      state.isRunActive = false;
      const params = new URLSearchParams(window.location.search);
      const defaultReturn = window.location.hostname.endsWith("github.io")
        ? "https://vuongtranvt1331-design.github.io/Arcadehub/"
        : "arcade.html";
      const returnUrl = params.get("returnUrl") || defaultReturn;
      window.location.href = returnUrl;
    });

    dom.btnDismissCelebration?.addEventListener("click", (e) => {
      e.stopPropagation();
      dismissCelebration();
    });

    dom.celebrationScreen?.addEventListener("click", (e) => {
      if (e.target === dom.celebrationScreen) {
        dismissCelebration();
      }
    });

    // Dismiss celebration on Enter / Space / Escape
    window.addEventListener("keydown", (e) => {
      if (!dom.celebrationScreen || dom.celebrationScreen.classList.contains("hidden")) return;
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        dismissCelebration();
      }
    });

    // Expose for testing & automation verification
    window.__quickDrawnGame = {
      MIN_TIMER_SECONDS,
      duelAnimator,
      playerAnimator,
      enemyAnimator,
      getState: () => state,
      getDom: () => dom,
      startNewRun,
      calculateQuestionTimeLimit,
      triggerFlowStateNotification,
      dismissFlowStateNotification,
      trigger25PointCelebration,
      dismissCelebration,
      onAnswerSelected: handleAnswerSelection,
      presentNextQuestion,
      endRun,
      loadStudentVocabulary
    };

    // Handle tab visibility (stop pronunciation and ticking when hidden)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        pronunciationEngine.stop();
      }
    });

    // Keyboard support on desktop (1-4 for answers, Space/P for pronunciation replay, M for mute toggle)
    document.addEventListener("keydown", (e) => {
      if (e.target === dom.usernameInput) return;

      if (state.isRunActive && !state.isQuestionLocked) {
        if (e.key === "1") handleAnswerSelection(0);
        else if (e.key === "2") handleAnswerSelection(1);
        else if (e.key === "3") handleAnswerSelection(2);
        else if (e.key === "4") handleAnswerSelection(3);
        else if (e.key === " " || e.key === "p" || e.key === "P") {
          e.preventDefault();
          if (state.currentTargetWord) pronunciationEngine.pronounce(state.currentTargetWord);
        }
      }

      if (e.key === "m" || e.key === "M") {
        dom.btnAudioToggle?.click();
      }
    });

    // Boot Sequence on Page Load: INSTANT ACTION (Zero Asking Phase!)
    window.addEventListener("DOMContentLoaded", async () => {
      // 1. Auto-detect user, mode, and topic from URL params
      const params = new URLSearchParams(window.location.search);
      const defaultReturn = window.location.hostname.endsWith("github.io")
        ? "https://vuongtranvt1331-design.github.io/Arcadehub/"
        : "arcade.html";
      const returnUrl = params.get("returnUrl") || defaultReturn;
      if (dom.btnReturnTitle) dom.btnReturnTitle.href = returnUrl;
      document.querySelectorAll(".header-btn.exit-btn, .hud-circle-btn, a[href='arcade.html'], a[title*='Exit']").forEach(a => {
        a.href = returnUrl;
      });

      const urlUser = params.get("user");
      let urlMode = (params.get("mode") || "full").trim().toLowerCase();
      if (!["full", "topic"].includes(urlMode)) {
        urlMode = "full";
      }
      const urlTopic = (params.get("topic") || "").trim();
      const storedUser = (urlUser && urlUser.trim()) ? urlUser.trim() : detectStoredUsername();
      const activeUser = storedUser || "Guest Cowboy";

      state.activeUsername = activeUser;
      state.vocabMode = urlMode;
      if (dom.usernameInput && activeUser && activeUser !== "Guest Cowboy") {
        dom.usernameInput.value = activeUser;
      }

      let modeTag = "Full Vocab";
      if (urlMode === "topic") modeTag = urlTopic ? `Topic: ${urlTopic}` : "Topic Mode";
      dom.hudUsername.textContent = `${activeUser} • ${modeTag}`;

      // 2. Hide title/result overlays unless blocked by missing topic
      dom.titleScreen.classList.add("hidden");
      dom.resultScreen.classList.add("hidden");

      // 3. Validation for Topic mode: Topic MUST be selected
      if (urlMode === "topic" && !urlTopic) {
        dom.titleScreen.classList.remove("hidden");
        setVocabStatus("⚠️ Topic mode requires selecting a topic! Please return to Arcade Hub and choose a topic.", "error");
        dom.btnStartGame.disabled = true;
        return;
      }

      // 4. Immediately load student vocabulary from IndexedDB if available
      let words = [];
      if (activeUser && activeUser !== "Guest Cowboy") {
        try {
          const localResult = await tryLoadFromIndexedDB(activeUser);
          words = localResult.words || [];

          if (urlMode === "topic") {
            const topicWords = words.filter(w => w.topics.some(topic => normalizeKey(topic) === normalizeKey(urlTopic)));
            if (topicWords.length === 0) {
              dom.titleScreen.classList.remove("hidden");
              setVocabStatus(`⚠️ Topic "${urlTopic}" has no words in your library. Please select a different topic in Arcade Hub.`, "error");
              dom.btnStartGame.disabled = true;
              return;
            }
            words = topicWords;
          }
          // In "full" mode, all eligible words across all topics for activeUser are used
        } catch (_) {}
      }

      if (words.length >= 4) {
        state.eligibleWords = words;
        if (dom.deckBadge) dom.deckBadge.textContent = `${words.length} Student Words`;
      } else {
        state.eligibleWords = [...DEFAULT_DUEL_DECK];
        if (dom.deckBadge) dom.deckBadge.textContent = "Demo Mode (Starter Deck)";
      }

      // 5. Instantly launch directly into the duel!
      startNewRun();
    });
