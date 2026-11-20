/* Two repeating scenery planes: distant haze and a shared celestial chart. */
(() => {
  'use strict';
  const width = 1280, height = 720, cycle = 180, tileHeight = 1440;
  function tile(w,h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function hash(x,y) {
    let k = Math.imul(x ^ 0x7b19, 374761393) + Math.imul(y ^ 0x4b, 668265263);
    k = Math.imul(k ^ (k >>> 13), 1274126177);
    return ((k ^ (k >>> 16)) >>> 0) / 4294967296;
  }
  const interpolate = (a,b,t) => a + (b-a)*t;
  function noise(x,y,rows) {
    const ix=Math.floor(x), iy=Math.floor(y);
    const fx=x-ix, fy=y-iy;
    const u=fx*fx*(3-2*fx), v=fy*fy*(3-2*fy);
    const a=iy%rows, b=(a+1)%rows;
    return interpolate(interpolate(hash(ix,a),hash(ix+1,a),u),interpolate(hash(ix,b),hash(ix+1,b),u),v);
  }
  function makeNebula() {
    const c=tile(384,432), context=c.getContext('2d');
    const pixels=context.createImageData(c.width,c.height);
    for(let y=0;y<c.height;y++) {
      const h=y/c.height, angle=h*2*Math.PI;
      const axis=.5+.38*Math.sin(angle)+.09*Math.sin(2*angle+.8);
      for(let x=0;x<c.width;x++) {
        const u=x/c.width;
        const broad=noise(u*5,h*6,6), medium=noise(u*12+7,h*16,16);
        const fine=noise(u*42,h*48,48), dust=noise(u*96+12,h*96,96);
        const d=(u-axis)+(broad-.5)*.27+(medium-.5)*.09;
        const band=Math.exp(-d*d*19), spine=Math.exp(-d*d*137);
        const cloud=band*(.12+.47*broad+.28*medium+.13*fine);
        const whorl=(medium*.67+fine*.33);
        const filament=spine*Math.max(0,whorl-.23)*(.6+.65*dust);
        const dark=spine*Math.exp(-Math.pow((whorl-.51)*11,2))*.55;
        const lilac=.5+.5*Math.sin(angle+.68*u);
        const i=(y*c.width+x)*4;
        pixels.data[i]=4+(11+13*lilac)*cloud+20*filament-8*dark;
        pixels.data[i+1]=10+(23-9*lilac)*cloud+13*filament-8*dark;
        pixels.data[i+2]=23+39*cloud+26*filament-13*dark;
        pixels.data[i+3]=255;
      }
    }
    context.putImageData(pixels,0,0);
    // Expand once; joins are pasted at 1:1 scale in the render loop.
    const result=tile(width,tileHeight), out=result.getContext('2d');
    out.drawImage(c,0,0,width,tileHeight);
    return result;
  }
  function makeStars(layer,count) {
    const c=tile(width,tileHeight), g=c.getContext('2d');
    const colors=['#a0d2e8','#8babe2','#e6ccae','#e3e8fa'];
    for(let i=0;i<count;i++) {
      const x=Math.floor(hash(i,6+layer)*width), y=Math.floor(hash(i,29+layer)*tileHeight);
      const value=hash(i,45+layer);
      const size=layer===2 && value>.87?2:1;
      g.fillStyle=colors[i%colors.length];g.globalAlpha=.25+value*.58;
      for(const dy of [-tileHeight,0,tileHeight]) {
        g.fillRect(x,y+dy,size,size);
        if(layer===2 && value>.96) {
          g.globalAlpha=.19;
          g.fillRect(x-2,y+dy,6,1);g.fillRect(x,y-2+dy,1,6);
          g.globalAlpha=.25+value*.58;
        }
      }
    }
    return c;
  }
  // The sheet is drawn at two depths. Tint once so distant bodies occlude
  // background stars without the bright rims competing with enemy gunfire.
  const objects = new Image();
  const sprites = [];
  let chart, haze;
  const cell = 128;
  objects.onload = () => {
    if (objects.naturalWidth !== 3*cell || objects.naturalHeight !== 2*cell) return;
    for (let i=0; i<6; i++) {
      const sprite=tile(cell,cell), g=sprite.getContext('2d');
      g.drawImage(objects,(i%3)*cell,Math.floor(i/3)*cell,cell,cell,0,0,cell,cell);
      g.globalCompositeOperation='source-atop';
      g.fillStyle=i<3?'rgba(15,28,51,.50)':'rgba(17,25,43,.35)';
      g.fillRect(0,0,cell,cell);
      sprites.push(sprite);
    }
    chart=null;
  };
  objects.src=new URL('./assets/orbital-scenery.png',document.currentScript.src).href;

  function drawMeteor(ctx,x,y,size,angle=0,variant=0) {
    if(sprites.length!==6 || !(size>0))return false;
    const column=((Math.trunc(variant)%3)+3)%3;
    // Remove the atlas padding here to keep the visible hazard hull aligned
    // with its existing hitbox. The foreground keeps its full rim contrast.
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.translate(x,y);
    ctx.rotate(angle);
    ctx.drawImage(objects,column*cell+6,cell+6,116,116,-size/2,-size/2,size,size);
    ctx.restore();
    return true;
  }
  const chartHeight=tileHeight*2;
  const biomes=new Image();
  biomes.onload=()=>{chart=null;};
  biomes.src=new URL('./assets/planet-biomes.png',document.currentScript.src).href;

  // World coordinates stay fixed relative to the stars, including across the seam.
  const systems=[
    {x:245,y:278,tilt:-.30,radii:[23,44,71],star:'#b79b72'},
    {x:977,y:1488,tilt:.38,radii:[21,44,64,87],star:'#88b6c9'},
    {x:330,y:2310,tilt:-.15,radii:[30,53,72],star:'#b694a6'}
  ];
  
  const tracks=new Map();
  function orbitPoint(radius,angle,tilt) {
    const x=radius*Math.cos(angle), y=radius*.48*Math.sin(angle);
    return [x*Math.cos(tilt)-y*Math.sin(tilt), x*Math.sin(tilt)+y*Math.cos(tilt)];
  }
  function orbitTracks(system) {
    if(tracks.has(system))return tracks.get(system);
    const img=tile(193,129), g=img.getContext('2d');
    for(const radius of system.radii) {
      const count=Math.ceil(radius*6);
      g.fillStyle='rgba(111,146,170,.25)';
      for(let i=0;i<count;i++) {
        if(i%29>24)continue;
        const [x,y]=orbitPoint(radius,i/count*2*Math.PI,system.tilt);
        g.fillRect(96+Math.round(x),64+Math.round(y),1,1);
      }
    }
    tracks.set(system,img);
    return img;
  }
  function starRing(ctx,n,x,y,r){
    const count=6+Math.floor(random(n,70)*3), tilt=random(n,71)*Math.PI;
    const points=Array.from({length:count},(_,i)=>{
      const radius=r*(.76+.24*random(n,82+i));
      const angle=tilt+2*Math.PI*(i+.28*random(n,110+i))/count;
      return [Math.round(x+radius*Math.cos(angle)),Math.round(y+radius*.72*Math.sin(angle))];
    });
    ctx.save();
    ctx.beginPath();
    points.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));
    ctx.closePath();ctx.strokeStyle='rgba(136,171,201,.38)';ctx.lineWidth=1;ctx.stroke();
    for(const [i,[px,py]] of points.entries()){
      const size=i%3===0?3:2;
      ctx.fillStyle='#526985';ctx.fillRect(px-size,py-1,size*2+1,3);
      ctx.fillRect(px-1,py-size,3,size*2+1);
      ctx.fillStyle=i%3===0?'#d9c792':'#a4c2d5';ctx.fillRect(px-1,py-1,3,3);
    }
    ctx.restore();
  }
  const deepAtlas=new Image();
  deepAtlas.onload=()=>{haze=null;chart=null;};
  deepAtlas.src=new URL('./assets/deep-space-atlas.png',document.currentScript.src).href;
  function deepSprite(g,index,x,y,w,alpha) {
    if(deepAtlas.naturalWidth!==720 || deepAtlas.naturalHeight!==128)return;
    g.save();
    g.globalAlpha=alpha;
    g.imageSmoothingEnabled=false;
    g.drawImage(deepAtlas,index*240,0,240,128,x,y,w,Math.round(w*128/240));
    g.restore();
  }
  function makeHaze() {
    const img=makeNebula();
    const g=img.getContext('2d');
    deepSprite(g,2,390,65,460,.21);
    deepSprite(g,2,845,874,306,.133);
    return img;
  }
  // Twelve line figures, four per atlas. The chart still scrolls as one plane.
  const zodiacSize=256;
  const zodiacSheets=[1,2,3].map(index=>{
    const image=new Image();
    image.onload=()=>{chart=null;};
    image.src=new URL('./assets/zodiac-'+index+'.png',document.currentScript.src).href;
    return image;
  });

  function paintZodiac(g) {
    const figureCount=zodiacSheets.length*4;
    const slotHeight=chartHeight/figureCount;
    g.save();
    g.imageSmoothingEnabled=true;
    g.imageSmoothingQuality='high';
    g.globalAlpha=.42;
    for(let i=0;i<figureCount;i++){
      const image=zodiacSheets[Math.floor(i/4)];
      if(image.naturalWidth!==2*zodiacSize || image.naturalHeight!==2*zodiacSize)continue;
      // Keep padding around the chart seam and stagger adjacent figures.
      const centerX=width*(.19+(i%3)*.31)+(random(i,741)-.5)*156;
      const centerY=(i+.5)*slotHeight+(random(i,742)-.5)*56;
      const size=Math.round(150+random(i,743)*44);
      g.drawImage(image,(i%2)*zodiacSize,(Math.floor(i/2)%2)*zodiacSize,zodiacSize,zodiacSize,
        Math.round(centerX-size/2),Math.round(centerY-size/2),size,size);
    }
    g.restore();
  }

  function makeChart() {
    const img=tile(width,chartHeight),g=img.getContext('2d');
    g.imageSmoothingEnabled=false;
    // Bake the different sizes of pinpoint stars into this same transparent plane.
    for(const [layer,count] of [[1,1250],[2,310]]){
      const stars=makeStars(layer,count);
      g.drawImage(stars,0,0);g.drawImage(stars,0,tileHeight);
    }
    paintZodiac(g);
    return img;
  }
  // Stable world-space sectors: their positions change only as the camera travels.
  const seed=Math.floor(Math.random()*0x7fffffff);
  const random=(sector,salt)=>hash(sector^seed,salt);
  const clamp=n=>Math.min(1,Math.max(0,n));
  const sectorHeight=650/1.75, speed=16;
  const scenery=new Image(), encounters=new Image();
  scenery.src=new URL('./assets/celestial-survey.png',document.currentScript.src).href;
  encounters.src=new URL('./assets/planet-encounters.png',document.currentScript.src).href;
  const decks=new Map();
  function landmark(sector){
    const group=Math.floor(sector/30);
    if(!decks.has(group)){
      const order=Array.from({length:30},(_,i)=>i);
      for(let i=29;i>0;i--){
        const j=Math.floor(random(group,i+200)*(i+1));
        [order[i],order[j]]=[order[j],order[i]];
      }
      if(decks.size>=4)decks.delete(decks.keys().next().value);
      decks.set(group,order);
    }
    return decks.get(group)[sector-group*30];
  }
  function stamp(ctx,img,col,row,sw,sh,x,y,size){
    if(!img.naturalWidth)return;
    ctx.drawImage(img,col*sw,row*sh,sw,sh,Math.round(x-size/2),Math.round(y-size/2),size,size*sh/sw);
  }
  function encounterType(n){
    const slot=((n%8)+8)%8;
    return slot===2?'close':slot===6?'rupture':'';
  }
  const halos=new Map();
  const stillSky=window.matchMedia('(prefers-reduced-motion: reduce)');
  function turn(n,seconds){
    if(stillSky.matches)return 0;
    const period=120+60*random(n,634);
    return (seconds%period)*Math.PI*2/period*(random(n,635)<.5?-1:1);
  }
  function atmosphere(ctx,x,y,size,warm){
    const hue=warm?'187,132,97':'111,145,201';
    if(!halos.has(hue)){
      const c=tile(96,96),g=c.getContext('2d');
      for(const [cx,cy,r,a] of [[48,48,46,.14],[31,41,12,.08],[71,59,7,.06]]){
        const glow=g.createRadialGradient(cx,cy,0,cx,cy,r);
        glow.addColorStop(0,'rgba('+hue+','+a+')');
        glow.addColorStop(.65,'rgba('+hue+','+a*.65+')');
        glow.addColorStop(1,'rgba('+hue+',0)');
        g.fillStyle=glow;g.fillRect(cx-r,cy-r,r*2,r*2);
      }
      halos.set(hue,c);
    }
    ctx.drawImage(halos.get(hue),x-size/2,y-size/2,size,size);
  }
  function rotateAround(ctx,x,y,angle){
    ctx.translate(x,y);ctx.rotate(angle);ctx.translate(-x,-y);
  }
  function drawEncounter(ctx,n,y,type,seconds){
    if(!encounters.naturalWidth)return;
    const side=random(n,401)<.5?-1:1;
    const near=type==='close', size=near?970:240;
    const x=near?(side<0?-85:width+85):170+random(n,402)*(width-340);
    const age=clamp((y-160)/150);
    ctx.save();
    ctx.globalAlpha=near?1:.82;
    atmosphere(ctx,x,y,size*1.15,!near);
    rotateAround(ctx,x,y,turn(n,seconds));
    const frame=encounters.naturalHeight;
    if(near || age<1){ctx.globalAlpha*=near?1:1-age;stamp(ctx,encounters,near?0:1,0,frame,frame,x,y,size);}
    if(!near && age>0){
      // Crossfade within the same disk; then fragments keep drifting from the breach.
      ctx.globalAlpha=.82*age;
      stamp(ctx,encounters,2,0,frame,frame,x,y,size);
      for(let i=0;i<12 && sprites.length===6;i++){
        const angle=-1.57+random(n,420+i)*1.8;
        const travel=Math.max(0,y-160)*(.12+random(n,445+i)*.37);
        const span=5+random(n,480+i)*15;
        ctx.save();
        ctx.translate(x+size*.22+Math.cos(angle)*travel,y-size*.20+Math.sin(angle)*travel);
        ctx.rotate(angle+travel*.009);
        ctx.drawImage(sprites[3+i%3],-span/2,-span/2,span,span);
        ctx.restore();
      }
    }
    ctx.restore();
  }
  function landmarks(ctx,seconds){
    const distance=seconds*speed, first=Math.floor(distance/sectorHeight);
    const visible=[];
    for(let n=first-4;n<=first+4;n++){
      const y=height/2+distance-n*sectorHeight+(random(n,83)-.5)*sectorHeight*.148;
      visible.push({n,y,type:encounterType(n)});
    }
    let proximity=0;
    for(const v of visible)if(v.type==='close')
      proximity=Math.max(proximity,clamp((880-Math.abs(v.y-height/2))/450));
    ctx.save();ctx.imageSmoothingEnabled=false;
    for(const {n,y,type} of visible){
      if(type || y < -160 || y>height+160)continue;
      const regularSlot=((n%8)+8)%8;
      const id=landmark(Math.floor(n/8)*6+regularSlot-(regularSlot>2?1:0)-(regularSlot>6?1:0)), far=id>=14 && id<=19;
      const size=Math.round((far?145:75)+random(n,53)*(far?95:78));
      const x=size/2+random(n,25)*(width-size);
      if(n%4===0 && id<24 && proximity<.8){
        ctx.globalAlpha=.65*(1-proximity);
        const ringX=x<width/2?width*.78:width*.22;
        ctx.save();rotateAround(ctx,ringX,y+115,turn(n,seconds));
        starRing(ctx,n,ringX,y+115,42+random(n,65)*28);ctx.restore();
      }
      ctx.globalAlpha=(id===12 || id===13 ? .72 : far ? .43 : .79)*(1-.85*proximity);
      const scale=Math.round(size*(1-.35*proximity));
      ctx.save();
      if(id<20 || id>=24){
        atmosphere(ctx,x,y,scale*1.45,id===12 || id===18);
      }
      rotateAround(ctx,x,y,turn(n,seconds));
      if(id<24 && scenery.naturalWidth)stamp(ctx,scenery,id%6,Math.floor(id/6),128,128,x,y,scale);
      else if(id===26 || id===28){starRing(ctx,n,x,y,scale*.55);}
      else if(id===29){
        ctx.drawImage(orbitTracks(systems[0]),x-96,y-64);
        ctx.fillStyle='#baaa85';ctx.fillRect(x-2,y-2,4,4);
      } else if(id>=27 && biomes.naturalWidth===384)stamp(ctx,biomes,id-27,0,128,128,x,y,scale);
      else if(sprites.length===6)ctx.drawImage(sprites[id%6],x-scale/2,y-scale/2,scale,scale);
      ctx.restore();
    }
    ctx.globalAlpha=1;
    for(const v of visible)if(v.type)drawEncounter(ctx,v.n,v.y,v.type,seconds);
    ctx.restore();
  }
  function scrollPlane(ctx,img,seconds){
    const shift=Math.floor((seconds%cycle)*img.height/cycle);
    ctx.drawImage(img,0,shift-img.height);
    if(shift<height)ctx.drawImage(img,0,shift);
  }
  function draw(ctx,seconds) {
    haze ||= makeHaze();
    chart ||= makeChart();
    scrollPlane(ctx,haze,seconds);   // 8 design pixels per second
    scrollPlane(ctx,chart,seconds);  // 16 for all celestial landmarks
    landmarks(ctx,seconds);
  }
  window.SpaceBackdrop=Object.freeze({draw,drawMeteor});
})();
