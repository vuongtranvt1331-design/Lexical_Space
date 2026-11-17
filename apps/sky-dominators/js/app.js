/* js/app.js — ordered classic script; entrypoints declare dependency order. */
window.addEventListener('load', async () => {
    try {
        await initGameAssets();
    } catch (err) {
        console.warn("Asset load non-critical error:", err);
    }
    try {
        await vocabService.init();
    } catch (err) {
        console.warn("Vocab init non-critical error:", err);
    }
    cloudManager.init();
    pickNewMissionWord();
    setupDangerPanelWord();
    updateAircraftUI();
    updateLeftHUD();
    refreshMainMenuView();
    // Local assets, vocabulary and menu are ready; remote profile work stays independent.
    window.__spaceGameReady = true;
    document.dispatchEvent(new Event('spacegame:ready'));
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
});
