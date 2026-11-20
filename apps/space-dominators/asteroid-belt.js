(() => {
  'use strict';

  const CENTER = {x:640,y:360};
  const random = (lo,hi) => lo + (window.SpaceFlightRandom?.() ?? Math.random())*(hi-lo);
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  const normalize = text => typeof text==='string' ?
    text.normalize('NFKC').trim().toLowerCase().replace(/[‘’]/g,"'").replace(/\s+/g,' ') : '';

  function pickWord(b,api){
    const state=b.belt;
    const live=new Set(state.rocks.map(r=>normalize(r.word)));
    const difficulty=b.practiceSkill;
    let fallback=[];
    for(let i=0;i<10;i++){
      const pool=api.wordPool?.length ? api.wordPool : window.SpaceWords.next().words;
      const options=pool.filter(word=>typeof word==='string' && normalize(word) && word.length<=32 &&
        !live.has(normalize(word)) && !state.recent.includes(normalize(word)));
      if(options.length)fallback=options;
      const choices=options.filter(word=>difficulty===0 ? word.length<=5 :
        difficulty===2 ? (word.includes(' ') || word.length>=8) : true);
      if(choices.length)return choices[Math.floor(Math.random()*choices.length)];
    }
    if(fallback.length)return fallback[Math.floor(Math.random()*fallback.length)];
    const options=(api.wordPool?.length ? api.wordPool : window.SpaceWords.next().words)
      .filter(word=>typeof word==='string' && normalize(word) && word.length<=32 && (state.coop || !live.has(normalize(word))));
    return options.length ? options[Math.floor(Math.random()*options.length)] : null;
  }

  function addRock(b,api,p,side){
    const s=b.belt, word=api.chooseWord ? api.chooseWord(()=>pickWord(b,api)) : pickWord(b,api);
    if(!word)return;
    // WPM uses five characters per word; reading and finding Enter have their own allowance.
    const duration=(3 + Array.from(normalize(word)).length*12/s.wpm)*Math.pow(.97,s.cleared);
    const id=++s.serial;
    side??=(id+s.offset)%4;
    const x=side===0?115:side===2?1165:random(165,1115);
    const y=side===1?72:side===3?614:random(98,605);
    const dx=p.x-x, dy=p.y-y, dist=Math.hypot(dx,dy);
    const hitDistance=42;
    s.rocks.push({id,word,startX:x,startY:y,x,y,targetX:p.x-dx/dist*hitDistance,
      targetY:p.y-dy/dist*hitDistance,seat:api.pilotSeat?.(p)??api.pilots.indexOf(p),
      side,age:0,duration,variant:id%3,spin:random(-.65,.65),size:random(76,92)});
    s.recent.push(normalize(word));
    if(s.recent.length>12)s.recent.shift();
  }

  function update(b,dt,api){
    if(!(dt>0) || b.hp<=0)return;
    if(!b.belt){
      const coop=api.pilots.length>1;
      const goal=coop?64:24;
      const progress=clamp(b.hp/b.max,0,1);
      b.max=goal;b.mid=Math.floor(goal/2);b.hp=Math.max(1,Math.ceil(goal*progress));
      b.x=CENTER.x;b.y=CENTER.y;
      b.belt={time:0,serial:0,offset:Math.floor(random(0,4)),rocks:[],recent:[],coop,
        origins:api.pilots.map(p=>({x:p.x,y:p.y})),done:[false,false],cleared:0,wpm:b.phase===2?18:15,nextAt:1.1,nextSeat:0,errorUntil:[0,0]};
      for(const p of api.pilots){
        const seat=api.pilotSeat?.(p)??api.pilots.indexOf(p);
        if(!coop){p.x=CENTER.x;p.y=CENTER.y;}
        api.miniBlast?.(p.x,p.y+15,92);
        api.burst?.(p.x,p.y+15,'#ffad61',16);
      }
      api.sound?.('impact');
    }
    const s=b.belt;
    if(s.cleared===undefined){
      s.cleared=b.max-b.hp;
      b.max*=2;b.mid=b.max/2;b.hp=b.max-s.cleared;
    }
    if(s.coop && b.max!==64){
      const progress=b.max-b.hp;b.max=64;b.mid=32;b.hp=64-progress;
    }
    if(s.rocks.length>1)s.rocks.length=1; // Migrate old simultaneous-target checkpoints.
    s.time+=dt;
    // Keep target positions fixed even if controls or a restored checkpoint supply an old aim.
    for(const p of api.pilots){
      const seat=api.pilotSeat?.(p)??api.pilots.indexOf(p);
      const centerX=CENTER.x+(s.coop?(seat?34:-34):0);
      const from=s.origins?.[seat],u=Math.min(1,s.time/.85),ease=u*u*(3-2*u);
      if(s.coop && from && u<1){
        p.x=from.x+(centerX-from.x)*ease;p.y=from.y+(CENTER.y-from.y)*ease+22*Math.sin(u*Math.PI);
      }else{p.x=centerX;p.y=CENTER.y;}
    }
    for(let i=s.rocks.length-1;i>=0;i--){
      const r=s.rocks[i];
      r.age+=dt;
      const t=Math.min(1,r.age/r.duration);
      r.x=r.startX+(r.targetX-r.startX)*t;r.y=r.startY+(r.targetY-r.startY)*t;
      if(r.interceptor){
        const shot=r.interceptor;
        shot.elapsed+=dt;
        const u=clamp(shot.elapsed/shot.duration,0,1);
        shot.x=shot.fromX+(r.x-shot.fromX)*u;
        shot.y=shot.fromY+(r.y-shot.fromY)*u;
        if(u<1)continue;
        s.rocks.splice(i,1);
        api.miniBlast?.(r.x,r.y,92);api.burst?.(r.x,r.y,'#e9b875',16);api.sound?.('explosion');
        b.hp=Math.max(0,b.hp-1);b.phase=b.hp>b.mid?1:2;
        s.cleared++;s.nextSeat=1-r.seat;s.nextAt=s.time+.65;
        continue;
      }
      if(t<1)continue;
      s.rocks.splice(i,1);
      api.miniBlast?.(r.x,r.y,68);
      const pilot=api.pilots.find((p,i)=>(api.pilotSeat?.(p)??i)===r.seat && p.hp>0);
      if(pilot)(api.asteroidImpact||api.damage)(pilot);
      s.nextAt=Math.max(s.nextAt,s.time+.65);
    }
    const alive=api.pilots.filter(p=>p.hp>0);
    if(!b.hp || !alive.length || s.rocks.length || s.time<s.nextAt)return;
    const pilot=alive.find(p=>api.pilotSeat?.(p)===s.nextSeat) || alive[0];
    addRock(b,api,pilot,Math.floor(random(0,4)));
    s.nextAt=s.time+1.05;
  }

  function targetId(b,text){
    const answer=normalize(text);
    return b?.belt?.rocks.find(r=>normalize(r.word)===answer)?.id ?? null;
  }

  function submit(b,p,text,api,expectedId){
    const s=b?.belt;
    if(!s || !p || p.hp<=0 || b.hp<=0 || !s.rocks.length || typeof text!=='string' || text.length>80)return 'ignored';
    if(expectedId!=null && !s.rocks.some(r=>r.id===expectedId))return 'ignored';
    const seat=api.pilotSeat?.(p)??api.pilots.indexOf(p);
    const owned=s.rocks.filter(r=>!s.coop || r.seat===seat);
    if(expectedId!=null && !owned.some(r=>r.id===expectedId))return 'ignored';
    const id=owned.find(r=>normalize(r.word)===normalize(text) && (expectedId==null || r.id===expectedId))?.id;
    if(id==null || (expectedId!=null && expectedId!==id)){
      const seat=api.pilotSeat?.(p)??api.pilots.indexOf(p);
      s.errorUntil[seat]=s.time+.3;api.sound?.('wrong');
      return 'wrong';
    }
    const rock=s.rocks.find(r=>r.id===id);
    if(rock.interceptor)return 'ignored';
    const fromX=p.x,fromY=p.y-27;
    rock.interceptor={fromX,fromY,x:fromX,y:fromY,elapsed:0,
      duration:clamp(Math.hypot(rock.x-fromX,rock.y-fromY)/780,.19,.75)};
    api.sound?.('missile');
    return 'correct';
  }

  // The draft belongs to the local keyboard. Co-op transmits only a completed word.
  let draft=null;
  function resetDraft(){draft=null;}
  function typeKey(b,key,seat,complete,wrong){
    const s=b?.belt;
    if(!s?.rocks.length || s.rocks[0].interceptor){resetDraft();return;}
    if(draft && !s.rocks.some(r=>r.id===draft.id))resetDraft();
    if(draft?.failedAt!=null){
      if(s.time-draft.failedAt<.48)return;
      resetDraft();
    }
    if(key==='Backspace'){
      if(draft && !draft.pending){draft.prefix=draft.prefix.slice(0,-1);if(!draft.prefix)resetDraft();}
      return;
    }
    if(key.length!==1 || draft?.pending)return;
    const ch=key.normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'");
    const prefix=(draft?.prefix||'')+ch;
    const rocks=s.rocks.filter(r=>!s.coop || r.seat===seat);
    if(!rocks.length){resetDraft();return;}
    const matching=rocks.filter(r=>normalize(r.word).startsWith(prefix));
    const chosen=matching.find(r=>r.id===draft?.id)||matching[0]||rocks.find(r=>r.id===draft?.id)||rocks[0];
    if(!matching.length){
      draft={id:chosen.id,prefix:draft?.prefix||'',wrong:ch,failedAt:s.time};
      wrong();return;
    }
    draft={id:chosen.id,prefix};
    if(prefix===normalize(chosen.word)){draft.pending=true;complete(chosen);}
  }

  const sheet=new Image();sheet.src='./assets/asteroid-belt.png';
  function stone(ctx,x,y,size,angle,index){
    ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(angle);
    if(sheet.naturalWidth){
      ctx.drawImage(sheet,(index%3)*96,Math.floor(index/3)*96,96,96,-size/2,-size/2,size,size);
    }else window.SpaceBackdrop?.drawMeteor?.(ctx,0,0,size,0,index%3);
    ctx.restore();
  }
  function draw(ctx,b,time,seat=0){
    const s=b.belt;if(!s)return;
    if(draft?.failedAt!=null && s.time-draft.failedAt>=.48)resetDraft();
    ctx.save();ctx.imageSmoothingEnabled=false;
    ctx.textAlign='center';ctx.font='bold 16px system-ui';
    ctx.fillStyle='#c5d4e2';ctx.fillText('ENGINE OFFLINE  ·  TYPE TO CLEAR    '+(b.max-b.hp)+' / '+b.max,640,38);
    for(const r of s.rocks){
      const orbit=r.age*.95+r.id*2;
      function satellites(front){
        for(let i=0;i<3;i++){
          const a=orbit+i*Math.PI*2/3,depth=Math.sin(a);
          if((depth>=0)!==front)continue;
          stone(ctx,r.x+Math.cos(a)*r.size*.65,r.y+depth*r.size*.32,r.size*(.15+.045*i),a*.7,3+(r.id+i)%3);
        }
      }
      satellites(false);stone(ctx,r.x,r.y,r.size,r.age*r.spin,r.variant);satellites(true);
      if(r.interceptor){
        const m=r.interceptor,vx=r.x-m.fromX,vy=r.y-m.fromY;
        if(!window.SpaceBossFX?.drawProjectile(ctx,{type:'missile',x:m.x,y:m.y,vx,vy},time)){
          ctx.save();ctx.translate(m.x,m.y);ctx.rotate(Math.atan2(vy,vx));
          ctx.fillStyle='#ffb94e';ctx.fillRect(-12,-2,10,4);
          ctx.fillStyle='#e0f8ff';ctx.fillRect(-3,-3,12,6);ctx.restore();
        }
        continue;
      }
      ctx.font='bold 23px system-ui';ctx.textAlign='left';ctx.textBaseline='middle';
      const word=normalize(r.word),w=ctx.measureText(word).width;
      const x=clamp(r.x-w/2,12,1280-w-12),y=r.y;
      ctx.fillStyle='rgba(8,15,28,.92)';ctx.fillRect(x-7,y-16,w+14,32);
      if(s.coop){
        ctx.font='bold 13px system-ui';ctx.textAlign='center';
        ctx.fillStyle=r.seat===seat?'#a4ffd3':'#aebcce';
        ctx.fillText(r.seat===seat?'YOUR WORD':'WINGMATE',r.x,y+25);
        ctx.font='bold 23px system-ui';ctx.textAlign='left';
      }
      const active=draft?.id===r.id?draft:null;
      const blink=active?.failedAt!=null && Math.floor((s.time-active.failedAt)/.12)%2===0;
      ctx.fillStyle=blink?'#ff5869':'#f3f7ff';ctx.fillText(word,x,y);
      if(blink){
        const cursor=x+ctx.measureText(active.prefix).width;
        ctx.fillStyle='#25121c';ctx.fillRect(cursor-3,y-42,25,23);
        ctx.fillStyle='#ff5869';ctx.fillText(active.wrong===' '?'␣':active.wrong,cursor,y-30);
      }
      if(active?.prefix && active.failedAt==null){
        ctx.fillStyle='#59ef99';ctx.fillText(word.slice(0,active.prefix.length),x,y);
      }
    }
    ctx.restore();
  }
  window.SpaceBelt=Object.freeze({update,draw,submit,targetId,typeKey,resetDraft});
})();
