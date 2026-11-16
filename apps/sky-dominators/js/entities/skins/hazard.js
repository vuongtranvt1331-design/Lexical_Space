/* Hazard: cosmetic Titan body and separately rotating propellers. No combat or ownership writes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SkyHazard=api;})(globalThis,function(){
 'use strict';
 function rotorAngle(time,direction=1){return (Math.floor(Math.max(0,time)*60/1000)%4)*Math.PI/12*direction;}
 // Cosmetic one-pixel sway; never writes player coordinates or collision geometry.
 function visualOffset(time){return [0,1,0,-1][Math.floor(Math.max(0,time)/125)%4];}
 function draw(ctx,player,cfg,image,ready,time){
  if(player.skinId!=='hazard'||cfg.key!=='titan')return false;
  const g=SkySkinCatalog.hazard,body=image(g.body),rotor=image(g.rotorFile);
  if(!ready(body)||!ready(rotor))return false;
  const scale=cfg.height*g.displayHeightRatio/g.size[1];
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(visualOffset(time),0);ctx.scale(scale,scale);ctx.translate(-g.size[0]/2,-g.size[1]/2);
  for(const r of g.rotors){ctx.save();ctx.translate(r.x,r.y);ctx.rotate(rotorAngle(time,r.direction));ctx.drawImage(rotor,-r.diameter/2,-r.diameter/2,r.diameter,r.diameter);ctx.restore();}
  ctx.drawImage(body,0,0,...g.size);ctx.restore();return true;
 }
 async function ensure(image,ready){
  const g=SkySkinCatalog.hazard,paths=[g.body,g.rotorFile,...SkySkinCatalog.animations.filter(a=>a.skin_line==='hazard').flatMap(a=>a.frames)];
  await Promise.all([...new Set(paths)].map(async path=>{const img=image(path);if(!ready(img))await img.decode();if(!ready(img))throw Error('Hazard artwork unavailable. No Coins were spent.');}));
 }
 return {rotorAngle,visualOffset,draw,ensure};
});
