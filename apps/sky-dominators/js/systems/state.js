/* js/systems/state.js — ordered classic script; entrypoints declare dependency order. */
let gameState = 'START';

let isPaused = false;

let score = 0;

let armor = 5;

const maxArmor = 5;

let targetsCleared = 0;

let screenShake = 0;

const renderedWorldOffset = { x: 0, y: 0 };

let ambientFlash = 0;

function getHealthStateColor(hp) {
    if (hp >= 5) return '#38bdf8'; // (1) Blue
    if (hp === 4) return '#10b981'; // (2) Green
    if (hp === 3) return '#d97706'; // (3) Dark yellow
    if (hp === 2) return '#facc15'; // (4) Light yellow
    return '#ef4444';               // (5) Red
}

let currentSortieId = 'sorties_'+crypto.randomUUID();

let lastEndGameSortieId = null;

let sortieOwner=SkyProfile.name;
