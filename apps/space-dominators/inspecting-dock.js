/* Inspecting Dock. The simulation stores the burst position and target seat in room snapshots. */
(() => {
  'use strict';
  // Positions in the 448 x 184 station sprite, measured from its center.
  const mounts=[[-90,32],[0,50],[90,32]];
  const salvoPeriod=5.5, pairInterval=.14, gunInterval=1/7;
  // Fresh encounters and older checkpoints must scale rounded mount HP exactly once.
  function reinforceHull(c){
    if(c.hullVersion===2)return c;
    for(const mount of c.turrets){
      mount.maxHp*=3;
      mount.hp*=3;
    }
    c.hullVersion=2;
    return c;
  }
  function create(x,y,baseHP,previous){
    const turrets=mounts.map(([offset,dy],i)=>{
      const center=i===1, maxHp=Math.ceil(baseHP*(center?1.5:1.25));
      const old=previous?.[i], fraction=old?Math.max(0,Math.min(1,old.hp/old.maxHp)):1;
      return {x:x+offset,y:y+dy,offset,dy,hp:Math.ceil(maxHp*fraction),maxHp,
        launcher:!center,aim:Math.PI/2,warning:0,flash:0};
    });
    return reinforceHull({x,y,turrets,time:0,gunAt:.85,gunShot:0,gunSeat:0,rackAt:1.6,rackRound:0,rackSeat:0});
  }
  function position(c,y){
    c.y=y;
    for(const t of c.turrets){t.x=c.x+t.offset;t.y=y+t.dy;}
  }
  function liveSeat(crew,preferred){
    const pilot=crew[preferred];
    if(pilot?.hp>0 && !pilot.respawn)return preferred;
    return crew.findIndex(p=>p.hp>0 && !p.respawn);
  }
  function update(c,dt,crew,spawn){
    c.time+=dt;
    for(const t of c.turrets)t.flash=Math.max(0,t.flash-dt);
    const seat=liveSeat(crew,c.gunSeat);
    if(seat<0){
      // Do not accumulate a backlog of attacks while all pilots respawn.
      c.gunAt+=dt;c.rackAt+=dt;return;
    }
    const gun=c.turrets[1], pilot=crew[seat];
    if(gun.hp>0){
      gun.aim=Math.atan2(pilot.y-gun.y,pilot.x-gun.x);
      gun.warning=!c.gunShot && c.gunAt-c.time<.55 ? Math.max(0,c.gunAt-c.time) : 0;
      while(c.time+1e-8>=c.gunAt){
        spawn(gun.x+18*Math.cos(gun.aim),gun.y+18*Math.sin(gun.aim),gun.aim,280,'bolt');
        gun.flash=.07;
        if(++c.gunShot===8){
          c.gunShot=0;c.gunAt+=2;c.gunSeat=(seat+1)%crew.length;break;
        }
        c.gunAt+=gunInterval;
      }
    }
    const pairs=crew.length===2?6:3;
    for(const t of [c.turrets[0],c.turrets[2]]){
      t.warning=t.hp>0 && c.rackAt-c.time<.55?Math.max(0,c.rackAt-c.time):0;
    }
    while(c.time+1e-8>=c.rackAt){
      for(const side of [-1,1]){
        const rack=c.turrets[side+1];
        if(rack.hp<=0)continue;
        const angle=Math.PI/2-side*(1.32-c.rackRound*.1);
        const seat=liveSeat(crew,(c.rackSeat+Number(side>0))%crew.length);
        const missile=spawn(rack.x+side*((c.rackRound%3)-1)*11,rack.y,angle,225,'missile');
        Object.assign(missile,{houndKind:'arc',houndSide:side,houndAge:0,houndArcTime:.48,
          houndHomingTime:1,targetSeat:seat,bossIndex:3,skillIndex:1});
        rack.flash=.1;
      }
      if(++c.rackRound===pairs){
        c.rackRound=0;c.rackAt+=salvoPeriod-(pairs-1)*pairInterval;
        c.rackSeat=(c.rackSeat+1)%crew.length;
      }else c.rackAt+=pairInterval;
    }
  }
  window.SpaceInspectingDock=Object.freeze({create,position,update,reinforceHull});
})();
