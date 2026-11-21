/* Shared boss-6 fleet geometry and boss-5 foreshadowing, driven by simulation time. */
(() => {
  'use strict';
  const COAST_SECONDS=3;
  const carriers=Object.freeze([
    Object.freeze({offset:-308,y:235,height:210,at:3,coast:72}),
    Object.freeze({offset:0,y:330,height:580,at:3.25,coast:40}),
    Object.freeze({offset:308,y:285,height:210,at:3.5,coast:54})
  ]);
  const duration=carriers[carriers.length-1].at+COAST_SECONDS;
  const hull=new Image();
  function load(image,file){
    return new Promise(resolve=>{
      image.onload=()=>resolve(true);image.onerror=()=>resolve(false);
      image.src=new URL(file,document.currentScript.src).href;
    });
  }
  const ready=Promise.all([load(hull,'./assets/star-destroyer.png')]);
  function pose(index,time){
    const c=carriers[index],age=time-c.at;
    const progress=Math.max(0,Math.min(1,age/COAST_SECONDS));
    const remaining=(1-progress)**3;
    return {visible:age>=0,age,x:640+c.offset,y:c.y-c.coast*remaining,
      height:c.height,stretch:1+Math.max(0,1-age/.16)*2.5};
  }
  function draw(ctx,time){
    if(!hull.naturalWidth)return;
    for(let i=0;i<carriers.length;i++){
      const p=pose(i,time);
      if(!p.visible)continue;
      const width=p.height*hull.naturalWidth/hull.naturalHeight;
      ctx.save();ctx.imageSmoothingEnabled=false;
      ctx.translate(p.x,p.y);ctx.rotate(Math.PI);ctx.scale(1,p.stretch);
      ctx.drawImage(hull,-width/2,-p.height/2,width,p.height);
      ctx.restore();
      if(p.age<.28){
        const flash=1-p.age/.28;
        ctx.save();ctx.globalAlpha=flash*.8;
        ctx.fillStyle='#ddfaff';
        ctx.fillRect(p.x-width*.7,p.y-2,width*1.4,4);
        ctx.restore();
      }
    }
  }
  let animation=0,finish=null;
  function stop(){
    cancelAnimationFrame(animation);animation=0;
    window.SpaceSound?.stopIntro?.(0);
    const done=finish;finish=null;done?.();
  }
  async function start(canvas,onFinish){
    stop();
    if(!(await ready).every(Boolean))return false;
    await window.SpaceSound?.prepareIntro?.();
    window.SpaceSound?.silence?.();
    finish=onFinish;
    let began=null,previous=-1;
    const ctx=canvas.getContext('2d');
    function frame(now){
      began??=now;
      const time=(now-began)/1000;
      window.SpaceBackdrop.draw(ctx,time);
      for(const [index,carrier] of carriers.entries()){
        if(previous<carrier.at && time>=carrier.at)window.SpaceSound?.fleetJump?.(index);
      }
      previous=time;draw(ctx,time);
      if(time>=duration){stop();return;}
      animation=requestAnimationFrame(frame);
    }
    animation=requestAnimationFrame(frame);
    return true;
  }
  window.addEventListener('pagehide',stop);
  window.SpaceFleetArrival=Object.freeze({carriers,pose,draw,ready,start,stop,duration});
})();
