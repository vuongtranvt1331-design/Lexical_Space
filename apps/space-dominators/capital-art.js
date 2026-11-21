(() => {
  'use strict';
  const [hull,turret]=['capital-hull','capital-turret'].map(name=>{
    const image=new Image();
    image.src='./assets/'+name+'.png';
    return image;
  });
  let dock;
  function loadDock(){
    if(!dock){dock=new Image();dock.src='./assets/inspecting-dock.png';}
    return dock;
  }
  function drawDock(ctx,x,y){
    const image=loadDock();
    if(!image.naturalWidth)return;
    ctx.save();ctx.imageSmoothingEnabled=false;
    ctx.drawImage(image,Math.round(x-224),Math.round(y-92),448,184);
    ctx.restore();
  }
  function drawHull(ctx,x,y,w,h){
    if(!hull.naturalWidth)return;
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(hull,Math.round(x-w/2),Math.round(y-h/2),w,h);
    ctx.restore();
  }
  function drawTurret(ctx,x,y,size,angle,dead){
    ctx.save();
    ctx.translate(Math.round(x),Math.round(y));
    if(dead){
      ctx.fillStyle='#111824';
      ctx.beginPath();ctx.ellipse(0,0,size*.27,size*.2,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#be6241';ctx.fillRect(-size*.12,-2,4,2);ctx.fillRect(2,1,3,2);
    }else if(turret.naturalWidth){
      ctx.rotate(angle);
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(turret,-size*14/33,-size/2,size,size);
    }
    ctx.restore();
  }
  window.CapitalArt=Object.freeze({drawHull,drawTurret,loadDock,drawDock});
})();
