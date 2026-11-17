/* js/systems/boss-integration.js — ordered classic script; entrypoints declare dependency order. */
let suspendedBossRows = [];

const bossRewardClaims = new Set();
const bossHealthPanel = document.getElementById('bossHealthHud');
const bossHealthName = document.getElementById('bossHealthName');
const bossHealthMeter = document.getElementById('bossHealthMeter');
const bossHealthValue = document.getElementById('bossHealthValue');
const bossHealthPhase = document.getElementById('bossHealthPhase');
const bossNames = ['','BOSS 1','BOSS 2','SKY FORTRESS','CONTINENTAL BOMBER','DRONE SWARM','TITANUS VERONICA'];

function updateBossHealthHUD() {
    const boss = bossEncounter.boss;
    if (!boss) {
        if (!bossHealthPanel.hidden) bossHealthPanel.hidden = true;
        return;
    }
    const name = bossNames[boss.id] || 'BOSS ' + boss.id;
    const armored = boss.titanusState === SkyTitanus.PHASE.ARMORED;
    const max = armored ? boss.maxArmor : boss.maxHp;
    const hp = Math.min(max, Math.max(0, armored ? boss.armor : boss.hp));
    const value = Math.ceil(hp) + '/' + max;
    const phase = bossEncounter.titanus?.healthLabel || '';
    if (bossHealthName.textContent !== name) {
        bossHealthName.textContent = bossHealthName.title = name;
    }
    if (bossHealthMeter.max !== max) bossHealthMeter.max = max;
    if (bossHealthMeter.value !== hp) bossHealthMeter.value = hp;
    const opacity = (.6 + .4 * (1 - hp / Math.max(1, max))).toFixed(2);
    if (bossHealthPanel.dataset.intensity !== opacity) {
        bossHealthPanel.style.opacity = opacity;
        bossHealthPanel.dataset.intensity = opacity;
    }
    if (bossHealthValue.textContent !== value) bossHealthValue.textContent = value;
    if (bossHealthPhase.textContent !== phase) bossHealthPhase.textContent = phase;
    if (bossHealthPhase.hidden !== !phase) bossHealthPhase.hidden = !phase;
    const meterLabel = name + (armored ? ' armor' : ' health');
    if (bossHealthMeter.getAttribute('aria-label') !== meterLabel) bossHealthMeter.setAttribute('aria-label', meterLabel);
    if (bossHealthPanel.dataset.armor !== String(armored)) bossHealthPanel.dataset.armor = armored;
    if (bossHealthPanel.hidden) bossHealthPanel.hidden = false;
}

function claimBossVictory(boss, encounterId, attack = null) {
    if (boss.hp !== 0 || ([3,5,6].includes(boss.id)&&!boss.defeatComplete) || bossRewardClaims.has(encounterId)) return false;
    let saved = [];
    try { saved = JSON.parse(sessionStorage.getItem('sky.boss.victoryClaims') || '[]'); } catch {}
    if (!Array.isArray(saved)) saved = [];
    if (saved.includes(encounterId)) { bossRewardClaims.add(encounterId); return false; }
    bossRewardClaims.add(encounterId);
    try { sessionStorage.setItem('sky.boss.victoryClaims', JSON.stringify([...saved,encounterId].slice(-32))); } catch {}
    score = Math.min(999999, score + boss.reward);
    updateLeftHUD();
    if(![3,4,5,6].includes(boss.id))triggerCinematicExplosion(boss.x,boss.y,true,SkySkins.eliminationSkin(attack?.projectile));
    return true;
}

bossEncounter = new SkyBosses.Director({
    context:()=>({w:GAME_WIDTH,h:GAME_HEIGHT,player,bullets,enemyBulletSpeed:STANDARD_ENEMY_BULLET_SPEED,paused:isPaused||gameState!=='PLAYING'}),
    layout:(includeBossHud=false)=>{
        const field=canvas.getBoundingClientRect(),hud=document.getElementById('leftHUDContainer').getBoundingClientRect();
        if(!field.height)return {};
        const unitsPerPixel=GAME_HEIGHT/field.height;
        const controls=['inGameSkillBtn'].map(id=>document.getElementById(id).getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
        const layout={unitsPerPixel,safeTop:flightInsets.top,hudBottom:(hud.bottom-field.top)*unitsPerPixel,controlsTop:controls.length?(Math.min(...controls.map(r=>r.top))-field.top)*unitsPerPixel:GAME_HEIGHT-100};
        if(includeBossHud){
            const top=(bossHealthPanel.hidden ? document.getElementById('inGamePauseBtn') : bossHealthPanel).getBoundingClientRect();
            layout.bossHudBottom=(top.bottom-field.top)*unitsPerPixel;
        }
        return layout;
    },
    maxPlayerBox:()=>({width:Math.max(...AIRCRAFT_CONFIGS.map(c=>c.width*1.3)),height:Math.max(...AIRCRAFT_CONFIGS.map(c=>c.height*1.3))}),
    suspend:cfg=>{
        bomberHazard.endRound();
        if(cfg.id===4)bomberHazard.notify(currentSortieId+":boss:4",destroyedRowsCount+1,bossEncounter.boss);
        suspendedBossRows = formations.filter(f=>!f.destroyed);
        formations=[];bullets=[];enemyBullets=[];player.lockedTarget=null;
        document.getElementById('dangerHUDContainer').style.visibility='hidden';
    },
    resume:()=>{
        // Bosses interrupt after each ten actually cleared rows; do not add a synthetic clear.
        // Keep the actual cleared-row count unchanged on boss completion.
        formations=suspendedBossRows.filter(f=>!f.destroyed);suspendedBossRows=[];
        document.getElementById('dangerHUDContainer').style.visibility='';
        advanceToNextMission();
    },
    validAttack:a=>gameState==='PLAYING'&&!isPaused&&a.projectile?.active&&
        (a.kind!=='phantom'||(player.aircraftIndex===4&&player.squadronActive&&player.squadronTimer>0&&a.projectile.skillGeneration===player.squadronGeneration)),
    // Evaluate the mark at impact; in-flight shots never retain an expired damage bonus.
    damageMultiplier:(b,a)=>a.kind==='normal'&&SkySkins.isWraithAttack(a.projectile)&&
        player.aircraftIndex===0&&player.skinId==='red_wraith'&&player.skillActiveTimer>0&&
        (player.lockedTarget===b||(player.lockedTarget?.kind==='core'&&player.lockedTarget.ownerBoss===b))&&b.active&&b.hp>0?2:1,
    impact:(b,a)=>{SkyExalted.onHit(player,b,a.projectile);SkySkins.impact(a.skinId,a.skinId==='skyborne'&&a.projectile?a.projectile.x:b.x,a.skinId==='skyborne'&&a.projectile?a.projectile.y:b.y);},
    // Completion reward is separate from death: preserve the bomber HP and artwork.
    encounterComplete:(boss,id)=>{
        if(!boss.encounterComplete||bossRewardClaims.has(id))return;
        bossRewardClaims.add(id);score=Math.min(999999,score+20000);
        bomberHazard.endRound();updateLeftHUD();
    },
    victory:claimBossVictory,
    escortReward:points=>{
        score=Math.min(999999,score+points);
        updateLeftHUD();
    },
    titanusImpact:(shake,flash)=>{
        screenShake=Math.max(screenShake,shake);
        ambientFlash=Math.max(ambientFlash,flash);
    },
    armorLock:()=>audio.playArmorLock(),
    titanusWarning:()=>audio.playWarning(),
    localExplosion:(target,a,big=false)=>triggerCinematicExplosion(target.x,target.y,big,SkySkins.eliminationSkin(a?.projectile)),
    cinematicExplosion:(position,big)=>{try{audio.playExplosion(big);}catch{}},
    launch:()=>{try{audio.playRocketLaunch();}catch{}},
    gun:()=>{try{audio.playBulletShoot();}catch{}},
    playerHit:p=>{
        if (player.invulnerableTimer>0) return;
        player.takeDamage('BOSS_PROJECTILE',p.x,p.y);player.invulnerableTimer=1200;
        if(player.hp<=0&&gameState!=='GAMEOVER'){triggerCinematicExplosion(player.x,player.y,true,['celestial','hazard'].includes(player.skinId)?player.skinId:null);endGame();}
    }
});

const bomberHazard=new SkyContinental.SpawnHazard({validSource:source=>gameState==='PLAYING'&&player.hp>0&&!!source&&(source===bossEncounter.boss?source.active&&source.hp>0:!source.destroyed&&formations.includes(source)&&source.aircraft.some(a=>a.active&&a.hp>0)),context:()=>({w:GAME_WIDTH,h:GAME_HEIGHT,player}),hit:p=>bossEncounter.h.playerHit(p)});

for(const path of SkyContinental.assets)SkySkins.image(path);

for(const path of SkyDroneSwarm.assets)SkySkins.image(path);

for(const path of SkyFortress.assets)SkySkins.image(path);

for(const path of ['assets/bosses/boss1/body.png','assets/bosses/boss1/rotor.png','assets/bosses/boss1/launcher.png','assets/bosses/boss1/missile.png',
    'assets/bosses/boss2/body/boss01_body.png','assets/bosses/boss2/missile_launcher/boss01_missile_launcher.png',
    'assets/bosses/boss2/turrets/left/boss01_turret_left.png','assets/bosses/boss2/turrets/right/boss01_turret_right.png',
    'assets/bosses/boss2/projectiles/boss01_gun_projectile.png'])SkySkins.image(path);

for(let rotor=1;rotor<=4;rotor++)for(let frame=1;frame<=4;frame++)SkySkins.image('assets/bosses/boss2/rotors/rotor_'+rotor+'/boss01_rotor_'+rotor+'_frame_0'+frame+'.png');
