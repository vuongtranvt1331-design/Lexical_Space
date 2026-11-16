/* js/systems/input.js — ordered classic script; entrypoints declare dependency order. */
const keys = {};

const mouse = { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 100, active: false };

const touchDestination = { x: 0, y: 0, active: false, arrived: false };

const ARRIVAL_TOLERANCE = 2;

let pendingTouchShots = 0;

const activeTouchContacts = new Set();

function clearTouchCommands() {
    pendingTouchShots = 0;
    activeTouchContacts.clear();
    clearTouchDestination();
}

function registerTouchCommand(event) {
    if (gameState !== 'PLAYING' || isPaused || player.hp <= 0) return false;
    const coords = getCanvasCoordinates(event);
    if (!Number.isFinite(coords.x) || !Number.isFinite(coords.y)) return false;
    selectTouchDestination(coords);
    pendingTouchShots++;
    return true;
}

function selectTouchDestination(coords) {
    touchDestination.x = Math.max(30, Math.min(GAME_WIDTH - 30, coords.x));
    touchDestination.y = Math.max(120, Math.min(GAME_HEIGHT - 45, coords.y));
    touchDestination.active = true;
    touchDestination.arrived = player.x === touchDestination.x && player.y === touchDestination.y;
    mouse.active = false;
}

function clearTouchDestination() {
    touchDestination.active = false;
    touchDestination.arrived = false;
}

function isDestinationTraveling() {
    // Check actual coordinates too: an outdated arrival flag must never authorize a shot.
    return touchDestination.active && (!touchDestination.arrived ||
        player.x !== touchDestination.x || player.y !== touchDestination.y);
}

let mobileModeActive = false;

function updateMobileControlsVisibility() {
    const controls = document.getElementById('mobileControlsContainer');
    if (!controls) return;
    const isTouchOrNarrow = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 768);
    if (gameState === 'PLAYING' && !isPaused && isTouchOrNarrow) {
        controls.style.display = 'block';
    } else {
        controls.style.display = 'none';
        resetMobileControls();
    }
}

window.updateMobileControlsVisibility = updateMobileControlsVisibility;

function resetMobileControls() {
    // Clear held keys on pause/menu transitions, retaining the flight destination on pause.
    for (const code of Object.keys(keys)) keys[code] = false;
}

window.resetMobileControls = resetMobileControls;

function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width ? (GAME_WIDTH / rect.width) : 1;
    const scaleY = rect.height ? (GAME_HEIGHT / rect.height) : 1;
    let clientX = e.clientX;
    let clientY = e.clientY;

    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    }

    return {
        // Client coordinates are CSS pixels: the logical-size ratio already accounts
        // for responsive scaling and DPR. Undo the last rendered world shake as well.
        x: (clientX - rect.left) * scaleX - renderedWorldOffset.x,
        y: (clientY - rect.top) * scaleY - renderedWorldOffset.y
    };
}

window.addEventListener('keydown', (e) => {
    audio.init();
    keys[e.code] = true;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault();
    }
    if (e.code === 'KeyP') {
        togglePause();
    }
    if (e.code === 'KeyE' || e.code === 'KeyQ') {
        player.triggerActiveSkill();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

function handleCanvasMouseMove(e) {
    if (touchDestination.active || e.sourceCapabilities?.firesTouchEvents) return;
    const coords = getCanvasCoordinates(e);
    mouse.x = coords.x;
    mouse.y = coords.y;
    mouse.active = true;
}

function handleCanvasMouseDown(e) {
    if (e.button !== 0 || touchDestination.active || e.sourceCapabilities?.firesTouchEvents) return;
    audio.init();
    const coords = getCanvasCoordinates(e);
    if (checkHangarTap(coords)) return;
    clearTouchDestination();
    mouse.x = coords.x;
    mouse.y = coords.y;
    mouse.active = true;
}

if ('PointerEvent' in window) {
    canvas.addEventListener('pointerdown', (e) => {
        if (e.target !== canvas) return;
        if (e.pointerType === 'mouse') {
            handleCanvasMouseDown(e);
            return;
        }
        if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
        e.preventDefault();
        if (activeTouchContacts.has(e.pointerId)) return;
        activeTouchContacts.add(e.pointerId);
        audio.init();
        if (checkHangarTap(getCanvasCoordinates(e))) return;
        registerTouchCommand(e);
    }, { passive: false });
    canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse') handleCanvasMouseMove(e);
    });
    const releasePointerContact = (e) => activeTouchContacts.delete(e.pointerId);
    window.addEventListener('pointerup', releasePointerContact);
    window.addEventListener('pointercancel', releasePointerContact);
} else {
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Suppress compatibility mouse events in legacy browsers.
        audio.init();
        for (const touch of Array.from(e.changedTouches)) {
            if (activeTouchContacts.has(touch.identifier)) continue;
            activeTouchContacts.add(touch.identifier);
            if (checkHangarTap(getCanvasCoordinates(touch))) continue;
            registerTouchCommand(touch);
        }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    const releaseTouchContact = (e) => {
        for (const touch of Array.from(e.changedTouches)) activeTouchContacts.delete(touch.identifier);
    };
    window.addEventListener('touchend', releaseTouchContact);
    window.addEventListener('touchcancel', releaseTouchContact);
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameState === 'PLAYING') {
        togglePause();
    }
});

window.addEventListener('blur', () => {
    if (gameState === 'PLAYING') {
        togglePause();
    }
});
