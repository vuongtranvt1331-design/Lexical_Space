// Lightweight effect models keep timing independent from the render frame rate.
class SilverSlashEffect {
  static frameAt(elapsed) { const frame=Math.floor(elapsed/55);return frame>=0&&frame<3?frame:-1; }
}
class Projectile {
  constructor(start, target, launchMs=0) { this.start=start;this.target=target;this.launchMs=launchMs; }
  position(elapsed) { const progress=Math.max(0,Math.min(1,(elapsed-this.launchMs)/100));return this.start+(this.target-this.start)*progress; }
}

// Rendering timings shared by the live duel and its combat logic.
class CombatAnimator {
  constructor(ctx) { this.ctx=ctx;this.slash=new Image();this.slash.src='assets/images/silver_slash_vfx.png';this.arrow=new Image();this.arrow.src='assets/images/arrow_projectile.png';this.scroll=new Image();this.scroll.src='assets/images/scroll_projectile.png';this.watermelon=new Image();this.watermelon.src='assets/images/watermelon_projectile.png';this.orange=new Image();this.orange.src='assets/images/orange_projectile.png'; }
  static isRanged(hero) { return ['an','chu','mai','toan'].includes(hero); }
  static hitTimes(hero) { return hero==='vuong'?[360,540,720]:this.isRanged(hero)?[100,350]:[120,370,620]; }
  static hitCount(hero) { return this.hitTimes(hero).length; }
  static impactMs(hero) { return this.hitTimes(hero)[0]; }
  static displacement(hero,t) { if(this.isRanged(hero))return 0;if(hero==='vuong'){if(t<160)return Math.max(0,t/160)*510;if(t<900)return 510;if(t<1150)return 510*(1-(t-900)/250);return 0}if(t<120)return Math.min(1,t/120)*510;if(t<870)return 510;if(t<990)return 510*(1-(t-870)/120);return 0; }
  // Teacher's source faces left except for its right-facing melee attack row.
  static sourceFacesLeft(hero,row) { return hero==='vuong'&&row!==1; }
  static frameFor(hero,row,elapsed,now) {
    if(row===0)return Math.floor(now/166.667)%6;
    if(hero==='vuong'){
      if(row===1){if(elapsed<100)return 0;if(elapsed<200)return 1;if(elapsed<300)return 2;if(elapsed<420)return 3;if(elapsed<510)return 2;if(elapsed<600)return 4;if(elapsed<690)return 2;if(elapsed<780)return 3;return 5}
      return Math.min(5,Math.max(0,Math.floor(elapsed/(row===4?70:row===3?150:60))));
    }
    return Math.min(2,Math.max(0,Math.floor(elapsed/(row===4?160:83.333))));
  }
  drawSlipperHit(x,y,elapsed) { if(elapsed<0||elapsed>=165)return;const c=this.ctx,p=elapsed/165;c.save();c.globalAlpha=1-p;c.strokeStyle='#ffb1cd';c.lineWidth=5;for(let i=0;i<6;i++){const a=i*Math.PI/3,r=14+p*24;c.beginPath();c.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r);c.lineTo(x+Math.cos(a)*(r+12),y+Math.sin(a)*(r+12));c.stroke()}c.restore(); }
  drawSlash(x,y,elapsed) { const frame=SilverSlashEffect.frameAt(elapsed);if(frame<0)return;const c=this.ctx,img=this.slash;if(img.complete&&img.naturalWidth){c.drawImage(img,frame*img.naturalWidth/3,0,img.naturalWidth/3,img.naturalHeight,x-78,y-100,156,156)}else{c.save();c.strokeStyle='#f7ffff';c.lineWidth=11;c.shadowColor='#b8d9e8';c.shadowBlur=15;c.beginPath();c.moveTo(x-55,y+30);c.quadraticCurveTo(x,y-80,x+55,y-80);c.stroke();c.restore()} }
  drawProjectile(x,y,flip,hero='an') {const c=this.ctx;c.save();c.translate(x,y);c.scale(flip?-1:1,1);const img=hero==='chu'?this.scroll:hero==='mai'?this.watermelon:hero==='toan'?this.orange:this.arrow;if(img.complete&&img.naturalWidth){if(hero==='mai'||hero==='toan'){const h=64,w=h*img.naturalWidth/img.naturalHeight;c.drawImage(img,-w/2,-h/2,w,h)}else c.drawImage(img,-60,-22,120,44)}else if(hero==='mai'||hero==='toan'){c.fillStyle=hero==='mai'?'#398f45':'#ef9b24';c.beginPath();c.arc(0,0,19,0,Math.PI*2);c.fill()}else if(hero==='chu'){c.fillStyle='#f4e8c1';c.fillRect(-30,-12,60,24);c.strokeStyle='#8b1e1e';c.lineWidth=4;c.strokeRect(-30,-12,60,24)}else{c.strokeStyle='#ffe06a';c.lineWidth=5;c.beginPath();c.moveTo(-45,0);c.lineTo(45,0);c.lineTo(30,-8);c.moveTo(45,0);c.lineTo(30,8);c.stroke()}c.restore()}
}
