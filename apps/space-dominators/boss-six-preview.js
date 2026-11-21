/* Boss 6 scale study, fleet assembly, and transition to a looping ship-deck route. */
(() => {
  'use strict';
  const REVEAL_SECONDS=12, HOLD_SECONDS=3;
  const SWARM_START=REVEAL_SECONDS+1, RELEASE_SECONDS=4, FLIGHT_SECONDS=3.5;
  const APPROACH_START=SWARM_START+RELEASE_SECONDS+FLIGHT_SECONDS+HOLD_SECONDS;
  const APPROACH_SECONDS=5, DECK_HOLD_SECONDS=12;
  const DURATION=APPROACH_START+APPROACH_SECONDS+DECK_HOLD_SECONDS;
  const colors=['#82edf1','#ff9f84','#ffdc82','#b5a8ff'];
  const carriers=window.SpaceFleetArrival.carriers;
  // Generate once. Rendering depends only on elapsed time and uses no combat state.
  const fighters=Array.from({length:400},(_,i)=>{
    const carrier=i%3, rank=Math.floor(i/3), lane=(rank%11-5)/5;
    const group=Math.floor(i/80),row=Math.floor(i%80/16),slot=i%16;
    const centers=[[582,190],[698,190],[600,290],[680,290],[640,390]];
    const arm=(slot<8?-1:1)*(1+(slot%8))*3.5;
    return {carrier,lane,color:colors[i%colors.length],
      launch:SWARM_START+i/399*RELEASE_SECONDS,
      duration:2.8+(i%8)*.1,
      targetX:centers[group][0]+arm,
      targetY:centers[group][1]+row*6-Math.abs(arm)*Math.tan(Math.PI/6)};
  });
  const hull=new Image();
  const hullReady=new Promise(resolve=>{
    hull.onload=()=>resolve(true);
    hull.onerror=()=>resolve(false);
  });
  hull.src=new URL('./assets/star-destroyer.png',document.currentScript.src).href;
  // First downloaded web-generated panel remains usable while the full pack is imported.
  const deck=new Image();
  const deckReady=new Promise(resolve=>{
    deck.onload=()=>resolve(true);
    deck.onerror=()=>resolve(false);
  });
  deck.src=new URL('./assets/boss-six-deck/preview.png',document.currentScript.src).href;
  const deckImages=[{image:deck}];
  const ready=Promise.all([hullReady,deckReady]).then(results=>results.every(Boolean));
  const smooth=t=>{const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u);};
  function pose(seconds){
    const reveal=smooth(seconds/REVEAL_SECONDS);
    // Exponential scaling gives a steady pullback over several orders of magnitude.
    const height=5200*Math.pow(580/5200,reveal);
    const nose=100+520*reveal;
    return {height,width:height*278/414,x:640,y:nose-height/2,
      playerSize:84*Math.pow((8/3)/84,reveal),playerY:605+55*reveal};
  }
  function draw(ctx,seconds,ship,wingShip){
    window.SpaceSound?.introFrame?.(seconds,SWARM_START,APPROACH_START+APPROACH_SECONDS,SWARM_START+RELEASE_SECONDS+FLIGHT_SECONDS);
    const p=pose(seconds);
    const approach=smooth((seconds-APPROACH_START)/APPROACH_SECONDS);
    const blend=smooth((approach-.2)/.8);
    if(blend<1){
      window.SpaceBackdrop.draw(ctx,seconds);
      ctx.save();
      const zoom=1+approach*7;
      ctx.translate(640,580);ctx.scale(zoom,zoom);ctx.translate(-640,-620);
      const pullback=p.height/580;
      for(const carrier of carriers){
        drawHull(ctx,640+carrier.offset*pullback,carrier.y+(p.y-330),carrier.height*pullback);
      }
      drawSwarm(ctx,seconds);
      ctx.restore();
    }
    if(blend>0){
      ctx.save();ctx.globalAlpha=blend;
      drawDeck(ctx,Math.max(0,seconds-APPROACH_START));
      ctx.restore();
    }
    const size=p.playerSize+(84-p.playerSize)*approach;
    const y=p.playerY+(570-p.playerY)*approach;
    window.SpaceArt.draw(ctx,ship,wingShip?600+(537.6-600)*approach:640,y,size,size*80/84,Math.floor(seconds*8));
    if(wingShip)window.SpaceArt.draw(ctx,wingShip,680+(742.4-680)*approach,y,size,size*80/84,Math.floor(seconds*8));
  }
  function drawDeck(ctx,seconds){
    // Freeze the deck during approach, then continue from the identical combat scroll origin.
    window.SpaceDreadnought.background(ctx,{clock:window.SpaceDreadnoughtConfig.introSeconds+Math.max(0,seconds-APPROACH_SECONDS)});
  }

  function curve(a,b,c,d,t){
    const u=1-t;
    return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d;
  }
  function drawSwarm(ctx,seconds){
    if(seconds<SWARM_START)return;
    ctx.save();
    for(const fighter of fighters){
      const t=(seconds-fighter.launch)/fighter.duration;
      if(t<0)continue;
      const travel=Math.min(t,1);
      const carrier=carriers[fighter.carrier],side=Math.sign(carrier.offset)||Math.sign(fighter.lane)||1;
      const startX=640+carrier.offset+fighter.lane*carrier.height*.1;
      const startY=carrier.y+carrier.height*.2;
      // Fighters peel away from each hangar, then curve back toward the flagship deck.
      const x=curve(startX,startX+side*115,fighter.targetX+side*145,fighter.targetX,travel);
      const y=curve(startY,startY+140,470,fighter.targetY,travel);
      ctx.fillStyle=fighter.color;
      const hover=t>=1?Math.sin(seconds*1.3+fighter.carrier)*1.3:0;
      ctx.fillRect(Math.round(x),Math.round(y+hover),2,2);
    }
    ctx.restore();
  }
  function drawHull(ctx,x,y,height){
    if(!hull.naturalWidth)return;
    const width=height*hull.naturalWidth/hull.naturalHeight;
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.translate(x,y);
    // The bow faces the pilot. The bridge and stern enter view last.
    ctx.rotate(Math.PI);
    ctx.drawImage(hull,-width/2,-height/2,width,height);
    ctx.restore();
  }
  let animation=0,started=null,finish=null;
  function stop(){
    cancelAnimationFrame(animation);animation=0;started=null;
    window.SpaceSound?.stopIntro?.(0);
    const done=finish;finish=null;done?.();
  }
  async function start(canvas,ship,onFinish){
    stop();
    if(!await ready)return false;
    await window.SpaceSound?.prepareIntro?.();
    finish=onFinish;
    const ctx=canvas.getContext('2d');
    function frame(now){
      started??=now;
      const elapsed=(now-started)/1000;
      draw(ctx,elapsed,ship);
      if(elapsed>=DURATION){stop();return;}
      animation=requestAnimationFrame(frame);
    }
    animation=requestAnimationFrame(frame);
    return true;
  }
  window.addEventListener('pagehide',stop);
  window.SpaceBossSixPreview=Object.freeze({ready,pose,draw,start,stop,duration:DURATION,entryDuration:APPROACH_START+APPROACH_SECONDS});
})();
