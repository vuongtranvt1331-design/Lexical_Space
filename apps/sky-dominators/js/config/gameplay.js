/* js/config/gameplay.js — ordered classic script; entrypoints declare dependency order. */
const GAME_WIDTH = 540;

const GAME_HEIGHT = 960;

const STANDARD_ENEMY_BULLET_SPEED = 190;

const FORMATION_START_Y = 110;

const FORMATION_ROW_SPACING = 85;

const DANGER_BOUNDARY_SLOT = 5;

const BACKGROUND_SCROLL_SPEED = 14;

const STANDARD_DEFENSE_RECOVERY_MS = 40000;

const TITAN_ARMOR_RECOVERY_MULTIPLIER = 0.70;

const HEALTH_COLOR_STATES = {
    5: { name: 'Blue', color: '#38bdf8', glow: '#0284c7' },
    4: { name: 'Green', color: '#10b981', glow: '#059669' },
    3: { name: 'Dark yellow', color: '#d97706', glow: '#b45309' },
    2: { name: 'Light yellow', color: '#facc15', glow: '#eab308' },
    1: { name: 'Red', color: '#ef4444', glow: '#dc2626' }
};

const INITIAL_SPAWN_INTERVAL = 7000;

const MIN_SPAWN_INTERVAL = 4000;

const ROW_SPAWN_DECREMENT = 100;
