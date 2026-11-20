(() => {
  'use strict';
  const fleet = [
    {id:'kestrel',name:'Kestrel',skill:'Target slow',price:1800},
    {id:'spectre',name:'Spectre',skill:'Phase shift',price:2400},
    {id:'aegis',name:'Aegis',skill:'Shield',price:2600},
    {id:'tempest',name:'Tempest',skill:'Disruption pulse',price:2800}
  ];
  const allUnlocked = true;
  const key = 'space_dominators_pilot_v1';
  const el = id => document.getElementById(id);
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(key)) || {}; } catch {}
  const number = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  const profile = {credits:number(stored.credits), best:number(stored.best),
    owned:fleet.filter((ship,i) => i === 0 || (Array.isArray(stored.owned) && stored.owned.includes(ship.id))).map(ship => ship.id),
    selected:fleet.some(ship => ship.id === stored.selected) ? stored.selected : fleet[0].id,
    volume:Number.isFinite(stored.volume) ? Math.max(0,Math.min(1,stored.volume)) : .5,
    controls:['mouse','keyboard','both'].includes(stored.controls) ? stored.controls : 'both'};
  profile.lastCoopAward = typeof stored.lastCoopAward === 'string' ? stored.lastCoopAward : '';
  profile.campaignPayout = typeof stored.campaignPayout?.id === 'string' ? {id:stored.campaignPayout.id, credits:number(stored.campaignPayout.credits)} : null;
  const save = () => { try {localStorage.setItem(key, JSON.stringify(profile));} catch {} };
  const selected = () => fleet.find(ship => ship.id === profile.selected);
  const owned = ship => allUnlocked || profile.owned.includes(ship.id);
  let mode = 'hangar', artLoaded = false, previewLoaded = false;
  const ctx = canvas => {const c = canvas.getContext('2d'); c.imageSmoothingEnabled=false;return c;};
  const reducedFlightMotion=window.matchMedia('(prefers-reduced-motion: reduce)');

  function paint(canvas, id, height, time=0) {
    const c = ctx(canvas);
    c.clearRect(0,0,canvas.width,canvas.height);
    if (!previewLoaded)return;
    const scale=canvas.width/Math.max(1,canvas.clientWidth);
    const travel=reducedFlightMotion.matches?0:scale;
    const dx=6*travel*Math.sin(time*1.7),dy=5*travel*Math.sin(time*2.2);
    const size=Math.min(height,(canvas.height-10*travel-4)/1.25);
    SpaceArt.draw(c,id,canvas.width/2+dx,canvas.height/2-size*.125+dy,size,size,Math.floor(time*8));
  }

  function update() {
    const ship=selected();
    el('shipName').textContent=ship.name;
    el('hull').textContent=({kestrel:6,spectre:5,aegis:7,tempest:6})[ship.id]+' HP';
    el('ability').textContent=ship.skill;
    const launch=el('launch');
    launch.firstChild.textContent=owned(ship)?'Launch':'Buy · '+ship.price;
    launch.disabled=!artLoaded || (!owned(ship) && profile.credits < ship.price);
    el('continueCampaign').hidden = !artLoaded || !SpaceGame.hasCampaignCheckpoint();
    paint(el('hero'),ship.id,203);
    syncStationSettings();
  }

  function cycleShip(direction) {
    if (SpaceCoop.state.role) return;
    const index = fleet.findIndex(ship => ship.id === profile.selected);
    profile.selected = fleet[(index + direction + fleet.length) % fleet.length].id;
    save();
    update();
  }
  el('previousShip').onclick = () => cycleShip(-1);
  el('nextShip').onclick = () => cycleShip(1);
  const sky=ctx(el('stationSpace')), station=el('station'), hero=el('hero');
  const wingmateHero=el('wingmateHero');
  const localPilotName=el('localPilotName');
  localPilotName.textContent=new URLSearchParams(location.search).get('user')?.trim().slice(0,32) || 'Pilot';
  let wingmateShip=fleet[0].id;
  function renderRoomPilots(state) {
    const inRoom=!!state.role;
    const remoteSide=state.role==='host' ? 1 : 0;
    const preview=el('wingmatePreview');
    const connected=inRoom && state.connected;
    hero.closest('.craft-selector').classList.toggle('is-coop-room',inRoom);
    preview.hidden=!inRoom;
    preview.classList.toggle('is-waiting',!connected);
    wingmateShip=connected ? state.ships[remoteSide] : fleet[0].id;
    el('wingmateName').textContent=connected ? state.names?.[remoteSide] || 'Wingmate' : 'Waiting for wingmate';
    el('previousShip').disabled=el('nextShip').disabled=inRoom;
  }
  function stationSky(now){
    SpaceBackdrop.draw(sky,now/1000);
    if(!station.hidden) {
      paint(hero,selected().id,203,now/1000);
      if (!el('wingmatePreview').hidden) paint(wingmateHero,wingmateShip,203,now/1000);
    }
    requestAnimationFrame(stationSky);
  }
  stationSky(performance.now());
  SpaceArt.playerReady.then(() => { previewLoaded = true; }).catch(() => {
    el('hero').parentElement.setAttribute('aria-label', 'Spacecraft preview assets unavailable');
  });

  let departureDistance=0;
  function finishDeparture(){
    station.hidden=true;station.inert=false;station.classList.remove('departing');
    hero.style.removeProperty('transform');
  }
  window.SpaceStationScene=Object.freeze({frame(phase,time){
    if(!station.classList.contains('departing'))return;
    if(phase!=='cinematic' || time>=SpaceCampaign.departure){finishDeparture();return;}
    const u=Math.max(0,(time-.2)/(SpaceCampaign.departure-.2));
    hero.style.transform='translateY('+(-departureDistance*u*u)+'px)';
  }});

  function enterFlight(){
    mode='flight';el('mission').hidden=false;
    setHangarView('main');
    departureDistance=hero.getBoundingClientRect().bottom+12;
    station.inert=true;station.classList.add('departing');
    el('flight').focus();
  }
  SpaceSound.volume(profile.volume);

  function setVolume(pct) {
    const val = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    profile.volume = val / 100;
    SpaceSound.volume(profile.volume); save();
    renderVolume();
  }

  function renderVolume() {
    const value = Math.round(profile.volume * 100);
    for (const [inputId, iconId] of [['volSlider', 'volLabel'], ['pauseVolSlider', 'pauseVolLabel']]) {
      const input = el(inputId);
      input.value = value;
      input.parentElement.style.setProperty('--volume', value + '%');
      input.setAttribute('aria-valuetext', value === 0 ? 'Muted' : value + '%');
      el(iconId).textContent = value === 0 ? '❌' : '🔊';
    }
  }

  /* ── Controls cycling (Mouse -> Keyboard -> Both) ────────────── */
  function getControlMode() {
    return ['mouse','keyboard','both'].includes(profile.controls) ? profile.controls : 'both';
  }
  function cycleControlMode() {
    const current = getControlMode();
    const next = current === 'both' ? 'mouse' : current === 'mouse' ? 'keyboard' : 'both';
    setControlMode(next);
  }
  function setControlMode(m) {
    profile.controls = m;
    window.SpaceControlsMode = m;
    save();
    updateControlsButtons();
  }
  function updateControlsButtons() {
    const m = getControlMode();
    const label = m === 'both' ? 'Control · Mouse and keyboard' : m === 'mouse' ? 'Control · Mouse' : 'Control · Keyboard';
    const icons = { mouse: '🖱️', keyboard: '⌨️', both: '🖱️ ⌨️' };
    for (const id of ['controlsBtn', 'pauseControlsBtn']) {
      const button = el(id);
      button.querySelector('[data-control-mode-icon]').textContent = icons[m];
      button.setAttribute('aria-label', label);
      button.title = label;
    }
  }
  window.SpaceControlsMode = getControlMode();
  updateControlsButtons();

  /* ── Hangar View Switcher (Main / Settings / Core) ────────────── */
  function setHangarView(view) {
    const dockMain = el('dockMain');
    const dockSettings = el('dockSettings');
    const dockCore = el('dockCore');
    if (dockMain) dockMain.hidden = view !== 'main';
    if (dockSettings) dockSettings.hidden = view !== 'settings';
    if (dockCore) dockCore.hidden = view !== 'core';
    el('toggleSettings')?.setAttribute('aria-expanded', view === 'settings' ? 'true' : 'false');
    if (view === 'settings') {
      syncStationSettings();
      el('volSlider')?.focus();
    } else if (view === 'core') {
      window.SpaceLobby?.render(window.SpaceCoop?.state);
      const input = el('roomCodeInput');
      if (input && !input.hidden) input.focus();
    } else if (view === 'main') {
      el('launch')?.focus();
    }
  }
  window.setHangarView = setHangarView;

  function syncStationSettings() {
    renderVolume();
    updateControlsButtons();
  }

  el('volSlider')?.addEventListener('input', () => setVolume(el('volSlider').value));
  el('toggleSettings')?.addEventListener('click', () => {
    setHangarView(el('dockSettings')?.hidden ? 'settings' : 'main');
  });
  el('closeSettings')?.addEventListener('click', () => setHangarView('main'));
  el('controlsBtn')?.addEventListener('click', cycleControlMode);
  el('pauseControlsBtn')?.addEventListener('click', cycleControlMode);

  function closePanel(){el('panel').hidden=true;}
  function showDebrief(title,content,actions){
    el('panelTitle').textContent=title;
    el('panelContent').replaceChildren(content);
    el('panelActions').replaceChildren();
    actions.forEach(([label, fn], index) => {
      const button=document.createElement('button');
      button.textContent=label;
      button.className=index===actions.length-1 ? 'dock-btn dock-danger' : 'dock-btn';
      button.onclick=fn;
      el('panelActions').append(button);
    });
    el('panel').hidden=false;
    el('panelActions').firstElementChild.focus();

  }

  /* ── Pause bar (inline, bottom of #mission) ──────────────────── */
  function showPauseRow(gridId) {
    el('pauseMain').hidden = gridId !== 'pauseMain';
    el('pauseConfirm').hidden = gridId !== 'pauseConfirm';
    el('pauseVolume').hidden = gridId !== 'pauseVolume';
    if (gridId === 'pauseConfirm') el('cancelEnd')?.focus();
    else if (gridId === 'pauseVolume') el('pauseVolDone')?.focus();
    else if (gridId === 'pauseMain') el('resumeBtn')?.focus();
  }
  function openPauseBar() {
    el('pauseBar').hidden = false;
    el('pause').setAttribute('aria-expanded', 'true');
    el('pause').setAttribute('aria-label', 'Resume mission');
    showPauseRow('pauseMain');
    const val = Math.round(profile.volume * 100);
    if (el('pauseVolSlider')) el('pauseVolSlider').value = val;
    if (el('pauseVolLabel')) el('pauseVolLabel').textContent = 'Effects volume · ' + val + '%';
    updateControlsButtons();
  }
  function closePauseBar() {
    el('pauseBar').hidden = true;
    el('pause').setAttribute('aria-expanded', 'false');
    el('pause').setAttribute('aria-label', 'Pause mission');
  }

  el('pauseVolSlider')?.addEventListener('input', () => setVolume(el('pauseVolSlider').value));
  el('pauseSound')?.addEventListener('click', () => showPauseRow('pauseVolume'));
  el('pauseVolDone')?.addEventListener('click', () => {
    showPauseRow('pauseMain');
    el('pauseSound')?.focus();
  });
  el('endFlightBtn')?.addEventListener('click', () => {
    el('pauseConfirm').querySelector('.confirm-prompt').textContent=
      SpaceCoop.state.role ? 'Return to the Co-op room?' : 'Return to the hangar?';
    showPauseRow('pauseConfirm');
  });
  el('cancelEnd')?.addEventListener('click', () => {
    showPauseRow('pauseMain');
    el('endFlightBtn')?.focus();
  });
  el('confirmEnd')?.addEventListener('click', () => {
    const room=SpaceCoop.state;
    if (room.role && room.phase==='playing') {
      if (!SpaceCoop.stopMission()) {
        el('pauseConfirm').querySelector('.confirm-prompt').textContent='Reconnect to return to the room.';
      }
      return;
    }
    closePauseBar();
    leaveFlight();
  });
  el('resumeBtn')?.addEventListener('click', () => resume());

  let activeMatch = '';
  el('continueCampaign')?.addEventListener('click', () => {
    if (!SpaceGame.continueCampaign()) { update(); return; }
    setHangarView('main'); closePauseBar();
    mode='flight'; el('station').hidden=true; el('mission').hidden=false; el('flight').focus();
  });

  SpaceLobby.init(()=>selected().id);

  function leaveFlight(){
    if (SpaceCoop.state.role) SpaceCoop.leave();
    else openHangar();
  }

  function onRoomState(state){
    renderRoomPilots(state);
    SpaceLobby.render(state);
    if(!state.role){
      if(activeMatch) openHangar();
      activeMatch='';
      if(state.status==='error') setHangarView('core'); else setHangarView('main');
      return;
    }
    if(state.phase==='lobby'){
      if(activeMatch){openHangar();activeMatch='';}
      setHangarView('core');
      return;
    }
    if(!artLoaded) return;
    if(!state.connected){
      if(activeMatch) SpaceGame.setCoopConnected(false);
      setHangarView('core');
      return;
    }
    setHangarView('main');
    if(activeMatch!==state.matchId){
      activeMatch=state.matchId;
      closePanel();closePauseBar();enterFlight();
      SpaceGame.startCoop({role:state.role,roomCode:state.code,matchId:state.matchId,
        lab:state.lab,names:state.names,localName:localPilotName.textContent,hostShip:state.ships[0],guestShip:state.ships[1],send:(type,data)=>SpaceCoop.send(type,data)});
      el('flight').focus();
    }
    SpaceGame.setCoopConnected(true);
  }

  window.addEventListener('spacecoop:state',e=>onRoomState(e.detail));
  window.addEventListener('spacecoop:message',e=>SpaceGame.receiveCoop(e.detail.type,e.detail.payload));
  window.addEventListener('flight-resume',()=>{if(mode==='paused'){closePauseBar();closePanel();mode='flight';el('flight').focus();}});

  function openHangar(){
    finishDeparture();SpaceGame.stop();closePauseBar();closePanel();setHangarView('main');
    mode='hangar';el('mission').hidden=true;el('station').hidden=false;update();el('launch').focus();
  }

  function launch(){
    if(!artLoaded || mode==='flight')return;
    const ship=selected();
    if(!owned(ship)){
      if(profile.credits>=ship.price){profile.credits-=ship.price;profile.owned.push(ship.id);save();update();}
      return;
    }
    closePanel();closePauseBar();enterFlight();
    SpaceGame.start(ship.id);el('flight').focus();
  }

  function resume(){closePauseBar();closePanel();mode='flight';SpaceGame.resume();el('flight').focus();}

  function pauseMenu(){
    if(mode!=='flight' && mode!=='paused')return;
    if(mode==='paused'){
      resume();
      return;
    }
    SpaceGame.pause();
    mode='paused';
    openPauseBar();
  }

  el('launch')?.addEventListener('click', launch);
  el('pause')?.addEventListener('click', pauseMenu);

  window.addEventListener('keydown', e => {
    if (e.code === 'Escape' && !e.defaultPrevented && !e.repeat) {
      if (mode === 'paused') {
        e.preventDefault();
        if (!el('pauseConfirm').hidden) {
          showPauseRow('pauseMain');
          el('endFlightBtn')?.focus();
        } else if (!el('pauseVolume').hidden) {
          showPauseRow('pauseMain');
          el('pauseSound')?.focus();
        } else {
          resume();
        }
        return;
      }
      if (mode === 'hangar') {
        if (!el('dockSettings')?.hidden) {
          e.preventDefault();
          setHangarView('main');
          return;
        }
        if (!el('dockCore')?.hidden && !SpaceCoop.state.role) {
          e.preventDefault();
          setHangarView('main');
          return;
        }
      }
    }
  });

  window.addEventListener('flight-pause',()=>{
    if(mode!=='flight')return;
    mode='paused';
    openPauseBar();
  });
  window.addEventListener('flight-end',e=>{
    if(mode!=='flight' && mode!=='paused')return;mode='debrief';
    closePauseBar();
    const d=e.detail;
    const room=SpaceCoop.state;
    const coOpResult=!!(activeMatch && room.role);
    const practice=!!(d.practice || (coOpResult && room.lab));
    const share=value=>coOpResult ? Math.floor((number(value)+(room.role==='host' ? 1 : 0))/2) : number(value);
    const score=share(d.score);
    const payout=share(Math.floor(number(d.score)/100));
    const rows=share(d.waves),correct=share(d.correct),wrong=share(d.wrong);
    const previous=!activeMatch && d.runId && profile.campaignPayout?.id===d.runId ? profile.campaignPayout.credits : 0;
    const earned=practice || (activeMatch && profile.lastCoopAward===activeMatch) ? 0 : Math.max(0,payout-previous);
    if(!practice && (!activeMatch || profile.lastCoopAward!==activeMatch)){
      profile.credits+=earned;profile.best=Math.max(profile.best,score);
      if(activeMatch) profile.lastCoopAward=activeMatch;
      else if(d.runId) profile.campaignPayout={id:d.runId,credits:Math.max(previous,payout)};
      save();
    }
    const last=el('lastFlight');
    const title=document.createElement('strong');
    const stats=document.createElement('span');
    const outcome=d.status==='victory' ? 'Mission complete' : 'Mission failed';
    title.textContent=(coOpResult ? 'Co-op · ' : '')+outcome+' · '+score.toLocaleString('en-US')+' pts';
    stats.textContent=rows+' rows · '+correct+' correct · '+wrong+' wrong · +'+earned+' CR';
    last.replaceChildren(title,stats);
    if(d.status==='defeat'){
      if (!coOpResult) leaveFlight();
      else if (room.role==='host') SpaceCoop.resetMatch();
      // The guest returns on the host's lobby snapshot, sent after the finish result.
      return;
    }
    const summary=document.createElement('div'),points=document.createElement('strong'),p=document.createElement('p');
    points.className='scoreline';points.textContent=score.toLocaleString('en-US')+' pts';
    p.textContent=rows+' rows cleared · '+correct+' correct ships · '+wrong+' wrong · +'+earned+' credits';
    summary.append(points,p);showDebrief(d.status==='victory'?(practice?'Boss Lab cleared':'Mission complete'):'Flight debrief',summary,activeMatch ? [...(SpaceCoop.state.role==='host' ? [['Return to room',()=>SpaceCoop.resetMatch()]] : []),['Leave room',leaveFlight]] : [['Fly again',launch],['Hangar',openHangar]]);
  });

  update();
  Promise.all([window.SpaceArt?.ready,window.SpaceCampaign?.ready,SpaceWords.ready]).then(()=>{
    if(!window.SpaceArt || !window.SpaceGame || !window.SpaceWords)throw Error('Missing flight module');
    artLoaded=true;update();el('openCoop').disabled=false;
    if(SpaceCoop.state.code){onRoomState(SpaceCoop.state);SpaceCoop.reconnect();}
  }).catch(()=>{el('launch').firstChild.textContent='Flight assets unavailable ';});
})();
