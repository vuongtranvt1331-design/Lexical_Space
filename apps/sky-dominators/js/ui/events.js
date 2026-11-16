/* js/ui/events.js — ordered classic script; entrypoints declare dependency order. */
window.addEventListener('resize', () => {
    updateDangerHUDDisplay();
});

const inGamePauseBtn = document.getElementById('inGamePauseBtn');

if (inGamePauseBtn) {
    inGamePauseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        audio.init();
        togglePause();
    });
    inGamePauseBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        audio.init();
        togglePause();
    }, { passive: false });
}

const handleTakeOffCallsignEdit = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const current = leaderboardService.getPlayerNickname() || 'PILOT-01';
    const input = window.prompt("Enter pilot name (max 80 characters):", current);
    if (input !== null) {
        const cleaned = input.trim().slice(0, 80);
        if (cleaned) {
            await leaderboardService.setPlayerNickname(cleaned);
            refreshMainMenuView();
        }
    }
};

document.getElementById('takeOffEditPencil')?.addEventListener('click', handleTakeOffCallsignEdit);

document.getElementById('startBtn')?.addEventListener('click', () => {
    audio.init();
    document.getElementById('startOverlay')?.classList.add('hidden');
    openHangarModal();
});

const mainMenuCallsignInput = document.getElementById('mainMenuCallsignInput');

if (mainMenuCallsignInput) {
    mainMenuCallsignInput.addEventListener('change', async () => {
        const val = mainMenuCallsignInput.value.trim();
        if (val) {
            leaderboardService.setPlayerNickname(val);
            await refreshAllBoards();
        }
    });
    mainMenuCallsignInput.addEventListener('blur', async () => {
        const val = mainMenuCallsignInput.value.trim();
        if (val) {
            leaderboardService.setPlayerNickname(val);
            await refreshAllBoards();
        }
    });
}

const gameOverOverlay = document.getElementById('gameOverOverlay');

if (gameOverOverlay) {
    gameOverOverlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        audio.init();
        SkyUI.leaveResult();
    });
}

document.getElementById('detailedMainMenuBtn')?.addEventListener('click', (e) => {
    returnToSkyMainMenu(e);
});

document.getElementById('detailedHangarBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    audio.init();
    document.getElementById('detailedRecordsOverlay')?.classList.add('hidden');
    hangarPrevGameState = 'DETAILED_RECORDS';
    openHangarModal();
});

document.getElementById('detailedRetryBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    audio.init();
    document.getElementById('detailedRecordsOverlay')?.classList.add('hidden');
    resetGame();
});

document.getElementById('restartBtn')?.addEventListener('click', () => {
    audio.init();
    document.getElementById('detailedRecordsOverlay')?.classList.add('hidden');
    resetGame();
});

document.getElementById('resumeBtn')?.addEventListener('click', () => {
    audio.init();
    togglePause();
});

document.getElementById('startHangarBtn')?.addEventListener('click', () => {
    document.getElementById('startOverlay')?.classList.add('hidden');
    openHangarModal();
});

document.getElementById('gameOverHangarBtn')?.addEventListener('click', () => {
    document.getElementById('gameOverOverlay')?.classList.add('hidden');
    openHangarModal();
});

document.getElementById('startLeaderboardBtn')?.addEventListener('click', () => {
    openLeaderboardModal();
});

document.getElementById('gameOverLeaderboardBtn')?.addEventListener('click', () => {
    openLeaderboardModal();
});

document.getElementById('closeLeaderboardBtn')?.addEventListener('click', () => {
    closeLeaderboardModal();
});

document.getElementById('leaderboardCloseBottomBtn')?.addEventListener('click', () => {
    closeLeaderboardModal();
});

document.getElementById('saveCallsignBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('leaderboardCallsignInput');
    if (input && input.value.trim()) {
        leaderboardService.setPlayerNickname(input.value.trim());
        await refreshLeaderboardUI();
        await refreshAllBoards();
    }
});

document.getElementById('leaderboardRetryBtn')?.addEventListener('click', async () => {
    await refreshLeaderboardUI();
});

document.getElementById('closeHangarBtn')?.addEventListener('click', () => {
    closeHangarModal();
});

document.getElementById('hangarConfirmBtn')?.addEventListener('click',()=>void SkyUI.confirmHangar());

const inGameSkillBtn = document.getElementById('inGameSkillBtn');

if (inGameSkillBtn) {
    inGameSkillBtn.addEventListener('click', (e) => {
        e.preventDefault();
        audio.init();
        player.triggerActiveSkill();
    });
    inGameSkillBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        audio.init();
        player.triggerActiveSkill();
    }, { passive: false });
}

document.getElementById('touchShootBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.alert('Each tap moves toward the latest destination and queues exactly one shot. Hold Spacebar for manual fire.');
});

window.addEventListener('resize', () => {
    if (typeof updateMobileControlsVisibility === 'function') {
        updateMobileControlsVisibility();
    }
});

document.getElementById('exitBtn')?.addEventListener('click', returnToSkyMainMenu);

document.getElementById('pauseExitBtn')?.addEventListener('click', returnToSkyMainMenu);

document.getElementById('gameOverExitBtn')?.addEventListener('click', returnToSkyMainMenu);

document.getElementById('btnBackToArcadeHub')?.addEventListener('click', navigateToArcadeHub);

document.getElementById('pauseArcadeHubBtn')?.addEventListener('click', navigateToArcadeHub);

document.getElementById('detailedArcadeHubBtn')?.addEventListener('click', navigateToArcadeHub);
