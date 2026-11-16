/* js/rendering/player-effects.js — ordered classic script; entrypoints declare dependency order. */
function triggerShieldBreakEffect(x, y) {
    shockwaves.push(new ShockwaveRing(x, y, 55));
    for (let i = 0; i < 8; i++) {
        fireballs.push(new Fireball(x, y));
    }
}

function triggerShieldReadySparkle(x, y) {
    combatTexts.push(new CombatPopupText(x, y - 25, "SHIELD READY!", '#00F0FF'));
    shockwaves.push(new ShockwaveRing(x, y, 40));
}

function triggerEmpStormEffect(x, y) {
    shockwaves.push(new ShockwaveRing(x, y, 95));
    shockwaves.push(new ShockwaveRing(x, y, 65));
    screenShake = 14;
    ambientFlash = 0.45;
}
