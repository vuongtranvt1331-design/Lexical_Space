/* js/systems/missions.js — ordered classic script; entrypoints declare dependency order. */
class MissionManager {
    constructor() {
        this.currentWord = "";
        this.validSynonyms = [];
        this.meaning = "";
        this.missionCount = 0;
        this.vocabEntry = null;
    }

    setMission(vocabEntry) {
        if (!vocabEntry || !vocabEntry.word) return;
        this.vocabEntry = vocabEntry;
        this.currentWord = (vocabEntry.word || "").toString().trim();
        this.validSynonyms = Array.isArray(vocabEntry.synonyms)
            ? vocabEntry.synonyms.map(s => (s || "").toString().trim()).filter(Boolean)
            : [];
        this.meaning = vocabEntry.meaning || "";
        this.missionCount++;
    }

    isAcceptedSynonym(answer) {
        const normAns = (answer || "").toString().trim().toLowerCase();
        if (!normAns) return false;
        return this.validSynonyms.some(s => (s || "").toString().trim().toLowerCase() === normAns);
    }
}

const missionManager = new MissionManager();

let isAdvancingMission = false;

function advanceToNextMission() {
    if (bossEncounter?.blocksRegular) return;
    if (isAdvancingMission) return;
    isAdvancingMission = true;
    try {
        // Find frontmost living formation
        const nextFront = getFrontmostFormation();
        if (nextFront && !nextFront.destroyed && nextFront.vocabEntry) {
            missionManager.setMission(nextFront.vocabEntry);
            updateDangerHUDDisplay();
        } else {
            // Pre-game idle state or temporary gap between scheduled spawns: preview a baseline vocabulary word
            const entry = vocabService.getRandomWord();
            if (entry) {
                missionManager.setMission(entry);
                updateDangerHUDDisplay();
            }
        }
    } finally {
        isAdvancingMission = false;
    }
}

window.advanceToNextMission = advanceToNextMission;

function pickNewMissionWord() {
    advanceToNextMission();
}

const setupDangerPanelWord = updateDangerHUDDisplay;
