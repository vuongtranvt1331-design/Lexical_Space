/* Boss 6 fighter groups: one replayable formation, a shared curved entry and its exact reverse exit. */
(() => {
  'use strict';
  const C=window.SpaceDreadnoughtConfig;
  const random=()=>window.SpaceFlightRandom(),between=(a,b)=>a+(b-a)*random();
  const clamp=x=>Math.max(0,Math.min(1,x));
  const names=['grid','blocks','vee','diamonds'];
  function layout(name){
    const points=[];
    if(name==='grid'){
      for(let row=0;row<3;row++)for(let col=0;col<10;col++)points.push({x:163+col*106,y:78+row*82});
    }else if(name==='blocks'){
      for(const center of [260,640,1020]){
        const dx=between(-8,8),dy=between(-6,6);
        for(let row=0;row<3;row++)for(let col=0;col<3;col++)points.push({x:center+dx+(col-1)*78,y:82+dy+row*78});
      }
    }else{
      const centers=[[250,170],[640,170],[1030,170],[445,350],[835,350]];
      const offsets=name==='vee'?[-140,-70,0,70,140].map(x=>[x,-Math.abs(x)*Math.tan(Math.PI/6)]):[[0,-76],[-76,0],[0,0],[76,0],[0,76]];
      for(const [cx,cy] of centers){
        const dx=between(-8,8),dy=between(-6,6);
        for(const [x,y] of offsets)points.push({x:cx+dx+x,y:cy+dy+y});
      }
    }
    return points;
  }
  function pick(s){
    if(!s.formationSequence)return 'grid';
    if(!s.formationBag?.length){
      s.formationBag=s.formationSequence===1?names.filter(n=>n!=='grid'):[...names];
      for(let i=s.formationBag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[s.formationBag[i],s.formationBag[j]]=[s.formationBag[j],s.formationBag[i]];}
      if(s.formationBag.at(-1)===s.lastFormation)[s.formationBag[0],s.formationBag[s.formationBag.length-1]]=[s.formationBag.at(-1),s.formationBag[0]];
    }
    return s.formationBag.pop();
  }
  function plan(s){
    const name=pick(s),route=C.waveRoutes[(s.waveIndex??0)%C.waveRoutes.length];s.waveIndex=(s.waveIndex??0)+1;
    return {layout:name,route,sign:random()<.5?-1:1,positions:layout(name)};
  }
  function offset(route,sign,t){
    const progress=clamp(t),v=progress*progress*(3-2*progress),u=1-v;
    let start,control1,control2;
    if(route==='horizontal'){start=[-sign*1500,-30];control1=[-sign*950,140];control2=[-sign*300,-80];}
    else if(route==='diagonal'){start=[-sign*1450,-850];control1=[-sign*950,-450];control2=[-sign*300,-120];}
    else{const side=route==='left'?-1:1;start=[side*420,-950];control1=[side*270,-620];control2=[side*100,-190];}
    return {x:u*u*u*start[0]+3*u*u*v*control1[0]+3*u*v*v*control2[0],y:u*u*u*start[1]+3*u*u*v*control1[1]+3*u*v*v*control2[1]};
  }
  function start(s,p,api){
    const id='formation-'+(++s.serial),at=offset(p.route,p.sign,0);
    s.formation={id,layout:p.layout,route:p.route,sign:p.sign,phase:'entering',age:0,kills:0};
    s.formationSequence=(s.formationSequence??0)+1;s.lastFormation=p.layout;s.pending=null;
    for(const [order,point] of p.positions.entries())s.fighters.push({id:'fighter-'+(++s.serial),kind:'formation',formationId:id,
      x:point.x+at.x,y:point.y+at.y,tx:point.x,ty:point.y,hp:C.fighterHP,age:0,angle:Math.PI/2,
      loadout:['missile','laser'][(order+s.formationSequence)%8] || 'cannon',
      next:s.time+2.5+between(0,2),order});
    api.sound?.('fighterWave');
  }
  function retire(s,refresh=false){
    const f=s.formation;if(!f || f.phase==='exiting'&&!refresh)return;
    f.exitFrom=f.phase==='entering'?clamp(f.age/C.formationEntrySeconds):f.phase==='exiting'?f.exitFrom*(1-clamp(f.age/C.formationExitSeconds)):1;
    f.exitOffset=offset(f.route,f.sign,f.exitFrom);f.phase='exiting';f.age=0;
    for(const ship of s.fighters)if(ship.formationId===f.id){ship.laser=null;ship.exitX=ship.x;ship.exitY=ship.y;}
  }
  function onKill(s,ship){
    const f=s.formation;if(!f || ship.formationId!==f.id)return;
    f.kills++;if(f.kills>=C.formationKillLimit)retire(s);
  }
  function adoptLegacy(s){
    const id='formation-'+(++s.serial);
    s.formation={id,layout:'legacy',route:'left',sign:1,phase:'holding',age:0,kills:0};
    s.formationSequence=Math.max(1,s.formationSequence??0);
    for(const f of s.fighters){f.formationId=id;f.kind='formation';f.tx=f.x;f.ty=f.y;}
    retire(s);
  }
  function update(s,dt,api){
    s.fighters=s.fighters.filter(f=>f.hp>0 && !f.retired);
    if(s.pending && !Array.isArray(s.pending.positions))s.pending=null;
    if(!s.formation && s.fighters.length)adoptLegacy(s);
    const f=s.formation;
    if(f){
      const members=s.fighters.filter(ship=>ship.formationId===f.id);
      if(!members.length){s.formation=null;s.nextGrid=s.time+C.formationGap;return;}
      f.age+=dt;
      if(f.phase==='entering'){
        const d=offset(f.route,f.sign,f.age/C.formationEntrySeconds);
        for(const ship of members){ship.x=ship.tx+d.x;ship.y=ship.ty+d.y;}
        if(f.age>=C.formationEntrySeconds){f.phase='holding';f.age=0;}
      }else if(f.phase==='holding'){
        const settle=clamp(f.age/.35),ease=settle*settle*(3-2*settle);
        const dx=Math.sin(s.time*.9)*8*ease,dy=Math.sin(s.time*.7)*3*ease;
        for(const ship of members)if(!ship.laser){ship.x=ship.tx+dx;ship.y=ship.ty+dy;}
        if(f.age>=C.formationDuration || f.kills>=C.formationKillLimit)retire(s);
      }else{
        const p=clamp(f.age/C.formationExitSeconds),d=offset(f.route,f.sign,f.exitFrom*(1-p));
        for(const ship of members){ship.x=ship.exitX+d.x-f.exitOffset.x;ship.y=ship.exitY+d.y-f.exitOffset.y;}
        if(p>=1){for(const ship of members)ship.retired=true;s.fighters=s.fighters.filter(ship=>!ship.retired);s.formation=null;s.nextGrid=s.time+C.formationGap;}
      }
      return;
    }
    if(s.pending){if(s.time>=s.pending.at)start(s,s.pending,api);return;}
    if(s.time<(s.nextGrid??0))return;
    const next=plan(s);
    if(!s.formationSequence)start(s,next,api);
    else{s.pending={...next,at:s.time+C.warningSeconds};api.sound?.('waveWarning');}
  }
  window.SpaceDreadnoughtFormations=Object.freeze({update,onKill,retire,layout});
})();
