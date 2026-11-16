/* js/systems/spawn.js — ordered classic script; entrypoints declare dependency order. */
function triggerDivingAttackIfEligible() {
    if (bossEncounter?.blocksRegular) return;
    // Find active formations with living helicopters that have finished entry animation
    const candidateFormations = formations.filter(f =>
        !f.destroyed &&
        !f.isEntering &&
        f.diveCooldown <= 0 &&
        f.aircraft.some(a => a.active && !a.isDiving)
    );

    if (candidateFormations.length === 0) return;

    // Prioritize frontmost formation first for tactical combat engagement
    candidateFormations.sort((a, b) => b.y - a.y);
    const targetFormation = candidateFormations[0];

    // Only one helicopter diving at a time per formation
    if (targetFormation.aircraft.some(a => a.isDiving)) return;

    const eligible = targetFormation.aircraft.filter(a => a.active && !a.isDiving);
    if (eligible.length > 0) {
        const diver = eligible[Math.floor(Math.random() * eligible.length)];
        diver.startDive(player.x, player.y);
        targetFormation.diveCooldown = 3500; // 3.5s cooldown preventing spam
    }
}

let destroyedRowsCount = 0;

const destroyedRowIds = new Set();

let spawnInterval = INITIAL_SPAWN_INTERVAL;

let spawnTimer = 0;

let lastFormationSpawnTime = 0;

let formationIdCounter = 1;

function onHelicopterRowDestroyed(row) {
    if (bossEncounter?.blocksRegular) return;
    if (!row || !row.id) return;
    if (destroyedRowIds.has(row.id)) return;

    // Count fully destroyed rows only: verify all helicopters in row are inactive
    const hasLivingHelo = row.aircraft && row.aircraft.some(a => a.active && a.hp > 0);
    if (hasLivingHelo) return;

    destroyedRowIds.add(row.id);
    row.destroyed = true;
    bomberHazard.endRound();
    destroyedRowsCount++;
    // User-defined enemy turn: each unique completed row, including mistakes and breaches.
    if (gameState === 'PLAYING' && player.hp > 0 &&
        (AIRCRAFT_CONFIGS[player.aircraftIndex] || {}).key === 'nightbat') {
        player.nightBatTurns++;
        if (player.nightBatTurns >= 7) {
            player.nightBatTurns -= 7;
            player.hp = Math.min(player.maxHp, player.hp + 1);
            updateLeftHUD();
        }
    }

    if (gameState === 'PLAYING' && player.hp > 0 &&
        AIRCRAFT_CONFIGS[player.aircraftIndex].key === 'chronos') {
        player.chronosTurns++;
        if (player.chronosTurns >= 12) {
            player.chronosTurns -= 12;
            player.chronosMaxHp = player.maxHp + 1;
            player.maxHp = player.chronosMaxHp;
            player.hp = Math.min(player.maxHp, player.hp + 1);
            // One new filled HP slot; maxHp - hp stays unchanged, so existing damage is not healed.
            updateLeftHUD();
        }
    }

    // Each unique completed row advances difficulty once; scheduling uses milliseconds.
    spawnInterval = Math.max(MIN_SPAWN_INTERVAL, spawnInterval - ROW_SPAWN_DECREMENT);
    if (gameState === 'PLAYING' && player.hp > 0) bossEncounter?.rowCompleted(destroyedRowsCount);
}

window.onHelicopterRowDestroyed = onHelicopterRowDestroyed;

window.destroyedRowIds = destroyedRowIds;

window.INITIAL_SPAWN_INTERVAL = INITIAL_SPAWN_INTERVAL;

window.MIN_SPAWN_INTERVAL = MIN_SPAWN_INTERVAL;

window.ROW_SPAWN_DECREMENT = ROW_SPAWN_DECREMENT;

Object.defineProperty(window, 'spawnInterval', {
    get: () => spawnInterval,
    set: (v) => { spawnInterval = v; },
    configurable: true
});

Object.defineProperty(window, 'spawnTimer', {
    get: () => spawnTimer,
    set: (v) => { spawnTimer = v; },
    configurable: true
});

Object.defineProperty(window, 'destroyedRowsCount', {
    get: () => destroyedRowsCount,
    set: (v) => { destroyedRowsCount = v; },
    configurable: true
});

window.getSpawnInterval = () => spawnInterval;

window.getSpawnTimer = () => spawnTimer;

window.getDestroyedRowsCount = () => destroyedRowsCount;

function spawnFormation() {
    if (bossEncounter?.blocksRegular) return;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (lastFormationSpawnTime > 0 && (now - lastFormationSpawnTime) < MIN_SPAWN_INTERVAL) {
        console.warn("[SpawnScheduler] Blocked spawn attempt earlier than 4.0s minimum interval.");
        return null;
    }
    lastFormationSpawnTime = now;

    // 1. Shift every existing active row down by exactly one slot
    for (const form of formations) {
        if (!form.destroyed) {
            form.shiftDownOneSlot();
        }
    }

    // 2. Collect all active target words from non-destroyed formations
    const activeTargets = formations
        .filter(f => !f.destroyed && f.targetWord)
        .map(f => f.targetWord.toLowerCase());

    const newVocab = vocabService.getRandomWord(activeTargets);

    // 3. Spawn the new row at the top (slot 0, y = 110)
    formationIdCounter++;
    const count = ((Math.random() < 0.5) ? 3 : 4);
    const newRow = new EnemyFormation(
        `form_${formationIdCounter}`,
        count,
        newVocab,
        0 // Top slot
    );
    formations.push(newRow);
    bomberHazard.notify(currentSortieId+":"+newRow.id,destroyedRowsCount+1,newRow);

    // Update danger HUD if front row was previously missing
    const front = getFrontmostFormation();
    if (front && front.vocabEntry) {
        missionManager.setMission(front.vocabEntry);
        updateDangerHUDDisplay();
    }

    // 4. Check danger boundary / overcrowding rule
    checkOvercrowding();

    return newRow;
}

function checkOvercrowding() {
    if (bossEncounter?.blocksRegular) return;
    if (gameState !== 'PLAYING') return;

    const activeFormations = formations.filter(f => !f.destroyed);

    // Check if active rows exceed 4 or any row reaches danger slot >= 5 (y = 485)
    const breached = activeFormations.filter(f => f.slotIndex >= DANGER_BOUNDARY_SLOT);
    const isOvercrowded = activeFormations.length > 4 || breached.length > 0;

    if (isOvercrowded) {
        if (typeof player !== 'undefined' && player.takeDamage) {
            player.takeDamage('BREACH', GAME_WIDTH / 2, 130);
        } else {
            armor = Math.max(0, armor - 1);
        }
        audio.playWarning();
        screenShake = 14;
        ambientFlash = 0.4;
        combatTexts.push(new CombatPopupText(GAME_WIDTH / 2, 130, "FORMATION BREACH! -1 HP", '#ef4444'));

        // Destroy the oldest / lowest formations that reached danger boundary
        activeFormations.sort((a, b) => b.y - a.y);
        const toDestroy = activeFormations.slice(0, Math.min(2, activeFormations.length));

        for (const f of toDestroy) {
            if (bossEncounter?.blocksRegular) break;
            f.destroyed = true;
            for (const a of f.aircraft) {
                if (a.active) {
                    a.active = false;
                    triggerCinematicExplosion(a.x, a.y, false);
                }
            }
            onHelicopterRowDestroyed(f);
        }

        advanceToNextMission();

        if (typeof player !== 'undefined' && player.hp <= 0) {
            endGame();
        }
    }
}
