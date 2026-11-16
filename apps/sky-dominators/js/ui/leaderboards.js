/* js/ui/leaderboards.js — ordered classic script; entrypoints declare dependency order. */
const leaderboardService={getPlayerNickname:()=>SkyProfile.name,setPlayerNickname:value=>SkyProfile.setName(value)};

function refreshAllBoards(){return window.SkyUI?.refreshBoards();}

function refreshMainMenuView(){SkyProfile.syncIdentity();if(window.SkyUI){SkyUI.render();void SkyUI.refreshBoards();}}

function showDetailedRecordsScreen(){
    document.getElementById('gameOverOverlay')?.classList.add('hidden');
    document.getElementById('detailedRecordsOverlay')?.classList.remove('hidden');
    void refreshAllBoards();
}

function openLeaderboardModal(){audio.init();document.getElementById('leaderboardModal')?.classList.remove('hidden');return refreshLeaderboardUI();}

function closeLeaderboardModal(){document.getElementById('leaderboardModal')?.classList.add('hidden');}

function refreshLeaderboardUI(){return window.SkyUI?.refreshBoards(true);}

Object.assign(window,{refreshAllBoards,refreshMainMenuView,showDetailedRecordsScreen,openLeaderboardModal,closeLeaderboardModal,refreshLeaderboardUI});
