(() => {
  "use strict";

  const atlas = new Image();
  const ready = new Promise(resolve => {
    atlas.onload = () => resolve(true);
    atlas.onerror = () => resolve(false);
  });
  atlas.src = new URL("./assets/campaign-atlas.png", document.currentScript.src).href;

  function draw(ctx, index, x, y, width, height = width) {
    const side = atlas.naturalWidth;
    if (!atlas.complete || !side || side !== atlas.naturalHeight || side % 4 !== 0 ||
        !Number.isInteger(index) || index < 0 || index >= 16 || width <= 0 || height <= 0) {
      return false;
    }
    const size = side / 4;
    const sourceX = (index % 4) * size;
    const sourceY = Math.floor(index / 4) * size;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(atlas, sourceX, sourceY, size, size, x - width / 2, y - height / 2, width, height);
    ctx.restore();
    return true;
  }

  // The review artwork depicts both crescent ships together in slot 4.
  // Sample one crescent per actor in combat and the full pair in the Lab.
  function drawTwin(ctx,index,x,y,size) {
    if(!atlas.naturalWidth || !atlas.complete)return false;
    const cell=atlas.naturalWidth/4;
    const half=cell/2;
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(atlas,index*half,cell,half,cell,x-size*.35,y-size*.7,size*.7,size*1.4);
    ctx.restore();
    return true;
  }
  window.SpaceCampaignSprites = Object.freeze({draw,drawTwin,ready});
})();
