/* js/systems/collisions.js — ordered classic script; entrypoints declare dependency order. */
function handleHelicopterHit(enemy, row, isFrontRow, attackerClass, skillGeneration = null, projectile = null) {
    if (bossEncounter?.blocksRegular) return;
    if (!enemy || !row || enemy.formation !== row || !row.aircraft.includes(enemy)) return;
    if (!enemy.active || enemy.hp <= 0) return;
    if (row && row.destroyed) return;

    if (!attackerClass && typeof player !== 'undefined' && player) {
        const cfg = AIRCRAFT_CONFIGS[player.aircraftIndex];
        attackerClass = cfg ? cfg.key : 'fighter_1';
    }

    const isPhantomSkillAttack = attackerClass === 'phantom_prototype' &&
        skillGeneration !== null && player.aircraftIndex === 4 && player.squadronActive &&
        player.squadronTimer > 0 && skillGeneration === player.squadronGeneration;
    if (skillGeneration !== null && !isPhantomSkillAttack) return;

    // Apply Class-Specific Damage System (Corsair 1-shot, Titan 2-shots, Standard 2-shots):
    const hitResult = enemy.takeHit(attackerClass);
    // Visual mark only, after the existing validated hit; never changes damage.
    SkyExalted.onHit(player, enemy, projectile);

    if (!hitResult.destroyed) {
        // Non-lethal hit on a living helicopter:
        // Rule 1 & 6: Hitting a living helicopter must NOT reveal correctness.
        // No score penalty, no correctness audio, no popup text.
        screenShake = 3;
        return;
    }

    // HELICOPTER DESTROYED:
    if (isFrontRow === undefined) {
        isFrontRow = (row === getFrontmostFormation());
    }

    // Trigger the row-wide destruction effect only once per row, even if multiple projectiles hit different helicopters in the same frame.
    if (row.destroyed) return; // Atomic guard against duplicate row clears
    if (enemy.hp > 0) return;
    row.destroyed = true;
    // Attribute death visuals to the fatal projectile, even if the equipped skin has since changed.
    const deathImpact = triggerEnemyDestruction(enemy, true, projectile);

    // Evaluate correctness only at the exact moment of destruction.
    // Determine correctness using the destroyed helicopter's own assigned vocabulary question and answer mapping, not whichever question happens to be displayed on screen.
    const normAns = (enemy.answerWord || "").toString().trim().toLowerCase();
    const isGenuineSynonym = Array.isArray(row.validSynonyms) && row.validSynonyms.some(s => (s || "").toString().trim().toLowerCase() === normAns);
    const isTargetMatch = (enemy.targetWord || "").toString().trim().toLowerCase() === (row.targetWord || "").toString().trim().toLowerCase();
    const isActuallyCorrect = enemy.isCorrect && isGenuineSynonym && isTargetMatch;

    // Check if this attack originated from Phantom Prototype's active skill


    if (isActuallyCorrect) {
        // Correct answer helicopter destroyed:
        // Trigger destruction of the entire formation row without correctness audio or score penalties.
        targetsCleared++;
        score = Math.min(999999, score + 500);
        screenShake = 8;
        combatTexts.push(new CombatPopupText(enemy.x, enemy.y, isFrontRow ? "+500 ROW CLEARED!" : "+500 ROW 2 CLEARED!", '#10b981'));

        // Remove all helicopters in the destroyed row from active collision detection and gameplay
        for (const a of row.aircraft) {
            if (a.active) {
                a.active = false;
                triggerEnemyDestruction(a, a === enemy, projectile);
            }
        }

        // Count fully destroyed row for progressive acceleration (once per row)
        onHelicopterRowDestroyed(row);

        // If front row was cleared, advance to promote next row and activate its preassigned question
        if (isFrontRow) {
            advanceToNextMission();
        }
    } else {
        // Wrong answer helicopter destroyed:
        // If destroyed while Phantom Prototype's skill is active, DO NOT inflict health loss or armor penalty on player!
        if (!isPhantomSkillAttack) {
            if (!enemy.penaltyApplied) {
                enemy.penaltyApplied = true;
                if (typeof player !== 'undefined' && player.takeDamage) {
                    player.takeDamage('WRONG_ANSWER', enemy.x, enemy.y);
                } else {
                    armor = Math.max(0, armor - 1);
                }
            }

            screenShake = 12;
            ambientFlash = 0.3;
            combatTexts.push(new CombatPopupText(enemy.x, enemy.y, isFrontRow ? "INCORRECT! ROW WIPED" : "INCORRECT! ROW 2 WIPED", '#ef4444'));
        } else {
            // Phantom Prototype skill strike: helicopter destroyed normally without player health loss side-effect
            screenShake = 6;
            combatTexts.push(new CombatPopupText(enemy.x, enemy.y, "SQUADRON STRIKE!", '#38bdf8'));
        }

        // Remove all helicopters in the destroyed row from active collision detection and gameplay
        for (const a of row.aircraft) {
            if (a.active) {
                a.active = false;
                triggerEnemyDestruction(a, a === enemy, projectile);
            }
        }

        // Count fully destroyed row for progressive acceleration (once per row)
        onHelicopterRowDestroyed(row);

        if (typeof player !== 'undefined' && player.hp <= 0) {
            triggerCinematicExplosion(player.x, player.y, true, ['celestial','hazard'].includes(player.skinId)?player.skinId:null);
            endGame();
            return deathImpact;
        }

        // If front row was wiped, advance to promote next row and activate its preassigned question
        if (isFrontRow) {
            advanceToNextMission();
        }
    }
    return deathImpact;
}

window.handleHelicopterHit = handleHelicopterHit;

function checkCollisions() {
    if (bossEncounter?.blocksRegular) return;
    // 1. Check Player Bullets vs Active Formation Rows (Enforce Front-to-Back Combat)
    const activeRows = getActiveFormationRows();
    const frontRow = activeRows.length > 0 ? activeRows[0] : null;
    const secondRow = activeRows.length > 1 ? activeRows[1] : null;
    const attackerKey = (AIRCRAFT_CONFIGS[player.aircraftIndex] || {}).key || 'fighter_1';

    for (let bi = bullets.length - 1; bi >= 0; bi--) {
        if (bossEncounter?.blocksRegular) break;
        const b = bullets[bi];
        if (!b.active || b.bomberSpecial) continue;
        if (bossEncounter?.blocksRegular) break;
        if (b.isSpecial && (!player.squadronActive || player.squadronTimer <= 0 ||
            player.aircraftIndex !== 4 || b.skillGeneration !== player.squadronGeneration)) {
            b.active = false;
            continue;
        }

        if (!frontRow && !secondRow) continue;

        let hitRegistered = false;

        // Priority 1: Check frontmost active row (absorbs projectile if in trajectory)
        if (frontRow && !frontRow.destroyed) {
            for (const enemy of frontRow.aircraft) {
                if (!enemy.active) continue;

                const hitW = enemy.width * 0.7;
                const hitH = enemy.height * 0.7;

                if (Math.abs(b.x - enemy.x) < hitW && Math.abs(b.y - enemy.y) < hitH) {
                    const hasDeathImpact = !!SkySkins.enemyDestructionSequence(b.skinId);
                    if (!hasDeathImpact) SkySkins.impact(b.skinId,b.skinId==='skyborne'?b.x:enemy.x,b.skinId==='skyborne'?b.y:enemy.y);
                    b.active = false;
                    hitRegistered = true;
                    const deathImpact = handleHelicopterHit(enemy, frontRow, true, b.isSpecial ? 'phantom_prototype' : (b.isHoming ? 'reaper' : attackerKey), b.isSpecial ? b.skillGeneration : null, b);
                    if (hasDeathImpact && !deathImpact) SkySkins.impact(b.skinId,b.skinId==='skyborne'?b.x:enemy.x,b.skinId==='skyborne'?b.y:enemy.y);
                    break;
                }
            }
        }

        // Priority 2: If bullet did not hit front row, check second row (unblocked lane / exposed helicopter)
        if (!hitRegistered && secondRow && !secondRow.destroyed) {
            for (const enemy of secondRow.aircraft) {
                if (!enemy.active) continue;

                const hitW = enemy.width * 0.7;
                const hitH = enemy.height * 0.7;

                if (Math.abs(b.x - enemy.x) < hitW && Math.abs(b.y - enemy.y) < hitH) {
                    const hasDeathImpact = !!SkySkins.enemyDestructionSequence(b.skinId);
                    if (!hasDeathImpact) SkySkins.impact(b.skinId,b.skinId==='skyborne'?b.x:enemy.x,b.skinId==='skyborne'?b.y:enemy.y);
                    b.active = false;
                    hitRegistered = true;
                    const deathImpact = handleHelicopterHit(enemy, secondRow, false, b.isSpecial ? 'phantom_prototype' : (b.isHoming ? 'reaper' : attackerKey), b.isSpecial ? b.skillGeneration : null, b);
                    if (hasDeathImpact && !deathImpact) SkySkins.impact(b.skinId,b.skinId==='skyborne'?b.x:enemy.x,b.skinId==='skyborne'?b.y:enemy.y);
                    break;
                }
            }
        }
    }

    if (bossEncounter?.blocksRegular) return;
    // 2. Check Enemy Bullets vs Player Jet (Priority 4)
    for (let ebi = enemyBullets.length - 1; ebi >= 0; ebi--) {
        const eb = enemyBullets[ebi];
        if (!eb.active) continue;

        // Respect invulnerability cooldown to prevent multi-hit damage in consecutive frames
        if (player.invulnerableTimer > 0) continue;

        // Requirement 1: 30% enlarged hitbox against enemy projectiles (1.3 * 18 = 23.4, 1.3 * 22 = 28.6)
        // Centered on (player.x, player.y), scaling proportionally with player model
        const pBulletHitW = ((player.hitboxWidth || (player.width * 1.30)) * 0.5) * 0.78; // approx 23.4px
        const pBulletHitH = ((player.hitboxHeight || (player.height * 1.30)) * 0.5) * 0.65; // approx 28.6px

        if (Math.abs(eb.x - player.x) < pBulletHitW && Math.abs(eb.y - player.y) < pBulletHitH) {
            eb.active = false;
            player.invulnerableTimer = 1200; // Apply invulnerability cooldown to prevent rapid multi-hits
            player.takeDamage('PROJECTILE', eb.x, eb.y);
        }
    }

    // 3. Physical Collision Mechanic: Player Aircraft vs Enemy Helicopter
    if (player.invulnerableTimer <= 0) {
        // Requirement 1: Player aircraft hitbox increased by 30% (1.3 * w and 1.3 * h)
        // Enemy helicopter hitboxes remain at original dimensions
        const pBoxW = (player.hitboxWidth || (player.width * 1.30)) * 0.5;
        const pBoxH = (player.hitboxHeight || (player.height * 1.30)) * 0.5;

        for (const form of formations) {
            if (form.destroyed) continue;

            let collisionOccurred = false;
            let hitEnemy = null;

            for (const enemy of form.aircraft) {
                if (!enemy.active) continue;

                const collideDistX = (pBoxW + enemy.width * 0.5) * 0.70;
                const collideDistY = (pBoxH + enemy.height * 0.5) * 0.65;

                if (Math.abs(player.x - enemy.x) < collideDistX && Math.abs(player.y - enemy.y) < collideDistY) {
                    collisionOccurred = true;
                    hitEnemy = enemy;
                    break;
                }
            }

            if (collisionOccurred) {
                if ((AIRCRAFT_CONFIGS[player.aircraftIndex] || {}).key === 'viper') continue;
                const isFront = (form === getFrontmostFormation());
                // Apply cooldown / invulnerability period to prevent repeated deductions
                player.invulnerableTimer = 1200; // ms

                // Process damage through unified player system (Shield -> Titan Armor -> HP)
                player.takeDamage('RAM', player.x, player.y);

                // Instantly destroy every enemy helicopter belonging to the same row
                form.destroyed = true;
                let hadTarget = false;

                for (const a of form.aircraft) {
                    if (a.active) {
                        a.active = false;
                        if (a.isCorrect) hadTarget = true;
                        triggerCinematicExplosion(a.x, a.y, a === hitEnemy);
                    }
                }

                // Count fully destroyed row for progressive acceleration (once per row)
                onHelicopterRowDestroyed(form);

                // Remove active bullets to prevent destroyed row from firing further
                enemyBullets = [];

                // If the destroyed row contained the target synonym, award points & advance mission
                if (hadTarget) {
                    score = Math.min(999999, score + 500);
                    if (isFront) {
                        advanceToNextMission();
                    }
                    combatTexts.push(new CombatPopupText(player.x, player.y - 25, "RAM IMPACT! +500 ROW CLEARED", '#10b981'));
                } else {
                    if (isFront) {
                        advanceToNextMission();
                    }
                    combatTexts.push(new CombatPopupText(player.x, player.y - 25, "RAM IMPACT! ROW DESTROYED -1 HP", '#ef4444'));
                }

                targetsCleared++;

                if (player.hp <= 0) {
                    triggerCinematicExplosion(player.x, player.y, true, ['celestial','hazard'].includes(player.skinId)?player.skinId:null);
                    endGame();
                    return;
                }

                // Only collide with one row per event
                break;
            }
        }
    }
}
