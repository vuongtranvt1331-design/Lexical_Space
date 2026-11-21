/* Rectangles refer to opaque hull bounds within uniformly padded 256px atlas cells.
 * Engine ports are normalized offsets from the center, mirrored on either side. */
(() => {
  "use strict";
  const sprites = {
    scout:    { rect: [60, 268, 136, 232],   port: [.175,-.412], color: "#ffe17c" },
    diver:    { rect: [268, 292, 232, 184],  port: [.127,-.432], color: "#ff7d65" },
    tracker:  { rect: [527, 268, 226, 232],  port: [.145,-.402], color: "#e9a8ff" },
    guardian: { rect: [780, 294, 232, 180],  port: [.106,-.410], color: "#8df5b8" },
    boss:     { rect: [15, 524, 226, 232],   port: [.048,-.456], color: "#ffe69c" },
    boss2:    { rect: [283, 524, 202, 232],  port: [.041,-.451], color: "#ffb175" },
    boss3:    { rect: [524, 524, 232, 232],  port: [.261,-.417], color: "#dc9fff" }
  };
  const sheet = new Image();
  const fleetReady = new Promise((resolve, reject) => {
    sheet.onload = resolve;
    sheet.onerror = () => reject(new Error("Fleet sprite atlas could not load."));
  });
  sheet.src = "./assets/fleet.png";

  const enemyColumns = {scout:0,guardian:1,diver:2,tracker:3};
  const enemySheet = new Image();
  // The intro caches miniatures. Wait for the enemy atlas before sampling them.
  const enemyReady = new Promise(resolve => {
    enemySheet.onload = resolve;
    enemySheet.onerror = resolve; // The original fleet atlas provides a fallback.
  });
  // Mouth centers are measured in each 256px hull cell. The four ships share
  // one animated exhaust strip and the same vertical mounting point.
  const playerHulls={
    kestrel:{column:0,exhaustX:[100,158]},
    spectre:{column:1,exhaustX:[96,158]},
    aegis:{column:2,exhaustX:[94,158]},
    tempest:{column:3,exhaustX:[94,158]}
  };
  const exhaustY=226;
  function atlas(src,width,height){
    const image=new Image();
    const loaded=new Promise((resolve,reject)=>{
      image.onload=()=>image.naturalWidth===width && image.naturalHeight===height
        ? resolve() : reject(new Error('Invalid dimensions for '+src));
      image.onerror=()=>reject(new Error('Cannot load '+src));
    });
    image.src=new URL(src,document.currentScript.src).href;
    return {image,loaded};
  }
  const hulls=atlas('./assets/player-hulls.png',1024,256);
  const exhaust=atlas('./assets/player-exhaust.png',256,128);
  const playerReady=Promise.all([hulls.loaded,exhaust.loaded]);
  const ready=Promise.all([fleetReady,enemyReady,playerReady]);
  enemySheet.src = "./assets/enemy-flight-atlas.png";

  function draw(ctx, key, x, y, width, height, frame = 0) {
    if(Object.hasOwn(playerHulls,key)){
      const hull=playerHulls[key];
      if(!hulls.image.naturalWidth || !exhaust.image.naturalWidth)return;
      const size=Math.min(width,height);
      const left=Math.round(x-size/2),top=Math.round(y-size/2);
      ctx.save();
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(hulls.image,hull.column*256,0,256,256,left,top,size,size);
      if(frame>=0){
        const sx=(Math.floor(frame)%4)*64, w=size*.095, h=size*.30;
        const cy=top+size*exhaustY/256;
        for(const px of hull.exhaustX){
          const cx=left+size*px/256;
          ctx.drawImage(exhaust.image,sx,0,64,128,Math.round(cx-w/2),Math.round(cy-1),w,h);
          ctx.fillStyle='#bcffff';
          const throat=Math.max(1,Math.round(size*.028));
          ctx.fillRect(Math.round(cx-throat/2),Math.round(cy-1),throat,Math.max(1,Math.round(throat/2)));
        }
      }
      ctx.restore();
      return;
    }
    const sprite = sprites[key];
    if (!sprite || !(width > 0 && height > 0) || !sheet.naturalWidth) return;
    if (Object.hasOwn(enemyColumns,key) && enemySheet.naturalWidth === 256 && enemySheet.naturalHeight === 64) {
      const size = Math.min(width,height);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(enemySheet, enemyColumns[key]*64, 0, 64,64,
        Math.round(x-size/2), Math.round(y-size/2), size,size);
      ctx.restore();
      return;
    }
    const [sx, sy, sw, sh] = sprite.rect;
    const scale = Math.min(width / sw, height / sh);
    const w = sw * scale, h = sh * scale;
    const [portX, portY] = sprite.port;
    const phase = 0.5 + 0.5 * Math.sin(frame * 0.3);
    const length=Math.sign(portY)*h*(.10+.07*phase);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = sprite.color;
    for (const side of [-1, 1]) {
      const px = side * w * portX, py = h * portY;
      const halfWidth = Math.max(1, w * 0.024);
      ctx.beginPath();
      ctx.moveTo(px - halfWidth, py);
      ctx.lineTo(px + halfWidth, py);
      ctx.lineTo(px, py + length);
      ctx.closePath();
      ctx.fill();
    }
    ctx.drawImage(sheet, sx, sy, sw, sh, Math.round(-w/2), Math.round(-h/2), w, h);
    ctx.restore();
  }
  window.SpaceArt = Object.freeze({ ready, playerReady, draw });
})();
