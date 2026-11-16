/* Individual PNGs: 40 columns x 3 rows, fixed 128x128 cells with >=16px padding.
 * Row 0: idle (40 frames / 2800ms); rows 1/2: shoot/hit (8 frames / 500ms).
 * All source sprites face right. CSS mirrors only the enemy canvas container.
 */
class CowboyAnimator {
  static ANIMATIONS = Object.freeze({
    idle: Object.freeze({ row: 0, frames: 40, duration: 2800, loop: true }),
    shoot: Object.freeze({ row: 1, frames: 8, duration: 500, loop: false }),
    hit: Object.freeze({ row: 2, frames: 8, duration: 500, loop: false })
  });

  constructor(canvasElement, isPlayer = true) {
    if (!canvasElement) throw new Error('Missing character canvas');
    this.canvas = canvasElement;
    this.canvas.width = this.canvas.height = 128;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.spriteSheet = new Image();
    this.isLoaded = false;
    this.isPlayer = isPlayer;
    this.frameWidth = this.frameHeight = 128;
    this.currentAnim = 'idle';
    this.currentFrame = 0;
    this.totalFrames = 40;
    this.animStartTime = performance.now();
    this.animDuration = 2800;
    this.isLooping = true;
    this.rafId = null;
    this.lastDrawn = '';
  }

  load(src) {
    return new Promise((resolve, reject) => {
      this.spriteSheet.onload = () => {
        if (this.spriteSheet.naturalWidth !== 40 * this.frameWidth ||
            this.spriteSheet.naturalHeight !== 3 * this.frameHeight) {
          reject(new Error('Cowboy atlas must be 5120x384 pixels'));
          return;
        }
        this.canvas.setAttribute('data-sprite-src', src);
        this.isLoaded = true;
        resolve();
      };
      this.spriteSheet.onerror = () => reject(new Error('Could not load cowboy sprite: ' + src));
      this.spriteSheet.src = src;
    });
  }

  setAnimation(animName, startedAt = performance.now()) {
    if (!Object.hasOwn(CowboyAnimator.ANIMATIONS, animName)) throw new Error('Unknown cowboy animation');
    const animation = CowboyAnimator.ANIMATIONS[animName];
    this.currentAnim = animName;
    this.currentFrame = 0;
    this.animStartTime = startedAt;
    this.totalFrames = animation.frames;
    this.animDuration = animation.duration;
    this.isLooping = animation.loop;
    this.lastDrawn = '';
    this.canvas.setAttribute('data-animation', animName);
    this.start();
  }

  start() {
    this.stop();
    // The load caller starts rendering on success; no endless RAF loop on a missing image.
    if (!this.isLoaded) return;
    const render = now => {
      const elapsed = Math.max(0, now - this.animStartTime);
      const position = this.isLooping ? elapsed % this.animDuration : Math.min(elapsed, this.animDuration);
      this.currentFrame = Math.min(this.totalFrames - 1,
        Math.floor(position / (this.animDuration / this.totalFrames)));
      this.draw();
      if (this.isLooping || elapsed < this.animDuration) this.rafId = requestAnimationFrame(render);
      else this.rafId = null; // Hold the last bitmap until a new animation is selected.
    };
    render(performance.now());
  }

  stop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  draw() {
    if (!this.isLoaded) return;
    const key = this.currentAnim + ':' + this.currentFrame;
    if (key === this.lastDrawn) return;
    const rowIndex = CowboyAnimator.ANIMATIONS[this.currentAnim].row;
    const frame = Math.max(0, Math.min(this.totalFrames - 1, Math.floor(this.currentFrame)));
    const sx = Math.floor(frame * this.frameWidth);
    const sy = Math.floor(rowIndex * this.frameHeight);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.spriteSheet, sx, sy, this.frameWidth, this.frameHeight,
      0, 0, this.canvas.width, this.canvas.height);
    this.lastDrawn = key;
    this.canvas.setAttribute('data-frame', String(this.currentFrame));
  }
}

// Keep the existing game's setState API: all scoring, question and timeout code stays intact.
class SpriteAnimator {
  constructor(stage, playerAnimator, enemyAnimator) {
    if (!playerAnimator || !enemyAnimator || playerAnimator.canvas === enemyAnimator.canvas) {
      throw new Error('The duel requires two independent character canvases');
    }
    this.stage = stage;
    this.state = 'state-idle';
    this.playerAnimator = playerAnimator;
    this.enemyAnimator = enemyAnimator;
    this.setState('state-idle');
  }

  get ready() { return this.playerAnimator.isLoaded && this.enemyAnimator.isLoaded; }

  get frame() { return this.playerAnimator.currentFrame; }

  setState(nextState) {
    const states = {
      'state-idle': ['idle', 'idle', 'Two cowboys facing off in the desert'],
      'state-player-win': ['shoot', 'hit', 'Player fires; enemy falls over'],
      'state-enemy-win': ['hit', 'shoot', 'Enemy fires; player falls over']
    };
    if (!Object.hasOwn(states, nextState)) throw new Error('Unknown duel state');
    const [player, enemy, description] = states[nextState];
    const startedAt = performance.now(); // Both canvases use the same clock origin.
    this.state = nextState;
    this.stage.className = 'duel-stage ' + nextState;
    this.stage.setAttribute('aria-label', description);
    this.playerAnimator.setAnimation(player, startedAt);
    this.enemyAnimator.setAnimation(enemy, startedAt);
  }
}

function triggerPlayerWinState() { duelAnimator.setState('state-player-win'); }
function triggerEnemyWinState() { duelAnimator.setState('state-enemy-win'); }

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
