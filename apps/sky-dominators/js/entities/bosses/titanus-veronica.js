/* Boss 6 runs on the director's clock. Durations are ms and velocities are px/s. */
(function(root,factory){
    const api=factory();
    if(typeof module==='object'&&module.exports)module.exports=api;
    else root.SkyTitanus=api;
})(globalThis,function(){
    'use strict';
    const PHASE=Object.freeze({
        BASE:'PHASE_1_BASE', UPGRADE:'PHASE_TRANSITION_UPGRADE', ARMORED:'PHASE_2_ARMORED',
        BREAK:'PHASE_TRANSITION_BREAK', FINAL:'PHASE_3_FINAL_STAND', VICTORY:'VICTORY'
    });
    const CONFIG=Object.freeze({
        maxHp:50, upgradeHp:40, armorHp:50, droneHp:10, dronePoints:1000, respawnMs:5000,
        dockingMs:2000, breakMs:700, victoryMs:2600, droneTurnMs:1200, pelletSpeed:290,
        missileSpeed:330, missileTurnRadius:82.5, missileTurnDegrees:55, missileCommitDistance:72,
        smokeLifeMs:150, smokeSampleMs:25,
        warningMs:500, chargeSpeed:520, laserWarningMs:750, laserFireMs:250, returnMs:650
    });
    const PATTERNS=Object.freeze({
        [PHASE.BASE]:{interval:3500,missiles:2,spread:22,firstDroneTurn:2400},
        [PHASE.ARMORED]:{interval:4000,missiles:7,spread:84,firstDroneTurn:1100},
        [PHASE.FINAL]:{interval:3000,missiles:4,spread:46,firstDroneTurn:2500}
    });
    const EPS=1e-7, DOWN=Math.PI/2, DEG=Math.PI/180;
    const ATLAS='assets/bosses/titanus-veronica/titanus-veronica-sheet.png';
    // Source rectangles exclude transparent gutters. All aircraft and missiles face down.
    const SPRITES=Object.freeze({
        base:[48,14,348,420], armored:[453,14,425,420], final:[935,14,348,420], shotgun:[1421,112,263,236],
        assault:[106,532,232,288], missile:[613,467,105,372], armor:[997,485,213,371], shard:[1452,505,190,326]
    });
    let atlas;
    const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
    const lerp=(a,b,t)=>a+(b-a)*t;
    const ease=t=>t*t*(3-2*t);

    class Encounter {
        constructor(director,segmentBox){
            this.d=director;
            this.b=director.boss;
            this.segmentBox=segmentBox;
            this.drones=[];
            this.shards=[];
            this.age=0;
            this.stateAge=0;
            this.hudFloor=this.d.h.layout?.(true)?.bossHudBottom||0;
            this.nextExplosion=0;
            this.clearBonus=0;
            if(!atlas&&typeof Image==='function'){
                atlas=new Image();
                atlas.src=ATLAS;
            }
            Object.assign(this.b,{armor:0,maxArmor:CONFIG.armorHp,defeatComplete:false});
            this.setPhase(PHASE.BASE);
            for(const side of [-1,1])this.addDrone('shotgun',side);
            this.updatePose();
        }

        get canShoot(){return !!PATTERNS[this.state];}

        addDrone(kind,side){
            const t={kind,side,ownerBoss:this.b,x:this.b.x,y:this.b.y,w:29,h:26,
                hp:CONFIG.droneHp,maxHp:CONFIG.droneHp,active:true,hitFlash:0,respawnAt:Infinity,
                nextAttack:side<0?'charge':'laser',move:null};
            Object.assign(t,this.formation(t));
            this.startRoaming(t);
            this.drones.push(t);
        }

        setPhase(state){
            this.state=this.b.titanusState=state;
            this.stateAge=0;
            this.d.phase=state===PHASE.VICTORY?'victory':this.canShoot?'fight':'intro';
            this.nextVolley=PATTERNS[state]?.interval??Infinity;
            this.nextDroneTurn=PATTERNS[state]?.firstDroneTurn??Infinity;
            this.droneCursor=state===PHASE.BASE?0:2;
            this.d.shots=[];
            for(const drone of this.drones)drone.move=null;
        }

        formation(drone){
            const shotgun=drone.kind==='shotgun';
            const offset=shotgun?(this.state===PHASE.BASE?60:92):148;
            return {x:this.b.x+drone.side*offset,y:this.b.y+(shotgun?20:49)};
        }

        startRoaming(drone){
            const dx=drone.x-this.b.x,dy=(drone.y-this.b.y)/.75;
            this.planRoamLeg(drone,Math.atan2(dy,dx),Math.hypot(dx,dy));
        }

        planRoamLeg(drone,angle,radius){
            const random=this.d.h.random||Math.random;
            const direction=random()<.5?-1:1;
            const innerRadius=drone.kind==='shotgun'?(this.state===PHASE.BASE?96:112):136;
            drone.roam={angle,radius,angleEnd:angle+direction*(.45+random()*1.15),
                radiusEnd:innerRadius+random()*32,start:this.age,end:this.age+1450+random()*950};
        }

        roamPosition(drone){
            if(this.age>=drone.roam.end)this.planRoamLeg(drone,drone.roam.angleEnd,drone.roam.radiusEnd);
            const leg=drone.roam,t=ease(clamp((this.age-leg.start)/(leg.end-leg.start),0,1));
            const angle=lerp(leg.angle,leg.angleEnd,t),radius=lerp(leg.radius,leg.radiusEnd,t);
            const {w}=this.d.h.context();
            return {
                x:clamp(this.b.x+Math.cos(angle)*radius,18,w-18),
                y:Math.max(this.hudFloor+16,this.b.y+Math.sin(angle)*radius*.75)
            };
        }

        updatePose(){
            const {w}=this.d.h.context();
            this.b.x=w/2+Math.sin(this.age/2400)*72;
            this.b.y=Math.max(190,this.hudFloor+76)+8*Math.sin(this.age/1500);
            const armored=this.state===PHASE.ARMORED;
            this.b.w=armored?134:88;
            this.b.h=armored?124:106;
            this.b.fortressVisualBox={x:this.b.x,y:this.b.y,w:this.b.w,h:this.b.h};
            for(const drone of this.drones){
                if(drone.active&&!drone.move)Object.assign(drone,this.roamPosition(drone));
            }
        }

        targets(){return this.canShoot?[this.b,...this.drones.filter(t=>t.active)]:[];}

        contact(projectile,target){
            return this.segmentBox(projectile.prevX??projectile.x,projectile.prevY??projectile.y,
                projectile.x,projectile.y,target.x,target.y,target.w/2,target.h/2);
        }

        hit(attack){
            const {target,projectile}=attack??{};
            if(!attack?.collision||!projectile?.active||!attack.token||!projectile.attackId||
                !this.targets().includes(target)||!this.contact(projectile,target)||
                this.d.seen.has(attack.token)||!this.d.h.validAttack(attack))return false;
            const base=attack.kind==='bomber'?20:attack.kind==='phantom'?30:attack.damage;
            const damage=base*(this.d.h.damageMultiplier?.(target,attack)??1);
            if(!Number.isFinite(damage)||damage<=0)return false;
            this.d.seen.add(attack.token);
            projectile.active=false;
            target.hitFlash=90;
            this.d.h.impact?.(target,attack);
            if(target!==this.b){
                target.hp=Math.max(0,target.hp-damage);
                if(!target.hp)this.destroyDrone(target,attack);
            }else if(this.state===PHASE.ARMORED){
                this.b.armor=Math.max(0,this.b.armor-damage);
                if(!this.b.armor)this.breakArmor();
            }else{
                const floor=this.state===PHASE.BASE?CONFIG.upgradeHp:0;
                this.b.hp=Math.max(floor,this.b.hp-damage);
                if(this.b.hp===0)this.defeat(attack);
                else if(this.state===PHASE.BASE&&this.b.hp===floor)this.setPhase(PHASE.UPGRADE);
            }
            return true;
        }

        playerShots(){
            const targets=this.targets();
            for(const projectile of this.d.h.context().bullets||[]){
                if(!projectile.active)continue;
                const x=projectile.prevX??projectile.x,y=projectile.prevY??projectile.y;
                const target=targets.filter(t=>t.active&&this.contact(projectile,t))
                    .sort((a,b)=>Math.hypot(x-a.x,y-a.y)-Math.hypot(x-b.x,y-b.y))[0];
                if(!target)continue;
                const kind=projectile.bomberSpecial?'bomber':projectile.isSpecial?'phantom':'normal';
                const token=kind==='phantom'?'phantom:'+projectile.skillGeneration:projectile.attackId;
                this.hit({kind,token,target,projectile,damage:projectile.damage,skinId:projectile.skinId,collision:true});
                if(!this.canShoot)return;
            }
        }

        destroyDrone(drone,attack){
            drone.active=false;
            drone.hp=0;
            drone.move=null;
            drone.respawnAt=this.age+CONFIG.respawnMs;
            this.d.h.escortReward?.(CONFIG.dronePoints);
            this.d.h.localExplosion?.(drone,attack);
        }

        respawnDrones(){
            if(this.state===PHASE.VICTORY)return;
            for(const drone of this.drones){
                if(drone.active||this.age+EPS<drone.respawnAt)continue;
                drone.active=true;
                drone.hp=CONFIG.droneHp;
                drone.respawnAt=Infinity;
                Object.assign(drone,this.formation(drone));
                this.startRoaming(drone);
            }
        }

        breakArmor(){
            this.setPhase(PHASE.BREAK);
            this.d.h.titanusImpact?.(17,.38);
            this.d.h.cinematicExplosion?.(this.b,true);
            for(let i=0;i<10;i++){
                const angle=i*Math.PI*2/10, speed=120+(i%4)*38;
                this.shards.push({x:this.b.x,y:this.b.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
                    spin:angle,age:0,life:800+i%3*140,size:7+i%4*2});
            }
        }

        fireMissiles(pattern){
            const {player}=this.d.h.context(),y=this.b.y+44;
            const bearing=Math.atan2(player.y-y,player.x-this.b.x);
            for(let i=0;i<pattern.missiles;i++){
                const offset=i/(pattern.missiles-1)-.5;
                const shot={kind:'missile',x:this.b.x+offset*66,y,
                    angle:bearing+offset*pattern.spread*DEG,speed:CONFIG.missileSpeed,
                    turnLeft:CONFIG.missileTurnDegrees*DEG,committed:false,age:0};
                shot.smoke=[missileExhaust(shot)];
                this.d.shots.push(shot);
            }
            this.d.h.launch?.(this.b);
        }

        fireShotgun(drone){
            for(let i=0;i<7;i++)this.d.shots.push({kind:'pellet',x:drone.x,y:drone.y+13,
                angle:DOWN+(i/6-.5)*20*DEG,speed:CONFIG.pelletSpeed,age:0});
            this.d.h.gun?.(drone);
        }

        droneTurnAt(){
            if(!this.drones.some(drone=>drone.active&&!drone.move))return Infinity;
            let at=this.nextDroneTurn;
            for(const drone of this.drones){
                // A returning drone is harmless, so the next escort can start its turn.
                if(drone.move&&drone.move.mode!=='return')at=Math.max(at,drone.move.end);
            }
            return at;
        }

        takeDroneTurn(field){
            for(let offset=0;offset<this.drones.length;offset++){
                const index=(this.droneCursor+offset)%this.drones.length;
                const drone=this.drones[index];
                if(!drone.active||drone.move)continue;
                this.droneCursor=(index+1)%this.drones.length;
                this.nextDroneTurn=this.stateAge+CONFIG.droneTurnMs;
                if(drone.kind==='shotgun')this.fireShotgun(drone);
                else this.warn(drone,field);
                return;
            }
        }

        updateShots(dt,field){
            const {w,h,player}=field,seconds=dt/1000;
            for(let i=this.d.shots.length-1;i>=0;i--){
                const shot=this.d.shots[i],x=shot.x,y=shot.y;
                if(shot.kind==='missile'&&!shot.committed){
                    const dx=player.x-x,dy=player.y-y;
                    const ahead=dx*Math.cos(shot.angle)+dy*Math.sin(shot.angle);
                    // Use forward distance so a wide sidestep also ends tracking on the first pass.
                    if(ahead<=CONFIG.missileCommitDistance){
                        shot.committed=true;
                    }else{
                        const desired=Math.atan2(dy,dx);
                        const delta=Math.atan2(Math.sin(desired-shot.angle),Math.cos(desired-shot.angle));
                        const limit=Math.min(shot.turnLeft,shot.speed/CONFIG.missileTurnRadius*seconds);
                        const turn=clamp(delta,-limit,limit);
                        shot.angle+=turn;
                        shot.turnLeft-=Math.abs(turn);
                        if(shot.turnLeft<=EPS)shot.committed=true;
                    }
                }
                shot.x+=Math.cos(shot.angle)*shot.speed*seconds;
                shot.y+=Math.sin(shot.angle)*shot.speed*seconds;
                shot.age+=dt;
                if(shot.kind==='missile')updateMissileSmoke(shot);
                if(this.playerContact(x,y,shot.x,shot.y,player,shot.kind==='missile'?5:2)){
                    this.d.shots.splice(i,1);
                    this.d.h.playerHit?.(shot);
                    if(this.d.titanus!==this)return;
                }else if(shot.x<-24||shot.x>w+24||shot.y<-24||shot.y>h+24||shot.age>9000){
                    this.d.shots.splice(i,1);
                }
            }
        }

        playerContact(x,y,endX,endY,player,padX,padY=padX){
            return this.segmentBox(x,y,endX,endY,player.x,player.y,
                (player.hitboxWidth||player.width)*.39+padX,(player.hitboxHeight||player.height)*.325+padY);
        }

        warn(drone,{player,w,h}){
            const kind=drone.nextAttack;
            drone.nextAttack=kind==='charge'?'laser':'charge';
            let targetX=player.x,targetY=player.y,duration=CONFIG.warningMs;
            if(kind==='laser'){
                const random=this.d.h.random||Math.random;
                const top=clamp(this.hudFloor,0,h);
                targetX=random()*w;
                targetY=lerp(top,h,random());
                duration=CONFIG.laserWarningMs;
            }
            const angle=Math.atan2(targetY-drone.y,targetX-drone.x);
            drone.move={kind,mode:'warning',end:this.stateAge+duration,angle};
            this.d.h.titanusWarning?.();
        }

        beginAssault(drone,field){
            const m=drone.move;
            m.start=this.stateAge;
            if(m.kind==='laser'){
                m.mode='laser';
                m.end=m.start+CONFIG.laserFireMs;
                this.d.h.titanusWarning?.();
                return;
            }
            m.mode='charge';
            m.x=drone.x;
            m.y=drone.y;
            const vx=Math.cos(m.angle),vy=Math.sin(m.angle);
            const edgeX=vx>0?field.w+20:-20,edgeY=vy>0?field.h+20:-20;
            const xTravel=Math.abs(vx)>EPS?(edgeX-m.x)/vx:Infinity;
            const yTravel=Math.abs(vy)>EPS?(edgeY-m.y)/vy:Infinity;
            m.end=m.start+Math.min(xTravel,yTravel)*1000/CONFIG.chargeSpeed;
            this.d.h.launch?.(drone);
        }

        advanceAssault(drone,field){
            const m=drone.move;
            if(!m||!drone.active)return;
            if(m.mode==='warning'){
                if(this.stateAge+EPS<m.end)return;
                this.beginAssault(drone,field);
                if(m.mode!=='laser')return;
            }
            if(m.mode==='charge'){
                const x=drone.x,y=drone.y,dist=(this.stateAge-m.start)*CONFIG.chargeSpeed/1000;
                drone.x=m.x+Math.cos(m.angle)*dist;
                drone.y=m.y+Math.sin(m.angle)*dist;
                if(!m.hit&&this.playerContact(x,y,drone.x,drone.y,field.player,drone.w/2,drone.h/2)){
                    m.hit=true;
                    this.d.h.playerHit?.(drone);
                }
                if(this.stateAge+EPS>=m.end)drone.move={mode:'return',x:drone.x,y:drone.y,start:m.end,end:m.end+CONFIG.returnMs};
            }else if(m.mode==='return'){
                const home=this.roamPosition(drone),t=ease(clamp((this.stateAge-m.start)/CONFIG.returnMs,0,1));
                drone.x=lerp(m.x,home.x,t);
                drone.y=lerp(m.y,home.y,t);
                if(this.stateAge+EPS>=m.end)drone.move=null;
            }else if(m.mode==='laser'){
                if(this.stateAge+EPS>=m.end){
                    drone.move=null;
                    this.startRoaming(drone);
                    return;
                }
                const range=Math.hypot(field.w,field.h);
                if(this.playerContact(drone.x,drone.y,drone.x+Math.cos(m.angle)*range,
                    drone.y+Math.sin(m.angle)*range,field.player,5))this.d.h.playerHit?.(drone);
            }
        }

        defeat(attack){
            this.setPhase(PHASE.VICTORY);
            this.b.active=false;
            for(const drone of this.drones.filter(t=>t.active)){
                this.destroyDrone(drone,attack);
                this.clearBonus+=CONFIG.dronePoints;
            }
            this.b.defeatComplete=true;
            if(!this.d.completed.has(this.b.id)){
                this.d.completed.add(this.b.id);
                this.d.h.victory?.(this.b,this.d.runId+':boss:'+this.b.id,attack);
            }
        }

        nextBoundary(){
            let at=Math.min(this.nextVolley,this.droneTurnAt());
            if(this.state===PHASE.UPGRADE)at=CONFIG.dockingMs;
            if(this.state===PHASE.BREAK)at=CONFIG.breakMs;
            if(this.state===PHASE.VICTORY)at=[200,600,1050,CONFIG.victoryMs][this.nextExplosion];
            for(const drone of this.drones){
                if(!drone.active&&this.state!==PHASE.VICTORY)at=Math.min(at,this.stateAge+drone.respawnAt-this.age);
                if(drone.move)at=Math.min(at,drone.move.end);
            }
            return at;
        }

        step(dt,field){
            this.age+=dt;
            this.stateAge+=dt;
            this.b.age=this.age;
            for(const t of [this.b,...this.drones])t.hitFlash=Math.max(0,t.hitFlash-dt);
            for(const shard of this.shards){
                shard.age+=dt;
                shard.x+=shard.vx*dt/1000;
                shard.y+=shard.vy*dt/1000;
                shard.vy+=170*dt/1000;
                shard.spin+=4*dt/1000;
            }
            this.shards=this.shards.filter(s=>s.age<s.life&&s.x>-20&&s.x<field.w+20&&s.y>-20&&s.y<field.h+20);
            this.updatePose();
            this.respawnDrones();
            if(this.state===PHASE.UPGRADE&&this.stateAge+EPS>=CONFIG.dockingMs){
                this.b.armor=CONFIG.armorHp;
                this.setPhase(PHASE.ARMORED);
                for(const side of [-1,1])this.addDrone('assault',side);
                this.updatePose();
                this.d.h.titanusImpact?.(12,.16);
                this.d.h.armorLock?.();
                return;
            }
            if(this.state===PHASE.BREAK&&this.stateAge+EPS>=CONFIG.breakMs){
                this.b.hp=CONFIG.maxHp;
                this.setPhase(PHASE.FINAL);
                this.updatePose();
                return;
            }
            if(this.state===PHASE.VICTORY){
                if(this.nextExplosion<3&&this.stateAge+EPS>=[200,600,1050][this.nextExplosion]){
                    const i=this.nextExplosion++;
                    this.d.h.localExplosion?.({x:this.b.x+[-30,38,0][i],y:this.b.y+(i===1?18:0)},null,i===2);
                    if(i===2)this.d.h.titanusImpact?.(20,.4);
                }
                if(this.stateAge+EPS>=CONFIG.victoryMs){
                    this.abort();
                    this.d.titanus=this.d.boss=null;
                    this.d.phase='regular';
                    this.d.h.resume?.();
                }
                return;
            }
            if(!this.canShoot)return;
            this.updateShots(dt,field);
            if(this.d.titanus!==this)return;
            for(const drone of this.drones){
                this.advanceAssault(drone,field);
                if(this.d.titanus!==this)return;
            }
            if(this.stateAge+EPS>=this.droneTurnAt())this.takeDroneTurn(field);
            if(this.stateAge+EPS>=this.nextVolley){
                const pattern=PATTERNS[this.state];
                this.nextVolley+=pattern.interval;
                this.fireMissiles(pattern);
            }
        }

        update(dt){
            const field=this.d.h.context();
            if(field.paused||!Number.isFinite(dt)||dt<0)return;
            this.hudFloor=this.d.h.layout?.(true)?.bossHudBottom||0;
            this.playerShots();
            let left=dt;
            while(left>EPS&&this.d.titanus===this){
                const step=clamp(this.nextBoundary()-this.stateAge,0,Math.min(left,1000/60));
                this.step(step,field);
                left-=step;
            }
        }

        abort(){
            this.d.shots=[];
            this.shards=[];
            this.drones=[];
        }

        draw(ctx){
            const {w,h}=this.d.h.context();
            const armed=this.state===PHASE.ARMORED;
            ctx.save();
            if(this.state!==PHASE.VICTORY||this.nextExplosion<3){
                ctx.save();
                if(this.state===PHASE.VICTORY)ctx.globalAlpha=.6;
                drawHull(ctx,this.b,armed,this.state===PHASE.FINAL);
                ctx.restore();
            }
            if(this.state===PHASE.UPGRADE){
                const t=clamp(this.stateAge/CONFIG.dockingMs,0,1);
                const arcFrame=Math.floor(this.stateAge/55);
                for(const side of [-1,1]){
                    const angle=DOWN-side*(1.28+Math.PI*2*t),r=lerp(70,15,t);
                    const x=this.b.x+Math.cos(angle)*r,y=this.b.y+Math.sin(angle)*r;
                    drawDockLink(ctx,x,y,this.b.x+side*19,this.b.y+4,t,arcFrame+side);
                    drawDrone(ctx,{x,y,kind:'shotgun'},angle-DOWN);
                }
                ctx.strokeStyle='rgba(104,239,255,.42)';ctx.lineWidth=1;
                ctx.beginPath();ctx.arc(this.b.x,this.b.y,lerp(70,15,t),0,Math.PI*2);ctx.stroke();
                if(t>.8){
                    const closing=ease((t-.8)/.2),gap=lerp(36,0,closing);
                    for(const side of [-1,1]){
                        drawDockLink(ctx,this.b.x+side*(47+gap),this.b.y-8,
                            this.b.x+side*23,this.b.y-8,closing,arcFrame+2*side);
                    }
                    ctx.save();ctx.globalAlpha=(t-.8)/.2;
                    drawArmor(ctx,this.b.x,this.b.y,gap);
                    ctx.restore();
                }
            }else{
                for(const drone of this.drones){
                    const move=drone.move;
                    if(move?.mode==='warning'||move?.mode==='laser'){
                        drawRay(ctx,drone,move.angle,Math.hypot(w,h),move.mode==='laser');
                    }
                    if(drone.active)drawDrone(ctx,drone,move?.mode==='charge'?move.angle-DOWN:0);
                }
            }
            for(const shot of this.d.shots)if(shot.kind==='missile')drawMissileSmoke(ctx,shot);
            for(const shot of this.d.shots)drawShot(ctx,shot);
            for(const shard of this.shards){
                ctx.save();ctx.translate(shard.x,shard.y);ctx.rotate(shard.spin);
                ctx.globalAlpha=1-shard.age/shard.life;
                if(!drawSprite(ctx,'shard',shard.size*2,shard.size*2)){
                    plate(ctx,[[-shard.size,0],[3,-4],[shard.size,5],[-3,6]],'#495c69','#80e9f5');
                }
                ctx.restore();
            }
            if(!this.d.h.hideHUD&&this.state===PHASE.VICTORY)this.drawVictory(ctx,w);
            ctx.restore();
        }

        get healthLabel(){
            return {
                [PHASE.BASE]:'BASE FORM', [PHASE.UPGRADE]:'VERONICA DOCKING',
                [PHASE.ARMORED]:'HEAVY ARMOR', [PHASE.BREAK]:'ARMOR SHATTERED',
                [PHASE.FINAL]:'FINAL STAND', [PHASE.VICTORY]:'DEFEATED'
            }[this.state];
        }

        drawVictory(ctx,w){
            ctx.textAlign='center';
            ctx.fillStyle='rgba(6,14,24,.92)';ctx.fillRect(w/2-182,141,364,72);
            ctx.fillStyle='#8cf5ff';ctx.font='bold 17px monospace';ctx.fillText('TITANUS VERONICA DEFEATED',w/2,165);
            ctx.fillStyle='#f5f8ff';ctx.font='13px monospace';
            ctx.fillText('CLEAR BONUS  +'+(this.b.reward+this.clearBonus).toLocaleString()+' PTS',w/2,189);
        }
    }

    function drawSprite(ctx,id,w,h){
        if(atlas?.naturalWidth!==1774||atlas.naturalHeight!==887)return false;
        const [x,y,sw,sh]=SPRITES[id],scale=Math.min(w/sw,h/sh),dw=sw*scale,dh=sh*scale;
        ctx.imageSmoothingEnabled=false;
        ctx.drawImage(atlas,x,y,sw,sh,-dw/2,-dh/2,dw,dh);
        return true;
    }

    function plate(ctx,points,fill,edge){
        ctx.beginPath();ctx.moveTo(...points[0]);
        for(const point of points.slice(1))ctx.lineTo(...point);
        ctx.closePath();ctx.fillStyle=fill;ctx.fill();
        ctx.strokeStyle=edge;ctx.lineWidth=1.5;ctx.stroke();
    }

    function drawArmor(ctx,x,y,gap=0){
        for(const side of [-1,1]){
            ctx.save();ctx.translate(x+side*gap,y);ctx.scale(side,1);
            ctx.translate(47,0);
            if(drawSprite(ctx,'armor',45,115)){
                ctx.restore();
                continue;
            }
            ctx.translate(-47,0);
            plate(ctx,[[20,-58],[54,-49],[67,-16],[66,42],[43,61],[28,34]],'#374c5b','#7e99a8');
            plate(ctx,[[36,-43],[54,-26],[57,30],[45,43],[38,24]],'#172731','#59d3e0');
            ctx.fillStyle='#9af4fa';ctx.fillRect(49,-13,5,19);ctx.restore();
        }
    }

    function drawHull(ctx,b,armored,enraged){
        ctx.save();ctx.translate(b.x,b.y);
        if(b.hitFlash)ctx.globalAlpha*=.76;
        if(drawSprite(ctx,armored?'armored':enraged?'final':'base',b.w,b.h)){
            ctx.restore();
            return;
        }
        const accent=enraged?'#ff4c67':'#72f1ff';
        for(const side of [-1,1]){
            ctx.save();ctx.scale(side,1);
            plate(ctx,[[10,-30],[37,-42],[44,-6],[43,30],[32,51],[16,27]],'#2b3b49','#7e99a8');
            ctx.fillStyle=accent;ctx.fillRect(30,7,5,23);ctx.restore();
        }
        plate(ctx,[[-19,-54],[19,-54],[30,-20],[25,37],[0,55],[-25,37],[-30,-20]],'#15252e','#91acba');
        plate(ctx,[[-11,-29],[11,-29],[15,0],[0,23],[-15,0]],enraged?'#551b2d':'#174c59',accent);
        ctx.fillStyle=accent;ctx.fillRect(-3,-20,6,27);
        ctx.restore();
        if(armored)drawArmor(ctx,b.x,b.y);
    }

    function drawDrone(ctx,t,rotation){
        ctx.save();ctx.translate(t.x,t.y);ctx.rotate(rotation);
        if(t.hitFlash)ctx.globalAlpha*=.76;
        if(drawSprite(ctx,t.kind,30,29)){
            ctx.restore();
            return;
        }
        const accent=t.kind==='assault'?'#ff6076':'#65efff';
        plate(ctx,[[-15,-7],[-8,-12],[8,-12],[15,-7],[13,7],[0,13],[-13,7]],t.hitFlash?'#667782':'#263543','#91a9b4');
        ctx.fillStyle='#121d27';ctx.fillRect(-11,0,6,12);ctx.fillRect(5,0,6,12);
        ctx.fillStyle=accent;ctx.fillRect(-4,-6,8,7);ctx.fillRect(-10,7,3,6);ctx.fillRect(7,7,3,6);
        ctx.restore();
    }

    function drawDockLink(ctx,x,y,endX,endY,charge,frame){
        ctx.save();
        const dx=endX-x,dy=endY-y,length=Math.hypot(dx,dy)||1;
        const pulse=.78+.22*Math.sin(frame*1.8);
        ctx.globalAlpha*=lerp(.55,1,charge);
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(endX,endY);
        ctx.strokeStyle='rgba(46,220,255,.35)';ctx.lineWidth=lerp(4,9,charge);ctx.stroke();
        ctx.strokeStyle='#88f4ff';ctx.lineWidth=1.4;ctx.stroke();
        ctx.beginPath();ctx.moveTo(x,y);
        for(let i=1;i<6;i++){
            const t=i/6;
            const offset=Math.sin(frame*2.4+i*4.2)*Math.min(length*.24,lerp(5,13,charge))*pulse;
            ctx.lineTo(x+dx*t-dy/length*offset,y+dy*t+dx/length*offset);
        }
        ctx.lineTo(endX,endY);ctx.strokeStyle='#e2d8ff';ctx.lineWidth=1.7;ctx.stroke();
        ctx.fillStyle='#edfbff';ctx.beginPath();ctx.arc(endX,endY,lerp(1.5,3.5,charge)*pulse,0,Math.PI*2);ctx.fill();
        ctx.restore();
    }

    function drawRay(ctx,t,angle,range,live){
        ctx.save();ctx.strokeStyle=live?'#ff6178':'rgba(255,52,80,.57)';
        ctx.lineWidth=live?10:2;ctx.setLineDash(live?[]:[9,6]);
        ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(t.x+Math.cos(angle)*range,t.y+Math.sin(angle)*range);ctx.stroke();
        if(live){ctx.lineWidth=3;ctx.strokeStyle='#fff0e9';ctx.stroke();}
        ctx.restore();
    }

    function missileExhaust(shot){
        return {x:shot.x-Math.cos(shot.angle)*26,y:shot.y-Math.sin(shot.angle)*26,at:shot.age};
    }

    function updateMissileSmoke(shot){
        const smoke=shot.smoke;
        if(shot.age-smoke[smoke.length-1].at>=CONFIG.smokeSampleMs)smoke.push(missileExhaust(shot));
        while(smoke.length>1&&shot.age-smoke[0].at>=CONFIG.smokeLifeMs)smoke.shift();
    }

    function drawMissileSmoke(ctx,shot){
        const tip=missileExhaust(shot),smoke=shot.smoke;
        ctx.save();
        const alpha=ctx.globalAlpha;
        ctx.strokeStyle='#a8b2bc';
        ctx.lineCap='round';
        for(let i=0;i<smoke.length;i++){
            const from=smoke[i],to=smoke[i+1]||tip;
            const fade=1-clamp((shot.age-(from.at+to.at)/2)/CONFIG.smokeLifeMs,0,1);
            ctx.globalAlpha=alpha*.34*fade;
            ctx.lineWidth=lerp(3.5,1.8,fade);
            ctx.beginPath();
            ctx.moveTo(from.x,from.y);
            ctx.lineTo(to.x,to.y);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawShot(ctx,shot){
        ctx.save();ctx.translate(shot.x,shot.y);ctx.rotate(shot.angle);
        if(shot.kind==='missile'){
            ctx.save();ctx.translate(-6,0);ctx.rotate(-DOWN);
            const drawn=drawSprite(ctx,'missile',13,42);
            ctx.restore();
            if(!drawn){
                ctx.fillStyle='rgba(255,83,70,.28)';ctx.fillRect(-27,-2,18,4);
                plate(ctx,[[-12,-4],[-4,-3],[6,-3],[12,0],[6,3],[-4,3],[-12,4]],'#435b68','#8ef4ff');
                ctx.fillStyle='#ff6463';ctx.fillRect(-20,-1.5,9,3);
            }
        }else{
            ctx.fillStyle='#ff7985';ctx.fillRect(-4,-1.5,8,3);
            ctx.fillStyle='#fff0ed';ctx.fillRect(1,-1,3,2);
        }
        ctx.restore();
    }

    return {Encounter,CONFIG,PHASE};
});
