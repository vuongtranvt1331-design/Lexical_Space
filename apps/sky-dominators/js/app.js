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
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
});
