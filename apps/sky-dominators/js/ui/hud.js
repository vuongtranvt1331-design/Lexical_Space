/* js/ui/hud.js — ordered classic script; entrypoints declare dependency order. */
function updateLeftHUD() {
    const scoreValEl = document.getElementById('hudScoreVal');
    if (scoreValEl) {
        scoreValEl.textContent = String(Math.min(999999, Math.max(0, score))).padStart(6, '0');
    }

    const container = document.getElementById('hudHealthSquares');
    if (!container || !player) return;

    const maxHp = player.maxHp || 3;
    const curHp = Math.max(0, player.hp !== undefined ? player.hp : maxHp);
    const maxArmor = player.maxArmor || 0;
    const shieldReady = player.shieldReady;
    const shieldProgress = Math.min(1.0, Math.max(0, (player.shieldCooldownTimer || 0) / STANDARD_DEFENSE_RECOVERY_MS));

    // Dynamic reconstruction of health + armor + shield row if structure changed
    const configKey = `${player.aircraftIndex}_${maxHp}_${maxArmor}`;
    if (container.dataset.renderedCfg !== configKey) {
        container.dataset.renderedCfg = configKey;
        container.innerHTML = '';

        // 1. HP Blocks (Green when available, Dark gray when lost)
        for (let i = 0; i < maxHp; i++) {
            const sq = document.createElement('div');
            sq.className = 'health-block-hp';
            sq.id = `hpBlock_${i}`;
            sq.title = `HP ${i + 1}/${maxHp}`;
            container.appendChild(sq);
        }

        // 2. Titan has exactly two independently recovering shield units
        if (maxArmor > 0) {
            for (let a = 0; a < maxArmor; a++) {
                const arm = document.createElement('div');
                arm.className = 'armor-indicator-sq';
                arm.id = `armorBlock_${a}`;
                arm.title = `ARMOR UNIT #${a + 1}`;

                const fill = document.createElement('div');
                fill.className = 'armor-fill-bar';
                fill.id = `armorFill_${a}`;
                arm.appendChild(fill);

                const lbl = document.createElement('span');
                lbl.className = 'armor-label-text';
                lbl.textContent = (maxArmor > 1) ? `A${a + 1}` : 'A';
                arm.appendChild(lbl);

                container.appendChild(arm);
            }
        }

        // 3. Separate Shield Block at end of row (Shared 40s Recharge)
        const shieldBlock = document.createElement('div');
        shieldBlock.className = 'shield-indicator-block';
        shieldBlock.id = 'shieldIndicatorBlock';
        shieldBlock.title = 'SHARED AUTOMATIC SHIELD (40s RECHARGE)';

        const fillBar = document.createElement('div');
        fillBar.className = 'shield-fill-bar';
        fillBar.id = 'shieldFillBar';
        shieldBlock.appendChild(fillBar);

        if (player.hasStandardShield()) container.appendChild(shieldBlock);
    }

    // Update HP Blocks
    for (let i = 0; i < maxHp; i++) {
        const sq = document.getElementById(`hpBlock_${i}`);
        if (!sq) continue;
        if (i < curHp) {
            sq.classList.remove('depleted');
        } else {
            sq.classList.add('depleted');
        }
    }

    // Update Independent Armor Blocks (Active = amber, Depleted = gray, Recovering = fill animation)
    if (maxArmor > 0 && player.armorUnits) {
        for (let a = 0; a < maxArmor; a++) {
            const unit = player.armorUnits[a];
            const arm = document.getElementById(`armorBlock_${a}`);
            const fill = document.getElementById(`armorFill_${a}`);
            if (!arm || !unit) continue;

            if (unit.active) {
                arm.className = 'armor-indicator-sq active';
                if (fill) fill.style.width = '100%';
                arm.title = `ARMOR UNIT #${a + 1} (ACTIVE 100%)`;
            } else if (unit.progress > 0 && unit.progress < 1) {
                arm.className = 'armor-indicator-sq recovering';
                if (fill) fill.style.width = `${(unit.progress * 100).toFixed(1)}%`;
                arm.title = `ARMOR UNIT #${a + 1} (RECOVERING ${Math.round(unit.progress * 100)}%)`;
            } else {
                arm.className = 'armor-indicator-sq depleted';
                if (fill) fill.style.width = '0%';
                arm.title = `ARMOR UNIT #${a + 1} (DEPLETED)`;
            }
        }
    }

    // Update Shield Block Progressive Recharge
    const shieldBlock = document.getElementById('shieldIndicatorBlock');
    const fillBar = document.getElementById('shieldFillBar');
    if (shieldBlock && fillBar) {
        if (shieldReady) {
            shieldBlock.classList.add('ready');
            fillBar.style.width = '100%';
        } else {
            shieldBlock.classList.remove('ready');
            fillBar.style.width = `${(shieldProgress * 100).toFixed(1)}%`;
        }
    }

    // Synchronize legacy armor variable for external telemetry
    window.armor = curHp;
    armor = curHp;

    // Update Active Ability and Cooldown UI
    updateSkillButtonUI();
}

function updateSkillButtonUI() {
    const btnContainer = document.getElementById('skillButtonContainer');
    const btn = document.getElementById('inGameSkillBtn');
    const hudBadge = document.getElementById('hudSkillBadge');
    if (!player) return;

    const cfg = AIRCRAFT_CONFIGS[player.aircraftIndex] || AIRCRAFT_CONFIGS[0];

    // Titan & Corsair: No active skill button
    if (!cfg.hasActiveSkill) {
        if (btnContainer) btnContainer.style.display = 'none';
        if (hudBadge) {
            if (player.aircraftIndex === 1) {
                hudBadge.textContent = 'TITAN: 2 ARMOR + 2-SHOT CANNON';
                hudBadge.style.color = '#d97706';
            } else if (player.aircraftIndex === 3) {
                hudBadge.textContent = 'CROSSHAIR: 1-SHOT DESTRUCTION';
                hudBadge.style.color = '#ef4444';
            } else {
                hudBadge.textContent = '';
            }
        }
        return;
    }

    // Fighter 1, Phantom, Phantom Prototype: Show button
    if (btnContainer) btnContainer.style.display = 'flex';

    const iconEl = document.getElementById('skillBtnIcon');
    const nameEl = document.getElementById('skillBtnName');
    const timerEl = document.getElementById('skillBtnTimer');

    if (iconEl) iconEl.textContent = cfg.skillIcon || '⚡';
    if (nameEl) nameEl.textContent = cfg.skillName || 'ABILITY';

    const isSkillRunning = (player.boostTimer > 0) || (player.skillActiveTimer > 0) || (player.squadronActive && player.squadronTimer > 0);
    if (isSkillRunning) {
        // Skill is actively running
        const activeMs = Math.max(player.boostTimer || 0, player.skillActiveTimer || 0, player.squadronTimer || 0);
        const sec = Math.ceil(activeMs / 1000);
        if (btn) {
            btn.className = 'tactical-skill-btn active-skill';
        }
        if (timerEl) timerEl.textContent = `ACTIVE ${sec}s`;
        if (hudBadge) {
            hudBadge.textContent = `${cfg.skillName.toUpperCase()}: ACTIVE (${sec}s)`;
            hudBadge.style.color = '#10b981';
        }
    } else if (player.skillCooldownTimer > 0) {
        // Skill is recharging on cooldown
        const sec = Math.ceil(player.skillCooldownTimer / 1000);
        if (btn) {
            btn.className = 'tactical-skill-btn cooldown';
        }
        if (timerEl) timerEl.textContent = `${sec}s`;
        if (hudBadge) {
            hudBadge.textContent = `${cfg.skillName.toUpperCase()}: RECHARGING (${sec}s)`;
            hudBadge.style.color = '#94a3b8';
        }
    } else {
        // Skill is ready!
        if (btn) {
            btn.className = 'tactical-skill-btn ready';
        }
        if (timerEl) timerEl.textContent = 'READY [E]';
        if (hudBadge) {
            if (player.aircraftIndex === 4) {
                const costNote = (player.armor > 0) ? '(-1 ARMOR)' : (player.hp > 1 ? '(-1 HP)' : '(0 HP)');
                hudBadge.textContent = `${cfg.skillName.toUpperCase()}: READY [E] ${costNote}`;
            } else {
                hudBadge.textContent = `${cfg.skillName.toUpperCase()}: READY [E]`;
            }
            hudBadge.style.color = '#00F0FF';
        }
    }
}

window.updateSkillButtonUI = updateSkillButtonUI;

function drawHUD() {
    // Requirement 3: Synchronize left HUD display every frame
    updateLeftHUD();
}
