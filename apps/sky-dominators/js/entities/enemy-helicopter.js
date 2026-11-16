/* js/entities/enemy-helicopter.js — ordered classic script; entrypoints declare dependency order. */
class EnemyAircraft {
    constructor(formation, slotIndex, x, y, answerWord, isCorrect, totalSlots, offsetX = 0, offsetY = 0, modelIndex = 0, targetWord = "", meaning = "") {
        this.formation = formation;
        this.slotIndex = slotIndex;
        this.baseX = x;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.x = Math.round(x + offsetX);
        this.y = Math.round(y + offsetY);
        this.answerWord = (answerWord || "").toString().trim();
        this.isCorrect = !!isCorrect;
        this.totalSlots = totalSlots;
        this.modelIndex = modelIndex; // 0, 1, or 2 (3 distinct helicopter models)
        this.targetWord = targetWord || (formation ? formation.targetWord : "");
        this.meaning = meaning || (formation ? formation.meaning : "");
        // Consistent dimensions & visual scale across models
        this.width = 44;
        this.height = 62;
        this.active = true;
        this.hp = 2; // EXACTLY TWO HEALTH POINTS
        this.isDamaged = false; // Changes sprite to damaged on first hit
        this.penaltyApplied = false; // Atomic penalty flag: evaluated exactly once per destroyed aircraft
        this.rotorAngle = Math.random() * Math.PI * 2;
        this.rotorSpeed = 30; // radians per second

        // Requirement 3: Subtle Random Horizontal Movement (5-10px smooth oscillation with unique phase and speed)
        this.hoverPhase = Math.random() * Math.PI * 2;
        this.hoverSpeed = 1.4 + Math.random() * 0.8; // radians per second
        this.hoverAmp = 5 + Math.random() * 3.5; // 5.0 to 8.5 pixels amplitude (within 5-10px range)
        this.hoverX = 0;

        // Requirement 4: Diving-Attack Mechanic for Exactly 5-Helicopter Rows
        this.isDiving = false;
        this.diveState = 'IDLE'; // 'IDLE', 'DIVING', 'RETURNING'
        this.diveOffsetX = 0;
        this.diveOffsetY = 0;
        this.diveTargetOffsetX = 0;
        this.diveTargetOffsetY = 0;
        this.diveSpeedDown = 220; // px/s smooth controlled downward dive
        this.diveSpeedUp = 180;   // px/s smooth controlled return
    }

    takeHit(attackerClass) {
        if (!this.active || this.hp <= 0) return { destroyed: false };

        if (!attackerClass && typeof player !== 'undefined' && player) {
            const cfg = AIRCRAFT_CONFIGS[player.aircraftIndex];
            attackerClass = cfg ? cfg.key : 'fighter_1';
        }

        // 1. Corsair Passive: One-Shot Destruction
        if (attackerClass === 'corsair') {
            this.hp = 0;
            this.active = false;
            return { destroyed: true, hp: 0 };
        }

        // Titan and standard classes share normal enemy HP: two valid hits from full health.
        this.hp--;
        if (this.hp === 1) {
            this.isDamaged = true; // First hit: change to damaged state
            return { destroyed: false, hp: 1 };
        } else if (this.hp <= 0) {
            this.active = false; // Second hit: destroyed
            return { destroyed: true, hp: 0 };
        }
        return { destroyed: false, hp: this.hp };
    }

    startDive(playerX, playerY) {
        if (this.isDiving || !this.active) return;
        this.isDiving = true;
        this.diveState = 'DIVING';
        const currentY = this.formation.y + this.offsetY;
        const targetY = Math.min(GAME_HEIGHT - 120, (playerY || (GAME_HEIGHT - 75)) - 30);
        this.diveTargetOffsetY = Math.max(140, targetY - currentY);
        const diffX = (playerX || (GAME_WIDTH / 2)) - (this.baseX + this.offsetX);
        this.diveTargetOffsetX = Math.max(-60, Math.min(60, diffX * 0.5));
    }

    updateDive(dt) {
        if (!this.isDiving) return;
        const dtSec = dt / 1000;

        if (this.diveState === 'DIVING') {
            this.diveOffsetY += this.diveSpeedDown * dtSec;
            this.diveOffsetX += (this.diveTargetOffsetX - this.diveOffsetX) * (3.0 * dtSec);

            if (this.diveOffsetY >= this.diveTargetOffsetY) {
                this.diveState = 'RETURNING';
            }
        } else if (this.diveState === 'RETURNING') {
            this.diveOffsetY -= this.diveSpeedUp * dtSec;
            this.diveOffsetX += (0 - this.diveOffsetX) * (3.5 * dtSec);

            if (this.diveOffsetY <= 0) {
                this.diveOffsetY = 0;
                this.diveOffsetX = 0;
                this.diveState = 'IDLE';
                this.isDiving = false;
            }
        }
    }

    update(dt) {
        if (!this.active) return;

        // 1. Rotor spinning animation
        if (gameState === 'PLAYING' && !isPaused) {
            this.chronosRescueCooldown = Math.max(0, this.chronosRescueCooldown - dt);
            this.chronosBulletImmunity = Math.max(0, this.chronosBulletImmunity - dt);
        }
        this.rotorAngle = (this.rotorAngle + this.rotorSpeed * (dt / 1000)) % (Math.PI * 2);

        // 2. Requirement 3: Subtle individual hover oscillation (5-10px)
        this.hoverPhase += this.hoverSpeed * (dt / 1000);
        this.hoverX = Math.sin(this.hoverPhase) * this.hoverAmp;

        // 3. Requirement 4: Update dive attack trajectory if active
        this.updateDive(dt);

        // 4. Stable positional calculation bounded to screen edges
        const rawX = this.baseX + this.offsetX + this.hoverX + this.diveOffsetX;
        this.x = Math.max(26, Math.min(GAME_WIDTH - 26, Math.round(rawX)));
        this.y = Math.round(this.formation.y + this.offsetY + this.diveOffsetY);
    }

    draw(ctx) {
        if (!this.active) return;
        const activeRows = getActiveFormationRows();
        const isLeading = (activeRows.length > 0 && activeRows[0] === this.formation);
        const isSecondRow = (activeRows.length > 1 && activeRows[1] === this.formation);

        ctx.save();
        ctx.translate(Math.round(this.x), Math.round(this.y));

        // If behind the first two rows, draw with protected subtle dimming
        if (!isLeading && !isSecondRow) {
            ctx.globalAlpha = 0.55;
        } else if (isSecondRow) {
            ctx.globalAlpha = 0.90; // Second row clearly visible
        }

        // 1. Draw Enemy Helicopter Body (Intact vs Damaged based on HP)
        // Note: The new military helicopter models (enemy_1.png, enemy_2.png, enemy_3.png)
        // have their cockpits pointing DOWN toward the player.
        const heloPair = (assets.enemyHelicopters && assets.enemyHelicopters[this.modelIndex])
            ? assets.enemyHelicopters[this.modelIndex]
            : ((assets.enemyAircraft && assets.enemyAircraft[this.modelIndex]) ? assets.enemyAircraft[this.modelIndex] : null);
        const bodyImg = (this.hp === 1 || this.isDamaged)
            ? (heloPair && heloPair.damaged ? heloPair.damaged : assets.helicopterDamaged)
            : (heloPair && heloPair.intact ? heloPair.intact : assets.helicopterIntact);

        const hw = this.width;
        const hh = this.height;

        if (bodyImg && bodyImg.complete && bodyImg.naturalWidth > 0) {
            ctx.drawImage(bodyImg, -Math.round(hw / 2), -Math.round(hh / 2), hw, hh);
        } else {
            this.drawFallbackAircraft(ctx, hw, hh);
        }

        // 2. Draw Separate Animated Spinning Rotor attached to Helicopter Mast
        const rotorImg = assets.rotorBlade || assets.rotor1;
        if (rotorImg && rotorImg.complete && rotorImg.naturalWidth > 0) {
            const mastX = 0;
            const mastY = -2;
            const rw = 52;
            const rh = 52;
            ctx.save();
            ctx.translate(mastX, mastY);
            ctx.rotate(this.rotorAngle);
            ctx.drawImage(rotorImg, -Math.round(rw / 2), -Math.round(rh / 2), rw, rh);
            ctx.restore();
        }

        // Visual Status Indicator: Active Row vs Protected Rear Rows
        if (!isLeading) {
            // Protected rear rows maintain clean styling without targeting brackets
        } else {
            // Frontmost Active Target Row indicator: Clean retro targeting brackets at corners
            ctx.save();
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 1.2;
            const bSize = 5;
            const bx = hw / 2 + 2;
            const by = hh / 2 + 2;
            // Top-Left
            ctx.beginPath(); ctx.moveTo(-bx + bSize, -by); ctx.lineTo(-bx, -by); ctx.lineTo(-bx, -by + bSize); ctx.stroke();
            // Top-Right
            ctx.beginPath(); ctx.moveTo(bx - bSize, -by); ctx.lineTo(bx, -by); ctx.lineTo(bx, -by + bSize); ctx.stroke();
            // Bottom-Left
            ctx.beginPath(); ctx.moveTo(-bx + bSize, by); ctx.lineTo(-bx, by); ctx.lineTo(-bx, by - bSize); ctx.stroke();
            // Bottom-Right
            ctx.beginPath(); ctx.moveTo(bx - bSize, by); ctx.lineTo(bx, by); ctx.lineTo(bx, by - bSize); ctx.stroke();
            ctx.restore();
        }

        // Draw Health Indicator Bar
        ctx.fillStyle = this.hp === 2 ? '#10b981' : '#f59e0b';
        ctx.fillRect(-10, -hh / 2 - 4, this.hp === 2 ? 20 : 10, 2.5);

        ctx.restore(); // restores translate(this.x, this.y)

        // Requirement 4: Always display vocabulary answers for the first two enemy rows simultaneously
        if (isLeading || isSecondRow) {
            this.drawWordTag(ctx);
        }
    }

    drawFallbackAircraft(ctx, hw, hh) {
        const bodyGrad = ctx.createLinearGradient(-10, 0, 10, 0);
        if (this.hp === 1) {
            bodyGrad.addColorStop(0, '#450a0a');
            bodyGrad.addColorStop(0.5, '#7f1d1d');
            bodyGrad.addColorStop(1, '#292524');
        } else {
            if (this.modelIndex === 0) {
                bodyGrad.addColorStop(0, '#3f4f2c');
                bodyGrad.addColorStop(0.5, '#5c723f');
                bodyGrad.addColorStop(1, '#3f4f2c');
            } else if (this.modelIndex === 1) {
                bodyGrad.addColorStop(0, '#1e3a5f');
                bodyGrad.addColorStop(0.5, '#2563eb');
                bodyGrad.addColorStop(1, '#1e3a5f');
            } else {
                bodyGrad.addColorStop(0, '#7f1d1d');
                bodyGrad.addColorStop(0.5, '#dc2626');
                bodyGrad.addColorStop(1, '#7f1d1d');
            }
        }

        ctx.fillStyle = bodyGrad;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.fillRect(-hw / 2 + 4, -hh / 2 + 4, hw - 8, hh - 8);
    }

    drawWordTag(ctx) {
        ctx.save();
        ctx.translate(Math.round(this.x), Math.round(this.y));
        ctx.globalAlpha = 1.0; // Ensure full contrast and crisp readability

        // Requirement 3: Increase synonym-answer text size by 40% (from 10px to 14px)
        let tagFontSize = 14;
        ctx.font = `700 ${tagFontSize}px "Orbitron", monospace`;
        let tw = ctx.measureText(this.answerWord).width;
        const maxTagW = 108;

        while (tw > maxTagW - 10 && tagFontSize > 9) {
            tagFontSize -= 0.5;
            ctx.font = `700 ${tagFontSize}px "Orbitron", monospace`;
            tw = ctx.measureText(this.answerWord).width;
        }

        const tagW = Math.max(58, Math.min(maxTagW, Math.round(tw + 16)));
        const tagH = 22;
        const tagY = 34; // Centered below helicopter fuselage

        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.fillRect(-tagW / 2, tagY, tagW, tagH);

        ctx.strokeStyle = this.hp === 1 ? '#f59e0b' : '#38bdf8';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-tagW / 2, tagY, tagW, tagH);

        ctx.fillStyle = '#f1f5f9';
        ctx.font = `700 ${tagFontSize}px "Orbitron", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.answerWord, 0, tagY + tagH / 2);

        ctx.restore();
    }
}

const EnemyHelicopter = EnemyAircraft;
