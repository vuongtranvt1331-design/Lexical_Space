/* Celestial cosmetic animation. All clocks use the existing game loop; combat is unchanged. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../../config/skins/celestial-config.js'):root.SkyCelestialConfig);if(typeof module==='object'&&module.exports)module.exports=api;else root.SkyCelestial=api;})(globalThis,function(CONFIG){
 'use strict';
 class WingAnimation {
  constructor(){this.time=0;this.frame=0;this.fold=0;this.mode='deployed';}
  update(dt,{forward=false}={}){
   if(!Number.isFinite(dt)||dt<=0)return;
   this.time+=dt;const next=Math.floor((this.time+1e-7)*CONFIG.fps/1000),ticks=next-this.frame;
   if(ticks<=0)return;this.frame=next;this.mode=forward?'folded':'deployed';
   const level=Math.round(this.fold*CONFIG.transitionTicks);
   this.fold=(forward?Math.min(CONFIG.transitionTicks,level+ticks):Math.max(0,level-ticks))/CONFIG.transitionTicks;
  }
 }
 const makeCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 const renderer={ready:false,loading:null,error:null,textures:{},
  load(){
   if(this.loading)return this.loading;this.error=null;
   this.loading=new Promise((resolve,reject)=>{
    const attempt=n=>{const image=new Image();
     image.onerror=()=>n<2?attempt(n+1):reject(Error('Celestial artwork could not load. Please retry.'));
     image.onload=()=>{try{
      if(image.naturalWidth!==CONFIG.atlasSize[0]||image.naturalHeight!==CONFIG.atlasSize[1])throw Error('Unexpected Celestial atlas dimensions');
      const textures={};for(const [id,[x,y,w,h]] of Object.entries(CONFIG.regions)){const c=makeCanvas(w,h),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,x,y,w,h,0,0,w,h);textures[id]=c;}
      this.textures=textures;this.ready=true;resolve(this);
     }catch(error){reject(error);}};
     image.src=CONFIG.atlas+'?v=celestial-1'+(n?'&retry='+n:'');};attempt(0);
   }).catch(error=>{this.error=error;this.loading=null;throw error;});return this.loading;
  },
  draw(ctx,c,height){
   if(!this.ready)return false;const scale=height/CONFIG.referenceHeight;
   ctx.save();ctx.imageSmoothingEnabled=false;ctx.scale(scale,scale);
   // Small pixel exhaust trails change only on the same 3 FPS tick as the wings.
   const length=[10,15,12][c.frame%3]+Math.round(c.fold*6);
   for(const x of [-5,5]){ctx.fillStyle='#008bd5';ctx.fillRect(x-2,30,4,length);ctx.fillStyle='#62ecff';ctx.fillRect(x-1,30,2,length-3);ctx.fillStyle='#e6ffff';ctx.fillRect(x,30,1,5);}
   for(const p of CONFIG.parts){const t=this.textures[p.id];ctx.save();ctx.translate(...p.position);ctx.rotate(p.foldAngle*c.fold);ctx.drawImage(t,-p.anchor[0]*t.width,-p.anchor[1]*t.height);ctx.restore();}
   ctx.restore();return true;
  }
 };
 let controllers=new WeakMap(),previews=new WeakMap();const effects=[];
 const supported=p=>p?.skinId==='celestial'&&p.aircraftIndex===0;
 function controllerFor(p){let c=controllers.get(p);if(!c){c=new WingAnimation();controllers.set(p,c);}return c;}
 function updatePlayer(p,dt){if(!supported(p)){controllers.delete(p);return;}if(p.hp>0)controllerFor(p).update(dt,{forward:p.y<p.prevY-.01});}
 function drawBody(ctx,p,cfg){if(!supported(p)||p.hp<=0)return false;return renderer.draw(ctx,controllerFor(p),cfg.height);}
 function drawProjectile(ctx,shot){
  if(!renderer.ready||shot.skinId!=='celestial'||shot.attackerKey!=='fighter_1'||shot.isSpecial)return false;
  const frame=Math.floor((shot.visualAge||0)*CONFIG.fps/1000)%CONFIG.projectile.count,t=renderer.textures['projectile'+frame];
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(shot.x,shot.y);ctx.rotate(Math.atan2(shot.vy,shot.vx)+Math.PI/2);ctx.drawImage(t,-t.width/2,-t.height/2);ctx.restore();return true;
 }
 function emit(x,y,size=CONFIG.explosion.deathSize){if(!renderer.ready)return false;if(effects.length>=72)effects.shift();effects.push({x,y,size,age:0});return true;}
 function updateEffects(dt){if(!Number.isFinite(dt)||dt<=0)return;for(let i=effects.length-1;i>=0;i--){effects[i].age+=dt;if(effects[i].age>=CONFIG.explosion.durationMs)effects.splice(i,1);}}
 function drawEffects(ctx){if(!renderer.ready)return;ctx.save();ctx.imageSmoothingEnabled=false;for(const e of effects){const frame=Math.floor(e.age*CONFIG.fps/1000),t=renderer.textures['explosion'+frame];if(t)ctx.drawImage(t,e.x-e.size/2,e.y-e.size/2,e.size,e.size);}ctx.restore();}
 function paintPreview(img,entry){
  if(!img.isConnected||img.dataset.skinId!=='celestial'||img.parentElement!==entry.wrap||!renderer.ready)return;
  const w=img.clientWidth,h=img.clientHeight;if(!w||!h)return;
  if(entry.frame===entry.controller.frame&&entry.w===w&&entry.h===h)return;
  entry.frame=entry.controller.frame;entry.w=w;entry.h=h;entry.overlay.width=w;entry.overlay.height=h;
  const ctx=entry.overlay.getContext('2d');ctx.translate(w/2,h/2);renderer.draw(ctx,entry.controller,Math.min(w,h)*CONFIG.referenceHeight/160);img.style.opacity='0';
 }
 function updatePreviews(now){
  for(const img of document.querySelectorAll('img[data-skin-id="celestial"],.celestial-preview > img')){
   if(img.dataset.skinId!=='celestial'){img.style.opacity='';img.parentElement.replaceWith(img);previews.delete(img);continue;}
   let e=previews.get(img);if(!e){const wrap=document.createElement('span'),overlay=makeCanvas(160,160);wrap.className='celestial-preview';overlay.setAttribute('aria-hidden','true');img.replaceWith(wrap);wrap.append(img,overlay);
    e={wrap,overlay,controller:new WingAnimation(),last:now,frame:-1};previews.set(img,e);const entry=e;
    renderer.load().then(()=>paintPreview(img,entry)).catch(()=>{if(img.isConnected&&img.dataset.skinId==='celestial')img.style.opacity='';});
   }
   e.controller.update(Math.max(0,Math.min(100,now-e.last)));e.last=now;paintPreview(img,e);
  }
 }
 return {CONFIG,WingAnimation,renderer,preload:()=>renderer.load(),controllerFor,updatePlayer,drawBody,drawProjectile,emit,updateEffects,drawEffects,updatePreviews,
  get effectCount(){return effects.length;},resetPlayer(p){controllers.delete(p);},clear(){controllers=new WeakMap();effects.length=0;}};
});
