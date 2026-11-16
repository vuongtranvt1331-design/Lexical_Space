'use strict';
// Sprite/fullscreen presentation only: no game, identity, vocabulary or standings writes.
(()=>{
 const screen=document.querySelector('[data-chess-screen]');if(!screen)return;
 const button=screen.querySelector('[data-spectate-fullscreen]'),label=screen.querySelector('[data-spectate-fullscreen-label]');
 const base=new URL('../assets/images/ui/spectator/',document.currentScript?.src||new URL('./js/chess-spectator-ui.js',location.href));
 const ready=(async()=>{
  try{
   const response=await fetch(new URL('spectator_ui_sprites.json',base));if(!response.ok)throw Error('Spectator manifest unavailable');const manifest=await response.json(),sheet=new Image();
   await new Promise((resolve,reject)=>{sheet.onload=resolve;sheet.onerror=reject;sheet.src=new URL(manifest.file,base)});
   if(sheet.naturalWidth!==manifest.width||sheet.naturalHeight!==manifest.height)throw Error('Spectator atlas dimensions');
   const names=['turn-ribbon','clock-frame','capture-tray','live-pill','fullscreen-expand','fullscreen-collapse','side-black','side-white'];if(!manifest.frames||!names.every(name=>manifest.frames[name]))throw Error('Spectator frames incomplete');
   const frames=[];for(const name of names){const frame=manifest.frames[name];
    const {x,y,width,height}=frame;if(![x,y,width,height].every(Number.isInteger)||x<0||y<0||width<1||height<1||x+width>sheet.naturalWidth||y+height>sheet.naturalHeight)throw Error('Spectator frame bounds');
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas unavailable');ctx.imageSmoothingEnabled=false;ctx.drawImage(sheet,Math.floor(x),Math.floor(y),width,height,0,0,width,height);frames.push(['--spectate-'+name,'url("'+canvas.toDataURL('image/png')+'")']);
   }
   for(const [name,value]of frames)screen.style.setProperty(name,value);screen.classList.add('chess-spectator-sprites-ready');return true;
  }catch(error){console.warn('Spectator sprites: using readable visual fallback.',error.message);return false}
 })();
 if(button){
  button.disabled=typeof screen.requestFullscreen!=='function'||!document.fullscreenEnabled;
  const sync=()=>{const expanded=document.fullscreenElement===screen;button.setAttribute('aria-pressed',String(expanded));button.setAttribute('aria-label',expanded?'Thu nhỏ Quan Chiến':'Toàn màn hình');label.textContent=expanded?'Thu nhỏ':'Toàn màn hình'};
  button.onclick=async()=>{try{if(document.fullscreenElement===screen)await document.exitFullscreen();else await screen.requestFullscreen()}catch(_){button.title='Trình duyệt chưa cho phép toàn màn hình.'}sync()};document.addEventListener('fullscreenchange',sync);
  if(typeof MutationObserver!=='undefined')new MutationObserver(()=>{if(screen.hidden&&document.fullscreenElement===screen)document.exitFullscreen().catch(()=>{})}).observe(screen,{attributes:true,attributeFilter:['hidden']});sync();
 }
 window.quickDrawnSpectatorSprites=Object.freeze({ready});
})();
