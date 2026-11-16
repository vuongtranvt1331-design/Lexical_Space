/* js/ui/hangar.js — ordered classic script; entrypoints declare dependency order. */
let hangarPrevGameState = 'START';

let selectedHangarIndex = 0;

let nextMatchAircraftIndex = 0;

function checkHangarTap(coords) {
    // Hangar cannot be opened by tapping player during active gameplay
    if (!player || (gameState !== 'START' && gameState !== 'GAMEOVER')) return false;
    const dist = Math.hypot(coords.x - player.x, coords.y - player.y);
    if (dist < 48) {
        openHangarModal();
        return true;
    }
    return false;
}

function openHangarModal() {
    audio.init();
    // Strict game-state restriction: Hangar may ONLY be accessed before a match starts (START)
    // or after a match has ended (GAMEOVER). Strictly rejected during active flight (PLAYING / PAUSED).
    if (gameState !== 'START' && gameState !== 'GAMEOVER') {
        console.warn("[Hangar] Access denied during active gameplay. Current gameState:", gameState);
        return false;
    }
    hangarPrevGameState = gameState;
    const currentIdx = (typeof player !== 'undefined' && player) ? player.aircraftIndex : 0;
    selectedHangarIndex = isAircraftUnlocked(currentIdx) ? currentIdx : 0;
    updateHangarModalUI();
    document.getElementById('inGameHangarModal')?.classList.remove('hidden');
    SkyExalted.updatePreviews(performance.now());SkyCelestial.updatePreviews(performance.now());
    return true;
}

function closeHangarModal() {
    audio.init();
    document.getElementById('inGameHangarModal')?.classList.add('hidden');
    if (hangarPrevGameState === 'START') {
        document.getElementById('startOverlay')?.classList.remove('hidden');
        refreshMainMenuView();
    } else if (hangarPrevGameState === 'DETAILED_RECORDS') {
        document.getElementById('detailedRecordsOverlay')?.classList.remove('hidden');
    } else if (hangarPrevGameState === 'GAMEOVER') {
        document.getElementById('gameOverOverlay')?.classList.remove('hidden');
    }
}

function selectHangarAircraft(idx) {return SkyUI.selectAircraft(idx);}

function getHangarAircraftOrder() {
    const bottom = ['titan', 'phantom_prototype'];
    return AIRCRAFT_CONFIGS.map((cfg, index) => index)
        .filter(index => !bottom.includes(AIRCRAFT_CONFIGS[index].key))
        .concat(bottom.map(key => AIRCRAFT_CONFIGS.findIndex(cfg => cfg.key === key)).filter(index => index >= 0));
}

function updateHangarModalUI() {if(window.SkyUI)SkyUI.renderHangar();}

function updateAircraftUI() {
    updateHangarModalUI();
}

window.openHangarModal = openHangarModal;

window.closeHangarModal = closeHangarModal;

window.selectHangarAircraft = selectHangarAircraft;

window.updateHangarModalUI = updateHangarModalUI;

window.updateAircraftUI = updateAircraftUI;
