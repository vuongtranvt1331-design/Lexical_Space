/* Continental Bomber: shares the existing Director clock, damage hooks and Boss 2 implementation. */
(function(r,f){const api=f();if(typeof module==='object'&&module.exports)module.exports=api;else r.SkyContinental=api;})(globalThis,function(){
'use strict';
const BASE='assets/bosses/continental_bomber/';
const ART={"engine":["engine/frame_01.png","engine/frame_02.png","engine/frame_03.png","engine/frame_04.png"],"missile_launch":["missile_launch/frame_01.png","missile_launch/frame_02.png","missile_launch/frame_03.png","missile_launch/frame_04.png"],"ballistic_missile":["ballistic_missile/frame_01.png","ballistic_missile/frame_02.png","ballistic_missile/frame_03.png","ballistic_missile/frame_04.png"],"bomb":["bomb/frame_01.png","bomb/frame_02.png","bomb/frame_03.png","bomb/frame_04.png"],"bomb_warning":["bomb_warning/frame_01.png","bomb_warning/frame_02.png","bomb_warning/frame_03.png","bomb_warning/frame_04.png"],"bomb_impact":["bomb_impact/frame_01.png","bomb_impact/frame_02.png","bomb_impact/frame_03.png","bomb_impact/frame_04.png"],"flight":["flight/frame_01.png","flight/frame_02.png","flight/frame_03.png","flight/frame_04.png"]};
// Random drops unlock at the actual Round 48, independently of score.
const RANDOM_DROP_UNLOCK_ROUND=48;
const RANDOM_DROP_CHARGE_MS=750;
const CONFIG=Object.freeze({entrance:1800,launch:2000,warning:3000,fall:350,impact:350,recovery:650,return:1800,protectionExit:1200,combatReturn:1800,exitReturn:1800,exitHold:2000,thrust:1200,secondWarning:500,warningStep:50,minWarning:100,warningHazard:RANDOM_DROP_CHARGE_MS,fallHazard:350,impactHazard:400});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
function box(p){return {x:p.x,y:p.y,hw:(p.hitboxWidth||p.width*1.3)/2,hh:(p.hitboxHeight||p.height*1.3)/2};}
function circleBox(x,y,r,p){const b=box(p),dx=x-clamp(x,b.x-b.hw,b.x+b.hw),dy=y-clamp(y,b.y-b.hh,b.y+b.hh);return dx*dx+dy*dy<=r*r;}
function sprite(ctx,art,name,age,x,y,w,h,loop=true){const paths=ART[name];if(!paths?.length||(!loop&&age>=paths.length*100))return;const i=loop?Math.floor(age/100)%paths.length:Math.min(paths.length-1,Math.floor(age/100));art(ctx,BASE+paths[i],x,y,w,h);}
class SpawnHazard{
 constructor(h){this.h=h;this.reset();}
 reset(){this.queue=[];this.active=null;this.seen=new Set();this.events=[];this.clock=0;}
 endRound(){if(this.active)this.events.push({type:'round_cancel',id:this.active.id});for(const q of this.queue)this.events.push({type:'round_cancel',id:q.id});this.queue=[];this.active=null;}
 notify(id,round,source){if(!id||!Number.isFinite(round)||round<RANDOM_DROP_UNLOCK_ROUND||this.seen.has(id))return false;this.seen.add(id);this.queue.push({id,round,source});if(!this.active)this.startNext();return true;}
 valid(q){return !this.h.validSource||this.h.validSource(q.source,q.round);}
 startNext(){while(this.queue.length&&!this.valid(this.queue[0]))this.queue.shift();if(!this.queue.length)return;const q=this.queue.shift(),{w,h}=this.h.context(),random=this.h.random||Math.random,type=Math.min(2,Math.floor(random()*3)),radius=[24,30,36][type];this.active={...q,type,radius,x:radius+random()*(w-2*radius),y:2*h/3+radius+random()*(h/3-2*radius),stage:'warning',age:0,impacted:false};this.events.push({type:'selected',id:q.id,at:this.clock,x:this.active.x,y:this.active.y,radius});}
 update(dt){dt=Math.max(0,Number.isFinite(dt)?dt:0);this.clock+=dt;let left=dt;while(this.active){if(!this.valid(this.active)){this.events.push({type:'source_cancel',id:this.active.id,at:this.clock-left});this.active=null;this.startNext();continue;}const a=this.active,duration=a.stage==='warning'?CONFIG.warningHazard:a.stage==='fall'?CONFIG.fallHazard:CONFIG.impactHazard;const used=Math.min(left,duration-a.age);a.age+=used;left-=used;if(a.age<duration)return;
   if(a.stage==='warning'){a.stage='fall';a.age=0;this.events.push({type:'incoming',id:a.id,at:this.clock-left});}
   else if(a.stage==='fall'){a.stage='impact';a.age=0;if(!a.impacted){a.impacted=true;this.events.push({type:'impact',id:a.id,at:this.clock-left});if(circleBox(a.x,a.y,a.radius,this.h.context().player))this.h.hit?.({x:a.x,y:a.y,kind:'continental_hazard',eventId:a.id});}}
   else {this.active=null;this.startNext();return;}if(left<=0)return;
  }}
 draw(ctx,art){const a=this.active;if(!a)return;ctx.save();ctx.imageSmoothingEnabled=false;
  if(a.stage!=='impact'){sprite(ctx,art,'bomb_warning',a.age,a.x,a.y,a.radius*2+6,a.radius*2+6);ctx.strokeStyle='#ffdfad';ctx.lineWidth=1;ctx.beginPath();ctx.arc(a.x,a.y,a.radius,0,Math.PI*2);ctx.stroke();}
  if(a.stage==='fall')sprite(ctx,art,'bomb',a.age,a.x,a.y-130*(1-a.age/CONFIG.fallHazard),20,40);
  if(a.stage==='impact')sprite(ctx,art,'bomb_impact',a.age,a.x,a.y,a.radius*2.3,a.radius*2.3,false);ctx.restore();
 }
}
class Encounter{
 constructor(d,segmentBox,Director){this.d=d;this.segmentBox=segmentBox;this.Director=Director;this.b=d.boss;this.age=0;this.state='entrance';this.phaseAge=0;this.events=[];this.escorts=[];this.series=1;this.wave=0;this.safeIndex=-1;this.missiles=[];this.finished=false;this.escortsSpawned=false;this.setState('entrance');this.updatePose();}
 // Second Sky Bomb series: 500,450,400,350,300ms; floor100ms for longer series.
 warningDuration(){return this.series===2?Math.max(CONFIG.minWarning,CONFIG.secondWarning-Math.max(0,this.wave-1)*CONFIG.warningStep):CONFIG.warning;}
 startSecondSeries(){this.series=2;this.wave=1;this.setState('wave_warning');}
 completeRound(){if(this.exitStarted||this.finished)return false;this.exitStarted=true;this.setState('exit_return');return true;}
 launchVolley(){if(this.age-(this.lastVolleyAt??-Infinity)<this.Director.missileInterval)return false;this.lastVolleyAt=this.age;this.updatePose();this.missiles.push(...[-70,-35,0,35,70].map(dx=>({x:this.b.x+dx,y:this.b.y,speed:this.Director.missileSpeed(360),age:0})));this.launchAge=0;this.events.push({type:'missile_volley',at:this.age});this.d.h.launch?.();}
 setState(s){this.state=s;this.phaseAge=0;this.missileClock=0;this.launchAge=Infinity;this.b.continentalPhase=s;this.events.push({type:'phase',state:s,at:this.age});
  if(s==='launch')this.launchVolley();
  if(s==='wave_warning')this.chooseSafe();
  if(s==='wave_impact'){const p=box(this.d.h.context().player),a=this.safe;if(p.x+p.hw>=this.region.x&&p.x-p.hw<=this.region.x+this.region.w&&p.y+p.hh>=this.region.y&&p.y-p.hh<=this.region.y+this.region.h&&!(p.x-p.hw>=a.x&&p.x+p.hw<=a.x+a.w&&p.y-p.hh>=a.y&&p.y+p.hh<=a.y+a.h))this.d.h.playerHit?.({x:p.x,y:p.y,kind:'continental_grid',wave:this.wave,series:this.series});this.events.push({type:'wave_impact',series:this.series,wave:this.wave,safe:this.safeIndex,at:this.age});}
  if(s==='protection_exit'){this.missiles=[];this.createEscorts();}
 }
 chooseSafe(){const {w,h,player}=this.d.h.context(),limits=this.d.h.maxPlayerBox?.()||{width:150,height:120};this.region={x:0,y:120,w,h:h-165};const cw=w/5,ch=this.region.h/5,sw=Math.max(cw-8,limits.width+20),sh=Math.max(ch-8,limits.height+20),speed=player.speed||280;let candidates=[];
  for(let i=0;i<25;i++){const x=clamp((i%5+.5)*cw,sw/2,w-sw/2),y=clamp(this.region.y+(Math.floor(i/5)+.5)*ch,this.region.y+sh/2,h-45-sh/2);if(Math.hypot(x-player.x,y-player.y)<=speed*(this.series===2?Math.max(0,this.warningDuration()-100):CONFIG.warning-450)/1000)candidates.push({i,x,y});}
  if(!candidates.length)candidates=[{i:12,x:clamp(player.x,sw/2,w-sw/2),y:clamp(player.y,this.region.y+sh/2,h-45-sh/2)}];const changed=candidates.filter(c=>c.i!==this.safeIndex);if(changed.length)candidates=changed;const random=this.d.h.random||Math.random,c=candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))];this.safeIndex=c.i;this.safe={x:c.x-sw/2,y:c.y-sh/2,w:sw,h:sh};// Store each drop once. Telegraph, falling sprite and impact share its position.
  this.bombDrops=Array.from({length:25},(_,i)=>({index:i,x:(i%5+.5)*cw+(this.series===2?(random()-.5)*cw*.7:0),y:this.region.y+(Math.floor(i/5)+.5)*ch})).filter(p=>p.index!==this.safeIndex);
  this.events.push({type:'wave_warning',series:this.series,wave:this.wave,safe:c.i,at:this.age,drops:this.bombDrops.map(p=>({...p}))});
 }
 createEscorts(){if(this.escortsSpawned)return;this.escortsSpawned=true;this.escorts=[-1,1].map((side,index)=>{const entry={side,dead:false};const h={...this.d.h,suspend:()=>{},resume:()=>{},hideHUD:true,positionBoss:b=>{
   const {w,h}=this.d.h.context(),layout=this.d.h.layout?.()||{};
   const top=Math.max(185,(layout.hudBottom||145)+12),bottom=Math.min(h-30,layout.controlsTop||h-30);
   // Rotor tips span226.6px, hull176px. Scale the whole escort, including hitboxes.
   const scale=Math.max(.1,Math.min(1,(w-36)/(2*226.6),(bottom-top)/176));
   const age=b.age||0,outer=113.3*scale+12,inner=Math.max(outer,w/2-79.2*scale-10);
   const center=(outer+inner)/2,sweep=Math.min(55,(inner-outer)/2),left=center+Math.sin(age/1500+index*Math.PI)*sweep;
   const rise=top+88*scale,travel=Math.max(0,Math.min(64,bottom-rise-88*scale));
   return {x:side<0?left:w-left,y:rise+travel*(1-Math.cos(age/1300+index*.8))*.5,renderScale:scale};
  },victory:()=>{entry.dead=true;}};
  entry.director=new this.Director(h);entry.director.reset('continental-escort-'+index,[1,3,4,5]);entry.director.rowCompleted(20);entry.director.phase='fight';entry.director.missileTimer=0;entry.director.gunTimer=0;entry.director.gunPause=0;
  Object.assign(entry.director.boss,{kind:'escort',width:158.4,height:176,ownerBoss:this.b},h.positionBoss(entry.director.boss));return entry;});}
 visible(){return ['entrance','launch','return','protection_exit','combat_return','exit_return','exit_hold','thrusting'].includes(this.state);}
 bodyY(){const {h}=this.d.h.context();if(this.state==='entrance')return h+160-(h-140)*ease(this.phaseAge/CONFIG.entrance);
  if(this.state==='launch')return 300-525*ease((this.phaseAge-1300)/700);
  if(['return','combat_return','exit_return'].includes(this.state))return h+160-(h-140)*ease(this.phaseAge/(this.state==='return'?CONFIG.return:this.state==='combat_return'?CONFIG.combatReturn:CONFIG.exitReturn));
  if(['protection_exit','thrusting'].includes(this.state))return 300-(h+700)*ease(this.phaseAge/(this.state==='protection_exit'?CONFIG.protectionExit:CONFIG.thrust));return 300;}
 updatePose(){const {w}=this.d.h.context();this.b.x=w/2+Math.sin(this.age/900)*3;this.b.y=this.bodyY()+Math.sin(this.age/700)*2;this.b.width=400;this.b.height=224;}
 processBodyShots(){if(!this.visible())return;for(const p of this.d.h.context().bullets){if(!p.active)continue;if(this.segmentBox(p.prevX??p.x,p.prevY??p.y,p.x,p.y,this.b.x,this.b.y,200,112)){
   this.hit({target:this.b,collision:true,projectile:p,token:p.attackId,kind:p.bomberSpecial?'bomber':p.isSpecial?'phantom':'normal'});
  }}}

 targets(){return this.visible()?[this.b,...(this.state==='protection_exit'?this.escorts.filter(e=>!e.dead).flatMap(e=>e.director.targets()):[])]:this.state==='escorts'?this.escorts.filter(e=>!e.dead).flatMap(e=>e.director.targets()):[];}
 hit(a){if(a?.target===this.b){if(!this.visible()||!a.collision||!this.d.h.validAttack(a))return false;if(a.projectile)a.projectile.active=false;return true;}if(!['protection_exit','escorts'].includes(this.state))return false;for(const e of this.escorts){const t=e.director.boss;if(!e.dead&&t&&(!a.target||a.target===t)&&e.director.hit(a))return true;}return false;}
 duration(){return {entrance:CONFIG.entrance,launch:CONFIG.launch,wave_warning:this.warningDuration(),wave_fall:CONFIG.fall,wave_impact:CONFIG.impact,wave_recovery:CONFIG.recovery,return:CONFIG.return,protection_exit:CONFIG.protectionExit,combat_return:CONFIG.combatReturn,exit_return:CONFIG.exitReturn,exit_hold:CONFIG.exitHold,thrusting:CONFIG.thrust}[this.state]??Infinity;}
 transition(){if(this.state==='entrance'){this.d.phase='fight';this.setState('launch');}
  else if(this.state==='launch'){this.missiles=[];this.events.push({type:'departure_complete',at:this.age});this.wave=1;this.setState('wave_warning');}
  else if(this.state==='wave_warning')this.setState('wave_fall');else if(this.state==='wave_fall')this.setState('wave_impact');else if(this.state==='wave_impact')this.setState('wave_recovery');
  else if(this.state==='wave_recovery'){if(this.wave<5){this.wave++;this.setState('wave_warning');}else if(this.series===1)this.setState('return');else this.completeRound();}
  else if(this.state==='return')this.setState('protection_exit');
  else if(this.state==='protection_exit')this.setState('escorts');
  else if(this.state==='combat_return'){this.series=2;this.wave=1;this.setState('launch');}
  else if(this.state==='exit_return')this.setState('exit_hold');
  else if(this.state==='exit_hold')this.setState('thrusting');
  else if(this.state==='thrusting')this.finish();
 }
 finish(){if(this.finished||this.state!=='thrusting'||this.phaseAge<CONFIG.thrust)return;this.finished=true;this.state='exited';this.b.continentalPhase='exited';this.b.active=false;this.b.encounterComplete=true;this.missiles=[];for(const e of this.escorts)e.director.abort();this.escorts=[];this.d.shots=[];this.d.warnings=[];this.d.burst=[];this.d.completed.add(4);this.d.h.encounterComplete?.(this.b,this.d.runId+':boss:4:exit');this.d.phase='regular';this.d.boss=null;this.d.continental=null;this.d.h.resume?.();}
 abort(){this.finished=true;this.missileClock=0;for(const e of this.escorts)e.director.abort();this.escorts=[];this.missiles=[];}
 update(dt){let left=Math.max(0,Number.isFinite(dt)?dt:0);while(left>0&&!this.finished&&this.d.continental===this){const slice=Math.min(left,25,this.duration()-this.phaseAge);this.phaseAge+=slice;this.age+=slice;this.b.age=this.age;this.d.elapsed+=slice;left-=slice;
   this.launchAge+=slice;

   for(const p of this.missiles){p.y-=p.speed*slice/1000;p.age+=slice;}this.missiles=this.missiles.filter(p=>p.y>-100&&p.age<9000);
   if(['protection_exit','escorts'].includes(this.state)){for(const e of this.escorts)if(!e.dead)e.director.update(slice);if(this.state==='escorts'&&this.escorts.every(e=>e.dead)){this.missiles=[];this.setState('combat_return');continue;}}
   this.updatePose();this.processBodyShots();
   if(this.phaseAge>=this.duration())this.transition();if(slice===0&&this.duration()===Infinity)break;
  }}
 drawGrid(ctx,art){const r=this.region,s=this.safe,{w}=this.d.h.context(),cw=r.w/5,ch=r.h/5;ctx.save();ctx.beginPath();ctx.rect(r.x,r.y,r.w,r.h);ctx.rect(s.x,s.y,s.w,s.h);ctx.clip('evenodd');
  ctx.fillStyle=this.state==='wave_impact'?'rgba(255,110,24,.38)':'rgba(215,40,30,.18)';ctx.fillRect(r.x,r.y,r.w,r.h);
  for(const {x,y} of this.bombDrops){if(this.state==='wave_fall')sprite(ctx,art,'bomb',this.phaseAge,x,y-75*(1-this.phaseAge/CONFIG.fall),18,36);else if(this.state==='wave_impact')sprite(ctx,art,'bomb_impact',this.phaseAge,x,y,Math.min(cw,ch)*.8,Math.min(cw,ch)*.8,false);else if(this.state==='wave_warning')sprite(ctx,art,'bomb_warning',this.phaseAge,x,y,30,30);}
  ctx.restore();ctx.strokeStyle='#ff7766';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<=5;i++){ctx.moveTo(i*cw,r.y);ctx.lineTo(i*cw,r.y+r.h);ctx.moveTo(0,r.y+i*ch);ctx.lineTo(w,r.y+i*ch);}ctx.stroke();ctx.fillStyle='rgba(30,245,148,.18)';ctx.fillRect(s.x,s.y,s.w,s.h);ctx.strokeStyle='#60ffbb';ctx.lineWidth=3;ctx.strokeRect(s.x,s.y,s.w,s.h);ctx.fillStyle='#c6ffdd';ctx.font='bold 13px monospace';ctx.fillText('SAFE',s.x+s.w/2,s.y+s.h/2);
 }
 draw(ctx,art){const {w,h}=this.d.h.context();ctx.save();ctx.imageSmoothingEnabled=false;ctx.textAlign='center';const y=this.bodyY()+Math.sin(this.age/700)*2,visible=this.visible();
  if(visible){sprite(ctx,art,'flight',this.age,this.b.x,y,400,224);if(this.launchAge<400){for(const x of [-70,-35,0,35,70])sprite(ctx,art,'missile_launch',this.launchAge,this.b.x+x,y+15,26,42,false);}}
  for(const p of this.missiles)sprite(ctx,art,'ballistic_missile',p.age,p.x,p.y,15,40);
  if(['protection_exit','thrusting'].includes(this.state))for(const x of [-110,-55,55,110])sprite(ctx,art,'engine',this.phaseAge,this.b.x+x,y+65,30,64);
  if(this.state.startsWith('wave_'))this.drawGrid(ctx,art);
  if(['protection_exit','escorts'].includes(this.state))for(const e of this.escorts)if(!e.dead){e.director.draw(ctx,art);const b=e.director.boss;ctx.fillStyle='#ffdc85';ctx.font='12px monospace';ctx.fillText('ESCORT '+b.hp+'/'+b.maxHp,b.x,b.y+100*(b.renderScale||1));}
  ctx.fillStyle='#fff';ctx.font='13px monospace';const labels={entrance:'STRATEGIC BOMBER APPROACHING',launch:'BALLISTIC VOLLEY — TAKE COVER',return:'BOMBER RETURNING WITH TWO ESCORTS',protection_exit:'PROTECTION CALL — TWO HELICOPTERS INBOUND',escorts:'BOMBER AWAY — DESTROY BOTH HELICOPTERS',combat_return:'CONTINENTAL BOMBER RETURNING',exit_return:'ROUND '+this.b.round+' COMPLETE — BOMBER RETURNING',exit_hold:'DEPARTURE IN '+Math.ceil((CONFIG.exitHold-this.phaseAge)/1000)+'s',thrusting:'CONTINENTAL BOMBER DEPARTING'};if(this.state.startsWith('wave_'))ctx.fillText('BOMBING '+this.series+' — WAVE '+this.wave+'/5 — FIND GREEN COVER',w/2,162);else ctx.fillText(labels[this.state]||'',w/2,162);ctx.restore();
 }
}
return {Encounter,SpawnHazard,CONFIG,ART,get assets(){return [...new Set(Object.values(ART).flat().map(p=>BASE+p))];},circleBox};
});
