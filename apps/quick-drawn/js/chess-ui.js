'use strict';
// Icon artwork only; no game state, storage or protocol access.
(()=>{
 const screen=document.querySelector('[data-chess-screen]');if(!screen)return;
 const base=new URL('../assets/images/chess/',document.currentScript?.src||new URL('./js/chess-ui.js',location.href));
 (async()=>{
  try{
   const response=await fetch(new URL('chess_actions.json',base));if(!response.ok)throw Error('Icon manifest unavailable');const manifest=await response.json(),image=new Image();
   await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=new URL(manifest.file,base)});
   if(image.naturalWidth!==manifest.width||image.naturalHeight!==manifest.height)throw Error('Icon atlas dimensions');
   const faces=[];for(const [name,rect]of Object.entries(manifest.frames)){
    const [x,y,w,h]=rect;if(!rect.every(Number.isInteger)||x<0||y<0||w<1||h<1||x+w>image.naturalWidth||y+h>image.naturalHeight)throw Error('Icon crop bounds');
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas unavailable');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,Math.floor(x),Math.floor(y),w,h,0,0,w,h);faces.push([name,'url("'+canvas.toDataURL('image/png')+'")']);
   }
   for(const [name,face]of faces){const icon=screen.querySelector('[data-chess-icon="'+name+'"]');if(icon)icon.style.backgroundImage=face}
   screen.classList.add('chess-action-icons-ready');
  }catch(error){console.warn('Chess actions: using labelled fallback icons.',error.message)}
 })();
})();
