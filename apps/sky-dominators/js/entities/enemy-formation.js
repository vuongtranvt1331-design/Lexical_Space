/* js/entities/enemy-formation.js — ordered classic script; entrypoints declare dependency order. */
class EnemyFormation {
    constructor(id, aircraftCount, vocabEntryOrWord, slotIndex = 0, validSynonyms = null, distractorPool = null) {
        this.id = id;
        // Allow explicit aircraft count or randomly 3 or 4 aircraft per row for 9:16 portrait
        this.aircraftCount = aircraftCount || ((Math.random() < 0.5) ? 3 : 4);
        this.slotIndex = slotIndex;
        this.targetY = FORMATION_START_Y + this.slotIndex * FORMATION_ROW_SPACING;
        // Entry animation: start row above the screen moving downward from outside top boundary
        this.y = -70 - (this.slotIndex * 45);
        this.isEntering = true;
        this.destroyed = false; // Atomic flag preventing multi-rewards
        this.diveCooldown = 2500; // ms cooldown before this formation can launch a diving attack
        this.aircraft = [];

        // Resolve and validate target vocabEntry
        let entry = null;
        if (vocabEntryOrWord && typeof vocabEntryOrWord === 'object' && vocabEntryOrWord.word) {
            entry = vocabEntryOrWord;
        } else if (typeof vocabEntryOrWord === 'string' && vocabEntryOrWord.trim()) {
            const normWord = vocabEntryOrWord.trim().toLowerCase();
            entry = vocabService.vocabularyList.find(v => v.word.trim().toLowerCase() === normWord);
            if (!entry) {
                entry = BUILTIN_IELTS_VOCABULARY.find(v => v.word.trim().toLowerCase() === normWord);
            }
            if (!entry && Array.isArray(validSynonyms) && validSynonyms.length > 0) {
                entry = {
                    word: vocabEntryOrWord.trim(),
                    synonyms: [...validSynonyms],
                    meaning: "",
                    topic: "Academic / IELTS"
                };
            }
        }

        if (!vocabService.isValidVocabEntry(entry)) {
            entry = vocabService.getRandomWord();
        }

        this.vocabEntry = entry;
        this.targetWord = (entry.word || "").toString().trim();
        this.meaning = entry.meaning || "";
        this.validSynonyms = Array.isArray(entry.synonyms)
            ? entry.synonyms.map(s => (s || "").toString().trim()).filter(Boolean)
            : [];

        // Genuine, contextually appropriate synonym selection preserving meaning
        this.correctSynonym = this.validSynonyms.length > 0
            ? this.validSynonyms[Math.floor(Math.random() * this.validSynonyms.length)]
            : BUILTIN_IELTS_VOCABULARY[0].synonyms[0];

        this.initAircraft();
    }

    shiftDownOneSlot() {
        this.slotIndex++;
        this.targetY = FORMATION_START_Y + this.slotIndex * FORMATION_ROW_SPACING;
    }

    initAircraft() {
        const targetNorm = this.targetWord.toLowerCase().trim();
        const forbidden = new Set();
        forbidden.add(targetNorm);
        this.validSynonyms.forEach(s => forbidden.add(s.toLowerCase().trim()));

        // Distractor candidates pool strictly from OTHER vocabulary words
        const candidatePool = [];
        const allItems = (vocabService.vocabularyList && vocabService.vocabularyList.length > 0)
            ? vocabService.vocabularyList
            : BUILTIN_IELTS_VOCABULARY;

        for (const item of allItems) {
            if (!item || !item.word) continue;
            const itemWordNorm = item.word.trim().toLowerCase();
            // Candidate headword must not be the target or any synonym of target
            if (forbidden.has(itemWordNorm)) continue;

            // Ensure this item does not share any synonym with targetWord
            const itemSynsNorm = (item.synonyms || []).map(s => (s || "").toString().trim().toLowerCase());
            if (itemSynsNorm.some(s => forbidden.has(s))) continue;

            for (const syn of item.synonyms || []) {
                const sClean = (syn || "").toString().trim();
                const sNorm = sClean.toLowerCase();
                if (sClean && !forbidden.has(sNorm)) {
                    candidatePool.push(sClean);
                }
            }
        }

        // Fisher-Yates shuffle candidate pool
        for (let i = candidatePool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidatePool[i], candidatePool[j]] = [candidatePool[j], candidatePool[i]];
        }

        const correctSlot = Math.floor(Math.random() * this.aircraftCount);
        const usedWords = new Set();
        usedWords.add(this.correctSynonym.toLowerCase().trim());

        const assignedWords = [];
        for (let i = 0; i < this.aircraftCount; i++) {
            if (i === correctSlot) {
                assignedWords.push({ word: this.correctSynonym, isCorrect: true });
            } else {
                let chosenDistractor = null;
                while (candidatePool.length > 0) {
                    const cand = candidatePool.pop();
                    const candNorm = cand.toLowerCase().trim();
                    if (!forbidden.has(candNorm) && !usedWords.has(candNorm)) {
                        chosenDistractor = cand;
                        usedWords.add(candNorm);
                        break;
                    }
                }
                if (!chosenDistractor) {
                    // Robust secondary search across built-in baseline dataset
                    for (const fallback of BUILTIN_IELTS_VOCABULARY) {
                        const fbWordNorm = fallback.word.trim().toLowerCase();
                        if (forbidden.has(fbWordNorm)) continue;
                        const fbSynsNorm = fallback.synonyms.map(s => s.trim().toLowerCase());
                        if (fbSynsNorm.some(s => forbidden.has(s))) continue;

                        for (const s of fallback.synonyms) {
                            const sn = s.trim().toLowerCase();
                            if (!forbidden.has(sn) && !usedWords.has(sn)) {
                                chosenDistractor = s.trim();
                                usedWords.add(sn);
                                break;
                            }
                        }
                        if (chosenDistractor) break;
                    }
                }
                if (!chosenDistractor) {
                    // Fallback to distinct headwords if all synonyms in pool are exhausted
                    for (const fallback of BUILTIN_IELTS_VOCABULARY) {
                        const fbWordNorm = fallback.word.trim().toLowerCase();
                        if (!forbidden.has(fbWordNorm) && !usedWords.has(fbWordNorm)) {
                            chosenDistractor = fallback.word.trim();
                            usedWords.add(fbWordNorm);
                            break;
                        }
                    }
                }
                assignedWords.push({ word: chosenDistractor, isCorrect: false });
            }
        }

        // Layout across 9:16 portrait usable width (540px)
        const margin = (this.aircraftCount === 3) ? 65 : 48;
        const usableWidth = GAME_WIDTH - margin * 2;
        const slotSpacing = (this.aircraftCount > 1) ? (usableWidth / (this.aircraftCount - 1)) : 0;

        this.aircraft = [];
        for (let i = 0; i < this.aircraftCount; i++) {
            const baseX = margin + i * slotSpacing;
            const offsetOptions = [-5, -4, -3, 3, 4, 5];
            const jitterX = offsetOptions[Math.floor(Math.random() * offsetOptions.length)];
            const jitterY = offsetOptions[Math.floor(Math.random() * offsetOptions.length)];
            const modelIndex = Math.floor(Math.random() * 3);
            const posX = Math.max(34, Math.min(GAME_WIDTH - 34, Math.round(baseX)));
            const item = assignedWords[i];

            this.aircraft.push(new EnemyAircraft(
                this,
                i,
                posX,
                this.y,
                item.word,
                item.isCorrect,
                this.aircraftCount,
                jitterX,
                jitterY,
                modelIndex,
                this.targetWord,
                this.meaning
            ));
        }
    }

    update(dt) {
        if (this.destroyed) return;

        if (this.diveCooldown > 0) {
            this.diveCooldown -= dt;
        }

        // Smooth downward movement into formation position from above screen
        const dist = this.targetY - this.y;
        if (Math.abs(dist) > 0.5) {
            const speed = Math.max(140, Math.min(260, Math.abs(dist) * 3.5));
            const step = Math.sign(dist) * Math.min(Math.abs(dist), speed * (dt / 1000));
            this.y += step;
        } else {
            this.y = this.targetY;
            this.isEntering = false;
        }

        for (const ac of this.aircraft) {
            if (ac.active) ac.update(dt);
        }
    }

    draw(ctx) {
        if (this.destroyed) return;
        for (const a of this.aircraft) {
            if (a.active) a.draw(ctx);
        }
    }
}
