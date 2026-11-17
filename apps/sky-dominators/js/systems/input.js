/* Manual flight controls. Touch roles are assigned on press and retained until release. */
const keys = {};
const mouse = { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 100, active: false };
const firingContacts = new Set();
let tapPending = false;
const stick = { id: null, originX: 0, originY: 0, x: 0, y: 0 };
const stickElement = document.getElementById('touchShootBtn');
const STICK_RADIUS = 32;
const flightRoot = document.documentElement;
flightRoot.dataset.flightInput = window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';

function useFlightInput(mode) {
    if (flightRoot.dataset.flightInput === mode) return;
    clearTouchCommands();
    flightRoot.dataset.flightInput = mode;
    updateMobileControlsVisibility();
}

function flightInputEnabled() {
    return gameState === 'PLAYING' && !isPaused && player.hp > 0;
}

function stopSteering() {
    stick.id = null;
    stick.x = stick.y = 0;
    stickElement.hidden = true;
}

function clearTouchCommands() {
    firingContacts.clear();
    tapPending = false;
    mouse.active = false;
    stopSteering();
}

function resetMobileControls() {
    clearTouchCommands();
    for (const code of Object.keys(keys)) keys[code] = false;
}

function updateMobileControlsVisibility() {
    const visible = flightInputEnabled() && flightRoot.dataset.flightInput === 'touch';
    document.getElementById('mobileControlsContainer').style.display = visible ? 'block' : 'none';
    if (!flightInputEnabled()) resetMobileControls();
}

function isFireHeld() {
    return firingContacts.size > 0 || !!keys.Space;
}

function processManualFire() {
    // A short tap may start and end between animation frames. Never queue volleys.
    const requested = tapPending || isFireHeld();
    tapPending = false;
    if (requested && player.shoot()) triggerDivingAttackIfEligible();
}

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

function moveStick(contact) {
    const dx = contact.clientX - stick.originX, dy = contact.clientY - stick.originY;
    const length = Math.max(STICK_RADIUS, Math.hypot(dx, dy));
    stick.x = dx / length;
    stick.y = dy / length;
    stickElement.firstElementChild.style.transform = 'translate(' + stick.x * 23 + 'px,' + stick.y * 23 + 'px)';
}

function pressContact(contact, id, isMouse) {
    if (firingContacts.has(id) || stick.id === id) return;
    audio.init();
    if (checkHangarTap(getCanvasCoordinates(contact)) || !flightInputEnabled()) return;
    const rect = canvas.getBoundingClientRect();
    if (!isMouse) mouse.active = false;
    if (isMouse || contact.clientX >= rect.left + rect.width / 2) {
        firingContacts.add(id);
        if (player.shootCooldown <= 0) tapPending = true;
        if (isMouse) followMouse(contact);
        return;
    }
    if (stick.id !== null) return;
    stick.id = id;
    stick.originX = contact.clientX;
    stick.originY = contact.clientY;
    stickElement.style.left = (stick.originX - rect.left) + 'px';
    stickElement.style.top = (stick.originY - rect.top) + 'px';
    moveStick(contact);
    stickElement.hidden = false;
}

function releaseContact(id, cancelled) {
    const wasFiring = firingContacts.delete(id);
    if (stick.id === id) stopSteering();
    if (cancelled && wasFiring && !firingContacts.size) tapPending = false;
}

function followMouse(e) {
    if (stick.id !== null || e.sourceCapabilities?.firesTouchEvents) return;
    Object.assign(mouse, getCanvasCoordinates(e), {active: true});
}

window.addEventListener('keydown', e => {
    audio.init();
    keys[e.code] = true;
    if (['Space','ArrowUp','ArrowDown'].includes(e.code) && flightInputEnabled()) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'KeyP') togglePause();
    if (e.code === 'KeyE' || e.code === 'KeyQ') player.triggerActiveSkill();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

if ('PointerEvent' in window) {
    // Track the actual device even when the first interaction is on a menu or HUD button.
    document.addEventListener('pointerdown', e => {
        if (e.pointerType) useFlightInput(e.pointerType === 'mouse' ? 'mouse' : 'touch');
    }, true);
    document.addEventListener('pointermove', e => {
        if (e.pointerType === 'mouse') useFlightInput('mouse');
    }, true);
    canvas.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        pressContact(e, e.pointerId, e.pointerType === 'mouse');
        if (stick.id === e.pointerId || firingContacts.has(e.pointerId)) canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
        if (e.pointerId === stick.id) moveStick(e);
        else if (e.pointerType === 'mouse') followMouse(e);
    });
    window.addEventListener('pointerup', e => releaseContact(e.pointerId, false));
    window.addEventListener('pointercancel', e => releaseContact(e.pointerId, true));
    canvas.addEventListener('lostpointercapture', e => {
        if (stick.id === e.pointerId || firingContacts.has(e.pointerId)) releaseContact(e.pointerId, true);
    });
} else {
    let lastTouchTime = -Infinity;
    function legacyMouse(e) {
        return e.sourceCapabilities ? !e.sourceCapabilities.firesTouchEvents : performance.now() - lastTouchTime > 800;
    }
    for (const type of ['touchstart', 'touchend', 'touchcancel']) {
        document.addEventListener(type, () => {
            lastTouchTime = performance.now();
            if (type === 'touchstart') useFlightInput('touch');
        }, {capture: true, passive: true});
    }
    for (const type of ['mousedown', 'mousemove']) {
        document.addEventListener(type, e => {
            if (legacyMouse(e)) useFlightInput('mouse');
        }, true);
    }
    canvas.addEventListener('mousedown', e => {
        if (e.button === 0 && legacyMouse(e)) pressContact(e, 'mouse', true);
    });
    canvas.addEventListener('mousemove', e => { if (legacyMouse(e)) followMouse(e); });
    window.addEventListener('mouseup', e => { if (e.button === 0) releaseContact('mouse', false); });
    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        for (const t of e.changedTouches) pressContact(t, t.identifier, false);
    }, {passive: false});
    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        for (const t of e.changedTouches) if (t.identifier === stick.id) moveStick(t);
    }, {passive: false});
    for (const type of ['touchend', 'touchcancel']) {
        window.addEventListener(type, e => {
            for (const t of e.changedTouches) releaseContact(t.identifier, type === 'touchcancel');
        });
    }
}

canvas.addEventListener('flightresize', ({detail}) => {
    resetMobileControls();
    player.x *= GAME_WIDTH / detail.prevWidth;
    player.y *= GAME_HEIGHT / detail.prevHeight;
    player.prevX = player.x;
    player.prevY = player.y;
});

function suspendFlightInput() {
    resetMobileControls();
    if (gameState === 'PLAYING') togglePause();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) suspendFlightInput(); });
window.addEventListener('blur', suspendFlightInput);
window.addEventListener('pagehide', suspendFlightInput);
