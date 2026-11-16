/* js/core/world.js — ordered classic script; entrypoints declare dependency order. */
let player = new Player();

let bullets = [];

let enemyBullets = [];

let enemyShootTimer = 0;

let enemyShootInterval = 2500;

let formations = [];

window.player = player;

window.AIRCRAFT_CONFIGS = AIRCRAFT_CONFIGS;

Object.defineProperty(window, 'formations', { get: () => formations, set: (v) => { formations = v; }, configurable: true });

window.getFormations = () => formations;

window.bullets = bullets;

window.getActiveFormationRows = getActiveFormationRows;

window.getFrontmostFormation = getFrontmostFormation;

window.getSecondFormation = getSecondFormation;

window.missionManager = missionManager;
