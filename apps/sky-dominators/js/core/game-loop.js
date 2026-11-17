/* js/core/game-loop.js — ordered classic script; entrypoints declare dependency order. */
let lastTime = performance.now();

function gameLoop(now) {
    updateCrossHairPreviews(now);
    SkySkins.updatePreviews(now);
    const dt = Math.min(now - lastTime, 100);
    lastTime = now;

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.save();
    renderedWorldOffset.x = 0;
    renderedWorldOffset.y = 0;
    if (screenShake > 0) {
        const sx = (Math.random() - 0.5) * screenShake;
        const sy = (Math.random() - 0.5) * screenShake;
        renderedWorldOffset.x = sx;
        renderedWorldOffset.y = sy;
        ctx.translate(sx, sy);
        screenShake *= 0.88;
        if (screenShake < 0.3) screenShake = 0;
    }

    terrain.update(dt);
    cloudManager.update(dt);

    if (gameState === 'PLAYING') {
        player.update(dt, keys, mouse);
        if (!isPaused) SkyExalted.updatePlayer(player, dt);
        bomberHazard.update(dt);
        processManualFire();

        if (!bossEncounter.blocksRegular) {
        // Formation spawn scheduling: Time-based authoritative scheduler
        spawnTimer += dt;
        if (spawnTimer >= spawnInterval) {
            spawnTimer = 0;
            spawnFormation();
        }

        for (const form of formations) {
            form.update(dt);
        }

        formations = formations.filter(f => !f.destroyed && f.y <= GAME_HEIGHT + 80);

        checkOvercrowding();

        // Priority 4: Enemy downward shooting from leading row
        enemyShootTimer += dt;
        if (enemyShootTimer >= enemyShootInterval) {
            enemyShootTimer = 0;
            enemyShootInterval = 2200 + Math.random() * 1200; // Slow, fair randomized rate (2.2s - 3.4s)
            const leadingForm = getLeadingFormation();
            if (leadingForm) {
                const livingHelos = leadingForm.aircraft.filter(a => a.active);
                if (livingHelos.length > 0) {
                    const shooter = livingHelos[Math.floor(Math.random() * livingHelos.length)];
                    enemyBullets.push(new EnemyBullet(shooter.x, shooter.y + 34));
                    try {
                        audio.playEnemyShoot();
                    } catch (e) {}
                }
            }
        }

        for (const eb of enemyBullets) eb.update(dt);
        enemyBullets = enemyBullets.filter(eb => eb.active);

        }
        for (const b of bullets) b.update(dt);
        bullets = bullets.filter(b => b.active);

        checkCollisions();
        bossEncounter.update(dt);
        SkySkins.update(dt);

        for (const exp of animatedExplosions) exp.update(dt);
        for (const s of shockwaves) s.update(dt);
        for (const f of fireballs) f.update(dt);
        for (const ct of combatTexts) ct.update(dt);

        animatedExplosions = animatedExplosions.filter(exp => !exp.finished);
        shockwaves = shockwaves.filter(s => s.active);
        fireballs = fireballs.filter(f => f.life > 0);
        combatTexts = combatTexts.filter(ct => ct.life > 0);
    }

    // Finish only Celestial's death burst after the run ends, without advancing combat.
    if(gameState==='GAMEOVER'){SkyCelestial.updateEffects(dt);SkySkins.updateHazardAfterGameOver(dt);}

    // 1. Draw Supplied Tiled Background
    terrain.drawGround(ctx);

    // 2. Draw Atmospheric Drifting Clouds (Decorative layer behind aircraft & formations)
    cloudManager.draw(ctx);

    // 3. Draw Formations & Enemy Helicopters
    for (const form of formations) {
        form.draw(ctx);
    }

    bossEncounter.draw(ctx,(c,path,x,y,w,h)=>SkySkins.fit(c,SkySkins.image(path),x,y,w,h));
    bomberHazard.draw(ctx,(c,path,x,y,w,h)=>SkySkins.fit(c,SkySkins.image(path),x,y,w,h));
    // 4. Draw Bullets & Enemy Bullets
    for (const b of bullets) b.draw(ctx);
    for (const eb of enemyBullets) eb.draw(ctx);

    // 5. Draw Modern-Classic Player Aircraft
    if (gameState === 'PLAYING' || gameState === 'START' || gameState === 'PAUSED') {
        player.draw(ctx);
    }

    // 6. Draw VFX (Sprite-sheet Animated Explosions, Shockwaves, Fireballs, Texts)
    for (const exp of animatedExplosions) exp.draw(ctx);
    for (const s of shockwaves) s.draw(ctx);
    for (const f of fireballs) f.draw(ctx);
    for (const ct of combatTexts) ct.draw(ctx);
    SkySkins.draw(ctx);

    // Ambient Flash
    if (ambientFlash > 0) {
        ctx.fillStyle = `rgba(239, 68, 68, ${ambientFlash})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ambientFlash *= 0.8;
        if (ambientFlash < 0.02) ambientFlash = 0;
    }

    ctx.restore();

    // 7. Draw Tactical HUD
    drawHUD();
    updateBossHealthHUD();

    requestAnimationFrame(gameLoop);
}
