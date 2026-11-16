/* Cosmetic articulated wings. No player coordinates, hitboxes or combat stats are changed. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../../config/ornithopter'):root.SkyOrnithopterConfig);if(typeof module==='object'&&module.exports)module.exports=api;else root.SkyOrnithopter=api;})(globalThis,function(CONFIG){
    'use strict';
    const TAU=Math.PI*2,clamp=(n,a,b)=>Math.min(b,Math.max(a,n)),mix=(a,b,t)=>a+(b-a)*t;
    const STATES=Object.freeze({DEPLOYED:'deployed',DEPLOYING:'deploying',RETRACTING:'retracting',RETRACTED:'retracted'});

    class WingDynamics {
        constructor(){this.deployment=1;this.deploymentVelocity=0;this.phase=0;this.animationTime=0;this.animationFrame=0;this.flapPhase=0;this.state=STATES.DEPLOYED;this.velocityY=0;this.forward=false;this.initialized=false;this.decelerating=false;}
        update(dt,motion={}){
            if(!Number.isFinite(dt)||dt<=0)return this;
            const seconds=dt/1000;
            const velocity=Number.isFinite(motion.velocityY)?motion.velocityY:(Number.isFinite(motion.dy)?motion.dy/seconds:0);
            const acceleration=this.initialized?(velocity-this.velocityY)/seconds:0;
            this.decelerating=this.initialized&&this.velocityY<-CONFIG.enterForwardSpeed&&acceleration>CONFIG.deceleration;
            if(velocity<-CONFIG.enterForwardSpeed)this.forward=true;
            else if(velocity>-CONFIG.leaveForwardSpeed)this.forward=false;
            this.velocityY=velocity;this.initialized=true;
            const target=this.forward&&!this.decelerating?0:1;
            // Exact critically damped spring; small animation slices keep phase consistent across frame rates.
            let remaining=Math.min(seconds,1);
            while(remaining>1e-9){
                const step=Math.min(remaining,1/120),omega=CONFIG.springFrequency;
                const offset=this.deployment-target,slope=this.deploymentVelocity+omega*offset,term=slope*step,decay=Math.exp(-omega*step);
                this.deployment=clamp(target+(offset+term)*decay,0,1);
                this.deploymentVelocity=(this.deploymentVelocity-omega*term)*decay;
                remaining-=step;
            }
            // Only the wing pose advances at 8 FPS. Controls and the folding spring keep their normal update rate.
            this.animationTime+=Math.min(seconds,1);
            this.animationFrame=Math.floor((this.animationTime+1e-9)*CONFIG.animationFps);
            this.phase=((this.animationTime*CONFIG.animationFps*.5)%1)*TAU;
            this.flapPhase=(this.animationFrame%2)*Math.PI;
            this.state=target===0?(this.deployment<.02?STATES.RETRACTED:STATES.RETRACTING):(this.deployment>.98?STATES.DEPLOYED:STATES.DEPLOYING);
            return this;
        }

        geometry(side,pair,cfg,texture=CONFIG.wing){
            const bodyHeight=cfg.height*CONFIG.bodyHeightRatio,bodyWidth=bodyHeight*CONFIG.body.rect[2]/CONFIG.body.rect[3];
            const root={x:(side<0?CONFIG.hinges.leftX-.5:CONFIG.hinges.rightX-.5)*bodyWidth,y:((pair===0?CONFIG.hinges.frontY:CONFIG.hinges.rearY)-.5)*bodyHeight};
            const length=cfg.width*CONFIG.spanRatio*(pair===0?1:CONFIG.rearSpanRatio),chord=length*texture.rect[3]/texture.rect[2];
            // Fold/unfold retains its existing transition. Deployed wings never flap, twist or change span.
            const sweep=mix(CONFIG.foldSweep,pair===0?CONFIG.frontSweep:CONFIG.rearSweep,this.deployment);
            const direction=(this.animationFrame%2===0?-1:1)*(pair===0?1:-1);
            const tipOffset=direction*CONFIG.tipTravelPx*.5*this.deployment,points=[];
            for(let column=0;column<=CONFIG.meshSegments;column++){
                const u=column/CONFIG.meshSegments,r=(texture.pivot[0]-u)/texture.pivot[0];
                const t=clamp(r,0,1),weight=t*t*(3-2*t);
                // Only Y (the body's longitudinal axis) vibrates, fading to zero at the fixed hinge.
                // Consecutive poses move the outer tip 2.5 game pixels, from -1.25 to +1.25.
                const spanX=r*length*Math.cos(sweep),spanY=r*length*Math.sin(sweep)+tipOffset*weight;
                const strip=[];
                for(const v of [0,1]){
                    const across=(v-texture.pivot[1])*chord;
                    strip.push({x:root.x+side*(spanX-across*Math.sin(sweep)),y:root.y+spanY+across*Math.cos(sweep),u,v});
                }
                points.push(strip);
            }
            return {root,points,sweep,tipOffset};
        }
    }

    function triangle(ctx,img,source,destination){
        const [p,q,r]=source,[a,b,c]=destination;
        const det=p.x*(q.y-r.y)+q.x*(r.y-p.y)+r.x*(p.y-q.y);
        if(Math.abs(det)<1e-8)return;
        const solve=key=>[(a[key]*(q.y-r.y)+b[key]*(r.y-p.y)+c[key]*(p.y-q.y))/det,(a[key]*(r.x-q.x)+b[key]*(p.x-r.x)+c[key]*(q.x-p.x))/det,(a[key]*(q.x*r.y-r.x*q.y)+b[key]*(r.x*p.y-p.x*r.y)+c[key]*(p.x*q.y-q.x*p.y))/det];
        const x=solve('x'),y=solve('y');
        ctx.save();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();ctx.clip();
        ctx.transform(x[0],y[0],x[1],y[1],x[2],y[2]);ctx.drawImage(img,0,0);ctx.restore();
    }

    function draw(ctx,state,cfg,image,ready){
        const body=image(CONFIG.body.file),wing=image(CONFIG.wing.file),blur=image(CONFIG.blurWing.file);
        if(!ready(body)||!ready(wing))return false;
        state=state||new WingDynamics();
        ctx.save();ctx.imageSmoothingEnabled=false;
        // Blend motion blur into BOTH front/rear pairs on BOTH sides. Folded wings stay sharp.
        const blurAmount=ready(blur)?clamp((state.deployment-.08)/.5,0,1):0;
        const layers=[{img:wing,texture:CONFIG.wing,alpha:1-blurAmount},{img:blur,texture:CONFIG.blurWing,alpha:blurAmount}];
        // Hind wings first; the body covers all four root sockets with a fixed pivot.
        for(const pair of [1,0])for(const side of [-1,1])for(const layer of layers){
            if(layer.alpha<=0)continue;
            ctx.save();ctx.globalAlpha*=layer.alpha;
            const mesh=state.geometry(side,pair,cfg,layer.texture),rect=layer.texture.rect;
            const uv=p=>({x:rect[0]+p.u*rect[2],y:rect[1]+p.v*rect[3]});
            for(let i=0;i<mesh.points.length-1;i++){
                const a=mesh.points[i][0],b=mesh.points[i+1][0],c=mesh.points[i+1][1],d=mesh.points[i][1];
                triangle(ctx,layer.img,[uv(a),uv(b),uv(c)],[a,b,c]);triangle(ctx,layer.img,[uv(a),uv(c),uv(d)],[a,c,d]);
            }
            ctx.restore();
        }
        const [sx,sy,sw,sh]=CONFIG.body.rect,height=cfg.height*CONFIG.bodyHeightRatio,width=height*sw/sh;
        ctx.drawImage(body,sx,sy,sw,sh,-width/2,-height/2,width,height);
        ctx.restore();return true;
    }

    const previews=new WeakMap();
    function preview(ctx,img,now,width,height,image,ready){
        let data=previews.get(img);if(!data){data={state:new WingDynamics(),time:now};previews.set(img,data);}
        data.state.update(clamp(now-data.time,0,100),{velocityY:0});data.time=now;
        const scale=Math.min(width/126,height/100);
        ctx.save();ctx.scale(scale,scale);const drawn=draw(ctx,data.state,{width:48,height:64},image,ready);ctx.restore();return drawn;
    }
    return {CONFIG,STATES,WingDynamics,draw,preview};
});
