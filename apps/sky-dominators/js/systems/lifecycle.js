/* js/systems/lifecycle.js — ordered classic script; entrypoints declare dependency order. */
function endGame() {
    if(lastEndGameSortieId===currentSortieId)return;
    player.endSquadron();player.boostTimer=0;bossEncounter.abort();bomberHazard.reset();clearTouchCommands();gameState='GAMEOVER';if(player.skinId==='skyborne'||player.skinId==='exalted')SkySkins.clear();
    if(typeof updateMobileControlsVisibility==='function')updateMobileControlsVisibility();
    const flight={id:currentSortieId,score:Math.min(999999,Math.max(0,score)),targetsCleared,aircraftIndex:player.aircraftIndex,completed:true,finishedAt:Date.now()};
    SkyProfile.complete(sortieOwner,flight);
    lastEndGameSortieId=currentSortieId;
    SkyUI.showResult(flight);
}

function resetGame() {
    SkyUI.stopPromotion();
    sortieOwner=SkyProfile.name;
    currentSortieId = 'sorties_'+crypto.randomUUID();
    bossEncounter.reset(currentSortieId);
    bomberHazard.reset();
    suspendedBossRows=[];SkySkins.clear();document.getElementById('dangerHUDContainer').style.visibility='';
    score = 0;
    targetsCleared = 0;
    destroyedRowsCount = 0;
    destroyedRowIds.clear();
    spawnInterval = INITIAL_SPAWN_INTERVAL; // Exactly 7.00s initial spawn interval
    spawnTimer = 0;
    lastFormationSpawnTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    enemyShootTimer = 0;
    enemyShootInterval = 2500;
    screenShake = 0;
    ambientFlash = 0;
    isPaused = false;

    let keepAircraftIndex=SkyProfile.selected;
    if (!isAircraftUnlocked(keepAircraftIndex)) {
        keepAircraftIndex = 0;
    }

    clearTouchCommands();
    mouse.active = false;
    player = new Player();
    player.setAircraft(keepAircraftIndex);
    SkySkins.emit(player.skinId,'frost_particles',player.x,player.y,85);
    armor = player.hp;
    updateAircraftUI();
    updateLeftHUD();

    bullets = [];
    enemyBullets = [];
    formations = [];
    animatedExplosions = [];
    shockwaves = [];
    fireballs = [];
    combatTexts = [];

    // Get two distinct target vocabulary entries for the initial two rows
    const initTarget1 = vocabService.getRandomWord();
    const initTarget2 = vocabService.getRandomWord(initTarget1.word);

    // FORMATION MANDATE: Always start with EXACTLY TWO ROWS of aircraft
    // row1 (front row, slot 1) gets initTarget1
    const row1 = new EnemyFormation(`form_init_1`, 3, initTarget1, 1);
    // row2 (rear row, slot 0) gets initTarget2
    const row2 = new EnemyFormation(`form_init_2`, 3, initTarget2, 0);
    formations.push(row2, row1);

    lastDangerTargetWord = "";
    missionManager.setMission(initTarget1);
    updateDangerHUDDisplay();

    gameState = 'PLAYING';

    document.getElementById('startOverlay').classList.add('hidden');
    document.getElementById('gameOverOverlay').classList.add('hidden');
    document.getElementById('detailedRecordsOverlay')?.classList.add('hidden');
    document.getElementById('pauseOverlay').classList.add('hidden');
    if (typeof updateMobileControlsVisibility === 'function') updateMobileControlsVisibility();
}

function togglePause() {
    if (gameState !== 'PLAYING' && gameState !== 'PAUSED') return;
    isPaused = !isPaused;
    gameState = isPaused ? 'PAUSED' : 'PLAYING';
    if (isPaused) {
        document.getElementById('pauseOverlay').classList.remove('hidden');
    } else {
        document.getElementById('pauseOverlay').classList.add('hidden');
    }
    if (typeof updateMobileControlsVisibility === 'function') updateMobileControlsVisibility();
}
