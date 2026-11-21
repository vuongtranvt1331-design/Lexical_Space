(() => {
  "use strict";
  const directory = new URL("./assets/boss-fx/", document.currentScript.src);
  const sheets = new Map();
  function load(index) {
    if (!Number.isInteger(index) || index < 1 || index > 10) return null;
    if (sheets.has(index)) return sheets.get(index);
    const image = new Image();
    const ready = new Promise(resolve => {
      image.onload = () => resolve(image.naturalWidth === 256 && image.naturalHeight === 448);
      image.onerror = () => resolve(false);
    });
    const sheet = { image, ready };
    sheets.set(index, sheet);
    image.src = new URL(String(index).padStart(2, "0") + ".png", directory).href;
    return sheet;
  }
  function paint(ctx, index, row, frame, x, y, size, angle, flip) {
    const image = load(index)?.image;
    if (!image?.complete || image.naturalWidth !== 256 || image.naturalHeight !== 448) return false;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(x), Math.round(y));
    if (angle) ctx.rotate(angle);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(image, (frame % 4) * 64, row * 64, 64, 64, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }
  const hullFiles = {1:'beacon-hulls.png',2:'rail-hulls.png',3:'hound-hulls.png',4:'miner-hulls.png'};
  const hullSheets = new Map();
  function loadHull(index) {
    if (hullSheets.has(index)) return hullSheets.get(index);
    const image = new Image();
    const ready = new Promise(resolve => {
      image.onload = () => resolve(image.naturalWidth === image.naturalHeight * 2 && image.naturalHeight > 0);
      image.onerror = () => resolve(false);
    });
    const sheet = {image, ready};
    hullSheets.set(index, sheet);
    image.src = new URL(hullFiles[index], directory).href;
    return sheet;
  }
  function drawHull(ctx, boss, twin, x, y, size, time) {
    if (Object.hasOwn(hullFiles,boss.index)) {
      const image = loadHull(boss.index).image;
      const cell = image.naturalHeight;
      if (!image.complete) return true;
      if (!cell || image.naturalWidth !== cell * 2) return paint(ctx,boss.index,0,0,x,y,size,0,false);
      const damaged = boss.hp <= boss.max * 0.5;
      const extent = boss.index===3 && size===172 ? window.SpaceEncounterEngine.houndHullExtent :
        boss.index===4 ? size : Math.round(size * 1.1);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, damaged ? cell : 0, 0, cell, cell,
        Math.round(x - extent / 2), Math.round(y - extent / 2), extent, extent);
      ctx.restore();
      return true;
    }
    const cast = boss.attack;
    const spec = window.SpaceBosses?.catalog[boss.index-1]?.skills?.[cast?.skillIndex];
    let recoil = 0;
    if (spec && cast) {
      // Recoil follows the same event times as the host simulation, including repeated salvos.
      for (const event of spec.events) {
        const since = cast.t - spec.windup - (event.at || 0);
        if (since < 0) continue;
        const pulse = event.interval > 0 ? Math.min(Math.floor(since / event.interval), (event.repeat || 1) - 1) : 0;
        const age = since - pulse * (event.interval || 0);
        if (age < 0.18) recoil = Math.max(recoil, Math.sin(Math.PI * age / 0.18) * (1 - age / 0.18));
      }
    }
    return paint(ctx, boss.index, 0, Math.floor(time * 7), x, y - size * 0.04 * recoil, size, 0, boss.index === 5 && twin === 1);
  }
  function drawSkill(ctx, boss, skill, x, y, size, time, angle = 0) {
    if (!Number.isInteger(skill) || skill < 0 || skill > 5) return false;
    const row = boss===1 ? 2-skill : skill+1;
    return paint(ctx, boss, row, Math.floor(time * 12), x, y, size, angle, false);
  }
  // Most sprite rows point down. These artists' rows use a horizontal or diagonal axis.
  const bearings = {
    4: {1:0}, 5: {3:0}, 6: {3:-90}, 7: {0:0,1:45,3:0},
    8: {4:135}, 9: {1:0,3:0}, 10:{0:0,1:45,2:0,3:-90}
  };
  const effects = new Image();
  effects.src = new URL('enemy-flight-effects.png',directory).href;
  const readyEffects=()=>effects.complete && effects.naturalWidth===256 && effects.naturalHeight===384;
  const frameAt=t=>Math.floor(t*12)%4;
  // Rows 0–1 are upright projectiles; rows 2–5 contain continuous horizontal textures.
  function strip(ctx,row,x,y,endX,endY,width,time){
    if(!readyEffects())return false;
    const dx=endX-x,dy=endY-y,len=Math.hypot(dx,dy);
    if(!len)return true;
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(dy,dx));ctx.imageSmoothingEnabled=false;
    const tile=Math.max(12,width*4), sx=frameAt(time)*64, sy=row*64+16;
    for(let pos=0;pos<len;pos+=tile){
      const w=Math.min(tile,len-pos);
      ctx.drawImage(effects,sx,sy,64*w/tile,32,pos,-width/2,w,width);
    }
    ctx.restore();return true;
  }
  function waveArc(ctx,x,y,r,lo,hi,width,time){
    if(!readyEffects() || r<=0)return false;
    const count=Math.max(1,Math.ceil((hi-lo)*r/48));
    let px=x+r*Math.cos(lo),py=y+r*Math.sin(lo);
    for(let i=1;i<=count;i++){
      const theta=lo+(hi-lo)*i/count,nx=x+r*Math.cos(theta),ny=y+r*Math.sin(theta);
      strip(ctx,2,px,py,nx,ny,width,time);px=nx;py=ny;
    }
    return true;
  }
  function drawProjectile(ctx, hazard, time) {
    if (!hazard.bossIndex){
      if(!readyEffects() || !['bolt','missile'].includes(hazard.type))return false;
      const missile=hazard.type==='missile',size=missile?33:20;
      ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(hazard.x,hazard.y);
      ctx.rotate(Math.atan2(hazard.vy,hazard.vx)+Math.PI/2);
      ctx.drawImage(effects,frameAt(time)*64,missile?0:64,64,64,-size/2,-size/2,size,size);
      ctx.restore();return true;
    }
    const {x, y, vx, vy, bossIndex, skillIndex} = hazard;
    const speed = Math.hypot(vx, vy);
    const missile = hazard.type === 'missile';
    const size = hazard.houndKind === 'child' ? 24 : hazard.houndKind === 'mother' ? 44 : missile ? 36 : 22;
    const angle = Math.atan2(vy, vx) - Math.PI / 2;
    const bearing = bearings[bossIndex]?.[skillIndex] ?? 90;
    const rotation = Math.atan2(vy, vx) - bearing * Math.PI / 180;
    if (!drawSkill(ctx, bossIndex, skillIndex, x, y, size, time, rotation)) return false;
    if (missile && speed > 0) {
      // Short stepped exhaust follows the actual steering vector, including after a turn.
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(angle);
      const pulse = Math.floor(time * 16 + x / 20) % 3;
      ctx.fillStyle = hazard.seeker ? '#ff508c' : '#ffbd55';
      ctx.fillRect(-2,-17-pulse,4,4);
      ctx.fillStyle = '#f785585e';
      ctx.fillRect(-1,-23-pulse*2,2,3);
      ctx.restore();
    }
    return true;
  }
  // Traveling cores and flakes stay inside the collision strip.
  function drawBeam(ctx, boss, skill, x, y, angle, length, width, time, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#ffffdf';
    ctx.globalAlpha = 0.64 + 0.15 * Math.sin(time * 33);
    const core = Math.max(2, Math.round(width * 0.16));
    ctx.fillRect(0, -core / 2, length, core);
    const offset = Math.floor(time * 210) % 52;
    for (let along = offset, i = 0; along < length; along += 52, i++) {
      const flank = i % 2 ? 1 : -1;
      ctx.fillStyle = i % 3 ? '#fffae1' : color || '#98dfff';
      ctx.fillRect(along, flank * width * 0.29, 8 + (i % 4) * 3, 2);
    }
    ctx.globalAlpha = 1;
    drawSkill(ctx, boss, skill, Math.min(32, length / 2), 0, Math.min(72, width * 1.5), time, -Math.PI / 2);
    ctx.restore();
  }
  const escorts = new Image();
  escorts.src = new URL('rail-escorts.png',directory).href;
  function drawRailEscort(ctx,x,y,angle,side,charge){
    if(!escorts.complete || escorts.naturalWidth!==128 || escorts.naturalHeight!==64) return false;
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.translate(x,y);
    ctx.rotate(angle-Math.PI/2);
    const size=54;
    // The trimmed nose occupies row 60 in the 64px pose.
    ctx.drawImage(escorts,side<0?0:64,0,64,64,-size/2,-size*60/64,size,size);
    ctx.restore();
    return true;
  }
  const playerBolts = new Image();
  playerBolts.src = new URL('../player-bolts.png',directory).href;
  function drawPlayerBolt(ctx,shot,time){
    if (!playerBolts.complete || playerBolts.naturalWidth!==128 || playerBolts.naturalHeight!==32) return false;
    const tier=Math.floor((Math.max(1,Math.min(8,shot.level||1))-1)/2);
    const scale=1.1**tier, width=6*scale, height=20*scale;
    // The four colour cells have different transparent margins. Scale the painted bolt.
    const inkWidth=[8,12,12,14][tier];
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.translate(Math.round(shot.x),Math.round(shot.y));
    ctx.rotate(Math.atan2(shot.vx||0,840));
    ctx.drawImage(playerBolts,tier*32+(32-inkWidth)/2,1,inkWidth,29,-width/2,-height/2,width,height);
    ctx.restore();
    return true;
  }
  const blast = new Image();
  blast.src = new URL('shared-explosion.png',directory).href;
  function drawBlast(ctx,x,y,size,progress){
    if(!blast.complete || blast.naturalWidth!==384 || blast.naturalHeight!==192) return false;
    const f=Math.max(0,Math.min(7,Math.floor(progress*8)));
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(blast,(f%4)*96,Math.floor(f/4)*96,96,96,
      Math.round(x-size/2),Math.round(y-size/2),Math.round(size),Math.round(size));
    ctx.restore();
    return true;
  }
  loadHull(1);
  window.SpaceBossFX = Object.freeze({strip,waveArc,load, loadHull, drawHull, drawSkill, drawBeam, drawProjectile, drawBlast, drawRailEscort, drawPlayerBolt});
})();
