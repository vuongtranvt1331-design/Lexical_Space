/* Flame / Prism Core: fixed 40-frame cosmetic animation, driven by the existing loop. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../../config/skins/prism-core-config.js'):root.SkyPrismCoreConfig);if(typeof module==='object'&&module.exports)module.exports=api;else root.SkyPrismCore=api;})(globalThis,function(CONFIG){
 'use strict';
 class AnimationController {
  constructor(){this.elapsedMs=0;this.frame=0;this.state='idle';}
  update(dt,{moving=false}={}){
   if(!Number.isFinite(dt)||dt<=0)return this;
   this.state=moving?'movement':'idle';
   this.elapsedMs=(this.elapsedMs+dt)%CONFIG.durationMs;
   this.frame=Math.floor((this.elapsedMs+1e-7)/CONFIG.frameMs)%CONFIG.frameCount;
   return this;
  }
 }
 const renderer={ready:false,loading:null,image:null,error:null,
  load(){
   if(this.ready)return Promise.resolve(this);if(this.loading)return this.loading;
   this.loading=new Promise((resolve,reject)=>{
    const attempt=n=>{const img=new Image();
     img.onload=()=>{if(img.naturalWidth!==CONFIG.atlasSize[0]||img.naturalHeight!==CONFIG.atlasSize[1]){reject(Error('Unexpected Prism Core sheet dimensions'));return;}this.image=img;this.ready=true;this.error=null;resolve(this);};
     img.onerror=()=>n<2?attempt(n+1):reject(Error('Prism Core artwork could not load. Please retry.'));
     img.src=CONFIG.atlas+'?v=2026-11-04-prism-core-gothic-1'+(n?'&retry='+n:'');};attempt(0);
   }).catch(error=>{this.error=error;this.loading=null;throw error;});return this.loading;
  },
  draw(ctx,frame,size){
   if(!this.ready)return false;const entry=CONFIG.frames[((frame%CONFIG.frameCount)+CONFIG.frameCount)%CONFIG.frameCount];
   ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(this.image,...entry.rect,-size/2,-size/2,size,size);ctx.restore();return true;
  }
 };
 let controllers=new WeakMap();const previews=new WeakMap();
 const supported=p=>p?.skinId===CONFIG.id&&p.aircraftIndex===CONFIG.aircraftIndex;
 function controllerFor(p){let c=controllers.get(p);if(!c){c=new AnimationController();controllers.set(p,c);}return c;}
 function updatePlayer(p,dt){if(!supported(p)){controllers.delete(p);return;}if(p.hp>0)controllerFor(p).update(dt,{moving:Math.abs(p.x-p.prevX)>.01||Math.abs(p.y-p.prevY)>.01});}
 function drawBody(ctx,p,cfg){if(!supported(p)||cfg.key!==CONFIG.aircraft||p.hp<=0)return false;return renderer.draw(ctx,controllerFor(p).frame,cfg.height*CONFIG.frameSize[1]/CONFIG.hullHeight);}
 function paint(img,e){
  if(!renderer.ready||!img.isConnected||img.dataset.skinId!==CONFIG.id||img.parentElement!==e.wrap)return;
  const w=img.clientWidth,h=img.clientHeight;if(!w||!h)return;
  if(e.frame===e.controller.frame&&e.w===w&&e.h===h)return;
  e.frame=e.controller.frame;e.w=w;e.h=h;e.canvas.width=w;e.canvas.height=h;
  const ctx=e.canvas.getContext('2d');ctx.translate(w/2,h/2);renderer.draw(ctx,e.frame,Math.min(w,h));img.style.opacity='0';
 }
 function updatePreviews(now){
  for(const img of document.querySelectorAll('img[data-skin-id="prism_core"],.prism-core-preview > img')){
   if(img.dataset.skinId!==CONFIG.id){img.style.opacity='';if(img.parentElement.classList.contains('prism-core-preview'))img.parentElement.replaceWith(img);previews.delete(img);continue;}
   let e=previews.get(img);
   if(!e){const wrap=document.createElement('span'),canvas=document.createElement('canvas');wrap.className='prism-core-preview';canvas.setAttribute('aria-hidden','true');img.replaceWith(wrap);wrap.append(img,canvas);e={wrap,canvas,controller:new AnimationController(),last:now,frame:-1};previews.set(img,e);const entry=e;renderer.load().then(()=>paint(img,entry)).catch(()=>{if(img.isConnected)img.style.opacity='';});}
   e.controller.update(Math.max(0,now-e.last));e.last=now;paint(img,e);
  }
 }
 return {CONFIG,AnimationController,renderer,preload:()=>renderer.load(),controllerFor,updatePlayer,drawBody,updatePreviews,resetPlayer(p){controllers.delete(p);},clear(){controllers=new WeakMap();}};
});
