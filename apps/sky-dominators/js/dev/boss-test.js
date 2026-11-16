/* Dedicated test entrypoint only. Reuses real boss entities and the one production loop. */
(function(){
 'use strict';
 let selectedBoss=1,ready=false,lastLabel='';
 const originalReset=resetGame;
 resetGame=function(){
  originalReset();
  const stage=SkyBosses.STAGES.find(b=>b.id===selectedBoss);
  bossEncounter.reset(currentSortieId,SkyBosses.STAGES.filter(b=>b.id<selectedBoss).map(b=>b.id));
  destroyedRowsCount=stage.round;
  spawnInterval=Math.max(MIN_SPAWN_INTERVAL,INITIAL_SPAWN_INTERVAL-destroyedRowsCount*ROW_SPAWN_DECREMENT);
  bossEncounter.rowCompleted(stage.round);updateLeftHUD();
 };
 // Keep test victory claims in memory only, never in the production session journal.
 bossEncounter.h.victory=(boss,id,attack)=>{
  if(boss.hp!==0||([3,5,6].includes(boss.id)&&!boss.defeatComplete)||bossRewardClaims.has(id))return false;
  bossRewardClaims.add(id);score=Math.min(999999,score+boss.reward);updateLeftHUD();
  if(![3,4,5,6].includes(boss.id))triggerCinematicExplosion(boss.x,boss.y,true,SkySkins.eliminationSkin(attack?.projectile));return true;
 };
 function launch(id){if(!ready||!SkyBosses.STAGES.some(b=>b.id===id))return false;selectedBoss=id;audio.init();document.querySelectorAll('.modal-overlay').forEach(el=>el.classList.add('hidden'));resetGame();return true;}
 const originalLoop=gameLoop;
 gameLoop=function(now){
  originalLoop(now);
  if(!ready){ready=true;document.querySelectorAll('[data-test-boss],#bossTestRestart,#bossTestHangar').forEach(b=>b.disabled=false);}
  const boss=bossEncounter.boss;
  let label='Choose Boss 1–6 · '+(gameState==='GAMEOVER'?'defeated — retry anytime':'ready');
  if(boss){
   const armored=boss.titanusState===SkyTitanus.PHASE.ARMORED;
   const hp=armored?boss.armor:boss.hp,max=armored?boss.maxArmor:boss.maxHp;
   label='BOSS '+boss.id+' · '+Math.ceil(hp)+' / '+max+(armored?' ARMOR':' HP');
  }
  if(label!==lastLabel){lastLabel=label;const el=document.getElementById('bossTestStatus');if(el)el.textContent=label;}
 };
 window.addEventListener('load',()=>{
  document.querySelectorAll('[data-test-boss]').forEach(b=>b.addEventListener('click',()=>launch(Number(b.dataset.testBoss))));
  document.getElementById('bossTestRestart').addEventListener('click',()=>launch(selectedBoss));
  document.getElementById('bossTestHangar').addEventListener('click',()=>{bossEncounter.abort();bomberHazard.reset();clearTouchCommands();SkySkins.clear();gameState='START';isPaused=false;document.querySelectorAll('.modal-overlay').forEach(el=>el.classList.add('hidden'));openHangarModal();});
 });
 window.SkyBossTest={launch,get selected(){return selectedBoss;},get ready(){return ready;}};
})();
