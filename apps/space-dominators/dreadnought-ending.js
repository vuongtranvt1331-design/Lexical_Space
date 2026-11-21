/* Boss 6 finale. All timers, random choices and debris live in replayable boss state. */
(() => {
  'use strict';
  const C=window.SpaceDreadnoughtConfig;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
  const images={};
  const ready=Promise.all(Object.entries({hull:'star-destroyer.png',damage1:'boss-six-ending/hull-damage-1.png',damage2:'boss-six-ending/hull-damage-2.png',core:'boss-six-ending/reactor.png',closed:'boss-six-ending/reactor-closed.png'}).map(([key,path])=>new Promise(resolve=>{
    const im=new Image();images[key]=im;im.onload=()=>resolve(true);im.onerror=()=>resolve(false);
    im.src=new URL('./assets/'+path,document.currentScript.src).href;
  })));
  const artPatterns=[
    [[.31,.43,.05,.055],[.76,.64,.095,.075],[.64,.39,.035,.04],[.19,.78,.06,.055],[.5,.77,.055,.035],[.39,.955,.018,.012]],
    [[.70,.47,.05,.055],[.23,.68,.095,.075],[.38,.40,.035,.04],[.83,.79,.06,.055],[.49,.73,.055,.035],[.61,.955,.018,.012]]
  ];
  const random=()=>window.SpaceFlightRandom(),between=(a,b)=>a+(b-a)*random();
  function planDamage(){
    const variant=Math.floor(random()*artPatterns.length),mirror=random()<.5;
    const times=Array.from({length:3},(_,i)=>1.05+i*.84+between(-.07,.07));
    return {variant,mirror,sites:artPatterns[variant].map(([u,v,rx,ry],i)=>({
      kind:i<4?'edge':i===4?'bridge':'engine',u:mirror?1-u:u,v,rx,ry,at:times[Math.floor(i/2)]
    }))};
  }
  function begin(b){
    if(b.dread.finish)return;
    const s=b.dread;
    const damage=planDamage();
    s.finish={phase:'countdown',elapsed:0,age:0,attempt:++s.serial,core:{x:640,y:-24},fx:[],fleetFx:[],shards:[],nextBlast:0,damageStage:0,damageVariant:damage.variant,mirrorHull:damage.mirror,damageSites:damage.sites};
    s.pending=null;s.projectiles=[];s.beams=[];
  }
  function blast(e,x,y,size,api){
    e.fx.push({x,y,size,age:0});api.sound?.(size>85?'turretExplosion':'fighterExplosion');
    for(let i=0;i<5;i++)e.shards.push({space:'deck',x,y,vx:between(-160,160),vy:between(-130,130),age:0,size:between(6,13),spin:between(-3,3),angle:between(0,6.28),sx:between(.15,.7),sy:between(.4,.8)});
  }
  function phase(e,name){e.phase=name;e.age=0;}
  function fire(b,seat,api,attempt,reported){
    const e=b.dread?.finish,p=api.pilots.find(p=>(api.pilotSeat?.(p)??0)===seat);
    if(!e)return false;
    if(!['countdown','open','closed'].includes(e.phase))return true;
    const at=reported??e.elapsed;
    if(attempt!==undefined && attempt!==e.attempt)return true;
    if(!p || p.hp<=0 || p.respawn || !Number.isFinite(at) || at<3 || at>=3.25 || at>e.elapsed+.05 || e.elapsed>3.25+(b.coop?1:0))return true;
    e.start={x:p.x,y:p.y-30};e.seat=seat;
    e.cameraY=api.pilots.reduce((sum,p)=>sum+p.y,0)/api.pilots.length;
    phase(e,'missile');api.sound?.('missileLaunch');return true;
  }
  function update(b,dt,api){
    const s=b.dread,e=s.finish;if(!e)return;
    e.age+=dt;e.elapsed+=dt;
    if(!e.damageSites || !Number.isInteger(e.damageVariant)){const damage=planDamage();e.damageSites=damage.sites;e.damageVariant=damage.variant;e.mirrorHull=damage.mirror;}
    e.fleetFx??=[];
    for(const f of e.fx)f.age+=dt;e.fx=e.fx.filter(f=>f.age<.5);
    for(const f of e.fleetFx)f.age+=dt;e.fleetFx=e.fleetFx.filter(f=>f.age<.6);
    for(const p of e.shards){
      p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=p.spin*dt;
      const drag=Math.exp(-.35*dt);p.vx*=drag;p.vy*=drag;
    }
    e.shards=e.shards.filter(p=>p.age<6);
    if(['countdown','open','closed'].includes(e.phase)){
      e.core.y+=C.scrollSpeed*dt;
      for(const t of s.turrets)t.y+=C.scrollSpeed*dt;
      for(const f of s.fighters)f.y+=C.scrollSpeed*dt;
      if(e.phase==='countdown' && e.elapsed>=3){phase(e,'open');api.sound?.('priorityWarning');}
      if(e.phase==='open' && e.elapsed>=3.25)phase(e,'closed');
      // The visible window is always 250 ms; this closed interval only admits delayed validated co-op input.
      if(e.phase==='closed' && e.elapsed>=3.25+(b.coop?1:0)+.35){
        s.required=(s.required??(b.coop?C.coopObjective:C.objective))+(b.coop?30:20);
        s.finish=null;s.nextGrid=s.time;s.nextSpawn=s.time;
        window.SpaceDreadnoughtFormations?.retire(s,true);
        for(const t of s.turrets){t.charge=0;t.lock=null;t.next=s.time+1;}
        for(const f of s.fighters)f.next=s.time+1.5;
        api.sound?.('wrong');return;
      }
    }else if(e.phase==='missile' && e.age>=.7){
      phase(e,'chain');blast(e,e.core.x,e.core.y,110,api);e.nextBlast=.12;
    }else if(e.phase==='chain'){
      if(e.age>=e.nextBlast){
        e.nextBlast=e.age+.14;
        const pool=[...s.fighters,...s.turrets].filter(x=>x.hp===null || x.hp>0);
        const target=pool.length && random()<.7?pool[Math.floor(random()*pool.length)]:null;
        const x=target?target.x:between(330,950),y=target?target.y:between(70,640);
        if(target)target.hp=0;
        blast(e,x,y,between(36,90),api);
      }
      if(e.age>=3.5){phase(e,'zoom');e.shards=[];e.fx=[];api.sound?.('warp');}
    }else if(e.phase==='zoom'){
      while(e.damageStage<6 && e.age>=e.damageSites[e.damageStage].at){
        const site=e.damageSites[e.damageStage++],{u,v}=site;
        e.fleetFx.push({u,v,size:site.kind==='engine'?between(12,20):between(45,100),age:0});
        for(let i=0,n=site.kind==='engine'?3:Math.round(5+site.rx*30);i<n;i++)e.shards.push({space:'fleet',u,v,x:0,y:0,vx:u<.47?between(55,155):u>.53?-between(55,155):between(-155,155),vy:site.kind==='engine'?between(-65,-30):between(-95,95),age:0,size:site.kind==='engine'?between(3,6):between(7,17),spin:between(-3,3),angle:between(0,6.28),sx:clamp(u-.05,.01,.85),sy:clamp(v-.05,.01,.85)});
        api.sound?.('turretExplosion');
      }
      if(e.age>=4){phase(e,'hold');e.nextFleetBlast=.12;}
    }else if(e.phase==='hold'){
      if(e.age>=e.nextFleetBlast){
        e.nextFleetBlast=e.age+between(.18,.38);
        const site=e.damageSites[Math.floor(random()*6)];
        e.fleetFx.push({u:site.u+between(-site.rx*.3,site.rx*.3),v:site.v+between(-site.ry*.3,site.ry*.3),size:site.kind==='engine'?between(8,14):between(20,45),age:0});
        api.sound?.('fighterExplosion');
      }
      if(e.age>=4){
        phase(e,'escape');
        for(const p of api.pilots){const seat=api.pilotSeat?.(p)??0;p.x=640+(b.coop?(seat?40:-40):0);p.y=570;}
        api.sound?.('warp');
      }
    }else if(e.phase==='escape' && e.age>=.8){e.complete=true;b.hp=0;}
  }
  function paintBlast(ctx,x,y,size,progress){
    if(window.SpaceBossFX?.drawBlast?.(ctx,x,y,size,progress))return;
    ctx.fillStyle=progress<.3?'#fff2b8':'#f58a32';const n=size*(1-progress);ctx.fillRect(x-n/2,y-n/2,n,n);
  }
  function text(ctx,label,y,size,color='#d3f8fa'){
    ctx.font='bold '+size+'px monospace';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(label,640,y);
  }
  function drawShards(ctx,e,ship){
    const im=images.hull;if(!im?.naturalWidth)return;
    for(const p of e.shards){
      const fleet=p.space==='fleet';if(fleet&&!ship || !fleet&&ship)continue;
      const x=fleet?640-(p.u-.5)*ship.w+p.x:p.x,y=fleet?ship.y-(p.v-.5)*ship.h+p.y:p.y;
      const size=p.size*(fleet?Math.min(3,ship.h/580):1);
      ctx.save();ctx.globalAlpha=clamp(1-p.age/6,0,1);ctx.translate(x,y);ctx.rotate(p.angle);ctx.imageSmoothingEnabled=false;
      ctx.drawImage(im,p.sx*im.naturalWidth,p.sy*im.naturalHeight,im.naturalWidth*.09,im.naturalHeight*.07,-size/2,-size/2,size,size*.8);ctx.restore();
    }
  }
  function overlay(ctx,b){
    const e=b.dread?.finish;if(!e)return;
    ctx.save();ctx.imageSmoothingEnabled=false;
    if(['countdown','open','closed','missile'].includes(e.phase)){
      const open=e.phase==='open'||e.phase==='missile',im=open?images.core:images.closed;
      if(im.naturalWidth){ctx.drawImage(im,e.core.x-42,e.core.y-42,84,84);}
      else{ctx.fillStyle=open?'#84fff0':'#65488e';ctx.fillRect(e.core.x-24,e.core.y-24,48,48);}
      if(open){ctx.strokeStyle='#b4fff4';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.core.x,e.core.y,48,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp((3.25-e.elapsed)/.25,0,1));ctx.stroke();}
      if(e.phase==='missile'){
        const t=smooth(e.age/.7),x=e.start.x+(e.core.x-e.start.x)*t,y=e.start.y+(e.core.y-e.start.y)*t;
        const angle=Math.atan2(e.core.y-e.start.y,e.core.x-e.start.x);
        window.SpaceDreadnought.sprite(ctx,'proj_missile_homing',x,y,24,44,angle+Math.PI/2);
      }
    }
    for(const f of e.fx)paintBlast(ctx,f.x,f.y,f.size,f.age/.5);
    drawShards(ctx,e,null);
    if(e.phase==='countdown')text(ctx,String(Math.max(1,3-Math.floor(e.elapsed))),47,42);
    else if(e.phase==='open'){text(ctx,'E — FIRE',43,28,'#a6fff1');text(ctx,'0.25 s',64,13);}
    else if(e.phase==='closed')text(ctx,'CORE CLOSED',42,22,'#ffbd91');
    else if(e.phase==='missile')text(ctx,'MISSILE AWAY',42,20);
    ctx.restore();
  }
  function hull(ctx,x,y,h,damageStage=0,variant=0,mirror=false){
    const original=images.hull;if(!original.naturalWidth)return;
    const w=h*original.naturalWidth/original.naturalHeight;
    const atlas=images['damage'+(variant+1)],stage=Math.min(3,Math.ceil(damageStage/2));
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI);if(mirror)ctx.scale(-1,1);ctx.imageSmoothingEnabled=false;
    if(stage && atlas?.naturalWidth){
      const frameWidth=atlas.naturalWidth/3;
      ctx.drawImage(atlas,(stage-1)*frameWidth,0,frameWidth,atlas.naturalHeight,-w/2,-h/2,w,h);
    }else ctx.drawImage(original,-w/2,-h/2,w,h);
    ctx.restore();return {w,h,y};
  }
  function camera(e,overview=false){
    const t=overview||e.phase==='hold'?1:smooth(e.age/4),h=5200*Math.pow(580/5200,t);
    const anchorY=(e.cameraY??570)+(330-(.69-.5)*580-(e.cameraY??570))*t;
    return {t,h,y:anchorY+(.69-.5)*h,anchorY};
  }
  function fleet(ctx,e,time,overview=false){
    const {h,y}=camera(e,overview),ratio=h/580,carriers=window.SpaceFleetArrival?.carriers??[];
    for(const c of carriers)if(c.offset)hull(ctx,640+c.offset*ratio,c.y+(y-330),c.height*ratio);
    const active=(e.damageSites??[]).slice(0,e.damageStage),ship=hull(ctx,640,y,h,e.damageStage,e.damageVariant,e.mirrorHull);
    if(ship){
      drawShards(ctx,e,ship);
      for(const [i,site] of active.entries()){
        const x=640-(site.u-.5)*ship.w,py=y-(site.v-.5)*h;
        paintBlast(ctx,x,py,Math.min(45,h*Math.min(site.rx,site.ry)),.3+(.5+.5*Math.sin(time*9+i))*.45);
      }
      for(const f of e.fleetFx??[])paintBlast(ctx,640-(f.u-.5)*ship.w,y-(f.v-.5)*h,f.size*Math.min(2,h/580),f.age/.6);
    }
    return ship;
  }
  function drawScene(ctx,b,pilots){
    const e=b.dread.finish;
    if(e.phase==='escape'){
      window.SpaceDreadnought.background(ctx,b);
      const u=clamp(e.age/.8,0,1);
      for(const p of pilots)if(p.hp>0){
        const y=p.y-(p.y+320)*u*u*u;
        ctx.save();ctx.globalAlpha=.45*(1-u);ctx.fillStyle='#adf7ff';
        for(const offset of [-12,12])ctx.fillRect(p.x+offset-2,y+22,4,30+u*200);
        ctx.restore();window.SpaceArt.draw(ctx,p.ship,p.x,y,84,80*(1+u*u*2),Math.floor(b.clock*8));
      }
      return;
    }
    window.SpaceBackdrop.draw(ctx,b.clock);
    const ship=fleet(ctx,e,b.clock),cam=camera(e);
    if(e.phase==='zoom' && e.age<.5){ctx.save();ctx.globalAlpha=1-smooth(e.age/.5);window.SpaceDreadnought.background(ctx,b);ctx.restore();}
    for(const [i,p] of pilots.entries())if(p.hp>0){
      const size=84*Math.pow((8/3)/84,cam.t),targetX=640+(pilots.length>1?(i?1:-1)*ship.w*.014:0);
      window.SpaceArt.draw(ctx,p.ship,p.x+(targetX-p.x)*cam.t,p.y+(cam.anchorY-p.y)*cam.t,size,size,Math.floor(b.clock*8));
    }
  }
  function drawAftermath(ctx,b,time){ctx.save();fleet(ctx,{...b.dread.finish,phase:'hold',damageStage:6,shards:[]},time,true);ctx.restore();}
  window.SpaceDreadnoughtEnding=Object.freeze({ready,begin,fire,update,overlay,drawScene,drawAftermath});
})();
