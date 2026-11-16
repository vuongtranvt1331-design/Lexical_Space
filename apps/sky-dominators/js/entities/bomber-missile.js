/* js/entities/bomber-missile.js — ordered classic script; entrypoints declare dependency order. */
class BomberMissile extends Bullet {
    constructor(row, target) {
        super(player.x,player.y-30);
        this.bomberSpecial=true;this.isHoming=false;this.row=row;this.age=0;
        const dx=target.x-this.x,dy=target.y-this.y,len=Math.hypot(dx,dy)||1;
        this.vx=dx/len*410;this.vy=dy/len*410;
    }
    update(dt) {
        this.prevX=this.x;this.prevY=this.y;this.age+=dt;
        this.x+=this.vx*dt/1000;this.y+=this.vy*dt/1000;
        if(this.age>6000||this.y<-50||this.y>GAME_HEIGHT+50||this.x<-50||this.x>GAME_WIDTH+50)this.active=false;
        if(!this.row||!this.active)return;
        if(this.row.destroyed||bossEncounter.blocksRegular){this.active=false;return;}
        if(SkyBosses.segmentBox(this.prevX,this.prevY,this.x,this.y,GAME_WIDTH/2,this.row.y,GAME_WIDTH/2,30)){
            this.active=false;clearBomberRow(this.row,this.skinId);
        }
    }
    draw(ctx) {
        ctx.save();ctx.translate(this.x,this.y);ctx.rotate(Math.atan2(this.vy,this.vx)+Math.PI/2);
        SkySkins.drawBomberMissile(ctx,this);ctx.restore();
    }
}

function clearBomberRow(row,skinId) {
    if(bossEncounter.blocksRegular||!row||row.destroyed||!formations.includes(row)||!row.aircraft.some(a=>a.active))return false;
    const front=getActiveFormationRows()[0];if(front!==row)return false;
    row.destroyed=true;
    for(const enemy of row.aircraft)if(enemy.active){enemy.active=false;enemy.hp=0;const deathImpact=triggerEnemyDestruction(enemy,true,{skinId},skinId==='money_printer'?skinId:null);if(!deathImpact)SkySkins.impact(skinId,enemy.x,enemy.y);}
    targetsCleared++;score=Math.min(999999,score+500);
    onHelicopterRowDestroyed(row);advanceToNextMission();updateLeftHUD();return true;
}

function launchBomberStrike() {
    if(gameState!=='PLAYING'||isPaused||player.hp<=0||AIRCRAFT_CONFIGS[player.aircraftIndex].key!=='bomber'||player.skillCooldownTimer>0||!bossEncounter.canShoot||isDestinationTraveling())return false;
    const bossTargeting=bossEncounter.blocksRegular&&bossEncounter.canShoot;
    const row=bossTargeting?null:getActiveFormationRows()[0];
    if(!row&&!bossEncounter.boss)return false;
    const target=bossTargeting?(bossEncounter.priorityTarget()||bossEncounter.boss):{x:GAME_WIDTH/2,y:row.y};
    player.skillCooldownTimer=30000;const missile=new BomberMissile(row,target);bullets.push(missile);
    SkySkins.emitBomberLaunch(missile,player);
    try{audio.playShoot();if(player.skinId==='king_ghidorah')audio.playGhidorahRoar();}catch{}updateSkillButtonUI();return true;
}
