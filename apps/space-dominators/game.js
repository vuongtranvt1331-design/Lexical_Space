/* Space Dominators flight simulation. Coordinates and velocities are in scene pixels. */
(() => {
  'use strict';
  const WIDTH = 1280, HEIGHT = 720, ROW_Y = 156;
  const roles = ['scout', 'diver', 'tracker', 'guardian'];
  const roleColors = {scout:'#82edf1', diver:'#ff9f84', tracker:'#ffdc82', guardian:'#b5a8ff'};
  const hulls = {
    kestrel: {speed: 660, hp: 5, skill:'TARGET SLOW', cooldown:10},
    spectre: {speed: 760, hp: 4, skill:'PHASE DRIVE', cooldown:9},
    aegis:   {speed: 550, hp: 6, skill:'ION SHIELD', cooldown:12},
    tempest: {speed: 640, hp: 5, skill:'ARC PULSE', cooldown:10}
  };
  const keys = new Set();
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi,x));
  const noise = (a,b) => a + window.SpaceFlightRandom()*(b-a);
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  let canvas, ctx, sim, raf = 0, lastTime = 0;
  let pointerFire = false, target = null, pointerId = null;
  let coop=null;
  const pilots=()=>sim.wingman ? [sim.player,sim.wingman] : [sim.player];
  function nearestPilot(x,y) {
    return pilots().filter(p=>p.hp>0).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0] || sim.player;
  }
  function resetInput() { keys.clear(); pointerFire=false; target=null; pointerId=null; }
  function note(text,color='#b3fcf5',duration=1.6) {
    sim.message={text,color,time:duration};
  }
  function sound(cue){
    window.SpaceSound?.play(cue);
    
  }
  function burst(x,y,color,count=15) {
    for(let i=0;i<count;i++) {
      const a=noise(0,Math.PI*2),speed=noise(35,230), life=noise(.15,.65);
      sim.particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,color,life,max:life,size:noise(1.5,4)});
    }
  }
  const armor = [4,7,8,9,10,11,12,13,14,15];
  const weaponSalvoDamage = [2.00, 2.05, 2.08, 2.10, 2.12, 2.14, 2.17, 2.20];
  const PILOT_WALLET_KEY = 'space_dominators_pilot_v1';
  function getProfileCredits(){
    try{
      const data=JSON.parse(localStorage.getItem(PILOT_WALLET_KEY));
      return Number.isSafeInteger(data?.credits)&&data.credits>=0?data.credits:0;
    }catch{return 0;}
  }
  function saveProfileCredits(amount){
    try{
      const data=JSON.parse(localStorage.getItem(PILOT_WALLET_KEY))||{};
      data.credits=Math.max(0,Math.trunc(amount)||0);
      localStorage.setItem(PILOT_WALLET_KEY,JSON.stringify(data));
      window.dispatchEvent(new CustomEvent('space-wallet-change',{detail:{credits:data.credits}}));
    }catch{}
  }
  const ROWS_PER_BOSS = 10;
  const SOLO_SAVE = 'space_dominators_campaign_v2';
  const RUSH_UNLOCK = 'space_dominators_boss_rush_unlocked_v1';
  const gunPeriod = [.20,.19,.18,.17,.17,.17,.17,.17];
  const capitalAfter = wave => wave % ROWS_PER_BOSS === 6;
  function makeFormation(wave, destY) {
    sound('arrival');
    const quiz=choice(()=>window.SpaceWords.next()), pair=new Set(quiz.pair), words=quiz.words.slice();
    const tier=Math.min(armor.length,Math.ceil(wave/ROWS_PER_BOSS));
    // Shuffle the maneuvers as a deck, so each approach is seen in a short flight.
    if(!sim.routes.length) {
      sim.routes=['convoy','pincer','comet','overhead'];
      for(let i=3;i>0;i--){const j=Math.floor(noise(0,i+1));[sim.routes[i],sim.routes[j]]=[sim.routes[j],sim.routes[i]];}
      if(wave===1 || sim.routes[3]===sim.lastRoute){
        const pos=wave===1?sim.routes.indexOf('convoy'):0;
        [sim.routes[3],sim.routes[pos]]=[sim.routes[pos],sim.routes[3]];
      }
    }
    const route=sim.routes.pop(),sign=window.SpaceFlightRandom()<.5?-1:1;
    sim.lastRoute=route;
    const gap=Math.min(260,1090/words.length);
    const ships=words.map((word,i)=>{
      const tx=WIDTH/2+(i-(words.length-1)/2)*gap, role=roles[Math.floor(noise(0,roles.length))];
      const rank=sign===1?i:words.length-1-i;
      const hp=armor[tier-1]+(tier>1 && wave%10>=5 && role==='guardian'?1:0);
      return {word,role,tx,x:-128,y:-128,tier,hp,maxHp:hp,
        driftPhase:noise(0,Math.PI*2), driftRate:noise(.8,1.3), dodge:0, dive:null,
        flash:0,selected:false,delay:rank*(route==='convoy'?.24:.12),action:0,actionTime:0};
    });
    return {wave,pair,clue:quiz.clue,ships,destY,route,sign,age:-.65,ready:false};
  }
  function curve(a,b,c,d,u) {
    const v=1-u;
    return v*v*v*a + 3*v*v*u*b + 3*v*u*u*c + u*u*u*d;
  }
  function advanceFormation(f,dt) {
    if(f.ready)return;
    f.age+=dt;
    let ready=true;
    for(let i=0;i<f.ships.length;i++){
      const e=f.ships[i],bottom=HEIGHT+65, y=f.destY;
      const t=clamp((f.age-e.delay)/(f.route==='convoy'?3.5:2.25),0,1);
      const sx=v=>WIDTH/2+f.sign*v;
      if(f.route==='convoy'){
        // All ships follow exactly the same climbing curve before peeling off.
        if(t<.62) {
          const u=t/.62;
          e.x=sx(curve(480,580,310,-270,u));e.y=curve(bottom,426,92,64,u);
        } else {
          const u=(t-.62)/.38;
          e.x=curve(sx(-270),sx(-490),e.tx,e.tx,u);e.y=curve(64,4,y,y,u);
        }
      } else if(f.route==='overhead'){
        const side=i%2?1:-1;
        e.x=curve(WIDTH/2+side*180,WIDTH/2+side*570,e.tx,e.tx,t);
        e.y=curve(-80,280,48,y,t);
      } else {
        const side=f.route==='pincer' && i%2 ? -f.sign : f.sign;
        const from=WIDTH/2+side*(WIDTH/2+78);
        e.x=curve(from,WIDTH/2+side*390,e.tx-side*95,e.tx,t);
        e.y=curve(f.route==='pincer'?300:bottom, f.route==='pincer'?12:470,4,y,t);
      }
      if(t<1)ready=false;
    }
    f.ready=ready;
  }
  const fleetPeriod=()=>Math.max(3.5,7-sim.cleared*.1);
  function layoutFleets(){
    const fleets=[sim.formation,...sim.reserve];
    // Fill the three lanes first. Each extra fleet pairs the next lane from the bottom.
    const pairs=Math.max(0,fleets.length-3);
    fleets.forEach((fleet,index)=>{fleet.escort=index<2*pairs && index%2===1;});
    let row=-1;
    for(let k=0;k<fleets.length;k++){
      const f=fleets[k];
      if(!f.escort)row++;
      const paired=f.escort || fleets[k+1]?.escort;
      f.destY=ROW_Y-row*65;
      const count=f.escort?fleets[k-1].ships.length:f.ships.length;
      for(const [i,e] of f.ships.entries()){
        const gap=1090/count;
        if(paired){
          const main=f.escort?fleets[k-1]:f, escort=f.escort?f:fleets[k+1];
          const escortFirst=escort.ships.length>main.ships.length;
          const slot=i*2+Number(Boolean(f.escort)!==escortFirst);
          e.tx=72+slot*(WIDTH-144)/(main.ships.length+escort.ships.length-1);
        }else e.tx=WIDTH/2+(i-(count-1)/2)*gap;
      }
    }
  }
  function fleetArrival(){
    if(sim.reserve.length===5){
      // Two paired lanes explode. The incoming seventh fleet joins the two survivors.
      for(const f of [sim.formation,...sim.reserve.slice(0,3)])for(const e of f.ships){
        if(e.hp){miniBlast(e.x,e.y,62);burst(e.x,e.y,'#ff9c67',10);}
      }
      sim.reserve.splice(0,3);
      damage(true,sim.player,2);
      if(sim.state==='active'){
        sim.reserve.push(makeFormation(sim.wave+1,ROW_Y-130));
        newRow();
      }
      return;
    }
    sim.reserve.push(makeFormation(sim.wave+1,43));
    layoutFleets();
  }
  function advanceReserves(dt){
    for(const f of sim.reserve){
      if(!f.ready){advanceFormation(f,dt);continue;}
      const settle=1-Math.exp(-4*dt);
      for(const e of f.ships){
        e.driftPhase+=dt;
        e.x+=(e.tx+4*Math.sin(e.driftPhase)-e.x)*settle;
        e.y+=(f.destY-e.y)*settle;
      }
    }
  }
  function newRow() {
    const wave=sim.cleared+1;
    const formation=sim.reserve.shift() || makeFormation(wave,ROW_Y);
    formation.escort=false;
    sim.staging=null;sim.formation=formation;sim.wave=wave;
    sim.clue=formation.clue;sim.pair=formation.pair;sim.row=formation.ships;
    sim.found=[];sim.clean=true;sim.missileBonus=0;sim.phase='arrival';sim.phaseTime=0;
    sim.message=null;sim.hostiles=[];sim.shots=[];sim.bossWave=wave%ROWS_PER_BOSS===0;sim.boss=null;
    sim.enemyBeat=2.7;layoutFleets();
  }
  function updateArrival(dt) {
    const f=sim.formation;
    advanceFormation(f,dt);
    if(!f.ready)return;
    if(f.destY!==ROW_Y){
      // A waiting squadron drops into the scoring lane; shots remain disarmed in transit.
      f.deploy=(f.deploy||0)+dt/0.8;
      const u=clamp(f.deploy,0,1), ease=u*u*(3-2*u);
      for(const e of sim.row)e.y=f.destY+(ROW_Y-f.destY)*ease;
      if(u<1)return;
    }
    sim.phase='match';sim.phaseTime=0;
    sim.player.gun=.30;
  }
  const briefing = [
      ["VEYR", "Seal the jump gate. Rebel ships are using the evacuation route."],
      ["KITE", "Admiral, there are families from twelve colonies on those ferries."],
      ["VEYR", "I know. The gate stays shut."],
      ["TEACHER", "Seventeen?"],
      ["STUDENT 17", "Here."],
      ["TEACHER", "Eighteen?"],
      ["SCHOOL FERRY", "[Signal lost.]"],
      ["KITE", "All ferries, follow my engine lights. I’ll open a way through."]
  ];
  const transmissions = [
    [
      ["VEYR", "Courier, you were cleared to leave an hour ago."],
      ["KITE", "I came back for the school ferry. They’re on my wing now."]
    ],
    [
      ["KITE", "Your gunner aimed wide. The ferries got through."],
      ["VEYR", "His daughter is on the second ferry."]
    ],
    [
      ["VEYR", "That carrier used to be a hospital."],
      ["KITE", "Then tell me which hatch takes a stretcher."],
      ["VEYR", "Port side. I’ve sent the access code."]
    ],
    [
      ["KITE", "Your rescue manual got us through the mines. Why seal the gate now?"],
      ["VEYR", "One rebel ship slips out, the blockade fails. I signed the order."]
    ],
    [
      ["VEYR", "You covered my captain’s retreat."],
      ["KITE", "She was towing escape pods. My passengers made room."]
    ],
    [
      ["VEYR", "Who put the passenger list on the public channel?"],
      ["KITE", "I did. Their families have been waiting all night to hear who’s alive."]
    ],
    [
      ["VEYR", "Gate Seven, keep that passage sealed."],
      ["KITE", "They’ve opened it, Admiral. The first ferry is through."]
    ],
    [
      ["VEYR", "I can still close the jump gate."],
      ["KITE", "Then get on the public channel. Tell those families why."],
      ["VEYR", "…Keep the channel open."]
    ],
    [
      ["VEYR", "Escort Wing, form up on my flagship."],
      ["KITE", "Look to port. They’re escorting the ferries."],
      ["VEYR", "I see them."]
    ],
    [
      ["KITE", "The jump gate is clear. All ferries are through. Pod Six, I’m coming back."],
      ["VEYR", "You know who’s aboard?"],
      ["KITE", "Yes, Admiral. There’s a seat for you."],
      ["TEACHER", "Eighteen?"],
      ["STUDENT 18", "Here."]
    ]
  ];
  function beginBoss(index, phase=1) {
    sim.bossIndex=index;sim.boss=window.SpaceBosses.create(index,{coop:!!sim.wingman,phase});
    sim.reserve=[];sim.fleetClock=fleetPeriod();sim.bossWave=true;sim.phase='core';sim.phaseTime=0;sim.staging=null;sim.capital=null;
    sim.shots=[];sim.hostiles=[];sim.row.forEach(e=>{e.popped=true;});
    sim.missileBonus=0;sim.message=null;sound('boss');saveMilestone();
  }
  function bossAPI(){
    return {chooseWord:choice,wordPool:window.SpaceWords.typingWords,hazards:sim.hostiles, pilots:pilots().filter(p=>p.hp>0), pilotSeat:p=>p===sim.player?0:1, makeHazard, miniBlast, damage:p=>damage(false,p), penalty:p=>damage(true,p,2), asteroidImpact:p=>damage(!!sim.wingman,p), burst,sound};
  }
  function releaseCore() {
    const boss=sim.boss;
    const {x,y}=boss;
    const hullXs=window.SpaceBosses.hulls?.(boss)||[x];
    const wreck={
      start:sim.time,seed:(sim.bossIndex*65537+Math.round(sim.time*1000))>>>0,
      size:boss.index===10?384:boss.index===5?194:232, hullXs:[...hullXs], y
    };
    sim.boss=null;sim.phase='boss-explosion';sim.phaseTime=0;
    sim.core={x,y,originX:x,originY:y,age:0,id:sim.runId+'-'+sim.bossIndex,wreck};
    sim.hostiles=[];sim.shots=[];sim.score+=sim.bossIndex===1?25000:5000;
    sound('bossBlast');
    checkpoint();
  }
  function applyCore(){
    const index=sim.bossIndex;
    if(!sim.core || sim.rewarded>=index)return;
    sim.rewarded=index;
    sim.weaponLevel=Math.min(gunPeriod.length,sim.weaponLevel+1);
    for(const p of pilots()){
      const previous=p.level;
      p.level=Math.min(sim.weaponLevel,p.level+1);
      if(p.level===previous)p.guard=true;

      p.grace=2;
    }
    sim.core=null;sim.upgradeFlash=4;sim.phase='reward';sim.phaseTime=0;
    if(index===1)sim.score+=15000;
    note(index===1?'CANNON UPGRADED   ·   CONVOY SAFE  +15,000':'UPGRADE CORE RECOVERED','#ffdf8a',1.6);
    sound('skill');saveMilestone();
  }
  function updateCore(dt){
    const c=sim.core;
    c.age+=dt;
    c.y+=75*dt;
    const p=nearestPilot(c.x,c.y);
    if(c.age>=2){
      const fraction=1-Math.exp(-5*dt);
      c.x+=(p.x-c.x)*fraction;c.y+=(p.y-c.y)*fraction;
    }
    if(distance(c,p)<39 || c.age>4)applyCore();
  }
  function advanceDialogue(skipBriefing=false){
    if(!['dialogue','briefing'].includes(sim?.phase) || sim.state!=='active' || coop?.connected===false)return;
    if(!streamStep && coop?.role==='guest')return;
    if(command('dialogue',skipBriefing))return;
    if(sim.phase==='briefing'){
      if(!skipBriefing && sim.line+1<briefing.length)sim.line++;
      else{sim.line=0;sim.phase='cinematic';sim.phaseTime=0;resetInput();}
      checkpoint();return;
    }
    const lines=transmissions[sim.bossIndex-1];
    if(sim.line+1<lines.length){sim.line++;checkpoint();return;}
    if(sim.rush && sim.bossIndex<10){
      const next=sim.bossIndex+1;
      sim.wave=next*ROWS_PER_BOSS;
      beginBoss(next);
    }else if(sim.practice || sim.bossIndex===10){
      end('victory');
    }else if(sim.cleared > 0 && sim.cleared % 20 === 0 && !sim.shopVisited && !sim.practice){
      openDockShop();
    }else{
      delete sim.shopVisited;
      newRow();
    }
  }
  function beginCapital() {
    sim.reserve=[];sim.fleetClock=fleetPeriod();
    sim.phase='capital-arrival';sim.phaseTime=0;sim.message=null;
    sim.hostiles=[];sim.shots=[];sim.missileBonus=0;
    const hp=3+sim.weaponLevel*4;
    sim.capital={x:WIDTH/2,y:-85,beat:.45,turn:0,turrets:[-138,0,138].map((offset,i)=>({
      x:WIDTH/2+offset,y:-67,offset,hp,maxHp:hp,warning:0,flash:0,launcher:i===1
    }))};
    sound('boss');
  }
  function updateCapital(dt) {
    const c=sim.capital;
    if(sim.phase==='capital-arrival') {
      const u=clamp(sim.phaseTime/1.7,0,1);
      c.y=-85+211*u*u*(3-2*u);
      for(const t of c.turrets)t.y=c.y+18;
      if(u===1){sim.phase='capital';sim.phaseTime=0;sim.player.gun=.2;}
      return;
    }
    const combatDt=dt*(sim.slow>0?.46:1);
    c.beat-=combatDt;
    const live=c.turrets.filter(t=>t.hp>0);
    if(c.beat<=0 && live.length){
      const next=live[c.turn%live.length];
      const target=nearestPilot(next.x,next.y);
      next.aim=Math.atan2(target.y-next.y,target.x-next.x);
      next.warning=.76;c.turn++;c.beat=1.18;
    }
    for(const t of live){
      t.flash=Math.max(0,t.flash-dt);
      if(t.warning<=0)continue;
      t.warning-=combatDt;
      if(t.warning<=0){
        if(t.launcher)makeHazard(t.x,t.y+14,t.aim,172,'missile');
        else for(const spread of [-.15,0,.15])makeHazard(t.x,t.y+14,t.aim+spread,230);
      }
    }
  }
  function hitTurret(t,amount) {
    t.hp=Math.max(0,t.hp-amount);t.flash=.15;sound('impact');burst(t.x,t.y,'#ffbd78',t.hp?5:26);
    if(t.hp)return;
    sim.score+=350;
    if(sim.capital.turrets.some(t=>t.hp>0))return;
    sim.score+=950;burst(sim.capital.x,sim.capital.y,'#ffba79',55);
    sim.hostiles=[];sim.shots=[];sim.phase='capital-clear';sim.phaseTime=0;
    sound('clear');note('GUN DECK SILENCED   +950','#ffd793',1.6);
  }
  function completeRow() {
    sim.cleared++;
    if(!sim.practice && sim.cleared > (sim.rewardedFleetMax || 0)) {
      sim.rewardedFleetMax = sim.cleared;
      sim.credits = (sim.credits || 0) + 5;
      saveProfileCredits(sim.credits);
      note('FLEET CLEARED  +5 CREDITS', '#ffd67a', 1.2);
    }
    if(sim.cleared % 5 === 0) {
      const dropChance = sim.cleared === 5 ? 1 : 0.25;
      if(window.SpaceFlightRandom() < dropChance) {
        spawnShieldDrop(WIDTH/2 + (window.SpaceFlightRandom() - 0.5) * 360, ROW_Y + 30);
      }
    }
    sim.fleetClock=Math.min(sim.fleetClock,fleetPeriod());
    const perfect=sim.clean;
    sim.score+=2700+(perfect?600:0); sound('clear');
    if(sim.reserve.length && sim.cleared%ROWS_PER_BOSS!==0 && !capitalAfter(sim.wave)){
      // Destroy the answered fleet only; promote the oldest survivor immediately.
      for(const ship of sim.row)if(ship.hp)miniBlast(ship.x,ship.y,52);
      newRow();
      note(perfect?'PERFECT LINK  +3,300':'SYNONYM LINK  +2,700','#9dfff3',2);
      return;
    }
    sim.phase='chain'; sim.phaseTime=0; sim.shots=[]; sim.hostiles=[]; 
    for(const e of sim.row) { e.action=0; e.y=ROW_Y; e.popAt=.07+Math.abs(e.tx-WIDTH/2)/900; }
    note(sim.clean?'PERFECT LINK  +3,300':'SYNONYM LINK  +2,700','#9dfff3',2);
  }
  function end(status='defeat') {
    window.SpaceSound?.missileFlight?.(false);
    if(!sim || sim.state==='ended') return;
    sim.state='ended';sim.outcome=status;
    if(status==='victory' && !sim.practice && sim.rewarded===10){try{localStorage.setItem(RUSH_UNLOCK,'1');}catch{}}
    if(status==='victory' && !coop && !sim.practice){try{localStorage.removeItem(SOLO_SAVE);}catch{}}
    resetInput(); cancelAnimationFrame(raf);
    const flight=sim;
    const detail={practice:!!sim.practice,runId:sim.runId,score:sim.score,waves:sim.cleared,correct:sim.correct,wrong:sim.wrong,status,matchId:coop?.matchId};
    if(coop?.role==='host') {
      checkpoint();
      sendBaseline();
    }
    queueMicrotask(()=>{if(sim===flight && !(coop?.role==='guest' && !coop.finalConfirmed)) window.dispatchEvent(new CustomEvent('flight-end',{detail}));});
  }
  function teamCapacity(world){
    return hulls[world.player.ship].hp+hulls[world.wingman.ship].hp;
  }
  function setTeamHealth(world,value){
    world.teamHp=clamp(value,0,teamCapacity(world));
    // Bosses and weapons use pilot.hp to decide whether a pilot can act.
    world.player.hp=world.wingman.hp=world.teamHp;
  }
  function damage(lexical=false,p=sim.player,amount=1,collision=false) {
    if(p.hp<=0)return;
    if(!lexical && ((!collision && p.grace>0) || p.phase>0 || p.barrier>0))return;
    if(!lexical && pilots().some(ally=>ally!==p && ally.hp>0 && ally.barrier>0 && Math.abs(p.x-ally.x)<62 && p.y>=ally.y && p.y-ally.y<=144))return;
    if(!lexical && p.guard){p.guard=false;if(!collision)p.grace=.9;return;}
    const curShields = sim.wingman ? (sim.teamShield || 0) : (p.shields || 0);
    if(curShields > 0) {
      const absorbed = Math.min(curShields, amount);
      if(sim.wingman) {
        sim.teamShield = Math.max(0, sim.teamShield - absorbed);
        sim.player.shields = sim.wingman.shields = sim.teamShield;
      } else {
        p.shields = Math.max(0, p.shields - absorbed);
      }
      amount -= absorbed;
      burst(p.x, p.y, '#38bdf8', 14);
      if(!collision)p.grace = 0.4;
      if(amount === 0) {
        note(sim.wingman ? 'TEAM SHIELD DEFLECTED' : 'SHIELD DEFLECTED', '#38bdf8', 1.0);
        return;
      }
    }
    const hullDamage = amount;
    if(sim.wingman) {
      setTeamHealth(sim, sim.teamHp - hullDamage);
      sim.weaponLevel = Math.max(1, sim.weaponLevel - hullDamage);
      for(const pilot of pilots()) pilot.level = Math.max(1, pilot.level - hullDamage);
    } else {
      p.hp = Math.max(0, p.hp - hullDamage);
      p.level = Math.max(1, p.level - hullDamage);
      sim.weaponLevel = p.level;
    }
    if(!collision)p.grace = 1.5;


    burst(p.x,p.y,'#ff8d79'); sim.hitFlash=.35;
    sound('explosion');
    if(pilots().every(pilot=>pilot.hp===0)) end();
  }
  function hitWord(e,amount,pilot) {
    if(e.hp<=0 || e.action===2 || sim.phase!=='match') return;
    e.hp=Math.max(0,e.hp-amount); e.flash=.11; sound('impact');
    burst(e.x,e.y+14,roleColors[e.role],4);
    if(e.hp) return;
    sound('explosion');
    burst(e.x,e.y,roleColors[e.role],23);
    if(sim.pair.has(e.word)) {
      pilot.correct=(pilot.correct||0)+1;e.selected=true; sim.found.push(e.word); sim.correct++; sim.score+=100;
      if(sim.found.length===2) completeRow();
      else note(e.word.toUpperCase()+'  ·  FIND ITS SYNONYM','#8ff6c1',2.8);
    } else {
      sim.wrong++; sim.clean=false; sound('wrong');
      note(e.word.toUpperCase()+'  ·  INCORRECT   −1 HULL','#ff9c91');
      damage(true,pilot);
    }
  }
  function useSkill() {
    if(!sim || sim.state!=='active' || !['match','capital','core'].includes(sim.phase) || coop?.connected===false)return;
    if(coop?.role==='guest'){coop.skill++;sendControls();return;}
    activateSkill(sim.player,sim.ship);
  }
  function activateSkill(p,ship) {
    if(command('skill',p===sim.player?0:1))return;
    if(beltActive() || p.hp<=0 || p.cooldown>0)return;
    p.cooldown=hulls[ship].cooldown; sound('skill');
    if(ship==='kestrel') sim.slow=3.8;
    if(ship==='spectre') p.phase=2.8;
    if(ship==='aegis') p.barrier=4.3;
    if(ship==='tempest') {
      for(const b of sim.hostiles) burst(b.x,b.y,'#b9a2ff',5);
      sim.hostiles=[];  sim.pulse=.55;
    }
    note(hulls[ship].skill,'#a6e8ff');
  }
  function makeHazard(x,y,angle,speed,type='bolt') {
    if(type==='missile') sound('missile');
    else if(type==='bolt' || type==='bullet' || type==='beam') sound('enemyShot');
    const hazard={x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,type,
      speed,life:type==='missile'?4.6:6,lock:type==='missile'?1.6:0};
    if(sim.boss) hazard.flightId=sim.boss.shotSerial=(sim.boss.shotSerial||0)+1;
    sim.hostiles.push(hazard);return hazard;
  }
  function advanceHoundMissile(h,dt) {
    const seat = h.targetSeat === 1 ? sim.wingman : sim.player;
    const pilot = seat?.hp > 0 ? seat : nearestPilot(h.x,h.y);
    let remaining = dt;
    while (remaining > 1e-8 && h.life > 0) {
      let step = remaining;
      let angle = Math.atan2(h.vy,h.vx);
      let turnRate = 0;
      const arcEnd = h.houndArcTime || .48;
      const homingEnd = arcEnd + Math.min(1, h.houndHomingTime ?? 1);
      if (h.houndKind === 'arc' && h.houndAge < arcEnd) {
        step = Math.min(step,arcEnd-h.houndAge);
        angle += h.houndSide * 2.1 * step;
      } else if (h.houndKind === 'arc' && h.houndAge < homingEnd) {
        step = Math.min(step,homingEnd-h.houndAge);
        turnRate = 1.65;
      } else if (h.houndKind === 'persistent') {
        turnRate = 2.2;
      }
      if (h.houndKind === 'child' && h.seeker && h.houndAge < .5) {
        step = Math.min(step, .5 - h.houndAge);
        turnRate = 1.8;
      }
      if (turnRate) {
        const diff = Math.atan2(pilot.y-h.y,pilot.x-h.x)-angle;
        angle += clamp(Math.atan2(Math.sin(diff),Math.cos(diff)),-turnRate*step,turnRate*step);
      }
      h.vx = Math.cos(angle)*h.speed;
      h.vy = Math.sin(angle)*h.speed;
      if (h.houndKind === 'child' && h.laneOffset !== undefined && !h.seeker) {
        const age = h.houndAge + step;
        const spread = Math.min(1,age/.35);
        const laneX = h.splitX + h.laneOffset*spread*(2-spread) + 9*Math.sin(age*7);
        h.vx=(laneX-h.x)/step;
        h.vy=h.speed;
      }
      h.x += h.vx*step;
      h.y += h.vy*step;
      h.houndAge += step;
      remaining -= step;
      if (h.houndKind === 'persistent') {
        if (h.x<20 || h.x>WIDTH-20) h.vx = h.x<20 ? Math.abs(h.vx) : -Math.abs(h.vx);
        if (h.y<20 || h.y>HEIGHT-20) h.vy = h.y<20 ? Math.abs(h.vy) : -Math.abs(h.vy);
        h.x=clamp(h.x,20,WIDTH-20);
        h.y=clamp(h.y,20,HEIGHT-20);
      } else {
        h.life -= step;
      }
      if (h.houndKind === 'mother' && h.houndAge >= h.houndSplitAt) {
        h.life=0;
        miniBlast(h.x,h.y,30);
        for (let slot=0;slot<6;slot++) {
          const child=makeHazard(h.x,h.y,Math.PI/2,h.speed*1.5,'missile');
          Object.assign(child,{houndKind:'child',houndAge:0,houndSide:h.houndSide,
            seeker:(h.seekerSlots || []).includes(slot),splitX:h.x,laneOffset:(slot-2.5)*37,
            lock:0,bossIndex:3,skillIndex:2,targetSeat:h.targetSeat});
          if(child.seeker){
            const bearing=Math.atan2(pilot.y-h.y,pilot.x-h.x)+(slot-2.5)*.22;
            child.vx=Math.cos(bearing)*child.speed;
            child.vy=Math.sin(bearing)*child.speed;
          }
        }
      }
    }
  }
  function launch(e) {
    const p=nearestPilot(e.x,e.y);
    const a=Math.atan2(p.y-e.y,p.x-e.x);
    // Later squadrons upgrade their guns independently of the displayed synonym.
    if(e.role==='tracker'){
      makeHazard(e.x,e.y+20,a,178,'missile');
      if(e.tier>=3 && sim.wave%10>=5)makeHazard(e.x+12,e.y+20,a+.26,156,'missile');
    }
    else if(e.role==='guardian') {
      for(const d of (e.tier>=3?[-.65,-.44,-.27,.27,.44,.65]:[-.44,-.27,.27,.44])) makeHazard(e.x,e.y+18,a+d,168);
    } else if(e.role==='scout') {
      makeHazard(e.x,e.y+14,a,225);
      makeHazard(e.x,e.y+14,a+.18,210);
      if(e.tier>=2 && sim.wave%10>=5)makeHazard(e.x,e.y+14,a-.21,210);
    } else { e.action=2; e.actionTime=0; }
  }
  function drift(e,dt) {
    e.driftPhase+=e.driftRate*dt;
    const threat=sim.shots.find(shot=>shot.y>e.y+26 && shot.y<e.y+210 && Math.abs(shot.x-e.x)<25);
    const nudge=threat ? (e.x>=threat.x ? 7 : -7) : 0;
    e.dodge+=(nudge-e.dodge)*(1-Math.exp(-4*dt));
    const settling=1-Math.exp(-5*dt);
    const targetX=e.tx+12*Math.sin(e.driftPhase)+e.dodge;
    const targetY=ROW_Y+4*Math.cos(e.driftPhase*1.32);
    e.x+=(targetX-e.x)*settling;
    e.y+=(targetY-e.y)*settling;
  }
  function advanceDive(e) {
    const dive=e.dive;
    const outward=e.actionTime<=1;
    const t=outward ? e.actionTime : Math.min(1,(e.actionTime-1)/1.15);
    const u=t*t*(3-2*t);
    const progress=outward ? u : 1-u;
    e.x=dive.fromX+(dive.x-dive.fromX)*progress;
    e.y=ROW_Y+(dive.y-ROW_Y)*progress;
    if(!outward && t>=1){e.action=0;e.dive=null;}
  }
  function ramFormation(f,staged) {
    if(!f)return;
    for(const e of f.ships){
      if(!e.hp || e.visible===false || e.x<0 || e.y<0 || e.x>WIDTH || e.y>HEIGHT)continue;
      if(e.action===2 && e.dive){
        for(const [side,pilot] of pilots().entries()){
          const hit=1<<side;
          if(pilot.hp<=0 || distance(e,pilot)>(staged?26:35) || (e.dive.contactMask & hit))continue;
          // Sustained overlap is one hit per pilot for this dive.
          e.dive.contactMask=(e.dive.contactMask || 0)|hit;
          damage(false,pilot,1,true);
          if(sim.state!=='active')return;
        }
        continue;
      }
      const pilot=nearestPilot(e.x,e.y);
      if(pilot.hp<=0 || distance(e,pilot)>(staged?26:35))continue;
      e.hp=0;e.action=0;e.dive=null;
      miniBlast(e.x,e.y,65);burst(e.x,e.y,'#ff9957',16);sound('impact');
      // A replacement must carry an unanswered target so the vocabulary row stays solvable.
      if(f.pair.has(e.word))e.reinforceAfter=.9;
      damage(false,pilot,1,true);
      if(sim.state!=='active')return;
    }
  }
  function updateRow(dt) {
    if(sim.phase==='boss-explosion'){
      if(sim.phaseTime>.7){sim.phase='core-drop';sim.phaseTime=0;}
      return;
    }
    if(sim.phase==='core-drop'){updateCore(dt);return;}
    if(sim.phase==='reward'){
      if(sim.phaseTime>=1.6){
        sim.phase='dialogue';sim.line=0;sim.phaseTime=0;resetInput();checkpoint();
      }
      return;
    }
    if(sim.phase==='dialogue' || sim.phase==='briefing' || sim.phase==='dock-shop')return;
    const motion=sim.slow>0?.46:1;
    if(['arrival','match','chain'].includes(sim.phase)){
      sim.fleetClock-=dt;
      if(sim.fleetClock<=0 && sim.phase!=='chain'){
        sim.fleetClock=fleetPeriod();fleetArrival();
        if(sim.state!=='active')return;
      }
      advanceReserves(dt);
    }
    if(sim.phase==='arrival') {
      updateArrival(dt);
    } else if(sim.phase==='capital' || sim.phase==='capital-arrival'){
      updateCapital(dt);
    } else if(sim.phase==='capital-clear'){
      if(sim.phaseTime>=1.5){sim.capital=null;newRow();}
    } else if(sim.phase==='match') {
      for(const e of sim.row){
        if(e.reinforceAfter===undefined)continue;
        e.reinforceAfter-=dt;
        if(e.reinforceAfter<=0){
          delete e.reinforceAfter;
          Object.assign(e,{hp:e.maxHp,x:e.tx,y:-32,action:0,dive:null});
        }
      }
      sim.enemyBeat-=dt*motion;
      if(sim.enemyBeat<=0) {
        const ready=sim.row.filter(e=>e.hp && !e.action);
        if(ready.length) {
          const e=ready[Math.floor(window.SpaceFlightRandom()*ready.length)];
          e.action=1; e.actionTime=0;
          if(e.role==='diver') {
            const pilot=nearestPilot(e.x,e.y);
            e.dive={fromX:e.x,x:pilot.x,y:pilot.y,contacted:false};
          }
        }
        sim.enemyBeat=Math.max(1.5,3.2-sim.wave*.035);
      }
      for(const e of sim.row) {
        if(!e.hp) continue;
        e.flash=Math.max(0,e.flash-dt);
        if(!e.dive) drift(e,dt*motion);
        if(!e.action) continue;
        e.actionTime+=dt*motion;
        if(e.action===1 && e.actionTime>.7) { e.action=0; launch(e); }
        else if(e.action===2) advanceDive(e);
      }
    } else if(sim.phase==='chain') {
      for(const e of sim.row) {
        if(!e.popped && sim.phaseTime>e.popAt) {
          e.popped=true; burst(e.tx,ROW_Y,'#ffcb7d',22);
        }
      }
      if(sim.phaseTime>1.25) {
        if(sim.cleared%ROWS_PER_BOSS===0)beginBoss(sim.cleared/ROWS_PER_BOSS);
        else if(capitalAfter(sim.wave))beginCapital();
        else if(sim.reserve.length || sim.fleetClock<=0){if(sim.fleetClock<=0)sim.fleetClock=fleetPeriod();newRow();}
      }
    } else if(sim.phase==='core') {
      if(sim.boss.impacts?.length){
        sim.boss.impacts=sim.boss.impacts.filter(hit=>sim.time-hit.start<0.34);
      }
      window.SpaceBosses.update(sim.boss,[4,5].includes(sim.boss.index)?dt:dt*motion,bossAPI());
      if(sim.boss.index===5 && sim.boss.hp<=0)releaseCore();
    }
  }
  function hitBoss(id,amount,impactX,impactY){
    const boss=sim.boss;
    if(!boss)return;
    const before=boss.hp;
    window.SpaceBosses.hit(boss,id,amount,bossAPI());
    if(boss.hp<=0){releaseCore();return;}
    if(boss.hp>=before)return;
    sound('impact');
    const xs=window.SpaceBosses.hulls?.(boss)||[boss.x];
    const x=Number.isFinite(impactX)?impactX:boss.x;
    const y=Number.isFinite(impactY)?impactY:boss.y+20;
    const seat=xs.length===2 && Math.abs(x-xs[1])<Math.abs(x-xs[0])?1:0;
    // Coordinates stay attached to the struck hull, including twins that cross over.
    const impacts=boss.impacts||(boss.impacts=[]);
    if(impacts.length>=12)impacts.shift();
    impacts.push({start:sim.time,seat,dx:x-xs[seat],dy:y-boss.y,before,after:boss.hp});
  }
  function fireSalvo(p,owner) {
    const level=clamp(p.level,1,gunPeriod.length);
    const count=level%2===0?2:1;
    sim.volleySerial=(sim.volleySerial||0)+1;
    for(let lane=0;lane<count;lane++){
      const offset=count===1?0:(lane===0?-6:6);
      const totalDamage=weaponSalvoDamage[level-1];
      sim.shots.push({x:p.x+offset,y:p.y-30,level,owner,lane,volley:sim.volleySerial,damage:totalDamage/count});
    }
  }
  function miniBlast(x,y,size) {
    const hits=sim.miniBlasts ||= [];
    hits.push({x,y,size,start:sim.time});
  }
  function updateShots(dt) {
    const shots=sim.shots; // A row transition discards every projectile from the previous row.
    const rise=dt*840;
    if(rise<=0)return;
    for(const shot of shots) {
      if(sim.shots!==shots) break;
      const startX=shot.x,startY=shot.y,stepX=(shot.vx||0)*dt;
      function xAt(fraction){
        const x=startX+stepX*fraction;
        if(!stepX || !Number.isFinite(shot.stopX))return x;
        return stepX>0?Math.min(x,shot.stopX):Math.max(x,shot.stopX);
      }
      let contact=null,first=Infinity;
      function check(type,obj,w,h) {
        // Sweep to the earliest impact; converging rounds may also enter via a side edge.
        let enter=Math.max(0,(startY-obj.y-h)/rise);
        const exit=Math.min(1,(startY-obj.y+h)/rise);
        if(enter>exit)return;
        const left=obj.x-w,right=obj.x+w;
        if(xAt(enter)<left){
          if(xAt(exit)<left)return;
          enter=(left-startX)/stepX;
        }else if(xAt(enter)>right){
          if(xAt(exit)>right)return;
          enter=(right-startX)/stepX;
        }
        if(enter<first){first=enter;contact={type,obj};}
      }
      for(const m of sim.hostiles)if(m.type==='missile' && m.life>0)check('missile',m,16,18);
      if(sim.phase==='match')for(const e of sim.row){
        if(e.hp && (shot.wordLock===undefined || shot.wordLock===e.word))check('word',e,37,26);
      }
      if(sim.phase==='capital')for(const turret of sim.capital.turrets)if(turret.hp>0)check('turret',turret,32,25);
      if(sim.phase==='core' && sim.boss)for(const part of window.SpaceBosses.targets(sim.boss))check('boss',part,part.w,part.h);
      shot.x=xAt(contact?first:1);shot.y=startY-rise*(contact?first:1);
      if(shot.x===shot.stopX)shot.vx=0;
      if(contact){
        shot.dead=true;
        const {type,obj}=contact, amount=shot.damage??shot.level;
        if(type==='word'){
          // One trigger pull may select only one vocabulary answer, even when ships overlap.
          if(shot.volley!==undefined && shot.wordLock===undefined){
            for(const sibling of shots)if(sibling.volley===shot.volley && sibling.owner===shot.owner)sibling.wordLock=obj.word;
          }
          hitWord(obj,amount,shot.owner===1?sim.wingman:sim.player);
          miniBlast(shot.x,shot.y,24);
        }else if(type==='boss'){
          hitBoss(obj.id,amount,shot.x,shot.y);
        }else if(type==='turret'){
          hitTurret(obj,amount);
          miniBlast(shot.x,shot.y,28);
        }else{
          obj.life=0;
          if(sim.missileBonus<3){sim.score+=40;sim.missileBonus++;}
          sound('explosion');burst(obj.x,obj.y,'#ffc47c',14);
          miniBlast(shot.x,shot.y,26);
        }
      }
      if(sim.state!=='active')return;
    }
    sim.shots=sim.shots.filter(s=>!s.dead && s.y>-12);
  }
  function getControlMode() {
    if (window.SpaceControlsMode && ['mouse','keyboard','both'].includes(window.SpaceControlsMode)) {
      return window.SpaceControlsMode;
    }
    try {
      const val = JSON.parse(localStorage.getItem('space_dominators_pilot_v1'))?.controls;
      if (['mouse','keyboard','both'].includes(val)) return val;
    } catch {}
    return 'both';
  }
  function readControls() {
    const ctrl = getControlMode();
    let dx = 0, dy = 0;
    if (ctrl !== 'mouse') {
      dx = Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
      dy = Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
    }
    let aim = ctrl !== 'keyboard' ? target : null;
    if (dx || dy) {
      target = null;
      aim = null;
    }
    return {dx, dy, target: aim, fire: keys.has('Space')||pointerFire, skill: coop?.skill||0};
  }
  function advancePilot(p,input,dt,owner) {
    if(!p.hp)return;
    for(const k of ['grace','phase','barrier','cooldown','gun'])p[k]=Math.max(0,p[k]-dt);
    if(beltActive())return;
    const pinned=sim.phase==='core' && sim.boss?.miner?.tether?.seat===owner;
    const {dx,dy,target:aim}=pinned ? {dx:0,dy:0,target:null} : input;
    const speed=hulls[p.ship].speed;
    if(dx||dy){
      const step=speed*dt/Math.hypot(dx,dy);p.x+=dx*step;p.y+=dy*step;
    }else if(aim){
      const len=distance(p,aim),ratio=len?Math.min(1,speed*dt/len):0;
      p.x+=(aim.x-p.x)*ratio;p.y+=(aim.y-p.y)*ratio;
    }
    p.x=clamp(p.x,28,WIDTH-28);p.y=clamp(p.y,42,HEIGHT-42);
    if(input.fire && !p.gun && ['match','core','capital'].includes(sim.phase)){
      fireSalvo(p,owner);
      p.gun=gunPeriod[p.level-1];sound('shoot');
    }
  }
  function tick(dt) {
    const p=sim.player;
    sim.time+=dt;sim.phaseTime+=dt;sim.upgradeFlash=Math.max(0,sim.upgradeFlash-dt);sim.slow=Math.max(0,sim.slow-dt);
    sim.hitFlash=Math.max(0,sim.hitFlash-dt);sim.pulse=Math.max(0,sim.pulse-dt);
    if(sim.miniBlasts?.length)sim.miniBlasts=sim.miniBlasts.filter(hit=>sim.time-hit.start<.18);
    if(sim.message) sim.message.time-=dt;
    if(sim.phase==='cinematic'){
      const previous=sim.phaseTime-dt;
      for(const [at,cue] of window.SpaceCampaign.audioCues) {
        if(previous<at && sim.phaseTime>=at)sound(cue);
      }
      if(sim.phaseTime>=window.SpaceCampaign.duration){sim.phase='arrival';sim.phaseTime=0;}
      return;
    }
    if(sim.phase==='dialogue' || sim.phase==='briefing' || sim.phase==='dock-shop')return;
    advancePilot(p,streamStep?.controls[0]||readControls(),dt,0);
    if(sim.wingman)advancePilot(sim.wingman,streamStep?.controls[1]||coop.remote,dt,1);
    updateRow(dt);
    if(sim.state==='active' && (sim.phase==='arrival' || sim.phase==='match'))ramFormation(sim.formation,false);
    for(const f of sim.reserve)if(sim.state==='active')ramFormation(f,true);
    if(sim.state!=='active') return;
    updateShots(dt);
    updateDrops(dt);
    if(sim.state!=='active') return;
    const hdt=dt*(sim.slow>0?.46:1);
    for(let i=0, count=sim.hostiles.length;i<count;i++) {
      const h=sim.hostiles[i];
      if(h.life<=0) continue;
      if(h.houndKind) {
        if(h.houndKind==='persistent'){
          // Use active game time so a pilot's slow field affects steering only.
          h.fuseRemaining=Math.max(0,(h.fuseRemaining ?? (4-h.houndAge))-dt);
        }
        advanceHoundMissile(h,hdt);
        if(h.houndKind==='persistent' && h.fuseRemaining<=1e-8){
          h.life=0;
          miniBlast(h.x,h.y,34);
        }
        if(h.life<=0) continue;
      } else {
        h.life-=hdt;
        if(h.lock>0) {
          h.lock-=hdt;const current=Math.atan2(h.vy,h.vx);
          const aim=nearestPilot(h.x,h.y);
          const desired=Math.atan2(aim.y-h.y,aim.x-h.x);
          const diff=Math.atan2(Math.sin(desired-current),Math.cos(desired-current));
          const a=current+clamp(diff,-1.3*hdt,1.3*hdt);
          h.vx=Math.cos(a)*h.speed;h.vy=Math.sin(a)*h.speed;
        }
        if(h.bossIndex) window.SpaceEncounterEngine?.steerHazard?.(h,hdt);
        h.x+=h.vx*hdt;h.y+=h.vy*hdt;
      }
      const contact=nearestPilot(h.x,h.y);
      if(distance(h,contact)<(h.type==='debris'?30:h.type==='missile'?22:17)) {h.life=0;damage(false,contact);}
      if(sim.state!=='active') return;
    }
    sim.hostiles=sim.hostiles.filter(h=>h.life>0 && h.x>-30 && h.x<WIDTH+30 && h.y<HEIGHT+30);
    for(const b of sim.particles) {b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;}
    sim.particles=sim.particles.filter(b=>b.life>0);
  }
  function text(s,x,y,color,size=17,align='center',bold=false) {
    ctx.font=(bold?'700 ':'500 ')+size+'px system-ui, sans-serif';
    ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(s,x,y);
  }
  function rectangle(x,y,w,h,fill) {ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);}
  function line(x1,y1,x2,y2,color,width=1) {
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  }
  function ring(x,y,r,color,width=1) {
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
  }
  function sprite(id,x,y,w,h) {
    window.SpaceArt.draw(ctx,id,x,y,w,h,Math.floor(sim.time*8)%4);
  }
  const tierColors=['#8ee7d7','#ffc778','#f695c4','#c4b0ff'];
  function entryMark(x,y){
    ctx.save();
    ctx.shadowColor='#ff333c';ctx.shadowBlur=7;
    text('!',x,y,'#ff474e',31,'center',true);
    ctx.restore();
  }
  function spawnShieldDrop(x,y){
    sim.drops=sim.drops||[];
    const angle=window.SpaceFlightRandom()*Math.PI*2,speed=110+window.SpaceFlightRandom()*60;
    sim.drops.push({id:'drop-'+(sim.runId||'run')+'-'+(++sim.dropSerial||(sim.dropSerial=1)),
      x:clamp(x,40,WIDTH-40),y:clamp(y,40,HEIGHT-40),vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,radius:16,age:0});
  }
  function updateDrops(dt){
    if(!sim.drops?.length)return;
    for(const d of sim.drops){
      d.age+=dt;d.x+=d.vx*dt;d.y+=d.vy*dt;
      const minX=24,maxX=WIDTH-24,minY=28,maxY=HEIGHT-28;
      if(d.x<minX){d.x=minX;d.vx=Math.abs(d.vx);}else if(d.x>maxX){d.x=maxX;d.vx=-Math.abs(d.vx);}
      if(d.y<minY){d.y=minY;d.vy=Math.abs(d.vy);}else if(d.y>maxY){d.y=maxY;d.vy=-Math.abs(d.vy);}
      for(const p of pilots()){
        if(p.hp<=0)continue;
        if(Math.hypot(p.x-d.x,p.y-d.y)<38){
          d.collected=true;
          if(sim.wingman){
            sim.teamShield=Math.min(4,(sim.teamShield||0)+1);
            sim.player.shields=sim.wingman.shields=sim.teamShield;
          }else{
            p.shields=Math.min(2,(p.shields||0)+1);
          }
          burst(d.x,d.y,'#38bdf8',18);sound('skill');note('SHIELD RECHARGED +1','#38bdf8',1.5);
          break;
        }
      }
    }
    sim.drops=sim.drops.filter(d=>!d.collected);
  }
  function drawDrops(time){
    if(!sim.drops?.length)return;
    for(const d of sim.drops){
      ctx.save();ctx.translate(d.x,d.y);
      const pulse=1+0.12*Math.sin(time*6+d.age*4);
      ctx.shadowColor='#38bdf8';ctx.shadowBlur=10;ctx.fillStyle='#0c4a6e';
      ctx.beginPath();ctx.arc(0,0,16*pulse,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#38bdf8';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='#38bdf8';
      ctx.beginPath();ctx.moveTo(0,-9*pulse);ctx.lineTo(8*pulse,-4*pulse);ctx.lineTo(6*pulse,6*pulse);ctx.lineTo(0,10*pulse);ctx.lineTo(-6*pulse,6*pulse);ctx.lineTo(-8*pulse,-4*pulse);ctx.closePath();ctx.fill();
      ctx.fillStyle='#f0fdfa';
      ctx.beginPath();ctx.moveTo(0,-5*pulse);ctx.lineTo(4*pulse,-2*pulse);ctx.lineTo(3*pulse,3*pulse);ctx.lineTo(0,6*pulse);ctx.lineTo(-3*pulse,3*pulse);ctx.lineTo(-4*pulse,-2*pulse);ctx.closePath();ctx.fill();
      ctx.restore();
      text('SHIELD',d.x,d.y+24,'#38bdf8',10,'center',true);
    }
  }
  function openDockShop(){
    sim.phase='dock-shop';sim.phaseTime=0;sim.hostiles=[];sim.shots=[];
    resetInput();checkpoint();
    if(coop?.role==='host')sendBaseline();
  }
  function executeDockShopBuy(){
    const curShields=sim.wingman?(sim.teamShield||0):(sim.player.shields||0);
    const maxShields=sim.wingman?4:2;
    if((sim.credits||0)>=100 && curShields<maxShields){
      sim.credits-=100;saveProfileCredits(sim.credits);
      if(sim.wingman){
        sim.teamShield=Math.min(4,(sim.teamShield||0)+1);
        sim.player.shields=sim.wingman.shields=sim.teamShield;
      }else{
        sim.player.shields=Math.min(2,(sim.player.shields||0)+1);
      }
      burst(WIDTH/2,HEIGHT/2,'#38bdf8',25);sound('skill');note('SHIELD REFILLED +1','#38bdf8',1.6);
      checkpoint();
    }
  }
  function executeDockShopLeave(){
    sim.shopVisited=true;newRow();checkpoint();
  }
  function buyDockShield(){
    if(sim?.phase!=='dock-shop'||sim?.state!=='active')return;
    const curShields=sim.wingman?(sim.teamShield||0):(sim.player.shields||0);
    const maxShields=sim.wingman?4:2;
    if((sim.credits||0)<100 || curShields>=maxShields)return;
    if(coop?.role==='guest'){coop.send('shop-buy',{});return;}
    if(command('shop-buy'))return;
    executeDockShopBuy();
  }
  function leaveDockShop(){
    if(sim?.phase!=='dock-shop'||sim?.state!=='active')return;
    if(coop?.role==='guest'){coop.send('shop-leave',{});return;}
    if(command('shop-leave'))return;
    executeDockShopLeave();
  }
  function handleDockShopClick(e){
    if(sim?.phase!=='dock-shop')return;
    const r=canvas.getBoundingClientRect();
    if(!r.width||!r.height)return;
    const mx=(e.clientX-r.left)*WIDTH/r.width,my=(e.clientY-r.top)*HEIGHT/r.height;
    if(mx>=370 && mx<=590 && my>=460 && my<=515)buyDockShield();
    else if(mx>=610 && mx<=900 && my>=460 && my<=515)leaveDockShop();
  }
  function drawDockShop(time){
    const curShields=sim.wingman?(sim.teamShield||0):(sim.player.shields||0);
    const maxShields=sim.wingman?4:2,canBuy=(sim.credits||0)>=100 && curShields<maxShields;
    const sector=Math.floor(sim.cleared/20);
    ctx.save();
    rectangle(220,110,WIDTH-440,480,'rgba(7, 18, 32, 0.96)');
    ctx.strokeStyle='#2b4d66';ctx.lineWidth=2;ctx.strokeRect(220,110,WIDTH-440,480);
    rectangle(220,110,WIDTH-440,4,'#38bdf8');
    text('OUTPOST DOCK SHOP  ·  SECTOR '+sector,WIDTH/2,146,'#7dd3fc',20,'center',true);
    text('Fleet restock outpost reached. Replenish defensive shields before the next wave.',WIDTH/2,174,'#94a3b8',13,'center');
    rectangle(260,196,WIDTH-520,78,'rgba(15, 29, 48, 0.8)');
    ctx.strokeStyle='#203a54';ctx.lineWidth=1;ctx.strokeRect(260,196,WIDTH-520,78);
    text('PILOT WALLET',320,218,'#ffd67a',11,'left',true);
    text('🪙 '+(sim.credits||0).toLocaleString('en-US')+' CREDITS',320,246,'#ffd67a',19,'left',true);
    const hullMax=sim.wingman?teamCapacity(sim):hulls[sim.player.ship].hp,curHp=sim.wingman?sim.teamHp:sim.player.hp;
    text(sim.wingman?'TEAM HULL (LOCKED)':'HULL ARMOR (LOCKED)',530,218,'#94a3b8',11,'left',true);
    text(curHp+' / '+hullMax+' HP  [NO RUNTIME HEALS]',530,246,'#cbd5e1',14,'left',true);
    text(sim.wingman?'TEAM DEF SHIELD':'DEFENSIVE SHIELDS',820,218,'#38bdf8',11,'left',true);
    text(curShields+' / '+maxShields+' SHIELD'+(curShields>=maxShields?' (FULL)':''),820,246,'#7dd3fc',16,'left',true);
    rectangle(360,292,WIDTH-720,148,'rgba(12, 36, 58, 0.7)');
    ctx.strokeStyle=canBuy?'#38bdf8':'#274763';ctx.lineWidth=1.5;ctx.strokeRect(360,292,WIDTH-720,148);
    ctx.save();ctx.translate(420,366);
    ctx.fillStyle='#0c4a6e';ctx.beginPath();ctx.arc(0,0,26,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#38bdf8';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#38bdf8';ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(13,-7);ctx.lineTo(10,10);ctx.lineTo(0,16);ctx.lineTo(-10,10);ctx.lineTo(-13,-7);ctx.closePath();ctx.fill();
    ctx.fillStyle='#f0fdfa';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(6,-4);ctx.lineTo(4,5);ctx.lineTo(0,9);ctx.lineTo(-4,5);ctx.lineTo(-6,-4);ctx.closePath();ctx.fill();
    ctx.restore();
    text('DEFENSIVE SHIELD REFILL (+1 SHIELD POINT)',470,330,'#f1f5f9',15,'left',true);
    text('Absorbs projectile & collision damage without reducing weapon tier.',470,354,'#94a3b8',12,'left');
    text('Cost: 100 Credits  ·  Refills up to capacity ('+maxShields+' max)',470,378,'#ffd67a',13,'left',true);
    const shopStatus=curShields>=maxShields?'SHIELDS AT MAXIMUM CAPACITY':(sim.credits||0)<100?'INSUFFICIENT CREDITS (NEED 100)':'READY FOR REFILL';
    text(shopStatus,470,404,canBuy?'#4ade80':'#f87171',12,'left',true);
    rectangle(370,462,220,48,canBuy?'#0284c7':'#1e293b');
    ctx.strokeStyle=canBuy?'#38bdf8':'#334155';ctx.lineWidth=2;ctx.strokeRect(370,462,220,48);
    text('[1] REFILL SHIELD (100 CR)',480,486,canBuy?'#ffffff':'#64748b',13,'center',true);
    rectangle(610,462,290,48,'#0f293a');
    ctx.strokeStyle='#38bdf8';ctx.lineWidth=2;ctx.strokeRect(610,462,290,48);
    text('[2] DEPART DOCK · WAVE '+(sim.cleared+1),755,486,'#affbe9',13,'center',true);
    text('PRESS [1] OR CLICK TO REFILL  ·  PRESS [2] / ENTER TO DEPART',WIDTH/2,545,'#64748b',12,'center');
    ctx.restore();
  }
  function warnFormation(f){
    if(!f || f.ready)return;
    const marks=new Map();
    f.ships.forEach((e,i)=>{
      const elapsed=f.age-e.delay;
      if(!e.hp || elapsed<-.66 || elapsed>.5)return;
      if(f.route==='overhead'){
        const x=WIDTH/2+(i%2?1:-1)*210;
        marks.set(x,[x,24]);
      }else{
        const side=f.route==='pincer' && i%2 ? -f.sign : f.sign;
        const x=f.route==='convoy'?WIDTH/2+side*490:(side<0?24:WIDTH-24);
        marks.set(x,[x,f.route==='pincer'?265:HEIGHT-24]);
      }
    });
    for(const [x,y] of marks.values())entryMark(x,y);
  }
  function drawStaging() {
    if(!sim.reserve.length)return;
    ctx.save();
    ctx.globalAlpha=.53;
    for(const f of sim.reserve)for(const e of f.ships) {
      if(!e.hp || e.visible===false) continue;
      sprite(e.role,e.x,e.y+3*Math.sin(e.driftPhase*1.4),46,37);
    }
    ctx.restore();
  }
  function drawCapital() {
    const cap=sim.capital;
    if(!cap) return;
    const clear=sim.phase==='capital-clear';
    ctx.save();
    if(clear) ctx.globalAlpha=Math.max(.12,1-sim.phaseTime*.65);
    window.CapitalArt.drawHull(ctx,cap.x,cap.y,430,130);
    for(const turret of cap.turrets) {
      const angle=turret.warning>0 ? turret.aim : Math.atan2(sim.player.y-turret.y,sim.player.x-turret.x);
      window.CapitalArt.drawTurret(ctx,turret.x,turret.y,48,angle,turret.hp<=0);
      if(turret.hp<=0 || sim.phase==='capital-arrival') continue;
      if(turret.warning>0) {
        const dx=Math.cos(angle),dy=Math.sin(angle);
        ctx.setLineDash([6,8]);
        line(turret.x+dx*23,turret.y+dy*23,turret.x+dx*185,turret.y+dy*185,'rgba(255,174,91,.8)',2);
        ctx.setLineDash([]);
        ring(turret.x,turret.y,29,'rgba(255,191,108,.8)',1);
      }
      if(turret.flash>0)ring(turret.x,turret.y,24,'#fff4cf',2);
      rectangle(turret.x-19,turret.y+28,38,3,'#423749');
      rectangle(turret.x-19,turret.y+28,38*turret.hp/turret.maxHp,3,'#ffd49a');
    }
    ctx.restore();
  }
  function paintFire(x,y,size,progress) {
    if(window.SpaceBossFX?.drawBlast?.(ctx,x,y,size,progress))return;
    // Readable while the shared sprite atlas is loading or unavailable.
    for(const [scale,color] of [[.68,'#cb4929'],[.43,'#ff951e'],[.20,'#fff8aa']]){
      const r=Math.round(size*scale/2);
      ctx.fillStyle=color;
      ctx.fillRect(Math.round(x)-r,Math.round(y)-Math.round(r*.55),2*r,Math.round(r*1.1));
      ctx.fillRect(Math.round(x)-Math.round(r*.55),Math.round(y)-r,Math.round(r*1.1),2*r);
    }
  }

  function drawBossImpacts(boss,time){
    if(!boss.impacts?.length)return;
    const xs=window.SpaceBosses.hulls?.(boss)||[boss.x];
    ctx.save();
    for(const hit of boss.impacts){
      const age=time-hit.start;
      if(age<0 || age>=.34)continue;
      const progress=age/.34;
      ctx.globalAlpha=Math.min(1,(1-progress)*2);
      paintFire((xs[hit.seat]??boss.x)+hit.dx,boss.y+hit.dy-5*progress,34+8*Math.sin(progress*Math.PI),progress);
      if(age<.2){
        const dim=1-age/.2;
        const right=boss.x-92+184*clamp(hit.before/boss.max,0,1);
        const left=boss.x-92+184*clamp(hit.after/boss.max,0,1);
        ctx.fillStyle='#ffd590';
        ctx.globalAlpha=.8*dim;
        ctx.fillRect(left,30,Math.max(1,right-left),5);
        ctx.fillStyle='#fffbdb';
        ctx.fillRect(left-1,30,2,5);
      }
    }
    ctx.restore();
  }

  function createWreckShards(seed, size) {
    let s = seed | 0;
    const rnd = () => (s = (s * 1664525 + 1013904223) | 0, (s >>> 0) / 4294967296);
    const count = 10 + Math.floor(rnd() * 7); // 10-16 shards
    const shards = [];
    for (let i = 0; i < count; i++) {
      const ang = (i + rnd()) / count * Math.PI * 2;
      const spd = size * (0.65 + rnd() * 0.9);
      const vCount = 3 + (rnd() > 0.5 ? 1 : 0);
      const rBase = size * (0.018 + rnd() * 0.035);
      const pts = [];
      for (let j = 0; j < vCount; j++) {
        const a = (j / vCount) * Math.PI * 2 + (rnd() - 0.5) * 0.8;
        const r = rBase * (0.45 + rnd() * 0.85);
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      shards.push({
        ox: Math.cos(ang)*size*(.10+rnd()*.13),
        oy: Math.sin(ang)*size*(.10+rnd()*.13),
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        rot0: rnd() * Math.PI * 2,
        vrot: (rnd() - 0.5) * 16,
        life: 0.6 + rnd() * 0.45, // 0.6 to 1.05s
        pts
      });
    }
    return shards;
  }

  function drawWreckShards(ctx, x, y, shards, age) {
    for (let i = 0; i < shards.length; i++) {
      const s = shards[i];
      if (age <= 0 || age >= s.life) continue;
      const alpha = Math.max(0, 1 - age / s.life);
      const emberAlpha = Math.max(0, 1 - age / 0.32) * alpha;

      // Single faint ghost trail
      const tTrail = Math.max(0, age - 0.035);
      if (age > 0.02) {
        const tx = x + s.ox + s.vx * tTrail;
        const ty = y + s.oy + s.vy * tTrail + 16 * tTrail * tTrail;
        ctx.save();
        ctx.globalAlpha = alpha * 0.35;
        ctx.translate(tx | 0, ty | 0);
        ctx.rotate(s.rot0 + s.vrot * tTrail);
        ctx.fillStyle = '#ff4400';
        ctx.beginPath();
        s.pts.forEach(([px, py], k) => k ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
  }

      // Main metallic shard with ember edge
      const px = x + s.ox + s.vx * age;
      const py = y + s.oy + s.vy * age + 16 * age * age; // low gravity
      ctx.save();
      ctx.translate(px | 0, py | 0);
      ctx.rotate(s.rot0 + s.vrot * age);
      ctx.beginPath();
      s.pts.forEach(([qx, qy], k) => k ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy));
      ctx.closePath();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#121418';
      ctx.fill();
      ctx.strokeStyle='#55616d';ctx.lineWidth=1;ctx.stroke();
      if (emberAlpha > 0.02) {
        ctx.globalAlpha = emberAlpha;
        ctx.strokeStyle = '#ff9922';
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
      ctx.restore();
  }
  }
  let cachedWreck;
  function drawWreck(core,time){
    if(sim.bossIndex===5)return;
    // Earlier checkpoints store only the core. Continue their existing explosion timeline.
    const wreck=core.wreck;
    const age=wreck?time-wreck.start:sim.phase==='boss-explosion'?sim.phaseTime:.7+core.age;
    if(age<0 || age>=1.05)return;
    const size=wreck?.size??(sim.bossIndex===10?384:232);
    const seed=wreck?.seed??sim.bossIndex;
    const xs=wreck?.hullXs??[core.originX];
    const y=wreck?.y??core.originY;
    if(!cachedWreck || cachedWreck.id!==core.id || cachedWreck.seed!==seed){
      cachedWreck={id:core.id,seed,fields:xs.map((_,i)=>createWreckShards(seed+i*7919,size))};
    }
    for(let i=0;i<xs.length;i++){
      const x=xs[i];
      if(age<.78){
        const progress=Math.max(0,age/.78);
        ctx.save();
        if(age<.19){
          ctx.globalAlpha=(1-age/.19)*.86;
          ctx.lineWidth=4+6*(1-age/.19);
          ctx.strokeStyle='#ffe0a7';
          ctx.beginPath();ctx.arc(x,y,size*(.34+.24*age/.19),0,Math.PI*2);ctx.stroke();
        }
        ctx.globalAlpha=Math.min(1,(1-progress)*3);
        paintFire(x,y,size*(.97+.24*progress),progress);
        ctx.restore();
  }
      drawWreckShards(ctx,x,y,cachedWreck.fields[i],age);
    }
  }

  function beltActive(){
    return sim?.state==='active' && sim.phase==='core' && sim.boss?.index===5 && coop?.connected!==false;
  }
  function beltAnswer(p,word,id){
    if(command('word',p===sim.player?0:1,word,id))return 'queued';
    const result=window.SpaceBelt.submit(sim.boss,p,word,bossAPI(),id);
    return result;
  }
  function drawScene() {
    window.SpaceSound?.missileFlight?.(sim.state==='active' && sim.hostiles?.some(h=>h.type==='missile' && h.life>0));
    if(!beltActive())window.SpaceBelt.resetDraft();
    const t=sim.time;
    const stationScene=window.SpaceStationScene;
    stationScene?.frame(sim.phase,sim.phaseTime);
    if(sim.phase==='briefing'){
      window.SpaceCampaign.drawBriefingMap(ctx,sim.time,sim.line);
      drawDialogue();return;
    }
    if(sim.phase==='cinematic'){window.SpaceCampaign.draw(ctx,sim.phaseTime,sim.ship,sim.wingman?.ship,false,!!stationScene);return;}
    if(stationScene)ctx.clearRect(0,0,WIDTH,HEIGHT);
    else window.SpaceBackdrop.draw(ctx,t);
    drawMission();
    drawStaging();
    drawCapital();
    if(sim.boss){
      window.SpaceBosses.draw(ctx,sim.boss,t,coop?.role==='guest'?1:0);
      drawBossImpacts(sim.boss,t);
    }
    if(sim.core && (sim.phase==='boss-explosion'||sim.phase==='core-drop'))drawWreck(sim.core,t);

    if(sim.phase==='core-drop' && sim.core){
      const c=sim.core;
      const painted=window.SpaceCampaignSprites?.draw(ctx,12+Math.floor(c.age*8)%4,c.x,c.y,58,58);
      if(!painted){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(t*2.2);
      ctx.shadowColor='#4defe9';ctx.shadowBlur=12;
      rectangle(-13,-13,26,26,'#125561');rectangle(-9,-9,18,18,'#63e7dc');
      rectangle(-4,-4,8,8,'#fff0a6');ctx.restore();}
      text('UPGRADE CORE',c.x,c.y+32,'#abfff3',14,'center',true);
    }
    for(const e of sim.row) {
      if(sim.capital || ['core','boss-clear'].includes(sim.phase)||e.popped || e.visible===false) continue;
      const show=e.hp>0;
      if(show) {
        if(e.action===1) {
          const alpha=.25+Math.abs(Math.sin(t*10))*.5;
          ctx.globalAlpha=alpha;ring(e.x,e.y,39,roleColors[e.role],2);
          if(e.dive) {
            ctx.setLineDash([6,7]);
            line(e.x,e.y+24,e.dive.x,e.dive.y,'#ff8a70',1);
            ctx.setLineDash([]);
            ring(e.dive.x,e.dive.y,14,'#ffad90',2);
          }
          ctx.globalAlpha=1;
        }
        sprite(e.role,e.x,e.y,74,62);
        if(e.action===2 && e.y>ROW_Y+80) text(e.word,e.x,e.y-39,'#ffe6dc',15,'center',true);
        if(e.flash>0) ring(e.x,e.y,23+(1-e.flash/.11)*16,'#fff3cf',2);
      }
      if(sim.phase==='arrival' || (!show && !e.selected)) continue;
      const y=ROW_Y+46, word=e.word;
      ctx.font='700 23px system-ui, sans-serif';
      const maxWidth=Math.min(203,1050/sim.row.length), font=Math.min(23,Math.floor(23*(maxWidth-14)/Math.max(1,ctx.measureText(word).width)));
      ctx.font='700 '+font+'px system-ui, sans-serif';
      const w=Math.max(64,ctx.measureText(word).width+22);
      rectangle(e.tx-w/2,y-17,w,34,e.selected?'rgba(15,55,53,.84)':'rgba(8,20,35,.72)');
      rectangle(e.tx-w/2,y+16,w,1,e.selected?'#70f2b9':'#476178');
      text(word,e.tx,y,e.selected?'#94ffcf':'#f4f8ff',font,'center',true);
      if(show) {
        const max=e.maxHp || 3, step=Math.min(9,62/max);
        const tone=tierColors[Math.min(tierColors.length-1,(e.tier || 1)-1)];
        for(let j=0;j<max;j++) rectangle(e.tx-step*max/2+j*step,y+23,Math.max(1,step-1.5),3,j<e.hp?tone:'#273447');
      }
    }
    for(const s of sim.shots) {
      if(window.SpaceBossFX?.drawPlayerBolt?.(ctx,s,t))continue;
      const tier=Math.floor((clamp(s.level||1,1,8)-1)/2);
      const scale=1.1**tier, width=6*scale, height=20*scale;
      const color=['#75d8ff','#91ffab','#ffcc72','#e0a3ff'][tier];
      rectangle(s.x-width/2,s.y-height/2,width,height,color);
      rectangle(s.x-scale,s.y-height/2,2*scale,height*.72,'#f4ffff');
    }
    for(const h of sim.hostiles) {
      if(h.bossIndex===4 && h.skillIndex===0 && window.SpaceMinerArt?.sprite(ctx,2,h.x,h.y,16))continue;
      if(window.SpaceBossFX?.drawProjectile(ctx,h,t)) continue;
      if(h.type==='missile') {
        ctx.save();ctx.translate(h.x,h.y);ctx.rotate(Math.atan2(h.vy,h.vx)+Math.PI/2);
        rectangle(-3,2,6,14,'#ff774d');rectangle(-5,-7,10,15,'#efbd6a');
        rectangle(-2,-12,4,7,'#ffebad');rectangle(-9,3,18,5,'#cd7c59');ctx.restore();
      } else if(h.type==='debris') {
        if (!window.SpaceBackdrop.drawMeteor?.(ctx,h.x,h.y,32,h.life*.9)) {
          ctx.save();ctx.translate(h.x,h.y);ctx.rotate(h.life*.9);
          rectangle(-11,-15,22,30,'#ad765e');rectangle(-16,-8,32,15,'#df9670');
          rectangle(-6,-9,9,6,'#ffcc8d');ctx.restore();
        }
      } else {
        line(h.x,h.y,h.x-h.vx*.04,h.y-h.vy*.04,'#e6697a',5);
        rectangle(h.x-2,h.y-2,4,4,'#ffe8b0');
      }
    }
    for(const [idx,p] of pilots().entries()){
    if(!p.hp)continue;
    if(p.grace>0 && Math.floor(t*12)%2) ctx.globalAlpha=.55;
    if(p.phase>0) ctx.globalAlpha=.48;
    const hover=beltActive() || sim.boss?.miner?.tether ? 0 : 1;
    SpaceArt.draw(ctx,p.ship,p.x+hover*3*Math.sin(t*1.7+idx*2),p.y+hover*4*Math.sin(t*2.2+idx),84,80,beltActive()?-1:Math.floor(t*8));
    ctx.globalAlpha=1;
    if(sim.wingman && coop){
      const label=coop.names[idx] || (idx ? 'P2' : 'P1');
      text(label,p.x,Math.min(p.y+48,HEIGHT-12),idx?'#ffd398':'#7ef3fc',13,'center',true);
    }
    if(p.guard)ring(p.x,p.y,44,'#ffdb8a',1.5);
    const defShield = sim.wingman ? (sim.teamShield || 0) : (p.shields || 0);
    if(defShield > 0) ring(p.x, p.y, 42, '#38bdf8', 1.5);
    if(p.barrier>0 || p.phase>0) ring(p.x,p.y,40,p.barrier>0?'#71e9f3':'#b495ff',2);
    }
    if(sim.phase==='core' && sim.boss?.miner?.tether)window.SpaceMinerArt?.drawPrompt(ctx,sim.boss,pilots());
    if(sim.pulse>0) {ctx.globalAlpha=sim.pulse/.55;ring(sim.player.x,sim.player.y,(.56-sim.pulse)*2200,'#cdadff',3);ctx.globalAlpha=1;}
    for(const hit of sim.miniBlasts||[]){
      const progress=(t-hit.start)/.18;
      if(progress>=0 && progress<1)paintFire(hit.x,hit.y,hit.size,progress);
    }
    for(const b of sim.particles) {
      ctx.globalAlpha=Math.max(0,b.life/b.max);rectangle(b.x,b.y,b.size,b.size,b.color);
    }
    ctx.globalAlpha=1;
    if(sim.hitFlash>0) {
      ctx.strokeStyle='rgba(255,99,94,'+(sim.hitFlash/.35*.75)+')';ctx.lineWidth=6;ctx.strokeRect(3,3,WIDTH-6,HEIGHT-6);
    }
    drawHud();
    if(sim.phase==='arrival')warnFormation(sim.formation);
    for(const f of sim.reserve)warnFormation(f);
    const count=sim.reserve.length+1;
    if(count>=4 && ['arrival','match'].includes(sim.phase)){
      ctx.save();
      const color=count===4?'#ffda52':count===5?'#ff983a':'#ff4656';
      ctx.translate(WIDTH/2,ROW_Y+77);
      ctx.globalAlpha=count===6 && Math.floor(sim.time*2)%2 ? .25 : .5;
      const half=count-4;
      ctx.strokeStyle=color;ctx.lineWidth=4;ctx.lineJoin='round';
      for(let i=-half;i<=half;i++){
        const x=i*88;
        ctx.beginPath();
        ctx.moveTo(x,0);ctx.lineTo(x+36,60);ctx.lineTo(x-36,60);ctx.closePath();
        ctx.fillStyle='rgba(14,17,26,.86)';ctx.fill();ctx.stroke();
        text('!',x,39,color,46,'center',true);
      }
      ctx.restore();
  }
    if(sim.phase==='match')for(const e of sim.row)if(e.reinforceAfter>0)entryMark(e.tx,24);
    if((sim.phase==='core' && sim.boss?.entryRemaining>0) || sim.phase==='capital-arrival')entryMark(WIDTH/2,24);
    drawDrops(t);
    if(sim.phase==='dialogue'){drawDialogue();}
    if(sim.phase==='dock-shop'){drawDockShop(t);}
  }
  const portraits = {};
  function showPortrait(speaker){
    const id=speaker.startsWith('KITE')?'kite':speaker.startsWith('ADMIRAL')?'veyr':null;
    if(!id || typeof Image==='undefined')return false;
    if(!portraits[id]){
      const image=new Image();
      image.src='./assets/'+id+'-portrait.png';
      portraits[id]=image;
    }
    const image=portraits[id];
    if(!image.complete || !image.naturalWidth)return false;
    const scale=Math.min(144/image.naturalWidth,148/image.naturalHeight);
    const w=Math.round(image.naturalWidth*scale),h=Math.round(image.naturalHeight*scale);
    ctx.drawImage(image,80+(144-w)/2,659-h,w,h);
    return true;
  }
  function drawDialogue(){
    const opening=sim.phase==='briefing',index=sim.bossIndex;
    const lines=opening?briefing:transmissions[index-1];
    const [actor,body]=lines[sim.line];
    const speaker=actor==='KITE'?'KITE  /  LAN VÕ':actor==='VEYR'?'ADMIRAL OREN VEYR':actor;
    if(!opening && index===10){
      // Lifeboats illuminate the corridor in staggered pairs as the channel reopens.
      for(let i=0;i<8;i++){
        const u=i/7,lit=sim.phaseTime>i*.37;
        for(const side of [-1,1]){
          const x=640+side*(48+u*395),y=105+u*u*355;
          ctx.fillStyle=lit?'#a7c7d1':'#314555';
          ctx.beginPath();ctx.moveTo(x,y-6-u*9);ctx.lineTo(x-5-u*8,y+3);ctx.lineTo(x+5+u*8,y+3);ctx.fill();
          if(lit){rectangle(x-3,y+1,6,4,'#ffdba7');}
        }
      }
      // Pod Six follows Kite into the convoy after she acknowledges the admiral.
      if(sim.line>=2){
        const x=640+28*Math.sin(sim.phaseTime*.35), y=341;
        window.SpaceArt.draw(ctx,sim.ship,x,y,52,52,0);
        line(x,y+20,x-9,y+46,'#92aeb9',2);
        rectangle(x-17,y+46,16,12,'#879aaa');
        rectangle(x-13,y+48,8,3,'#fbd995');
      }
    }
    rectangle(60,478,1160,188,'rgba(6,18,32,.96)');
    rectangle(60,478,1160,3,'#61d2cd');
    const left=showPortrait(speaker)?250:95;
    text('CONVOY CHANNEL  /  '+speaker,left,519,'#83e5d9',18,'left',true);
    ctx.font='700 23px system-ui, sans-serif';
    let current='',y=563;
    for(const word of body.split(' ')){
      const next=current?current+' '+word:word;
      if(current && ctx.measureText(next).width>1180-left){
        text(current,left,y,'#f5f3dd',23,'left',true);
        current=word;y+=30;
      }else current=next;
    }
    text(current,left,y,'#f5f3dd',23,'left',true);
    text(coop?.role==='guest'?'HOST ADVANCES TRANSMISSION':opening?'ENTER / CLICK TO CONTINUE   ·   X TO SKIP BRIEFING':'ENTER OR CLICK TO CONTINUE',1180,637,'#adc6da',14,'right');

  }
  function drawMission() {
    if(sim.phase==='core')return;
    const mid=WIDTH/2, y=HEIGHT/2, capital=sim.phase.startsWith('capital');
    const center=capital ? (sim.phase==='capital-clear'?'Battery neutralized':'Destroy the gun turrets')
      :
        sim.phase==='core-drop'?'Recover the upgrade core':
        ['boss-explosion','reward','dialogue'].includes(sim.phase)?'Sector secured':sim.clue;
    const category=capital?'CAPITAL SHIP':'ROW';
    ctx.save();
    const fresh=sim.phase==='match' || sim.phase==='capital';
    ctx.globalAlpha=.57+(fresh ? .16*Math.max(0,1-sim.phaseTime/1.1) : 0);
    ctx.shadowBlur=3;ctx.shadowColor='#030b14';
    text(category+'  /  '+String(sim.wave).padStart(2,'0'),mid,y-31,'#a5c4da',14,'center',true);
    ctx.font='700 37px system-ui, sans-serif';
    const size=Math.min(37, Math.floor(37*770/Math.max(1,ctx.measureText(center).width)));
    text(center,mid,y,'#dceaf5',size,'center',true);
    if(capital && sim.capital && sim.phase==='capital') {
      const turrets=sim.capital.turrets;
      text(turrets.filter(t=>t.hp>0).length+' / '+turrets.length+' online',mid,y+29,'#e4c7a4',14);
    } else if(sim.phase==='match' && sim.found.length===1) {
      text(sim.found[0]+'  +  ?',mid,y+30,'#99e9c6',17,'center',true);
    }
    ctx.restore();
  }
  function drawHud() {
    const p=coop?.role==='guest'?sim.wingman:sim.player, hull=hulls[p.ship], level=p.level || 1;
    ctx.save();
    ctx.globalAlpha=.64;
    const hullCap = sim.wingman ? teamCapacity(sim) : hull.hp;
    const curHp = sim.wingman ? sim.teamHp : p.hp;
    const shieldCap = sim.wingman ? 4 : 2;
    const curShield = sim.wingman ? (sim.teamShield || 0) : (p.shields || 0);
    text((sim.wingman ? 'TEAM HULL  ' : 'HULL  ') + curHp + ' / ' + hullCap, 24, HEIGHT/2 - 28, '#c4d8e5', 11, 'left', true);
    for(let i=0;i<hullCap;i++) rectangle(24+i*11, HEIGHT/2 - 14, 8, 12, i<curHp ? '#90ebc5' : '#334155');
    text('DEF SHIELD  ' + curShield + ' / ' + shieldCap, 24, HEIGHT/2 + 8, '#7dd3fc', 11, 'left', true);
    for(let i=0;i<shieldCap;i++) {
      rectangle(24+i*16, HEIGHT/2 + 22, 12, 8, i<curShield ? '#38bdf8' : '#0f2e46');
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1; ctx.strokeRect(24+i*16, HEIGHT/2 + 22, 12, 8);
    }

    text('SCORE',24,HEIGHT-76,'#b6cbdc',11,'left',true);
    text(sim.score.toLocaleString('en-US'),24,HEIGHT-54,'#ffe3ae',22,'left',true);
    text('CREDITS',24,HEIGHT-32,'#ffd67a',11,'left',true);
    text('🪙 '+(sim.credits||0).toLocaleString('en-US'),24,HEIGHT-14,'#ffd67a',16,'left',true);

    const flash=sim.upgradeFlash>0;
    text('CANNON  '+level,WIDTH-25,HEIGHT-53,flash?'#ffe499':'#b6cbdc',13,'right',true);
    text('E  ·  '+hull.skill+'   '+(p.cooldown>0?Math.ceil(p.cooldown)+'s':'READY'),
      WIDTH-25,HEIGHT-27,p.cooldown>0?'#aec0d0':'#9ae2ce',13,'right',true);
    const m=sim.message;
    if(m && m.time>0) text(m.text,WIDTH/2,HEIGHT-44,m.color,17,'center',true);
    else if(sim.wave===1) text('WASD / MOUSE   MOVE      SPACE / CLICK   FIRE',WIDTH/2,HEIGHT-27,'#aac0d1',12,'center',true);
    ctx.restore();
  }
  // Ordered input replay. A host tick and its guest replica consume the same
  // seed and host-selected vocabulary even when their local decks differ.
  const STEP=1/60;
  let streamStep=null, seed=0;
  window.SpaceFlightRandom=()=>{
    if(!streamStep)return Math.random();
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  };
  function choice(make){
    if(!streamStep)return make();
    if(coop.role==='host'){
      const result=make();
      (streamStep.choices??=[]).push(result);
      return result;
    }
    if(!streamStep.choices?.length)throw Error('Missing host choice');
    return streamStep.choices.shift();
  }
  function command(type,...args){
    if(coop?.role==='host' && !streamStep){
      coop.commands.push([type,...args]);
      return true;
    }
    return false;
  }
  function runStep(frame){
    streamStep=frame;
    seed=(coop.seed+Math.imul(++coop.step,2654435761))>>>0;
    try{
      for(const [type,...a] of frame.commands||[]){
        if(type==='skill')activateSkill(pilots()[a[0]],pilots()[a[0]].ship);
        else if(type==='dialogue')advanceDialogue(a[0]);
        else if(type==='shop-buy')executeDockShopBuy();
        else if(type==='shop-leave')executeDockShopLeave();
        else if(type==='key' && sim.boss?.index===4)window.SpaceMiner.press(sim.boss,...a);
        else if(type==='word' && sim.boss?.index===5){
          beltAnswer(pilots()[a[0]],a[1],a[2]);
        }
      }
      if(sim.state==='active')tick(STEP);
    }finally{streamStep=null;}
  }
  function sendBaseline(){
    coop.frames=[];coop.seq++;
    coop.send(sim.state==='ended'?'finish':'frame',{...pack(),net:{step:coop.step,seq:coop.seq,seed:coop.seed}});
  }
  function requestBaseline(){
    if(coop.awaiting)return;
    coop.queue=[];coop.awaiting=true;coop.send('request-frame',{});
  }
  function signature(){
    return [sim.wave,sim.phase,sim.score,sim.player.hp,sim.wingman.hp,sim.player.shields||0,sim.teamShield||0,sim.credits||0,sim.boss?.hp||0,sim.hostiles.length,sim.shots.length].join('/');
  }
  function simulateCoop(now){
    const elapsed=lastTime?Math.min(.15,Math.max(0,(now-lastTime)/1000)):0;
    lastTime=now;
    if(coop.role==='guest'){
      if(now-coop.sentAt>=50){sendControls();coop.sentAt=now;}
      if(!coop.initialized || coop.awaiting)return;
      // Hold one small packet in reserve so irregular arrivals still render at 60 Hz.
      if(!coop.started && coop.queue.length>=4)coop.started=true;
      if(coop.started){
        coop.acc=Math.min(.18,coop.acc+elapsed*(coop.queue.length>9?1.15:1));
        while(coop.acc>=STEP && coop.queue.length && sim.state==='active'){
          const frame=coop.queue.shift();
          try{runStep(frame);}catch{requestBaseline();break;}
          coop.acc-=STEP;
          if(frame.end){
            if(signature()!==frame.end.check){requestBaseline();break;}
            const xy=frame.end.xy;
            [sim.player.x,sim.player.y,sim.wingman.x,sim.wingman.y]=xy;
          }
        }
        if(!coop.queue.length)coop.acc=0;
      }
    }else{
      const waiting=now-coop.lastInputAt>1500;
      coop.acc=waiting?0:coop.acc+elapsed;
      while(coop.acc>=STEP && sim.state==='active'){
        const frame={controls:[readControls(),coop.remote]};
        if(coop.commands.length)frame.commands=coop.commands.splice(0);
        runStep(frame);coop.frames.push(frame);coop.acc-=STEP;
      }
      if(sim.state==='active' && now-coop.sentAt>=50 && coop.frames.length){
        const frames=coop.frames.splice(0);
        // Run-length encode consecutive identical inputs inside this packet.
        const runs=[];let previous='';
        for(const f of frames){
          const key=JSON.stringify(f.controls);
          if(!f.commands && !f.choices && key===previous)runs[runs.length-1].n++;
          else{runs.push({...f,n:1});previous=f.commands||f.choices?'':key;}
        }
        coop.send('steps',{seq:++coop.seq,first:coop.step-frames.length+1,runs,
          xy:[sim.player.x,sim.player.y,sim.wingman.x,sim.wingman.y],check:signature()});
        coop.sentAt=now;
      }
      if(now-coop.savedAt>=2500){checkpoint();coop.savedAt=now;}
    }
    if(sim.state==='active')drawScene();
  }

  function animate(now) {
    if(!sim || sim.state!=='active' || coop?.connected===false) return;
    if(coop){
      simulateCoop(now);
      if(sim.state==='active')raf=requestAnimationFrame(animate);
      return;
    }
    const elapsed=lastTime?Math.max(0,(now-lastTime)/1000):0;
    let delta=Math.min(.075,elapsed);
    lastTime=now;
    // A suspended guest can stop sending controls before WebRTC reports a broken link.
    const waiting=coop && now-coop.lastInputAt>1500;
    if(waiting)delta=0;
    else if(sim.phase==='cinematic'){
      // The fly-in is time-based artwork. A slow frame must not stretch the movie
      // or apply missed combat time once the enemy formation arrives.
      tick(Math.min(elapsed,Math.max(0,window.SpaceCampaign.duration-sim.phaseTime)));
      delta=0;
    }
    while(delta>0 && sim.state==='active') {
      const step=Math.min(delta,1/90);tick(step);delta-=step;
    }
    if(sim.state==='active') {
      drawScene();
      if(waiting)text('Waiting for wingman...',WIDTH/2,HEIGHT-80,'#ffda91',17);
      raf=requestAnimationFrame(animate);
    }
  }
  function pause(notify=true) {
    if(!sim || sim.state!=='active') return false;
    window.SpaceSound?.silence?.();sim.state='paused';window.SpaceBelt.resetDraft();resetInput();cancelAnimationFrame(raf);
    if(coop){clearRemote();if(notify)coop.send('pause',{});if(coop.role==='host')sendBaseline();checkpoint();}
    return true;
  }
  function requestPause() {
    if(pause()) window.dispatchEvent(new CustomEvent('flight-pause'));
  }
  function resume(notify=true) {
    if(!sim || sim.state!=='paused') return;
    sim.state='active';lastTime=0;if(coop && notify)coop.send('resume',{});
    if(coop?.connected!==false)raf=requestAnimationFrame(animate);
  }
  function stop() {window.SpaceSound?.silence?.();cancelAnimationFrame(raf);coop=null;sim=null;window.SpaceBelt.resetDraft();resetInput();}
  function position(event) {
    const r=canvas.getBoundingClientRect();
    if(r.width && r.height) target={x:clamp((event.clientX-r.left)*WIDTH/r.width,28,WIDTH-28),y:clamp((event.clientY-r.top)*HEIGHT/r.height,42,HEIGHT-42)};
  }
  function bindCanvas() {
    if(canvas) return;
    canvas=document.getElementById('flight');ctx=canvas.getContext('2d');
    canvas.width=WIDTH;canvas.height=HEIGHT;ctx.imageSmoothingEnabled=false;
    canvas.addEventListener('pointerdown',e=>{
      if(sim?.state!=='active') return;
      if(sim.phase==='dialogue' || sim.phase==='briefing'){if(e.button===0)advanceDialogue();return;}
      if(beltActive()){canvas.focus({preventScroll:true});return;}
      if(e.button===2) {useSkill();e.preventDefault();return;}
      if(e.button!==0 || !e.isPrimary) return;
      pointerId=e.pointerId;pointerFire=true;position(e);canvas.setPointerCapture?.(e.pointerId);
    });
    canvas.addEventListener('pointermove',e=>{if(sim?.state==='active' && e.isPrimary) position(e);});
    function release(e) {if(e.pointerId===pointerId){pointerFire=false;pointerId=null;}}
    canvas.addEventListener('lostpointercapture',release);window.addEventListener('pointerup',release);
    window.addEventListener('pointercancel',release);
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
  }
  const wasdDirections={KeyW:'ArrowUp',KeyA:'ArrowLeft',KeyS:'ArrowDown',KeyD:'ArrowRight'};
  window.addEventListener('keydown',e=>{
    if(sim?.state!=='active') return;
    if(beltActive() && e.code!=='Escape'){
      if(e.ctrlKey || e.metaKey || e.altKey || e.isComposing)return;
      if(e.key?.length===1 || e.key==='Backspace' || e.key==='Enter'){
        e.preventDefault();
        const seat=coop?.role==='guest'?1:0;
        if(!e.repeat && pilots()[seat]?.hp>0)window.SpaceBelt.typeKey(sim.boss,e.key,seat,rock=>{
          if(seat===1)coop.send('belt-word',{word:rock.word,id:rock.id});
          else beltAnswer(sim.player,rock.word,rock.id);
        },()=>sound('wrong'));
      }
      return;
    }
    if(e.code==='KeyX' && sim.phase==='briefing'){e.preventDefault();if(!e.repeat)advanceDialogue(true);return;}
    if(e.code==='Enter' && (sim.phase==='dialogue' || sim.phase==='briefing')){e.preventDefault();if(!e.repeat)advanceDialogue();return;}
    if(sim.phase==='dock-shop' && e.code!=='Escape'){
      if(e.code==='Digit1'||e.code==='KeyB'){e.preventDefault();buyDockShield();return;}
      if(e.code==='Digit2'||e.code==='KeyL'||e.code==='Enter'||e.code==='Space'){e.preventDefault();leaveDockShop();return;}
      return;
    }
    const tether=sim.phase==='core' && sim.boss?.miner?.tether;
    const direction=wasdDirections[e.code] || e.code;
    if(tether && tether.seat===(coop?.role==='guest'?1:0) && direction.startsWith('Arrow')){
      e.preventDefault();
      if(!e.repeat && coop?.connected!==false){
        if(coop?.role==='guest')coop.send('miner-key',{id:tether.id,key:direction});
        else if(!command('key',0,tether.id,direction))window.SpaceMiner.press(sim.boss,0,tether.id,direction);
      }
      return;
    }
    if(e.code==='Escape') {e.preventDefault();if(!e.repeat)requestPause();return;}
    if(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyE'].includes(e.code)) {
      e.preventDefault();keys.add(e.code);
      if(e.code==='KeyE' && !e.repeat) useSkill();
    }
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>{
    resetInput();
    if(!coop && sim?.phase!=='cinematic') requestPause();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden && !coop) requestPause();});
  function initialize(shipId) {
    bindCanvas();
    const ship=Object.hasOwn(hulls,shipId)?shipId:'kestrel';
    sim={ship,state:'active',wave:0,cleared:0,correct:0,wrong:0,score:0,time:0,slow:0,pulse:0,hitFlash:0,
      runId:coop?.matchId||globalThis.crypto?.randomUUID?.()||String(Date.now()),bossIndex:0,rewarded:0,core:null,line:0,
      player:{ship,level:1,guard:false,correct:0,x:WIDTH/2,y:HEIGHT-115,hp:hulls[ship].hp,shields:2,maxShields:2,gun:0,grace:0,barrier:0,phase:0,cooldown:0},
      weaponLevel:1,upgradeFlash:0,credits:getProfileCredits(),drops:[],rewardedFleetMax:0,reserve:[],fleetClock:7,staging:null,capital:null,routes:[],particles:[]};
    lastTime=0;
  }
  function beginMission() {
    newRow();
    if(window.SpaceCampaign)sim.phase='cinematic';
  }
  function start(shipId) {
    stop();initialize(shipId);try{localStorage.removeItem(SOLO_SAVE);}catch{}beginMission();drawScene();raf=requestAnimationFrame(animate);
  }
  function startBossPractice(index,shipId,options={}){
    if(!Number.isInteger(index) || index<1 || index>10)throw new RangeError('Unknown encounter');
    stop();initialize(shipId);
    preparePractice(index,options);
    drawScene();raf=requestAnimationFrame(animate);
  }
  function preparePractice(index,options){
    sim.practice=true;sim.wave=index*ROWS_PER_BOSS-1;sim.cleared=index*ROWS_PER_BOSS;
    newRow();sim.weaponLevel=clamp(Math.trunc(options.level)||Math.min(index,gunPeriod.length),1,gunPeriod.length);
    for(const p of pilots())p.level=sim.weaponLevel;sim.rewarded=index-1;
    beginBoss(index,clamp(Math.trunc(options.phase)||1,1,window.SpaceBosses.catalog[index-1].phases));
    if(Number.isInteger(options.skillIndex) && window.SpaceBosses.catalog[index-1].skills?.[options.skillIndex]) sim.boss.practiceSkill=options.skillIndex;
  }
  function bossRushUnlocked(){
    try{return localStorage.getItem(RUSH_UNLOCK)==='1';}catch{return false;}
  }
  function startBossRush(shipId){
    if(!bossRushUnlocked())return false;
    stop();initialize(shipId);sim.rush=true;
    preparePractice(1,{level:1,phase:1});
    drawScene();raf=requestAnimationFrame(animate);return true;
  }
  const blankControls=()=>({dx:0,dy:0,target:null,fire:false,skill:0});
  function clearRemote(){coop.remote=blankControls();coop.lastSkill=null;}
  function sendControls(){if(coop?.connected && sim.state==='active')coop.send('controls',readControls());}
  function pack() {
    // The formation owns its ship list and synonym pair; restore those shared references on receipt.
    const {formation,row,pair,staging,reserve,...rest}=sim;
    return {...rest,formation:{...formation,ships:row,pair:[...pair]},
      reserve:reserve.map(f=>({...f,pair:[...f.pair]})),staging:null};
  }
  function unpack(world,solo=false){
    if(!world || !['active','paused','ended'].includes(world.state) ||
       !Number.isInteger(world.bossIndex) || world.bossIndex<0 || world.bossIndex>10 ||
       !Number.isInteger(world.rewarded) || world.rewarded<0 || world.rewarded>10 ||
       !['briefing','cinematic','arrival','match','capital-arrival','capital','capital-clear','chain','core','boss-explosion','core-drop','reward','dialogue','dock-shop'].includes(world.phase) ||
       !Number.isFinite(world.time) || !Number.isFinite(world.score) ||
       !(solo?[world.player]:[world.player,world.wingman]).every(p=>p && Object.hasOwn(hulls,p.ship) && [p.hp,p.x,p.y].every(Number.isFinite)) ||
       ![world.shots,world.hostiles,world.particles,world.routes,world.found].every(Array.isArray))return null;
    if(world.phase==='core' && (!world.boss || world.bossIndex<1 || !Number.isFinite(world.boss.hp)))return null;
    if(world.phase==='core-drop' && (!world.core || !Number.isFinite(world.core.age)))return null;
    if(world.phase==='briefing'){world.phase='cinematic';world.phaseTime=0;world.line=0;}
    if(world.phase==='dialogue' && !transmissions[world.bossIndex-1]?.[world.line])return null;
    const reserve=world.reserve??(world.staging?[world.staging]:[]);
    if(!Array.isArray(reserve)||reserve.length>5)return null;
    for(const group of [world.formation,...reserve]){
      if(!group || !Array.isArray(group.pair) || !Array.isArray(group.ships) ||
         !group.ships.every(e=>e && Object.hasOwn(roleColors,e.role) && typeof e.word==='string'))return null;
    }
    const restore=f=>({...f,pair:new Set(f.pair)});
    const formation=restore(world.formation);
    for(const p of (solo?[world.player]:[world.player,world.wingman])){
      if(p){
        if(p.hp > hulls[p.ship].hp) p.hp = hulls[p.ship].hp;
        if(p.shields === undefined) p.shields = 2;
        if(p.maxShields === undefined) p.maxShields = 2;
        if(p.barrier === undefined) p.barrier = 0;
      }
    }
    if(!Array.isArray(world.drops)) world.drops = [];
    if(!Number.isFinite(world.credits)) world.credits = getProfileCredits();
    if(!Number.isFinite(world.rewardedFleetMax)) world.rewardedFleetMax = world.cleared || 0;
    if(world.wingman && world.teamShield === undefined) world.teamShield = 4;
    if(world.wingman){
      const health=world.teamHp??(world.player.hp+world.wingman.hp);
      if(!Number.isFinite(health))return null;
      setTeamHealth(world,health);
    }
    return {...world,formation,pair:formation.pair,row:formation.ships,staging:null,reserve:reserve.map(restore),fleetClock:Number.isFinite(world.fleetClock)?world.fleetClock:7};
  }
  function saveMilestone(){
    if(sim.practice)return;
    if(coop){checkpoint();return;}
    try{localStorage.setItem(SOLO_SAVE,JSON.stringify(pack()));}catch{}
  }
  function savedCampaign(){
    try{return unpack(JSON.parse(localStorage.getItem(SOLO_SAVE)),true);}catch{return null;}
  }
  function hasCampaignCheckpoint(shipId){const saved=savedCampaign();return !!saved && (!shipId || saved.ship===shipId);}
  function continueCampaign(){
    const saved=savedCampaign();
    if(!saved)return false;
    stop();initialize(saved.ship);sim=saved;
    sim.state='active';drawScene();raf=requestAnimationFrame(animate);return true;
  }
  function checkpoint(){
    if(coop?.role!=='host' || !sim?.formation)return;
    const key=sim.practice?'space_dominators_lab_checkpoint_v1':'space_dominators_checkpoint_v1';
    const record=JSON.stringify({room:coop.roomCode,match:coop.matchId,savedAt:Date.now(),world:pack()});
    for(const name of ['sessionStorage','localStorage']){
      try{globalThis[name].setItem(key,record);}catch{}
    }
  }
  function startCoop(opts){
    stop();
    coop={role:opts.role,lab:!!opts.lab,matchId:opts.matchId,roomCode:opts.roomCode,send:opts.send,connected:true,
      lastInputAt:performance.now(),seed:crypto.getRandomValues(new Uint32Array(1))[0],step:0,seq:0,acc:0,queue:[],commands:[],frames:[],skill:0,lastSkill:null,remote:blankControls(),sentAt:-Infinity,savedAt:0};
    coop.names=[opts.names?.[0],opts.names?.[1]];
    coop.names[opts.role==='host' ? 0 : 1]=opts.localName;
    initialize(opts.hostShip);
    sim.player.x=WIDTH*.42;
    const wingShip=Object.hasOwn(hulls,opts.guestShip)?opts.guestShip:'kestrel';
    sim.wingman={...sim.player,x:WIDTH*.58,hp:hulls[wingShip].hp,ship:wingShip};
    setTeamHealth(sim,teamCapacity(sim));
    sim.teamShield=4;sim.teamShieldMax=4;
    sim.player.shields=sim.wingman.shields=4;
    sim.player.maxShields=sim.wingman.maxShields=4;
    if(coop.role==='host'){
      let saved=null,latest=-1;
      for(const name of ['sessionStorage','localStorage']){
        try{
          const entry=JSON.parse(globalThis[name].getItem(coop.lab?'space_dominators_lab_checkpoint_v1':'space_dominators_checkpoint_v1'));
          if(entry?.room!==coop.roomCode || entry.match!==coop.matchId || (entry.savedAt||0)<latest)continue;
          const world=unpack(entry.world);
          if(world){saved=world;latest=entry.savedAt||0;}
        }catch{}
      }
      if(saved)sim=saved;
      else{
        if(opts.lab && Number.isInteger(opts.lab.boss) && opts.lab.boss>=1 && opts.lab.boss<=10)preparePractice(opts.lab.boss,opts.lab);
        else beginMission();
        checkpoint();
      }
      drawScene();
      if(sim.state==='ended'){sim.state='active';end(sim.outcome||'defeat');return;}
      if(sim.state==='paused')queueMicrotask(()=>{if(sim?.state==='paused')window.dispatchEvent(new CustomEvent('flight-pause'));});
    }
    if(coop.role==='guest')coop.send('request-frame',{});
    raf=requestAnimationFrame(animate);
  }
  function receiveCoop(type,data){
    if(!coop || !sim || !coop.connected)return;
    if(type==='request-frame' && coop.role==='host'){sendBaseline();return;}
    if(type==='steps' && coop.role==='guest'){
      if(!coop.initialized || coop.awaiting)return;
      if(!data || !Number.isSafeInteger(data.seq) || data.seq<=coop.seq)return;
      if(data.seq!==coop.seq+1 || data.first!==coop.step+coop.queue.length+1 ||
         !Array.isArray(data.runs) || !data.runs.length || data.runs.length>60 ||
         !Array.isArray(data.xy) || data.xy.length!==4 || !data.xy.every(Number.isFinite) ||
         typeof data.check!=='string'){requestBaseline();return;}
      const frames=[];
      for(const run of data.runs){
        if(!run || !Number.isInteger(run.n) || run.n<1 || run.n>60 || frames.length+run.n>60 ||
           !Array.isArray(run.controls) || run.controls.length!==2 ||
           !run.controls.every(c=>c && [-1,0,1].includes(c.dx) && [-1,0,1].includes(c.dy) && typeof c.fire==='boolean' && (!c.target || Number.isFinite(c.target.x)&&Number.isFinite(c.target.y))) ||
           (run.commands && !Array.isArray(run.commands)) || (run.choices && !Array.isArray(run.choices))){requestBaseline();return;}
        for(let i=0;i<run.n;i++)frames.push({...run});
      }
      if(frames.length+coop.queue.length>90){requestBaseline();return;}
      frames[frames.length-1].end={xy:data.xy,check:data.check};
      coop.seq=data.seq;coop.queue.push(...frames);return;
    }
    if((type==='frame'||type==='finish') && coop.role==='guest'){
      const world=unpack(data),net=data?.net;
      if(!world || !net || ![net.step,net.seq,net.seed].every(Number.isSafeInteger) || (coop.initialized && net.seq<coop.seq))return;
      const previous=sim.state;
      coop.initialized=true;coop.awaiting=false;coop.started=false;coop.queue=[];coop.acc=0;
      coop.step=net.step;coop.seq=net.seq;coop.seed=net.seed;sim=world;
      if(sim.state==='ended'){
        if(coop.finalConfirmed)return;
        coop.finalConfirmed=true;sim.state='active';end(sim.outcome||'defeat');return;
      }
      drawScene();
      if(previous!==sim.state){
        if(sim.state==='paused')window.dispatchEvent(new CustomEvent('flight-pause'));
        else{lastTime=0;cancelAnimationFrame(raf);raf=requestAnimationFrame(animate);window.dispatchEvent(new CustomEvent('flight-resume'));}
      }
      return;
    }
    if(type==='shop-buy' && coop.role==='host' && sim.state==='active' && sim.phase==='dock-shop'){
      command('shop-buy');return;
    }
    if(type==='shop-leave' && coop.role==='host' && sim.state==='active' && sim.phase==='dock-shop'){
      command('shop-leave');return;
    }
    if(type==='belt-word' && coop.role==='host' && beltActive() && typeof data?.word==='string' && data.word.length<=80 && (data.id===null || Number.isSafeInteger(data.id))){
      beltAnswer(sim.wingman,data.word,data.id);return;
    }
    if(type==='miner-key' && coop.role==='host' && sim.state==='active' && sim.phase==='core'){
      if(sim.boss?.miner?.tether?.id===data?.id && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(data?.key))command('key',1,data.id,data.key);
      return;
    }
    if(type==='controls' && coop.role==='host' && sim.state==='active' && data){
      const {dx,dy,target,fire,skill}=data;
      if(![-1,0,1].includes(dx)||![-1,0,1].includes(dy)||typeof fire!=='boolean' ||
        !Number.isSafeInteger(skill)||skill<0 || (target && (!Number.isFinite(target.x)||!Number.isFinite(target.y))))return;
      coop.lastInputAt=performance.now();
      coop.remote={dx,dy,target:target?{x:clamp(target.x,28,WIDTH-28),y:clamp(target.y,42,HEIGHT-42)}:null,fire,skill};
      if(['match','capital','core'].includes(sim.phase) && coop.lastSkill!==null && skill>coop.lastSkill)activateSkill(sim.wingman,sim.wingman.ship);
      coop.lastSkill=skill;
      return;
    }
    if(type==='pause' && pause(false)){
      window.dispatchEvent(new CustomEvent('flight-pause'));
    }
    if(type==='resume' && sim.state==='paused'){
      resume(false);window.dispatchEvent(new CustomEvent('flight-resume'));
    }
  }
  function setCoopConnected(connected){
    if(!coop || !sim)return;
    if(!connected){
      if(coop.connected)checkpoint();
      window.SpaceSound?.silence?.();coop.connected=false;cancelAnimationFrame(raf);resetInput();clearRemote();lastTime=0;return;
    }
    coop.connected=true;coop.lastInputAt=performance.now();
    if(coop.role==='host')sendBaseline();
    else coop.send('request-frame',{});
    cancelAnimationFrame(raf);lastTime=0;
    if(sim.state==='active')raf=requestAnimationFrame(animate);
  }
  window.addEventListener('pagehide',checkpoint);
  window.SpaceGame=Object.freeze({start,startBossPractice,bossRushUnlocked,startBossRush,hasCampaignCheckpoint,continueCampaign,pause,resume,stop,startCoop,receiveCoop,setCoopConnected});
})();
