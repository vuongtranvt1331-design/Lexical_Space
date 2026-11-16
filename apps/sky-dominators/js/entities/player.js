/* js/entities/player.js — ordered classic script; entrypoints declare dependency order. */
class Player {
    constructor() {
        this.x = GAME_WIDTH / 2;
        this.y = GAME_HEIGHT - 100;
        this.prevX = this.x;
        this.prevY = this.y;
        this.vx = 0;
        this.bank = 0;
        this.speed = 280; // px/s keyboard speed
        this.aircraftIndex = 0; // Active aircraft design (0 to 4)
        this.modelRotation = 0; // Model orientation in game coordinates
        this.boostTimer = 0;
        this.shootCooldown = 0;
        this.spaceShootCooldown = 0; // Independent manual Spacebar limit.
        this.wraithShotIndex = 0; // Advances only for accepted Wraith shots; survives firing pauses and skin changes.
        this.invulnerableTimer = 0;
        this.isMovingForward = false;

        // Shared 40-second Automatic Shield (Authoritative per player aircraft)
        this.shieldReady = true;
        this.shieldCooldownTimer = STANDARD_DEFENSE_RECOVERY_MS; // Ready initially
        this.shieldFlashTimer = 0;

        // Health & Armor State
        this.hp = 3;
        this.maxHp = 3;
        this.maxArmor = 0;
        this.armorUnits = [];
        this.armorRecoveryInterval = STANDARD_DEFENSE_RECOVERY_MS;

        // Active Skill State (Fighter 1, Phantom, Phantom Prototype)
        this.skillCooldownTimer = 0;
        this.skillActiveTimer = 0;
        this.lockedTarget = null;

        // Phantom Squadron State (Phantom Prototype)
        this.squadronActive = false;
        this.squadronTimer = 0;
        this.squadronShootTimer = 0;
        this.squadronGeneration = 0;
        this.wingmen = [];

        this.classDefenseStates = new Map();
        this.rotorAngle = 0;
        this.nightBatTurns = 0;
        this.chronosTurns = 0;
        this.chronosMaxHp = 1;
        this.chronosRescueCooldown = 0;
        this.chronosBulletImmunity = 0;
        this.applyAircraftClass(0);
    }

    hasStandardShield() {
        const key = AIRCRAFT_CONFIGS[this.aircraftIndex].key;
        return key !== 'titan' && key !== 'nightbat';
    }

    initArmorUnits(count, interval) {
        this.maxArmor = count || 0;
        this.armorRecoveryInterval = interval || STANDARD_DEFENSE_RECOVERY_MS;
        this.armorUnits = [];
        for (let i = 0; i < this.maxArmor; i++) {
            this.armorUnits.push({
                id: i,
                active: true,
                timer: this.armorRecoveryInterval,
                maxTimer: this.armorRecoveryInterval,
                progress: 1.0
            });
        }
    }

    get armor() {
        if (!this.armorUnits) return 0;
        return this.armorUnits.filter(u => u.active).length;
    }

    set armor(val) {
        if (!this.armorUnits) return;
        const target = Math.max(0, Math.min(this.maxArmor, Number(val) || 0));
        let count = 0;
        for (let i = 0; i < this.armorUnits.length; i++) {
            if (count < target) {
                this.armorUnits[i].active = true;
                this.armorUnits[i].timer = this.armorUnits[i].maxTimer;
                this.armorUnits[i].progress = 1.0;
                count++;
            } else {
                this.armorUnits[i].active = false;
                this.armorUnits[i].timer = 0;
                this.armorUnits[i].progress = 0;
            }
        }
    }

    applyAircraftClass(index) {
        if (index < 0 || index >= AIRCRAFT_CONFIGS.length || !isAircraftUnlocked(index)) {
            index = isAircraftUnlocked(this.aircraftIndex) ? this.aircraftIndex : 0;
        }
        const cfg = AIRCRAFT_CONFIGS[index];
        this.boostTimer = 0;
        this.aircraftIndex = index;
        this.speed = cfg.speed || 280;
        this.width = cfg.width;
        this.height = cfg.height;
        this.hitboxWidth = Math.round(this.width * 1.30 * 10) / 10;
        this.hitboxHeight = Math.round(this.height * 1.30 * 10) / 10;

        const prevMax = this.maxHp || 3;
        this.maxHp = cfg.key === 'chronos' ? this.chronosMaxHp : cfg.maxHp;

        // Initialize class-specific independent armor units
        const recInterval = STANDARD_DEFENSE_RECOVERY_MS * (cfg.key === 'titan' ? TITAN_ARMOR_RECOVERY_MULTIPLIER : 1);
        if (this.currentDefenseState) this.currentDefenseState.skillCooldown = this.skillCooldownTimer;
        let defense = this.classDefenseStates.get(index);
        if (!defense) {
            this.initArmorUnits(cfg.maxArmor, recInterval);
            defense = {units: this.armorUnits, skillCooldown: 0};
            this.classDefenseStates.set(index, defense);
        }
        this.currentDefenseState = defense;
        this.maxArmor = cfg.maxArmor;
        this.armorRecoveryInterval = recInterval;
        this.armorUnits = defense.units;
        this.skillCooldownTimer = defense.skillCooldown;

        // If at full health or uninitialized, set to maxHp; otherwise preserve damage
        if (this.hp === undefined || this.hp >= prevMax) {
            this.hp = this.maxHp;
        } else {
            this.hp = Math.max(1, Math.min(this.hp, this.maxHp));
        }

        // Clean up active skill state if switching during active skill
        this.skillActiveTimer = 0;
        this.lockedTarget = null;
        this.endSquadron();

        // Apply original aircraft appearance for this aircraft class
        this.applyAircraftImage();
    }

    applyAircraftImage() {
        SkySkins.apply(this);
    }

    updateDimensions() {
        const cfg = AIRCRAFT_CONFIGS[this.aircraftIndex] || AIRCRAFT_CONFIGS[0];
        this.width = cfg.width;
        this.height = cfg.height;
        this.hitboxWidth = Math.round(this.width * 1.30 * 10) / 10;
        this.hitboxHeight = Math.round(this.height * 1.30 * 10) / 10;
    }

    setAircraft(index) {
        if (index >= 0 && index < AIRCRAFT_CONFIGS.length) {
            if (!isAircraftUnlocked(index)) return false;
            if (index === this.aircraftIndex) { this.applyAircraftImage(); return true; }
            this.applyAircraftClass(index);
            this.applyAircraftImage();
            if (assets.aircraft && assets.aircraft[index]) {
                assets.player = assets.aircraft[index];
            }
            if (typeof updateAircraftUI === 'function') updateAircraftUI();
            if (typeof updateHangarModalUI === 'function') updateHangarModalUI();
            if (typeof updateLeftHUD === 'function') updateLeftHUD();
            if (typeof updateSkillButtonUI === 'function') updateSkillButtonUI();
            return true;
        }
        return false;
    }

    endSquadron() {
        const active = this.squadronActive;
        const generation = this.squadronGeneration;
        this.squadronActive = false;
        this.squadronTimer = 0;
        this.squadronShootTimer = 0;
        this.wingmen = [];
        if (active) {
            for (const bullet of bullets) {
                if (bullet.isSpecial && bullet.skillGeneration === generation) bullet.active = false;
            }
        }
    }

    triggerActiveSkill() {
        if (gameState !== 'PLAYING' || isPaused || (bossEncounter && !bossEncounter.canShoot)) return false;
        const cfg = AIRCRAFT_CONFIGS[this.aircraftIndex];
        if (!cfg || !cfg.hasActiveSkill) return false;
        if (this.skillCooldownTimer > 0) return false;

        if (cfg.key === 'bomber') return launchBomberStrike();
        if (cfg.key === 'corsair') {
            if(this.boostTimer>0)return false;
            this.boostTimer=cfg.skillDuration;this.skillCooldownTimer=cfg.skillCooldown;
            try{audio.playLaserShoot();}catch{}
            updateSkillButtonUI();return true;
        }

        if (cfg.key === 'chronos') {
            if (this.hp >= this.maxHp) return false;
            this.skillCooldownTimer = cfg.skillCooldown;
            this.hp = Math.min(this.maxHp, this.hp + 1);
            combatTexts.push(new CombatPopupText(this.x, this.y - 25, '+1 HP', '#38bdf8'));
            updateLeftHUD();
            return true;
        }

        if (this.aircraftIndex === 0) {
            // Fighter 1: Target Lock (35s cooldown, 8s active target indicator)
            this.skillCooldownTimer = cfg.skillCooldown; // 35000
            this.skillActiveTimer = cfg.skillDuration;   // 8000
            this.findPriorityTarget();
            SkySkins.emit(this.skinId,'ability_activation',this.x,this.y,100);
            try { audio.playLaserShoot(); } catch (e) {}
            combatTexts.push(new CombatPopupText(this.x, this.y - 25, "TARGET LOCK (8s)!", '#00F0FF'));
            updateSkillButtonUI();
            return true;
        }

        if (this.aircraftIndex === 2) {
            // Phantom: Electromagnetic Storm (30s cooldown, delays next spawn by 7s)
            this.skillCooldownTimer = cfg.skillCooldown; // 30000
            spawnTimer = Math.max(-7000, spawnTimer - 7000);
            triggerEmpStormEffect(this.x, this.y);
            try { audio.playExplosion(true); } catch (e) {}
            combatTexts.push(new CombatPopupText(this.x, this.y - 25, "EMP STORM! +7s SPAWN DELAY", '#a855f7'));
            updateSkillButtonUI();
            return true;
        }

        if (this.aircraftIndex === 4) {
            // Phantom Prototype: Phantom Squadron (60s cooldown, summons 4 wingmen)
            if (this.squadronActive) return false; // Guard against duplicate activation during active skill
            if (this.skillCooldownTimer > 0) return false;

            // Commit the cost only after all availability checks have passed.
            if (!this.shieldReady && this.hp <= 1) return false;
            let popupCostText;
            if (this.hasStandardShield() && this.shieldReady) {
                this.shieldReady = false;
                this.shieldCooldownTimer = 0;
                popupCostText = 'PHANTOM SQUADRON! (SHIELD CONSUMED)';
            } else {
                this.hp -= 1;
                popupCostText = 'PHANTOM SQUADRON! (-1 HP)';
                // An already depleted shield keeps its original recovery timer.
            }

            updateLeftHUD();

            // Start cooldown and skill duration immediately to guard against duplicate input events
            this.skillCooldownTimer = cfg.skillCooldown; // 60000
            this.squadronGeneration++;
            this.squadronActive = true;
            this.squadronTimer = cfg.skillDuration; // 4000
            this.squadronShootTimer = 0;

            // Reposition main Phantom Prototype to center of playable area
            this.x = GAME_WIDTH / 2;
            this.y = GAME_HEIGHT - 100;

            // Summon 4 supporting aircraft arranged 2 on left, 2 on right
            this.wingmen = [
                { id: 'L2', offsetX: -80, offsetY: 25 },
                { id: 'L1', offsetX: -40, offsetY: 12 },
                { id: 'R1', offsetX:  40, offsetY: 12 },
                { id: 'R2', offsetX:  80, offsetY: 25 }
            ];

            try { audio.playLaserShoot(); } catch (e) {}
            combatTexts.push(new CombatPopupText(this.x, this.y - 30, popupCostText, '#38bdf8'));
            updateSkillButtonUI();
            return true;
        }

        return false;
    }

    findPriorityTarget() {
        if(bossEncounter?.blocksRegular&&bossEncounter.canShoot){this.lockedTarget=bossEncounter.priorityTarget();return this.lockedTarget;}
        const activeRows = getActiveFormationRows();
        if (activeRows.length === 0) {
            this.lockedTarget = null;
            return null;
        }
        const frontRow = activeRows[0];
        const living = frontRow.aircraft.filter(a => a.active);
        if (living.length === 0) {
            this.lockedTarget = null;
            return null;
        }
        // Highlight the target that the player needs to shoot (the correct answer helicopter in the front row)
        const correctTarget = living.find(a => a.isCorrect);
        if (correctTarget) {
            this.lockedTarget = correctTarget;
        } else {
            // Fallback to closest living front helicopter
            living.sort((a, b) => Math.abs(a.x - this.x) - Math.abs(b.x - this.x));
            this.lockedTarget = living[0];
        }
        return this.lockedTarget;
    }

    takeDamage(source = 'PROJECTILE', hitX = this.x, hitY = this.y) {
        const key = (AIRCRAFT_CONFIGS[this.aircraftIndex] || {}).key;
        if ((key === 'viper' && (source === 'PROJECTILE' || source === 'RAM')) ||
            (key === 'chronos' && this.chronosBulletImmunity > 0 && (source === 'PROJECTILE' || source === 'BOSS_PROJECTILE'))) {
            return { absorbedBy: 'IMMUNITY', hpLost: 0, fatal: false };
        }
        // 1. Process Automatic Shield First
        if (this.hasStandardShield() && this.shieldReady) {
            this.shieldReady = false;
            this.shieldCooldownTimer = 0; // Immediate 40s recharge
            this.shieldFlashTimer = 350;
            screenShake = 6;
            ambientFlash = 0.2;
            try { audio.playPlayerHit(); } catch (e) {}
            triggerShieldBreakEffect(this.x, this.y);
            combatTexts.push(new CombatPopupText(this.x, this.y - 25, "SHIELD ABSORBED!", '#00F0FF'));
            const shieldBlock = document.getElementById('shieldIndicatorBlock');
            if (shieldBlock) {
                shieldBlock.classList.add('broken-flash');
                setTimeout(() => shieldBlock.classList.remove('broken-flash'), 350);
            }
            updateLeftHUD();
            return { absorbedBy: 'SHIELD', hpLost: 0, fatal: false };
        }

        // 2. Process Independent Armor Units (Titan 2 units)
        const activeArmorUnit = this.armorUnits ? this.armorUnits.find(u => u.active) : null;
        if (activeArmorUnit) {
            activeArmorUnit.active = false;
            activeArmorUnit.timer = 0;
            activeArmorUnit.progress = 0;
            screenShake = 10;
            ambientFlash = 0.3;
            try { audio.playPlayerHit(); } catch (e) {}
            const absorbedText = (this.maxArmor > 1) ? `ARMOR #${activeArmorUnit.id + 1} ABSORBED!` : "ARMOR ABSORBED!";
            combatTexts.push(new CombatPopupText(this.x, this.y - 25, absorbedText, '#d97706'));
            updateLeftHUD();
            return { absorbedBy: 'ARMOR', hpLost: 0, fatal: false };
        }

        // Rescue only damage that would otherwise kill; shields absorb first.
        if (key === 'chronos' && this.hp === 1 && this.chronosRescueCooldown === 0) {
            this.chronosRescueCooldown = 300000;
            this.chronosBulletImmunity = 5000;
            combatTexts.push(new CombatPopupText(this.x, this.y - 25, 'TEMPORAL RESCUE! 5s', '#38bdf8'));
            updateLeftHUD();
            return { absorbedBy: 'TEMPORAL_RESCUE', hpLost: 0, fatal: false };
        }

        // 3. Deduct Health Point (HP)
        this.hp = Math.max(0, this.hp - 1);
        screenShake = 12;
        ambientFlash = 0.35;
        try {
            audio.playPlayerHit();
            if (this.hp === 1) audio.playWarning();
        } catch (e) {}

        // Animate depleted HP block
        const depletedBlock = document.getElementById(`hpBlock_${this.hp}`);
        if (depletedBlock) {
            depletedBlock.classList.add('deplete-anim');
            setTimeout(() => depletedBlock.classList.remove('deplete-anim'), 350);
        }

        combatTexts.push(new CombatPopupText(this.x, this.y - 25, "HULL HIT! -1 HP", '#ef4444'));
        updateLeftHUD();

        if (this.hp <= 0) {
            triggerCinematicExplosion(this.x, this.y, true, ['celestial','hazard'].includes(this.skinId)?this.skinId:null);
            endGame();
            return { absorbedBy: 'NONE', hpLost: 1, fatal: true };
        }

        return { absorbedBy: 'NONE', hpLost: 1, fatal: false };
    }

    update(dt, keys, mouse) {
        const boostActive = AIRCRAFT_CONFIGS[this.aircraftIndex].key === 'corsair' && this.boostTimer > 0;
        const boostScale = boostActive ? 1 + (AIRCRAFT_CONFIGS[this.aircraftIndex].boostMultiplier - 1) * Math.min(dt,this.boostTimer)/Math.max(1,dt) : 1;
        const movementLocked=false; // Continental no longer disables player movement.
        const movementSpeed = this.speed * boostScale * (movementLocked?0:1);
        const follow = Math.min(.9,((AIRCRAFT_CONFIGS[this.aircraftIndex] || {}).touchFollow || .18) * boostScale) * (movementLocked?0:1);
        this.boostTimer = Math.max(0,(this.boostTimer||0)-dt);
        if (gameState === 'PLAYING' && !isPaused) {
            this.chronosRescueCooldown = Math.max(0, this.chronosRescueCooldown - dt);
            this.chronosBulletImmunity = Math.max(0, this.chronosBulletImmunity - dt);
        }
        this.rotorAngle = (this.rotorAngle + dt * Math.PI * 6 / 1000) % (Math.PI * 2);
        this.prevX = this.x;
        this.prevY = this.y;
        let moved = false;
        let movingForward = false;

        let moveX = 0;
        let moveY = 0;

        const curKeys = (typeof keys !== 'undefined' && keys) ? keys : {};
        if (curKeys['ArrowLeft'] || curKeys['KeyA']) moveX -= 1;
        if (curKeys['ArrowRight'] || curKeys['KeyD']) moveX += 1;
        if (curKeys['ArrowUp'] || curKeys['KeyW']) moveY -= 1;
        if (curKeys['ArrowDown'] || curKeys['KeyS']) moveY += 1;

        moveX = Math.max(-1, Math.min(1, moveX));
        moveY = Math.max(-1, Math.min(1, moveY));

        if (moveX !== 0 || moveY !== 0) {
            moved = true;
            // Normalized speed vector: 1 / sqrt(2) so diagonal is never faster than normal speed
            let speedMult = 1.0;
            if (moveX !== 0 && moveY !== 0) {
                speedMult = Math.SQRT1_2;
            }
            this.x += moveX * speedMult * (movementSpeed * dt / 1000);
            this.y += moveY * speedMult * (movementSpeed * dt / 1000);
            if (moveY < 0) {
                movingForward = true;
            }
        }

        if (moved) {
            // Keyboard steering takes ownership; no pullback when keys are released.
            clearTouchDestination();
            mouse.active = false;
        }
        if (!moved && touchDestination.active) {
            const dx = touchDestination.x - this.x;
            const dy = touchDestination.y - this.y;
            this.x += dx * follow;
            this.y += dy * follow;
            if (dy < -4) movingForward = true;
        } else if (!moved && mouse.active) {
            const dx = mouse.x - this.x;
            const dy = mouse.y - this.y;
            this.x += dx * follow;
            this.y += dy * follow;
            if (dy < -4) {
                movingForward = true;
            }
        }

        this.x = Math.max(30, Math.min(GAME_WIDTH - 30, this.x));
        this.y = Math.max(120, Math.min(GAME_HEIGHT - 45, this.y));

        if (touchDestination.active && !movementLocked) {
            touchDestination.arrived = Math.hypot(
                touchDestination.x - this.x, touchDestination.y - this.y
            ) <= ARRIVAL_TOLERANCE;
            if (touchDestination.arrived) {
                this.x = touchDestination.x;
                this.y = touchDestination.y;
            }
        }

        this.vx = this.x - this.prevX;
        const BANK_MAX_RAD = 30 * Math.PI / 180;
        let targetTilt = 0;
        if (curKeys['ArrowLeft'] || curKeys['KeyA']) {
            targetTilt = -BANK_MAX_RAD;
        } else if (curKeys['ArrowRight'] || curKeys['KeyD']) {
            targetTilt = BANK_MAX_RAD;
        } else if (Math.abs(this.vx) > 0.4) {
            targetTilt = Math.sign(this.vx) * BANK_MAX_RAD * Math.min(1, Math.abs(this.vx) / 3.5);
        }
        this.bank += (targetTilt - this.bank) * 0.22;
        this.isMovingForward = movingForward;
        this.updateCosmeticSkin(dt);

        if (this.shootCooldown > 0) this.shootCooldown -= dt;
        this.spaceShootCooldown = Math.max(0, this.spaceShootCooldown - dt);
        if (this.invulnerableTimer > 0) this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
        if (this.shieldFlashTimer > 0) this.shieldFlashTimer = Math.max(0, this.shieldFlashTimer - dt);

        // Shared 40-second Automatic Shield Recharge
        if (!this.shieldReady && gameState === 'PLAYING' && !isPaused) {
            this.shieldCooldownTimer += dt;
            if (this.shieldCooldownTimer >= STANDARD_DEFENSE_RECOVERY_MS) {
                this.shieldCooldownTimer = STANDARD_DEFENSE_RECOVERY_MS;
                this.shieldReady = true;
                if (this.hasStandardShield()) triggerShieldReadySparkle(this.x, this.y);
                updateLeftHUD();
            }
        }

        for (const state of this.classDefenseStates.values()) {
            if (state === this.currentDefenseState) continue;
            state.skillCooldown = Math.max(0, state.skillCooldown - dt);
            for (const unit of state.units) if (!unit.active) {
                unit.timer = Math.min(unit.maxTimer, unit.timer + dt);
                unit.progress = unit.timer / unit.maxTimer;
                if (unit.timer === unit.maxTimer) unit.active = true;
            }
        }
        // Independent Armor Units Recovery (each unit tracks its own recovery timer independently)
        if (this.armorUnits && this.armorUnits.length > 0 && gameState === 'PLAYING' && !isPaused) {
            for (let i = 0; i < this.armorUnits.length; i++) {
                const unit = this.armorUnits[i];
                if (!unit.active) {
                    unit.timer = Math.min(unit.maxTimer, unit.timer + dt);
                    unit.progress = Math.min(1.0, unit.timer / unit.maxTimer);
                    if (unit.timer >= unit.maxTimer) {
                        unit.active = true;
                        unit.timer = unit.maxTimer;
                        unit.progress = 1.0;
                        const restoredText = (this.maxArmor > 1) ? `ARMOR #${i + 1} RESTORED!` : "ARMOR RESTORED!";
                        combatTexts.push(new CombatPopupText(this.x, this.y - 25, restoredText, '#10b981'));
                        try { audio.playLaserShoot(); } catch (e) {}
                        updateSkillButtonUI();
                    }
                }
            }
        }

        // Active Skill Cooldown
        if (this.skillCooldownTimer > 0 && gameState === 'PLAYING' && !isPaused) {
            this.skillCooldownTimer -= dt;
            if (this.skillCooldownTimer < 0) this.skillCooldownTimer = 0;
        }

        // Active Skill Running Duration (Fighter 1)
        if (this.skillActiveTimer > 0 && gameState === 'PLAYING' && !isPaused) {
            this.skillActiveTimer -= dt;
            if (this.skillActiveTimer <= 0) {
                this.skillActiveTimer = 0;
                this.lockedTarget = null;
            } else {
                if (!this.lockedTarget || !this.lockedTarget.active || (bossEncounter?.blocksRegular && !bossEncounter.targets().includes(this.lockedTarget))) {
                    this.findPriorityTarget();
                }
            }
        }

        // Phantom Squadron Running Duration (Phantom Prototype)
        if (this.squadronActive && gameState === 'PLAYING' && !isPaused) {
            this.squadronTimer -= dt;
            if (this.squadronTimer <= 0) { this.endSquadron(); return; }
            this.squadronShootTimer += dt;

            // Coordinated barrage every 180ms
            if (this.squadronShootTimer >= 180 && !isDestinationTraveling() && (!bossEncounter || bossEncounter.canShoot)) {
                this.squadronShootTimer = 0;
                bullets.push(new Bullet(this.x, this.y - 30, true));
                for (const w of this.wingmen) {
                    bullets.push(new Bullet(this.x + w.offsetX, this.y + w.offsetY - 20, true));
                    try { audio.playShoot(); } catch (e) {}
                }
                try { audio.playShoot(); } catch (e) {}

                // Screen-clearing attack: damage eligible on-screen enemies
                const activeRows = getActiveFormationRows();
                if (activeRows.length > 0) {
                    const front = activeRows[0];
                    const living = front.aircraft.filter(a => a.active && a.hp > 0 && a.y >= 0 && a.y <= GAME_HEIGHT);
                    if (living.length > 0) {
                        const target = living[Math.floor(Math.random() * living.length)];
                        handleHelicopterHit(target, front, true, 'phantom_prototype', this.squadronGeneration, {skinId:this.skinId,isSpecial:true,attackerKey:'phantom_prototype'});
                    }
                }
            }


        }
    }

    updateCosmeticSkin(dt) {
        if(gameState==='PLAYING'&&!isPaused)SkyPrismCore.updatePlayer(this,dt);
        if(gameState==='PLAYING'&&!isPaused)SkyCelestial.updatePlayer(this,dt);
        if(this.skinId!=='ornithopter'||AIRCRAFT_CONFIGS[this.aircraftIndex].key!=='corsair'){this.ornithopter=null;return;}
        if(gameState!=='PLAYING'||isPaused)return;
        this.ornithopter ||= new SkyOrnithopter.WingDynamics();
        this.ornithopter.update(dt,{dy:this.y-this.prevY});
    }

    shoot(source = 'default') {
        if (gameState !== 'PLAYING' || isPaused || this.hp <= 0 || this.shootCooldown > 0 || isDestinationTraveling() || (bossEncounter && !bossEncounter.canShoot)) return false;
        if (source === 'space' && this.spaceShootCooldown > 0) return false;
        if (source === 'space') this.spaceShootCooldown = 500;
        this.shootCooldown = 150; // Existing cooldown for touch and other shot sources.
        const cfg = AIRCRAFT_CONFIGS[this.aircraftIndex] || AIRCRAFT_CONFIGS[0];
        const spawnY = this.y - Math.round(cfg.height / 2) - 2;

        // Projectile behavior is selected by the existing Bullet implementation.
        bullets.push(new Bullet(this.x, spawnY));
        if (!SkySkins.emitSkyborneShot(this,bullets[bullets.length-1])) SkySkins.emit(this.skinId,'muzzle_flash',this.x,spawnY,30);

        try { audio.playShoot(); } catch (e) {}
        return true;
    }

    draw(ctx) {
        // 1. Draw 4 Translucent Phantom Squadron Wingmen (approx 30% opacity)
        if (this.squadronActive && this.wingmen.length > 0) {
            ctx.save();
            ctx.globalAlpha = 0.30;
            const wingmanImg = (this.aircraftImage && this.aircraftImage.complete && this.aircraftImage.naturalWidth > 0)
                ? this.aircraftImage
                : ((assets.aircraft && assets.aircraft[4]) || assets.player);
            const pw = 48;
            const ph = 66;

            for (const w of this.wingmen) {
                const wx = Math.round(this.x + w.offsetX);
                const wy = Math.round(this.y + w.offsetY);

                // Flame exhaust
                if (assets.flames && assets.flames[4] && assets.flames[4].small) {
                    ctx.drawImage(assets.flames[4].small, wx - 6, wy + 26, 12, 22);
                }

                if (wingmanImg && wingmanImg.complete && wingmanImg.naturalWidth > 0) {
                    ctx.drawImage(wingmanImg, wx - pw / 2, wy - ph / 2, pw, ph);
                } else {
                    ctx.fillStyle = '#0284c7';
                    ctx.fillRect(wx - pw / 2, wy - ph / 2, pw, ph);
                }
            }
            ctx.restore();
        }

        // 2. Draw Fighter 1 Target Lock holographic reticle tracking locked target
        if (this.aircraftIndex === 0 && this.skinId !== 'red_wraith' && this.skinId !== 'exalted' && this.skillActiveTimer > 0 && this.lockedTarget && this.lockedTarget.active) {
            ctx.save();
            const tx = this.lockedTarget.x;
            const ty = this.lockedTarget.y;
            const rot = (Date.now() / 400) % (Math.PI * 2);

            ctx.translate(tx, ty);
            ctx.rotate(rot);
            ctx.strokeStyle = '#00F0FF';
            ctx.lineWidth = 1.8;
            ctx.shadowColor = '#00F0FF';
            ctx.shadowBlur = 8;

            // Holographic brackets
            const s = 24;
            ctx.beginPath();
            // Top-left
            ctx.moveTo(-s, -s + 8); ctx.lineTo(-s, -s); ctx.lineTo(-s + 8, -s);
            // Top-right
            ctx.moveTo(s - 8, -s); ctx.lineTo(s, -s); ctx.lineTo(s, -s + 8);
            // Bottom-right
            ctx.moveTo(s, s - 8); ctx.lineTo(s, s); ctx.lineTo(s - 8, s);
            // Bottom-left
            ctx.moveTo(-s + 8, s); ctx.lineTo(-s, s); ctx.lineTo(-s, s - 8);
            ctx.stroke();

            // Central diamond
            ctx.beginPath();
            ctx.moveTo(0, -5); ctx.lineTo(5, 0); ctx.lineTo(0, 5); ctx.lineTo(-5, 0); ctx.closePath();
            ctx.stroke();

            ctx.restore();

            // Non-rotating Target Label above indicator
            ctx.save();
            ctx.font = 'bold 9px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#00F0FF';
            ctx.shadowColor = '#00F0FF';
            ctx.shadowBlur = 6;
            ctx.fillText('▼ TARGET ▼', tx, ty - 28);
            ctx.restore();
        }

        SkySkins.drawTarget(ctx,this,bossEncounter?.boss);
        // 3. Draw Shield Aura when Ready or Shield Flash when Broken
        if (this.skinId !== 'exalted' && this.hasStandardShield() && this.shieldReady) {
            ctx.save();
            const pulse = 0.28 + 0.12 * Math.sin(Date.now() / 250);
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = '#00F0FF';
            ctx.lineWidth = 1.6;
            ctx.shadowColor = '#00F0FF';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.width * 0.75, this.height * 0.70, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        if (this.shieldFlashTimer > 0) {
            ctx.save();
            ctx.globalAlpha = Math.min(1.0, this.shieldFlashTimer / 250);
            ctx.fillStyle = '#00F0FF';
            ctx.shadowColor = '#00F0FF';
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width * 0.9, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 4. Draw Player Aircraft Body & Engine Flames
        ctx.save();
        const px = Math.round(this.x);
        const py = Math.round(this.y);
        ctx.translate(px, py);
        const cfg = AIRCRAFT_CONFIGS[this.aircraftIndex] || AIRCRAFT_CONFIGS[0];
        const modelRot = (cfg.rotation !== undefined ? cfg.rotation : (this.modelRotation || 0));
        ctx.rotate(this.bank + modelRot);

        if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
            ctx.globalAlpha = 0.35;
        }

        const pw = cfg.width;
        const ph = cfg.height;

        // CrossHair uses rotors for lift; projectile exhaust effects are unchanged.
        if (cfg.key === 'bomber' && this.hp > 0 && gameState === 'PLAYING') SkySkins.bomberExhaust(ctx,this,cfg);
        if (this.isMovingForward && this.skinId !== 'exalted' && cfg.key !== 'corsair' && cfg.key !== 'bomber' && !SkySkins.exhaust(ctx,this.skinId,cfg)) {
            const flamePair = assets.flames ? assets.flames[this.aircraftIndex] : null;
            const isPulse = (Math.floor(Date.now() / 90) % 3 === 0);
            const flameImg = (isPulse && flamePair && flamePair.large) ? flamePair.large : (flamePair ? flamePair.small : null);

            if (flameImg && flameImg.complete && flameImg.naturalWidth > 0) {
                const fw = isPulse ? Math.round(cfg.flameWidth * 1.15) : cfg.flameWidth;
                const fh = isPulse ? Math.round(cfg.flameHeight * 1.25) : cfg.flameHeight;

                for (let i = 0; i < cfg.exhausts.length; i++) {
                    const ex = cfg.exhausts[i];
                    const exX = Math.round(ex.xRatio * pw);
                    const exY = Math.round(ex.yRatio * ph);
                    const fx = Math.round(exX - fw / 2);
                    const fy = Math.round(exY - 2);
                    ctx.drawImage(flameImg, fx, fy, fw, fh);
                }
            }
        }

        // Aircraft Body
        const acImg = (this.aircraftImage && this.aircraftImage.complete && this.aircraftImage.naturalWidth > 0)
            ? this.aircraftImage
            : ((assets.aircraft && assets.aircraft[this.aircraftIndex]) ? assets.aircraft[this.aircraftIndex] : assets.player);
        if (SkySkins.drawBody(ctx,this,cfg)) { /* Composite already includes body and lightning aura. */ }
        else if (acImg && acImg.complete && acImg.naturalWidth > 0) {
            if (cfg.key === 'bomber') SkySkins.fit(ctx,acImg,0,0,pw,ph);
            else ctx.drawImage(acImg, -Math.round(pw / 2), -Math.round(ph / 2), pw, ph);
        } else {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-Math.round(pw / 2), -Math.round(ph / 2), pw, ph);
        }

        if (cfg.key === 'corsair') drawCrossHairRotor(ctx, pw, ph, this.rotorAngle,this.skinId);
        else SkySkins.bodyEffects(ctx,this.skinId,cfg);
        ctx.restore();
    }
}
