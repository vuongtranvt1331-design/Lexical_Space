/* Cosmetic-only ES6 controller. Uses the host game loop; never creates timers or modifies combat. */
(function(root,factory){
    const api=factory(typeof module==='object'&&module.exports?require('../../config/skins/exalted-config.js'):root.SkyExaltedConfig);
    if(typeof module==='object'&&module.exports)module.exports=api;else root.SkyExalted=api;
})(globalThis,function(CONFIG){
    'use strict';
    const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
    const alive=t=>!!t&&t.active!==false&&t.hp>0&&!t.formation?.destroyed;
    const copy=poses=>Object.fromEntries(Object.entries(poses).map(([k,v])=>[k,{...v}]));
    function basePose(part,mode){
        const values=mode==='spread'?(CONFIG.periodicSpread.poses[part.id]||part.idle):part[mode==='forward'?'folded':mode==='burst'?'burst':'idle'];
        return {x:values[0],y:values[1],angle:values[2],
            w:part.size[0],h:part.size[1]};
    }
    function formationMode(time,input){
        if(input.skillActive===true)return 'burst';
        if(input.backward===true)return 'spread';
        const spread=CONFIG.periodicSpread;
        if(time>=spread.firstStartMs&&(time-spread.firstStartMs)%spread.intervalMs<spread.durationMs)return 'spread';
        return input.forward===true?'forward':'idle';
    }
    // Visual-only hash: independent per wing and animation frame; never consumes gameplay randomness.
    function wingJitter(id,frame){
        if(frame===0||!CONFIG.vibration.parts.includes(id))return [0,0];
        let hash=2166136261;
        for(const ch of id)hash=Math.imul(hash^ch.charCodeAt(0),16777619);
        hash=Math.imul(hash^frame,0x45d9f3b);hash^=hash>>>16;
        return CONFIG.vibration.directions[(hash>>>0)%CONFIG.vibration.directions.length];
    }
    class ExaltedAnimationController {
        constructor(){this.reset();}
        reset(){
            this.time=0;this.frame=0;this.mode='idle';this.transition=null;this.skillActive=false;this.haloBlend=0;this.jitter={};
            this.poses=Object.fromEntries(CONFIG.parts.map(p=>[p.id,basePose(p,'idle')]));
            this.hitTargets=new Set();return this;
        }
        setMode(mode,frame=this.frame){
            if(mode!==this.mode){
                this.mode=mode;this.transition={from:copy(this.poses),frame};
            }
        }
        update(dt,input={}){
            if(input.dead){this.reset();return this;}
            this.skillActive=input.skillActive===true;
            if(!this.skillActive)this.hitTargets.clear();
            for(const t of this.hitTargets)if(!alive(t))this.hitTargets.delete(t);
            this.setMode(formationMode(this.frame*CONFIG.animation.frameMs,input));
            if(!Number.isFinite(dt)||dt<=0)return this;
            this.time+=dt;
            const next=Math.floor((this.time+1e-7)/CONFIG.animation.frameMs);
            // Formation, independent wing vibration and halo share the same 4 FPS clock.
            for(;this.frame<next;){
                this.frame++;
                // Evaluate every crossed animation tick so long host frames cannot skip or shift the 15s/5s cycle.
                this.setMode(formationMode(this.frame*CONFIG.animation.frameMs,input),this.frame-1);
                const target=Object.fromEntries(CONFIG.parts.map(p=>[p.id,basePose(p,this.mode)]));
                if(this.transition){
                    const t=clamp((this.frame-this.transition.frame)/CONFIG.animation.transitionFrames,0,1),mix=t*t*(3-2*t);
                    for(const id of Object.keys(target))for(const k of ['x','y','angle','w','h'])
                        target[id][k]=this.transition.from[id][k]+(target[id][k]-this.transition.from[id][k])*mix;
                    if(t===1)this.transition=null;
                }
                if(this.mode==='forward'){
                    // Preserve separation while bringing the original rigid wings closer.
                    for(const id of ['frontLeft','frontRight']){
                        const p=target[id],side=p.x===0?(id==='frontLeft'?-1:1):Math.sign(p.x);
                        p.x=side*Math.max(Math.abs(p.x),CONFIG.folding.minGap/2+p.w/2);
                    }
                }
                this.poses=target;
                this.jitter=Object.fromEntries(CONFIG.parts.map(p=>[p.id,wingJitter(p.id,this.frame)]));
                this.haloBlend=clamp(this.haloBlend+(this.skillActive?1:-1)/CONFIG.halo.expansionFrames,0,1);
            }
            return this;
        }
        markHit(target){if(this.skillActive&&alive(target)){if(!this.hitTargets.has(target)&&this.hitTargets.size>=CONFIG.mark.maxTargets)this.hitTargets.delete(this.hitTargets.values().next().value);this.hitTargets.add(target);}}
        targets(current){return this.skillActive?[...new Set([...this.hitTargets,current])].filter(alive):[];}
        haloVisible(input){return input?.dead!==true&&input?.isShieldActive===true&&input?.shieldHp>0;}
        get haloScale(){return 1+(CONFIG.halo.skillScale-1)*this.haloBlend;}
        get haloOpacity(){return this.skillActive?CONFIG.halo.skillOpacity:CONFIG.halo.opacity;}
        get haloAngle(){return this.frame*CONFIG.halo.rotationDegreesPerFrame*Math.PI/180;}
        get markScale(){return CONFIG.mark.pulseScales[this.frame%CONFIG.mark.pulseScales.length];}
    }
    function playerInput(player,dt=0){
        const shieldHp=typeof player.hasStandardShield==='function'&&player.hasStandardShield()?(player.shieldReady?1:0):Number(player.armor)||0;
        const dy=player.y-player.prevY;
        return {dead:player.hp<=0,skillActive:player.skillActiveTimer>0,shieldHp,isShieldActive:shieldHp>0,
            forward:dt>0?dy*1000/dt<CONFIG.folding.forwardVelocityThreshold:!!player.isMovingForward,
            backward:dt>0&&dy*1000/dt>CONFIG.folding.backwardVelocityThreshold};
    }
    function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
    function pixels(img){const c=canvas(img.naturalWidth,img.naturalHeight),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);return ctx.getImageData(0,0,c.width,c.height);}
    // Cut only the connected part identified in the manifest. Crop boxes can overlap without leaking adjacent wings.
    function partTexture(source,part){
        const spec=CONFIG.assets[part.asset||'parts'];
        const [sx,sy,w,h]=part.rect,out=canvas(w,h),ctx=out.getContext('2d'),data=ctx.createImageData(w,h),seen=new Uint8Array(w*h),queue=new Int32Array(w*h);
        const solid=i=>{const offset=((sy+Math.floor(i/w))*source.width+sx+i%w)*4;return spec.background==='transparent'?source.data[offset+3]>spec.alphaThreshold:source.data[offset+3]>0&&Math.max(...source.data.subarray(offset,offset+3))>spec.threshold;};
        const seed=(part.seed[1]-sy)*w+part.seed[0]-sx;
        if(seed<0||seed>=w*h||!solid(seed))throw Error('Exalted part seed is outside artwork: '+part.id);
        let head=0,tail=1;queue[0]=seed;seen[seed]=1;
        while(head<tail){
            const i=queue[head++],x=i%w,y=Math.floor(i/w),offset=((sy+y)*source.width+sx+x)*4;
            data.data.set(source.data.subarray(offset,offset+4),i*4);
            for(const j of [x?i-1:-1,x+1<w?i+1:-1,y?i-w:-1,y+1<h?i+w:-1]){
                if(j>=0&&!seen[j]&&solid(j)){seen[j]=1;queue[tail++]=j;}
            }
        }
        if(tail<500)throw Error('Exalted part extraction failed: '+part.id);
        ctx.putImageData(data,0,0);
        return pixelTexture(out,Math.round(part.size[0]),Math.round(part.size[1]));
    }
    function pixelTexture(source,w,h){
        const c=canvas(Math.max(1,w),Math.max(1,h)),ctx=c.getContext('2d');
        ctx.imageSmoothingEnabled=false;ctx.drawImage(source,0,0,c.width,c.height);return c;
    }
    function overlayTexture(img,spec,size){
        const data=pixels(img),d=data.data;let left=data.width,top=data.height,right=0,bottom=0;
        for(let i=0;i<d.length;i+=4){
            const ink=255-Math.min(d[i],d[i+1],d[i+2]);
            d[i+3]=ink>spec.threshold?255:0;
            if(!d[i+3])continue;
            if(spec.tint){d[i]=255;d[i+1]=255;d[i+2]=0;}
            const index=i/4,x=index%data.width,y=Math.floor(index/data.width);
            left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);
        }
        if(right<=left||bottom<=top)throw Error('Empty Exalted overlay');
        const source=canvas(data.width,data.height);source.getContext('2d').putImageData(data,0,0);
        const cropped=canvas(right-left,bottom-top);cropped.getContext('2d').drawImage(source,left,top,right-left,bottom-top,0,0,cropped.width,cropped.height);
        const scale=size/Math.max(cropped.width,cropped.height);
        return pixelTexture(cropped,Math.round(cropped.width*scale),Math.round(cropped.height*scale));
    }
    // Trim only transparent padding in a cached runtime texture; never rewrite the source PNG.
    function projectileTexture(img){
        const data=pixels(img);let left=data.width,top=data.height,right=0,bottom=0;
        for(let i=3;i<data.data.length;i+=4)if(data.data[i]>16){
            const index=(i-3)/4,x=index%data.width,y=Math.floor(index/data.width);
            left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);
        }
        if(right<=left||bottom<=top)throw Error('Empty Exalted sword');
        const [maxW,maxH]=CONFIG.projectile.displayBox,scale=Math.min(maxW/(right-left),maxH/(bottom-top));
        const c=canvas(Math.max(1,Math.round((right-left)*scale)),Math.max(1,Math.round((bottom-top)*scale))),ctx=c.getContext('2d');
        ctx.imageSmoothingEnabled=false;ctx.drawImage(img,left,top,right-left,bottom-top,0,0,c.width,c.height);return c;
    }
    class ExaltedRenderer {
        constructor(){this.ready=false;this.error=null;this.loading=null;this.bodyLoading=null;this.preview=null;this.assetErrors={};this.textures={};this.eliminationFrames=[];this.frames=new WeakMap();}
        requestImage(spec){
            return new Promise((resolve,reject)=>{
                const attempt=n=>{
                    const img=new Image();
                    img.onload=()=>resolve(img);
                    img.onerror=()=>n<2?attempt(n+1):reject(Error('Exalted asset unavailable: '+spec.file));
                    img.src=spec.file+'?v=2026-11-01-exalted-animation-8'+(n?'&retry='+n:'');
                };attempt(0);
            });
        }
        load(){
            if(this.loading)return this.loading;
            this.error=null;this.assetErrors={};this.atlasError=null;
            // The production atlas contains the exact preprocessed pixel textures. Loading it
            // requires no canvas readback, flood fill, background removal or large source sheets.
            const complete=this.loadAtlas().catch(error=>{
                this.atlasError=error.message;
                return this.loadSourceSheets();
            });
            this.bodyLoading=complete;
            this.loading=complete.then(()=>{
                if(Object.keys(this.assetErrors).length)this.loading=null;
                return this;
            }).catch(error=>{this.error=error;this.loading=null;throw error;});
            return this.loading;
        }
        async loadAtlas(){
            const spec=CONFIG.runtimeAtlas;
            if(!spec)throw Error('Exalted runtime atlas is not configured');
            const img=await this.requestImage(spec);
            if(img.naturalWidth!==spec.size[0]||img.naturalHeight!==spec.size[1])throw Error('Unexpected Exalted atlas dimensions');
            const textures={},effects=[];
            for(const id of [...CONFIG.parts.map(p=>p.id),'halo','mark','projectile',...Array.from({length:CONFIG.elimination.count},(_,i)=>'elimination'+i)]){
                const rect=spec.regions[id];
                if(!rect||rect.length!==4)throw Error('Missing Exalted atlas region: '+id);
                const [x,y,w,h]=rect;
                if(x<0||y<0||w<=0||h<=0||x+w>img.naturalWidth||y+h>img.naturalHeight)throw Error('Invalid Exalted atlas region: '+id);
                const c=canvas(w,h),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
                ctx.drawImage(img,x,y,w,h,0,0,w,h);
                if(id.startsWith('elimination'))effects[Number(id.slice(11))]=c;else textures[id]=c;
            }
            // Publish a complete set together so no partially loaded wings/halo get cached.
            this.textures=textures;this.eliminationFrames=effects;this.frames=new WeakMap();
            this.loadMode='atlas';this.ready=true;return this;
        }
        loadSourceSheets(){
            // Preserve the existing source-sheet path as a fallback if the atlas cannot load.
            const request=(_id,spec)=>this.requestImage(spec);
            const sheet=(img,id)=>{
                const data=pixels(img),size=CONFIG.assets[id].size;
                if(data.width!==size[0]||data.height!==size[1])throw Error('Unexpected Exalted sheet dimensions: '+id);
                return data;
            };
            // Body and four normal wings must not wait for unrelated skill/projectile effects.
            this.bodyLoading=request('parts',CONFIG.assets.parts).then(img=>{
                const source=sheet(img,'parts');
                for(const part of CONFIG.parts.filter(p=>!p.asset))this.textures[part.id]=partTexture(source,part);
                this.frames=new WeakMap();this.ready=true;return this;
            });
            const effects=Object.entries(CONFIG.assets).filter(([id])=>id!=='parts').map(async([id,spec])=>{
                try{
                    const img=await request(id,spec);
                    if(id==='preview')this.preview=img;
                    else if(id==='burstWings'){
                        const source=sheet(img,id),textures={};
                        for(const part of CONFIG.parts.filter(p=>p.asset===id))textures[part.id]=partTexture(source,part);
                        Object.assign(this.textures,textures);this.frames=new WeakMap();
                    }else if(id==='halo'||id==='mark')this.textures[id]=overlayTexture(img,spec,96);
                    else if(id==='projectile')this.textures.projectile=projectileTexture(img);
                    else if(id==='elimination'){
                        const effect=CONFIG.elimination,[fw,fh]=effect.frameSize;
                        if(img.naturalWidth!==fw*effect.columns||img.naturalHeight!==fh*effect.rows)throw Error('Unexpected Exalted effect sheet dimensions');
                        this.eliminationFrames=Array.from({length:effect.count},(_,i)=>{
                            const c=canvas(effect.pixelSize,effect.pixelSize),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
                            ctx.drawImage(img,i%effect.columns*fw,Math.floor(i/effect.columns)*fh,fw,fh,0,0,c.width,c.height);return c;
                        });
                    }
                }catch(error){this.assetErrors[id]=error.message;}
            });
            return Promise.all([this.bodyLoading,...effects]).then(()=>{this.loadMode='source-sheets';return this;});
        }
        frameFor(controller){
            let cached=this.frames.get(controller);
            if(cached&&cached.frame===controller.frame&&cached.poses===controller.poses&&cached.skillActive===controller.skillActive)return cached.canvas;
            const c=cached?.canvas||canvas(160,160),ctx=c.getContext('2d');ctx.clearRect(0,0,160,160);ctx.imageSmoothingEnabled=false;
            ctx.save();ctx.translate(80,80);
            for(const spec of CONFIG.parts){
                if(spec.visibleWhen==='skillActive'&&!controller.skillActive)continue;
                const p=controller.poses[spec.id],texture=this.textures[spec.id];
                if(!texture)continue;
                const [jx,jy]=controller.jitter[spec.id]||[0,0];
                ctx.save();ctx.translate(Math.round(p.x)+jx,Math.round(p.y)+jy);ctx.rotate(p.angle);
                ctx.drawImage(texture,-p.w/2,-p.h/2,p.w,p.h);
                ctx.restore();
            }
            ctx.restore();this.frames.set(controller,{frame:controller.frame,poses:controller.poses,skillActive:controller.skillActive,canvas:c});return c;
        }
        draw(ctx,controller,height,input={}){
            if(!this.ready||input.dead)return false;
            const scale=height/CONFIG.animation.referenceHeight;
            ctx.save();ctx.imageSmoothingEnabled=false;
            ctx.drawImage(this.frameFor(controller),-80*scale,-80*scale,160*scale,160*scale);
            // Visibility is checked on EVERY draw, including between animation ticks and after collisions.
            if(this.textures.halo&&controller.haloVisible(input)){
                ctx.save();ctx.globalAlpha=controller.haloOpacity;ctx.translate(CONFIG.halo.offset[0]*scale,CONFIG.halo.offset[1]*scale);ctx.rotate(controller.haloAngle);
                const size=CONFIG.halo.diameter*controller.haloScale*scale;ctx.drawImage(this.textures.halo,-size/2,-size/2,size,size);ctx.restore();
            }
            ctx.restore();return true;
        }
        drawProjectile(ctx,shot){
            if(!this.ready||shot.skinId!=='exalted'||shot.attackerKey!=='fighter_1'||shot.isSpecial)return false;
            const texture=this.textures.projectile;if(!texture)return false;
            ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(shot.x,shot.y);
            ctx.rotate(Math.atan2(shot.vy,shot.vx)+Math.PI/2);
            ctx.drawImage(texture,-texture.width/2,-texture.height/2,texture.width,texture.height);ctx.restore();return true;
        }
        drawElimination(ctx,effect){
            if(!this.ready||effect.age<0||effect.age>=CONFIG.elimination.durationMs)return false;
            const texture=this.eliminationFrames[Math.floor(effect.age/CONFIG.elimination.frameMs)];
            if(!texture)return false;
            ctx.save();ctx.imageSmoothingEnabled=false;
            ctx.drawImage(texture,effect.x-effect.size/2,effect.y-effect.size/2,effect.size,effect.size);ctx.restore();return true;
        }
        drawMarks(ctx,controller,targets,boxFor){
            if(!this.ready)return;
            const texture=this.textures.mark;if(!texture)return;
            ctx.save();ctx.imageSmoothingEnabled=false;
            for(const target of targets){
                const box=boxFor(target);
                if(!(box.w>0&&box.h>0))continue;
                // "cover" uses the larger ratio; never stretch a wide insignia into a tall enemy.
                const scale=Math.max(box.w/texture.width,box.h/texture.height)*controller.markScale;
                const w=Math.ceil(texture.width*scale),h=Math.ceil(texture.height*scale);
                ctx.drawImage(texture,Math.round(box.x-w/2),Math.round(box.y-h/2),w,h);
            }
            ctx.restore();
        }
    }
    const renderer=new ExaltedRenderer();let controllers=new WeakMap(),previews=new WeakMap();
    function supported(p){return p?.skinId==='exalted'&&p.aircraftIndex===0;}
    function controllerFor(p){let c=controllers.get(p);if(!c){c=new ExaltedAnimationController();controllers.set(p,c);}return c;}
    function preload(){return renderer.load();}
    function updatePlayer(p,dt){
        if(!supported(p)){controllers.delete(p);return;}
        controllerFor(p).update(dt,playerInput(p,dt));
    }
    function drawBody(ctx,p,cfg){
        if(!supported(p))return false;
        const c=controllerFor(p);c.skillActive=p.skillActiveTimer>0&&p.hp>0;
        if(renderer.draw(ctx,c,cfg.height,playerInput(p)))return true;
        // Use the exported real Exalted idle frame while the composite sheet is unavailable.
        const img=renderer.preview||p.aircraftImage;
        if(p.hp<=0||!img?.complete||!img.naturalWidth||!img.src.includes(CONFIG.assets.preview.file))return false;
        const size=160*cfg.height/CONFIG.animation.referenceHeight;
        ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(img,-size/2,-size/2,size,size);ctx.restore();return true;
    }
    function drawTarget(ctx,p,boss,boxFor){
        if(!supported(p))return;
        const c=controllerFor(p);
        if(p.hp<=0||p.skillActiveTimer<=0){c.skillActive=false;c.hitTargets.clear();return;}
        c.skillActive=true;
        renderer.drawMarks(ctx,c,c.targets(p.lockedTarget),t=>boxFor(t,boss));
    }
    function onHit(p,target,projectile){
        if(!supported(p)||projectile?.skinId!=='exalted'||p.skillActiveTimer<=0||p.hp<=0)return;
        const c=controllerFor(p);c.skillActive=true;c.markHit(target);
    }
    function drawPreview(img,entry){
        // A pending load must not paint into a removed card or a different selected skin.
        if(!img.isConnected||img.dataset.skinId!=='exalted'||img.parentElement!==entry.wrapper||!renderer.ready)return;
        const w=img.clientWidth,h=img.clientHeight;if(!w||!h)return;
        if(entry.frame===entry.controller.frame&&entry.w===w&&entry.h===h){img.style.opacity='0';return;}
        entry.w=w;entry.h=h;entry.frame=entry.controller.frame;
        entry.overlay.width=w;entry.overlay.height=h;
        const ctx=entry.overlay.getContext('2d');ctx.translate(w/2,h/2);
        renderer.draw(ctx,entry.controller,Math.min(w,h)*CONFIG.animation.referenceHeight/160);
        img.style.opacity='0';delete entry.wrapper.dataset.error;
    }
    function updatePreviews(now){
        for(const img of document.querySelectorAll('img[data-skin-id="exalted"],.exalted-preview > img')){
            if(img.dataset.skinId!=='exalted'){
                img.style.opacity='';img.parentElement.replaceWith(img);previews.delete(img);continue;
            }
            let entry=previews.get(img);
            if(!entry){
                const wrapper=document.createElement('span');wrapper.className='exalted-preview';
                const overlay=canvas(160,160);overlay.setAttribute('aria-hidden','true');
                img.replaceWith(wrapper);wrapper.append(img,overlay);
                // The normal image is the real Exalted idle frame; keep it visible until the canvas is painted.
                img.style.opacity='';
                entry={wrapper,overlay,controller:new ExaltedAnimationController(),last:now,frame:-1};previews.set(img,entry);
                // Paint the first frame as soon as artwork is ready, even before the host loop starts.
                // Subsequent animation still uses the existing game loop, with no extra timer or RAF.
                const complete=preload();
                renderer.bodyLoading.then(()=>drawPreview(img,entry)).catch(()=>{});
                complete.then(()=>{entry.frame=-1;drawPreview(img,entry);}).catch(()=>{
                    if(img.isConnected&&img.dataset.skinId==='exalted'&&img.parentElement===wrapper){wrapper.dataset.error='animated artwork unavailable';img.style.opacity='';}
                });
            }
            const dt=Math.max(0,Math.min(100,now-entry.last));entry.last=now;entry.controller.update(dt);
            drawPreview(img,entry);
        }
    }
    return {CONFIG,ExaltedAnimationController,ExaltedRenderer,playerInput,renderer,preload,updatePlayer,drawBody,drawTarget,onHit,updatePreviews,
        resetPlayer(p){controllers.delete(p);},clear(){controllers=new WeakMap();},controllerFor};
});
