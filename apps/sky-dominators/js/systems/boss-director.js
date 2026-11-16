/* Boss scheduling and combat are driven by the existing game update, never timers. */
(function(r,f){const api=f(typeof module==='object'&&module.exports?require('../entities/bosses/sky-fortress'):r.SkyFortress,typeof module==='object'&&module.exports?require('../entities/bosses/continental-bomber'):r.SkyContinental,typeof module==='object'&&module.exports?require('../entities/bosses/drone-swarm'):r.SkyDroneSwarm,typeof module==='object'&&module.exports?require('../entities/bosses/titanus-veronica'):r.SkyTitanus);if(typeof module==='object'&&module.exports)module.exports=api;else r.SkyBosses=api;})(globalThis,function(Fortress,Continental,Swarm,Titanus){
'use strict';
// Health is rounded from the original pools at one-third scale; never rescaled at spawn.
const STAGES=Object.freeze([
 {id:1,round:10,hp:27,reward:5000},
 {id:2,round:20,hp:53,reward:10000},
 {id:3,round:30,hp:Fortress.CONFIG.maxHp,reward:10000},
 {id:4,round:40,hp:107,reward:10000},
 {id:5,round:50,hp:Swarm.CONFIG.maxHp,reward:10000},
 {id:6,round:60,hp:Titanus.CONFIG.maxHp,reward:10000}
]);
function segmentBox(x0,y0,x1,y1,cx,cy,hw,hh){let lo=0,hi=1;for(const [p,d,min,max] of [[x0,x1-x0,cx-hw,cx+hw],[y0,y1-y0,cy-hh,cy+hh]]){if(Math.abs(d)<1e-9){if(p<min||p>max)return false;}else{let a=(min-p)/d,b=(max-p)/d;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return false;}}return true;}
const BOSS_MISSILE_SPEED_MULTIPLIER=3.0;
const BOSS_MISSILE_INTERVAL_MS=2000;
const HELICOPTER_BURST=Object.freeze({count:5,spacingMs:250,chargeMs:500,cooldownMs:2000});
class Director{
 static get missileInterval(){return BOSS_MISSILE_INTERVAL_MS;}
 static missileSpeed(baseSpeed){return baseSpeed*BOSS_MISSILE_SPEED_MULTIPLIER;}
 constructor(hooks){this.h=hooks;this.reset('initial');}
 reset(runId,completed=[]){this.titanus?.abort();this.titanus=null;this.swarm?.abort();this.swarm=null;this.continental?.abort();this.continental=null;this.fortress=null;this.runId=runId;this.completed=new Set(completed);this.phase='regular';this.boss=null;this.elapsed=0;this.shots=[];this.warnings=[];this.burst=[];this.seen=new Set();this.attackClock=0;this.serial=0;this.resetMissileBurst();}
 get blocksRegular(){return this.phase!=='regular';}
 get canShoot(){
  if(this.titanus)return this.titanus.canShoot;
  if(this.swarm)return this.swarm.canShoot;
  return this.phase==='regular'||this.phase==='fight';
 }
 targets(){if(this.titanus)return this.titanus.targets();if(this.swarm)return this.swarm.targets();if(this.continental)return this.continental.targets();return this.fortress?this.fortress.targets():this.phase==='fight'&&this.boss?.hp>0?[this.boss]:[];}
 priorityTarget(){const {player}=this.h.context();return this.targets().slice().sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0]||null;}
 rowCompleted(count){if(this.blocksRegular)return false;const cfg=STAGES.find(x=>!this.completed.has(x.id));if(!Number.isInteger(count)||!cfg||count!==cfg.round)return false;this.phase='intro';this.elapsed=0;const {w}=this.h.context();this.boss={...cfg,maxHp:cfg.hp,active:true,x:w/2,y:265,age:0,hitFlash:0};this.seen.clear();this.shots=[];this.warnings=[];this.burst=[];this.resetMissileBurst();this.h.suspend?.(cfg);if(cfg.id===3)this.fortress=new Fortress.Encounter(this,segmentBox);if(cfg.id===4)this.continental=new Continental.Encounter(this,segmentBox,Director);if(cfg.id===5)this.swarm=new Swarm.TacticalDroneSwarm(this,segmentBox);if(cfg.id===6)this.titanus=new Titanus.Encounter(this,segmentBox);return true;}
 hit(attack){if(this.titanus)return this.titanus.hit(attack);if(this.swarm)return this.swarm.hit(attack);if(this.continental)return this.continental.hit(attack);if(this.fortress)return this.fortress.hit(attack);const b=this.boss;if(this.phase!=='fight'||!b||b.hp<=0||!attack?.collision||!attack.token||this.seen.has(attack.token)||!this.h.validAttack(attack))return false;
  const baseDamage=attack.kind==='bomber'?20:attack.kind==='phantom'?30:attack.damage;
  const damage=baseDamage*(this.h.damageMultiplier?.(b,attack)??1);
  if(!Number.isFinite(damage)||damage<=0)return false;this.seen.add(attack.token);b.hp=Math.max(0,b.hp-damage);b.hitFlash=90;this.h.impact?.(b,attack);
  if(b.hp===0){b.active=false;this.phase='victory';this.elapsed=0;this.shots=[];this.warnings=[];this.burst=[];if(!this.completed.has(b.id)){this.completed.add(b.id);this.h.victory?.(b,this.runId+':boss:'+b.id,attack);} }return true;
 }
 resetMissileBurst(){this.missileClock=0;this.nextMissileBurstAt=0;this.missileChargeIndex=0;}
 warn(index){const b=this.boss,{player}=this.h.context();this.warnings.push({index,chargedAt:this.missileClock,x:b.x,y:b.y+18*(b.renderScale||1),targetX:player.x,targetY:player.y,age:0,duration:HELICOPTER_BURST.chargeMs});}
 launch(w){w.firedAt=this.missileClock;this.boss.launchFlash=160;const angle=Math.atan2(w.targetY-w.y,w.targetX-w.x),speed=Director.missileSpeed(205*1.5);this.shots.push({kind:'missile',spawnedAt:this.missileClock,x:w.x,y:w.y,px:w.x,py:w.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,angle,age:0});this.h.launch?.(w);}
 turretBurst(){const b=this.boss,{player}=this.h.context();for(let side=0;side<2;side++){const x=b.x+(side?48:-48)*(b.renderScale||1),y=b.y+12*(b.renderScale||1),angle=Math.atan2(player.y-y,player.x-x);this.burst.push({delay:side*220,side,x,y,angle});}}
 update(dt){
  if(this.titanus){this.titanus.update(dt);return;}
  if(this.swarm){this.swarm.update(dt);return;}if(this.continental){this.continental.update(dt);return;}if(this.fortress){this.fortress.update(dt);return;}
  let left=Math.max(0,Number.isFinite(dt)?dt:0);
  do {
   if(this.phase==='regular'||!this.boss)return;
   let slice=Math.min(left,16);
   if(this.phase==='intro')slice=Math.min(slice,1200-this.elapsed);
   else if(this.phase==='victory')slice=Math.min(slice,1600-this.elapsed);
   else {
    if(this.missileChargeIndex<HELICOPTER_BURST.count)slice=Math.min(slice,Math.max(0,this.nextMissileBurstAt+this.missileChargeIndex*HELICOPTER_BURST.spacingMs-this.missileClock));
    for(const q of this.warnings)slice=Math.min(slice,Math.max(0,q.duration-q.age));
   }
   this.step(slice);left-=slice;
  }while(left>1e-7);
 }
 step(dt){if(this.titanus){this.titanus.update(dt);return;}if(this.swarm){this.swarm.update(dt);return;}if(this.continental){this.continental.update(dt);return;}if(this.fortress){this.fortress.update(dt);return;}if(this.phase==='regular')return;const b=this.boss;if(!b)return;this.elapsed+=dt;b.age+=dt;b.hitFlash=Math.max(0,b.hitFlash-dt);b.launchFlash=Math.max(0,(b.launchFlash||0)-dt);
  if(this.phase==='intro'){if(this.elapsed>=1200){this.phase='fight';this.elapsed=0;this.resetMissileBurst();this.warn(0);this.missileChargeIndex=1;this.gunTimer=600;this.gunPause=0;}return;}
  if(this.phase==='victory'){if(this.elapsed>=1600){this.phase='regular';this.boss=null;this.h.resume?.();}return;}
  const {w,h,player,bullets}=this.h.context();const fixed=this.h.positionBoss?.(b,dt);if(fixed){Object.assign(b,fixed);if(b.kind==='escort')b.fortressVisualBox={x:b.x,y:b.y,w:158.4*(b.renderScale||1),h:176*(b.renderScale||1)};}else {
   const layout=this.h.layout?.()||{},halfW=b.id===1?84:113.3,halfH=b.id===1?98:88;
   const minY=Math.max(170,(layout.hudBottom||145)+12)+halfH,maxY=Math.max(minY,Math.min(h*.57,(layout.controlsTop||h-30)-halfH-12));
   const centerY=Math.min(Math.max(285,minY),maxY),sweep=Math.max(0,Math.min(b.id===1?105:125,w/2-halfW-12));
   b.x=w/2+Math.sin(b.age/1900)*sweep;
   b.y=centerY+Math.min(56,maxY-centerY)*(1-Math.cos(b.age/1450))*.5;
  }
  this.missileClock+=dt;this.gunTimer+=dt;this.gunPause=Math.max(0,this.gunPause-dt);
  for(let i=this.warnings.length-1;i>=0;i--){const q=this.warnings[i];q.x=b.x;q.y=b.y+18*(b.renderScale||1);q.age+=dt;
   if(q.age+1e-7>=q.duration){this.launch(q);this.warnings.splice(i,1);this.gunPause=900;
    if(q.index===HELICOPTER_BURST.count-1){this.nextMissileBurstAt=this.missileClock+HELICOPTER_BURST.cooldownMs;this.missileChargeIndex=0;}
   }
  }
  // Five independent 500ms locks; launches span exactly 1000ms (250ms apart).
  // The next charge begins 2000ms after the fifth launch; cooldown never overlaps charging.
  if(this.missileChargeIndex<HELICOPTER_BURST.count&&this.missileClock+1e-7>=this.nextMissileBurstAt+this.missileChargeIndex*HELICOPTER_BURST.spacingMs){this.warn(this.missileChargeIndex++);}
  if(b.id===2&&this.gunTimer>=2400){this.gunTimer=0;this.turretBurst();}
  for(let i=this.burst.length-1;i>=0;i--){const q=this.burst[i];q.delay-=dt;if(q.delay<=0){if(q.side!==undefined){q.x=b.x+(q.side?48:-48)*(b.renderScale||1);q.y=b.y+12*(b.renderScale||1);}for(const spread of [-.30,-.18,-.06,.06,.18,.30]){const angle=q.angle+spread;this.shots.push({kind:'bullet',x:q.x+Math.cos(q.angle)*16,y:q.y+Math.sin(q.angle)*16,px:q.x+Math.cos(q.angle)*16,py:q.y+Math.sin(q.angle)*16,vx:Math.cos(angle)*180,vy:Math.sin(angle)*180,angle,age:0});}this.h.gun?.(q);this.burst.splice(i,1);}}
  for(const p of bullets){if(!p.active)continue;const hw=(b.id===1?47:78)*(b.renderScale||1),hh=(b.id===1?85:76)*(b.renderScale||1);
   if(segmentBox(p.prevX??p.x,p.prevY??p.y,p.x,p.y,b.x,b.y,hw,hh)){
    const kind=p.bomberSpecial?'bomber':p.isSpecial?'phantom':'normal';const token=kind==='phantom'?'phantom:'+p.skillGeneration:p.attackId;
    this.hit({kind,token,damage:p.damage,collision:true,projectile:p,skinId:p.skinId});p.active=false;if(this.phase!=='fight')return;
   }
  }
  for(let i=this.shots.length-1;i>=0;i--){const p=this.shots[i];p.px=p.x;p.py=p.y;const motionDt=p.spawnedAt===undefined?dt:Math.min(dt,Math.max(0,this.missileClock-p.spawnedAt));p.x+=p.vx*motionDt/1000;p.y+=p.vy*motionDt/1000;p.age+=motionDt;
   if(segmentBox(p.px,p.py,p.x,p.y,player.x,player.y,player.hitboxWidth*.39,player.hitboxHeight*.325)){this.shots.splice(i,1);this.h.playerHit?.(p);if(this.phase!=='fight')return;}
   else if(p.age>9000||p.x<-60||p.x>w+60||p.y<-80||p.y>h+80)this.shots.splice(i,1);
  }
 }
 abort(){this.resetMissileBurst();this.titanus?.abort();this.titanus=null;this.swarm?.abort();this.swarm=null;this.continental?.abort();this.continental=null;this.fortress=null;this.phase='regular';this.boss=null;this.shots=[];this.warnings=[];this.burst=[];}
 draw(ctx,art){if(this.titanus){this.titanus.draw(ctx);return;}if(this.swarm){this.swarm.draw(ctx,art);return;}if(this.continental){this.continental.draw(ctx,art);return;}if(this.fortress){this.fortress.draw(ctx,art);return;}const b=this.boss;if(!b)return;const {player,w}=this.h.context();ctx.save();ctx.imageSmoothingEnabled=false;
  for(const q of this.warnings){ctx.strokeStyle='rgba(255,64,64,'+(.35+.6*q.age/q.duration)+')';ctx.lineWidth=1+2*q.age/q.duration;ctx.setLineDash([7,5]);ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.targetX,q.targetY);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(q.targetX,q.targetY,15+4*Math.sin(q.age/70),0,Math.PI*2);ctx.stroke();}
  if(this.phase!=='victory'){ctx.save();ctx.translate(b.x,b.y);ctx.scale(b.renderScale||1,b.renderScale||1);if(this.phase==='intro')ctx.translate(0,-230*(1-Math.min(1,this.elapsed/1200)));if(b.hitFlash)ctx.globalAlpha=.6;
   if(b.id===1){art(ctx,'assets/bosses/boss1/body.png',0,0,110,196);art(ctx,'assets/bosses/boss1/launcher.png',0,-35,36,36);for(const x of [-46,46])for(const y of [-10,40]){ctx.save();ctx.translate(x,y);ctx.rotate(b.age/75);art(ctx,'assets/bosses/boss1/rotor.png',0,0,76,76);ctx.restore();}}
   else{const base='assets/bosses/boss2/';art(ctx,base+'body/boss01_body.png',0,0,158.4,176);art(ctx,base+'missile_launcher/boss01_missile_launcher.png',0,-41,28.6,30.8);
    for(const side of [-1,1]){const x=side*49.5,y=0;ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(player.y-(b.y+y*(b.renderScale||1)),player.x-(b.x+x*(b.renderScale||1)))-Math.PI/2);art(ctx,base+'turrets/'+(side<0?'left/boss01_turret_left.png':'right/boss01_turret_right.png'),0,4.4,19.8,26.4);ctx.restore();}
    let rotor=1;for(const y of [-36.3,36.3])for(const x of [-69.3,69.3]){const n=Math.floor(b.age/50)%4+1;art(ctx,base+'rotors/rotor_'+rotor+'/boss01_rotor_'+rotor+'_frame_0'+n+'.png',x,y,88,88);rotor++;}
   }if(b.launchFlash)art(ctx,'assets/bosses/boss2/effects/boss01_muzzle_flash.png',0,28,22,34);ctx.restore();
  }
  for(const p of this.shots){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle-Math.PI/2);art(ctx,p.kind==='missile'?'assets/bosses/boss1/missile.png':'assets/bosses/boss2/projectiles/boss01_gun_projectile.png',0,0,p.kind==='missile'?13:9,p.kind==='missile'?42:20);ctx.restore();}
  if(this.h.hideHUD){ctx.restore();return;}ctx.textAlign='center';
  if(this.phase==='victory'){ctx.fillStyle='#fbbf24';ctx.font='bold 21px monospace';ctx.fillText('BOSS '+b.id+' DEFEATED',w/2,150);ctx.fillText('+'+b.reward.toLocaleString()+' POINTS',w/2,180);}ctx.restore();
 }
}
return {Director,STAGES,segmentBox,HELICOPTER_BURST};
});
