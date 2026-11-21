/* Boss 6. Combat state is plain JSON and all random decisions use host replay RNG. */
(() => {
  'use strict';
  const C=window.SpaceDreadnoughtConfig,W=1280,H=720;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const random=()=>window.SpaceFlightRandom();
  const between=(a,b)=>a+(b-a)*random();
  const source=new URL('./assets/sprites/',document.currentScript.src);
  const images=new Map();
  const files={
    tur_base:'turrets',head_fan_wave:'turrets',head_expanding_orb:'turrets',
    head_twin_crossfire:'turrets',head_homing_missile:'turrets',head_shotgun_missile:'turrets',
    turret_sprinkler:'turrets',head_charging_laser:'turrets',
    ind_priority_target:'ui',ind_sprinkler_marker:'ui',ind_fleet_entry_red:'ui',
    proj_standard_fan:'projectiles',proj_expanding_orb:'projectiles',proj_twin_cross:'projectiles',
    proj_missile_homing:'projectiles',proj_missile_shotgun:'projectiles',proj_sprinkler_orb:'projectiles',
    beam_laser_charge:'projectiles',beam_laser_fire:'projectiles',enemy_fighter:'enemies',
    enemy_missile_fighter:'enemies',enemy_laser_fighter:'enemies'
  };
  const ready=Promise.all(Object.entries(files).map(([name,folder])=>new Promise(resolve=>{
    const image=new Image();images.set(name,image);
    image.onload=()=>resolve(true);image.onerror=()=>resolve(false);
    image.src=new URL(folder+'/'+name+'.png',source).href;
  })));
  const deck=new Image();deck.src=new URL('./assets/boss-six-deck/preview.png',document.currentScript.src).href;
  function sprite(ctx,name,x,y,width,height=width,angle=0){
    const image=images.get(name);
    if(!image?.naturalWidth)return false;
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.imageSmoothingEnabled=false;
    const pivot=C.spritePivots[name]??[image.naturalWidth/2,image.naturalHeight/2];
    ctx.drawImage(image,-width*pivot[0]/image.naturalWidth,-height*pivot[1]/image.naturalHeight,width,height);ctx.restore();return true;
  }
  const goal=b=>b.dread?.required??(b.coop?C.coopObjective:C.objective);
  function updateProgress(b){
    b.max=goal(b);b.mid=b.max/2;
    const remaining=b.max-(b.dread.kills||0);
    if(remaining<=0 && !b.dread.finish)window.SpaceDreadnoughtEnding.begin(b);
    b.hp=b.dread.finish?.complete?0:Math.max(1,remaining);
  }
  function countKill(b,entity){
    if(entity.missile || entity.hp===null || entity.countedKill)return;
    entity.countedKill=true;
    b.dread.kills=(b.dread.kills||0)+1;
    window.SpaceDreadnoughtFormations.onKill(b.dread,entity);
    updateProgress(b);
  }
  function initialize(b){
    b.name='Dreadnought Assault';b.max=goal(b);b.hp=b.max;b.mid=b.max/2;
    b.dread={version:1,time:0,serial:0,turrets:[],fighters:[],projectiles:[],beams:[],
      pending:null,nextSpawn:0,nextGrid:0,waveIndex:0,pity:{},kills:0};
  }
  function nearest(api,x,y){
    return api.pilots.filter(p=>p.hp>0 && !p.respawn).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
  }
  function addTurret(s,type,x,y,api){
    const spec=C.types[type];
    if(spec.priority)api?.sound?.('priorityWarning');
    s.turrets.push({id:'deck-'+(++s.serial),type,x,y,hp:spec.hp,max:spec.hp,angle:Math.PI/2,
      next:s.time+1.5,charge:0,shot:0,lock:null});
  }
  function waveActive(s){return !!s.pending || ['entering','exiting'].includes(s.formation?.phase);}
  function spawnTurrets(s,api){
    if(s.turrets.length>=C.maxTurrets)return;
    const restricted=waveActive(s);
    const choices=Object.keys(C.types).filter(key=>s.time>=C.types[key].unlockTime &&
      (!restricted || ['sprinkler','homing','shotgun'].includes(key)) &&
      (key!=='sprinkler' || !s.turrets.some(t=>t.type==='sprinkler')));
    if(!choices.length)return;
    const type=choices[Math.floor(random()*choices.length)],spec=C.types[type];
    const chance=Math.min(1,spec.spawnChance+(s.pity[type]||0));
    if(random()>chance){s.pity[type]=(s.pity[type]||0)+.12;return;}
    s.pity[type]=0;
    const side=random()<.5?-1:1;
    const x=640+side*between(260,430);
    if(s.turrets.some(t=>Math.abs(t.x-x)<70 && t.y<100))return;
    addTurret(s,type,x,-50,api);
  }
  function addProjectile(s,x,y,angle,type,speed){
    if(s.projectiles.length>=C.maxProjectiles)return;
    const missile=['homing','shotgun'].includes(type);
    if(missile && s.projectiles.filter(p=>p.missile && p.hp>0).length>=C.maxMissiles)return;
    s.projectiles.push({id:'projectile-'+(++s.serial),x,y,angle,type,missile,hp:missile?2:1,
      age:0,speed:C.baseProjectileSpeed*speed,baseSpeed:C.baseProjectileSpeed*speed,
      radius:type==='orb'?5:missile?9:5});
  }
  function discharge(s,t,api){
    const spec=C.types[t.type],aim=t.angle;
    if(t.type==='sprinkler'){
      // Fire one simultaneous four-muzzle burst, aligned with the rotating head.
      if(s.projectiles.length<=C.maxProjectiles-spec.count){
        for(let i=0;i<spec.count;i++){
          const angle=aim+i*Math.PI*2/spec.count;
          addProjectile(s,t.x+Math.cos(angle)*28,t.y+Math.sin(angle)*28,angle,t.type,spec.speed);
        }
      }
    }else if(t.type==='laser'){
      if(s.beams.length<C.maxBeams)s.beams.push({
        x:t.x+Math.cos(aim)*42,y:t.y+Math.sin(aim)*42,angle:aim,remaining:spec.fireDuration,hit:[]
      });
    }else{
      for(let i=0;i<spec.count;i++){
        const offset=(i-(spec.count-1)/2)*(t.type==='shotgun'?.17:t.type==='twin'?-.14:.14);
        const side=t.type==='twin'?(i?13:-13):0;
        addProjectile(s,t.x+Math.cos(aim)*36-Math.sin(aim)*side,t.y+Math.sin(aim)*36+Math.cos(aim)*side,aim+offset,t.type,spec.speed);
      }
    }
    api.sound?.(({fan:'fanFire',orb:'orbFire',twin:'twinFire',homing:'missileLaunch',shotgun:'shotgunLaunch',sprinkler:'sprinklerFire',laser:'laserFire'})[t.type]);
  }
  function laserSlotsUsed(s){
    return s.beams.length+s.turrets.filter(t=>t.type==='laser' && t.charge>0 && t.hp>0).length+
      s.fighters.filter(f=>f.hp>0 && f.laser).length;
  }
  function updateTurrets(b,dt,api){
    const s=b.dread,restricted=waveActive(s);
    for(const t of s.turrets){
      t.y+=C.scrollSpeed*dt;
      if(t.hp!==null && t.hp<=0)continue;
      if(restricted && !['sprinkler','homing','shotgun'].includes(t.type)){
        t.charge=0;t.lock=null;t.next=Math.max(t.next,s.time+1);continue;
      }
      const spec=C.types[t.type],pilot=nearest(api,t.x,t.y);
      if(!pilot)continue;
      if(t.type==='sprinkler')t.angle+=dt*.72;
      else if(!t.charge)t.angle=Math.atan2(pilot.y-t.y,pilot.x-t.x);
      if(t.charge>0){
        t.charge-=dt;
        if(t.charge<=1e-8){
          t.charge=0;discharge(s,t,api);
          t.next=s.time+spec.cooldown;
        }
      }else if(s.time>=t.next){
        if(t.type==='laser' && (laserSlotsUsed(s)>=C.maxBeams || s.turrets.some(o=>o!==t && o.type==='laser' && o.charge)))continue;
        const cue=({laser:'laserCharge',orb:'orbCharge',homing:'missileLock',shotgun:'missileLock',fan:'fanCharge',twin:'twinCharge'})[t.type];
        if(cue)api.sound?.(cue);
        t.charge=spec.chargeTime;t.lock={x:pilot.x,y:pilot.y};
      }
    }
    s.turrets=s.turrets.filter(t=>(t.hp===null || t.hp>0)&&t.y<H+70);
  }
  function updateFighters(b,dt,api){
    const s=b.dread;
    for(const f of s.fighters){
      f.age+=dt;
      if(f.age<0 || f.hp<=0)continue;
      for(const p of api.pilots){
        const contact=api.touchesPilot?api.touchesPilot(f,p,30):Math.hypot(p.x-f.x,p.y-f.y)<=30;
        if(p.hp<=0 || p.respawn || !contact)continue;
        f.hp=0;f.laser=null;countKill(b,f);api.fighterDown?.();api.damage(p);api.miniBlast(f.x,f.y,42);api.sound?.('fighterExplosion');break;
      }
      if(f.hp<=0 || s.finish)continue;
      if(f.laser){
        if(s.time+1e-8>=f.laser.fireAt){
          s.beams.push({...f.laser,remaining:.26,halfWidth:9,hit:[]});
          f.laser=null;api.sound?.('laserFire');
        }
        continue;
      }
      const pilot=nearest(api,f.x,f.y);
      if(pilot)f.angle=Math.atan2(pilot.y-f.y,pilot.x-f.x);
      if(!pilot || s.time<f.next || f.x<0 || f.x>W || f.y<0 || f.y>H)continue;
      const x=f.x+Math.cos(f.angle)*22,y=f.y+Math.sin(f.angle)*22;
      if(f.loadout==='laser'){
        if(s.formation?.phase!=='holding' || laserSlotsUsed(s)>=C.maxBeams)continue;
        f.laser={x,y,angle:f.angle,fireAt:s.time+.75};
        f.next=s.time+6+between(0,1.5);api.sound?.('laserCharge');
      }else if(f.loadout==='missile'){
        f.next=s.time+5+between(0,1.5);
        addProjectile(s,x,y,f.angle,'homing',.95);api.sound?.('missileLaunch');
      }else{
        f.next=s.time+C.fighterCooldown+between(0,1);
        if(random()<C.fighterShotChance){
          addProjectile(s,x,y,f.angle,'fan',random()<.5?1:.95);api.sound?.('fighterFire');
        }
      }
    }
    s.fighters=s.fighters.filter(f=>f.hp>0 && !f.retired);
  }
  function updateProjectiles(b,dt,api){
    const s=b.dread;
    const travel=dt*(api.projectileScale??1);
    for(const p of s.projectiles){
      if(p.hp<=0)continue;
      p.age+=dt;
      const target=nearest(api,p.x,p.y);
      if(p.missile){
        if(p.age<.7 && target){
          const angle=Math.atan2(target.y-p.y,target.x-p.x);
          const turn=Math.atan2(Math.sin(angle-p.angle),Math.cos(angle-p.angle));
          p.angle+=clamp(turn,-dt*.65,dt*.65);
        }
        p.speed=p.baseSpeed*(1+.6*Math.min(1,p.age/1.2));
      }
      if(p.type==='orb')p.radius=Math.min(27,5+p.age*4);
      p.x+=Math.cos(p.angle)*p.speed*travel;p.y+=Math.sin(p.angle)*p.speed*travel;
      for(const pilot of api.pilots)if(pilot.hp>0 && !pilot.respawn &&
          Math.hypot(pilot.x-p.x,pilot.y-p.y)<p.radius+10){
        p.hp=0;api.damage(pilot);break;
      }
    }
    s.projectiles=s.projectiles.filter(p=>p.hp>0 && p.age<9 && p.x>-60 && p.x<W+60 && p.y>-80 && p.y<H+80);
    for(const beam of s.beams){
      beam.remaining-=dt;
      for(const [seat,p] of api.pilots.entries()){
        const dx=p.x-beam.x,dy=p.y-beam.y,c=Math.cos(beam.angle),sn=Math.sin(beam.angle);
        if(!beam.hit.includes(seat) && p.hp>0 && !p.respawn &&
           dx*c+dy*sn>=0 && Math.abs(dx*sn-dy*c)<(beam.halfWidth??17)){
          beam.hit.push(seat);api.damage(p);
        }
      }
    }
    s.beams=s.beams.filter(beam=>beam.remaining>0);
  }
  function update(b,dt,api){
    if(!(dt>0)||b.hp<=0)return;
    if(!b.dread)initialize(b);
    b.clock+=dt;
    if(b.clock<C.introSeconds)return;
    const s=b.dread;s.time+=dt;s.shake=Math.max(0,(s.shake||0)-dt);
    if(s.secondaryAt && s.time>=s.secondaryAt){api.sound?.('turretSecondary');s.secondaryAt=null;}
    if(s.finish){window.SpaceDreadnoughtEnding.update(b,dt,api);updateProgress(b);return;}
    window.SpaceDreadnoughtFormations.update(s,dt,api);
    if(s.time>=s.nextSpawn){
      spawnTurrets(s,api);s.nextSpawn=s.time+C.spawnInterval;
    }
    updateTurrets(b,dt,api);updateFighters(b,dt,api);updateProjectiles(b,dt,api);
    updateProgress(b);
    b.phase=b.hp>b.mid?1:2;
  }
  function targets(b){
    const s=b.dread;
    if(!s || s.finish || b.clock<C.introSeconds)return [];
    const bodies=[...s.turrets,...s.fighters,...s.projectiles.filter(p=>p.missile)];
    return bodies.filter(e=>e.hp===null || e.hp>0).map(e=>({
      id:e.id,x:e.x,y:e.y,w:e.id.startsWith('fighter')?22:e.missile?10:30,
      h:e.id.startsWith('fighter')?22:e.missile?14:30
    }));
  }
  function hit(b,id,amount,api){
    if(!(amount>0) || b.clock<C.introSeconds || b.dread?.finish)return;
    const s=b.dread,entity=[...s.turrets,...s.fighters,...s.projectiles].find(e=>e.id===id);
    if(!entity || entity.hp===null || entity.hp<=0)return;
    entity.hp=Math.max(0,entity.hp-amount);
    api.miniBlast?.(entity.x,entity.y,entity.hp?20:48);
    if(entity.hp){api.sound?.('armorHit');return;}
    api.burst?.(entity.x,entity.y,'#151b26',entity.type && !entity.missile?10:4);
    api.sound?.(entity.missile?'projectilePop':entity.type?'turretExplosion':'fighterExplosion');
    if(entity.type && !entity.missile)s.secondaryAt=s.time+.13;
    if(!entity.missile)s.shake=Math.max(s.shake||0,entity.type?.14:.06);
    if(!entity.missile){
      countKill(b,entity);
      if(!entity.type)api.fighterDown?.();
      api.award?.(entity.type?250:75);
    }
    updateProgress(b);
  }
  function background(ctx,b){
    ctx.save();ctx.imageSmoothingEnabled=false;
    if(deck.naturalWidth){
      const scroll=(Math.max(0,b.clock-C.introSeconds)*C.scrollSpeed);
      const tile=Math.floor(scroll/720),offset=scroll%720;
      // Alternating mirrored panels join identical edge rows at every boundary.
      for(let i=-1;i<=1;i++){
        ctx.save();ctx.translate(0,offset+i*720);
        if((tile-i)%2){ctx.translate(0,720);ctx.scale(1,-1);}
        ctx.drawImage(deck,0,0,W,H);ctx.restore();
      }
    }else{
      ctx.fillStyle='#101b28';ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#29394a';ctx.fillRect(0,0,350,H);ctx.fillRect(930,0,350,H);
    }
    ctx.restore();
  }
  function indicator(ctx,name,x,y,angle=0){
    if(sprite(ctx,name,x,y,24,32,angle))return;
    ctx.fillStyle='#ff4c56';ctx.font='bold 26px monospace';ctx.textAlign='center';ctx.fillText('!',x,y);
  }
  function beam(ctx,x,y,angle,live,halfWidth=17){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle-Math.PI/2);
    const width=live?halfWidth*2+10:8;
    if(!sprite(ctx,live?'beam_laser_fire':'beam_laser_charge',0,850,width,1700)){
      ctx.fillStyle=live?'#ff91f4':'#e872b65c';ctx.fillRect(-width/2,0,width,1700);
    }
    ctx.restore();
  }
  function draw(ctx,b){
    const s=b.dread;if(!s)return;
    ctx.save();ctx.imageSmoothingEnabled=false;
    if(s.shake && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)ctx.translate(Math.sin(s.time*90)*2*s.shake/.14,Math.cos(s.time*75)*s.shake/.14);
    for(const t of s.turrets){
      if(t.hp!==null && t.hp<=0)continue;
      const spec=C.types[t.type];
      if(!sprite(ctx,'tur_base',t.x,t.y,72)){
        ctx.fillStyle='#526778';ctx.fillRect(t.x-30,t.y-30,60,60);
      }
      if(!sprite(ctx,spec.head,t.x,t.y,64,64,t.angle+Math.PI/2)){
        ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.angle);
        ctx.fillStyle='#a9cddd';ctx.fillRect(-10,-7,40,14);ctx.restore();
      }
      if(spec.priority)indicator(ctx,'ind_priority_target',t.x,t.y-48);
      if(t.type==='sprinkler')indicator(ctx,'ind_sprinkler_marker',t.x,t.y-48);
      if(t.charge>0){
        ctx.save();ctx.globalAlpha=.3+.35*Math.sin(s.time*25)**2;
        if(t.type==='laser')beam(ctx,t.x+Math.cos(t.angle)*42,t.y+Math.sin(t.angle)*42,t.angle,false);
        else{ctx.strokeStyle='#ffc46a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(t.x,t.y,37,0,Math.PI*2);ctx.stroke();}
        ctx.restore();
      }
    }
    for(const f of s.fighters){
      if(f.age<0 || f.hp<=0)continue;
      if(f.laser && !s.finish){
        ctx.save();ctx.globalAlpha=.65+.30*Math.sin(s.time*20)**2;
        beam(ctx,f.laser.x,f.laser.y,f.laser.angle,false,9);ctx.restore();
      }
      const spriteName=f.loadout==='missile'?'enemy_missile_fighter':f.loadout==='laser'?'enemy_laser_fighter':'enemy_fighter';
      if(!sprite(ctx,spriteName,f.x,f.y,46,46,f.angle-Math.PI/2)){
        ctx.fillStyle='#b3d4df';ctx.fillRect(f.x-17,f.y-12,34,24);
      }
    }
    for(const p of s.projectiles){
      const spec=C.types[p.type],size=p.type==='orb'?p.radius*2:p.missile?26:16;
      if(!sprite(ctx,spec.projectile,p.x,p.y,size,p.missile?size*1.8:size,p.angle+Math.PI/2)){
        ctx.fillStyle=p.missile?'#ffab6b':'#66e9ff';ctx.fillRect(p.x-size/2,p.y-size/2,size,size);
      }
    }
    for(const ray of s.beams)beam(ctx,ray.x,ray.y,ray.angle,true,ray.halfWidth);
    if(s.pending){
      const p=s.pending;
      const x=p.route==='left'?240:p.route==='right'?1040:p.sign>0?32:W-32;
      const y=p.route==='horizontal'?240:38;
      ctx.globalAlpha=Math.floor(s.time*4)%2?.35:1;
      const angle=p.route==='horizontal'?(p.sign>0?-Math.PI/2:Math.PI/2):
        p.route==='diagonal'?(p.sign>0?-Math.PI/4:Math.PI/4):0;
      indicator(ctx,'ind_fleet_entry_red',x,y,angle);
      ctx.globalAlpha=1;
    }
    if(s.finish){window.SpaceDreadnoughtEnding.overlay(ctx,b);ctx.restore();return;}
    ctx.fillStyle='#101822cc';ctx.fillRect(470,15,340,34);
    ctx.fillStyle='#91eee4';ctx.font='bold 15px system-ui';ctx.textAlign='center';
    ctx.fillText('TARGETS  /  '+Math.min(goal(b),s.kills||0)+' / '+goal(b),640,38);
    ctx.restore();
  }
  window.SpaceDreadnought=Object.freeze({ready,initialize,update,targets,hit,draw,background,sprite});
})();
