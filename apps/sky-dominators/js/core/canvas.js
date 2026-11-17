/* js/core/canvas.js — ordered classic script; entrypoints declare dependency order. */
const canvas = document.getElementById('gameCanvas');

const ctx = canvas.getContext('2d');

let bossEncounter = null;

let attackSerial = 0;

// Keep sprites square in world coordinates. Extra space expands the flight area.
const flightField = canvas.parentElement;
const flightInsets = { top: 0, right: 0, bottom: 0, left: 0 };
function resizeFlightField() {
    const { width, height } = flightField.getBoundingClientRect();
    if (!width || !height) return;
    const prevWidth = GAME_WIDTH, prevHeight = GAME_HEIGHT;
    const scale = Math.min(width / 540, height / 960);
    GAME_WIDTH = width / scale;
    GAME_HEIGHT = height / scale;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    const pixelsX = Math.max(1, Math.round(width * density));
    const pixelsY = Math.max(1, Math.round(height * density));
    if (canvas.width !== pixelsX) canvas.width = pixelsX;
    if (canvas.height !== pixelsY) canvas.height = pixelsY;
    ctx.setTransform(pixelsX / GAME_WIDTH, 0, 0, pixelsY / GAME_HEIGHT, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const style = getComputedStyle(flightField);
    for (const side of Object.keys(flightInsets)) {
        flightInsets[side] = (parseFloat(style.getPropertyValue('--flight-safe-' + side)) || 0) / scale;
    }
    if (Math.abs(GAME_WIDTH - prevWidth) > .01 || Math.abs(GAME_HEIGHT - prevHeight) > .01) {
        canvas.dispatchEvent(new CustomEvent('flightresize', {detail: {prevWidth, prevHeight}}));
    }
}
resizeFlightField();
if (window.ResizeObserver) new ResizeObserver(resizeFlightField).observe(flightField);
window.addEventListener('resize', resizeFlightField);
