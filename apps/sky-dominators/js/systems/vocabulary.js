/* js/systems/vocabulary.js — ordered classic script; entrypoints declare dependency order. */
class VocabService {
    constructor() {
        this.dbName = "LexicalSpaceDB";
        this.storeName = "words";
        this.vocabularyList = [];
        this.allDistractorPool = [];
        this.activeUser = "";
        this.isLoaded = false;
        this.sourceName = "BUILT-IN IELTS DECK";
        this.drawDeck = [];
        this.playedHistory = [];
    }

    normalize(text) {
        return (text || "").toString().trim().toLowerCase();
    }

    getActiveUser(urlParams) {
        const requestedUser = urlParams.get('user');
        if (requestedUser !== null) return requestedUser.trim();
        try {
            const tabUser = window.sessionStorage.getItem('ls_active_profile');
            if (tabUser !== null) return tabUser.trim();
        } catch { /* Fall back when tab storage is unavailable. */ }
        try { return (window.localStorage.getItem('vocab_user') || '').trim(); }
        catch { return ''; }
    }

    resetExhaustionDeck(excludeWord = "") {
        const pool = this.vocabularyList.slice();
        // Fisher-Yates shuffle
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        // Avoid starting new cycle with the same word just played
        if (pool.length > 1 && pool[pool.length - 1].word === excludeWord) {
            const swapIdx = Math.floor(Math.random() * (pool.length - 1));
            [pool[pool.length - 1], pool[swapIdx]] = [pool[swapIdx], pool[pool.length - 1]];
        }
        this.drawDeck = pool;
    }

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.activeUser = this.getActiveUser(urlParams);
        const modeParam = urlParams.get('mode') || "";
        const topicParam = urlParams.get('topic') || "";

        // Update Topic Display Badge in bottom status bar
        const activeTopicBadge = document.getElementById('activeTopicBadge');
        if (activeTopicBadge) {
            if (modeParam === "topic" && topicParam) {
                activeTopicBadge.textContent = `TOPIC: ${topicParam.toUpperCase()}`;
            } else {
                activeTopicBadge.textContent = "TOPIC: ALL";
            }
        }

        // 1. Immediately activate built-in IELTS vocabulary as baseline so game NEVER blocks or fails
        this.vocabularyList = BUILTIN_IELTS_VOCABULARY.map(d => ({
            word: d.word,
            synonyms: [...d.synonyms],
            meaning: d.meaning,
            topic: d.topic || "Academic IELTS",
            memoryStatus: d.memoryStatus || 'not_remembered'
        }));
        this.sourceName = `BUILT-IN IELTS DECK (${this.vocabularyList.length} WORDS)`;
        this.resetExhaustionDeck();
        this.rebuildDistractorPool();
        this.isLoaded = true;

        const dot = document.getElementById('idbStatusDot');
        const text = document.getElementById('idbStatusText');
        if (dot) {
            dot.style.background = '#10b981';
            dot.style.boxShadow = '0 0 8px #10b981';
        }
        if (text) {
            text.textContent = `VOCABULARY READY (${this.vocabularyList.length} IELTS WORDS)`;
        }

        // 2. Read the existing shared vocabulary with a safety timeout.
        try {
            const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), 1200));
            const idbPromise = this.fetchFromIndexedDB(this.activeUser, modeParam === 'topic' ? topicParam : "");
            const idbResult = await Promise.race([idbPromise, timeoutPromise]);

            if (Array.isArray(idbResult) && idbResult.length > 0) {
                this.vocabularyList = idbResult;
                this.sourceName = `INDEXEDDB (${this.vocabularyList.length} WORDS)`;
                this.resetExhaustionDeck();
                this.rebuildDistractorPool();
                if (dot) {
                    dot.style.background = '#10b981';
                    dot.style.boxShadow = '0 0 8px #10b981';
                }
                if (text) text.textContent = `IDB: ${idbResult.length} WORDS LOADED`;
            } else if (Array.isArray(idbResult) && idbResult.length === 0) {
                if (dot) {
                    dot.style.background = '#f59e0b';
                    dot.style.boxShadow = '0 0 8px #f59e0b';
                }
                if (text) text.textContent = `IDB EMPTY - USING BASELINE DECK`;
            } else {
                if (dot) {
                    dot.style.background = '#f59e0b';
                    dot.style.boxShadow = '0 0 8px #f59e0b';
                }
                if (text) text.textContent = `IDB READY - BASELINE DECK`;
            }
        } catch (e) {
            if (dot) {
                dot.style.background = '#ef4444';
                dot.style.boxShadow = '0 0 8px #ef4444';
            }
            if (text) text.textContent = `IDB UNAVAILABLE - OFFLINE BASELINE`;
        }

        const badge = document.getElementById('deckBadge');
        if (badge) badge.textContent = `${this.vocabularyList.length} Active Words (${this.sourceName})`;
    }

    rebuildDistractorPool() {
        const poolSet = new Set();
        for (const item of this.vocabularyList) {
            for (const syn of item.synonyms) {
                const s = syn.trim();
                if (s.length > 0) poolSet.add(s);
            }
        }
        for (const item of BUILTIN_IELTS_VOCABULARY) {
            for (const syn of item.synonyms) {
                poolSet.add(syn.trim());
            }
        }
        this.allDistractorPool = Array.from(poolSet);
    }

    fetchFromIndexedDB(username = "", targetTopic = "") {
        return new Promise(resolve => {
            if (!window.indexedDB) return resolve(null);
            const profile = username.trim();
            const request = window.indexedDB.open(this.dbName);
            // If LexicalSpace has never run on this origin, leave database creation to it.
            request.onupgradeneeded = () => request.transaction.abort();
            request.onerror = () => resolve(null);
            request.onsuccess = () => {
                const db = request.result;
                const finish = result => { db.close(); resolve(result); };
                db.onversionchange = () => db.close();
                if (!db.objectStoreNames.contains(this.storeName)) return finish(null);

                try {
                    const transaction = db.transaction(this.storeName, 'readonly');
                    const store = transaction.objectStore(this.storeName);
                    const scoped = Array.isArray(store.keyPath) && store.keyPath.includes('username');
                    if (scoped && !profile) return finish(null);
                    const read = scoped && store.indexNames.contains('username')
                        ? store.index('username').getAll(profile)
                        : store.getAll();
                    transaction.onabort = () => finish(null);
                    transaction.oncomplete = () => {
                        finish(this.toPlayableWords(read.result, profile, targetTopic, scoped));
                    };
                } catch { finish(null); }
            };
        });
    }

    toPlayableWords(records, profile, targetTopic, scoped) {
        const legacyProfile = this.normalize(profile);
        const topic = this.normalize(targetTopic);
        const allWords = [];
        const topicWords = [];
        for (const record of records) {
            if (record?.deleted === true || typeof record?.word !== 'string') continue;
            const owner = typeof record.username === 'string' ? record.username.trim() : '';
            const belongsToProfile = scoped ? owner === profile
                : !legacyProfile || !owner || this.normalize(owner) === legacyProfile;
            if (!belongsToProfile) continue;

            const word = record.word.trim();
            if (!word) continue;
            const wordNorm = this.normalize(word);
            const related = Array.isArray(record.synonyms) ? record.synonyms
                : typeof record.synonyms === 'string' ? record.synonyms.split(',') : [];
            const synonyms = new Set();
            for (const candidate of [record.synonym1, record.synonym2, ...related]) {
                if (typeof candidate !== 'string') continue;
                const synonym = candidate.trim();
                if (synonym && this.normalize(synonym) !== wordNorm) synonyms.add(synonym);
            }
            if (!synonyms.size) continue;

            const entry = {
                word,
                synonyms: [...synonyms],
                meaning: record.meaning || "",
                topic: record.topic || "General",
                memoryStatus: record.memoryStatus || 'not_remembered',
                hasBeenStudied: Boolean(record.hasBeenStudied || record.reviewCount > 0)
            };
            allWords.push(entry);
            const topics = [record.topic, ...(Array.isArray(record.topics) ? record.topics : [])];
            if (topic && topics.some(tag => this.normalize(tag) === topic)) topicWords.push(entry);
        }
        const words = topicWords.length ? topicWords : allWords;
        return words.length ? words : null;
    }

    isValidVocabEntry(entry) {
        if (!entry || typeof entry.word !== 'string') return false;
        const w = this.normalize(entry.word);
        if (!w) return false;
        if (!Array.isArray(entry.synonyms) || entry.synonyms.length === 0) return false;
        const validSyns = entry.synonyms
            .map(s => this.normalize(s))
            .filter(s => s && s !== w);
        return validSyns.length > 0;
    }

    getRandomWord(excludeWords = "") {
        const excludeSet = new Set();
        if (typeof excludeWords === 'string' && excludeWords) {
            excludeSet.add(this.normalize(excludeWords));
        } else if (Array.isArray(excludeWords)) {
            excludeWords.forEach(w => {
                if (w) excludeSet.add(this.normalize(w));
            });
        } else if (excludeWords instanceof Set) {
            excludeWords.forEach(w => {
                if (w) excludeSet.add(this.normalize(w));
            });
        }

        if (!this.drawDeck || this.drawDeck.length === 0) {
            this.resetExhaustionDeck();
        }

        let chosen = null;
        let attempts = this.drawDeck.length;
        while (attempts > 0 && this.drawDeck.length > 0) {
            attempts--;
            const cand = this.drawDeck.pop();
            if (cand && this.isValidVocabEntry(cand) && !excludeSet.has(this.normalize(cand.word))) {
                chosen = cand;
                break;
            } else if (cand && this.isValidVocabEntry(cand)) {
                this.drawDeck.unshift(cand);
            }
        }

        if (!chosen) {
            for (const item of this.vocabularyList) {
                if (this.isValidVocabEntry(item) && !excludeSet.has(this.normalize(item.word))) {
                    chosen = item;
                    break;
                }
            }
        }

        if (!chosen) {
            for (const item of BUILTIN_IELTS_VOCABULARY) {
                if (this.isValidVocabEntry(item) && !excludeSet.has(this.normalize(item.word))) {
                    chosen = item;
                    break;
                }
            }
        }

        if (!chosen) {
            chosen = BUILTIN_IELTS_VOCABULARY[0];
        }

        this.playedHistory.push(chosen.word);
        return chosen;
    }

    getDifficultWord(excludeWords = "") {
        return this.getRandomWord(excludeWords);
    }
}

const vocabService = new VocabService();

window.vocabService = vocabService;
