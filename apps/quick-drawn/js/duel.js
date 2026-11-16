'use strict';
const $ = id => document.getElementById(id);
const PVP_PROTOCOL=13, CONNECTION_TIMEOUT_MS=18000;
let connectionEpoch=0, connectionTimer=null, navigationEpoch=0;
const heroes = {ngo:'Ngô Quyền',trung:'Hai Bà Trưng',an:'An Dương Vương',giong:'Thánh Gióng',tran:'Trần Hưng Đạo',chu:'Chu Văn An',lac:'Lạc Long Quân',mai:'Mai An Tiêm',toan:'Trần Quốc Toản',vuong:'Teacher Vương'};
const TEACHER_VUONG_TAUNTS=Object.freeze(['chưa học từ à?','lười học','báo bố mẹ','gà 🐔']);
function isTeacherTauntIndex(index){return Number.isInteger(index)&&index>=0&&index<TEACHER_VUONG_TAUNTS.length}
function randomTeacherTaunt(){return Math.floor(Math.random()*TEACHER_VUONG_TAUNTS.length)}
function renderTeacherTaunt(active,elapsed,x,headY,height){
 const bubble=document.querySelector('[data-teacher-taunt]');if(!bubble)return;
 if(!active||active.hero!=='vuong'||!isTeacherTauntIndex(active.tauntIndex)||elapsed<0||elapsed>=900||$('battle').hidden||(ended&&!active.final)||fx?.victoryStart){bubble.hidden=true;return}
 const text=TEACHER_VUONG_TAUNTS[active.tauntIndex];if(bubble.textContent!==text)bubble.textContent=text;
 bubble.style.left=Math.max(20,Math.min(80,x/960*100))+'%';bubble.style.top=Math.max(18,Math.min(78,headY/height*100))+'%';bubble.hidden=false;
}

const words = [
 ['substantial','đáng kể','considerable','reluctant','obsolete','candid'],['allocate','phân bổ','assign','worsen','inspect','agree'],['sustainable','bền vững','viable','vague','outdated','hesitant'],['inevitable','không thể tránh khỏi','unavoidable','precise','plentiful','profitable'],['meticulous','tỉ mỉ','thorough','vague','strong','outdated'],['ambiguous','mơ hồ','vague','precise','profitable','persistent'],['deteriorate','xấu đi','worsen','increase','agree','expand'],['augment','làm tăng thêm','increase','decline','inspect','reduce'],['obsolete','lỗi thời','outdated','viable','enduring','precise'],['resilient','kiên cường','tough','hesitant','vague','outdated'],['scrutinize','xem xét kỹ','inspect','increase','agree','reduce'],['lucrative','sinh lời','profitable','unavoidable','hesitant','outdated'],['mitigate','giảm nhẹ','reduce','expand','increase','assign'],['plausible','hợp lý','credible','outdated','persistent','tough'],['adversity','nghịch cảnh','hardship','proposal','profit','initiative'],['reluctant','miễn cưỡng','hesitant','plentiful','precise','strong'],['pivotal','then chốt','crucial','vague','outdated','hesitant'],['candid','thẳng thắn','frank','ambiguous','reluctant','perilous'],['abundant','dồi dào','plentiful','scarce','obsolete','candid'],['tenacious','ngoan cường','persistent','hesitant','vague','outdated'] ];
const canvas=$('canvas'),ctx=canvas.getContext('2d');
let peer=null,conn=null,mode='',side=0,players=['ngo','tran'],lives=[10,10],displayLives=[10,10],round=0,question=null,locked=true,ended=false,botTimer=null,nextTimer=null,impactTimer=null,fallTimer=null,fx=null,preview=null,poses=['idle','idle'],background=new Image();
const combatSound=new CombatAudio(), combatAnimator=new CombatAnimator(ctx);
document.addEventListener('pointerdown',()=>combatSound.unlock(),{passive:true});
const ARENA_MAPS=[{id:'palace',src:'assets/images/map_palace.png'},{id:'arena',src:'assets/images/map_arena.png'},{id:'plains',src:'assets/images/map_plains.png'},{id:'water_river',src:'assets/images/ancient_battlefield.png'}];
const mapImages=Object.fromEntries(ARENA_MAPS.map(m=>{const image=new Image();image.src=m.src;return [m.id,image]}));
let mapCursor=-1,currentMap='water_river',names=['P1','P2'],paused=false,pausedAt=0,actorSize=245;const scheduled=new Map(),pendingMessages=[];
// Rejoin normalizes to an authoritative stable round; no queued hit is replayed.
let duelDecision=null;
async function finishDuelDecision(actualScore){
 const match=standingMatch;if(!match||match.mode!=='pvp')throw Error('No duel match');
 ended=true;locked=true;clearTasks();fx=null;preview=null;duelDecision={matchId:match.id,hostScore:side===0?actualScore:1-actualScore};
 disableAnswers();$('victoryBanner').hidden=true;$('battleMessage').textContent=actualScore===1?'CHIẾN THẮNG':actualScore===0?'THẤT BẠI':'HÒA';$('roundStatus').textContent='Chốt kết quả do đối thủ mất kết nối.';showRematchPanel();match.completed=true;
 const descriptor={id:match.id,mode:'pvp',deckSize:match.deckSize,profiles:side===0?[match.profile,match.opponent]:[match.opponent,match.profile]};
 const promise=finishStandingPair(descriptor,side,actualScore);match.savePromise=promise;const result=await promise,canonical=result.outcome==='win'?1:result.outcome==='draw'?.5:0;
 if(standingMatch===match){duelDecision={matchId:match.id,hostScore:side===0?canonical:1-canonical};$('battleMessage').textContent=canonical===1?'CHIẾN THẮNG':canonical===0?'THẤT BẠI':'HÒA';const badge=document.querySelector('[data-standing-result]');if(badge){const delta=result.appliedDeltaElo;badge.textContent=(delta>=0?'+':'')+delta+' Elo · Đã chốt cho cả hai';badge.hidden=false}}
 return {score:canonical};
}
function applyDuelClaim(claim){if(claim.matchId!==standingMatch?.id)return;return finishDuelDecision(claim.hostScore)}

let duelRecoveryPlan=null,duelLastResult=null,duelRecoveryTicket=null;
const duelRecovery=typeof QuickDrawnRecovery==='undefined'?null:new QuickDrawnRecovery({
 label:'duel',role:()=>mode,getPeer:()=>peer,setPeer:p=>{peer=p},getConnection:()=>conn,
 detach:c=>{if(conn===c)conn=null},hostId:()=>'anhhung-duel-'+pvpRoomCode,
 bind:c=>listen(c),snapshot:duelRecoverySnapshot,apply:applyDuelRecovery,
 lost:onDuelConnectionLost,restored:onDuelConnectionRestored,canAdjudicate:()=>!!standingMatch&&!ended&&round>0&&standingMatch.profile.id!==standingMatch.opponent?.id,matchId:()=>standingMatch?.id,adjudicate:finishDuelDecision,applyClaim:applyDuelClaim
});
function onDuelConnectionLost(){
 if($('battle').hidden){if(pvpRoom){pvpRoom.ready=[false,false];pvpRoom.localReady=false;pvpRoom.linked=false;renderPvPRoom()}duelRecoveryPlan={phase:'room',paused:false};return}
 duelRecoveryPlan={phase:ended?'finished':!question?'starting':(locked||fx)?'between':'question',paused};
 setPaused(true,false);disableAnswers();$('roundStatus').textContent='Mất kết nối. Đang giữ ván để nối lại…';
}
function duelRecoverySnapshot(){
 if(!pvpRoom)throw Error('Missing room');
 const room={code:pvpRoomCode,players:[...players],names:[...names],standing:standingMatch?descriptorForCurrentMatch():pvpRoom.standing};
 if($('battle').hidden){room.players=[...pvpRoom.players];room.names=[...pvpRoom.names];return {phase:'room',room}}
 return {phase:duelDecision?.matchId===standingMatch.id?'decision':duelRecoveryPlan?.phase||(ended?'finished':'question'),paused:!!duelRecoveryPlan?.paused,room,match:matchId,round,question:question?{...question,options:[...question.options]}:null,lives:[...lives],map:currentMap,vocabSource,poolSize:standingMatch.deckSize,decision:duelDecision,result:duelLastResult?{...duelLastResult,lives:[...duelLastResult.lives]}:null};
}
function applyDuelRecovery(data){
 const r=data?.room,profile=standingMatch?.profile||joiningStandingProfile;
 if(!data||!['room','question','between','starting','finished','decision'].includes(data.phase)||!r||!/^\d{4}$/.test(r.code)||r.code!==pvpRoomCode||!isPacketArray(r.players,2,id=>Object.hasOwn(heroes,id))||!isPacketArray(r.names,2,name=>typeof name==='string')||!isStandingDescriptor(r.standing)||r.standing.profiles[1].id!==profile?.id)return false;
 if(data.phase==='room'){
  if(!$('battle').hidden&&question)return false;
  pvpRoom={players:[...r.players],names:r.names.map(n=>n.slice(0,18)),standing:r.standing,ready:[false,false],localReady:false,linked:false,starting:false};duelRecoveryPlan={phase:'room',paused:false};return true;
 }
 if(typeof data.paused!=='boolean'||!Number.isSafeInteger(data.match)||data.match<matchId||data.match>matchId+1||!Number.isSafeInteger(data.round)||data.round<0||!isPacketArray(data.lives,2,h=>Number.isInteger(h)&&h>=0&&h<=10)||!ARENA_MAPS.some(m=>m.id===data.map)||data.poolSize!==r.standing.deckSize||!['starter','lexical'].includes(data.vocabSource))return false;
 if(standingMatch&&r.standing.id!==standingMatch.id&&!myRematchReady)return false;
 if(data.phase==='starting'){if(data.round!==0||data.question!==null)return false}
 else if(!isValidRoundPayload({match:data.match,round:data.round,question:data.question,players:r.players,names:r.names,lives:data.lives,map:data.map,vocabSource:data.vocabSource,poolSize:data.poolSize}))return false;
 if(data.phase==='decision'&&(!data.decision||data.decision.matchId!==r.standing.id||![0,.5,1].includes(data.decision.hostScore)))return false;
 if(data.phase==='finished'&&(!isValidResultPayload(data.result)||!data.result.final||data.result.match!==data.match||data.result.round!==data.round||JSON.stringify(data.result.lives)!==JSON.stringify(data.lives)))return false;
 if($('battle').hidden){if(!pvpRoom?.localReady)return false;setup('guest')}
 clearTasks();fx=null;preview=null;side=1;players=[...r.players];names=r.names.map(n=>n.slice(0,18));matchId=data.match;round=data.round;question=data.question;lives=[...data.lives];displayLives=[...lives];currentMap=data.map;vocabSource=data.vocabSource;
 if(!standingMatch||standingMatch.id!==r.standing.id)acceptStandingDescriptor(r.standing,1);
 pvpRoom={players:[...players],names:[...names],standing:r.standing,ready:[true,true],localReady:true,linked:false,starting:true};
 ended=false;locked=true;poses=['idle','idle'];duelRecoveryPlan={phase:data.phase,paused:data.paused};myRematchReady=false;peerRematchReady=false;
 if(data.phase==='question')showRound(round,question,players,lives,names,currentMap,data.poolSize);
 else if(data.phase==='finished'){duelLastResult=data.result;applyResult(data.result)}
 else if(data.phase==='decision')return finishDuelDecision(1-data.decision.hostScore).then(()=>true);
 else{updateHUD();$('roundStatus').textContent='Đang đồng bộ câu hỏi tiếp theo…';disableAnswers()}
 return true;
}
function onDuelConnectionRestored(){
 const plan=duelDecision&&duelDecision.matchId===standingMatch?.id?{phase:'decision'}:duelRecoveryPlan;duelRecoveryPlan=null;if(!plan||plan.phase==='decision')return;
 if(plan.phase==='room'){if(pvpRoom){pvpRoom.ready=[false,false];pvpRoom.localReady=false;pvpRoom.linked=true;renderPvPRoom()}return}
 if(mode==='host'){
  clearTasks();fx=null;preview=null;poses=['idle','idle'];myRematchReady=false;peerRematchReady=false;
  if(plan.phase==='question'){ended=false;showRound(round,question,players,lives,names,currentMap,standingMatch.deckSize)}
  else if(plan.phase==='finished'){ended=false;if(duelLastResult)applyResult(duelLastResult)}
  else{ended=false;beginRound()}
 }
 if(plan.paused&&plan.phase!=='finished')setPaused(true,false);
}

function accountName(){return $('username').value.trim()}
function myName(){return accountName().slice(0,18)||'P1'}
function cancelTask(key){const item=scheduled.get(key);if(item)clearTimeout(item.id);scheduled.delete(key)}
function schedule(key,fn,delay){cancelTask(key);const task={fn,remaining:delay,id:null,due:0};scheduled.set(key,task);if(!paused)startTask(key,task)}
function startTask(key,task){task.due=performance.now()+task.remaining;task.id=setTimeout(()=>{scheduled.delete(key);task.fn()},task.remaining)}
function setPaused(value,announce=true){if(!value&&duelRecovery?.blocked)return;if(paused===value||$('battle').hidden)return;paused=value;const now=performance.now();if(value){pausedAt=now;for(const task of scheduled.values()){clearTimeout(task.id);task.remaining=Math.max(0,task.due-now)}}else{const delta=now-pausedAt;if(fx){fx.start+=delta;if(fx.deadStart)fx.deadStart+=delta;if(fx.lastHitAt)fx.lastHitAt+=delta;if(fx.victoryStart)fx.victoryStart+=delta}if(preview)preview.start+=delta;for(const [key,task] of scheduled)startTask(key,task)}$('pauseOverlay').hidden=!value;$('battle').classList.toggle('is-paused',value);$('pause').setAttribute('aria-label',value?'Trận đấu đang tạm dừng':'Tạm dừng');$('answers').inert=value;if(announce)send({type:'PAUSE',value});if(!value){for(const message of pendingMessages.splice(0))receiveData(message)}}
function clearTasks(){for(const key of scheduled.keys())cancelTask(key);pendingMessages.length=0;paused=false;$('battle').classList.remove('is-paused');$('pauseOverlay').hidden=true;$('answers').inert=false}

const sprites={};for(const name of Object.keys(heroes)){sprites[name]=new Image();sprites[name].src=`assets/images/heroes/${name}.png`;}

// Visible ground contact within each 229px atlas cell. Mounted units have
// larger transparent margins than standing units, so cell bottoms differ.
const SPRITE_FEET={
 vuong:[[222,222,222,222,222,222],[211,211,214,212,215,214],[221,221,221,221,221,221],[221,222,221,221,221,221],[221,218,211,203,203,203]],
 an:[[222,221,216,222,221,221],[218,218,218],[217,216,216],[218,218,218],[218,216,216]],
 ngo:[[219,219,219,219,219,219],[219,219,219],[218,218,217],[218,218,218],[216,212,215]],
 tran:[[219,219,219,219,219,219],[217,217,217],[212,212,213],[217,217,217],[215,213,215]],
 trung:[[209,209,209,210,209,209],[207,206,207],[204,204,204],[205,206,206],[208,206,209]],
 giong:[[211,211,211,211,211,211],[214,214,214],[201,201,201],[199,199,199],[201,200,200]],
 chu:[[223,223,223,223,223,223],[221,221,221],[219,215,219],[222,221,221],[217,212,224]],
 lac:[[218,218,218,217,218,218],[208,208,208],[200,200,198],[200,200,200],[202,204,204]],
 mai:[[219,218,218,219,219,219],[208,209,210],[213,213,214],[217,217,217],[199,199,199]],
 toan:[[225,224,216,225,225,225],[222,224,224],[218,217,214],[219,219,219],[218,217,219]]
};
const SPRITE_CENTERS={vuong:119,an:116,ngo:118,tran:115,trung:114,giong:121,chu:119,lac:112,mai:120,toan:113};
function spriteSize(hero){return (hero==='trung'||hero==='giong')?actorSize*1.18:actorSize}
function desktopApproach(hero,opponent){return Math.max(0,520-(spriteSize(hero)+spriteSize(opponent))*.24)}

let score=0,questionPool=[],questionBag=[],lastQuestionKey='',vocabSource='starter',matchId=1,myRematchReady=false,peerRematchReady=false;
// Standings are local-only documents; vocabulary storage remains read-only.
const STANDINGS_KEY='quickdrawn_standings_v1';
let standingMemory={version:1,players:[],matches:[],pendingSync:[]},standingUnsaved=false,standingReadOnly=false;
let standingWrites=Promise.resolve(),standingMatch=null,joiningStandingProfile=null;
const standingGuestId='guest-'+standingUid();
function standingUid(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}
function standingProfileId(name){return 'profile-'+Array.from(name).map(char=>char.codePointAt(0).toString(16)).join('-')}
function sessionStandingProfile(){try{return sessionStorage.getItem('ls_active_profile')?.trim()||''}catch(_){return ''}}
function newStandingPlayer(id,name){return {id,name,elo:1000,wins:0,losses:0,matchesPlayed:0,maxDeckSize:0,bestSurvivalScore:0,updatedAt:null}}
function isStandingPlayer(row){return row&&typeof row==='object'&&typeof row.id==='string'&&typeof row.name==='string'&&Number.isSafeInteger(row.elo)&&row.elo>=100&&['wins','losses','matchesPlayed','maxDeckSize'].every(key=>Number.isSafeInteger(row[key])&&row[key]>=0)&&(row.bestSurvivalScore===undefined||(Number.isSafeInteger(row.bestSurvivalScore)&&row.bestSurvivalScore>=0))}
function readStandingStore(){
 if(standingUnsaved||standingReadOnly)return JSON.parse(JSON.stringify(standingMemory));
 try{const raw=localStorage.getItem(STANDINGS_KEY);if(raw){const parsed=JSON.parse(raw);if(parsed.version!==1||!Array.isArray(parsed.players)||!parsed.players.every(isStandingPlayer)||!Array.isArray(parsed.matches)||!parsed.matches.every(row=>row&&typeof row.id==='string')||!Array.isArray(parsed.pendingSync))throw new Error('Invalid standings');standingMemory=parsed}}catch(_){standingReadOnly=true}
 return JSON.parse(JSON.stringify(standingMemory));
}
function writeStandingStore(store){
 standingMemory=store;
 if(standingReadOnly){standingUnsaved=true;return false}
 try{localStorage.setItem(STANDINGS_KEY,JSON.stringify(store));standingUnsaved=false;return true}catch(_){standingUnsaved=true;return false}
}
function localStandingProfile(){
 const store=readStandingStore(),name=accountName()||sessionStandingProfile();
 const id=name?standingProfileId(name):(typeof store.guestId==='string'?store.guestId:standingGuestId);
 return {...(store.players.find(row=>row.id===id)||newStandingPlayer(id,name||'Khách'))};
}
function standingSnapshot(profile){return {id:profile.id,name:profile.name,elo:profile.elo,matchesPlayed:profile.matchesPlayed}}
function latestStandingSnapshot(profile){const row=readStandingStore().players.find(row=>row.id===profile.id);return standingSnapshot(row||profile)}
function standingDeckWeight(deckSize){if(!Number.isSafeInteger(deckSize)||deckSize<1)throw new Error('Invalid match deck size');return deckSize<15?.6:deckSize<30?1:deckSize<60?1.25:1.5}
function standingPvCTarget(elo){return Math.max(5,8+Math.floor((elo-1000)/100))}
function calculateStandingDelta(mode,player,opponentElo,actualScore,deckSize,correctCount=0,targetCorrect=standingPvCTarget(player.elo)){
 const weight=mode==='chess'?1:standingDeckWeight(deckSize);
 if(mode==='pvc'){const bonus=Math.min(10,Math.max(0,correctCount-targetCorrect));return actualScore===1?Math.round((12+bonus)*weight):-Math.round(10/weight)}
 const expected=1/(1+Math.pow(10,(opponentElo-player.elo)/400)),k=player.matchesPlayed<30?32:16;
 return Math.round(k*(actualScore-expected)*weight);
}
function sortStandingPlayers(players){return [...players].sort((a,b)=>b.elo-a.elo||b.maxDeckSize-a.maxDeckSize||b.wins-a.wins||a.name.localeCompare(b.name))}
function renderStandingBoard(){
 const body=document.querySelector('[data-standing-rows]');if(!body)return;
 const store=readStandingStore(),profile=sessionStandingProfile(),activeId=profile?standingProfileId(profile):null;
 body.replaceChildren();
 const rows=sortStandingPlayers(sharedStandingRows(store));
 if(!rows.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=6;cell.textContent='Chưa có trận đấu hoàn tất.';row.append(cell);body.append(row)}
 rows.forEach((player,index)=>{const row=document.createElement('tr');if(player.id===activeId){row.className='is-current-profile';row.setAttribute('aria-current','true')}const values=['#'+(index+1),player.name,player.elo,player.wins,player.losses,player.maxDeckSize];values.forEach((value,column)=>{const cell=document.createElement('td');if(column===3)cell.className='standing-wins';if(column===4)cell.className='standing-losses';if(column===2)cell.className='standing-elo';if(column===5){const badge=document.createElement('span');badge.className='standing-deck';badge.textContent=value+' từ';cell.append(badge)}else cell.textContent=String(value);row.append(cell)});body.append(row)});
 const note=document.querySelector('[data-standing-note]');if(note)note.textContent=standingUnsaved||standingReadOnly?'Không lưu được vào thiết bị; kết quả chỉ giữ tạm trong phiên này.':sharedStandingNotice();
 const best=document.querySelector('[data-standing-survival]'),current=store.players.find(row=>row.id===(activeId||localStandingProfile().id));if(best)best.textContent='Kỷ lục sinh tồn: '+(current?.bestSurvivalScore||0)+' câu đúng';
}
function resetStandingBadge(){const badge=document.querySelector('[data-standing-result]');if(badge){badge.hidden=true;badge.textContent=''}}
function isStandingSnapshot(profile){return profile&&typeof profile==='object'&&typeof profile.id==='string'&&profile.id.length<=400&&typeof profile.name==='string'&&profile.name.trim().length>0&&profile.name.length<=50&&Number.isSafeInteger(profile.elo)&&profile.elo>=100&&Number.isSafeInteger(profile.matchesPlayed)&&profile.matchesPlayed>=0&&(profile.id===standingProfileId(profile.name)||/^guest-[a-z0-9-]+$/i.test(profile.id))}
function isStandingDescriptor(value){return value&&typeof value==='object'&&typeof value.id==='string'&&/^pvp-[a-z0-9-]+$/i.test(value.id)&&Number.isSafeInteger(value.deckSize)&&value.deckSize>0&&isPacketArray(value.profiles,2,isStandingSnapshot)}
function activeDeckSize(){return questionPool.length||words.length}
function startBotStanding(){const profile=localStandingProfile();standingMatch={id:'pvc-'+standingUid(),mode:'pvc',deckSize:activeDeckSize(),profile:standingSnapshot(profile),opponent:null,completed:false};resetStandingBadge()}
function createStandingDescriptor(opponent){return {id:'pvp-'+standingUid(),deckSize:activeDeckSize(),profiles:[standingSnapshot(localStandingProfile()),opponent]}}
function acceptStandingDescriptor(descriptor,localSide){standingMatch={id:descriptor.id,mode:'pvp',deckSize:descriptor.deckSize,profile:{...descriptor.profiles[localSide]},opponent:{...descriptor.profiles[1-localSide]},completed:false};resetStandingBadge()}
function descriptorForCurrentMatch(){return {id:standingMatch.id,deckSize:standingMatch.deckSize,profiles:[standingMatch.profile,standingMatch.opponent]}}
function persistStandingResult(match,actualScore,correctCount){
 const store=readStandingStore(),id=match.id+':'+match.profile.id,existing=store.matches.find(row=>row.id===id);if(existing)return existing;
 const previous=store.players.find(row=>row.id===match.profile.id)||newStandingPlayer(match.profile.id,match.profile.name);
 // Freeze the PvC target to the rating captured at match start, including across queued saves.
 const targetCorrect=standingPvCTarget(match.profile.elo);
 if(match.mode==='pvc')actualScore=correctCount>=targetCorrect?1:0;
 const deltaElo=calculateStandingDelta(match.mode,previous,match.opponent?.elo||1000,actualScore,match.deckSize,correctCount,targetCorrect),elo=Math.max(100,previous.elo+deltaElo),finishedAt=new Date().toISOString();
 const player={...previous,name:match.profile.name,elo,wins:previous.wins+(actualScore===1?1:0),losses:previous.losses+(actualScore===0?1:0),matchesPlayed:previous.matchesPlayed+1,maxDeckSize:Math.max(previous.maxDeckSize,match.deckSize),bestSurvivalScore:Math.max(previous.bestSurvivalScore||0,match.mode==='pvc'?correctCount:0),updatedAt:finishedAt};
 const result={id,matchId:match.id,playerId:player.id,opponentId:match.opponent?.id||null,mode:match.mode,outcome:actualScore===1?'win':actualScore===0?'loss':'draw',deckSize:match.deckSize,deckWeight:match.mode==='chess'?1:standingDeckWeight(match.deckSize),correctCount,eloBefore:previous.elo,eloAfter:elo,deltaElo,appliedDeltaElo:elo-previous.elo,finishedAt};
 store.players=store.players.filter(row=>row.id!==player.id);store.players.push(player);store.matches.push(result);store.pendingSync=[...new Set([...store.pendingSync,player.id])];store.updatedAt=finishedAt;if(player.id.startsWith('guest-'))store.guestId=player.id;writeStandingStore(store);return result;
}
function completeStandingMatch(actualScore){
 const match=standingMatch;if(!match||match.completed||(match.mode==='pvc'&&lives[0]!==0))return match?.savePromise;
 match.completed=true;const correctCount=score;
 const save=()=>{const write=()=>persistStandingResult(match,actualScore,correctCount);return typeof navigator!=='undefined'&&navigator.locks?.request?navigator.locks.request(STANDINGS_KEY,write).catch(write):write()};
 match.savePromise=standingWrites.then(save,save);standingWrites=match.savePromise.catch(()=>{});
 match.savePromise.then(result=>{syncSharedStandings();renderStandingBoard();if(standingMatch!==match)return;const badge=document.querySelector('[data-standing-result]');if(badge){const delta=result.appliedDeltaElo;badge.textContent=(delta>=0?'+':'')+delta+' Elo · x'+result.deckWeight+(match.mode==='pvc'?' · '+(result.outcome==='win'?'Thắng':'Thua')+' · '+correctCount+'/'+standingPvCTarget(match.profile.elo)+' câu đúng':'');badge.hidden=false}}).catch(()=>{standingUnsaved=true;renderStandingBoard()});
 return match.savePromise;
}
function updatePvCCountdown(now){const label=document.querySelector('[data-pvc-countdown]');if(!label)return;const task=scheduled.get('bot');if(mode!=='bot'||ended){label.textContent='';return}label.textContent=task?'Còn '+(Math.max(0,paused?task.remaining:task.due-now)/1000).toFixed(1)+'s'+(paused?' · Tạm dừng':''):'Chuẩn bị lượt tiếp theo';}

// Human readiness is distinct from the transport READY acknowledgement.
let pvpRoom=null,pvpRoomCode='';
function renderPvPRoom(){
 const panel=document.querySelector('[data-pvp-room]'),cards=document.querySelector('[data-pvp-room-players]'),button=document.querySelector('[data-pvp-ready]');
 const waiting=!!pvpRoom&&!pvpRoom.starting;
 for(const id of ['host','join','code'])$(id).disabled=waiting;
 if(panel)panel.hidden=!waiting;
 if(!waiting)return;
 const label=document.querySelector('[data-pvp-room-label]');if(label)label.textContent='Phòng '+pvpRoomCode+' · Bộ '+pvpRoom.standing.deckSize+' từ';
 if(cards){cards.replaceChildren();pvpRoom.players.forEach((hero,index)=>{
  const card=document.createElement('article');card.className='pvp-room-player'+(index===side?' is-you':'');
  const art=portrait(hero);art.classList.add('pvp-room-portrait');card.append(art);
  const role=document.createElement('small');role.textContent=(index===side?'Bạn · ':'')+(index===0?'Chủ phòng':'Đối thủ');card.append(role);
  const name=document.createElement('strong');name.textContent=pvpRoom.standing.profiles[index].name;card.append(name);
  const info=document.createElement('span');info.textContent=heroes[hero]+' · '+pvpRoom.standing.profiles[index].elo+' Elo';card.append(info);
  const ready=document.createElement('b');ready.className=pvpRoom.ready[index]?'is-ready':'';ready.textContent=pvpRoom.ready[index]?'Đã sẵn sàng':'Chưa sẵn sàng';card.append(ready);cards.append(card);
 })}
 if(button){button.disabled=!pvpRoom.linked||pvpRoom.localReady;button.textContent=pvpRoom.localReady?'ĐÃ SẴN SÀNG':'SẴN SÀNG'}
 status(pvpRoom.localReady?'Bạn đã sẵn sàng. Đang chờ đối thủ…':'Kiểm tra đối thủ rồi bấm Sẵn sàng. Cả hai đồng ý mới bắt đầu.');
}
function resetPvPRoom(){pvpRoom=null;pvpRoomCode='';renderPvPRoom()}
function broadcastPvPRoom(){send({type:'ROOM_STATE',version:PVP_PROTOCOL,room:pvpRoom.standing.id,ready:[...pvpRoom.ready]})}
function markPvPRoomReady(){
 if(!pvpRoom||pvpRoom.starting||!pvpRoom.linked||pvpRoom.localReady||!conn?.open)return;
 pvpRoom.localReady=true;pvpRoom.ready[side]=true;renderPvPRoom();
 if(mode==='host'){broadcastPvPRoom();tryStartPvPRoom()}else send({type:'ROOM_READY',version:PVP_PROTOCOL,room:pvpRoom.standing.id,value:true});
}
function enterPvPRoomBattle(){
 const room=pvpRoom,localSide=mode==='host'?0:1;room.starting=true;
 setup(mode);side=localSide;players=[...room.players];names=[...room.names];acceptStandingDescriptor(room.standing,side);updateHUD();renderPvPRoom();
 $('roundStatus').textContent='Cả hai đã sẵn sàng. Đang đồng bộ câu hỏi…';
}
function tryStartPvPRoom(){
 if(mode!=='host'||!pvpRoom||pvpRoom.starting||!pvpRoom.linked||!pvpRoom.localReady||!pvpRoom.ready.every(Boolean)||!conn?.open)return;
 enterPvPRoomBattle();send({type:'MATCH_START',version:PVP_PROTOCOL,room:pvpRoom.standing.id});
 startConnectionTimer('Đối thủ chưa nhận được lệnh bắt đầu. Hãy kết nối lại.');
}
function receivePvPRoomMessage(data){
 if(!['ROOM_LINKED','ROOM_STATE','ROOM_READY','MATCH_START'].includes(data.type))return false;
 if(!pvpRoom||data.version!==PVP_PROTOCOL||data.room!==pvpRoom.standing.id||pvpRoom.starting)return true;
 if(mode==='host'&&data.type==='ROOM_LINKED'){
  clearConnectionTimer();pvpRoom.linked=true;renderPvPRoom();broadcastPvPRoom();tryStartPvPRoom();
 }else if(mode==='host'&&data.type==='ROOM_READY'&&data.value===true&&pvpRoom.linked){
  pvpRoom.ready[1]=true;renderPvPRoom();broadcastPvPRoom();tryStartPvPRoom();
 }else if(mode==='guest'&&data.type==='ROOM_STATE'&&isPacketArray(data.ready,2,value=>typeof value==='boolean')){
  pvpRoom.ready=[...data.ready];renderPvPRoom();
 }else if(mode==='guest'&&data.type==='MATCH_START'&&pvpRoom.localReady&&pvpRoom.ready.every(Boolean)){
  enterPvPRoomBattle();send({type:'READY',version:PVP_PROTOCOL,room:pvpRoom.standing.id});startConnectionTimer('Không nhận được câu hỏi từ chủ phòng. Hãy kết nối lại.');
 }
 return true;
}

let cloudStandingRows=[],cloudStandingState='offline',cloudStandingService=null,cloudStandingReady=Promise.resolve(),cloudSyncRunning=false,cloudSyncAgain=false;
function sharedStandingRows(store){
 const rows=new Map(cloudStandingRows.filter(isStandingPlayer).map(row=>[row.id,row]));
 for(const row of store.players)if(!rows.has(row.id)||store.pendingSync.includes(row.id))rows.set(row.id,row);
 return [...rows.values()];
}
function sharedStandingNotice(){return cloudStandingState==='online'?'Bảng chung · Đã kết nối Homepage':cloudStandingState==='cached'?'Bảng chung đã lưu · Đang chờ đồng bộ':'Lưu trên trình duyệt · Sẽ đồng bộ khi kết nối được Homepage'}
async function hydrateSharedStanding(name,epoch){
 if(!cloudStandingService||!name||(typeof navigator!=='undefined'&&navigator.onLine===false))return;await cloudStandingReady;
 if(epoch!==navigationEpoch||name!==accountName())return;
 try{
  const metadata=await cloudStandingService.profile(name);if(!metadata||epoch!==navigationEpoch||name!==accountName())return;
  const id=standingProfileId(metadata.username),remote=await cloudStandingService.player(id);
  if(epoch!==navigationEpoch||name!==accountName()||!isStandingPlayer(remote))return;
  const commit=()=>{if(epoch!==navigationEpoch||name!==accountName())return;const store=readStandingStore();if(store.pendingSync.includes(id))return;const local={id:remote.id,name:remote.name,elo:remote.elo,wins:remote.wins,losses:remote.losses,matchesPlayed:remote.matchesPlayed,maxDeckSize:remote.maxDeckSize,bestSurvivalScore:remote.bestSurvivalScore||0,updatedAt:null};store.players=store.players.filter(row=>row.id!==id);store.players.push(local);writeStandingStore(store)};
  const save=()=>typeof navigator!=='undefined'&&navigator.locks?.request?navigator.locks.request(STANDINGS_KEY,commit):commit();
  standingWrites=standingWrites.then(save,save).catch(()=>{});await standingWrites;renderStandingBoard();
 }catch(_){/* Offline play retains its local profile and pending result ledger. */}
}
async function finishStandingPair(descriptor,localSide,actualScore){
 if(!descriptor||!['pvp','chess'].includes(descriptor.mode)||typeof descriptor.id!=='string'||!isPacketArray(descriptor.profiles,2,isStandingSnapshot)||descriptor.profiles[0].id===descriptor.profiles[1].id||![0,1].includes(localSide)||![0,.5,1].includes(actualScore)||(descriptor.mode==='pvp'?!Number.isSafeInteger(descriptor.deckSize)||descriptor.deckSize<1:descriptor.deckSize!==0))throw Error('Invalid paired decision');
 const snapshots=descriptor.profiles.map(p=>({...p})),scores=localSide===0?[actualScore,1-actualScore]:[1-actualScore,actualScore];
 const seed=await Promise.all(snapshots.map(async p=>{if(cloudStandingService?.db&&typeof navigator!=='undefined'&&navigator.onLine!==false){try{const row=await cloudStandingService.player(p.id);if(isStandingPlayer(row))return row}catch(_){}}return cloudStandingRows.find(row=>row.id===p.id&&isStandingPlayer(row))||{...newStandingPlayer(p.id,p.name),elo:p.elo,matchesPlayed:p.matchesPlayed}}));
 const save=()=>{const write=()=>{const store=readStandingStore();for(const row of seed)if(!store.players.some(p=>p.id===row.id))store.players.push({...row,updatedAt:null});writeStandingStore(store);return snapshots.map((profile,i)=>persistStandingResult({id:descriptor.id,mode:descriptor.mode,deckSize:descriptor.deckSize,profile,opponent:snapshots[1-i]},scores[i],0))};return typeof navigator!=='undefined'&&navigator.locks?.request?navigator.locks.request(STANDINGS_KEY,write).catch(write):write()};
 const task=standingWrites.then(save,save);standingWrites=task.catch(()=>{});const results=await task;renderStandingBoard();await syncSharedStandings();
 if(cloudStandingService?.result&&typeof navigator!=='undefined'&&navigator.onLine!==false){try{const canonical=await cloudStandingService.result(snapshots[localSide].id,descriptor.id);if(canonical&&['win','loss','draw'].includes(canonical.outcome))return canonical}catch(_){}}
 return results[localSide];
}

async function syncSharedStandings(){
 if(!cloudStandingService?.db||(typeof navigator!=='undefined'&&navigator.onLine===false))return;
 if(cloudSyncRunning){cloudSyncAgain=true;return}cloudSyncRunning=true;
 try{
  do{
   cloudSyncAgain=false;const store=readStandingStore();
   for(const id of store.pendingSync){
    const profile=store.players.find(row=>row.id===id);if(!profile||id.startsWith('guest-'))continue;
    const results=store.matches.filter(row=>row.playerId===id);if(!results.length||!await cloudStandingService.profile(profile.name))continue;
    for(const result of results){const other=store.matches.find(row=>row.matchId===result.matchId&&row.playerId===result.opponentId&&row.opponentId===result.playerId),opponent=other&&store.players.find(p=>p.id===other.playerId);if(other&&opponent&&cloudStandingService.syncPair&&await cloudStandingService.profile(opponent.name))await cloudStandingService.syncPair([result,other],[profile,opponent]);else await cloudStandingService.sync(result,profile)}
    const remote=await cloudStandingService.player(id);if(!isStandingPlayer(remote))continue;
    const known=new Set(results.map(row=>row.id));
    const commit=()=>{const current=readStandingStore();if(current.matches.some(row=>row.playerId===id&&!known.has(row.id))){cloudSyncAgain=true;return}const local=current.players.find(row=>row.id===id);if(!local)return;Object.assign(local,{elo:remote.elo,wins:remote.wins,losses:remote.losses,matchesPlayed:remote.matchesPlayed,maxDeckSize:remote.maxDeckSize,bestSurvivalScore:remote.bestSurvivalScore||0,updatedAt:local.updatedAt});current.pendingSync=current.pendingSync.filter(value=>value!==id);writeStandingStore(current)};
    const save=()=>typeof navigator!=='undefined'&&navigator.locks?.request?navigator.locks.request(STANDINGS_KEY,commit):commit();standingWrites=standingWrites.then(save,save).catch(()=>{});await standingWrites;
   }
  }while(cloudSyncAgain);
 }catch(_){cloudStandingState='offline'}finally{cloudSyncRunning=false;renderStandingBoard()}
}
function startSharedStandings(){
 if(typeof SharedStandingService==='undefined'||typeof QUICKDRAWN_FIREBASE_CONFIG==='undefined')return;
 cloudStandingService=new SharedStandingService(QUICKDRAWN_FIREBASE_CONFIG);
 cloudStandingReady=cloudStandingService.start((rows,state)=>{if(rows)cloudStandingRows=rows;cloudStandingState=state;renderStandingBoard()}).then(users=>{const list=$('lexicalUsers'),existing=new Set(Array.from(list.children).map(option=>option.value));for(const name of users)if(!existing.has(name)){const option=document.createElement('option');option.value=name;list.append(option)}syncSharedStandings();return users}).catch(()=>{cloudStandingState='offline';renderStandingBoard()});
 window.addEventListener('online',()=>{syncSharedStandings()});window.addEventListener('focus',()=>{syncSharedStandings()});
}

function makeQuestions(entries){
 const fallback=words.flatMap(item=>item.slice(2));
 const pool=entries.flatMap(item=>item.synonyms||[]),seenWords=new Set();
 return entries.flatMap(item=>{const wordKey=String(item.word||'').trim().toLocaleLowerCase();if(!wordKey||seenWords.has(wordKey))return [];seenWords.add(wordKey);const candidates=[...new Set((item.synonyms||[]).filter(Boolean))];if(!item.word||!item.meaning||!candidates.length)return [];const answer=candidates[0],blocked=new Set([item.word,...candidates].map(v=>v.toLowerCase().trim()));const distractors=[];for(const value of shuffle([...pool,...fallback])){const k=value.toLowerCase().trim();if(!k||blocked.has(k))continue;blocked.add(k);distractors.push(value);if(distractors.length===3)break}return distractors.length===3?[{word:item.word,meaning:item.meaning,answer,options:[answer,...distractors]}]:[]});
}
async function prepareVocabulary(epoch=navigationEpoch){
 const user=accountName(),isCurrent=()=>epoch===navigationEpoch&&user===accountName();
 if(!isCurrent())return false;
 if(!user){questionBag=[];questionPool=[];vocabSource='starter';$('vocabNotice').textContent='Chưa chọn tài khoản; đang dùng bộ từ mẫu.';return true}
 const loaded=await tryLoadFromIndexedDB(user,{masteredOnly:false});
 if(!isCurrent())return false;
 await hydrateSharedStanding(user,epoch);
 if(!isCurrent())return false;
 questionBag=[];questionPool=makeQuestions(loaded.words||[]);vocabSource=questionPool.length?'lexical':'starter';$('vocabNotice').textContent=questionPool.length?`Đã nạp ${questionPool.length} từ thuộc tài khoản ${user}.`:`Không tìm thấy từ phù hợp của ${user} trên nguồn này; dùng bộ từ mẫu.`;return true;
}
const detected=detectStoredUsername();if(detected)$('username').value=detected;discoverLocalUsers().then(users=>{const list=$('lexicalUsers');for(const name of users){const option=document.createElement('option');option.value=name;list.append(option)}$('vocabNotice').textContent=detected?`Tài khoản: ${detected}. Từ sẽ được nạp khi vào trận.`:'Chọn tài khoản Lexical Space; nếu chưa có sẽ dùng bộ từ mẫu.'}).catch(()=>{$('vocabNotice').textContent='Không đọc được danh sách tài khoản; có thể dùng bộ từ mẫu.'});


const collectionKeys={selected:'selected_hero',skins:'selected_hero_skins'};
function readStorage(key){try{return localStorage.getItem(key)}catch(_){return null}}
function writeStorage(key,value){try{localStorage.setItem(key,value);return true}catch(_){return false}}
function readJson(key,fallback){try{return JSON.parse(readStorage(key))||fallback}catch(_){return fallback}}
let owned=Object.keys(heroes),skinSelections=readJson(collectionKeys.skins,{}),selected=readStorage(collectionKeys.selected),galleryHero=null;
if(!skinSelections||typeof skinSelections!=='object'||Array.isArray(skinSelections))skinSelections={};
if(!Object.hasOwn(heroes,selected))selected='ngo';
function setSelected(id){if(!Object.hasOwn(heroes,id))return;selected=id;$('hero').value=id;writeStorage(collectionKeys.selected,id);$('selectedHeroName').textContent=heroes[id];}
setSelected(selected);
function portrait(id){const el=document.createElement('div');el.className='hero-portrait';el.style.backgroundImage=id==='lac'?`url("assets/images/heroes/${id}.png"),radial-gradient(circle at 50% 46%, transparent 30%, #e3ba49 32%, #f6df80 35%, transparent 38%)`:`url("assets/images/heroes/${id}.png")`;if(id==='lac'){el.style.backgroundSize='600% 500%,100% 100%';el.style.backgroundPosition='0 0,center'}return el}
function drawGallery(id){galleryHero=id;$('skinTitle').textContent=`Trang phục · ${heroes[id]}`;$('heroGrid').replaceChildren();$('skinGrid').replaceChildren();
 for(const heroId of Object.keys(heroes)){const btn=document.createElement('button');btn.type='button';btn.className=`hero-card ${heroId===id?'is-selected':''}`;btn.setAttribute('aria-label',heroes[heroId]);btn.append(portrait(heroId));const label=document.createElement('span');label.textContent=heroes[heroId];btn.append(label);btn.onclick=()=>{setSelected(heroId);drawGallery(heroId)};$('heroGrid').append(btn)}
 for(let index=0;index<3;index++){const unlocked=index===0,btn=document.createElement('button');btn.type='button';btn.className=`skin-card ${!unlocked?'locked':''} ${unlocked&&selected===id?'is-selected':''}`;btn.setAttribute('aria-label',`${index===0?'Skin mặc định':`Skin ${index}`}${unlocked?'':' — chưa mở khóa'}`);btn.append(portrait(id));if(!unlocked){const lock=document.createElement('span');lock.className='lock-icon';lock.textContent='🔒';btn.append(lock)}const label=document.createElement('span');label.textContent=index===0?'Mặc định':`Skin ${index}`;btn.append(label);btn.onclick=()=>{if(!unlocked){$('skinTitle').textContent='Trang phục này chưa được mở khóa';return}skinSelections[id]=0;writeStorage(collectionKeys.skins,JSON.stringify(skinSelections));setSelected(id);$('galleryModal').hidden=true;$('openGallery').focus()};$('skinGrid').append(btn)}
}
function openGallery(){drawGallery(selected);$('galleryModal').hidden=false;$('closeGallery').focus()}
$('openGallery').onclick=openGallery;$('closeGallery').onclick=()=>{$('galleryModal').hidden=true;$('openGallery').focus()};
$('openBotMenu').onclick=async()=>{const button=$('openBotMenu'),epoch=++navigationEpoch;button.disabled=true;try{const ready=await prepareVocabulary(epoch);if(!ready||epoch!==navigationEpoch)return;clean();setup('bot');players[1]='tran';beginRound()}finally{button.disabled=false}};
$('openPvpMenu').onclick=()=>{navigationEpoch++;$('pvpMenu').hidden=false;$('closePvpMenu').focus()};$('closePvpMenu').onclick=()=>{clean();$('pvpMenu').hidden=true;status('Chia sẻ mã phòng với đối thủ.');$('openPvpMenu').focus()};
for(const element of document.querySelectorAll('.simple-corners, .pause-card, .ba-vuong-container, #battle .arena, #battle .question, #battle'))for(const position of ['tl','tr','bl','br']){const c=document.createElement('span');c.className='corner corner-'+position;c.setAttribute('aria-hidden','true');element.append(c)}
const lobbyCanvas=$('lobbyHero'),lobbyCtx=lobbyCanvas.getContext('2d');function renderLobby(now){if(!$('lobby').hidden&&selected){const im=sprites[selected];lobbyCtx.clearRect(0,0,229,229);if(selected==='lac'){lobbyCtx.save();lobbyCtx.translate(114.5,165);drawDragonHalo(170,now,lobbyCtx);lobbyCtx.restore()}if(im?.complete&&im.naturalWidth){const w=im.naturalWidth/6,h=im.naturalHeight/5;const frame=Math.floor(now/166.667)%6;lobbyCtx.imageSmoothingEnabled=false;lobbyCtx.drawImage(im,frame*w,0,w,h,0,0,229,229)}}requestAnimationFrame(renderLobby)}requestAnimationFrame(renderLobby);

function shuffle(a){const out=[...a];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
function status(t){$('status').textContent=t}
function clean(){duelRecovery?.reset();duelRecoveryPlan=null;duelLastResult=null;duelDecision=null;duelRecoveryTicket=null;resetPvPRoom();standingMatch=null;joiningStandingProfile=null;resetStandingBadge();navigationEpoch++;connectionEpoch++;clearTimeout(connectionTimer);connectionTimer=null;clearTasks();myRematchReady=false;peerRematchReady=false;$('rematchPanel').hidden=true;$('answers').hidden=false;clearTimeout(botTimer);clearTimeout(nextTimer);clearTimeout(impactTimer);clearTimeout(fallTimer);fx=null;preview=null;$('victoryBanner').hidden=true;const oldConn=conn,oldPeer=peer;conn=null;peer=null;if(oldConn)oldConn.close();if(oldPeer)oldPeer.destroy();mode='';locked=true;ended=true}
function send(v){if(conn&&conn.open)try{conn.send(v)}catch(_){duelRecovery?.lost('Đường truyền bị gián đoạn. Đang kết nối lại…')}}
function setup(m){duelDecision=null;duelLastResult=null;mode=m;side=0;matchId=1;myRematchReady=false;peerRematchReady=false;$('rematchPanel').hidden=true;$('answers').hidden=false;players=[$('hero').value,m==='bot'?'tran':null];names=[myName(),m==='bot'?'Máy':'Đang kết nối'];score=0;$('scoreValue').textContent='0';$('scorePanel').hidden=m!=='bot';lives=[10,10];displayLives=[10,10];if(m!=='guest'){mapCursor=(mapCursor+1)%ARENA_MAPS.length;currentMap=ARENA_MAPS[mapCursor].id;}round=0;question=null;ended=false;locked=true;fx=null;preview=null;poses=['idle','idle'];$('word').textContent='—';$('meaning').textContent='';$('answers').replaceChildren();$('roundStatus').textContent=m==='bot'?'Đang chuẩn bị câu hỏi…':'Đang đồng bộ trận đấu…';$('battleMessage').textContent='';$('victoryBanner').hidden=true;$('battle').hidden=false;$('lobby').hidden=true;$('pvpMenu').hidden=true;document.body.classList.add('in-battle');if(m==='bot')startBotStanding();else resetStandingBadge();updateHUD()}
function updateHUD(){for(let i=0;i<2;i++){ $('name'+i).textContent=`${names[i]} - ${heroes[players[i]]||'Danh tướng'}`;const hp=$('lives'+i),container=hp.querySelector('.hp-pips');if(mode==='bot'&&i===1){container.innerHTML='<span class="hp-infinity" aria-hidden="true">∞</span>';hp.removeAttribute('aria-valuenow');hp.setAttribute('aria-valuetext','Máu vô hạn');continue}if(container.querySelector('.hp-infinity'))container.replaceChildren();const value=Math.max(0,Math.min(10,displayLives[i]));if(!container.children.length){for(let n=0;n<10;n++){const pip=document.createElement('span');pip.className='hp-pip';pip.setAttribute('aria-hidden','true');pip.addEventListener('animationend',()=>pip.classList.remove('breaking'));container.append(pip)}}const prev=Number(hp.dataset.value||10);for(let n=0;n<10;n++){const pip=container.children[n],remaining=i===0?n<value:n>=10-value,oldRemaining=i===0?n<prev:n>=10-prev;const healthIndex=i===0?n:9-n,breaking=pip.classList.contains('breaking')&&!remaining;pip.className='hp-pip '+(healthIndex<3?'red':healthIndex<6?'yellow':'green')+(remaining?'':' depleted')+(breaking?' breaking':'');if(oldRemaining&&!remaining){void pip.offsetWidth;pip.classList.add('breaking')}}hp.dataset.value=String(value);hp.setAttribute('aria-valuenow',String(value));hp.setAttribute('aria-valuetext',`${value} trên 10 máu`)}}
function nextQuestion(){
 if(!questionBag.length){const source=questionPool.length?questionPool:words.map(w=>({word:w[0],meaning:w[1],answer:w[2],options:w.slice(2)}));questionBag=shuffle(source);if(questionBag.length>1&&questionBag[questionBag.length-1].word.trim().toLocaleLowerCase()===lastQuestionKey){[questionBag[0],questionBag[questionBag.length-1]]=[questionBag[questionBag.length-1],questionBag[0]]}}
 const item=questionBag.pop();lastQuestionKey=item.word.trim().toLocaleLowerCase();return {...item,options:shuffle(item.options)};
}
function beginRound(){if(ended)return;round++;const q=nextQuestion();question=q;send({type:'ROUND',match:matchId,round,question,players,lives,names,map:currentMap,vocabSource,poolSize:questionPool.length||words.length});showRound(round,question,players,lives,names,currentMap,questionPool.length||words.length);if(mode==='bot'){const delay=Math.max(1750,7000-(round-1)*200);$('botSpeed').textContent=`Máy: ${(delay/1000).toFixed(2).replace(/0$/,'')} giây · Mục tiêu: ${standingPvCTarget(standingMatch.profile.elo)} câu`;schedule('bot',()=>resolveHit(1),delay)}}
function showRound(n,q,p,l,newNames,newMap,poolSize){round=n;question=q;players=p;lives=l;if(Array.isArray(newNames)&&newNames.length===2)names=newNames.map(v=>String(v).slice(0,18));if(ARENA_MAPS.some(m=>m.id===newMap))currentMap=newMap;displayLives=[...l];locked=false;poses=['idle','idle'];fx=null;preview=null;$('victoryBanner').hidden=true;$('rematchPanel').hidden=true;$('answers').hidden=false;updateHUD();$('word').textContent=q.word;$('meaning').textContent=`(${q.meaning})`;$('battleMessage').textContent='';$('roundStatus').textContent=poolSize===1?'Bộ từ chỉ có một câu phù hợp nên câu sẽ lặp.':'Chọn đáp án đúng trước đối thủ!';$('answers').replaceChildren();q.options.forEach((opt,i)=>{let b=document.createElement('button');b.textContent=opt;b.dataset.key=String(i+1);b.setAttribute('aria-keyshortcuts',String(i+1));b.onclick=()=>answer(i);$('answers').append(b)})}
function disableAnswers(){locked=true;document.querySelectorAll('#answers button').forEach(b=>b.disabled=true)}
function answer(i){if(locked||ended||paused||duelRecovery?.blocked)return;combatSound.play('tap_click');const correct=question.options[i]===question.answer;disableAnswers();if(!correct){$('roundStatus').textContent='Sai! Đối thủ phản đòn.';if(mode==='guest')send({type:'MISS',match:matchId,round,choice:i});else resolveHit(1);return}poses[side]='attack';$('roundStatus').textContent='Đã ra đòn!';if(mode==='guest'){const hero=players[side];preview={start:performance.now(),winner:side,hero,impact:CombatAnimator.impactMs(hero)};if(hero==='vuong')preview.tauntIndex=randomTeacherTaunt();if(hero!=='vuong')combatSound.play(hero==='chu'?'scroll_cast':(hero==='mai'||hero==='toan')?'fruit_throw':hero==='an'?'bow_shot':hero==='trung'?'elephant_charge':'shout_attack');send({type:'HIT',match:matchId,round,choice:i,hero,timestamp:performance.now(),...(hero==='vuong'?{tauntIndex:preview.tauntIndex}:{})})}else resolveHit(0)}
function resolveHit(winner,tauntIndex){if(ended||!question||fx)return;cancelTask('bot');disableAnswers();let loser=1-winner;if(mode==='bot'&&winner===0){score++;}else lives[loser]=Math.max(0,lives[loser]-1);const final=lives[loser]===0;let result={type:'RESULT',match:matchId,round,winner,lives:[...lives],final};if(players[winner]==='vuong')result.tauntIndex=isTeacherTauntIndex(tauntIndex)?tauntIndex:randomTeacherTaunt();send(result);applyResult(result);if(!final)schedule('next',beginRound,1300)}
function applyResult(result){
 if(result.round!==round||ended||fx)return;duelLastResult={...result,lives:[...result.lives]};
 disableAnswers();lives=[...result.lives];const winner=result.winner,loser=1-winner,hero=players[winner],hitTimes=hero==='vuong'&&result.final?[CombatAnimator.impactMs(hero)]:CombatAnimator.hitTimes(hero);
 const alreadyPlayed=preview&&preview.winner===winner,previewTaunt=alreadyPlayed?preview.tauntIndex:undefined;preview=null;fx={start:performance.now(),winner,final:result.final,hero,impact:hitTimes[0],impacted:false,lastHitAt:0,deadStart:0};if(hero==='vuong')fx.tauntIndex=isTeacherTauntIndex(result.tauntIndex)?result.tauntIndex:isTeacherTauntIndex(previewTaunt)?previewTaunt:randomTeacherTaunt();
 poses[winner]='attack';poses[loser]='idle';
 if(!alreadyPlayed&&hero!=='vuong')combatSound.play(hero==='chu'?'scroll_cast':(hero==='mai'||hero==='toan')?'fruit_throw':hero==='an'?'bow_shot':hero==='trung'?'elephant_charge':'shout_attack');
 $('battleMessage').textContent='';$('roundStatus').textContent='Đòn đánh đang tới…';
 const currentFx=fx;
 if(CombatAnimator.isRanged(hero))schedule('secondBow',()=>{if(fx===currentFx)combatSound.play(hero==='chu'?'scroll_cast':(hero==='mai'||hero==='toan')?'fruit_throw':'bow_shot')},250);
 hitTimes.forEach((time,index)=>schedule('impact'+index,()=>{
  if(fx!==currentFx)return;
  currentFx.impacted=true;const wasAlive=displayLives[loser]>0;
  if(wasAlive){if(index===0&&!(mode==='bot'&&loser===1))displayLives[loser]=Math.max(0,displayLives[loser]-1);currentFx.lastHitAt=performance.now();poses[loser]='hit'}
  if(index===0){displayLives=[...result.lives];if(mode==='bot')$('scoreValue').textContent=String(score)}
  combatSound.play(hero==='vuong'?(result.final?'teacher_vuong_slap':'teacher_vuong_punch'):CombatAnimator.isRanged(hero)?'impact':'sword_slash');$('canvas').classList.remove('shake');void $('canvas').offsetWidth;$('canvas').classList.add('shake');updateHUD();
  $('battleMessage').textContent=result.final&&displayLives[loser]===0?(winner===side?'CHIẾN THẮNG!':'THẤT BẠI!'):(winner===side?'TRÚNG ĐÒN!':'ĐỐI THỦ RA ĐÒN!');
  $('roundStatus').textContent=result.final&&displayLives[loser]===0?'Trận đấu kết thúc.':'Chuẩn bị câu tiếp theo…';
  if(wasAlive&&displayLives[loser]===0)schedule('fall',()=>{if(fx!==currentFx)return;poses[loser]='dead';currentFx.deadStart=performance.now();combatSound.play('fall_defeat')},250);
 },time));
 if(result.final){ended=true;completeStandingMatch(winner===side?1:0);schedule('victory',()=>{if(fx===currentFx){currentFx.victoryStart=performance.now();$('victoryBanner').hidden=false;$('battleMessage').textContent='';showRematchPanel()}},1100)}
}
function clearConnectionTimer(){clearTimeout(connectionTimer);connectionTimer=null}
function connectionFailed(message){
 clearConnectionTimer();if(duelRecovery?.lost(message))return;
 if($('battle').hidden){const old=conn;conn=null;pvpRoom=null;renderPvPRoom();if(old)old.close();status(message);return}
 clearTasks();ended=true;disableAnswers();$('battleMessage').textContent='MẤT KẾT NỐI';$('roundStatus').textContent=message;showRematchPanel();$('rematch').disabled=true;$('rematchStatus').textContent='Về sảnh để kết nối lại.';
}
function startConnectionTimer(message){clearConnectionTimer();const current=connectionEpoch;connectionTimer=setTimeout(()=>{if(current!==connectionEpoch)return;const c=conn;conn=null;if(c)c.close();connectionFailed(message)},CONNECTION_TIMEOUT_MS)}
function peerErrorMessage(error){switch(error?.type){case 'peer-unavailable':return 'Không tìm thấy phòng. Kiểm tra mã và đảm bảo chủ phòng vẫn mở sảnh.';case 'unavailable-id':return 'Mã phòng đang được sử dụng. Hãy tạo lại phòng.';case 'browser-incompatible':return 'Trình duyệt không hỗ trợ kết nối PvP. Hãy thử Chrome hoặc Edge mới.';default:return 'Không kết nối được. Kiểm tra mạng, thử lại hoặc đổi mạng.'}}
function isPacketArray(value,length,check){return Array.isArray(value)&&value.length===length&&Array.from(value).every(check)}
function isValidRoundPayload(data){
 const q=data.question,text=value=>typeof value==='string'&&value.trim().length>0;
 return Number.isSafeInteger(data.match)&&data.match>0&&Number.isSafeInteger(data.round)&&data.round>0&&
  q!==null&&typeof q==='object'&&!Array.isArray(q)&&text(q.word)&&text(q.meaning)&&text(q.answer)&&
  isPacketArray(q.options,4,text)&&q.options.includes(q.answer)&&
  isPacketArray(data.players,2,id=>typeof id==='string'&&Object.hasOwn(heroes,id))&&
  isPacketArray(data.lives,2,hp=>Number.isInteger(hp)&&hp>=0&&hp<=10)&&
  isPacketArray(data.names,2,name=>typeof name==='string')&&ARENA_MAPS.some(map=>map.id===data.map)&&
  ['starter','lexical'].includes(data.vocabSource)&&Number.isSafeInteger(data.poolSize)&&data.poolSize>0;
}
function isValidResultPayload(data){
 return Number.isSafeInteger(data.match)&&data.match>0&&Number.isSafeInteger(data.round)&&data.round>0&&
  [0,1].includes(data.winner)&&typeof data.final==='boolean'&&(data.tauntIndex===undefined||isTeacherTauntIndex(data.tauntIndex))&&
  isPacketArray(data.lives,2,hp=>Number.isInteger(hp)&&hp>=0&&hp<=10)&&data.final===(data.lives[1-data.winner]===0);
}
function receiveData(data){
 if(!data||typeof data!=='object'||Array.isArray(data))return;
 // Validate before buffering or changing state; round/result fields remain unchanged.
 if(data.type==='ROUND'&&(!isValidRoundPayload(data)||(standingMatch&&data.poolSize!==standingMatch.deckSize)))return;
 if(data.type==='RESULT'&&!isValidResultPayload(data))return;
 if(data.type==='HIT'&&data.tauntIndex!==undefined&&!isTeacherTauntIndex(data.tauntIndex))return;
 if(data.type==='PROTOCOL_ERROR'){const c=conn;conn=null;if(c)c.close();connectionFailed('Hai máy đang dùng khác phiên bản. Cả hai hãy cập nhật và tải lại trò chơi.');return}
 if(mode==='host'&&data.type==='HELLO'){
  if(!$('battle').hidden||pvpRoom)return;
  if(data.version!==PVP_PROTOCOL||!Object.hasOwn(heroes,data.hero)||!isStandingSnapshot(data.rating)){const c=conn;if(c?.open)c.send({type:'PROTOCOL_ERROR',version:PVP_PROTOCOL});clearConnectionTimer();conn=null;if(c)setTimeout(()=>c.close(),150);status('Hai máy đang dùng khác phiên bản. Cả hai hãy cập nhật và tải lại trò chơi.');return}
  clearConnectionTimer();side=0;pvpRoom={players:[$('hero').value,data.hero],names:[myName(),typeof data.name==='string'?data.name.slice(0,18)||'P2':'P2'],standing:createStandingDescriptor(data.rating),ready:[false,false],localReady:false,linked:false,starting:false};
  duelRecoveryTicket=duelRecovery?.accept(data.recovery,conn);renderPvPRoom();send({type:'WELCOME',version:PVP_PROTOCOL,players:pvpRoom.players,names:pvpRoom.names,standing:pvpRoom.standing,recovery:duelRecoveryTicket});startConnectionTimer('Đối thủ chưa xác nhận kết nối phòng. Hãy thử lại.');return
 }
 if(mode==='guest'&&data.type==='WELCOME'){
  if(!$('battle').hidden||pvpRoom)return;
  if(data.version!==PVP_PROTOCOL||!isPacketArray(data.players,2,id=>typeof id==='string'&&Object.hasOwn(heroes,id))||!isPacketArray(data.names,2,name=>typeof name==='string')||!isStandingDescriptor(data.standing)||data.standing.profiles[1].id!==joiningStandingProfile?.id){const c=conn;conn=null;if(c)c.close();connectionFailed('Hai máy đang dùng khác phiên bản. Cả hai hãy cập nhật và tải lại trò chơi.');return}
  clearConnectionTimer();if(!duelRecovery?.active)duelRecovery?.adopt(data.recovery,conn);side=1;pvpRoomCode=$('code').value.trim();pvpRoom={players:[...data.players],names:data.names.map(name=>name.slice(0,18)),standing:data.standing,ready:[false,false],localReady:false,linked:true,starting:false};renderPvPRoom();send({type:'ROOM_LINKED',version:PVP_PROTOCOL,room:pvpRoom.standing.id});return
 }
 if(receivePvPRoomMessage(data))return;
 if(pvpRoom&&!pvpRoom.starting)return;
 if(mode==='host'&&data.type==='READY'&&data.version===PVP_PROTOCOL&&pvpRoom?.starting&&data.room===pvpRoom.standing.id&&round===0&&!ended){clearConnectionTimer();beginRound();return}
 if(paused&&['HIT','MISS','RESULT','ROUND','REMATCH_READY','REMATCH_START'].includes(data.type)){pendingMessages.push(data);return;}
 if(['HIT','MISS','RESULT','ROUND'].includes(data.type)&&data.match!==matchId)return;
 if(data.type==='REMATCH_READY'){if(ended&&data.match===matchId&&standingMatch&&isStandingSnapshot(data.rating)&&data.rating.id===standingMatch.opponent.id){standingMatch.opponent={...data.rating};peerRematchReady=true;updateRematchStatus();if(mode==='host'&&myRematchReady)startRematch()}return}
 if(data.type==='REMATCH_START'){if(mode==='guest'&&ended&&myRematchReady&&data.match===matchId+1&&isStandingDescriptor(data.standing)&&standingMatch&&data.standing.id!==standingMatch.id&&data.standing.profiles[1].id===standingMatch.profile.id&&data.standing.profiles[0].id===standingMatch.opponent.id&&data.standing.deckSize===standingMatch.deckSize)startRematch(false,data.standing);return}
 if(data.type==='PAUSE'&&typeof data.value==='boolean'){setPaused(data.value,false)}
 else if(mode==='guest'&&data.type==='ROUND'&&data.round>round){clearConnectionTimer();showRound(data.round,data.question,data.players,data.lives,data.names,data.map,data.poolSize)}
 else if(mode==='host'&&data.type==='MISS'&&data.round===round&&!locked&&Number.isInteger(data.choice)&&data.choice>=0&&data.choice<question.options.length&&question.options[data.choice]!==question.answer){resolveHit(0)}
 else if(mode==='host'&&data.type==='HIT'&&data.round===round&&!locked&&Number.isInteger(data.choice)&&question.options[data.choice]===question.answer){resolveHit(1,data.tauntIndex)}
 else if(mode==='guest'&&data.type==='RESULT'&&data.round===round){applyResult(data)}
}
function listen(c){
 conn=c;duelRecovery?.trackConnection(c);c.on('data',data=>{if(conn===c){if(duelRecovery?.receive(data,c)||duelRecovery?.blocked)return;receiveData(data)}});
 c.on('close',()=>{if(conn!==c)return;conn=null;connectionFailed('Kết nối với đối thủ đã ngắt. Hãy thử tạo hoặc vào phòng lại.')});
 c.on('error',()=>{if(conn!==c)return;conn=null;connectionFailed('Lỗi kết nối với đối thủ. Hãy kiểm tra mạng và thử lại.')});
}
function createHost(attempt,epoch){
 if(epoch!==connectionEpoch)return;
 const code=String(Math.floor(1000+Math.random()*9000)),candidate=new Peer('anhhung-duel-'+code);peer=candidate;duelRecovery?.trackPeer(candidate);
 candidate.on('open',()=>{if(peer!==candidate||epoch!==connectionEpoch)return;if(duelRecovery?.active){duelRecovery.retry();return}pvpRoomCode=code;status(`Mã phòng: ${code} — đang chờ đối thủ. ${vocabSource==='lexical'?`Bộ từ của ${accountName()}`:'Đang dùng bộ từ mẫu.'}`)});
 candidate.on('connection',c=>{if(duelRecovery?.incoming(c))return;if(peer!==candidate||epoch!==connectionEpoch||conn||!$('battle').hidden){c.close();return}listen(c);status('Đang kết nối và xác minh đối thủ…');startConnectionTimer('Kết nối quá lâu. Hãy kiểm tra mạng và thử vào phòng lại.')});
 candidate.on('error',e=>{if(peer!==candidate||epoch!==connectionEpoch)return;if(duelRecovery?.peerError(e))return;if(e.type==='unavailable-id'&&attempt<8){peer=null;candidate.destroy();status('Đang chọn mã phòng khác…');createHost(attempt+1,epoch);return}connectionFailed(peerErrorMessage(e))});
 candidate.on('disconnected',()=>{if(peer===candidate&&epoch===connectionEpoch&&!conn)status('Mất kết nối máy chủ phòng. Hãy tạo lại phòng.')});
}
$('host').onclick=async()=>{
 if(typeof Peer==='undefined'){status('Không tải được PeerJS. Kiểm tra mạng rồi tải lại trang.');return}
 clean();mode='host';const epoch=connectionEpoch,navigation=navigationEpoch,button=$('host');let ready=false;button.disabled=true;status('Đang nạp bộ từ của chủ phòng…');try{ready=await prepareVocabulary(navigation)}finally{button.disabled=false}if(!ready||navigation!==navigationEpoch||epoch!==connectionEpoch||$('pvpMenu').hidden)return;status('Đang tạo phòng…');createHost(0,epoch)
};
$('join').onclick=()=>{
 const code=$('code').value.trim();if(!/^\d{4}$/.test(code)){status('Vui lòng nhập đúng 4 chữ số.');return}if(typeof Peer==='undefined'){status('Không tải được PeerJS. Kiểm tra mạng rồi tải lại trang.');return}
 clean();mode='guest';const epoch=connectionEpoch;status('Đang kết nối với chủ phòng…');const candidate=new Peer();peer=candidate;duelRecovery?.trackPeer(candidate);
 startConnectionTimer('Kết nối quá lâu. Kiểm tra mã phòng, mạng và thử lại.');
 candidate.on('open',()=>{if(peer!==candidate||epoch!==connectionEpoch)return;if(duelRecovery?.active){duelRecovery.retry();return}const c=candidate.connect('anhhung-duel-'+code,{reliable:true});listen(c);c.on('open',async()=>{if(conn!==c||epoch!==connectionEpoch)return;status('Đã kết nối, đang xác minh hồ sơ…');const navigation=navigationEpoch,user=accountName();await hydrateSharedStanding(user,navigation);if(conn!==c||epoch!==connectionEpoch||navigation!==navigationEpoch||user!==accountName())return;joiningStandingProfile=standingSnapshot(localStandingProfile());send({type:'HELLO',version:PVP_PROTOCOL,hero:$('hero').value,name:myName(),rating:joiningStandingProfile,recovery:duelRecovery?.offer()});startConnectionTimer('Chủ phòng không phản hồi. Cả hai hãy cập nhật và tải lại trò chơi.')})});
 candidate.on('error',e=>{if(peer!==candidate||epoch!==connectionEpoch)return;if(duelRecovery?.peerError(e))return;connectionFailed(peerErrorMessage(e))});
};
function showRematchPanel(){$('answers').hidden=true;$('rematchPanel').hidden=false;$('rematch').disabled=false;$('rematch').textContent='TÁI ĐẤU';updateRematchStatus()}
function updateRematchStatus(){if(mode==='bot'){$('rematchStatus').textContent='Chơi tiếp với máy và bộ từ hiện tại.';return}if(!conn?.open){$('rematch').disabled=true;$('rematchStatus').textContent='Kết nối đã ngắt. Hãy về sảnh để tạo phòng mới.';return}$('rematchStatus').textContent=myRematchReady?'Đang chờ đối thủ đồng ý tái đấu.':peerRematchReady?'Đối thủ đã sẵn sàng tái đấu.':'Cả hai người cần đồng ý tái đấu.'}
function startRematch(announce=true,descriptor=null){if(!ended)return;if(mode==='host'){if(!standingMatch)return;descriptor={id:'pvp-'+standingUid(),deckSize:standingMatch.deckSize,profiles:[latestStandingSnapshot(standingMatch.profile),standingMatch.opponent]};if(announce)send({type:'REMATCH_START',match:matchId+1,standing:descriptor})}if(mode==='guest'&&!isStandingDescriptor(descriptor))return;clearTasks();if(mode==='bot')startBotStanding();else acceptStandingDescriptor(descriptor,side);duelDecision=null;matchId++;round=0;question=null;score=0;lives=[10,10];displayLives=[10,10];ended=false;locked=true;fx=null;preview=null;poses=['idle','idle'];myRematchReady=false;peerRematchReady=false;$('scoreValue').textContent='0';$('rematchPanel').hidden=true;$('answers').hidden=false;$('victoryBanner').hidden=true;$('battleMessage').textContent='';$('roundStatus').textContent='Đang chuẩn bị trận mới…';if(mode!=='guest'){mapCursor=(mapCursor+1)%ARENA_MAPS.length;currentMap=ARENA_MAPS[mapCursor].id}updateHUD();if(mode!=='guest')beginRound()}
$('rematch').onclick=async()=>{
 if(!ended||paused)return;const match=standingMatch,epoch=navigationEpoch;$('rematch').disabled=true;
 await match?.savePromise;
 if(epoch!==navigationEpoch||standingMatch!==match||!ended)return;
 if(mode==='bot'){startRematch();return}if(!conn?.open){updateRematchStatus();return}if(myRematchReady)return;
 myRematchReady=true;send({type:'REMATCH_READY',match:matchId,rating:latestStandingSnapshot(match.profile)});updateRematchStatus();if(mode==='host'&&peerRematchReady)startRematch()
};
$('returnLobby').onclick=()=>{$('leave').click()};
document.addEventListener('keydown',event=>{if(event.repeat||event.ctrlKey||event.altKey||event.metaKey||$('battle').hidden||paused||ended||locked)return;if(event.target instanceof HTMLElement&&(event.target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)))return;if(!/^[1-4]$/.test(event.key))return;const button=$('answers').children[Number(event.key)-1];if(button&&!button.disabled){event.preventDefault();button.click()}});
$('pause').onclick=()=>setPaused(true);$('resume').onclick=()=>setPaused(false);
$('leave').onclick=()=>{clean();$('battle').hidden=true;$('lobby').hidden=false;document.body.classList.remove('in-battle');status('Chọn chế độ để bắt đầu.')};
function drawDragonHalo(size,now,c=ctx){
 c.save();c.translate(0,-size*.35);const pulse=.88+.12*Math.sin(now/450);c.globalAlpha=.65*pulse;c.strokeStyle='#f6dc70';c.shadowColor='#e4b632';c.shadowBlur=size*.09;c.lineWidth=Math.max(3,size*.025);c.beginPath();c.arc(0,0,size*.37,0,Math.PI*2);c.stroke();c.lineWidth=Math.max(1,size*.009);c.beginPath();c.arc(0,0,size*.32,0,Math.PI*2);c.stroke();for(let i=0;i<12;i++){const a=i*Math.PI/6;c.beginPath();c.moveTo(Math.cos(a)*size*.38,Math.sin(a)*size*.38);c.lineTo(Math.cos(a)*size*.44,Math.sin(a)*size*.44);c.stroke()}c.restore();
}
function drawHero(x,y,hero,pose,flip,now,elapsed=0){
 const row=pose==='dead'?4:pose==='victory'?3:pose==='hit'?2:pose==='attack'?1:0;
 ctx.save();ctx.translate(x,y);ctx.scale(flip?-1:1,1);if(pose==='hit')ctx.translate(-10,0);
 if(CombatAnimator.sourceFacesLeft(hero,row))ctx.scale(-1,1);
 const sheet=sprites[hero],size=spriteSize(hero);
 if(hero==='lac')drawDragonHalo(size,now);
 if(sheet&&sheet.complete&&sheet.naturalWidth){
 const frame=CombatAnimator.frameFor(hero,row,elapsed,now);
 ctx.imageSmoothingEnabled=false;if(pose==='hit'&&elapsed<90)ctx.filter='brightness(0) invert(1)';const foot=SPRITE_FEET[hero]?.[row]?.[frame]||229,center=SPRITE_CENTERS[hero]||114.5;ctx.drawImage(sheet,frame*229,row*229,229,229,-size*center/229,-size*.70+(229-foot)*size/229,size,size)
 }else{ctx.fillStyle=hero==='tran'?'#325b88':'#8b1e1e';ctx.fillRect(-25,-45,50,100);ctx.fillStyle='#d4af37';ctx.fillRect(-20,-55,40,12)}ctx.restore();
}
function render(now){
 updatePvCCountdown(now);
 const bg=mapImages[currentMap];const rect=canvas.getBoundingClientRect();if(rect.width>0&&rect.height>0){const h=Math.max(200,Math.round(960*rect.height/rect.width));if(canvas.height!==h)canvas.height=h;}const height=canvas.height;actorSize=Math.min(400,Math.max(245,height*.30));const floor=height*(window.innerWidth>=900?.82:.8);ctx.clearRect(0,0,960,height);if(bg&&bg.complete&&bg.naturalWidth){const scale=Math.max(960/bg.naturalWidth,height/bg.naturalHeight),w=bg.naturalWidth*scale,h=bg.naturalHeight*scale;ctx.drawImage(bg,(960-w)/2,(height-h)/2,w,h)}else{ctx.fillStyle='#514037';ctx.fillRect(0,0,960,height)}
 if(paused)now=pausedAt;
 if(fx&&fx.victoryStart){renderTeacherTaunt(null);const elapsed=Math.max(0,now-fx.victoryStart),progress=Math.min(1,elapsed/500),zoom=1+.6*progress;const grad=ctx.createRadialGradient(480,height*.54,Math.min(height,960)*.10,480,height*.54,Math.max(height,960)*.70);grad.addColorStop(0,'rgba(8,12,18,.35)');grad.addColorStop(1,'rgba(4,7,12,.87)');ctx.fillStyle=grad;ctx.fillRect(0,0,960,height);ctx.save();ctx.translate(480,height*.67);ctx.scale(zoom,zoom);const savedSize=actorSize;actorSize=Math.min(actorSize,height/(zoom*.95));drawHero(0,0,players[fx.winner],'victory',false,now,elapsed);actorSize=savedSize;ctx.restore();requestAnimationFrame(render);return}
 const active=fx||preview,t=active?Math.max(0,now-active.start):0;let speakingX=220;
 for(let i=0;i<2;i++){
  let x=i?740:220,pose=poses[i],elapsed=0;
  if(active&&i===active.winner){const base=CombatAnimator.displacement(active.hero,t),d=(window.innerWidth>=900||active.hero==='vuong')?base*desktopApproach(active.hero,players[1-i])/510:base;x+=(i?-1:1)*d;pose=active.hero==='vuong'?(t<900?'attack':'idle'):CombatAnimator.isRanged(active.hero)?(t<500?'attack':'idle'):(t>=120&&t<870?'attack':'idle');elapsed=active.hero==='vuong'?t:CombatAnimator.isRanged(active.hero)?t%250:Math.max(0,t-120)%250}
  if(fx&&i!==fx.winner){pose=fx.impacted?(fx.final&&fx.deadStart?'dead':'hit'):'idle';elapsed=pose==='dead'?now-fx.deadStart:Math.max(0,now-fx.lastHitAt)}
  if(active&&i===active.winner&&active.hero==='vuong')speakingX=x;const size=spriteSize(players[i]);drawHero(x,floor-size*.3,players[i],pose,!!i,now,elapsed);
 }
 renderTeacherTaunt(active,t,speakingX,Math.max(0,floor-spriteSize('vuong')*.98),height);
 if(active){const target=active.winner?220:740;
 if(CombatAnimator.isRanged(active.hero)){for(const launch of [0,250])if(t>=launch&&t<launch+100){const arrow=new Projectile(active.winner?740:220,target,launch);combatAnimator.drawProjectile(arrow.position(t),floor-actorSize*.45,!!active.winner,active.hero)}}
 if(fx&&!CombatAnimator.isRanged(fx.hero)){for(const hit of (fx.hero==='vuong'&&fx.final?[CombatAnimator.impactMs(fx.hero)]:CombatAnimator.hitTimes(fx.hero)))if(t>=hit&&t<hit+165){if(fx.hero==='vuong')combatAnimator.drawSlipperHit(target,floor-actorSize*.4,t-hit);else combatAnimator.drawSlash(target,floor-actorSize*.4,t-hit);if(fx.hero==='giong'){ctx.save();ctx.strokeStyle='#bceeff';ctx.lineWidth=6;ctx.shadowColor='#46baff';ctx.shadowBlur=15;ctx.beginPath();ctx.moveTo(target+40,floor-actorSize);ctx.lineTo(target-16,floor-actorSize*.55);ctx.lineTo(target+8,floor-actorSize*.48);ctx.lineTo(target-28,floor-actorSize*.15);ctx.stroke();ctx.restore()}}}}
 requestAnimationFrame(render)
}requestAnimationFrame(render);

renderStandingBoard();
window.addEventListener('storage',event=>{if(event.key===STANDINGS_KEY||event.key===null)renderStandingBoard()});
window.addEventListener('focus',renderStandingBoard);

document.querySelector('[data-pvp-ready]')?.addEventListener('click',markPvPRoomReady);
startSharedStandings();

// Chess shares the existing identity and standings boundary without combat state.
window.QuickDrawnChessBridge=Object.freeze({
 finishBoth:finishStandingPair,clean,uid:standingUid,portrait,heroName:id=>heroes[id],selectedHero:()=>$('hero').value,
 validHero:id=>typeof id==='string'&&Object.hasOwn(heroes,id),validProfile:isStandingSnapshot,
 sound:()=>combatSound.play('tap_click'),captureSound:()=>combatSound.play('wood_drop'),refresh:renderStandingBoard,
 latest:latestStandingSnapshot,
 async profile(){const epoch=navigationEpoch,name=accountName();await hydrateSharedStanding(name,epoch);return epoch===navigationEpoch&&name===accountName()?standingSnapshot(localStandingProfile()):null},
 finish(descriptor,localSide,actualScore){
  if(!descriptor||typeof descriptor.id!=='string'||!/^chess-[a-z0-9-]+$/i.test(descriptor.id)||!isPacketArray(descriptor.profiles,2,isStandingSnapshot)||![0,1].includes(localSide)||![0,.5,1].includes(actualScore))return Promise.reject(new Error('Invalid chess result'));
  const match={id:descriptor.id,mode:'chess',deckSize:0,profile:{...descriptor.profiles[localSide]},opponent:{...descriptor.profiles[1-localSide]}};
  const save=()=>{const write=()=>persistStandingResult(match,actualScore,0);return typeof navigator!=='undefined'&&navigator.locks?.request?navigator.locks.request(STANDINGS_KEY,write).catch(write):write()};
  const result=standingWrites.then(save,save);standingWrites=result.catch(()=>{});result.then(()=>{syncSharedStandings();renderStandingBoard()}).catch(()=>{standingUnsaved=true;renderStandingBoard()});return result;
 }
});
