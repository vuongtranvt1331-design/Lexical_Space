/* js/rendering/effects.js — ordered classic script; entrypoints declare dependency order. */
const cloudManager = new CloudManager();

let animatedExplosions = [];

let shockwaves = [];

let fireballs = [];

let combatTexts = [];

function triggerCinematicExplosion(x, y, isBig = false, sourceSkin = null) {
    audio.playExplosion(isBig);
    if (SkySkins.eliminate(sourceSkin,x,y,isBig)) return;
    animatedExplosions.push(new AnimatedExplosion(x, y, isBig));
    shockwaves.push(new ShockwaveRing(x, y, isBig ? 65 : 38));
    const count = isBig ? 18 : 10;
    for (let i = 0; i < count; i++) {
        fireballs.push(new Fireball(x, y));
    }
}

const enemyDeathEffects = new WeakSet();

function triggerEnemyDestruction(enemy, isBig = false, projectile = null, legacySkin = SkySkins.eliminationSkin(projectile)) {
    if (!(enemy instanceof EnemyAircraft) || enemyDeathEffects.has(enemy)) return false;
    enemyDeathEffects.add(enemy);
    const replaced = SkySkins.enemyDestruction(projectile?.skinId, enemy.x, enemy.y, isBig);
    if (replaced) audio.playExplosion(isBig);
    else triggerCinematicExplosion(enemy.x, enemy.y, isBig, legacySkin);
    return replaced;
}
