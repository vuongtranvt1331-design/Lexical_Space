/* js/ui/navigation.js — ordered classic script; entrypoints declare dependency order. */
function returnToSkyMainMenu(e) {
    player.boostTimer=0;bossEncounter.abort();suspendedBossRows=[];SkySkins.clear();document.getElementById('dangerHUDContainer').style.visibility='';
    player.endSquadron();
    SkyUI.stopPromotion();
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    try {
        if (typeof audio !== 'undefined' && audio && audio.init) audio.init();
    } catch (err) {}

    clearTouchCommands();
    gameState = 'START';
    if (typeof resetMobileControls === 'function') resetMobileControls();
    if (typeof updateMobileControlsVisibility === 'function') updateMobileControlsVisibility();

    // Strictly hide all gameplay and debrief overlays
    document.getElementById('detailedRecordsOverlay')?.classList.add('hidden');
    document.getElementById('gameOverOverlay')?.classList.add('hidden');
    document.getElementById('pauseOverlay')?.classList.add('hidden');
    document.getElementById('inGameHangarModal')?.classList.add('hidden');
    document.getElementById('leaderboardModal')?.classList.add('hidden');

    // Strictly reveal Sky Dominators Main Menu
    const startOverlay = document.getElementById('startOverlay');
    if (startOverlay) {
        startOverlay.classList.remove('hidden');
        startOverlay.scrollTop = 0;
    }

    if (typeof refreshMainMenuView === 'function') {
        refreshMainMenuView();
    }
}

window.returnToSkyMainMenu = returnToSkyMainMenu;

window.handleExitNavigation = returnToSkyMainMenu;

function navigateToArcadeHub(e) {
    if (window.SpaceSuite) { e?.preventDefault(); location.assign(SpaceSuite.safeReturn(new URLSearchParams(location.search).get('returnUrl'))); return; }
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const returnUrl = urlParams.get('returnUrl');
        if (returnUrl) {
            window.location.href = returnUrl;
            return;
        }

        const user = urlParams.get('user') || localStorage.getItem('vocab_user') || localStorage.getItem('air_strike_player_nickname') || '';
        const userQuery = user ? `?user=${encodeURIComponent(user)}` : '';

        if (window.location.hostname.endsWith('github.io')) {
            window.location.href = `https://vuongtranvt1331-design.github.io/Arcadehub/${userQuery}`;
            return;
        }

        const origin = window.location.origin;
        if (origin && origin !== 'null' && !origin.startsWith('file')) {
            window.location.href = `${origin}/Arcadehub/index.html${userQuery}`;
            return;
        }

        window.location.href = `Arcadehub/index.html${userQuery}`;
    } catch (err) {
        window.location.href = 'https://vuongtranvt1331-design.github.io/Arcadehub/';
    }
}
