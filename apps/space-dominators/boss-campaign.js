/* Host-owned boss state is plain JSON so a reconnect restores the exact attack
   warning, target coordinates, destructible objects and exposed components. */
(() => {
  'use strict';
  const cooldown=(b,seconds)=>seconds*(b.coop ? 0.7 : 1);
  const hardCooldowns=[2.5,5,5.8,6.6,5.9,6.5,6.5,8.5,6,7];
  const specials = [
    ['Echo Fan','Watch the staggered bolts, then slip through a reopened lane.'],
    ['Afterimage Rail','Land five hits during the charge to freeze the fan, then leave its firing sector.'],
    ['Brood Splitters','Intercept each mother missile before it releases three smaller missiles.'],
    ['Bridge Mine','Break the white-ringed mine to cancel its echo blast.'],
    ['Shift Change','Follow the glowing vent. The extra volley aims at your previous position.'],
    ['Dreadnought assault','Destroy the marked deck weapons and fighter formations.'],
    ['Crosslink','Break either hinge to cut the diagonal. An outside corridor stays open.'],
    ['Polarity Reversal','Follow the gap as the push reverses, or destroy the emitter.'],
    ['Pincer Flight','Stay in the middle gap, or shoot down the marked leader.'],
    ['Alternating Sweep','Wait for each lane marker to lock before crossing. The final core opens for five seconds.']
  ];
  const catalog = [
    ['Beacon Frigate', 115, 2.5, '#ffcd7a', 'boss', 'Follow the Solar Fan opening; weave through the three Echo Fan volleys.'],
    ['Rail Warden', 330, 5.2, '#ff946b', 'boss2', 'Watch the deployed muzzles. Move out of the converging sights.'],
    ['Hound Carrier', 660, 7, '#e8b3ff', 'boss3', 'Intercept homing missiles and fire into the launch bay.'],
    ['Anchor Miner', 1110, 8, '#ffa64f', 'boss2', 'Follow the mine warnings, skirt the gates and break the four cables.'],
    ['Asteroid Belts', 1290, 7, '#a9ebff', 'boss', 'Engines disabled. Type each word directly on its asteroid. Correct letters turn green.'],
    ['Dreadnought Assault', window.SpaceDreadnoughtConfig.objective, 8, '#91eee4', 'boss3', 'Assault the warship deck. Destroy turrets and fighter wings; avoid the marked crossing corridors.'],
    ['Gate Weaver', 1660, 8, '#88f7d4', 'boss3', 'Shoot a hinge to open a passage.'],
    ['Gravity Shepherd', 1840, 11, '#bfb2ff', 'boss2', 'Steer against the field or disable its emitter.'],
    ['Swarm Regent', 2020, 8, '#ffac91', 'boss', 'Destroy the marked leader to scatter the diving swarm.'],
    ['Eclipse Citadel', 2200, 9, '#ffda88', 'boss3', 'Destroy the turrets, then both reactors, then the central core.']
  ].map(([name,hp,cooldown,color,sprite,hint], i) => Object.freeze({
    index:i+1,name,hp,cooldown,skills:i===4 ? ['Short Signals','Word Run','Phrase Drift'].map(name=>({name,hint})) : window.SpaceEncounterSkills?.[i] || [],moveName:specials[i][0],hardHint:specials[i][1],hardCooldown:hardCooldowns[i],color,sprite,hint,seconds:i===5?110:60+20*i,phases:i===5?1:i===9?3:2
  }));
  const TAU = 2*Math.PI, clamp = (n,lo,hi) => Math.max(lo,Math.min(n,hi));
  const phaseOf = b => b.index===10 ? (b.hp>b.mid?1:b.hp>b.last?2:3) : (b.hp>b.mid?1:2);
  function create(index, options={}) {
    const def=catalog[index-1];
    if(!def)throw new RangeError('Unknown campaign boss');
    const max=Math.round(def.hp*(options.coop?1.6:1));
    const mid=Math.floor(max*(index===10?.70:.50)), last=Math.floor(max*.35);
    const phase=clamp(Number(options.phase)||1,1,def.phases);
    const b={index,name:def.name,x:640,y:112,hp:phase===1?max:phase===2?mid:last,max,mid,last,
      phase,coop:!!options.coop,clock:0,cycle:0,serial:0,attack:null,objects:[],units:[]};
    if (Number.isInteger(options.skillIndex) && def.skills[options.skillIndex]) b.practiceSkill=options.skillIndex;
    if(index===1 || index===2 || index===3){
      b.entryRemaining=1.6;
      b.y=-110;
      if(index===1)b.beaconWaves=[];
    }
    if(index===6)window.SpaceDreadnought.initialize(b);
    if(index===10) installCitadelParts(b);
    return b;
  }
  function installCitadelParts(b){
    b.units=[];
    if(b.phase===3)return;
    const count=b.phase===1?4:2;
    const budget=b.hp-(b.phase===1?b.mid:b.last);
    for(let i=0;i<count;i++){
      const hp=Math.floor(budget/count)+(i<budget%count?1:0);
      b.units.push({id:'unit'+i,dx:count===4?[-131,-62,62,131][i]:[-79,79][i],hp});
    }
  }
  function slot(b,id,x,y,w,h){return {id,x,y,w,h};}
  function hulls(b){
    if(b.index!==5)return [b.x];
    let side=b.phase===1?1:Math.cos(b.clock*.43);
    if(b.attack?.mode==='encounter'){
      side=b.twinSide||1;
      if(b.attack.skillIndex===1){
        const u=clamp((b.attack.t-.45)/.8,0,1);
        side*=Math.cos(Math.PI*u);
      }
    }
    return [b.x-155*side,b.x+155*side];
  }
  function exposed(b){
    const a=b.attack, t=a?.t??0;
    if(!a)return false;
    if(a.mode==='miner')return a.t>=.35 && a.t<1.5;
    if(a.mode==='encounter'){
      const skill=catalog[b.index-1].skills[a.skillIndex];
      if(b.index===2 && a.railVersion===3)return t>=a.fireAt && t<a.span;
      if(b.index===10)return b.phase===3 && t>=skill.windup && t<skill.windup+5;
      return t>=skill.windup && t<a.span;
    }
    switch(b.index){
      case 1:return t>=.9 && t<3.9;
      case 2:return t>=2.2 && t<5.5;
      case 3:return t>=.9 && t<5.5;
      case 5:return t>=.6 && t<4.6;
      case 10:return b.phase===3 && t>=2 && t<7;
      default:return true;
    }
  }
  function targets(b){
    if(b.index===6)return window.SpaceDreadnought.targets(b);
    if(b.index===5)return [];
    if(b.entryRemaining>0)return [];
    const parts=b.objects.filter(o=>o.hp>0).map(o=>slot(b,o.id,o.x,o.y,o.r,o.r));
    if(b.index===10 && b.phase<3){
      for(const u of b.units)if(u.hp>0)parts.push(slot(b,u.id,b.x+u.dx,b.y+17,24,21));
    }else if(b.index===5){
      const xs=hulls(b);
      const a=b.attack;
      const first=a?.side===-1?1:0;
      for(let i=0;i<2;i++){
        const live=a?.mode==='encounter' ? (i===((a.turn+(a.skillIndex===1 && a.t>1.05?1:0))%2) && a.t<a.span) : a?.special && a.t>=2.3
          ? (a.t<2.7 || i!==first) && a.t<4.6
          : i===first && exposed(b);
        parts.push(slot(b,live?'vent':'armor',xs[i],b.y,54,44));
      }
    }else if(b.index===10){
      if(exposed(b))parts.push(slot(b,'vent',b.x,b.y+27,42,31));
    }else{
      const x=b.x+((b.index===2||b.index===3)?(b.attack?.side||1)*35:0);
      if(exposed(b))parts.push(slot(b,'vent',x,b.y+26,29,16));
      parts.push(slot(b,'armor',b.x,b.y,69,38));
    }
    return parts;
  }
  function hit(b,id,amount,api){
    if(b.index===6){window.SpaceDreadnought.hit(b,id,amount,api);return;}
    if(b.index===5)return;
    if(b.hp<=0 || b.entryRemaining>0 || !(amount>0))return;
    const o=b.objects.find(o=>o.id===id && o.hp>0);
    if(o){
      o.hp=Math.max(0,o.hp-amount);
      if(!o.hp){
        api.burst(o.x,o.y,'#ffc678',12);
        if(o.kind.startsWith('enc-'))window.SpaceEncounterObjects?.destroy(b,o,api);
        if(o.kind==='bayMissile')b.cycle+=1;
        if(o.kind==='mine'){
          const linked=b.objects.find(other=>other.kind==='bridgeMine' && other.sourceId===o.id);
          if(linked)linked.hp=0;
        }
        if(o.kind==='leader')for(const drone of b.objects)if(drone.kind==='drone')drone.hp=0;
        if(o.kind==='emitter'&&b.attack)b.attack.cancelled=true;
      }
      return;
    }
    if(b.index===10 && b.phase<3){
      const unit=b.units.find(u=>u.id===id && u.hp>0);
      if(!unit)return;
      const removed=Math.min(unit.hp,amount);
      unit.hp-=removed;b.hp-=removed;
      if(unit.hp===0)api.burst(b.x+unit.dx,b.y+17,'#ffb25a',23);
    }else{
      if(id!=='vent' && id!=='armor')return;
      if(b.index===10 && (id!=='vent' || !exposed(b)))return;
      // Both twins share one hull pool; the extinguished hull reflects shots.
      if(id==='armor'&&b.index===5)return;
      b.hp=Math.max(0,b.hp-amount*(id==='vent'?1:.55));
      if(b.index===2 && b.hp>0 && b.attack?.railVersion===3)window.SpaceEncounterEngine.railHit(b,b.attack);
    }
    const phase=phaseOf(b);
    if(phase!==b.phase){
      b.phase=phase;
      if(b.index===10){installCitadelParts(b);b.attack=null;b.objects=[];b.cycle=.3;}
      api.burst(b.x,b.y,'#fff2b4',24);
    }
  }
  function object(b,kind,x,y,r,hp,extra={}){
    const o={id:'o'+(++b.serial),kind,x,y,r,hp,...extra};
    b.objects.push(o);return o;
  }
  function fan(api,x,y,aim,count,gap,speed,type='bolt'){
    for(let i=0;i<count;i++)api.makeHazard(x,y,aim+(i-(count-1)/2)*gap,speed,type);
  }
  function begin(b,api){
    const ps=api.pilots.filter(p=>p.hp>0);
    const previous=b.attack;
    const side=b.index===8 && b.phase===1 ? 1 : previous?-previous.side:1;
    const target=ps[(previous?.turn||0)%Math.max(ps.length,1)]||{x:640,y:630};
    const a={t:0,side,turn:(previous?.turn||0)+1,px:target.x,py:target.y,x:b.x,y:b.y+22,
      next:0,step:0,lanes:[],cancelled:false};
    a.aim=Math.atan2(a.py-a.y,a.px-a.x);
    const spec=catalog[b.index-1];
    a.hard=b.phase>=2;
    if(b.index<=5 && a.hard){
      // Count hard cycles independently of how long the introductory phase lasted.
      b.hardTurn=(b.hardTurn||0)+1;
      a.special=b.hardTurn%2===0;
    }
    if(spec.skills.length && window.SpaceEncounterEngine){
      beginEncounter(b,a,spec);
      return;
    }
    b.attack=a;b.cycle=cooldown(b,a.hard?spec.hardCooldown:spec.cooldown);b.objects=[];
    switch(b.index){
      case 2:{
        const left=a.hard?108:35, right=1280-left;
        const first=clamp(a.px,left,right);
        const step=first+side*190;
        a.lanes=[first,step<left || step>right ? first-side*190 : step];
        break;
      }
      case 4:
        for(let i=0;i<3;i++)object(b,'mine',clamp(a.px,212,1068)+(i-1)*179,315+(i%2)*53,18,3,{at:1.4+.45*(a.hard?2-i:i)});
        if(a.special){
          const middle=b.objects[1];
          object(b,'bridgeMine',middle.x+side*78,middle.y-72,18,3,{at:middle.at+.9,sourceId:middle.id});
        }
        break;
      case 7:
        a.crossGate=b.phase===2;
        for(let i=0;i<(b.phase===1?2:3);i++){
          const x=a.crossGate?clamp(a.px,390,890)+(i-1)*260:clamp(a.px+(i-1)*260,75,1205);
          if(b.objects.some(o=>Math.abs(o.x-x)<100))continue;
          object(b,'hinge',x,290+i*64,16,3,{dir:i%2?-1:1,port:i});
        }
        break;
      case 8:
        a.reverseField=b.phase===2;
        object(b,'emitter',b.x+side*105,b.y+32,19,9);break;
      case 9:
        a.pincer=b.phase===2;
        for(let i=0;i<6;i++){
          const flank=(i<3?-1:1)*side, rank=i%3;
          const startX=a.pincer?640+flank*(100+rank*20):b.x+(i-2.5)*49;
          const drone=object(b,i===0?'leader':'drone',startX,b.y+53,14,i===0?5:3,{order:i,launched:false});
          if(a.pincer){
            drone.flank=flank;drone.startX=startX;drone.wingX=640+flank*(160+rank*62);
            drone.mark=flank<0?clamp(a.px+rank*36,32,528):clamp(a.px-rank*36,752,1248);
          }
        }
        break;
      case 10:a.sweeps=true;break;
    }
  }
  function beginEncounter(b,a,spec){
    const book=spec.skills;
    const ready=b.skillReady||(b.skillReady=book.map(()=>0));
    let index=Number.isInteger(b.practiceSkill)?b.practiceSkill:-1;
    if(b.index===2 && !book[index])index=0;
    if(b.index===1 && !book[index])index=((b.attack?.skillIndex??1)+1)%2;
    if(!book[index]){
      const first=b.index===10?(b.phase-1)*2:0;
      const total=b.index===10?2:book.length;
      const next=Math.max(0,(b.attack?.skillIndex??(first-1))-first+1)%total;
      index=first+next;
      for(let n=1;n<total;n++){
        const candidate=first+(next+n)%total;
        if(ready[candidate]<ready[index])index=candidate;
      }
    }
    const skill=book[index];
    if(b.index!==1 && ready[index]>b.clock){
      b.cycle=ready[index]-b.clock;
      return;
    }
    const phaseSpeed=a.hard&&Number.isFinite(skill.hardCooldown)?skill.hardCooldown:skill.cooldown;
    if(b.index===5 && b.attack?.skillIndex===1)b.twinSide=-(b.twinSide||1);
    a.skillIndex=index;
    a.mode='encounter';
    a.span=skill.span;
    b.attack=a;
    b.cycle=b.index===10 && b.phase===3 ? Math.max(skill.span,skill.windup+5) : skill.span;
    if(b.index===1){
      // Advance a clock deadline, so quantization to a display frame never accumulates.
      b.nextBeaconAt=(b.nextBeaconAt??b.clock)+cooldown(b,skill.cooldown);
      b.cycle=b.nextBeaconAt-b.clock;
    }
    ready[index]=b.clock+Math.max(b.cycle,cooldown(b,phaseSpeed));
    // Every object belongs to this skill's complete cast and recovery window.
    b.objects=[];
    window.SpaceEncounterEngine.begin(b,a,skill);
  }
  function beamTouch(p,x,y,angle,length,width){
    const dx=p.x-x,dy=p.y-y,c=Math.cos(angle),s=Math.sin(angle);
    const along=dx*c+dy*s;
    return along>=0 && along<=length && Math.abs(dy*c-dx*s)<width+8;
  }
  // The warning path and the damaging sweep use the same endpoints.
  function citadelSweeps(phase) {
    const lanes=[
      {from:130,to:428,start:1.05,dx:-131,unit:'unit0'},
      {from:1150,to:852,start:1.05,dx:131,unit:'unit3'}
    ];
    if(phase>=2)lanes.push({from:520,to:605,start:1.65,dx:-62},{from:760,to:675,start:1.65,dx:62});
    return lanes;
  }
  function sweepActive(b,lane) {
    return b.phase!==1 || b.units.some(u=>u.id===lane.unit && u.hp>0);
  }
  function sweepX(lane,t){
    return lane.from+(lane.to-lane.from)*clamp((t-lane.start)/.35,0,1);
  }
  function gateEndX(o,a){
    return a.crossGate?clamp(o.x+196*o.dir,130,1150):o.x+196*o.dir;
  }
  function gateLink(b){
    const first=b.objects.find(o=>o.kind==='hinge'&&o.port===0&&o.hp>0);
    const last=b.objects.find(o=>o.kind==='hinge'&&o.port===2&&o.hp>0);
    return first&&last?[first,last]:null;
  }
  function update(b,dt,api){
    if(b.index===6){window.SpaceDreadnought.update(b,dt,api);return;}
    if(b.index===5){b.clock+=dt;window.SpaceBelt.update(b,dt,api);return;}
    if(!(dt>0)||b.hp<=0)return;
    if((b.index===1||b.index===2||b.index===3) && b.entryRemaining>0){
      const elapsed=Math.min(dt,b.entryRemaining);
      b.entryRemaining=Math.max(0,b.entryRemaining-elapsed);
      const progress=1-b.entryRemaining/1.6;
      b.x=640;
      b.y=-110+220*(progress*progress*(3-2*progress));
      dt-=elapsed;
      if(dt<1e-9)return;
    }
    if(b.index===3 && b.attack?.mode==='encounter' && !b.attack.houndVersion){
      b.attack=null;b.objects=[];b.cycle=0;b.skillReady=[0,0,0];
    }
    if(b.index===2 && b.attack?.mode==='encounter' && b.attack.railVersion!==3){
      // An old campaign checkpoint may still carry the retired vertical-lane cast.
      if(b.attack.railVersion===2 && Number.isInteger(b.practiceSkill))b.practiceSkill=1-b.practiceSkill;
      b.attack=null;b.cycle=0;b.skillReady=[0,0];
    }
    b.clock+=dt;b.cycle-=dt;
    b.x=640+Math.sin(b.clock*.32)*(b.index===10?48:128);
    b.y=110+Math.sin(b.clock*.56)*9;
    if(b.index===4){window.SpaceMiner.update(b,dt,api,catalog[3].skills);return;}
    if(b.index===2 && b.attack?.railVersion===3 && b.attack.skillIndex===0){
      const a=b.attack;
      const movement=clamp((a.t-(a.fireAt+a.hold))/.55,0,1);
      const coast=movement*movement*(3-2*movement);
      b.x=a.baseX+(b.x-a.baseX)*coast;
      b.y=a.baseY+(b.y-a.baseY)*coast;
    }
    if(b.index===7 && b.attack?.skillIndex===3){
      const dash=b.attack, delta=dash.t-catalog[6].skills[3].windup;
      if(delta>=0 && delta<1.7){
        const out=clamp(delta/.55,0,1), back=clamp((delta-1.05)/.65,0,1);
        const destination=clamp(dash.x+dash.side*448,100,1180);
        b.x=(dash.x+(destination-dash.x)*(out*out*(3-2*out)))*(1-back)+b.x*back;
      }
    }
    if(b.index===2)window.SpaceEncounterEngine.updateRailEscorts(b,api);
    if(b.index===1)window.SpaceEncounterEngine?.updateBeaconWaves(b,dt,api);
    if(b.cycle<=(b.index===1?1e-10:0))begin(b,api);
    const a=b.attack;
    if(!a)return;
    const prev=a.t;a.t+=dt;
    if(a.mode==='encounter'){
      const skill=catalog[b.index-1].skills[a.skillIndex];
      window.SpaceEncounterEngine.tick(b,a,skill,prev,dt,api);
      window.SpaceEncounterObjects?.update(b,dt,api);
      b.objects=b.objects.filter(o=>o.hp>0 && o.y<850);
      return;
    }
    const crossed=t=>prev<t && a.t>=t;
    const ps=api.pilots.filter(p=>p.hp>0);
    const beam=(x,y,angle,len,w)=>{
      for(const p of ps)if(beamTouch(p,x,y,angle,len,w))api.damage(p);
    };
    switch(b.index){
      case 1:
        if(crossed(.9))fan(api,a.x,a.y,a.aim+(a.hard?a.side*.12:0),7,.21,204);
        if(a.special && crossed(1.65)){
          // Reuse three exact radial paths from the first fan; its gaps stay open.
          fan(api,a.x,a.y,a.aim+a.side*(.12+.42),3,.21,204);
        }
        break;
      case 2:
        a.lanes.forEach((x,i)=>{
          const t=1.1+(a.hard?i*.48:0);
          if(a.t>=t&&a.t<t+.6)beam(x,a.y,Math.PI/2,720,12);
        });
        if(a.special){
          if(crossed(2.2))a.traceX=clamp(ps[(a.turn-1)%Math.max(1,ps.length)]?.x ?? a.px,108,1172);
          if(a.t>=3.3 && a.t<3.9 && Number.isFinite(a.traceX))beam(a.traceX,a.y,Math.PI/2,720,12);
        }
        break;
      case 3:
        for(const side of [-1,1])if(crossed(.9+(a.hard && side===1?.65:0))){
          const h=api.makeHazard(b.x+side*55,b.y+30,a.aim+side*.28,165,'missile');
          if(h)h.lock=2;
        }
        if(a.special && crossed(2.0))
          object(b,'bayMissile',b.x,b.y+38,13,1);
        for(const m of b.objects)if(m.kind==='bayMissile' && m.hp>0){
          m.y+=80*dt;
          if(m.y>=b.y+82){
            const rocket=api.makeHazard(m.x,m.y,Math.PI/2,185,'missile');
            if(rocket)rocket.lock=0;
            m.hp=0;
          }
        }
        break;
      case 4:
        for(const o of b.objects)if(o.hp>0&&crossed(o.at)){
          fan(api,o.x,o.y,Math.PI/2,7,.35,162);o.hp=0;api.burst(o.x,o.y,'#ffaa5c',12);
        }
        break;
      case 5:
        if(crossed(1.2)||crossed(4.7))for(const x of hulls(b))fan(api,x,b.y+.25*100,Math.atan2(a.py-b.y,a.px-x),3,.17,185);
        if(a.special){
          if(crossed(1.7)){
            const marked=ps[(a.turn-1)%Math.max(1,ps.length)];
            a.swapX=marked?.x ?? a.px;a.swapY=marked?.y ?? a.py;
          }
          if(crossed(2.7) && Number.isFinite(a.swapX)){
            const x=hulls(b)[a.side===1?0:1], y=b.y+25;
            fan(api,x,y,Math.atan2(a.swapY-y,a.swapX-x),3,.17,185);
          }
        }
        break;
      case 7:
        for(const o of b.objects)if(o.hp>0){
          if(a.t>=1.3){o.y+=dt*75;beam(o.x,o.y,o.dir===1?0:Math.PI,Math.abs(gateEndX(o,a)-o.x),7);}
          if(o.y>745)o.hp=0;
        }
        if(a.crossGate && a.t>=2.3 && a.t<3.3){
          const link=gateLink(b);
          if(link){
            const [u,v]=link;
            beam(u.x,u.y,Math.atan2(v.y-u.y,v.x-u.x),Math.hypot(v.x-u.x,v.y-u.y),6);
          }
        }
        break;
      case 8:
        if(!a.cancelled&&a.t>=1.2&&a.t<5.2)for(const p of ps)p.x=clamp(p.x+a.side*74*dt,28,1252);
        if(crossed(2)||crossed(3.5)||crossed(5))fan(api,b.x,b.y+24,a.aim,3,.26,182);
        if(a.reverseField && !a.cancelled){
          const push=-a.side;
          if(a.t>=6.1 && a.t<7.25)for(const p of ps)p.x=clamp(p.x+push*100*dt,28,1252);
          if(crossed(6.1)||crossed(6.65)){
            // Do not cast arcs towards a wall an affected pilot is approaching.
            const gapX=clamp(a.px+push*(a.t<6.65?75:130),28,1252);
            const gapAngle=Math.atan2(a.py-b.y-24,gapX-b.x);
            if(!ps.some(p=>push<0?p.x<225:p.x>1055)){
              for(const side of [-1,1])fan(api,b.x,b.y+24,gapAngle+side*.45,2,.12,175);
            }
          }
        }
        break;
      case 9:
        for(const o of b.objects)if(o.hp>0){
          if(a.pincer && a.t<=1+dt && o.startX!==undefined){
            o.x=o.startX+(o.wingX-o.startX)*clamp(a.t/.65,0,1);
            const marked=ps.length?ps[(a.turn-1)%ps.length]:null;
            if(marked){
              a.px=marked.x;a.py=marked.y;
              const rank=o.order%3;
              o.mark=o.flank<0?clamp(a.px+rank*36,32,528):clamp(a.px-rank*36,752,1248);
            }
          }
          if(!o.launched&&a.t>=1.2+o.order*.31){
            o.launched=true;const angle=Math.atan2(Math.max(100,a.py-o.y),(o.mark??a.px)-o.x);
            o.vx=Math.cos(angle)*330;o.vy=Math.sin(angle)*330;
          }
          if(o.launched){
            o.x+=o.vx*dt;o.y+=o.vy*dt;
            if(a.pincer && (o.flank<0?o.x>545:o.x<735)){
              o.x=o.flank<0?545:735;o.vx=0;o.vy=330;
            }
            for(const p of ps)if(Math.hypot(p.x-o.x,p.y-o.y)<25){api.damage(p);o.hp=0;break;}
          }
        }
        break;
      case 10:
        if(a.sweeps){
          for(const lane of citadelSweeps(b.phase)){
            if(sweepActive(b,lane)&&a.t>=lane.start&&a.t<lane.start+.35){
              beam(sweepX(lane,a.t),a.y,Math.PI/2,720,12);
            }
          }
        }else if(a.t>=1.2&&a.t<1.8)beam(a.px,a.y,Math.PI/2,720,18);
        if(crossed(2)||crossed(4.6)){
          const mounts=b.phase<3?b.units.filter(u=>u.hp>0).map(u=>b.x+u.dx):[b.x];
          for(const x of mounts)fan(api,x,b.y+24,a.aim,b.phase===1?1:3,.19,195);
        }
        break;
    }
    b.objects=b.objects.filter(o=>o.hp>0 && o.y<750);
  }
  function drawCell(ctx,index,x,y,w,h){
    return window.SpaceCampaignSprites?.draw(ctx,index,x,y,w,h)===true;
  }
  function line(ctx,x,y,x2,y2,color,width=2){
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();
  }
  function circle(ctx,x,y,r,color){
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();
  }
  function skillWait(b, index, skills){
    const isolated=Number.isInteger(b.practiceSkill);
    const escort=b.index===2 && index===1;
    if(isolated && index!==b.practiceSkill && !escort)return null;
    if(!isolated && b.index===10 && Math.floor(index/2)!==b.phase-1)return null;
    const entry=Math.max(0,b.entryRemaining||0);
    if(b.index===1){
      const next=isolated ? b.practiceSkill : 1-(b.attack?.skillIndex??1);
      const delay=Math.max(0,(b.nextBeaconAt??0)-b.clock);
      return entry+delay+(index===next?0:cooldown(b,skills[next].cooldown));
    }
    if(escort){
      const period=cooldown(b,skills[1].cooldown);
      return entry+period-(b.clock%period);
    }
    if(b.index===4){
      const due=b.miner?.next[index] ?? (isolated?0:index*4);
      return Math.max(0,due-b.clock);
    }
    return entry+Math.max(0,(b.skillReady?.[index]??0)-b.clock);
  }
  function drawSkillTimers(ctx,b,skills){
    const gap=2, width=Math.min(32,Math.floor((184-gap*(skills.length-1))/skills.length));
    const start=Math.round(b.x+92-(width+gap)*skills.length+gap);
    ctx.save();
    ctx.globalAlpha*=.5;ctx.font='bold 11px monospace';
    ctx.textAlign='center';ctx.textBaseline='middle';
    skills.forEach((_,i)=>{
      const wait=skillWait(b,i,skills);
      const x=start+i*(width+gap);
      ctx.fillStyle='#162431';ctx.fillRect(x,38,width,15);
      ctx.strokeStyle=wait===0?'#83e8ae':'#92a8ba';ctx.lineWidth=1;
      ctx.strokeRect(x+.5,38.5,width-1,14);
      ctx.fillStyle=wait===0?'#a6ffd0':'#edf6ff';
      ctx.fillText(wait===null?'–':Math.ceil(wait*10-1e-8)/10+'s',x+width/2,46);
    });
    ctx.restore();
  }
  function draw(ctx,b,time,seat=0){
    if(b.index===6){window.SpaceDreadnought.draw(ctx,b);return;}
    if(b.index===5){window.SpaceBelt.draw(ctx,b,time,seat);return;}
    const def=catalog[b.index-1],a=b.attack,t=a?.t||0;
    ctx.save();ctx.imageSmoothingEnabled=false;
    // Dangerous zones and their warning outlines are always rendered below the hulls.
    if(b.index===1)window.SpaceEncounterEngine?.drawBeaconWaves(ctx,b);
    if(b.index===4){window.SpaceMinerArt?.draw(ctx,b,time);}
    else if(a?.mode==='encounter'){
      const skill=def.skills[a.skillIndex];
      window.SpaceEncounterEngine.draw(ctx,b,a,skill,time);
      window.SpaceEncounterObjects?.draw(ctx,b,time);
    }else if(a){
      if(b.index===2||b.index===10){
        a.lanes.forEach((x,i)=>{
          const start=b.index===10?1.2:1.1+(a.hard?i*.48:0);
          if(t>=start+.6)return;
          const live=t>=start;
          ctx.fillStyle=live?'rgba(255,140,87,.58)':'rgba(255,160,94,.10)';
          ctx.fillRect(x-15,a.y,30,720-a.y);
          ctx.setLineDash(live?[]:[9,7]);line(ctx,x,a.y,x,720,live?'#fff5c3':def.color,live?9:2);ctx.setLineDash([]);
        });
      }
      if(b.index===10&&a.sweeps){
        for(const lane of citadelSweeps(b.phase)){
          if(!sweepActive(b,lane)||t>=lane.start+.35)continue;
          const live=t>=lane.start, x=sweepX(lane,t);
          ctx.fillStyle='rgba(251,147,88,.07)';
          ctx.fillRect(Math.min(lane.from,lane.to)-12,a.y,Math.abs(lane.to-lane.from)+24,720-a.y);
          ctx.setLineDash(live?[]:[8,7]);
          line(ctx,b.x+lane.dx,b.y+17,x,a.y+38,def.color,2);
          line(ctx,x,a.y+38,x,720,live?'#fff4cc':'#e6ac72ac',live?21:2);
          ctx.setLineDash([]);
        }
      }
      if(b.index===7&&a.crossGate&&t>=1.3&&t<3.3){
        const link=gateLink(b);
        if(link){
          const [u,v]=link,warning=t<2.3;
          ctx.setLineDash(warning?[6,7]:[]);
          line(ctx,u.x,u.y,v.x,v.y,warning?'#ffcb87':'#fff2a8',warning?2:8);
          ctx.setLineDash([]);
        }
      }

      if(b.index===8&&!a.cancelled&&(t<5.2||(a.reverseField&&t<7.25))){
        const reverse=t>=5.2, direction=reverse?-a.side:a.side, color=reverse?'#9adfff':def.color;
        ctx.globalAlpha=t<1.2||reverse&&t<6.1?.32:.65;
        for(let y=380;y<720;y+=85)for(let col=0;col<9;col++){
          const x=(col*165+(t*74*direction)%165+1280)%1280;
          line(ctx,x-7*direction,y-3,x,y,color);line(ctx,x-7*direction,y+3,x,y,color);
        }
        ctx.globalAlpha=1;
      }
      if(b.index===1 && a.special && t<1.65){
        const bright=t<.25 || (t>.45 && t<.72) || t>1.3;
        for(let i=1;i<=3;i++){
          const angle=a.aim+a.side*(.12+i*.21), c=Math.cos(angle),s=Math.sin(angle);
          line(ctx,a.x+c*70,a.y+s*70,a.x+c*155,a.y+s*155,bright?'#fff2b0':'#bb822366',bright?3:1);
        }
      }
      if(b.index===2 && a.special && Number.isFinite(a.traceX) && t>=2.2 && t<3.9){
        const live=t>=3.3;
        ctx.fillStyle=live?'#ff915799':'#ffa85a22';
        ctx.fillRect(a.traceX-14,a.y,28,720-a.y);ctx.setLineDash(live?[]:[4,9]);
        line(ctx,a.traceX,a.y,a.traceX,720,live?'#fff8c5':'#ffa868',live?8:2);ctx.setLineDash([]);
      }
      if(b.index===5 && a.special && t>=1.7 && t<2.7 && Number.isFinite(a.swapX)){
        const x=hulls(b)[a.side===1?0:1];
        ctx.setLineDash([7,8]);
        line(ctx,x,b.y+25,a.swapX,a.swapY,'#aceaffaa',2);ctx.setLineDash([]);
        circle(ctx,a.swapX,a.swapY,15,'#9dddf2');
      }
      if(b.index===1&&t<.9){
        const aim=a.aim+(a.hard?a.side*.12:0);
        for(let i=-3;i<=3;i++){
          const angle=aim+i*.21,c=Math.cos(angle),s=Math.sin(angle);
          line(ctx,a.x+c*55,a.y+s*55,a.x+c*108,a.y+s*108,'#ffdb7f99',2);
        }
      }
      if(b.index===3){
        for(const side of [-1,1]){
          const release=.9+(a.hard && side===1?.65:0);
          if(t>=release)continue;
          const x=b.x+side*55,y=b.y+30,angle=a.aim+side*.28;
          ctx.setLineDash([5,6]);
          line(ctx,x,y,x+Math.cos(angle)*104,y+Math.sin(angle)*104,'#eeafffa8',2);
          ctx.setLineDash([]);
        }
      }
      if((b.index===1&&t<.9)||(b.index===3&&t<.9)){
        circle(ctx,a.x,a.y,10+5*Math.sin(t*9),def.color);
        line(ctx,a.x,a.y,a.x+Math.cos(a.aim)*64,a.y+Math.sin(a.aim)*64,def.color);
      }
    }
    const size=b.index===10?300:b.index===5?129:172;
    for(const [i,x] of hulls(b).entries()){
      const bespoke=window.SpaceBossFX?.drawHull(ctx,b,i,x,b.y,size,time);
      const painted=bespoke || (b.index===5
        ? window.SpaceCampaignSprites?.drawTwin?.(ctx,i,x,b.y,size)
        : drawCell(ctx,b.index-1,x,b.y,size,size));
      if(!painted){
        if(b.index===10)window.CapitalArt?.drawHull(ctx,x,b.y,355,125);
        else window.SpaceArt?.draw(ctx,def.sprite,x,b.y,size,size,Math.floor(time*12));
      }
    }
    if(b.index===2)window.SpaceEncounterEngine.drawRailGuns(ctx,b,a,time);
    if(b.index===3 && a?.houndVersion)window.SpaceEncounterEngine.drawHoundBays(ctx,b,a,def.skills[a.skillIndex]);
    if(b.index===3 && !a?.houndVersion && a?.special && t>=1 && t<2){
      const r=9+5*Math.sin(Math.PI*(t-1)*4)**2;
      circle(ctx,b.x,b.y+35,r,'#ffaa54');
      ctx.fillStyle='#fff0af';ctx.fillRect(b.x-3,b.y+32,6,6);
    }

    if(b.index===10&&b.phase<3)for(const u of b.units){
      const x=b.x+u.dx,y=b.y+17;
      if(b.phase===1)window.CapitalArt?.drawTurret(ctx,x,y,48,0,u.hp<=0);
      if(u.hp>0)circle(ctx,x,y,18,def.color);
    }
    for(const target of targets(b))if(target.id==='vent'){
      const radius=14+2*Math.sin(time*8);
      circle(ctx,target.x,target.y,radius,def.color);circle(ctx,target.x,target.y,5,'#fff3c4');
    }
    for(const o of b.objects){
      if(o.kind.startsWith('enc-'))continue;
      switch(o.kind){
        case 'hinge':
          ctx.setLineDash(t<1.3?[6,6]:[]);line(ctx,o.x,o.y,gateEndX(o,a),o.y,t<1.3?'#8af6d477':def.color,t<1.3?2:8);ctx.setLineDash([]);
          break;
        case 'bayMissile':
          ctx.fillStyle='#ffa652';ctx.fillRect(o.x-5,o.y-11,10,19);
          ctx.fillStyle='#fff5cd';ctx.fillRect(o.x-2,o.y+5,4,8);
          continue;
        case 'bridgeMine':{
          const source=b.objects.find(other=>other.id===o.sourceId);
          if(source)line(ctx,source.x,source.y,o.x,o.y,'#fff2c788',1);
          circle(ctx,o.x,o.y,o.r+6+Math.sin(t*8)*2,'#fff4cd');
          break;
        }
        case 'mine':
          // The shrinking fuse and its ordinal remain distinguishable with audio off.
          circle(ctx,o.x,o.y,o.r+3+Math.max(0,o.at-t)*8,'#ffb767');
          ctx.fillStyle='#fff0cb';ctx.font='bold 14px monospace';ctx.textAlign='center';
          ctx.fillText(String(1+Math.round((o.at-1.4)/.45)),o.x,o.y-o.r-7);
          break;
        case 'leader':case 'drone':
          if(!o.launched && t<1.2){ctx.setLineDash([6,11]);line(ctx,o.x,o.y,o.mark??a.px,a.py,a.pincer?'#f7c98599':'#eeac7150',1);ctx.setLineDash([]);}
          window.SpaceArt?.draw(ctx,'diver',o.x,o.y,32,31,time*8);
          if(o.kind==='leader'){
            circle(ctx,o.x,o.y,22,'#fff6ad');
            line(ctx,o.x-7,o.y-31,o.x,o.y-23,'#fff6ad',3);
            line(ctx,o.x,o.y-23,o.x+7,o.y-31,'#fff6ad',3);
          }
          continue;
      }
      ctx.fillStyle='#27364c';ctx.fillRect(o.x-o.r/2,o.y-o.r/2,o.r,o.r);
      circle(ctx,o.x,o.y,o.r,def.color);ctx.fillStyle=def.color;ctx.fillRect(o.x-3,o.y-3,6,6);
    }
    ctx.textAlign='center';ctx.font='bold 14px monospace';ctx.fillStyle='#f5e8cc';
    ctx.fillText(def.name.toUpperCase()+'  ·  '+b.phase+'/'+def.phases,b.x,23);
    ctx.fillStyle='#322d39';ctx.fillRect(b.x-92,30,184,5);ctx.fillStyle=def.color;
    ctx.fillRect(b.x-92,30,184*clamp(b.hp/b.max,0,1),5);
    if(b.hp>0 && def.skills.length)drawSkillTimers(ctx,b,def.skills);
    ctx.restore();
  }
  window.SpaceBosses=Object.freeze({catalog:Object.freeze(catalog),create,update,hit,targets,hulls,draw,drawCell,cooldown});
})();
