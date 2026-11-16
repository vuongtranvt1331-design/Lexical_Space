/* Artwork and cosmetic animation only. This module never changes damage or currency. */
(function(){
'use strict';
const catalog=SkySkinCatalog,images=new Map(),fx=[],aliases={projectile:['projectile','frozen_projectile'],engine:['engine_afterburner','engine_flight','engine_idle'],impact:['impact','ice_impact','impact_sparks'],elimination:['elimination','frozen_destruction','destruction_particles']};let clock=0;
function image(path){if(!path)return null;if(!images.has(path)){const img=new Image();img.decoding='async';img.src=path;images.set(path,img);}return images.get(path);}
function ready(img){return !!(img?.complete&&img.naturalWidth);}
function path(index,id){const cfg=AIRCRAFT_CONFIGS[index]||AIRCRAFT_CONFIGS[0];return id==='factory_default'?cfg.file:catalog.bodies[cfg.key]?.[id]||cfg.file;}
function sequence(id,category){if(id==='money_printer'&&category==='projectile'){const coin=catalog.animations.find(a=>a.id==='assets/effects/money_printer/projectiles/projectile_arcade_coin_gold');if(coin)return coin;}const cats=aliases[category]||[category];for(const c of cats){const a=catalog.animations.find(a=>a.skin_line===id&&a.category===c&&!a.id.includes('/bomber/'));if(a)return a;}return null;}
function animationFrame(a,t=clock){if(!a)return null;const total=a.frame_ms.reduce((n,v)=>n+v,0);let at=a.loop?t%total:Math.min(t,total-1),i=0;while(i<a.frames.length-1&&at>=a.frame_ms[i]){at-=a.frame_ms[i++];}return image(a.frames[i]);}
function frame(id,category,t=clock){return animationFrame(sequence(id,category),t);}
const WRAITH_EFFECT_SCALE=2;
// Each looping lightning sequence is a projectile type; trails/impacts are separate effects.
const wraithProjectiles=catalog.animations.filter(a=>a.skin_line==='red_wraith'&&a.loop&&a.frames[0]?.startsWith('assets/skins/red_wraith/projectiles/lightning_'));
function isWraithAttack(shot){return !!shot&&!shot.isSpecial&&shot.attackerKey==='fighter_1'&&shot.skinId==='red_wraith';}
function nextWraithProjectile(player){if(!wraithProjectiles.length)return null;const index=player.wraithShotIndex||0;player.wraithShotIndex=(index+1)%wraithProjectiles.length;return wraithProjectiles[index%wraithProjectiles.length];}
function drawWraithProjectile(ctx,shot){ctx.save();ctx.imageSmoothingEnabled=false;const drawn=fit(ctx,animationFrame(shot.wraithProjectile,shot.visualAge),shot.x,shot.y,18*1.75*WRAITH_EFFECT_SCALE,23*1.75*WRAITH_EFFECT_SCALE);ctx.restore();return drawn;}

// Cosmetic scale only: collision, damage and movement continue to use the original shot.
function projectileScale(id){return id==='money_printer'||id==='minecraft'?1.5:1;}

const skyborneRoot='assets/skins/skyborne/';
function isSkyborne(shot){return shot?.skinId==='skyborne'&&shot.attackerKey==='viper'&&!shot.isSpecial;}
function skyborneAtlas(ctx,spec,t,x,y,w,h,loop=false){
 const img=image(skyborneRoot+spec.file);if(!ready(img))return false;
 const i=loop?Math.floor(t/spec.frameMs)%spec.count:Math.min(spec.count-1,Math.floor(t/spec.frameMs));
 const [fw,fh]=spec.frameSize;ctx.drawImage(img,(i%spec.columns)*fw,Math.floor(i/spec.columns)*fh,fw,fh,x-w/2,y-h/2,w,h);return true;
}
function emitSkyborneShot(owner,shot){
 if(!isSkyborne(shot))return false;if(fx.length>=72)fx.shift();
 fx.push({id:'skyborne',category:'skyborne_eye',owner,shot,age:0,life:120});return true;
}
function drawSkyborneFX(ctx,f){
 ctx.save();ctx.imageSmoothingEnabled=false;
 if(f.category==='skyborne_eye'){
  const p=f.owner;if(!p||p.hp<=0||p.skinId!=='skyborne'||!f.shot.active){ctx.restore();return;}
  const g=catalog.skyborne.flight,s=g.displaySize/g.frameSize[0],angle=p.bank||0;
  const dx=(g.head[0]-g.origin[0])*s,dy=(g.head[1]-g.origin[1])*s;
  const x=Math.round(p.x)+dx*Math.cos(angle)-dy*Math.sin(angle),y=Math.round(p.y)+dx*Math.sin(angle)+dy*Math.cos(angle);
  // A brief visual link joins the eyes to the unchanged physical muzzle position.
  if(f.age<45){ctx.strokeStyle='#ff3344';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(f.shot.x,f.shot.y);ctx.stroke();ctx.strokeStyle='#fff4ed';ctx.lineWidth=1;ctx.stroke();}
  ctx.translate(x,y);ctx.rotate(angle);skyborneAtlas(ctx,catalog.skyborne.flash,f.age,0,0,16,16);
 }else skyborneAtlas(ctx,catalog.skyborne.impact,f.age,f.x,f.y,32,32);
 ctx.restore();
}

function drawProjectile(ctx,shot){
 if(shot.skinId==='hazard'&&shot.attackerKey==='titan'&&!shot.isSpecial){
  const img=frame('hazard','projectile',shot.visualAge);if(!ready(img))return false;
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(shot.x,shot.y);ctx.rotate(Math.atan2(shot.vy,shot.vx)+Math.PI/2);ctx.drawImage(img,-16,-16,32,32);ctx.restore();return true;
 }
 if(shot.skinId==='celestial')return SkyCelestial.drawProjectile(ctx,shot);
 if(shot.skinId==='exalted')return SkyExalted.renderer.drawProjectile(ctx,shot);
 if(isSkyborne(shot)){
  const img=image(skyborneRoot+catalog.skyborne.beam.file);if(!ready(img))return false;
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(shot.x,shot.y);ctx.rotate(Math.atan2(shot.vy,shot.vx)+Math.PI/2);
  const [w,h]=catalog.skyborne.beam.displaySize;ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore();return true;
 }
 if(shot.skinId==='skyborne')return false;

 if(shot.skinId==='phoenix_fire'&&shot.attackerKey==='corsair'&&!shot.isSpecial){
  const a=sequence('phoenix_fire','projectile'),img=animationFrame(a,shot.visualAge);
  if(!ready(img))return false;
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(shot.x,shot.y);
  // Source flames point up; rotate only the cosmetic texture to follow travel.
  ctx.rotate(Math.atan2(shot.vy,shot.vx)+Math.PI/2);
  drawAnchored(ctx,a,shot.visualAge,0,0,.625);ctx.restore();return true;
 }

 if(shot.skinId==='factory_default'||(shot.isSpecial&&projectileScale(shot.skinId)===1))return false;
 const scale=projectileScale(shot.skinId),img=frame(shot.skinId,'projectile',scale===1?clock:shot.visualAge);
 ctx.save();ctx.imageSmoothingEnabled=false;const drawn=fit(ctx,img,shot.x,shot.y,18*scale,23*scale);ctx.restore();return drawn;
}
function eliminationSkin(shot){if(shot?.skinId==='celestial'&&shot.attackerKey==='fighter_1')return 'celestial';return shot?.skinId==='money_printer'?'money_printer':isWraithAttack(shot)?'red_wraith':null;}

function fit(ctx,img,x,y,w,h){if(!ready(img))return false;const s=Math.min(w/img.naturalWidth,h/img.naturalHeight);ctx.drawImage(img,x-img.naturalWidth*s/2,y-img.naturalHeight*s/2,img.naturalWidth*s,img.naturalHeight*s);return true;}
// Inspect alpha once per loaded image; source artwork is never rewritten.
const alphaBounds=new WeakMap();
function visibleBounds(img){
 if(!ready(img))return null;if(alphaBounds.has(img))return alphaBounds.get(img);
 let bounds=[0,0,img.naturalWidth,img.naturalHeight];
 try{const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0);const pixels=c.getImageData(0,0,canvas.width,canvas.height).data;let left=canvas.width,top=canvas.height,right=0,bottom=0;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
  if(right>left&&bottom>top)bounds=[left,top,right,bottom];
 }catch{}alphaBounds.set(img,bounds);return bounds;
}
function fitVisible(ctx,img,x,y,w,h){const b=visibleBounds(img);if(!b)return false;const bw=b[2]-b[0],bh=b[3]-b[1],scale=Math.min(w/bw,h/bh);ctx.drawImage(img,b[0],b[1],bw,bh,x-bw*scale/2,y-bh*scale/2,bw*scale,bh*scale);return true;}
function targetVisualBox(target,boss){
 if(target.fortressVisualBox)return {...target.fortressVisualBox};
 let img,w=target.width,h=target.height,contained=false;
 if(target===boss){img=image(target.id===1?'assets/bosses/boss1/body.png':'assets/bosses/boss2/body/boss01_body.png');w=target.id===1?110:158.4;h=target.id===1?196:176;contained=true;}
 else{const pair=assets.enemyHelicopters?.[target.modelIndex]||assets.enemyAircraft?.[target.modelIndex];img=(target.hp===1||target.isDamaged)?(pair?.damaged||assets.helicopterDamaged):(pair?.intact||assets.helicopterIntact);}
 const b=visibleBounds(img);if(!b)return {x:target.x,y:target.y,w,h};
 const sx=contained?Math.min(w/img.naturalWidth,h/img.naturalHeight):w/img.naturalWidth,sy=contained?sx:h/img.naturalHeight;
 return {x:target.x+((b[0]+b[2]-img.naturalWidth)/2)*sx,y:target.y+((b[1]+b[3]-img.naturalHeight)/2)*sy,w:(b[2]-b[0])*sx,h:(b[3]-b[1])*sy};
}
async function ensure(index,id){if(id==='prism_core')await SkyPrismCore.preload();if(id==='hazard')await SkyHazard.ensure(image,ready);if(id==='celestial')await SkyCelestial.preload();if(id==='exalted')await SkyExalted.preload();if(id==='ornithopter')await Promise.all([SkyOrnithopter.CONFIG.body.file,SkyOrnithopter.CONFIG.wing.file,SkyOrnithopter.CONFIG.blurWing.file].map(url=>new Promise((resolve,reject)=>{const img=image(url);if(ready(img))return resolve(img);img.addEventListener('load',()=>resolve(img),{once:true});img.addEventListener('error',()=>reject(Error('Skin artwork could not load. No Coins were spent.')),{once:true});if(img.complete&&!img.naturalWidth)reject(Error('Skin artwork unavailable.'));})));const img=image(path(index,id));if(ready(img))return img;await new Promise((ok,no)=>{img.addEventListener('load',ok,{once:true});img.addEventListener('error',()=>no(Error('Skin artwork could not load. No Coins were spent.')),{once:true});if(img.complete&&!img.naturalWidth)no(Error('Skin artwork unavailable.'));});return img;}
function preload(id){if(id==='prism_core')SkyPrismCore.preload().catch(error=>console.warn(error.message));if(id==='hazard'){image(catalog.hazard.body);image(catalog.hazard.rotorFile);}if(id==='celestial')SkyCelestial.preload().catch(error=>console.warn(error.message));if(id==='exalted')SkyExalted.preload().catch(error=>console.warn(error.message));if(id==='ornithopter'){image(SkyOrnithopter.CONFIG.body.file);image(SkyOrnithopter.CONFIG.wing.file);image(SkyOrnithopter.CONFIG.blurWing.file);}if(id==='skyborne')for(const spec of ['flight','beam','impact','flash'])image(skyborneRoot+catalog.skyborne[spec].file);if(id==='elder_wood')image(catalog.elderWoodRotor);for(const a of catalog.animations.filter(a=>a.skin_line===id))for(const p of a.frames)image(p);}
function emit(id,category,x,y,size=40,{once=false}={}){if(['phoenix_fire','hazard'].includes(id)&&['muzzle_flash','impact'].includes(category))once=true;const a=sequence(id,category);if(id==='factory_default'||!a)return false;if(fx.length>=72)fx.shift();fx.push({id,category,x,y,size:size*(id==='red_wraith'&&['muzzle_flash','impact','electrical_impact','elimination'].includes(category)?WRAITH_EFFECT_SCALE:1),age:0,once,life:once?a.frame_ms.reduce((n,v)=>n+v,0):480});return true;}
function eliminate(id,x,y,isBig){if(id==='celestial')return SkyCelestial.emit(x,y,isBig?SkyCelestial.CONFIG.explosion.bigSize:SkyCelestial.CONFIG.explosion.deathSize);return (id==='red_wraith'||id==='money_printer'||id==='hazard')&&emit(id,'elimination',x,y,isBig?104:76,{once:true});}
function enemyDestructionSequence(id){
 const effectId=catalog.lines.find(line=>line.id===id)?.enemyDestructionImpact;
 const a=effectId&&catalog.animations.find(animation=>animation.id===effectId&&animation.skin_line===id);
 // Require the complete original sequence before replacing the reliable default explosion.
 if(!a||a.loop||!a.frames?.length||a.frames.length!==a.frame_ms?.length||!a.frame_ms.every(ms=>Number.isFinite(ms)&&ms>0)||!a.frames.every(p=>ready(image(p))))return null; return a;
}
function enemyDestruction(id,x,y,isBig){
 if(id==='celestial')return eliminate(id,x,y,isBig);
 if(id==='exalted'){
  if(!SkyExalted.renderer.ready||!SkyExalted.renderer.eliminationFrames.length)return false;
  const spec=SkyExalted.CONFIG.elimination;if(fx.length>=72)fx.shift();
  fx.push({id,category:'exalted_elimination',x,y,size:isBig?spec.bigSize:spec.size,age:0,life:spec.durationMs});return true;
 }
 const a=enemyDestructionSequence(id);if(!a)return false;
 const img=image(a.frames[0]),size=isBig?104:76;
 if(fx.length>=72)fx.shift();
 fx.push({id,category:'enemy_destruction_impact',animation:a,x,y,angle:0,scale:Math.min(size/img.naturalWidth,size/img.naturalHeight),age:0,once:true,life:a.frame_ms.reduce((n,v)=>n+v,0)});
 return true;
}
function impact(id,x,y){if(id==='celestial'){SkyCelestial.emit(x,y,SkyCelestial.CONFIG.explosion.impactSize);return;}if(id==='skyborne'){if(fx.length>=72)fx.shift();fx.push({id,category:'skyborne_impact',x,y,age:0,life:240});return;}if(id==='king_ghidorah'){if(fx.length>=72)fx.shift();fx.push({id,category:'ghidorah_impact',x,y,age:0,life:260});return;}emit(id,'impact',x,y);if(id==='red_wraith')emit(id,'electrical_impact',x,y,36);if(id==='money_printer'){emit(id,'money_word_impact',x,y-12,52);emit(id,'coin_particle',x+10,y,22);}if(id==='minecraft')emit(id,'block_particle',x,y,26);if(id==='glacier')emit(id,'ice_shards',x,y,35);}
// Only Hazard death effects continue after game over; combat and all other FX retain their clocks.
function updateHazardAfterGameOver(dt){for(let i=fx.length-1;i>=0;i--)if(fx[i].id==='hazard'){fx[i].age+=dt;if(fx[i].age>=fx[i].life)fx.splice(i,1);}}
function update(dt){SkyCelestial.updateEffects(dt);clock+=dt;for(let i=fx.length-1;i>=0;i--){const f=fx[i];f.age+=dt;if(f.age>=f.life)fx.splice(i,1);}}
function draw(ctx){SkyCelestial.drawEffects(ctx);for(const f of fx){if(f.category==='exalted_elimination'){SkyExalted.renderer.drawElimination(ctx,f);continue;}if(f.id==='skyborne'){drawSkyborneFX(ctx,f);continue;}if(f.category==='ghidorah_convergence'||f.category==='ghidorah_impact'){drawGhidorahSkillFX(ctx,f);continue;}ctx.save();if(f.category==='enemy_destruction_impact')ctx.imageSmoothingEnabled=false;ctx.globalAlpha=f.once?1:Math.min(1,(f.life-f.age)/160);if(f.animation){ctx.translate(f.x,f.y);ctx.rotate(f.angle);drawAnchored(ctx,f.animation,f.age,0,0,f.scale);}else if(f.id==='phoenix_fire')drawAnchored(ctx,sequence(f.id,f.category),f.age,f.x,f.y,f.size/48);else fit(ctx,frame(f.id,f.category,f.age),f.x,f.y,f.size,f.size);ctx.restore();}}
function exhaust(ctx,id,cfg){if(id==='prism_core'&&cfg.key==='chronos')return true;if(id==='celestial')return true;if(id==='skyborne'&&cfg.key==='viper')return true;if(id==='factory_default')return false;const img=frame(id,'engine');if(!ready(img))return false;const slots=cfg.exhausts.length?cfg.exhausts:[{xRatio:0,yRatio:.37}];for(const s of slots)fit(ctx,img,s.xRatio*cfg.width,s.yRatio*cfg.height+8,26,32);return true;}
function drawBody(ctx,player,cfg){
 if(player.skinId==='prism_core')return SkyPrismCore.drawBody(ctx,player,cfg);
 if(player.skinId==='hazard')return SkyHazard.draw(ctx,player,cfg,image,ready,clock);
 if(player.skinId==='celestial')return SkyCelestial.drawBody(ctx,player,cfg);
 if(player.skinId==='exalted')return SkyExalted.drawBody(ctx,player,cfg);
 if(cfg.key==='corsair'&&player.skinId==='ornithopter')return SkyOrnithopter.draw(ctx,player.ornithopter,cfg,image,ready);
 if(cfg.key==='viper'&&player.skinId==='skyborne'){
  ctx.save();ctx.imageSmoothingEnabled=false;const g=catalog.skyborne.flight;
  const drawn=skyborneAtlas(ctx,g,clock,0,0,g.displaySize,g.displaySize,true);ctx.restore();return drawn;
 }

 if(cfg.key==='corsair'&&player.skinId==='phoenix_fire'){
  const a=sequence('phoenix_fire','flight'),img=animationFrame(a);
  if(!ready(img))return false;
  // Fixed torso anchor and uniform scale across all poses; hitboxes stay unchanged.
  ctx.save();ctx.imageSmoothingEnabled=false;
  drawAnchored(ctx,a,clock,0,0,cfg.height/catalog.phoenixFire.referenceHeight);
  ctx.restore();return true;
 }

 if(cfg.key==='bomber'&&player.skinId==='king_ghidorah'){
  const a=sequence('king_ghidorah','flight'),img=animationFrame(a),g=catalog.kingGhidorah;
  if(!ready(img))return false;
  // Fixed full-canvas transform across poses: never fit the changing wing bounds.
  const scale=Math.min(cfg.width/(g.visualBounds[2]-g.visualBounds[0]),cfg.height/(g.visualBounds[3]-g.visualBounds[1]));
  ctx.save();ctx.imageSmoothingEnabled=false;
  drawAnchored(ctx,a,clock,0,0,scale);
  let t=clock%a.frame_ms.reduce((n,v)=>n+v,0),i=0;while(i<a.frames.length-1&&t>=a.frame_ms[i])t-=a.frame_ms[i++];
  if(g.lightningFrames.includes(i))drawAnchored(ctx,sequence('king_ghidorah','lightning_mask'),clock,0,0,scale);
  ctx.restore();return true;
 }
 if(cfg.key==='bomber'){
  const url=path(player.aircraftIndex,player.skinId),img=image(url),box=catalog.bomberBounds[url];
  if(!ready(img)||!box)return false;const [x,y,right,bottom]=box,w=right-x,h=bottom-y,scale=Math.min(cfg.width/w,cfg.height/h);
  ctx.drawImage(img,x,y,w,h,-w*scale/2,-h*scale/2,w*scale,h*scale);return true;
 }
 if(player.skinId!=='red_wraith'||cfg.key!=='fighter_1')return false;
 const img=frame('red_wraith','aircraft_flicker'),g=catalog.redWraithGeometry;
 if(!ready(img))return false;const scale=Math.min(cfg.width/g.body_dimensions[0],cfg.height/g.body_dimensions[1]);
 ctx.drawImage(img,-g.origin[0]*scale,-g.origin[1]*scale,img.naturalWidth*scale,img.naturalHeight*scale);return true;
}
function drawTarget(ctx,player,boss){
 if(player.skinId==='exalted'){SkyExalted.drawTarget(ctx,player,boss,targetVisualBox);return;}
 if(player.skinId!=='red_wraith'||player.aircraftIndex!==0||player.skillActiveTimer<=0)return;
 const target=player.lockedTarget;if(!target||target.hp<=0||target.active===false||target.formation?.destroyed)return;
 const isBossTarget=target===boss||(target.kind==='core'&&target.ownerBoss===boss);
 const category=isBossTarget?'skull_boss':'skull_large',seq=sequence('red_wraith',category);if(!seq)return;
 // Replay all original skull frames while the existing skill timer is active; pause with gameplay.
 const elapsed=Math.max(0,AIRCRAFT_CONFIGS[0].skillDuration-player.skillActiveTimer);
 const t=elapsed%seq.frame_ms.reduce((n,v)=>n+v,0);
 const box=targetVisualBox(target,boss);ctx.save();ctx.globalAlpha*=.75;ctx.imageSmoothingEnabled=false;
 const scale=1.5*(isBossTarget?1:WRAITH_EFFECT_SCALE);
 fitVisible(ctx,frame('red_wraith',category,t),box.x,box.y,box.w*scale,box.h*scale);ctx.restore();
}
function updatePreviews(now){
 SkyPrismCore.updatePreviews(now);
 for(const el of document.querySelectorAll('img[data-hazard-drift]'))if(el.dataset.skinId!=='hazard'){el.style.translate='';delete el.dataset.hazardDrift;}
 const hazardElements=document.querySelectorAll('img[data-skin-id="hazard"]');
 if(hazardElements.length){preload('hazard');const img=frame('hazard','flight',now);if(ready(img))for(const el of hazardElements){if(el.src!==img.src)el.src=img.src;el.style.translate=SkyHazard.visualOffset(now)+'px 0px';el.dataset.hazardDrift='true';}}
 SkyCelestial.updatePreviews(now);
 SkyExalted.updatePreviews(now);
 const skyElements=document.querySelectorAll('img[data-skin-id="skyborne"]');
 if(skyElements.length){preload('skyborne');const img=frame('skyborne','flight',now);if(ready(img))for(const el of skyElements)if(el.src!==img.src)el.src=img.src;}

 const phoenixElements=document.querySelectorAll('img[data-skin-id="phoenix_fire"]');
 if(phoenixElements.length){preload('phoenix_fire');const phoenix=frame('phoenix_fire','flight',now);if(ready(phoenix))for(const el of phoenixElements)if(el.src!==phoenix.src)el.src=phoenix.src;}

 const dragonElements=document.querySelectorAll('img[data-skin-id="king_ghidorah"]');
 if(dragonElements.length){preload('king_ghidorah');const dragon=frame('king_ghidorah','preview',now);if(ready(dragon))for(const el of dragonElements)if(el.src!==dragon.src)el.src=dragon.src;}
 const img=frame('red_wraith','aircraft_flicker',now);if(!ready(img))return;
 for(const el of document.querySelectorAll('img[data-skin-id="red_wraith"]'))if(el.src!==img.src)el.src=img.src;
}
function bodyEffects(ctx,id,cfg){if(id==='special_force'){ctx.save();ctx.globalAlpha=.7;fit(ctx,frame(id,'emergency_lights'),0,-cfg.height*.1,cfg.width*.55,24);ctx.restore();}}
function bomberSequence(id,category){
 const specific=categories=>catalog.animations.find(a=>a.skin_line===id&&a.id.includes('/bomber/')&&categories.includes(a.category));
 if(category==='missile')return specific(['special_missile','missile_flight'])||(id!=='factory_default'?sequence(id,'projectile'):null)||catalog.animations.find(a=>a.skin_line==='factory_default'&&a.id.includes('/bomber/')&&a.category==='missile_flight');
 if(category==='missile_launch')return specific([category])||sequence(id,'muzzle_flash');
 if(category==='missile_exhaust')return specific([category])||sequence(id,'engine');
 return specific([category]);
}
function drawAnchored(ctx,a,t,x,y,scale){const img=animationFrame(a,t);if(!ready(img))return false;const origin=a.origin||[img.naturalWidth/2,img.naturalHeight/2];ctx.drawImage(img,x-origin[0]*scale,y-origin[1]*scale,img.naturalWidth*scale,img.naturalHeight*scale);return true;}
function bomberExhaust(ctx,player,cfg){
 const a=sequence(player.skinId,player.isMovingForward?'engine':'engine_idle'),box=catalog.bomberBounds[path(player.aircraftIndex,player.skinId)];if(!a||!box)return;
 const scale=Math.min(cfg.width/(box[2]-box[0]),cfg.height/(box[3]-box[1])),cx=(box[0]+box[2])/2,cy=(box[1]+box[3])/2;
 // Four nozzle centers on the supplied 256px Bomber bodies, transformed exactly like the cropped body.
 for(const x of [104,118,138,152])drawAnchored(ctx,a,clock,(x-cx)*scale,(174-cy)*scale,scale*.42);
}
function bomberFrame(id,t){return animationFrame(bomberSequence(id,'missile'),t);}
// Cosmetic-only King Ghidorah skill. Projectile movement and collision stay in BomberMissile.
function ghidorahBolt(ctx,x1,y1,x2,y2,age,seed=0){
 const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1,phase=Math.floor(age/45);
 const points=Array.from({length:7},(_,i)=>{const t=i/6,j=i===0||i===6?0:Math.sin(i*7.1+phase*2.3+seed)*2.8;return [Math.round(x1+dx*t-dy/len*j),Math.round(y1+dy*t+dx/len*j)];});
 for(const [color,width] of [['#ad620a',5],['#ffd52a',3],['#fffbe4',1]]){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
}
function ghidorahOrb(ctx,age,radius=10){
 const pulse=1+Math.sin(age/65)*.07;
 for(const [r,color] of [[radius*1.2,'#a85e0a'],[radius,'#ffd52a'],[radius*.66,'#fff3a6'],[radius*.32,'#ffffff']]){
  ctx.fillStyle=color;ctx.beginPath();for(let i=0;i<12;i++){const a=i*Math.PI/6,x=Math.round(Math.cos(a)*r*pulse),y=Math.round(Math.sin(a)*r*pulse);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();
 }
 for(let i=0;i<3;i++){const a=i*Math.PI*2/3+Math.floor(age/55)*.6;ghidorahBolt(ctx,Math.cos(a)*radius*.6,Math.sin(a)*radius*.6,Math.cos(a+.5)*radius*1.5,Math.sin(a+.5)*radius*1.5,age,i);}
}
function drawGhidorahSkillFX(ctx,f){
 ctx.save();ctx.imageSmoothingEnabled=false;
 if(f.category==='ghidorah_convergence'){
  const owner=f.owner,shot=f.shot;
  if(!owner||owner.hp<=0||owner.skinId!=='king_ghidorah'||!shot.active){ctx.restore();return;}
  ctx.globalAlpha*=Math.min(1,(f.life-f.age)/75);
  const merge={x:owner.x,y:owner.y-36};
  // Head tips in the fixed 448x256 atlas, transformed by the same 0.24 body scale.
  for(const [x,y] of [[-9,-22],[0,-26],[9,-22]])ghidorahBolt(ctx,owner.x+x,owner.y+y,merge.x,merge.y,f.age,x);
  ghidorahBolt(ctx,merge.x,merge.y,shot.x,shot.y,f.age,8);
  ctx.translate(merge.x,merge.y);ghidorahOrb(ctx,f.age,4);
 }else{
  ctx.translate(f.x,f.y);ctx.globalAlpha*=Math.max(0,1-f.age/f.life);
  const r=5+f.age*.075;for(let i=0;i<8;i++){const a=i*Math.PI/4;ghidorahBolt(ctx,Math.cos(a)*r*.4,Math.sin(a)*r*.4,Math.cos(a)*r,Math.sin(a)*r,f.age,i);}
 }
 ctx.restore();
}

function drawBomberMissile(ctx,shot){
 if(shot.skinId==='king_ghidorah'){ctx.save();ctx.imageSmoothingEnabled=false;for(let i=3;i>0;i--){ctx.save();ctx.translate(Math.sin(shot.age/70+i)*2,8+i*7);ctx.globalAlpha*=.15+(3-i)*.1;ghidorahOrb(ctx,shot.age-i*35,5-i);ctx.restore();}ghidorahOrb(ctx,shot.age,10);ctx.restore();return true;}

 const a=bomberSequence(shot.skinId,'missile'),img=animationFrame(a,shot.age);if(!ready(img))return false;
 const scale=Math.min(30/img.naturalWidth,58/img.naturalHeight)*projectileScale(shot.skinId),bounds=visibleBounds(img),origin=a.origin||[img.naturalWidth/2,img.naturalHeight/2];
 const tailX=((bounds[0]+bounds[2])/2-origin[0])*scale,tailY=(bounds[3]-origin[1])*scale;
 const trail=bomberSequence(shot.skinId,'missile_trail');if(trail&&shot.age<trail.frame_ms.reduce((n,v)=>n+v,0))drawAnchored(ctx,trail,shot.age,tailX,tailY+4,scale*.8);
 drawAnchored(ctx,bomberSequence(shot.skinId,'missile_exhaust'),shot.age,tailX,tailY,scale*.8);
 return drawAnchored(ctx,a,shot.age,0,0,scale);
}
function emitBomberLaunch(shot,owner){
 if(shot.skinId==='king_ghidorah'){if(fx.length>=72)fx.shift();fx.push({id:shot.skinId,category:'ghidorah_convergence',owner,shot,age:0,life:240});return true;}

 const a=bomberSequence(shot.skinId,'missile_launch');if(!a)return false;if(fx.length>=72)fx.shift();
 fx.push({id:shot.skinId,category:'missile_launch',animation:a,x:shot.x,y:shot.y,angle:Math.atan2(shot.vy,shot.vx)+Math.PI/2,scale:.32,age:0,once:true,life:a.frame_ms.reduce((n,v)=>n+v,0)});return true;
}
window.SkySkins={catalog,updateHazardAfterGameOver,emitSkyborneShot,projectileScale,drawProjectile,eliminationSkin,bomberSequence,bomberExhaust,drawBomberMissile,emitBomberLaunch,visibleBounds,targetVisualBox,isWraithAttack,nextWraithProjectile,drawWraithProjectile,eliminate,enemyDestruction,enemyDestructionSequence,bomberFrame,drawBody,drawTarget,updatePreviews,path,image,ready,fit,ensure,preload,frame,emit,impact,update,draw,exhaust,bodyEffects,clear(){SkyPrismCore.clear();fx.length=0;SkyExalted.clear();SkyCelestial.clear();},get count(){return fx.length;},apply(player){const id=SkyProfile.skin(player.aircraftIndex);if(player.skinId&&player.skinId!==id)fx.length=0;if(player.skinId!==id){SkyPrismCore.resetPlayer(player);SkyExalted.resetPlayer(player);SkyCelestial.resetPlayer(player);}player.skinId=id;if(id==='ornithopter'){player.ornithopter ||= new SkyOrnithopter.WingDynamics();}else player.ornithopter=null;preload(id);const img=image(path(player.aircraftIndex,id));player.aircraftImage=img;}};
})();
