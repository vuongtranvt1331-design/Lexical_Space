/* Menu, Hangar and post-flight presentation. No progression is calculated from UI state. */
(function(){
'use strict';
const C=SkyProgressCore,P=SkyProfile,$=id=>document.getElementById(id);
let boardRows=[],boardError='',boardPromise=null,shownFlight=null,promotion=null,promotionTimer=null,purchasing=false,inspectedSkin=null;
const text=(id,value)=>{const el=$(id);if(el)el.textContent=String(value);};
function el(tag,cls,content){const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n;}
function rankImage(r,cls='progress-rank-icon'){const img=el('img',cls);img.src=r.icon;img.alt=r.name;img.width=256;img.height=256;return img;}
function rankInfo(host,r){host.replaceChildren(rankImage(r),el('span','',r.name));}
function render(){
 const r=P.rank(),state=P.state;
 // A saved Exalted selection can arrive after Player was constructed. Refresh only its menu appearance.
 if(gameState==='START'&&P.confirmed&&typeof player!=='undefined'&&player.aircraftIndex===P.selected){
  const savedSkin=P.skin(player.aircraftIndex);
  if(player.skinId!==savedSkin&&(['exalted','celestial'].includes(savedSkin)||['exalted','celestial'].includes(player.skinId)))player.applyAircraftImage();
 }
 if($('pilotRank'))rankInfo($('pilotRank'),r);
 text('pilotCoins',state.coins.toLocaleString()+' Coins');text('pilotProgress',state.qualifyingFlights+' qualifying flights · '+(r.index===15?'Final rank':(r.index+1)+' needed for '+C.RANKS[r.index+1].name));
 text('profileSync',P.status);text('takeOffPilotCallsign',P.name);
 if($('leaderboardCallsignInput'))$('leaderboardCallsignInput').value=P.name;
 if($('profileDetails')){const host=$('profileDetails');host.replaceChildren(rankImage(r),el('strong','',P.name),el('p','',r.name+' · '+state.coins+' Coins'),el('p','',state.coinsEarned+' Coins earned · '+state.coinsSpent+' spent'),el('p','',state.ownedAircraft.length+' / '+AIRCRAFT_CONFIGS.length+' aircraft owned')); }
 renderPersonal();renderBoards();
 if($('inGameHangarModal')&&!$('inGameHangarModal').classList.contains('hidden'))renderHangar();
 renderResult();
 if(gameState!=='PLAYING'&&gameState!=='PAUSED')resumePromotion();
}
function rowsTable(rows){
 const table=el('table','progress-table'),head=el('thead'),tr=el('tr');for(const label of ['Player','Score','Rank','Aircraft'])tr.append(el('th','',label));head.append(tr);table.append(head);
 const body=el('tbody');
 for(const row of rows){
  const tr=el('tr'),name=el('td','progress-player',row.nickname),score=el('td','progress-score',Number(row.score).toLocaleString()),rank=el('td','progress-rank-cell'),plane=el('td','progress-aircraft-cell');
  name.title=row.nickname;rankInfo(rank,C.rank(row.qualifyingFlights||0));
  const cfg=Number.isInteger(row.aircraftIndex)?AIRCRAFT_CONFIGS[row.aircraftIndex]:null;
  if(cfg){const img=el('img');img.src=cfg.file;img.alt='';img.width=44;img.height=44;plane.append(img,el('span','',cfg.name));}else plane.textContent='Unknown';
  tr.append(name,score,rank,plane);body.append(tr);
 }
 table.append(body);return table;
}
function board(host,title,rows,empty){
 if(!host)return;host.replaceChildren(el('h3','progress-board-title',title));if(rows.length)host.append(rowsTable(rows));else host.append(el('p','progress-empty',empty));
}
function renderBoards(){
 for(const id of ['mainMenuLeaderboardContainer','detailedLeaderboardContainer','leaderboardList'])board($(id),'TOP PILOTS',boardRows.slice(0,id==='leaderboardList'?10:6),boardError||'No qualifying flights yet.');
}
function renderPersonal(){
 const best=P.state.personalBest,rows=best?[{nickname:P.name,score:best.score,aircraftIndex:best.aircraftIndex,qualifyingFlights:P.state.qualifyingFlights}]:[];
 for(const id of ['mainMenuPersonalRecordsContainer','detailedPersonalRecordsContainer'])board($(id),'PERSONAL BEST',rows,P.confirmed?'Complete a flight with at least 10,000 points.':'Your saved profile will appear when connected.');
 const state=P.state;
 if(best&&boardRows.length){const own={nickname:P.name,score:best.score,aircraftIndex:best.aircraftIndex,qualifyingFlights:state.qualifyingFlights};boardRows=boardRows.filter(row=>C.norm(row.nickname)!==C.norm(P.name));boardRows.push(own);boardRows.sort((a,b)=>b.score-a.score);}
}
async function refreshBoards(force=false){
 renderPersonal();renderBoards();if(gameState==='PLAYING'||gameState==='PAUSED')return;
 if(boardPromise)return boardPromise;
 boardPromise=(async()=>{try{boardRows=await P.leaderboard(force);boardError='';}catch{boardError='Leaderboard unavailable — retry when connected.';}finally{boardPromise=null;renderBoards();}})();return boardPromise;
}
function renderHangar(){
 const cfg=AIRCRAFT_CONFIGS[selectedHangarIndex]||AIRCRAFT_CONFIGS[0],owned=P.owns(selectedHangarIndex),img=$('hangarAircraftBigImg');img.src=SkySkins.path(selectedHangarIndex,inspectedSkin||P.skin(selectedHangarIndex));img.dataset.aircraftKey=cfg.key;img.dataset.skinId=inspectedSkin||P.skin(selectedHangarIndex);img.classList.toggle('skin-glacier',inspectedSkin==='glacier');img.alt=cfg.name;
 text('hangarAircraftName',cfg.name);text('hangarClassName',cfg.title);text('hangarUnlockStatus',owned?'OWNED · '+P.state.coins+' Coins':'LOCKED · 500 Coins · Balance '+P.state.coins);
 text('hangarDamageNumber',cfg.damagePerShot||1);
 const health=$('hangarHealthBar');health.replaceChildren();health.setAttribute('aria-label',cfg.maxHp+' HP');for(let i=0;i<cfg.maxHp;i++)health.append(el('span','health-block-hp'));
 const desc=$('hangarDescList');desc.replaceChildren();for(const line of cfg.descriptions||[])desc.append(el('li','',line));
 const button=$('hangarConfirmBtn');button.disabled=purchasing||(owned&&!!inspectedSkin&&inspectedSkin!==P.skin(selectedHangarIndex));button.textContent=purchasing?'SAVING…':owned?'TAKE OFF':P.state.coins<500?'500 COINS · INSUFFICIENT COINS':'BUY AIRCRAFT · 500 COINS';
 const list=$('hangarThumbnailList'),scroll=list.scrollTop;list.replaceChildren();
 for(const index of getHangarAircraftOrder()){
  const c=AIRCRAFT_CONFIGS[index],ready=P.owns(index),item=el('button','hangar-thumb-item'+(index===selectedHangarIndex?' is-selected':'')+(!ready?' is-locked':''));item.type='button';item.dataset.index=index;item.dataset.locked=String(!ready);item.setAttribute('aria-pressed',String(index===selectedHangarIndex));
  const image=el('img','hangar-thumb-img');image.src=c.file;image.alt='';const copy=el('span');copy.append(el('span','hangar-card-name',c.name),el('span','hangar-card-status',ready?'OWNED':'LOCKED · 500 COINS'));item.append(image,copy);item.addEventListener('click',()=>selectHangarAircraft(index));list.append(item);
 }list.scrollTop=scroll;renderSkins();SkyExalted.updatePreviews(performance.now());SkyCelestial.updatePreviews(performance.now());
}
function renderSkins(){
 const index=selectedHangarIndex,cfg=AIRCRAFT_CONFIGS[index],current=P.skin(index);inspectedSkin=inspectedSkin&&C.skinCompatible(index,inspectedSkin)?inspectedSkin:current;
 const host=$('skinCards'),scroll=host.scrollTop;host.replaceChildren();
 for(const skin of C.sortedSkins(index)){
  const owned=P.ownsSkin(index,skin.id),card=el('button','skin-card'+(skin.id===inspectedSkin?' is-inspected':'')+(owned?'':' is-locked')+(skin.rarity==='LEGEND'?' is-legend':''));
  card.type='button';card.dataset.skin=skin.id;card.dataset.ownershipId=C.skinOwnershipId(index,skin.id);card.setAttribute('aria-pressed',String(skin.id===inspectedSkin));
  const img=el('img');img.src=SkySkins.path(index,skin.id);img.alt='';img.dataset.aircraftKey=cfg.key;img.dataset.skinId=skin.id;img.width=96;img.height=72;
  card.append(img,el('strong','',skin.name),el('span','skin-rarity',skin.rarity||''),el('span','',skin.id===current?'EQUIPPED':owned?'OWNED':skin.unlock?.type==='rank'?'0 COINS · CELESTIAL I GIFT':skin.price===null?'COMING SOON':'LOCKED · '+skin.price+' Coins'));
  card.addEventListener('click',()=>{if(purchasing)return;inspectedSkin=skin.id;renderHangar();});host.append(card);
 }
 host.scrollTop=scroll;const skin=SkySkinCatalog.lines.find(l=>l.id===inspectedSkin),owned=P.ownsSkin(index,skin.id),button=$('skinAction');
 button.disabled=purchasing||!P.owns(index)||skin.id===current||(!owned&&(skin.unlock?.type==='rank'||!Number.isSafeInteger(skin.price)));
 button.textContent=purchasing?'SAVING…':!P.owns(index)?'UNLOCK AIRCRAFT FIRST':skin.id===current?'EQUIPPED':owned?'EQUIP SKIN':skin.unlock?.type==='rank'?'REACH CELESTIAL I':skin.price===null?'COMING SOON':'UNLOCK · '+skin.price+' COINS';
}
function skinFeedback(message,error=false){
 const status=$('skinStatus');status.textContent=message;status.dataset.error=String(error);
 status.setAttribute('role',error?'alert':'status');status.hidden=false;
 requestAnimationFrame(()=>status.scrollIntoView({block:'nearest'}));
}
async function skinAction(){
 if(purchasing)return;const index=selectedHangarIndex,id=inspectedSkin;if(!P.owns(index)||!id||id===P.skin(index))return;
 const skin=SkySkinCatalog.lines.find(s=>s.id===id);
 if(skin.unlock?.type==='rank'&&!P.ownsSkin(index,id)){skinFeedback('Gifted automatically at Celestial I. No Coins required.');return;}
 if(!P.ownsSkin(index,id)&&P.state.coins<skin.price){skinFeedback('Not enough Coins. '+skin.name+' costs '+skin.price.toLocaleString()+' Coins. Balance: '+P.state.coins.toLocaleString()+'. Need '+(skin.price-P.state.coins).toLocaleString()+' more.',true);return;}
 purchasing=true;skinFeedback('Checking artwork and saving your skin purchase…');renderHangar();
 try{
  await SkySkins.ensure(index,id);
  if(!P.ownsSkin(index,id)){
   await P.buySkin(index,id);
   if(!P.ownsSkin(index,id)){await P.init(true);if(!P.ownsSkin(index,id))throw Error('Purchase could not be confirmed. Reconnect and reload your profile before trying again.');}
   skinFeedback('Skin unlocked. Select EQUIP SKIN to use it.');
  }
  else{await P.equipSkin(index,id);if(player.aircraftIndex===index)player.applyAircraftImage();skinFeedback('Skin equipped. Ready for Take Off.');}
 }catch(e){skinFeedback('Unable to unlock/equip skin: '+(e?.message||String(e)||'Unknown error. Please reconnect and try again.'),true);}finally{purchasing=false;renderHangar();}
}
async function confirmHangar(){
 if(purchasing||(P.owns(selectedHangarIndex)&&inspectedSkin&&inspectedSkin!==P.skin(selectedHangarIndex)))return;const index=selectedHangarIndex;
 if(!P.owns(index)){
  purchasing=true;renderHangar();
  try{await P.buy(index);text('aircraftLockNotice','Aircraft purchased. Press TAKE OFF to fly.');$('aircraftLockNotice').hidden=false;}
  catch(error){text('aircraftLockNotice',error.message);$('aircraftLockNotice').hidden=false;}
  finally{purchasing=false;renderHangar();}return;
 }
 // Local selection is immediate; a failed cloud selection never discards ownership or blocks offline play.
 void P.select(index);if(!player.setAircraft(index))return;nextMatchAircraftIndex=index;
 $('inGameHangarModal').classList.add('hidden');resetGame();
}
function selectAircraft(index){
 if(!Number.isInteger(index)||index<0||index>=AIRCRAFT_CONFIGS.length)return false;
 selectedHangarIndex=index;inspectedSkin=P.skin(index);$('aircraftLockNotice').hidden=true;
 if(P.owns(index)){void P.select(index);player.setAircraft(index);nextMatchAircraftIndex=index;}
 renderHangar();return true;
}
function showResult(flight){
 shownFlight=flight;
 text('finalScoreText',String(flight.score).padStart(6,'0'));text('finalTargetsText',flight.targetsCleared);text('finalIntervalText',(spawnInterval/1000).toFixed(2)+'s');
 const cfg=AIRCRAFT_CONFIGS[flight.aircraftIndex],skinId=player.skinId||'factory_default',image=$('gameOverAircraftImg');image.src=SkySkins.path(flight.aircraftIndex,skinId);image.dataset.skinId=skinId;image.dataset.aircraftKey=cfg.key;text('gameOverAircraftName',cfg.name.toUpperCase());
 $('detailedRecordsOverlay').classList.add('hidden');$('gameOverOverlay').classList.remove('hidden');renderResult();SkyExalted.updatePreviews(performance.now());SkyCelestial.updatePreviews(performance.now());
}
function renderResult(){
 text('finalSortiesCountText',P.state.qualifyingFlights);
 if(!shownFlight)return;
 const saved=P.result(shownFlight.id),rank=saved?C.RANKS[saved.rankAfter]:P.rank();
 rankInfo($('flightRank'),rank);
 text('flightCoins',saved?'+'+saved.coinsAwarded+' Coins':'+'+C.reward(shownFlight.score)+' Coins pending');
 text('flightSaveStatus',saved?'Flight saved · '+P.state.coins+' Coins balance'+(saved.skinsAwarded?.includes('fighter_1__celestial')?' · Celestial skin gifted to Player 1':''):P.status);
 if(saved)resumePromotion();
}
function resumePromotion(){
 if(promotion||gameState==='PLAYING'||gameState==='PAUSED')return;
 const p=P.promotions()[0];if(!p)return;
 const host=$('postFlightPromotion');host.hidden=false;host.replaceChildren(el('h3','','RANK UP'),el('p','','Completed flight saved'));
 const art=el('div','promotion-art'),old=rankImage(C.RANKS[p.from]),next=rankImage(C.RANKS[p.to]);old.classList.add('promotion-old');next.classList.add('promotion-new');art.append(old,next);host.append(art,el('p','',C.RANKS[p.from].name+' → '+C.RANKS[p.to].name));
 promotion=p;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 promotionTimer=setTimeout(async()=>{
  if(gameState==='PLAYING'||gameState==='PAUSED'){stopPromotion();return;}
  const done=promotion;promotion=null;host.hidden=true;if(done)await P.acknowledge(done.flightId);resumePromotion();
 },reduced?900:2400);
}
function stopPromotion(){clearTimeout(promotionTimer);promotionTimer=null;promotion=null;$('postFlightPromotion').hidden=true;}
function leaveResult(){if(promotion)return;showDetailedRecordsScreen();}
window.SkyUI={render,refreshBoards,renderHangar,confirmHangar,selectAircraft,showResult,renderResult,stopPromotion,leaveResult};
window.addEventListener('sky-profile',render);
window.addEventListener('load',()=>{
 P.connect(SKYDOMINATORS_FIREBASE_CONFIG,{isFlying:()=>gameState==='PLAYING'||gameState==='PAUSED'});
 $('skinAction').addEventListener('click',()=>void skinAction());
 $('retryProgress').addEventListener('click',e=>{e.preventDefault();void P.init(true);void refreshBoards(true);});
 render();void refreshBoards();
 // Historical unscoped local records are shown separately; they are never silently attributed to another student.
 try{const records=JSON.parse(localStorage.getItem('air_strike_personal_records')||'[]');if(records.length){const details=$('legacyLocalRecords');details.hidden=false;for(const r of records){const li=el('li','',(r.date||'Previous flight')+' · '+Number(r.score).toLocaleString()+' · '+(AIRCRAFT_CONFIGS[r.aircraftIndex]?.name||'Unknown aircraft'));details.querySelector('ul').append(li);}}}catch{}
});
})();
