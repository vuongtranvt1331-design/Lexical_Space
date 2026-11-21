import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = name => readFileSync(new URL('../apps/space-dominators/' + name, import.meta.url), 'utf8');
const controls = { dx: 0, dy: 0, target: null, fire: false, skill: 0 };
const jsonCopy = value => JSON.parse(JSON.stringify(value));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, actual + ' != ' + expected);

function createFlight(words = ['old', 'aged', 'tall', 'bright', 'slow', 'blue']) {
  const packetLog = [];
  const noOp = () => {};
  const brush = new Proxy({
    measureText: text => ({ width: String(text).length * 7 }),
    createLinearGradient: () => ({ addColorStop: noOp }),
  }, { get: (target, key) => target[key] ?? noOp });
  const canvas = { getContext: () => brush, addEventListener: noOp };
  const storage = { getItem: () => null, setItem: noOp, removeItem: noOp };
  const scope = vm.createContext({
    crypto, performance, queueMicrotask, localStorage: storage, sessionStorage: storage,
    addEventListener: noOp, dispatchEvent: noOp, CustomEvent: class {},
    URL, Image: class { set src(value){this.url=value;this.naturalWidth=128;this.naturalHeight=128;this.onload?.();} },
    document: { createElement: () => {
      const surface={getContext:()=>({...brush,createLinearGradient:brush.createLinearGradient,
        fillRect:noOp,drawImage:image=>{surface.url=image.url;}})};
      return surface;
    }, currentScript:{src:'http://localhost/apps/space-dominators/dreadnought.js'}, getElementById: () => canvas, addEventListener: noOp },
    requestAnimationFrame: () => 1, cancelAnimationFrame: noOp,
    SpaceArt: { draw: noOp },
    introStops:0,
    SpaceSound:{play:noOp,stopIntro(){scope.introStops++;}},
    SpaceBackdrop: { draw: noOp },
    SpaceBelt: { resetDraft: noOp },
    SpaceWords: {
      next() {
        // An arbitrary host-only draw must not advance the combat random stream.
        scope.SpaceFlightRandom();
        return { clue: 'antique', pair: words.slice(0, 2), words };
      },
    },
  });
  scope.window = scope;
  for (const name of ['dreadnought-config.js','dreadnought-ending.js','dreadnought-formations.js','dreadnought.js','asteroid-belt.js','boss-encounters.js', 'boss-campaign.js','fleet-arrival.js','boss-six-preview.js','dock-nine-story.js','fleet-study.js']) vm.runInContext(source(name), scope);
  vm.runInContext(source('game.js').replace('  window.SpaceGame=Object.freeze(', `
    window.probe={
      world:()=>sim,runStep,signature,damage,advancePilot,executeDockShopBuy,drawScene,
      queueNextRow,beginBoss,advanceDialogue,releaseCore,tick,pack,unpack,
    };
    window.SpaceGame=Object.freeze(`), scope);
  return {
    scope, game: scope.SpaceGame,
    boss: scope.SpaceBosses,
    probe: scope.probe,
    packets: packetLog,
    start(role, lab = null) {
      scope.SpaceGame.startCoop({
        role, lab, matchId: 'fixture', hostShip: 'kestrel', guestShip: 'aegis',
        send: (type, payload) => packetLog.push({ type, payload: jsonCopy(payload) }),
      });
    },
  };
}

function sync(host, guest) {
  host.game.receiveCoop('request-frame', {});
  const packet = host.packets.at(-1);
  guest.game.receiveCoop(packet.type, packet.payload);
}

function step(host, guest) {
  const frame = { controls: [controls, controls] };
  host.probe.runStep(frame);
  if (guest) guest.probe.runStep(jsonCopy(frame));
  return frame.choices;
}

test('dreadnought co-op completes the shared intro and replays deck formations identically', () => {
  const host=createFlight(),guest=createFlight();
  const lab={boss:6,phase:1,level:3};
  host.start('host',lab);guest.start('guest',lab);sync(host,guest);
  for(let i=0;i<1800;i++)step(host,guest);
  const a=host.probe.world(),b=guest.probe.world();
  assert.equal(a.boss.index,6);
  assert.ok(a.boss.clock>=28.5);
  assert.equal(host.scope.introStops,1,'siren stops exactly when combat begins');
  assert.equal(a.boss.dread.fighters.length,30);
  assert.deepEqual(jsonCopy(a.boss.dread),jsonCopy(b.boss.dread));
  assert.equal(a.player.hp,3,'intro is noncombat');
  for(const world of [a,b]){world.player.hp=999;world.wingman.hp=999;}
  for(let i=0;i<1500;i++)step(host,guest);
  assert.deepEqual(jsonCopy(host.probe.world().boss?.dread),jsonCopy(guest.probe.world().boss?.dread));
});

test('dreadnought counts each destroyed fighter or turret once and starts its finale at 100 solo / 150 co-op',()=>{
  const f=createFlight();
  for(const coop of [false,true]){
    const b=f.boss.create(6,{coop}),target=coop?150:100;
    const api={miniBlast(){},sound(){},award(){}};
    b.clock=28.5;b.dread.time=1;
    assert.equal(b.max,target);assert.equal(b.hp,target);
    b.dread.fighters.push({id:'fighter-one',hp:1,x:100,y:100});
    b.dread.turrets.push({id:'turret-one',type:'fan',hp:1,x:200,y:100});
    b.dread.projectiles.push({id:'missile-one',missile:true,hp:1,x:300,y:100});
    for(const id of ['fighter-one','turret-one','turret-one','missile-one'])f.scope.SpaceDreadnought.hit(b,id,5,api);
    assert.equal(b.dread.kills,2,'turrets count one, repeat hits and missiles do not count');
    assert.equal(b.hp,target-2);
    b.dread.kills=target-1;
    b.dread.fighters.push({id:'fighter-final',hp:1,x:100,y:100});
    f.scope.SpaceDreadnought.hit(b,'fighter-final',5,api);
    assert.equal(b.dread.kills,target);assert.equal(b.hp,1);assert.equal(b.dread.finish.phase,'countdown');
  }
});

test('every dreadnought turret has the same cooldown in solo and co-op',()=>{
  const f=createFlight(),c=f.scope.SpaceDreadnoughtConfig;
  for(const coop of [false,true])for(const [type,spec] of Object.entries(c.types)){
    const b=f.boss.create(6,{coop});b.clock=28.5;
    b.dread.nextGrid=999;b.dread.nextWave=999;b.dread.nextSpawn=999;
    const turret={id:'deck-test',type,x:100,y:100,hp:spec.hp,angle:1,next:0,charge:.001};
    b.dread.turrets.push(turret);
    f.scope.SpaceDreadnought.update(b,.002,{pilots:[{x:640,y:650,hp:3}],sound(){},damage(){}});
    near(turret.next-b.dread.time,spec.cooldown);
  }
});

test('Boss Lab finale shortcut starts at the reactor with deck targets ready for the chain reaction',()=>{
  const f=createFlight();f.game.startBossPractice(6,'kestrel',{reactorFinish:true,level:3});
  const world=f.probe.world();
  assert.equal(world.phase,'core');assert.equal(world.boss.dread.finish.phase,'countdown');
  assert.equal(world.boss.dread.fighters.length,30);assert.equal(world.boss.dread.turrets.length,6);
  f.probe.drawScene();
});

test('the four approved formations have exact counts, 120 degree V arms and nonoverlapping sprite spacing',()=>{
  const f=createFlight(),mod=f.scope.SpaceDreadnoughtFormations;
  for(const [name,count] of [['grid',30],['blocks',27],['vee',25],['diamonds',25]])for(let sample=0;sample<12;sample++){
    const pts=mod.layout(name);assert.equal(pts.length,count);
    assert.ok(pts.every(p=>p.x>=52&&p.x<=1228&&p.y>=42&&p.y<=450));
    for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++)assert.ok(Math.hypot(pts[i].x-pts[j].x,pts[i].y-pts[j].y)>=70,name+' spacing');
    if(name==='vee')for(let k=0;k<5;k++){
      const tip=pts[k*5+2],a=pts[k*5],b=pts[k*5+4];
      const cos=((a.x-tip.x)*(b.x-tip.x)+(a.y-tip.y)*(b.y-tip.y))/(Math.hypot(a.x-tip.x,a.y-tip.y)*Math.hypot(b.x-tip.x,b.y-tip.y));
      near(Math.acos(cos),Math.PI*2/3);
    }
  }
});

test('formations hold for 15 seconds, reverse their entry, warn the next group and never overlap groups',()=>{
  const f=createFlight(),b=f.boss.create(6),s=b.dread,mod=f.scope.SpaceDreadnoughtFormations;
  const api={sound(){}};
  const advance=seconds=>{for(let left=seconds;left>1e-8;){const dt=Math.min(left,.01);s.time+=dt;mod.update(s,dt,api);assert.ok(s.fighters.length<=30);left-=dt;}};
  advance(.01);assert.equal(s.formation.layout,'grid');assert.equal(s.fighters.length,30);assert.equal(s.pending,null);
  advance(2.5);assert.equal(s.formation.phase,'holding');
  advance(14.8);assert.equal(s.formation.phase,'holding');
  advance(.2);assert.equal(s.formation.phase,'exiting');
  const survivors=[...s.fighters];advance(2.5);assert.equal(s.fighters.length,0);assert.equal(s.kills,0);
  assert.ok(survivors.every(p=>p.x<-50||p.x>1330||p.y<-50||p.y>770));
  advance(.6);assert.ok(s.pending);assert.equal(s.fighters.length,0);
  const at=s.pending.at;advance(Math.max(0,at-s.time-.02));assert.equal(s.fighters.length,0);
  advance(.04);assert.ok(s.fighters.length>=25&&s.fighters.length<=30);assert.equal(s.formation.phase,'entering');
});

test('all four layouts rotate without repetition in the opening cycle and use all four entry routes',()=>{
  const f=createFlight(),b=f.boss.create(6),s=b.dread,mod=f.scope.SpaceDreadnoughtFormations,seen=[];
  let last=null;
  for(let i=0;i<2400&&seen.length<4;i++){
    s.time+=.05;mod.update(s,.05,{sound(){}});
    if(s.formation?.id && s.formation.id!==last){last=s.formation.id;seen.push({layout:s.formation.layout,route:s.formation.route,count:s.fighters.length});}
  }
  assert.equal(new Set(seen.map(x=>x.layout)).size,4);
  assert.deepEqual(seen.map(x=>x.route),['horizontal','diagonal','left','right']);
  assert.ok(seen.every(x=>x.count>=25&&x.count<=30));
});

test('ten actual fighter kills trigger a smooth retreat without awarding kills for surviving withdrawals',()=>{
  const f=createFlight(),b=f.boss.create(6),s=b.dread,mod=f.scope.SpaceDreadnoughtFormations;
  const api={sound(){},miniBlast(){},award(){}};b.clock=28.5;
  s.time=.01;mod.update(s,.01,api);s.time+=1;mod.update(s,1,api);
  const target=s.fighters[15],initial={x:target.x,y:target.y};
  for(const ship of s.fighters.slice(0,10))f.scope.SpaceDreadnought.hit(b,ship.id,999,api);
  assert.equal(s.formation.phase,'exiting');assert.equal(s.formation.kills,10);assert.equal(s.kills,10);
  near(target.x,initial.x);near(target.y,initial.y);
  for(let i=0;i<250;i++){s.time+=.01;mod.update(s,.01,api);}
  assert.equal(s.fighters.length,0);assert.equal(s.kills,10);
});

test('each formation fighter faces its nearest living pilot while entering, holding and retreating',()=>{
  const f=createFlight(),b=f.boss.create(6),mod=f.scope.SpaceDreadnoughtFormations;
  b.clock=28.5;const p={x:980,y:610,hp:3},api={pilots:[p],sound(){},miniBlast(){},damage(){}};
  for(let i=0;i<2100;i++){
    f.scope.SpaceDreadnought.update(b,.01,api);
    for(const ship of b.dread.fighters)near(ship.angle,Math.atan2(p.y-ship.y,p.x-ship.x));
    if(i===350)for(const ship of b.dread.fighters.slice(0,10))f.scope.SpaceDreadnought.hit(b,ship.id,999,api);
  }
});

test('dreadnought intro assembles 400 tiny fighters into its existing five expanded V groups',()=>{
  const f=createFlight(),points=[],noOp=()=>{};
  const brush=new Proxy({fillRect:(...args)=>points.push(args)}, {get:(o,k)=>o[k]??noOp});
  f.scope.SpaceBossSixPreview.draw(brush,21,'kestrel');
  assert.equal(points.length,400);assert.ok(points.every(p=>p[2]===2&&p[3]===2));
});

function finaleFixture(coop=false){
  const f=createFlight(),b=f.boss.create(6,{coop}),c=f.scope.SpaceDreadnoughtConfig;
  b.clock=c.introSeconds;b.dread.kills=coop?150:100;
  const api={pilots:[{x:580,y:570,hp:3,seat:0},{x:700,y:570,hp:3,seat:1}],pilotSeat:p=>p.seat,sound(){},damage(){}};
  f.scope.SpaceDreadnoughtEnding.begin(b);
  const advance=seconds=>{for(let left=seconds;left>1e-8;){const dt=Math.min(left,1/120);f.scope.SpaceDreadnought.update(b,dt,api);left-=dt;}};
  return {f,b,api,advance};
}

test('reactor waits three seconds, accepts a fresh E in 250 ms, chains deck blasts, then reveals six damaged sites',()=>{
  const {f,b,api,advance}=finaleFixture();
  f.scope.SpaceDreadnoughtEnding.fire(b,0,api);assert.equal(b.dread.finish.phase,'countdown');
  advance(3.05);assert.equal(b.dread.finish.phase,'open');
  near(b.dread.finish.core.y,-24+38*3.05);
  f.scope.SpaceDreadnoughtEnding.fire(b,0,api);assert.equal(b.dread.finish.phase,'missile');
  advance(.69);assert.equal(b.dread.finish.phase,'missile');
  advance(.02);assert.equal(b.dread.finish.phase,'chain');assert.ok(b.dread.finish.fx.length);
  advance(3.4);assert.equal(b.dread.finish.phase,'chain');
  advance(.12);assert.equal(b.dread.finish.phase,'zoom');
  advance(3.9);assert.equal(b.dread.finish.damageStage,6);
  assert.ok(b.dread.finish.shards.some(p=>p.space==='fleet'&&Math.hypot(p.vx,p.vy)>0));
  advance(1.7);assert.equal(b.dread.finish.phase,'hold');assert.equal(b.dread.finish.complete,undefined);
  advance(2.5);assert.equal(b.dread.finish.phase,'escape');
  advance(.85);assert.equal(b.dread.finish.complete,true);assert.equal(b.hp,0);
});

test('authored hull variants include structural damage and a small engine chip, and rendering never redraws RNG',()=>{
  const f=createFlight(),plans=[];
  for(let i=0;i<4;i++){
    const b=f.boss.create(6);f.scope.SpaceDreadnoughtEnding.begin(b);
    const sites=b.dread.finish.damageSites;plans.push(JSON.stringify(sites));
    assert.equal(sites.length,6);assert.equal(sites.filter(s=>s.kind==='edge').length,4);
    assert.ok(sites.some(s=>s.kind==='bridge'));assert.ok(sites.some(s=>s.kind==='engine'));
    assert.ok(new Set(sites.map(s=>s.rx)).size>3);const engine=sites.find(s=>s.kind==='engine');assert.ok(engine.rx<=.025&&engine.ry<=.02);
    assert.ok(sites.every(s=>s.u>0&&s.u<1&&s.v>0&&s.v<1));assert.ok([0,1].includes(b.dread.finish.damageVariant));
  }
  assert.equal(new Set(plans).size,4);
  const b=f.boss.create(6);f.scope.SpaceDreadnoughtEnding.begin(b);b.dread.finish.phase='hold';b.dread.finish.damageStage=6;
  f.scope.SpaceFlightRandom=()=>{throw Error('render must not consume replay randomness');};
  const noop=()=>{},brush=new Proxy({}, {get:()=>noop});
  f.scope.SpaceDreadnoughtEnding.drawScene(brush,b,[{ship:'kestrel',hp:3,x:640,y:570}]);
});

test('overview pins a tiny pilot before the bridge and escape cuts back to the deck at full size',()=>{
  const {f,b,api}=finaleFixture(),draws=[],noop=()=>{},brush=new Proxy({}, {get:()=>noop});
  f.scope.SpaceArt.draw=(ctx,ship,x,y,w,h)=>draws.push({x,y,w,h});
  b.dread.finish.phase='hold';b.dread.finish.age=2;
  f.scope.SpaceDreadnoughtEnding.drawScene(brush,b,[api.pilots[0]]);
  near(draws[0].x,640);near(draws[0].y,330-(.69-.5)*580);near(draws[0].w,8/3);
  b.dread.finish.phase='escape';b.dread.finish.age=0;api.pilots[0].x=640;api.pilots[0].y=570;
  f.scope.SpaceDreadnoughtEnding.drawScene(brush,b,[api.pilots[0]]);
  near(draws[1].w,84);near(draws[1].y,570);
  b.dread.finish.age=.78;f.scope.SpaceDreadnoughtEnding.drawScene(brush,b,[api.pilots[0]]);
  assert.ok(draws[2].y<0,'hyperspace takes the pilot out through the top');
});

test('a missed reactor raises the cumulative quota by 20 solo or 30 co-op and returns to combat',()=>{
  for(const coop of [false,true]){
    const {f,b,api,advance}=finaleFixture(coop);
    advance(3.26);assert.equal(b.dread.finish.phase,'closed');
    f.scope.SpaceDreadnoughtEnding.fire(b,0,api,b.dread.finish.attempt,3.25);
    assert.equal(b.dread.finish.phase,'closed','250 ms endpoint is already too late');
    advance(coop?1.4:.4);assert.equal(b.dread.finish,null);
    assert.equal(b.dread.required,coop?180:120);assert.equal(b.hp,coop?30:20);
    b.dread.kills=b.dread.required;f.scope.SpaceDreadnought.update(b,.01,api);
    assert.equal(b.dread.finish.phase,'countdown');
  }
});

test('co-op accepts delayed in-window guest input only for the current attempt',()=>{
  const {f,b,api,advance}=finaleFixture(true);advance(3.6);
  const id=b.dread.finish.attempt;
  f.scope.SpaceDreadnoughtEnding.fire(b,1,api,id+1,3.2);assert.equal(b.dread.finish.phase,'closed');
  f.scope.SpaceDreadnoughtEnding.fire(b,1,api,id,3.2);assert.equal(b.dread.finish.phase,'missile');
  assert.equal(b.dread.finish.seat,1);near(b.dread.finish.start.x,700);
});

test('reactor command from either co-op seat replays the same finale state on host and guest',()=>{
  const host=createFlight(),guest=createFlight(),lab={boss:6,phase:1,level:3};
  host.start('host',lab);guest.start('guest',lab);sync(host,guest);
  for(const actor of [host,guest]){
    const b=actor.probe.world().boss;b.clock=32;b.dread.kills=150;
    b.dread.nextGrid=999;b.dread.nextWave=999;b.dread.nextSpawn=999;
  }
  step(host,guest);
  for(let i=0;i<186;i++)step(host,guest);
  assert.deepEqual(jsonCopy(host.probe.world().boss.dread.finish.damageSites),jsonCopy(guest.probe.world().boss.dread.finish.damageSites));
  const id=host.probe.world().boss.dread.finish.attempt;
  const frame={controls:[controls,controls],commands:[['dread-core-fire',1,id,3.1]]};
  host.probe.runStep(frame);guest.probe.runStep(jsonCopy(frame));
  for(let i=0;i<240;i++)step(host,guest);
  assert.deepEqual(jsonCopy(host.probe.world().boss.dread),jsonCopy(guest.probe.world().boss.dread));
  assert.equal(host.probe.world().boss.dread.finish.phase,'chain');
  sync(host,guest);
  assert.equal(guest.probe.world().boss.dread.finish.phase,'chain','reconnect keeps finale phase');
  for(let i=0;i<900;i++){
    step(host,guest);
    if(i%60===0){host.probe.drawScene();guest.probe.drawScene();}
  }
  assert.equal(host.probe.world().boss,null);
  assert.equal(host.probe.world().dreadDeparted,true);
  assert.equal(host.probe.world().dreadAftermath.dread.finish.damageStage,6);
  assert.deepEqual(jsonCopy(host.probe.world().dreadAftermath),jsonCopy(guest.probe.world().dreadAftermath));
  host.probe.drawScene();guest.probe.drawScene();
});

test('sprinkler fires all four rotating muzzles simultaneously with one sound cue',()=>{
  const f=createFlight(),b=f.boss.create(6),events=[];
  b.clock=28.5;b.dread.nextGrid=999;b.dread.nextWave=999;b.dread.nextSpawn=999;
  const turret={id:'deck-test',type:'sprinkler',x:640,y:180,hp:null,angle:.43,next:999,charge:.001};
  b.dread.turrets.push(turret);
  const api={pilots:[{x:640,y:650,hp:3}],sound:k=>events.push(k),damage(){}};
  f.scope.SpaceDreadnought.update(b,.002,api);
  assert.equal(b.dread.projectiles.length,4);
  for(const [i,p] of b.dread.projectiles.entries()){
    near(p.angle,turret.angle+i*Math.PI/2);
    near(Math.atan2(p.y-turret.y,p.x-turret.x),Math.atan2(Math.sin(p.angle),Math.cos(p.angle)));
  }
  assert.deepEqual(events,['sprinklerFire']);
});

test('dreadnought guns emit distinct cues, sprinkler is indestructible, kills award once', () => {
  const f=createFlight(),b=f.boss.create(6,{coop:true}),c=f.scope.SpaceDreadnoughtConfig;
  const events=[],pilot={x:640,y:650,hp:3},api={pilots:[pilot],sound:k=>events.push(k),damage:()=>{},miniBlast:()=>{},award:()=>{}};
  b.clock=c.introSeconds;b.dread.time=80;b.dread.nextGrid=999;b.dread.nextWave=999;b.dread.nextSpawn=999;
  for(const [i,type] of Object.keys(c.types).entries())b.dread.turrets.push({id:'deck-'+i,type,x:160+i*150,y:100,hp:c.types[type].hp,max:c.types[type].hp,angle:Math.PI/2,next:0,charge:0});
  f.scope.SpaceDreadnought.update(b,.01,api);
  assert.ok(events.includes('laserCharge'));assert.ok(events.includes('orbCharge'));
  for(let i=0;i<120;i++)f.scope.SpaceDreadnought.update(b,.01,api);
  for(const name of ['fanFire','orbFire','twinFire','missileLaunch','shotgunLaunch','sprinklerFire','laserFire'])assert.ok(events.includes(name),name);
  assert.ok(b.dread.projectiles.length<=c.maxProjectiles);
  const sprinkler=b.dread.turrets.find(t=>t.type==='sprinkler');
  f.scope.SpaceDreadnought.hit(b,sprinkler.id,999,api);assert.equal(sprinkler.hp,null);
  const target=b.dread.turrets.find(t=>t.type==='fan');
  f.scope.SpaceDreadnought.hit(b,target.id,999,api);assert.equal(b.dread.kills,1);
  f.scope.SpaceDreadnought.hit(b,target.id,999,api);assert.equal(b.dread.kills,1);
  assert.ok(events.includes('turretExplosion'));
});

test('co-op replays the host fleet roster and warns for three seconds before entry', () => {
  const host = createFlight();
  const guest = createFlight(['local', 'deck', 'never', 'used', 'here', 'guest']);
  host.start('host');
  guest.start('guest');
  sync(host, guest);
  const world = host.probe.world();
  assert.equal(world.pendingFleet, null);
  assert.equal(world.formation.id, 1);
  assert.ok(world.formation.age < 0);
  for (let i = 0; i < 239; i++) assert.equal(step(host, guest), undefined);
  assert.equal(world.pendingFleet, null);
  const plans = step(host, guest);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].ships.length, 6);
  near(world.fleetClock, 3);
  assert.deepEqual(jsonCopy(guest.probe.world().pendingFleet), jsonCopy(world.pendingFleet));

  // A reconnection during the warning restores the same announced fleet.
  sync(host, guest);
  assert.equal(guest.probe.world().pendingFleet.id, 2);
  assert.equal(host.probe.signature(), guest.probe.signature());
  for (let i = 0; i < 179; i++) assert.equal(step(host, guest), undefined);
  assert.equal(world.reserve.length, 0);
  step(host, guest);
  assert.equal(world.pendingFleet, null);
  assert.equal(world.reserve[0].id, 2);
  assert.deepEqual(jsonCopy(guest.probe.world().reserve), jsonCopy(world.reserve));
  assert.equal(host.probe.signature(), guest.probe.signature());
});

test('Boss Lab sends both pilots straight to the selected encounter and applies co-op cooldowns', () => {
  const host = createFlight();
  const guest = createFlight();
  const lab = { boss: 4, phase: 2, level: 6, skillIndex: 0 };
  host.start('host', lab);
  guest.start('guest', lab);
  sync(host, guest);
  for (const player of [host, guest]) {
    const world = player.probe.world();
    assert.equal(world.phase, 'core');
    assert.equal(world.practice, true);
    assert.equal(world.boss.index, 4);
    assert.equal(world.boss.phase, 2);
    assert.equal(world.boss.practiceSkill, 0);
    assert.equal(world.player.level, 6);
    assert.equal(world.wingman.level, 6);
  }
  step(host, guest);
  near(host.probe.world().boss.miner.next[0], 1.4);
  near(guest.probe.world().boss.miner.next[0], 1.4);
  near(host.boss.cooldown(host.boss.create(4), 2), 2);
});

test('pilots lose their own lives, respawn with one second of immunity, and buy their own extra life', () => {
  const host = createFlight();
  host.start('host');
  const world = host.probe.world();
  const { player, wingman } = world;
  assert.equal(player.hp, 3);
  assert.equal(wingman.hp, 3);
  assert.equal(player.shields, undefined);
  player.level = 3;
  const before = { x: player.x, y: player.y };
  host.probe.damage(false, player);
  assert.equal(player.hp, 2);
  assert.equal(wingman.hp, 3);
  assert.equal(player.level, 2);
  assert.ok(player.y > 720);
  assert.ok(world.miniBlasts.some(blast => blast.x === before.x && blast.y === before.y));
  host.probe.damage(false, player);
  assert.equal(player.hp, 2);
  host.probe.advancePilot(player, controls, 0.4, 0);
  assert.ok(player.y < 720 && player.y > 605);
  host.probe.advancePilot(player, controls, 0.4, 0);
  near(player.y, 605);
  near(player.grace, 1);
  host.probe.damage(true, player);
  assert.equal(player.hp, 2);
  host.probe.advancePilot(player, controls, 1, 0);
  host.probe.damage(false, player);
  assert.equal(player.hp, 1);

  world.phase = 'dock-shop';
  world.credits = 200;
  host.probe.executeDockShopBuy(1);
  host.probe.executeDockShopBuy(1);
  assert.equal(wingman.hp, 4);
  assert.equal(player.hp, 1);
  assert.equal(world.credits, 100);
});

test('boss five holds both pilots for the fleet arrival then resumes regular fleets', () => {
  const host=createFlight(), guest=createFlight();
  host.start('host');guest.start('guest');sync(host,guest);
  for(const peer of [host,guest]){
    const world=peer.probe.world();
    world.bossIndex=5;world.phase='reward';world.phaseTime=1.59;
    world.row.forEach(ship=>{ship.popped=true;});
  }
  step(host,guest);
  assert.equal(host.probe.world().phase,'fleet-omen');
  const before=host.probe.world().player.y;
  for(let i=0;i<389;i++)step(host,guest);
  assert.equal(host.probe.world().phase,'fleet-omen');
  assert.equal(host.probe.world().player.y,before);
  for(let i=0;i<3;i++)step(host,guest);
  assert.equal(host.probe.world().phase,'fleet-wait');
  assert.equal(guest.probe.world().phase,'fleet-wait');
  for(let i=0;i<181;i++)step(host,guest);
  assert.equal(host.probe.world().phase,'arrival');
  assert.equal(guest.probe.world().phase,'arrival');
  assert.equal(host.probe.signature(),guest.probe.signature());
});

test('solo radio holds the belt while co-op Boss Lab starts both pilots immediately', () => {
  const solo=createFlight(), host=createFlight(),guest=createFlight();
  solo.game.startBossPractice(5,'kestrel');
  const world=solo.probe.world(), story=solo.scope.SpaceStory;
  assert.equal(world.scene,'intercept');
  const before=world.boss.clock;
  solo.probe.tick(.1);
  assert.equal(world.boss.clock,before);
  assert.equal(solo.probe.unpack(jsonCopy(solo.probe.pack()),true).scene,'intercept');
  for(const _ of story.scenes.intercept)solo.probe.advanceDialogue();
  assert.equal(world.phase,'core');
  assert.notEqual(story.cast.unknown[1],story.cast.malrec[1]);
  assert.notEqual(story.nameColor('veyr'),story.nameColor('kite'));
  assert.equal(story.nameColor('unknown'),story.nameColor('veyr'));

  host.start('host',{boss:5});guest.start('guest',{boss:5});sync(host,guest);
  step(host,guest);
  for(const peer of [host,guest]){
    assert.equal(peer.probe.world().phase,'core');
    assert.ok(peer.probe.world().boss.clock>0);
  }
});

test('a solo pilot can disable dialogue mid-transmission and keep that choice across encounters', () => {
  const {scope,game,probe}=createFlight();
  const story=scope.SpaceStory;
  assert.equal(story.enabled,true);
  game.startBossPractice(5,'kestrel');
  assert.equal(probe.world().phase,'dialogue');
  game.pause();
  story.setEnabled(false);
  game.resume();
  probe.tick(.02);
  assert.equal(probe.world().phase,'core');
  game.startBossPractice(5,'kestrel');
  assert.equal(probe.world().phase,'core');
  scope.SpaceCampaign={departure:.1,duration:.2,audioCues:[],draw(){}};
  game.start('kestrel');
  assert.equal(probe.world().phase,'cinematic');
  probe.tick(.21);
  assert.equal(probe.world().phase,'arrival');
  story.setEnabled(true);
  game.start('kestrel');
  probe.tick(.21);
  assert.equal(probe.world().phase,'briefing');
  probe.advanceDialogue(true);
  assert.equal(probe.world().phase,'arrival');
});

test('the co-op opening and sector rewards advance on both seats without radio input', () => {
  const host=createFlight(),guest=createFlight();
  guest.scope.SpaceStory.setEnabled(false);
  for(const peer of [host,guest])peer.scope.SpaceCampaign={duration:.01,audioCues:[],draw(){}};
  host.start('host');guest.start('guest');sync(host,guest);
  step(host,guest);
  assert.equal(host.probe.world().phase,'arrival');
  assert.equal(guest.probe.world().phase,'arrival');
  for(const [index,expected] of [[1,'fleet-wait'],[2,'dock-shop'],[3,'fleet-wait'],[4,'dock-shop']]){
    for(const peer of [host,guest]){
      const w=peer.probe.world();
      Object.assign(w,{bossIndex:index,cleared:index*10,phase:'reward',phaseTime:1.59,shopVisited:false});
    }
    step(host,guest);
    for(const peer of [host,guest])assert.equal(peer.probe.world().phase,expected);
    assert.equal(host.probe.signature(),guest.probe.signature());
  }
});

test('a room saved mid-line resumes on a shared step and replays the same next fleet', () => {
  const previous=createFlight();previous.start('host');
  const saved=previous.probe.pack();
  Object.assign(saved,{bossIndex:1,cleared:10,phase:'dialogue',scene:'boss1',line:2,rewarded:1});
  const host=createFlight(),guest=createFlight();
  host.scope.sessionStorage.getItem=key=>key==='space_dominators_checkpoint_v1'
    ? JSON.stringify({match:'fixture',savedAt:1,world:saved}):null;
  host.start('host');guest.start('guest');sync(host,guest);
  step(host,guest);
  assert.equal(host.probe.world().phase,'fleet-wait');
  assert.equal(host.probe.signature(),guest.probe.signature());
});

test('co-op finishes after the void and nine fleet jump cues without a final transmission', () => {
  const host=createFlight(), guest=createFlight(), cues=[[],[]];
  host.start('host');guest.start('guest');sync(host,guest);
  for(const [seat,peer] of [host,guest].entries()){
    const w=peer.probe.world();
    peer.scope.SpaceSound.fleetCue=(cue,previous,time)=>{
      const start=cue.impact-1.41;
      if(previous<start && time>=start)cues[seat].push(cue.impact);
    };
    w.bossIndex=6;w.rewarded=6;w.dreadDeparted=true;w.phase='reward';w.phaseTime=1.59;
  }
  step(host,guest);
  for(let i=0;i<125;i++)step(host,guest);
  assert.equal(host.probe.world().phase,'chapter-fleet');
  assert.deepEqual(cues,[[],[]]);
  sync(host,guest);
  for(let i=0;i<430;i++)step(host,guest);
  for(const peer of [host,guest]){
    assert.equal(peer.probe.world().state,'ended');
  }
  assert.equal(new Set(cues[0]).size,9);assert.deepEqual(cues[0],cues[1]);
  for(const peer of [host,guest]){
    assert.equal(peer.probe.world().outcome,'victory');assert.equal(peer.probe.world().bossIndex,6);
  }
});

test('white escorts flank the flagship with port lower and a small purple hull in the rear', async () => {
  const {scope}=createFlight(), fleet=scope.SpaceFleetStudy, ships=[];
  await fleet.load();
  const ctx={save(){},restore(){},fillRect(){},drawImage(image,x,y,width,height){
    ships.push({model:image.url.split('/').pop(),x:x+width/2,y:y+height/2,width});
  }};
  fleet.draw(ctx,fleet.duration);
  assert.equal(ships.length,9);
  const flagship=ships.at(-1);
  assert.equal(flagship.model,'fleet-lab-dreadnought.png');
  const escorts=ships.slice(0,-1).filter(s=>s.model==='fleet-lab-imperial.png');
  assert.equal(escorts.length,2);
  assert.ok(escorts[0].x<flagship.x && escorts[1].x>flagship.x);
  for(const ship of escorts)assert.ok(Math.abs(ship.x-flagship.x)<flagship.width/3 && ship.y<flagship.y);
  const rear=ships.slice(0,-1).find(ship=>ship.model===flagship.model);
  assert.ok(rear && rear.x<flagship.x && rear.y<escorts[0].y && rear.width<escorts[0].width);
  assert.ok(escorts[0].y>escorts[1].y,'port escort sits below starboard');
  for(let frame=0;frame<=Math.round(fleet.duration*60);frame++){
    ships.length=0;
    fleet.draw(ctx,frame/60);
    const [port,starboard]=ships.filter(ship=>ship.model==='fleet-lab-imperial.png');
    if(!starboard)continue;
    const clearance=(starboard.x-starboard.width/2)-(port.x+port.width/2);
    assert.ok(clearance>=120,'white escorts need clear space at frame '+frame);
  }
});
