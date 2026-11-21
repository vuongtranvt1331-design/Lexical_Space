/* Deterministic fly-in: both screens can render the same sequence from mission time alone. */
(() => {
  'use strict';
  const departure=1.5, returnAt=5.75, returnDuration=1.65;
  const duration=departure+returnAt+returnDuration;
  const chargeDuration = .32;
  const holdBeforeJump = 1;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const carriers = [
    {x:326, y:335, size:344, release:2.12, sprite:'star-destroyer'},
    {x:954, y:335, size:344, release:2.28, sprite:'star-destroyer'},
    {x:640, y:360, size:496, release:2.42, sprite:'venator'}
  ];
  const hulls = {};
  const ready = Promise.all(['venator','star-destroyer'].map(name => new Promise(resolve => {
    const img = new Image();
    img.onload = () => { hulls[name]=img; resolve(); };
    img.onerror = () => resolve();
    img.src='./assets/'+name+'.png';
  })));
  const classes = ['scout', 'tracker', 'diver', 'guardian'];
  const miniatures = new Map();
  function miniature(role) {
    if (!miniatures.has(role)) {
      const image = document.createElement('canvas');
      image.width = image.height = 22;
      window.SpaceArt.draw(image.getContext('2d'), role, 11, 11, 15, 15);
      miniatures.set(role, image);
    }
    return miniatures.get(role);
  }
  function clamp(value) { return Math.max(0, Math.min(1, value)); }
  function smooth(value) {
    const t = clamp(value);
    return t*t*(3-2*t);
  }
  // Release the fighters during the engine charge, then accelerate nose-first offscreen.
  function carrierPose(c,t,limited) {
    const charge=t-c.release;
    const jump=clamp((charge-chargeDuration-holdBeforeJump)/.63);
    const entry=smooth(t/(c.release-.35));
    const size=c.size*(1-.68*jump);
    const startY=720+c.size/2+12;
    const y=startY+(c.y-startY)*entry-(c.y+180)*jump*jump;
    return {x:c.x+(640-c.x)*.23*jump, y, size, charge, jump};
  }
  function drawCarrier(ctx,c,t,limited){
    const {x,y,size,charge,jump}=carrierPose(c,t,limited);
    if(jump>=1)return;
    if(charge>0){
      // Nozzle centers in the 144 × 208 hull sprites, measured from their center.
      const ports=c.sprite==='venator'?[-23,-13,0,13,23]:[-15,0,15];
      const scale=size/208, ignition=smooth(charge/chargeDuration);
      const ey=y+91*scale;
      for(const port of ports){
        const ex=x+port*scale;
        const length=(11+91*ignition+165*jump)*scale*(limited?.50:1);
        const width=(1+3*ignition)*scale;
        for(const [color,w,h] of [['#ed571d',1,1],['#ffb434',.72,.73],['#fff3bd',.38,.47]]){
          ctx.fillStyle=color;
          ctx.beginPath();ctx.moveTo(ex-w*width,ey);ctx.lineTo(ex+w*width,ey);
          ctx.lineTo(ex,ey+h*length);ctx.fill();
        }
        if(!limited && jump>0){
          for(let i=0;i<3;i++){
            const age=(charge*2.1+i/3+Math.abs(port)*.079)%1;
            const drift=Math.sin(i*4+port)*age*scale*11;
            ctx.fillStyle=i===1?'#fff0a5':'#ff963a';
            ctx.fillRect(Math.round(ex+drift),Math.round(ey+length*(.68+age*.58)),
              Math.max(1,scale),Math.max(2,(1-age)*7*scale));
          }
        }
      }
    }
    const hull=hulls[c.sprite];
    if(hull)ctx.drawImage(hull,Math.round(x-size*144/208/2),Math.round(y-size/2),size*144/208,size);
    else window.CapitalArt.drawHull(ctx,x,y,size*.7,size);
  }
  function drawSwarm(ctx,t,limited){
    for(let group=0;group<24;group++){
      const carrier=carriers[group%3],lane=Math.floor(group/3),side=lane%2?1:-1;
      for(let rank=0;rank<10;rank++){
        const release=carrier.release+lane*.018+rank*.019;
        const age=t-release;
        if(age<0)continue;
        const launch=carrierPose(carrier,release,limited);
        const originX=launch.x+side*launch.size*.074,originY=launch.y+launch.size*.12;
        const travel=2.17+lane*.042+rank*.018;
        const u=clamp(age/travel);
        if(u===1)continue; // At u=1 even the trailing edge is outside the canvas.
        const exitX=side<0?-40:1320;
        const spread=Math.sin(Math.PI*u);
        const x=originX+(exitX-originX)*u*u+side*spread*(46+lane*10);
        const y=originY+(182+lane*39-originY)*u+spread*(85+lane*7+22*Math.sin(5*u+lane));
        const size=Math.round(7+u*8);
        ctx.drawImage(miniature(classes[(group+rank)%4]),Math.round(x-size/2),Math.round(y-size/2),size,size);
      }
    }
  }
  function draw(ctx, elapsed, shipId='kestrel', wingmanId, preview=false, sharedSky=false) {
    const limited = still.matches && !preview;
    const time=Math.max(0,elapsed-departure);
    const t = time;
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    if(sharedSky)ctx.clearRect(0,0,1280,720);
    else window.SpaceBackdrop.draw(ctx,elapsed);
    if(elapsed<departure){
      if(sharedSky){ctx.restore();return;}
      const u=smooth(Math.max(0,(elapsed-.15)/(departure-.15)));
      const y=367-500*u*u, size=146-60*u;
      const xs=wingmanId?[542,738]:[640];
      for(let i=0;i<xs.length;i++)window.SpaceArt.draw(ctx,i?wingmanId:shipId,xs[i],y,size,size,Math.floor(elapsed*12));
      ctx.restore();return;
    }
    for (const carrier of carriers) {
      drawCarrier(ctx,carrier,t,limited);
    }
    drawSwarm(ctx,t,limited);
    if(t>=returnAt){
      const arrival=smooth((t-returnAt)/returnDuration),y=784+(605-784)*arrival;
      const xs=wingmanId?[1280*.42,1280*.58]:[640];
      for(const [i,x] of xs.entries()){
        window.SpaceArt.draw(ctx,i?wingmanId:shipId,x,y,84,80,Math.floor(elapsed*8));
      }
    }
    ctx.restore();
  }
  window.SpaceCampaign=Object.freeze({duration,departure,ready,draw,
    audioCues:[[departure,'boss'],[departure+carriers[0].release+chargeDuration+holdBeforeJump,'warp']],get reducedMotion(){return still.matches;}});
})();
