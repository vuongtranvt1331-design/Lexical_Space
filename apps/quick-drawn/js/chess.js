'use strict';
// Separate chess transport: vocabulary PvP protocol13 and combat remain unchanged.
(()=>{
 const bridge=window.QuickDrawnChessBridge;if(!bridge||typeof ChessSession==='undefined')return;
 const $=id=>document.getElementById(id),node=s=>document.querySelector(s),now=()=>performance.now();
 const screen=node('[data-chess-screen]'),settings=node('[data-chess-time]'),board=node('[data-chess-board]');
 const top=node('.chess-top'),meta=node('.chess-meta'),toolbar=node('.chess-toolbar'),resultPanel=node('[data-chess-finish]'),resultStatus=node('[data-chess-finish-status]'),resultActions=node('[data-chess-finish-actions]'),resultLinks=node('[data-chess-finish-links]'),scoreboard=node('.dojo-scoreboard');
 const spectatorMedia=typeof window.matchMedia==='function'?window.matchMedia('(min-width:1100px) and (min-height:700px)'):null;
 const portraitMedia=typeof window.matchMedia==='function'?window.matchMedia('(orientation:portrait)'):null;
 const original={host:$('host').onclick,join:$('join').onclick,close:$('closePvpMenu').onclick,pvp:$('openPvpMenu').onclick};
 const reasons={checkmate:'Chiếu hết',stalemate:'Hết nước đi hợp lệ',repetition:'Lặp lại thế cờ 3 lần','fifty-move':'Luật 50 nước',material:'Không đủ quân chiếu hết',agreement:'Hai bên đồng ý hòa',resign:'Xin thua',timeout:'Hết giờ',adjudication:'Chốt kết quả do mất kết nối'};
 const pieceNames={k:'Vua',q:'Hậu',b:'Tượng',n:'Mã',r:'Xe',p:'Tốt'};
 const unicode={wk:'♔',wq:'♕',wb:'♗',wn:'♘',wr:'♖',wp:'♙',bk:'♚',bq:'♛',bb:'♝',bn:'♞',br:'♜',bp:'♟'};
 let enabled=false,role='',epoch=0,peer=null,conn=null,room=null,session=null,myProfile=null,localSide=0,localReady=false,linked=false,selected=null,promotion=null,pendingMove=false,disconnected=false,handshakeTimer=null,savePromise=Promise.resolve(),settled=new Set(),lastSync=0,lastClock='',drawnRevision=-1;
 let recoveryTicket=null;
 const recovery=typeof QuickDrawnRecovery==='undefined'?null:new QuickDrawnRecovery({label:'chess',role:()=>role,getPeer:()=>peer,setPeer:p=>{peer=p},getConnection:()=>conn,detach:c=>{if(conn===c)conn=null},hostId:()=>'anhhung-chess-'+(room?.code||$('code').value.trim()),bind:c=>listen(c,epoch),acceptExtra:acceptSpectatorConnection,snapshot:chessRecoverySnapshot,apply:applyChessRecovery,lost:onChessConnectionLost,restored:onChessConnectionRestored,canAdjudicate:()=>!!session&&!session.result,matchId:()=>session?.id,adjudicate:adjudicateChess,applyClaim:applyChessClaim});
 let spectatorConnections=[],roomResults=new Map(),rackLit=new Set(),rackMatch=null,previousCaptureTotal=null;
 let chosenTime={minutes:5,increment:0};
 const timeLabel=t=>t.minutes+' phút'+(t.increment?' + '+t.increment+' giây/nước':'');
 const setStatus=text=>{$('status').textContent=text};
 function desktopSpectator(){return role==='spectator'&&!!spectatorMedia?.matches}
 function portraitPlayer(){return (role==='host'||role==='guest')&&!!portraitMedia?.matches}
 function summaryCaptures(){return desktopSpectator()||portraitPlayer()}
 function syncSpectatorLayout(forceOff=false){
  const wide=!forceOff&&desktopSpectator()&&!screen.hidden,changed=screen.dataset.desktopSpectate!==String(wide);screen.dataset.desktopSpectate=String(wide);screen.classList.toggle('is-spectator-desktop',wide);document.body.classList.toggle('spectator-desktop',wide);node('[data-spectate-header]').hidden=!wide;node('[data-spectate-fullscreen]').hidden=!wide;
  const portrait=!forceOff&&portraitPlayer()&&!screen.hidden,portraitChanged=screen.dataset.playerPortrait!==String(portrait);screen.dataset.playerPortrait=String(portrait);screen.classList.toggle('is-player-portrait',portrait);document.body.classList.toggle('player-portrait',portrait);
  if(changed||portraitChanged)drawnRevision=-1;
 }
 function colorSide(playerIndex){return playerIndex===room.whiteSide?0:1}
 function playerColor(playerIndex){return colorSide(playerIndex)===0?'w':'b'}
 function viewPlayer(){return role==='spectator'?room.whiteSide:localSide}
 function winnerPlayer(){return session?.result?.winner===null?null:session?.result?.winner===0?room.whiteSide:1-room.whiteSide}
 function recordRoomScore(){
  if(role!=='host'||!session?.result)return;const winner=winnerPlayer(),previous=roomResults.get(session.id);
  if(roomResults.has(session.id)&&previous===winner)return;if(previous===0||previous===1)room.scores[previous]=Math.max(0,room.scores[previous]-1);if(winner===0||winner===1)room.scores[winner]++;roomResults.set(session.id,winner);
 }
 function renderDojoScore(){
  if(!room||room.profiles.length!==2)return;recordRoomScore();node('[data-dojo-name="0"]').textContent=room.profiles[0].name;node('[data-dojo-name="1"]').textContent=room.profiles[1].name;
  for(const i of [0,1]){const score=node('[data-dojo-score="'+i+'"]');score.textContent=String(room.scores[i]);score.classList.toggle('is-score-updated',!!session?.result&&i===winnerPlayer());const points=node('[data-chess-points="'+i+'"]');points.textContent=String(room.scores[i]);points.classList.toggle('is-score-updated',!!session?.result&&i===winnerPlayer())}
  node('[data-chess-room-code]').textContent='Phòng '+room.code;node('[data-spectate-room]').textContent='QUAN CHIẾN · PHÒNG '+room.code;
  for(const i of [0,1]){node('[data-spectate-name="'+i+'"]').textContent=room.profiles[i].name;const score=node('[data-spectate-score="'+i+'"]');score.textContent=String(room.scores[i]);score.classList.toggle('is-score-updated',!!session?.result&&i===winnerPlayer());node('[data-spectate-player="'+i+'"]').dataset.chessColor=playerColor(i)}
  node('[data-spectate-live]').textContent=disconnected?'Mất kết nối':'Trực tiếp';node('[data-spectate-turn]').textContent=disconnected?'ĐANG NỐI LẠI':session?.result?'VÁN ĐÃ KẾT THÚC':session?.turn===0?'LƯỢT TRẮNG':'LƯỢT ĐEN';
 }
 function setResultView(finished){
  const status=node('[data-chess-status]'),rating=node('[data-chess-result]'),pgn=node('[data-chess-pgn]'),entering=resultPanel.hidden;
  const mount=(el,parent)=>{if(el.parentElement!==parent)parent.append(el)};
  if(finished){mount(status,resultStatus);mount(rating,resultStatus);mount(toolbar,resultActions);mount(pgn,resultLinks)}
  else{if(toolbar.parentElement!==top)top.insertBefore(toolbar,meta);if(status.parentElement!==meta)meta.insertBefore(status,node('[data-chess-control]'));mount(rating,top);if(pgn.parentElement!==meta)meta.insertBefore(pgn,node('[data-chess-decline]'))}
  resultPanel.hidden=!finished;scoreboard.hidden=!finished;board.inert=finished;screen.dataset.result=String(finished);
  if(finished&&entering){const rematch=node('[data-chess-rematch]');(role==='spectator'||rematch.disabled?node('[data-chess-leave]'):rematch).focus()}
 }
 function showRoomOverlay(){
  const keepBoard=!screen.hidden,opening=$('pvpMenu').hidden;setResultView(false);chosenTime={...room.time};screen.dataset.waiting=String(keepBoard);screen.inert=keepBoard;
  $('pvpMenu').dataset.chessRematch=String(keepBoard);$('pvpMenu').dataset.chessSpectator=String(role==='spectator');$('pvpTitle').textContent=keepBoard?'Tái đấu · Phòng '+room.code:'Cờ vua · Song đấu';
  screen.hidden=!keepBoard;$('lobby').hidden=keepBoard;$('pvpMenu').hidden=false;document.body.classList.toggle('in-chess',keepBoard);renderRoom();
  if(opening)(node('[data-pvp-ready]').disabled?$('closePvpMenu'):node('[data-pvp-ready]')).focus();
 }
 resultPanel.addEventListener('keydown',event=>{
  if(event.key!=='Tab'||resultPanel.hidden)return;const items=Array.from(resultPanel.querySelectorAll('button,a[href]')).filter(el=>!el.hidden&&!el.disabled&&el.getClientRects().length);if(!items.length)return;
  const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
 });
 function spectatorMessage(c,type,fields={}){if(c?.open)try{c.send({channel:'quickdrawn-chess',version:2,type,...fields})}catch(_){c.close()}}
 function spectatorState(c){if(!room||!validRoom(room)){spectatorMessage(c,'SPECTATOR_WAIT',{code:room?.code||''});return}recordRoomScore();spectatorMessage(c,'SPECTATOR_STATE',{room:JSON.parse(JSON.stringify(room)),state:session?session.snapshot(now()):null,paused:!!recovery?.blocked})}
 function broadcastSpectators(){for(const c of spectatorConnections)if(c.open)spectatorState(c);node('[data-chess-watch-count]').textContent=spectatorConnections.length?'Quan chiến: '+spectatorConnections.length:''}
 function acceptSpectatorConnection(c){
  if(c.metadata?.role!=='SPECTATOR')return false;
  if(role!=='host'||c.metadata.version!==2||spectatorConnections.length>=24){c.close();return true}
  spectatorConnections.push(c);c.on('open',()=>spectatorState(c));c.on('data',data=>{if(data?.channel==='quickdrawn-chess'&&data.version===2&&data.type==='SPECTATE')spectatorState(c)});const remove=()=>{spectatorConnections=spectatorConnections.filter(item=>item!==c);broadcastSpectators()};c.on('close',remove);c.on('error',remove);return true;
 }
 async function joinSpectator(){
  const code=$('code').value.trim()||room?.code;if(!/^\d{4}$/.test(code)||typeof Peer==='undefined'){setStatus('Nhập mã phòng cờ vua gồm 4 số.');return}
  destroy();role='spectator';localSide=-1;const current=epoch;renderRoom();setStatus('Đang vào phòng quan chiến…');const candidate=new Peer();peer=candidate;handshake();
  candidate.on('open',()=>{if(current!==epoch||peer!==candidate)return;const c=candidate.connect('anhhung-chess-'+code,{reliable:true,metadata:{role:'SPECTATOR',version:2}});conn=c;c.on('open',()=>spectatorMessage(c,'SPECTATE'));c.on('data',data=>{if(current!==epoch||conn!==c||data?.channel!=='quickdrawn-chess'||data.version!==2)return;
   if(data.type==='SPECTATOR_WAIT'){clearHandshake();setStatus('Đã vào phòng '+code+'. Đang chờ hai người bắt đầu ván.');return}
   if(data.type!=='SPECTATOR_STATE'||!validRoom(data.room)||data.room.code!==code)return;
   try{const next=data.state?ChessSession.restore(data.state,now()):null;if(next&&next.id!==data.room.id)return;const first=!session||session.id!==next?.id;room=JSON.parse(JSON.stringify(data.room));session=next;disconnected=false;clearHandshake();if(session){if(first||screen.hidden)showScreen();else render();if(data.paused)node('[data-chess-status]').textContent='Quan chiến · Hai người đang kết nối lại.'}else{showRoomOverlay();setStatus('Quan chiến phòng '+code+' · Đang chờ ván tiếp theo…')}}catch(_){/* Invalid spectator snapshots never mutate the board. */}
  });const lost=()=>{if(current!==epoch||conn!==c)return;conn=null;disconnected=true;if(session){session.clocks=session.remaining(now());session.running=false;render();node('[data-chess-status]').textContent='Mất kết nối quan chiến. Bấm Xem lại.';node('[data-chess-watch-retry]').hidden=false}else setStatus('Mất kết nối. Bấm Quan Chiến để thử lại.')};c.on('close',lost);c.on('error',lost)});
  candidate.on('error',()=>{if(current!==epoch)return;clearHandshake();setStatus('Không tìm thấy phòng quan chiến. Kiểm tra mã phòng.');for(const id of ['host','join','code'])$(id).disabled=false;if(session){disconnected=true;render();node('[data-chess-watch-retry]').hidden=false}});
 }

 function packet(type,body={}){if(conn?.open)try{conn.send({channel:'quickdrawn-chess',version:2,type,...body})}catch(_){loseConnection('Đường truyền bị gián đoạn. Đang kết nối lại…')}}
 function clearHandshake(){clearTimeout(handshakeTimer);handshakeTimer=null}
 function handshake(){clearHandshake();const current=epoch;handshakeTimer=setTimeout(()=>{if(current!==epoch)return;if(role==='spectator'){clearHandshake();for(const id of ['host','join','code'])$(id).disabled=false;setStatus('Chưa vào được phòng quan chiến. Kiểm tra mã và thử lại.');return}loseConnection('Kết nối quá lâu. Hãy tạo hoặc vào phòng lại.')},18000)}
 function destroy(){syncSpectatorLayout(true);setResultView(false);screen.inert=false;board.inert=false;delete screen.dataset.waiting;delete $('pvpMenu').dataset.chessRematch;delete $('pvpMenu').dataset.chessSpectator;const watchers=spectatorConnections;spectatorConnections=[];for(const c of watchers)c.close();roomResults.clear();rackLit=new Set();rackMatch=null;previousCaptureTotal=null;recovery?.reset();recoveryTicket=null;epoch++;clearHandshake();const c=conn,p=peer;conn=null;peer=null;room=null;session=null;role='';localReady=false;linked=false;selected=null;promotion=null;pendingMove=false;disconnected=false;drawnRevision=-1;c?.close();p?.destroy();node('[data-chess-promotion]').hidden=true;screen.hidden=true;document.body.classList.remove('in-chess');node('[data-pvp-room]').hidden=true;for(const id of ['host','join','code'])$(id).disabled=false}
 function menu(active){enabled=active;settings.hidden=!active;node('[data-chess-spectate]').hidden=!active;$('pvpMenu').classList.toggle('is-chess-menu',active);$('pvpTitle').textContent=active?'Cờ vua · Song đấu':'Song đấu';node('[data-chess-room-note]').hidden=!active;renderTime()}
 function open(){destroy();bridge.clean();menu(true);$('pvpMenu').hidden=false;$('closePvpMenu').focus();setStatus('Chọn thời gian rồi tạo phòng, hoặc nhập mã để vào phòng của bạn.');renderRoom()}
 function readTime(){const minutes=Number(node('[data-chess-minutes]').value),increment=Number(node('[data-chess-increment]').value);return validChessTime({minutes,increment})?{minutes,increment}:null}
 function renderTime(){node('[data-chess-minutes]').value=chosenTime.minutes;node('[data-chess-increment]').value=chosenTime.increment;const locked=!!role&&(role!=='host'||!room?.editable||room.starting);for(const input of settings.querySelectorAll('input'))input.disabled=locked;node('[data-chess-apply-time]').disabled=locked;node('[data-chess-time-note]').textContent=role==='guest'?'Thời gian do chủ phòng chọn.':room&&!room.editable?'Đã khóa thời gian. Có thể đổi sau khi kết thúc ván.':'Mỗi bên có thời gian riêng. Giây cộng được thêm sau mỗi nước hợp lệ.'}
 function editTime(){const value=readTime();if(!value){setStatus('Thời gian: 1–180 phút; giây cộng: 0–60.');return}if(role&&(role!=='host'||!room?.editable||room.starting)){renderTime();return}chosenTime=value;if(room){room.time={...value};room.config++;room.ready=[false,false];localReady=false;sendRoom();renderRoom()}}
 for(const input of settings.querySelectorAll('input'))input.addEventListener('change',editTime);
 function validRoom(data){return data&&typeof data.id==='string'&&/^chess-[a-z0-9-]+$/i.test(data.id)&&data.id.length<150&&validChessTime(data.time)&&Number.isSafeInteger(data.config)&&data.config>=0&&Array.isArray(data.profiles)&&data.profiles.length===2&&data.profiles.every(bridge.validProfile)&&data.profiles[0].id!==data.profiles[1].id&&Array.isArray(data.heroes)&&data.heroes.length===2&&data.heroes.every(bridge.validHero)&&Array.isArray(data.ready)&&data.ready.length===2&&data.ready.every(v=>typeof v==='boolean')&&typeof data.editable==='boolean'&&[0,1].includes(data.whiteSide)&&Array.isArray(data.scores)&&data.scores.length===2&&data.scores.every(n=>Number.isSafeInteger(n)&&n>=0)}
 function sendRoom(){packet('ROOM',{room,...(recoveryTicket?{recovery:recoveryTicket}:{})});broadcastSpectators()}
 function renderRoom(){
  const panel=node('[data-pvp-room]'),cards=node('[data-pvp-room-players]'),ready=node('[data-pvp-ready]');
  panel.hidden=!room||!!session;for(const id of ['host','join','code'])$(id).disabled=!!role;renderTime();if(!room||session)return;
  node('[data-pvp-room-label]').textContent='Phòng '+room.code+' · Cờ vua · '+timeLabel(room.time);cards.replaceChildren();
  room.profiles.forEach((profile,i)=>{const card=document.createElement('article');card.className='pvp-room-player'+(i===localSide?' is-you':'');const art=bridge.portrait(room.heroes[i]);art.classList.add('pvp-room-portrait');card.append(art);for(const [tag,text]of [['small',(i===localSide?'Bạn · ':'')+(i===0?'Chủ phòng':'Đối thủ')+' · '+(playerColor(i)==='w'?'Trắng':'Đen')],['strong',profile.name],['span',bridge.heroName(room.heroes[i])+' · '+profile.elo+' Elo'],['b',room.ready[i]?'Đã sẵn sàng':'Chưa sẵn sàng']]){const el=document.createElement(tag);el.textContent=text;if(tag==='b'&&room.ready[i])el.className='is-ready';card.append(el)}cards.append(card)});
  ready.disabled=role==='spectator'||!linked||localReady||!validChessTime(room.time);ready.textContent=localReady?'ĐÃ SẴN SÀNG':'SẴN SÀNG';setStatus(localReady?'Bạn đã sẵn sàng. Đang chờ đối thủ…':'Kiểm tra đối thủ và thời gian. Cả hai bấm Sẵn sàng mới bắt đầu.');
 }
 function ready(){if(role==='spectator'||!room||session||!linked||localReady||!conn?.open)return;if(role==='host'&&room.editable){const value=readTime();if(!value){setStatus('Chọn 1–180 phút và 0–60 giây cộng.');return}if(value.minutes!==room.time.minutes||value.increment!==room.time.increment)editTime()}localReady=true;room.ready[localSide]=true;renderRoom();if(role==='host'){sendRoom();tryStart()}else packet('READY',{id:room.id,config:room.config,profile:bridge.latest(myProfile)})}
 function tryStart(){if(role!=='host'||session||room.starting||!linked||!localReady||!room.ready.every(Boolean)||!conn?.open)return;room.starting=true;renderTime();packet('START',{id:room.id,config:room.config});handshake()}
 function showScreen(){
  screen.inert=false;screen.dataset.waiting='false';delete $('pvpMenu').dataset.chessRematch;delete $('pvpMenu').dataset.chessSpectator;screen.dataset.spectator=String(role==='spectator');screen.hidden=false;$('lobby').hidden=true;$('pvpMenu').hidden=true;document.body.classList.add('in-chess');
  const arena=board.parentElement;arena.insertBefore(node('[data-chess-player="'+(1-viewPlayer())+'"]'),board);arena.append(node('[data-chess-player="'+viewPlayer()+'"]'));selected=null;promotion=null;drawnRevision=-1;lastClock='';node('[data-chess-promotion]').hidden=true;
  for(const el of screen.querySelectorAll('[data-chess-profile]')){
   const i=Number(el.dataset.chessProfile),hero=room.heroes[i],color=playerColor(i),avatar=node('[data-chess-avatar="'+i+'"]');avatar.replaceChildren(bridge.portrait(hero));avatar.dataset.hero=hero;avatar.style.setProperty('--spectate-facing',String((color==='b'?1:-1)*(hero==='vuong'?-1:1)));avatar.style.setProperty('--player-facing',hero==='vuong'?'-1':'1');node('[data-chess-player="'+i+'"]').dataset.chessColor=color;
   const heading=document.createElement('span');heading.className='chess-player-heading';const name=document.createElement('strong');name.textContent=room.profiles[i].name;const rating=document.createElement('small');rating.textContent=room.profiles[i].elo+' Elo'+(i===localSide?' · Bạn':'');const badge=document.createElement('small');badge.className='chess-color-badge';badge.dataset.chessColor=color;badge.textContent=color==='w'?'TRẮNG':'ĐEN';heading.append(name);heading.append(rating);heading.append(badge);
   const recent=document.createElement('span');recent.className='chess-recent-moves';recent.dataset.chessRecent=String(i);recent.setAttribute('aria-label','Nước đi gần nhất của '+room.profiles[i].name);el.replaceChildren(heading,recent);node('[data-chess-captured="'+i+'"]').setAttribute('aria-label','Quân '+room.profiles[i].name+' đã ăn');
  }
  node('[data-chess-control]').textContent=timeLabel(room.time);node('[data-chess-result]').textContent='';node('[data-chess-watch-retry]').hidden=role!=='spectator';render();if(role==='spectator'&&!desktopSpectator()&&window.innerWidth>window.innerHeight)board.scrollIntoView?.({block:'center'});
 }
 function broadcast(){if(role==='host'&&session){recordRoomScore();if(!recovery?.blocked)packet('STATE',{id:room.id,state:session.snapshot(now()),scores:[...room.scores],whiteSide:room.whiteSide});broadcastSpectators();lastSync=now()}}
 async function adjudicateChess(score){
  if(!session||!room)throw Error('No chess match');const current=session,navigation=epoch,startingScores=[...room.scores];
  const descriptor={id:current.id,mode:'chess',deckSize:0,profiles:room.profiles.map(p=>({...p}))};
  const winner=score===.5?null:score===1?colorSide(localSide):colorSide(1-localSide);
  current.finish(winner,'adjudication',now());settled.add(current.id);render();
  const result=await bridge.finishBoth(descriptor,localSide,score),canonical=result.outcome==='win'?1:result.outcome==='draw'?.5:0;
  if(session===current&&epoch===navigation){current.result={winner:canonical===.5?null:canonical===1?colorSide(localSide):colorSide(1-localSide),reason:'adjudication'};current.running=false;current.revision++;if(role==='guest'){room.scores=[...startingScores];const winner=winnerPlayer();if(winner!==null)room.scores[winner]++}recordRoomScore();render();broadcast();const delta=result.appliedDeltaElo;node('[data-chess-result]').textContent=(delta>=0?'+':'')+delta+' Elo · Đã chốt cho cả hai';node('[data-chess-status]').textContent=(canonical===1?'BẠN THẮNG':canonical===0?'BẠN THUA':'HÒA')+' · Đối thủ mất kết nối';}
  return {score:canonical};
 }
 function applyChessClaim(claim){if(claim.matchId!==session?.id)return;return adjudicateChess(claim.hostScore)}

 function chessRecoverySnapshot(){
  if(!room||!validRoom(room))throw Error('Missing room');
  if(session){session.tick(now());settle();return {phase:'game',room:JSON.parse(JSON.stringify(room)),state:session.snapshot(now())}}
  return {phase:'room',room:JSON.parse(JSON.stringify(room))};
 }
 function applyChessRecovery(data){
  if(!data||!['room','game'].includes(data.phase)||!validRoom(data.room)||!/^\d{4}$/.test(data.room.code)||data.room.profiles[1].id!==myProfile?.id||data.room.code!==room?.code)return false;
  let next=null;
  if(data.phase==='game'){
   if(data.room.id!==room.id||!localReady||!data.room.ready.every(Boolean)||data.state?.id!==data.room.id||data.state.time?.minutes!==data.room.time.minutes||data.state.time?.increment!==data.room.time.increment)return false;
   next=ChessSession.restore(data.state,now());if(session&&next.revision<session.revision)return false;
  }else if(session&&!session.result)return false;
  room=JSON.parse(JSON.stringify(data.room));session=next;chosenTime={...room.time};pendingMove=false;selected=null;promotion=null;drawnRevision=-1;
  if(session){showScreen();settle()}else{room.ready=[false,false];delete room.starting;localReady=false;showRoomOverlay()}
  return true;
 }
 function onChessConnectionLost(){
  disconnected=true;pendingMove=false;
  if(!session&&room){room.ready=[false,false];delete room.starting;localReady=false;linked=false;renderRoom()}
  if(session){render();node('[data-chess-status]').textContent='Mất kết nối · Ván được giữ; đồng hồ vẫn chạy.'}
 }
 function onChessConnectionRestored(){disconnected=false;linked=true;if(session){render();if(role==='host')broadcast()}else renderRoom()}

 function loseConnection(text){clearHandshake();if(recovery?.lost(text))return;disconnected=true;pendingMove=false;if(session){session.clocks=session.remaining(now());session.running=false;node('[data-chess-status]').textContent=session.result?text+' Kết quả ván đã hoàn tất được giữ nguyên.':text+' Ván chưa hoàn tất không tính Elo.';render()}else{const c=conn;conn=null;room=null;localReady=false;linked=false;role='';c?.close();renderRoom();setStatus(text)} }
 function listen(c,current){conn=c;recovery?.trackConnection(c);c.on('data',data=>{if(current!==epoch||conn!==c)return;try{if(recovery?.receive(data,c)||recovery?.blocked)return;receive(data)}catch(error){console.warn('Ignored invalid chess message:',error.message)}});c.on('close',()=>{if(current===epoch&&conn===c){conn=null;loseConnection('Đối thủ đã mất kết nối.')}});c.on('error',()=>{if(current===epoch&&conn===c){conn=null;loseConnection('Lỗi kết nối.')}})}
 async function create(attempt=0){
  if(typeof Peer==='undefined'){setStatus('Không tải được kết nối phòng. Hãy kiểm tra mạng.');return}
  const time=readTime();if(!time){setStatus('Chọn 1–180 phút và 0–60 giây cộng trước khi tạo phòng.');return}chosenTime=time;destroy();role='host';localSide=0;const current=epoch;renderRoom();setStatus('Đang chuẩn bị hồ sơ…');
  myProfile=await bridge.profile();if(current!==epoch||!enabled)return;if(!bridge.validProfile(myProfile)){destroy();renderRoom();setStatus('Tài khoản đã thay đổi. Hãy tạo phòng lại.');return}
  function attemptHost(n){if(current!==epoch)return;const code=String(Math.floor(1000+Math.random()*9000)),candidate=new Peer('anhhung-chess-'+code);peer=candidate;recovery?.trackPeer(candidate);
   candidate.on('open',()=>{if(current!==epoch||peer!==candidate)return;if(recovery?.active){recovery.retry();return}room={id:'chess-'+bridge.uid(),code,config:0,time:{...chosenTime},profiles:[myProfile],heroes:[bridge.selectedHero()],ready:[false,false],editable:false,whiteSide:0,scores:[0,0]};renderTime();setStatus('Mã phòng cờ vua: '+code+' · '+timeLabel(chosenTime)+' · Đang chờ đối thủ.');});
   candidate.on('connection',c=>{if(current!==epoch||peer!==candidate){c.close();return}if(acceptSpectatorConnection(c))return;if(recovery?.incoming(c))return;if(conn||!room||session){c.close();return}listen(c,current);handshake();setStatus('Đang xác minh đối thủ…')});
   candidate.on('error',error=>{if(current!==epoch||peer!==candidate)return;if(recovery?.peerError(error))return;if(error.type==='unavailable-id'&&n<8){candidate.destroy();peer=null;attemptHost(n+1)}else loseConnection('Không tạo được phòng. Hãy thử lại.')});
  }attemptHost(attempt);
 }
 async function join(){
  const code=$('code').value.trim();if(!/^\d{4}$/.test(code)){setStatus('Nhập mã phòng cờ vua gồm 4 số.');return}if(typeof Peer==='undefined'){setStatus('Không tải được kết nối phòng. Hãy kiểm tra mạng.');return}
  destroy();role='guest';localSide=1;const current=epoch;renderRoom();setStatus('Đang chuẩn bị hồ sơ…');myProfile=await bridge.profile();if(current!==epoch||!enabled)return;if(!bridge.validProfile(myProfile)){destroy();renderRoom();setStatus('Tài khoản đã thay đổi. Hãy vào phòng lại.');return}
  const candidate=new Peer();peer=candidate;recovery?.trackPeer(candidate);handshake();candidate.on('open',()=>{if(current!==epoch||peer!==candidate)return;if(recovery?.active){recovery.retry();return}const c=candidate.connect('anhhung-chess-'+code,{reliable:true});listen(c,current);c.on('open',()=>{if(current!==epoch||conn!==c)return;packet('HELLO',{profile:myProfile,hero:bridge.selectedHero(),recovery:recovery?.offer()});setStatus('Đang vào phòng cờ vua…')})});candidate.on('error',error=>{if(recovery?.peerError(error))return;if(current===epoch&&peer===candidate)loseConnection('Không tìm thấy phòng cờ vua. Kiểm tra mã hoặc thử lại.')});
 }
 function receive(data){
  if(!data||data.channel!=='quickdrawn-chess'||data.version!==2||typeof data.type!=='string')return;
  if(data.type==='ERROR'){loseConnection('Không thể vào phòng: '+(data.code==='same-profile'?'hai người cần dùng hai tài khoản khác nhau.':'phiên bản hoặc dữ liệu không hợp lệ.'));return}
  if(role==='host'&&data.type==='HELLO'){
   if(!room||room.profiles.length!==1||session)return;if(!bridge.validProfile(data.profile)||!bridge.validHero(data.hero))return;
   if(data.profile.id===myProfile.id){packet('ERROR',{code:'same-profile'});return}
   recoveryTicket=recovery?.accept(data.recovery,conn);room.profiles.push({...data.profile});room.heroes.push(data.hero);clearHandshake();sendRoom();renderRoom();handshake();return;
  }
  if(role==='guest'&&data.type==='ROOM'){
   if(!validRoom(data.room)||data.room.profiles[1].id!==myProfile?.id||!/^\d{4}$/.test(data.room.code))return;
   if(room&&data.room.id===room.id){if(session||data.room.config<room.config)return;if(data.room.config!==room.config)localReady=false;if(data.room.ready[1]&&!localReady)return}
   else{if(room&&session&&!session.result)return;session=null;localReady=false;disconnected=false;}
   if(!recovery?.active)recovery?.adopt(data.recovery,conn);room=JSON.parse(JSON.stringify(data.room));room.ready[1]=localReady;chosenTime={...room.time};linked=true;clearHandshake();showRoomOverlay();packet('LINKED',{id:room.id,config:room.config});return;
  }
  if(!room||data.id!==room.id)return;
  if(data.type==='LINKED'&&role==='host'&&!session){linked=true;clearHandshake();renderRoom();tryStart();return}
  if(data.type==='READY'&&role==='host'&&!session&&data.config===room.config&&linked&&bridge.validProfile(data.profile)&&data.profile.id===room.profiles[1].id){room.profiles[1]={...data.profile};room.ready[1]=true;renderRoom();sendRoom();tryStart();return}
  if(data.type==='START'&&role==='guest'&&!session&&data.config===room.config&&localReady&&room.ready.every(Boolean)){packet('START_ACK',{id:room.id,config:room.config});handshake();return}
  if(data.type==='START_ACK'&&role==='host'&&!session&&room.starting&&data.config===room.config&&localReady&&room.ready.every(Boolean)){clearHandshake();session=new ChessSession(room.id,room.time);session.start(now());showScreen();broadcast();return}
  if(data.type==='STATE'&&role==='guest'){
   if(!Array.isArray(data.scores)||data.scores.length!==2||!data.scores.every(n=>Number.isSafeInteger(n)&&n>=0)||data.whiteSide!==room.whiteSide||!localReady||!room.ready.every(Boolean)||data.state?.id!==room.id||data.state.time?.minutes!==room.time.minutes||data.state.time?.increment!==room.time.increment)return;
   if(session&&data.state.revision<session.revision)return;if(session?.result)return;
   const next=ChessSession.restore(data.state,now());if(session&&next.revision===session.revision&&next.game.fen()!==session.game.fen())return;
   const first=!session,changed=first||next.revision!==session.revision;room.scores=[...data.scores];session=next;pendingMove=false;if(changed){selected=null;promotion=null;node('[data-chess-promotion]').hidden=true}clearHandshake();if(first)showScreen();else render();settle();return;
  }
  if(data.type==='REMATCH'&&role==='host'&&session?.result){resetRoom();return}
  if(!session||session.result||disconnected)return;
  if(role==='host'){
   if(data.type==='MOVE'&&data.revision===session.revision){const moved=session.move(colorSide(1),data.from,data.to,data.promotion,now());if(moved)bridge.sound();broadcast();render();settle()}
   else if(data.type==='RESIGN'){session.finish(colorSide(0),'resign',now());broadcast();render();settle()}
   else if(data.type==='DRAW_OFFER'){offerDraw(1)}
   else if(data.type==='DRAW_REPLY'&&typeof data.accept==='boolean'){replyDraw(1,data.accept)}
  }
 }
 async function settle(){
  if(role==='spectator')return;recordRoomScore();if(!session?.result||settled.has(session.id))return;const current=session,id=session.id;settled.add(id);const actual=current.result.winner===null?.5:current.result.winner===colorSide(localSide)?1:0;
  node('[data-chess-result]').textContent='Đang lưu kết quả…';
  savePromise=bridge.finish({id,profiles:room.profiles},localSide,actual);
  try{const result=await savePromise;if(session!==current)return;node('[data-chess-result]').textContent=(result.appliedDeltaElo>=0?'+':'')+result.appliedDeltaElo+' Elo · '+(actual===1?'Thắng':actual===0?'Thua':'Hòa')}catch(_){if(session===current)node('[data-chess-result]').textContent='Chưa lưu được kết quả. Vui lòng giữ trang mở.'}
 }
 function submitMove(from,to,promote){if(role==='spectator'||!session||session.result||disconnected||pendingMove||session.turn!==colorSide(localSide))return;selected=null;promotion=null;node('[data-chess-promotion]').hidden=true;
  if(role==='host'){session.move(colorSide(0),from,to,promote,now());bridge.sound();broadcast();render();settle()}else{pendingMove=true;packet('MOVE',{id:room.id,revision:session.revision,from,to,...(promote?{promotion:promote}:{})});render()}
 }
 function chooseSquare(square){if(role==='spectator'||!session||session.result||disconnected||pendingMove||session.turn!==colorSide(localSide))return;const game=session.game,piece=game.get(square);
  if(selected){const moves=game.moves({square:selected,verbose:true}).filter(m=>m.to===square);if(moves.length){if(moves.some(m=>m.promotion)){promotion={from:selected,to:square};node('[data-chess-promotion]').hidden=false;node('[data-chess-promote="q"]').focus()}else submitMove(selected,square);return}}
  selected=piece?.color===playerColor(localSide)?(selected===square?null:square):null;drawnRevision=-1;render();
 }
 for(const button of screen.querySelectorAll('[data-chess-promote]'))button.onclick=()=>{if(promotion)submitMove(promotion.from,promotion.to,button.dataset.chessPromote)};
 node('[data-chess-cancel-promotion]').onclick=()=>{promotion=null;node('[data-chess-promotion]').hidden=true};
 function offerDraw(actor){if(!session||session.result||session.tick(now())){broadcast();render();settle();return}if(session.drawOffer!==null)return;session.drawOffer=actor;session.revision++;broadcast();render()}
 function replyDraw(actor,accept){if(!session||session.result||session.drawOffer===null||session.drawOffer===actor)return;if(session.tick(now())){broadcast();render();settle();return}if(accept)session.finish(null,'agreement',now());else{session.drawOffer=null;session.revision++}broadcast();render();settle()}
 node('[data-chess-draw]').onclick=()=>{if(role==='spectator'||!session||session.result||disconnected)return;const accept=session.drawOffer!==null&&session.drawOffer!==localSide;if(role==='host'){if(accept)replyDraw(0,true);else offerDraw(0)}else packet(accept?'DRAW_REPLY':'DRAW_OFFER',{id:room.id,...(accept?{accept:true}:{})})};
 node('[data-chess-decline]').onclick=event=>{event?.preventDefault();if(role==='host')replyDraw(0,false);else packet('DRAW_REPLY',{id:room.id,accept:false})};
 function resign(){if(role==='spectator'||!session||session.result||disconnected)return;if(role==='host'){if(!session.tick(now()))session.finish(colorSide(1),'resign',now());broadcast();render();settle()}else packet('RESIGN',{id:room.id})}
 node('[data-chess-resign]').onclick=resign;
 async function resetRoom(){
  if(role!=='host'||!session?.result||!conn?.open)return;const previous=session,current=epoch;await savePromise;if(epoch!==current||session!==previous)return;
  const profiles=room.profiles.map(p=>bridge.latest(p));room={...room,id:'chess-'+bridge.uid(),whiteSide:1-room.whiteSide,profiles,ready:[false,false],config:0,editable:true};delete room.starting;session=null;localReady=false;selected=null;disconnected=false;showRoomOverlay();sendRoom();
 }
 node('[data-chess-rematch]').onclick=()=>{if(role==='spectator'||!session?.result||!conn?.open)return;if(role==='host')resetRoom();else{packet('REMATCH',{id:room.id});node('[data-chess-status]').textContent='Đang chờ chủ phòng mở lại phòng chờ…'}};
 node('[data-chess-leave]').onclick=()=>{if(role==='spectator'){destroy();menu(false);$('lobby').hidden=false;$('pvpMenu').hidden=true;return}if(session&&!session.result&&!disconnected){resign();node('[data-chess-status]').textContent='Đã xin thua. Khi kết quả hiện ra, bấm Thoát.';return}destroy();menu(false);$('lobby').hidden=false;$('pvpMenu').hidden=true;bridge.refresh()};
 node('[data-chess-pgn]').onclick=event=>{event?.preventDefault();if(!session)return;const result=session.result?(session.result.winner===null?'1/2-1/2':session.result.winner===0?'1-0':'0-1'):'*';session.game.header('Event','Anh Hung Hao Kiet - Chess','White',room.profiles[room.whiteSide].name,'Black',room.profiles[1-room.whiteSide].name,'TimeControl',String(room.time.minutes*60)+'+'+room.time.increment,'Result',result);const text=session.game.pgn();const url=URL.createObjectURL(new Blob([text],{type:'application/x-chess-pgn;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='quickdrawn-chess.pgn';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 function pieceElement(key){const el=document.createElement('span');el.className='chess-piece';el.style.backgroundImage='var(--chess-'+key+',none)';el.textContent=unicode[key];el.setAttribute('aria-hidden','true');return el}
 function recentPlayerMoves(history,actor){
  const color=playerColor(actor);return history.map((move,index)=>({color:move.color,san:move.san,number:Math.floor(index/2)+1})).filter(move=>move.color===color).slice(-8);
 }
 function renderRecentMoves(history){
  for(const actor of [0,1]){
   const target=node('[data-chess-recent="'+actor+'"]');if(!target)continue;target.replaceChildren();const recent=recentPlayerMoves(history,actor);
   target.textContent='';
   for(let index=0;index<8;index++){const move=recent[index],label=document.createElement('span');label.className='chess-recent-move'+(!move?' is-empty':index===recent.length-1?' is-latest':'');label.textContent=move?move.number+'. '+move.san:'—';if(move)label.title=label.textContent;else label.setAttribute('aria-hidden','true');target.append(label)}
  }
 }
 function capturedGroups(history,playerSide){
  const ownColor=playerColor(playerSide),victimColor=playerColor(1-playerSide),counts={};
  for(const move of history)if(move.color===ownColor&&move.captured)counts[move.captured]=(counts[move.captured]||0)+1;
  return Array.from('qrbnp').filter(piece=>counts[piece]).map(piece=>({key:victimColor+piece,piece,count:counts[piece]}));
 }
 function renderCapturedSummary(tray,counts,actor,newCapture){
  const title=document.createElement('small');title.className='chess-captured-title';title.textContent='QUÂN ĐÃ ĂN';tray.append(title);const victim=playerColor(1-actor);
  for(const type of ['p','r','n','b','q']){
   const count=counts[type]||0,cell=document.createElement('div');cell.className='chess-summary-slot '+(count?'is-captured':'is-ghost');cell.dataset.piece=victim+type;cell.dataset.captureCount=String(count);cell.setAttribute('aria-label',pieceNames[type]+': '+(count?count+' quân đã ăn':'chưa ăn'));
   const key='summary:'+actor+':'+type+':'+count;if(count&&newCapture&&!rackLit.has(key))cell.classList.add('capture-pop');if(count)rackLit.add(key);cell.append(pieceElement(victim+type));
   if(count>1){const amount=document.createElement('span');amount.className='chess-summary-count';amount.textContent=String(count);amount.setAttribute('aria-hidden','true');cell.append(amount)}tray.append(cell);
  }
 }
 function renderCapturedPieces(history){
  const matchChanged=rackMatch!==session.id;if(matchChanged){rackMatch=session.id;rackLit=new Set();previousCaptureTotal=null}
  const total=history.filter(m=>m.captured).length,newCapture=previousCaptureTotal!==null&&total>previousCaptureTotal;previousCaptureTotal=total;
  for(const actor of [0,1]){
   const tray=node('[data-chess-captured="'+actor+'"]'),below=actor===viewPlayer(),counts=Object.fromEntries(capturedGroups(history,actor).map(g=>[g.piece,g.count]));tray.replaceChildren();tray.dataset.boardSide=below?'below':'above';tray.classList.toggle('is-summary',summaryCaptures());if(summaryCaptures()){renderCapturedSummary(tray,counts,actor,newCapture);continue}
   const pawns=document.createElement('div'),pieces=document.createElement('div');pawns.className=pieces.className='chess-rack-row';pawns.dataset.captureRow='pawns';pieces.dataset.captureRow='pieces';
   if(below){tray.append(pieces);tray.append(pawns)}else{tray.append(pawns);tray.append(pieces)}
   const used={},pattern=['r','n','b','q',null,'b','n','r'],victim=playerColor(1-actor);
   for(const [row,types]of [[pawns,Array(8).fill('p')],[pieces,pattern]])for(const type of types){
    const cell=document.createElement('div');cell.className='chess-rack-slot';if(!type){cell.setAttribute('aria-label','Ô trống');row.append(cell);continue}
    const occurrence=used[type]||0;used[type]=occurrence+1;const lit=(counts[type]||0)>occurrence,key=actor+':'+type+':'+occurrence;
    cell.dataset.piece=victim+type;cell.dataset.captureSlot=key;cell.classList.add(lit?'is-captured':'is-ghost');if(lit&&newCapture&&!rackLit.has(key))cell.classList.add('capture-pop');if(lit)rackLit.add(key);
    cell.setAttribute('aria-label',pieceNames[type]+(lit?' đã ăn':' chưa ăn'));cell.append(pieceElement(victim+type));
    const capacity=type==='p'?8:type==='q'?1:2;if(occurrence===capacity-1&&(counts[type]||0)>capacity){const more=document.createElement('span');more.className='chess-rack-overflow';more.textContent='+'+(counts[type]-capacity);cell.append(more)}row.append(cell);
   }
  }
  if(newCapture)bridge.captureSound?.();
 }

 function render(){
  if(!session||screen.hidden)return;syncSpectatorLayout();renderDojoScore();const g=session.game,history=g.history({verbose:true}),last=history.at(-1),legal=selected?new Set(g.moves({square:selected,verbose:true}).map(m=>m.to)):new Set();
  if(drawnRevision!==session.revision||board.dataset.selected!==(selected||'')){
   const focusSquare=document.activeElement?.dataset.chessSquare;board.replaceChildren();const ranks=playerColor(viewPlayer())==='b'?[1,2,3,4,5,6,7,8]:[8,7,6,5,4,3,2,1],files=playerColor(viewPlayer())==='b'?'hgfedcba':'abcdefgh';
   ranks.forEach((rank,r)=>Array.from(files).forEach((file,c)=>{const sq=file+rank,p=g.get(sq),button=document.createElement('button');button.type='button';button.dataset.chessSquare=sq;button.className='chess-square '+(((file.charCodeAt(0)-97+rank)%2===0)?'light':'dark');if(legal.has(sq))button.classList.add('is-legal');if(selected===sq)button.classList.add('is-selected');if(last&&(last.from===sq||last.to===sq))button.classList.add('is-last');if(p?.type==='k'&&p.color===g.turn()&&g.isCheck())button.classList.add('is-check');button.setAttribute('role','gridcell');button.setAttribute('aria-label',sq+(p?' · '+(p.color==='w'?'Trắng ':'Đen ')+pieceNames[p.type]:''));button.setAttribute('aria-selected',selected===sq?'true':'false');button.tabIndex=sq===(focusSquare||'e2')?0:-1;if(r===7)button.dataset.file=file;if(c===0)button.dataset.rank=rank;if(p)button.append(pieceElement(p.color+p.type));button.onclick=()=>chooseSquare(sq);button.onkeydown=event=>{const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[event.key];if(offset===undefined)return;event.preventDefault();const target=board.children[Math.max(0,Math.min(63,r*8+c+offset))];for(const b of board.children)b.tabIndex=-1;target.tabIndex=0;target.focus()};board.append(button)}));
   board.dataset.selected=selected||'';drawnRevision=session.revision;if(focusSquare)board.querySelector('[data-chess-square="'+focusSquare+'"]')?.focus();
   renderRecentMoves(history);renderCapturedPieces(history);
  }
  const watching=role==='spectator';for(const selector of ['[data-chess-resign]','[data-chess-draw]','[data-chess-rematch]'])node(selector).hidden=watching;node('[data-chess-resign]').disabled=!!session.result||disconnected;node('[data-chess-draw]').disabled=!!session.result||disconnected||session.drawOffer===localSide;const accepting=session.drawOffer!==null&&session.drawOffer!==localSide;node('[data-chess-action-label="draw"]').textContent=accepting?'Đồng ý':'Hòa';node('[data-chess-draw]').setAttribute('aria-label',accepting?'Chấp nhận hòa':'Xin hòa');node('[data-chess-draw]').setAttribute('title',accepting?'Chấp nhận hòa':'Xin hòa');node('[data-chess-decline]').hidden=watching||session.result||session.drawOffer===null||session.drawOffer===localSide;node('[data-chess-rematch]').hidden=watching;node('[data-chess-rematch]').disabled=!session.result||disconnected;node('[data-chess-leave]').setAttribute('aria-label',session.result||disconnected?'Thoát về sảnh':'Thoát ván (xin thua)');
  if(!disconnected)node('[data-chess-status]').textContent=session.result?(session.result.winner===null?'HÒA':role==='spectator'?(session.result.winner===0?'TRẮNG THẮNG':'ĐEN THẮNG'):session.result.winner===colorSide(localSide)?'BẠN THẮNG':'BẠN THUA')+' · '+reasons[session.result.reason]:pendingMove?'Đang gửi nước đi…':session.drawOffer!==null&&session.drawOffer!==localSide?'Đối thủ đề nghị hòa.':(role==='spectator'?(session.turn===0?'Quan chiến · Lượt Trắng':'Quan chiến · Lượt Đen'):session.turn===colorSide(localSide)?'Lượt của bạn':'Lượt đối thủ')+(g.isCheck()?' · CHIẾU!':'');
  renderClocks();setResultView(!!session.result);
 }
 function renderClocks(){if(!session)return;const clocks=session.remaining(now()),key=clocks.map(n=>Math.ceil(n/1000)).join(':')+session.turn+!!session.result;if(key===lastClock)return;lastClock=key;for(let i=0;i<2;i++){const seconds=Math.ceil(clocks[colorSide(i)]/1000),el=node('[data-chess-clock="'+i+'"]');el.textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');el.classList.toggle('is-ticking',!session.result&&session.turn===colorSide(i));el.classList.toggle('is-low',seconds<=30)}}
 setInterval(()=>{if(!enabled||!session||session.result)return;if(role==='host'){if(session.tick(now())){broadcast();render();settle()}else if(now()-lastSync>=1000)broadcast()}renderClocks()},100);
 spectatorMedia?.addEventListener('change',()=>{if(session&&!screen.hidden){drawnRevision=-1;render()}else syncSpectatorLayout()});
 portraitMedia?.addEventListener('change',()=>{if(session&&!screen.hidden){drawnRevision=-1;render()}else syncSpectatorLayout()});
 node('[data-chess-spectate]').onclick=joinSpectator;node('[data-chess-watch-retry]').onclick=joinSpectator;
 node('[data-chess-apply-time]').onclick=editTime;
 node('[data-open-chess]').onclick=open;
 $('openPvpMenu').onclick=()=>{destroy();menu(false);original.pvp()};
 $('host').onclick=()=>enabled?create():original.host();$('join').onclick=()=>enabled?join():original.join();
 $('closePvpMenu').onclick=()=>{if(!enabled){original.close();return}destroy();menu(false);$('lobby').hidden=false;$('pvpMenu').hidden=true;node('[data-open-chess]').focus()};
 node('[data-pvp-ready]').addEventListener('click',()=>{if(enabled)ready()});
 // Backgrounding preserves the in-memory session; recovery probes on return.
 // Atlas rectangles include padding; source dimensions are validated before extraction.
 (async()=>{try{const base=new URL('../assets/images/chess/',document.currentScript?.src||new URL('./js/chess.js',location.href)),manifest=await(await fetch(new URL('chess_viet_sprites.json',base))).json(),image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=new URL(manifest.file,base)});if(image.naturalWidth!==manifest.width||image.naturalHeight!==manifest.height)throw Error('Chess atlas dimensions');for(const [key,rect]of Object.entries({...manifest.pieces,...manifest.tiles})){const [x,y,w,h]=rect;if(!rect.every(Number.isInteger)||x<0||y<0||w<1||h<1||x+w>image.naturalWidth||y+h>image.naturalHeight)throw Error('Chess rectangle');const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,Math.floor(x),Math.floor(y),w,h,0,0,w,h);screen.style.setProperty('--chess-'+key,'url("'+c.toDataURL('image/png')+'")')}screen.classList.add('chess-sprites-ready')}catch(error){console.warn('Chess sprites unavailable; using readable chess symbols.',error.message)}})();
})();
