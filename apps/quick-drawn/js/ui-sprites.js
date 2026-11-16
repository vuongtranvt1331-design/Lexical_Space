'use strict';
// Visual resources only: this controller never reads game state or storage.
(()=>{
 const manifest={"version":1,"rendering":"Named integer source rectangles, nine-slice border rendering; no fractional grid arithmetic at runtime.","atlases":{"buttons":{"file":"buttons_gold_spritesheet.png","width":1254,"height":1254,"frames":{"red-normal":{"x":13,"y":104,"width":287,"height":138,"slice":44},"red-hover":{"x":327,"y":104,"width":287,"height":138,"slice":44},"red-pressed":{"x":640,"y":104,"width":287,"height":138,"slice":44},"red-disabled":{"x":954,"y":104,"width":287,"height":138,"slice":44},"navy-normal":{"x":13,"y":418,"width":287,"height":138,"slice":44},"navy-hover":{"x":327,"y":418,"width":287,"height":138,"slice":44},"navy-pressed":{"x":640,"y":418,"width":287,"height":138,"slice":44},"navy-disabled":{"x":954,"y":418,"width":287,"height":138,"slice":44},"card-normal":{"x":14,"y":644,"width":285,"height":281,"slice":72},"card-hover":{"x":328,"y":644,"width":285,"height":281,"slice":72},"card-pressed":{"x":641,"y":644,"width":285,"height":281,"slice":72},"card-disabled":{"x":955,"y":644,"width":285,"height":281,"slice":72},"icon-normal":{"x":81,"y":1026,"width":151,"height":152,"slice":40},"icon-hover":{"x":396,"y":1026,"width":150,"height":152,"slice":40},"icon-pressed":{"x":708,"y":1026,"width":151,"height":152,"slice":40},"icon-disabled":{"x":1022,"y":1026,"width":151,"height":152,"slice":40}}},"leaderboard":{"file":"leaderboard_gold_spritesheet.png","width":1254,"height":1254,"frames":{"board-normal":{"x":44,"y":53,"width":539,"height":523,"slice":170},"board-hover":{"x":672,"y":53,"width":538,"height":523,"slice":170},"board-muted":{"x":44,"y":680,"width":539,"height":523,"slice":170},"board-victory":{"x":672,"y":680,"width":538,"height":523,"slice":170}}}}};
 const scriptURL=document.currentScript?.src||new URL('./js/ui-sprites.js',location.href).href;
 const imageRoot=new URL('../assets/images/ui/',scriptURL);
 const root=document.documentElement;
 function loadAtlas(atlas){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{if(image.naturalWidth!==atlas.width||image.naturalHeight!==atlas.height){reject(new Error('UI atlas dimensions do not match metadata'));return}resolve(image)};image.onerror=()=>reject(new Error('UI atlas unavailable'));image.src=new URL(atlas.file,imageRoot).href})}
 function extract(image,frame){
  const {x,y,width,height}=frame;
  if(![x,y,width,height].every(Number.isInteger)||x<0||y<0||width<1||height<1||x+width>image.naturalWidth||y+height>image.naturalHeight)throw new Error('Invalid UI source rectangle');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');ctx.imageSmoothingEnabled=false;
  ctx.drawImage(image,Math.floor(x),Math.floor(y),width,height,0,0,width,height);return 'url("'+canvas.toDataURL('image/png')+'")';
 }
 const ready=Promise.all(Object.values(manifest.atlases).map(async atlas=>{const image=await loadAtlas(atlas);return Object.entries(atlas.frames).map(([name,frame])=>['--ui-'+name,extract(image,frame)])})).then(groups=>{
  for(const [key,value]of groups.flat())root.style.setProperty(key,value);
  root.classList.add('ui-sprites-ready');root.dataset.uiSprites='ready';return true;
 }).catch(error=>{root.dataset.uiSprites='fallback';console.warn('Gold UI sprites: using existing visual fallback.',error.message);return false});
 window.quickDrawnUISprites=Object.freeze({ready,manifest});
})();
