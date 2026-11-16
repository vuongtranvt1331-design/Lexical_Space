/* js/systems/formations.js — ordered classic script; entrypoints declare dependency order. */
function getActiveFormationRows() {
    const active = formations.filter(f => !f.destroyed && f.aircraft && f.aircraft.some(a => a.active));
    active.sort((a, b) => {
        const effA = Math.max(a.y, (a.targetY !== undefined) ? a.targetY : -Infinity);
        const effB = Math.max(b.y, (b.targetY !== undefined) ? b.targetY : -Infinity);
        return effB - effA; // closest to player (largest Y) first
    });
    return active;
}

function getFrontmostFormation() {
    const rows = getActiveFormationRows();
    return rows.length > 0 ? rows[0] : null;
}

function getSecondFormation() {
    const rows = getActiveFormationRows();
    return rows.length > 1 ? rows[1] : null;
}

const getLeadingFormation = getFrontmostFormation;
