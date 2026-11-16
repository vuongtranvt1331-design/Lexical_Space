/* Boss 5: one host-loop state machine. All times are ms, velocities are px/s.
 * Shared drone artwork helpers remain compatible with Boss 3.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SkyDroneSwarm=api;})(globalThis,function(){
    'use strict';
    const BASE='assets/bosses/military_drone_swarm/',EPS=1e-7;
    const CONFIG=Object.freeze({
        maxHp:160,firstDamage:50,wallDamage:40,convergenceDamage:30,finalDamage:40,
        introMs:7000,cloudCount:30,assemblyFlightMs:1200,cloudRespawnMs:400,
        laserCooldownMs:750,laserTrackMs:500,laserLockMs:750,laserFireMs:500,laserCount:3,laserWidth:8,
        wallRows:15,wallIntervalMs:2000,wallSpeed:160,wallDroneHp:1,redCount:3,
        convergeCooldownMs:1000,convergeDashMs:250,convergeCount:6,returnMs:600,
        vortexIntervalMs:1250,vortexShotMs:1000,vortexSpeed:145,vortexLifeMs:6500,maxVortices:5,
        frameMs:100,shootingScale:.5,victoryMs:1600,explosionMs:400
    });
    const frames=name=>Array.from({length:4},(_,i)=>BASE+name+'/'+name+'_0'+(i+1)+'.png');
    const ART=Object.freeze({vortex:frames('vortex'),line:frames('line'),enraged:frames('enraged'),
        drone:BASE+'projectiles/drone.png',broken:BASE+'projectiles/broken_drone.png',laser:BASE+'projectiles/laser.png',
        explosion:'assets/bosses/sky_fortress/sky_fortress_explosion.png'});
    const assets=Object.freeze([...ART.vortex,...ART.line,...ART.enraged,ART.drone,ART.broken,ART.laser,ART.explosion]);
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
    function drawDrone(ctx,art,x,y,size,age,angle=0){
        const scale=size/64,frame=Math.floor(age/CONFIG.frameMs)%ART.line.length;
        ctx.save();ctx.translate(x,y);ctx.rotate(angle);
        ctx.beginPath();ctx.rect(-size/2,-size/2,size,size);ctx.clip();
        art(ctx,ART.line[frame],96*scale,0,256*scale,64*scale);ctx.restore();
    }
    class SwarmDrone {
        constructor(owner,id,role,x,y,size=28){
            Object.assign(this,{id,role,kind:role==='cloud'?'core':role,ownerBoss:owner.b,x,y,px:x,py:y,
                w:size,h:size,width:size,height:size,hp:1,maxHp:1,active:true,size});
        }
        moveTo(x,y){this.px=this.x;this.py=this.y;this.x=x;this.y=y;this.fortressVisualBox={x,y,w:this.size,h:this.size};}
    }
    class HomingDrone extends SwarmDrone {
        // Kept as the public projectile class; final-phase drones intentionally travel straight down.
        constructor(owner,id,x,y){super(owner,id,'vortex_drone',x,y,24);this.age=0;this.vx=0;this.vy=CONFIG.vortexSpeed;}
        update(dt,context){this.age+=dt;this.moveTo(this.x,this.y+this.vy*dt/1000);if(this.y>context.h+32||this.age>10000)this.active=false;}
    }
    class TacticalDroneSwarm {
        constructor(director,segmentBox){
            this.d=director;this.b=director.boss;this.segmentBox=segmentBox;
            this.age=0;this.stateAge=0;this.state='intro';this.phase=0;this.finished=false;this.serial=0;
            this.events=[];this.cloud=[];this.rows=[];this.vortices=[];this.fx=[];this.aim=[];this.dash=[];
            this.rowsSpawned=0;this.rowsPassed=0;this.wallRewarded=false;this.convergenceLost=0;this.finalLost=0;
            this.finalAttack=null;this.defeatEvent=0;this.b.maxHp=CONFIG.maxHp;this.b.hp=CONFIG.maxHp;this.b.defeatComplete=false;
            this.b.width=220;this.b.height=180;this.updatePose();
            for(let i=0;i<CONFIG.cloudCount;i++){
                // Round-robin entry sides ensure both sides AND the top are represented; positions/times are randomized.
                const {w}=this.d.h.context(),side=i%3,startX=side===0?-35:side===1?w+35:this.random()*w;
                const startY=side===2?-35:190+this.random()*210;
                const drone=new SwarmDrone(this,'cloud-'+i,'cloud',startX,startY,26);
                Object.assign(drone,{index:i,startX,startY,spawnAt:i<3?0:this.random()*4500,respawnAt:0});this.cloud.push(drone);
            }
            this.setState('intro');this.updatePose();
        }
        random(){return clamp((this.d.h.random||Math.random)(),0,1-EPS);}
        record(type,detail={}){const event={type,at:this.age,...detail};this.events.push(event);if(this.events.length>256)this.events.shift();this.d.h.swarmEvent?.(event);}
        get canShoot(){return !this.finished&&this.state!=='victory';}
        get cloudVisible(){return this.state==='intro'||this.phase===1||this.phase===3;}
        setState(state){
            this.state=state;this.stateAge=0;this.b.swarmState=state;
            this.phase=state==='intro'?0:state.startsWith('laser_')?1:state==='wall'?2:state.startsWith('converge_')?3:state==='final'?4:5;
            this.d.phase=state==='intro'?'intro':state==='victory'?'victory':'fight';
            this.record('state',{state});
            if(state==='laser_cooldown')this.aim=[];
            if(state==='laser_track'){this.aim=[];this.trackLasers();}
            if(state==='converge_track'){this.dash=[];this.trackConvergence();}
        }
        clearAttacks(){this.d.shots=[];this.d.warnings=[];this.d.burst=[];this.aim=[];this.dash=[];this.vortices=[];this.fx=[];}
        enterWall(){this.clearAttacks();this.rows=[];this.rowsSpawned=0;this.rowsPassed=0;this.wallRewarded=false;this.setState('wall');this.spawnRow();}
        enterConvergence(){
            if(this.wallRewarded)return;
            this.wallRewarded=true;this.b.hp-=CONFIG.wallDamage;this.b.hitFlash=90;this.record('wall_complete',{damage:CONFIG.wallDamage,rows:this.rowsPassed});
            this.clearAttacks();this.rows=[];this.convergenceLost=0;this.returnStartedAt=this.age;this.setState('converge_track');
        }
        enterFinal(){this.clearAttacks();this.rows=[];this.finalLost=0;this.setState('final');this.nextVortexAt=CONFIG.vortexIntervalMs;this.spawnVortex();}
        updatePose(){
            const {w,h}=this.d.h.context(),cy=Math.max(205,Math.min(285,h*.31));
            this.b.x=w/2;this.b.y=cy;
            if(this.state==='wall')this.b.y=cy-(cy+160)*smooth(this.stateAge/CONFIG.returnMs);
            if(this.phase===3)this.b.y=-160+(cy+160)*smooth((this.age-this.returnStartedAt)/CONFIG.returnMs);
            this.b.fortressVisualBox={x:this.b.x,y:this.b.y,w:220,h:180};
            for(const drone of this.cloud){
                if(!drone.active&&this.age>=drone.respawnAt&&this.state!=='victory'){drone.active=true;drone.hp=1;}
                const a=drone.index*Math.PI*2/CONFIG.cloudCount+.12*Math.sin(this.age/1300),ring=drone.index%3;
                const x=this.b.x+Math.cos(a)*(60+ring*18),y=this.b.y+Math.sin(a)*(45+ring*17);
                const t=this.state==='intro'?smooth((this.age-drone.spawnAt)/CONFIG.assemblyFlightMs):1;
                drone.moveTo(drone.startX+(x-drone.startX)*t,drone.startY+(y-drone.startY)*t);
            }
        }
        cloudTargets(){const {w,h}=this.d.h.context();return this.cloud.filter(t=>t.active&&t.hp>0&&this.age>=t.spawnAt&&t.x>=0&&t.x<=w&&t.y>=0&&t.y<=h);}
        targets(){
            if(!this.canShoot)return [];
            if(this.cloudVisible)return this.cloudTargets();
            if(this.state==='wall')return this.rows.flatMap(row=>row.drones.filter(t=>t.red&&t.active&&t.hp>0&&t.y>=0));
            if(this.state==='final')return [...this.vortices,...this.d.shots].filter(t=>t.active&&t.hp>0);
            return [];
        }
        colliders(){return this.state==='wall'?this.rows.flatMap(row=>row.drones.filter(t=>t.active&&t.y>=-t.h/2)):this.targets();}
        contact(p,t){return this.segmentBox(p.prevX??p.x,p.prevY??p.y,p.x,p.y,t.x,t.y,t.w/2,t.h/2);}
        hit(attack){
            const p=attack?.projectile,t=attack?.target;
            if(!this.canShoot||!attack?.collision||!p?.active||!p.attackId||!attack.token||!t||!this.colliders().includes(t)||!this.contact(p,t)||!this.d.h.validAttack(attack))return false;
            const key=t.role==='cloud'?attack.token:p.attackId;
            if(this.d.seen.has(key)||this.d.seen.has(p.attackId))return false;
            const base=attack.kind==='bomber'?20:attack.kind==='phantom'?30:attack.damage;
            const damage=base*(this.d.h.damageMultiplier?.(this.b,attack)??1);
            if(!Number.isFinite(damage)||damage<=0)return false;
            this.d.seen.add(key);this.d.seen.add(p.attackId);p.active=false;
            // Ordinary wall drones absorb the shot but cannot be damaged or removed.
            if(t.role==='wall'&&!t.red)return false;
            if(t.role==='cloud'){
                const room=this.phase===3?CONFIG.convergenceDamage-this.convergenceLost:CONFIG.firstDamage-(CONFIG.maxHp-this.b.hp);
                if(room<=0)return false; // Intro can reach its gate but never skip the mandatory seven seconds.
                const applied=Math.min(room,damage);this.b.hp-=applied;if(this.phase===3)this.convergenceLost+=applied;
                t.active=false;t.hp=0;t.respawnAt=this.age+CONFIG.cloudRespawnMs;
                this.record('boss_damage',{damage:applied,phase:this.phase,hp:this.b.hp});
            }else{
                t.active=false;t.hp=0;
                if(this.state==='final'){this.b.hp--;this.finalLost++;this.record('boss_damage',{damage:1,phase:4,hp:this.b.hp});}
                else this.record('gap_opened',{row:t.row,column:t.column});
            }
            this.b.hitFlash=90;this.addExplosion(t.x,t.y,22);this.d.h.impact?.(t,attack);
            if(this.phase===1&&this.b.hp===CONFIG.maxHp-CONFIG.firstDamage)this.enterWall();
            else if(this.phase===3&&this.convergenceLost===CONFIG.convergenceDamage)this.enterFinal();
            else if(this.phase===4&&this.finalLost===CONFIG.finalDamage)this.beginDefeat(attack);
            return true;
        }
        processPlayerShots(){
            for(const p of this.d.h.context().bullets||[]){
                if(!p.active)continue;
                const candidates=this.colliders().filter(t=>this.contact(p,t));
                const px=p.prevX??p.x,py=p.prevY??p.y,dx=p.x-px,dy=p.y-py,len=dx*dx+dy*dy;
                const along=t=>len?((t.x-px)*dx+(t.y-py)*dy)/len:Math.hypot(t.x-p.x,t.y-p.y);
                candidates.sort((a,b)=>along(a)-along(b));if(!candidates.length)continue;
                const kind=p.bomberSpecial?'bomber':p.isSpecial?'phantom':'normal',state=this.state;
                this.hit({kind,token:kind==='phantom'?'phantom:'+p.skillGeneration:p.attackId,damage:p.damage,target:candidates[0],projectile:p,collision:true,skinId:p.skinId});
                if(this.finished||this.d.swarm!==this||this.state!==state)return;
            }
        }
        trackLasers(){
            const {player,w,h}=this.d.h.context();
            this.aim=Array.from({length:CONFIG.laserCount},(_,i)=>{
                const x=this.b.x+(i-1)*56,y=this.b.y+32,dx=player.x-x,dy=player.y-y,len=Math.hypot(dx,dy)||1,reach=Math.hypot(w,h)*2;
                return {x,y,targetX:player.x,targetY:player.y,endX:x+dx/len*reach,endY:y+dy/len*reach};
            });
        }
        laserContact(){
            if(this.state!=='laser_fire')return;
            const {player}=this.d.h.context(),hw=(player.hitboxWidth||player.width)/2+CONFIG.laserWidth/2,hh=(player.hitboxHeight||player.height)/2+CONFIG.laserWidth/2;
            if(this.aim.some(a=>this.segmentBox(a.x,a.y,a.endX,a.endY,player.x,player.y,hw,hh)))this.d.h.playerHit?.({x:player.x,y:player.y,kind:'swarm_laser'});
        }
        spawnRow(){
            const {w}=this.d.h.context(),maxWidth=this.d.h.maxPlayerBox?.().width||86;
            const count=clamp(Math.floor(3*w/(maxWidth+24)),6,15),pitch=w/count,size=Math.min(42,pitch*.92);
            const redStart=Math.floor(this.random()*(count-CONFIG.redCount+1)),row={id:++this.rowsSpawned,y:-size,size,drones:[]};
            for(let i=0;i<count;i++){
                const t=new SwarmDrone(this,'wall-'+row.id+'-'+i,'wall',(i+.5)*pitch,row.y,size);
                Object.assign(t,{red:i>=redStart&&i<redStart+CONFIG.redCount,row:row.id,column:i,w:pitch,h:size*.75});row.drones.push(t);
            }
            this.rows.push(row);this.record('wall_row',{row:row.id,redStart,count});
        }
        advanceRows(dt){
            const {h,player}=this.d.h.context();
            for(const row of this.rows){
                row.y+=CONFIG.wallSpeed*dt/1000;
                for(const t of row.drones){
                    t.moveTo(t.x,row.y);if(!t.active)continue;
                    if(this.segmentBox(t.px,t.py,t.x,t.y,player.x,player.y,(player.hitboxWidth||player.width)/2+t.w/2,(player.hitboxHeight||player.height)/2+t.h/2))this.d.h.playerHit?.({x:t.x,y:t.y,kind:'swarm_wall'});
                    if(this.finished||this.d.swarm!==this)return;
                }
            }
            const passed=this.rows.filter(row=>row.y>=h+row.size-EPS);this.rowsPassed+=passed.length;
            this.rows=this.rows.filter(row=>row.y<h+row.size-EPS);
            if(this.rowsSpawned===CONFIG.wallRows&&!this.rows.length)this.enterConvergence();
        }
        trackConvergence(){
            const {player}=this.d.h.context();
            this.aim=Array.from({length:CONFIG.convergeCount},(_,i)=>{
                const a=i*Math.PI*2/CONFIG.convergeCount;
                return {x:this.b.x+Math.cos(a)*92,y:this.b.y+Math.sin(a)*70,targetX:player.x,targetY:player.y};
            });
        }
        launchConvergence(){
            this.dash=this.aim.map((a,i)=>({...a,id:i,currentX:a.x,currentY:a.y}));
            this.setState('converge_dash');this.record('converge_launch',{targets:this.dash.map(t=>({x:t.targetX,y:t.targetY}))});this.d.h.launch?.(this.b);
        }
        explodeConvergence(){
            const {player}=this.d.h.context(),radius=Math.max(player.width,player.height);
            for(const t of this.dash){
                this.addExplosion(t.targetX,t.targetY,radius);
                const dx=Math.max(0,Math.abs(player.x-t.targetX)-(player.hitboxWidth||player.width)/2),dy=Math.max(0,Math.abs(player.y-t.targetY)-(player.hitboxHeight||player.height)/2);
                if(Math.hypot(dx,dy)<=radius)this.d.h.playerHit?.({x:t.targetX,y:t.targetY,kind:'swarm_blast',radius});
                if(this.finished||this.d.swarm!==this)return;
            }
            this.d.h.cinematicExplosion?.(this.b,false);this.record('converge_explode',{count:this.dash.length,radius});this.setState('converge_track');
        }
        spawnVortex(){
            if(this.vortices.length>=CONFIG.maxVortices)return;
            const {w,h}=this.d.h.context(),t=new SwarmDrone(this,'vortex-'+(++this.serial),'vortex',44+this.random()*(w-88),195+this.random()*Math.max(25,h*.48-195),68);
            Object.assign(t,{age:0,nextShot:CONFIG.vortexShotMs});this.vortices.push(t);this.record('vortex_spawn',{id:t.id,x:t.x,y:t.y});
        }
        advanceFinal(dt){
            const context=this.d.h.context();
            const existingShots=[...this.d.shots];
            for(const t of this.vortices){
                t.age+=dt;
                if(t.active&&t.age>=t.nextShot-EPS){
                    for(const dx of [-14,0,14])this.d.shots.push(new HomingDrone(this,'vortex-shot-'+(++this.serial),t.x+dx,t.y+34));
                    t.nextShot+=CONFIG.vortexShotMs;this.d.h.gun?.(t);this.record('vortex_fire',{id:t.id});
                }
                if(t.age>=CONFIG.vortexLifeMs)t.active=false;
            }
            for(const t of existingShots){
                if(!t.active)continue;
                t.update(dt,context);if(!t.active)continue;
                const p=context.player;
                if(this.segmentBox(t.px,t.py,t.x,t.y,p.x,p.y,(p.hitboxWidth||p.width)/2+8,(p.hitboxHeight||p.height)/2+8)){
                    t.active=false;this.d.h.playerHit?.(t);if(this.finished||this.d.swarm!==this)return;
                }
            }
            this.vortices=this.vortices.filter(t=>t.active);this.d.shots=this.d.shots.filter(t=>t.active);
            if(this.stateAge>=this.nextVortexAt-EPS){this.nextVortexAt+=CONFIG.vortexIntervalMs;this.spawnVortex();}
        }
        addExplosion(x,y,radius,life=CONFIG.explosionMs){this.fx.push({x,y,radius,age:0,life});if(this.fx.length>64)this.fx.shift();}
        duration(){return {intro:CONFIG.introMs,laser_cooldown:CONFIG.laserCooldownMs,laser_track:CONFIG.laserTrackMs,laser_lock:CONFIG.laserLockMs,laser_fire:CONFIG.laserFireMs,converge_track:CONFIG.convergeCooldownMs,converge_dash:CONFIG.convergeDashMs,victory:CONFIG.victoryMs}[this.state]??Infinity;}
        nextState(){
            if(this.state==='intro'){if(this.b.hp===CONFIG.maxHp-CONFIG.firstDamage)this.enterWall();else this.setState('laser_cooldown');}
            else if(this.state==='laser_cooldown')this.setState('laser_track');
            else if(this.state==='laser_track'){this.trackLasers();this.setState('laser_lock');this.record('laser_lock',{aim:this.aim.map(a=>({...a}))});}
            else if(this.state==='laser_lock'){this.setState('laser_fire');this.record('laser_fire');this.d.h.gun?.(this.b);this.laserContact();}
            else if(this.state==='laser_fire')this.setState('laser_cooldown');
            else if(this.state==='converge_track'){this.trackConvergence();this.launchConvergence();}
            else if(this.state==='converge_dash')this.explodeConvergence();
            else if(this.state==='victory')this.finish();
        }
        update(dt){
            if(this.finished||this.d.h.context().paused)return;
            this.updatePose();this.processPlayerShots();if(this.finished||this.d.swarm!==this)return;
            let left=Number.isFinite(dt)?Math.max(0,dt):0;
            if(this.state==='laser_track')this.trackLasers();if(this.state==='converge_track')this.trackConvergence();
            if(left<=EPS)this.laserContact();
            while(left>EPS&&!this.finished&&this.d.swarm===this){
                let step=Math.min(left,16,this.duration()-this.stateAge);
                if(this.state==='wall'&&this.rowsSpawned<CONFIG.wallRows)step=Math.min(step,this.rowsSpawned*CONFIG.wallIntervalMs-this.stateAge);
                if(this.state==='wall')for(const row of this.rows)step=Math.min(step,(this.d.h.context().h+row.size-row.y)*1000/CONFIG.wallSpeed);
                if(this.state==='final'){
                    step=Math.min(step,this.nextVortexAt-this.stateAge);
                    for(const t of this.vortices)if(t.active)step=Math.min(step,t.nextShot-t.age,CONFIG.vortexLifeMs-t.age);
                }
                if(this.state==='victory'&&this.defeatEvent<3)step=Math.min(step,[200,500,900][this.defeatEvent]-this.stateAge);
                step=Math.max(0,step);this.age+=step;this.stateAge+=step;this.d.elapsed+=step;this.b.age=this.age;left-=step;
                for(const fx of this.fx)fx.age+=step;this.fx=this.fx.filter(f=>f.age<f.life);
                this.b.hitFlash=Math.max(0,this.b.hitFlash-step);this.updatePose();
                if(this.state==='laser_track')this.trackLasers();
                if(this.state==='wall'){
                    this.advanceRows(step);
                    if(this.state==='wall'&&this.rowsSpawned<CONFIG.wallRows&&this.stateAge>=this.rowsSpawned*CONFIG.wallIntervalMs-EPS)this.spawnRow();
                }else if(this.state==='converge_track')this.trackConvergence();
                else if(this.state==='converge_dash')for(const t of this.dash){const f=clamp(this.stateAge/CONFIG.convergeDashMs,0,1);t.currentX=t.x+(t.targetX-t.x)*f;t.currentY=t.y+(t.targetY-t.y)*f;}
                else if(this.state==='final')this.advanceFinal(step);
                else if(this.state==='victory'&&this.defeatEvent<3&&this.stateAge>=[200,500,900][this.defeatEvent]-EPS){
                    const n=this.defeatEvent++,x=this.b.x+(n===0?-50:n===1?50:0),y=this.b.y+(n===2?0:30);
                    this.addExplosion(x,y,n===2?130:65,700);this.d.h.cinematicExplosion?.({x,y},n===2);this.record('defeat_explosion',{index:n});
                }
                if(this.finished||this.d.swarm!==this)break;
                if(this.stateAge>=this.duration()-EPS)this.nextState();
                else this.laserContact();
            }
        }
        beginDefeat(attack){
            if(this.state==='victory'||this.finished)return;
            this.finalAttack=attack;this.b.hp=0;this.b.active=false;this.clearAttacks();this.rows=[];this.setState('victory');this.defeatEvent=0;
        }
        finish(){
            if(this.finished)return;
            this.b.defeatComplete=true;this.record('defeated');
            if(!this.d.completed.has(this.b.id)){this.d.completed.add(this.b.id);this.d.h.victory?.(this.b,this.d.runId+':boss:'+this.b.id,this.finalAttack);}
            this.abort();this.d.phase='regular';this.d.boss=null;this.d.swarm=null;this.d.h.resume?.();
        }
        abort(){this.finished=true;this.clearAttacks();for(const t of this.cloud)t.active=false;for(const row of this.rows)for(const t of row.drones)t.active=false;this.rows=[];this.cloud=[];}
        draw(ctx,art){
            if(this.finished)return;
            const {w}=this.d.h.context(),frame=Math.floor(this.age/CONFIG.frameMs)%4;
            ctx.save();ctx.imageSmoothingEnabled=false;
            if(this.cloudVisible||this.state==='wall'||this.state==='final'||this.state==='victory'){
                ctx.save();ctx.globalAlpha=this.state==='victory'?clamp(1-this.stateAge/900,0,1):this.state==='final'?.45:1;
                for(const t of this.cloud)if(t.active&&this.age>=t.spawnAt)drawDrone(ctx,art,t.x,t.y,t.size,this.age);
                ctx.restore();
            }
            if(this.state.startsWith('laser_'))for(const a of this.aim){
                ctx.strokeStyle=this.state==='laser_fire'?'#fff4b3':this.state==='laser_lock'?'#ff873b':'#ffe34d';
                ctx.lineWidth=this.state==='laser_fire'?CONFIG.laserWidth:2;ctx.setLineDash(this.state==='laser_fire'?[]:[8,6]);
                ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(a.endX,a.endY);ctx.stroke();ctx.setLineDash([]);
            }
            for(const row of this.rows)for(const t of row.drones)if(t.active){
                drawDrone(ctx,art,t.x,t.y,t.size,this.age);
                if(t.red){const on=Math.floor(this.age/150)%2===0;ctx.fillStyle=on?'rgba(255,35,35,.55)':'rgba(255,35,35,.18)';ctx.fillRect(t.x-t.size*.38,t.y-t.size*.32,t.size*.76,t.size*.64);ctx.strokeStyle=on?'#ff3838':'#a42222';ctx.lineWidth=2;ctx.strokeRect(t.x-t.size*.42,t.y-t.size*.38,t.size*.84,t.size*.76);}
            }
            if(this.state==='converge_track')for(const a of this.aim){
                ctx.strokeStyle='#ffb04d';ctx.lineWidth=1.5;ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(a.targetX,a.targetY);ctx.stroke();ctx.setLineDash([]);
                ctx.beginPath();ctx.arc(a.targetX,a.targetY,18,0,Math.PI*2);ctx.stroke();
            }
            for(const t of this.dash)drawDrone(ctx,art,t.currentX,t.currentY,28,this.age,Math.atan2(t.targetY-t.y,t.targetX-t.x)-Math.PI/2);
            for(const t of this.vortices)art(ctx,ART.vortex[frame],t.x,t.y,t.size,t.size);
            for(const t of this.d.shots)drawDrone(ctx,art,t.x,t.y,t.size,this.age);
            for(const f of this.fx){ctx.save();const t=f.age/f.life;ctx.globalAlpha=1-t;const size=f.radius*2*(.55+.45*smooth(t));art(ctx,ART.explosion,f.x,f.y,size,size);ctx.restore();}
            ctx.fillStyle='#fff0d4';ctx.textAlign='center';
            ctx.font='11px monospace';const labels={intro:'ASSEMBLY — SHOOT THE DRONES',laser_cooldown:'LASER — COOLDOWN',laser_track:'LASER — TRACKING',laser_lock:'LASER — AIM LOCKED',laser_fire:'LASER — DODGE',wall:'WALL '+this.rowsSpawned+'/15 — SHOOT 3 RED DRONES',converge_track:'SWARM — TARGETING',converge_dash:'SWARM — DODGE THE LOCKED STRIKE',final:'VORTEX — '+this.finalLost+'/40',victory:'DRONE SWARM DEFEATED'};
            ctx.fillText(labels[this.state],w/2,176);ctx.restore();
        }
    }
    return {TacticalDroneSwarm,SwarmDrone,HomingDrone,CONFIG,ART,assets,drawDrone};
});
