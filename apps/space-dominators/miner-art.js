/* World-space rendering for the Anchor Miner. Cast data comes from the host snapshot. */
(() => {
  'use strict';
  const W=1280, H=720, TAU=Math.PI*2;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const directions={ArrowLeft:Math.PI,ArrowUp:-Math.PI/2,ArrowRight:0,ArrowDown:Math.PI/2};

  const equipment=new Image();
  equipment.src='./assets/boss-fx/miner-equipment.png';
  function sprite(ctx,index,x,y,size){
    if(!equipment.naturalWidth)return false;
    ctx.drawImage(equipment,index%3*96,Math.floor(index/3)*96,96,96,Math.round(x-size/2),Math.round(y-size/2),size,size);
    return true;
  }
  function rect(ctx,x,y,w,h,color){
    ctx.fillStyle=color;
    ctx.fillRect(Math.round(x),Math.round(y),w,h);
  }

  function orb(ctx,x,y,size,tone){
    ctx.save();
    ctx.translate(Math.round(x),Math.round(y));
    ctx.scale(size/20,size/20);
    rect(ctx,-7,-10,14,20,'#172538');
    rect(ctx,-10,-7,20,14,'#172538');
    rect(ctx,-7,-7,14,14,tone);
    rect(ctx,-4,-6,8,12,'#31465a');
    rect(ctx,-3,-4,6,8,tone);
    rect(ctx,-3,-4,3,3,'#fff6dc');
    ctx.restore();
  }

  function drawMine(ctx,m,time){
    const until=(m.blastY-m.y)/m.speed;
    const armed=until<=.5 && until>=0 && m.age>=.34;
    const tone=armed?'#ff8366':'#e9ae52';
    if(armed){
      ctx.save();
      ctx.translate(m.x,m.blastY);
      ctx.lineWidth=2;
      ctx.setLineDash([4,5]);
      ctx.strokeStyle='#ffc48e';
      for(const angle of m.angles){
        ctx.beginPath();ctx.moveTo(Math.cos(angle)*15,Math.sin(angle)*15);
        ctx.lineTo(Math.cos(angle)*52,Math.sin(angle)*52);ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.beginPath();ctx.arc(0,0,13+4*(1-until/.5),0,TAU);ctx.stroke();
      ctx.restore();
    }
    if(sprite(ctx,armed?1:0,m.x,m.y,32))return;
    orb(ctx,m.x,m.y,23,tone);
    for(const side of [-1,1]){
      rect(ctx,m.x+side*13-2,m.y-2,4,5,tone);
      rect(ctx,m.x-2,m.y+side*13-2,5,4,tone);
    }
    if(armed && Math.sin(time*24)>0)rect(ctx,m.x-3,m.y-3,6,6,'#fffce2');
  }

  function drawGate(ctx,g,time){
    const t=clamp(g.age/.65,0,1);
    if(t<1){
      const x=g.startX+(g.x-g.startX)*t,y=g.startY+(g.y-g.startY)*t;
      const a=Math.atan2(g.y-g.startY,g.x-g.startX);
      for(let i=3;i>0;i--){
        const step=Math.min(i*7,Math.hypot(x-g.startX,y-g.startY));
        rect(ctx,x-step*Math.cos(a)-2,y-step*Math.sin(a)-2,4,4,i===1?'#ffcc7d':'#ae7351');
      }
      sprite(ctx,3,x,y,24)||orb(ctx,x,y,20,'#ffe292');
      return;
    }
    const width=clamp((g.age-.65)/.4,0,1)*W/3;
    const left=g.x-width/2;
    if(width>0 && !window.SpaceBossFX?.strip?.(ctx,4,left,g.y,left+width,g.y,10,time)){
      rect(ctx,left,g.y-5,width,10,'#aa5335');
      rect(ctx,left,g.y-3,width,6,'#ffac55');
      rect(ctx,left,g.y-1,width,2,'#fff0b2');
      ctx.save();
      ctx.beginPath();ctx.rect(left,g.y-5,width,10);ctx.clip();
      for(let x=left-22+(time*40)%22;x<left+width;x+=22){
        rect(ctx,x,g.y-4,3,3,'#dc7941');rect(ctx,x+3,g.y-1,3,3,'#dc7941');
      }
      ctx.restore();
    }
    for(const side of [-1,1])sprite(ctx,3,g.x+side*Math.max(0,width/2-6),g.y,16)||orb(ctx,g.x+side*Math.max(0,width/2-6),g.y,12,'#ffce81');
  }

  function draw(ctx,b,time){
    if(b?.index!==4 || !b.miner)return;
    ctx.save();
    for(const mine of b.miner.mines||[])drawMine(ctx,mine,time);
    for(const gate of b.miner.gates||[])drawGate(ctx,gate,time);
    ctx.restore();
  }

  function arrow(ctx,x,y,key,color,scale){
    const angle=directions[key];if(angle===undefined)return;
    ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(angle);ctx.scale(scale,scale);
    rect(ctx,-6,-1,8,3,color);
    for(let i=0;i<4;i++)rect(ctx,i,-4+i,2,9-i*2,color);
    ctx.restore();
  }

  function ropes(ctx,b,p,t){
    const pulse=Math.sin(t*9)*2;
    for(const i of [-2,-1,1,2]){
      const sign=Math.sign(i),mountX=b.x+i*21,mountY=b.y+34;
      const endX=p.x+sign*(Math.abs(i)===1?9:18),endY=p.y+(Math.abs(i)===1?-13:6);
      const midX=(mountX+endX)/2+sign*(8+pulse)*Math.abs(i),midY=(mountY+endY)/2+13;
      let px=mountX,py=mountY,painted=false;
      for(let n=1;n<=8;n++){
        const u=n/8,v=1-u;
        const nx=v*v*mountX+2*u*v*midX+u*u*endX,ny=v*v*mountY+2*u*v*midY+u*u*endY;
        painted=window.SpaceBossFX?.strip?.(ctx,5,px,py,nx,ny,5,t);
        if(!painted)break;
        px=nx;py=ny;
      }
      if(!painted){
        ctx.beginPath();ctx.moveTo(mountX,mountY);ctx.quadraticCurveTo(midX,midY,endX,endY);
        ctx.strokeStyle='#e3a756';ctx.lineWidth=3;ctx.stroke();
      }
      ctx.setLineDash([]);sprite(ctx,4,endX,endY,15)||orb(ctx,endX,endY,7,'#ffd68a');
    }
  }

  function drawPrompt(ctx,b,pilots){
    const tether=b?.miner?.tether,p=tether && pilots?.[tether.seat];
    if(!p || p.hp<=0 || !Array.isArray(tether.sequence))return;
    const next=tether.sequence[tether.index],angle=directions[next];
    if(angle===undefined)return;
    ctx.save();ropes(ctx,b,p,b.clock||0);
    const dx=Math.cos(angle),dy=Math.sin(angle);
    const x=clamp(p.x+dx*50,16,W-16), y=clamp(p.y+dy*52,16,H-16);
    rect(ctx,x-13,y-13,26,26,'#ffe39e');rect(ctx,x-11,y-11,22,22,'#382d36');
    arrow(ctx,x,y,next,'#ffdc76',1.65);
    const count=tether.sequence.length, width=count*23+4;
    const left=clamp(p.x-width/2,6,W-width-6);
    const top=p.y>H-110 || dy>0 ? p.y-91 : p.y+66;
    const cy=clamp(top+12,14,H-24);
    for(let i=0;i<count;i++){
      const cx=left+14+i*23;
      const frame=i<tether.index?'#8ccbb0':i===tether.index?'#ffe19a':'#8d95a9';
      rect(ctx,cx-10,cy-10,21,21,frame);rect(ctx,cx-8,cy-8,17,17,'#202531');
      arrow(ctx,cx,cy,tether.sequence[i],frame,1.2);
    }
    const fraction=clamp(tether.remaining/(tether.duration ?? 3),0,1);
    rect(ctx,left+3,cy+13,width-6,6,'#181e2b');
    rect(ctx,left+4,cy+14,Math.round((width-8)*fraction),4,fraction>1/3?'#ffcf78':'#ff7a6a');
    ctx.restore();
  }

  window.SpaceMinerArt=Object.freeze({draw,drawPrompt,sprite});
})();
