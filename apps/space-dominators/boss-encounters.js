window.SpaceEncounterObjects = (function () {
  'use strict';

  function clamp(v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  function dist(x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function parseType(typeStr) {
    if(['shield','recall','wings'].includes(typeStr))return typeStr;
    if (!typeStr) return null;
    var s = String(typeStr).toLowerCase();
    if (s.indexOf('pod') !== -1 || s.indexOf('escort') !== -1 || s.indexOf('flank') !== -1) return 'pods';
    if (s === 'bridge') return 'bridge';
    if (s.indexOf('winch') !== -1 || s.indexOf('harpoon') !== -1) return 'winch';
    if (s.indexOf('well') !== -1 || s.indexOf('gravity') !== -1) return 'well';
    if (s.indexOf('gate') !== -1) return 'gate';
    if (s.indexOf('drone') !== -1 || s.indexOf('pincer') !== -1) return 'drones';
    if (s.indexOf('rotor') !== -1) return 'rotor';
    return null;
  }

  function seed(b, a, e, ordinal) {
    if (!b || !a || !e) return false;
    var normType = parseType(e.type);
    if (!normType) return false;

    if (!Array.isArray(b.objects)) b.objects = [];
    if (typeof b.serial !== 'number') b.serial = 0;

    var warnSec = (typeof e.warn === 'number' && e.warn > 0) ? e.warn : 1.0;
    e.warn = warnSec;
    var durSec = Math.min(3.0, (typeof e.duration === 'number' && e.duration > 0) ? e.duration : 2.5);
    var maxLife = warnSec + durSec;
    var skill = (typeof a.skillIndex === 'number') ? a.skillIndex : 0;
    var frozenPx = (typeof a.px === 'number') ? a.px : 640;
    var frozenPy = (typeof a.py === 'number') ? a.py : 560;
    var bossX = (typeof a.x === 'number') ? a.x : 640;
    var bossY = (typeof a.y === 'number') ? a.y : 160;
    var side = (typeof a.side === 'number' && a.side !== 0) ? a.side : 1;
    var ord = (typeof ordinal === 'number') ? ordinal : 0;
    var groupId = 'g_' + (++b.serial);

    if(['shield','recall','wings'].includes(normType)){
      for(let i=0;i<6;i++){
        if(normType==='shield' && i%3===0)continue;
        const bearing=i*Math.PI/3;
        const ox=Math.cos(bearing)*(normType==='recall'?205:100);
        const oy=Math.sin(bearing)*(normType==='recall'?135:64);
        b.objects.push({id:'e'+(++b.serial),kind:'enc-'+normType,x:bossX+ox,y:bossY+85+oy,
          anchorX:bossX,anchorY:bossY+85,ox,oy,bearing,order:i,r:normType==='shield'?21:14,
          hp:normType==='shield'?6:3,maxHp:normType==='shield'?6:3,skillIndex:skill,
          targetX:frozenPx,targetY:frozenPy,age:0,warn:warnSec,maxLife:maxLife,heading:Math.PI/2});
      }
      return true;
    }
    if (normType === 'pods') {
      var offsets = [-170, 170];
      for (var p = 0; p < 2; p++) {
        var pSide = p === 0 ? -1 : 1;
        var startX = pSide < 0 ? 60 : 1220;
        var formX = clamp(bossX + offsets[p], 80, 1200);
        var formY = clamp(bossY - 20, 80, 320);
        var aimX=pSide<0?clamp(frozenPx,45,480):clamp(frozenPx,800,1235);
        var aimAng = Math.atan2(frozenPy-formY,aimX-formX);
        b.objects.push({
          id: 'e' + (++b.serial),
          kind: 'enc-pods',
          x: startX,
          y: formY - 60,
          startX: startX,
          startY: formY - 60,
          formX: formX,
          formY: formY,
          r: 22,
          hp: 4,
          maxHp: 4,
          skillIndex: skill,
          groupId: groupId,
          podSide: pSide,
          targetX: aimX,
          targetY: frozenPy,
          aimAngle: aimAng,
          heading: aimAng,
          age: 0,
          warn: warnSec,
          maxLife: maxLife,
          fired: false,
          disabled: false,
          dead: false
        });
      }
      return true;
    }

    if (normType === 'bridge') {
      var leftId = 'e' + (++b.serial);
      var rightId = 'e' + (++b.serial);
      var bridgeY = clamp(bossY + 80, 160, 360);
      var lx = clamp(frozenPx-210,95,760);
      var rx = clamp(frozenPx+210,520,1185);
      var objL = {
        id: leftId,
        pairId: rightId,
        kind: 'enc-bridge',
        anchorIndex: 0,
        x: lx,
        y: bridgeY,
        r: 24,
        hp: 3,
        maxHp: 3,
        skillIndex: skill,
        groupId: groupId,
        tetherActive: true,
        otherX: rx,
        otherY: bridgeY,
        heading: 0,
        age: 0,
        warn: warnSec,
        maxLife: maxLife,
        fired: false,
        disabled: false,
        dead: false
      };
      var objR = {
        id: rightId,
        pairId: leftId,
        kind: 'enc-bridge',
        anchorIndex: 1,
        x: rx,
        y: bridgeY+(b.index===7?165:0),
        r: 24,
        hp: 3,
        maxHp: 3,
        skillIndex: skill,
        groupId: groupId,
        tetherActive: true,
        otherX: lx,
        otherY: bridgeY,
        heading: Math.PI,
        age: 0,
        warn: warnSec,
        maxLife: maxLife,
        fired: false,
        disabled: false,
        dead: false
      };
      b.objects.push(objL, objR);
      return true;
    }

    if (normType === 'winch') {
      var launcherX = clamp(bossX, 180, 1100);
      var launcherY = clamp(bossY, 60, 200);
      var wAim = Math.atan2(frozenPy - launcherY, frozenPx - launcherX);
      var reachDist = clamp(dist(launcherX, launcherY, frozenPx, frozenPy), 200, 680);
      b.objects.push({
        id: 'e' + (++b.serial),
        kind: 'enc-winch',
        x: launcherX,
        y: launcherY,
        originX: launcherX,
        originY: launcherY,
        targetX: frozenPx,
        targetY: frozenPy,
        aimAngle: wAim,
        heading: wAim,
        reach: reachDist,
        r: 25,
        hp: 4,
        maxHp: 4,
        skillIndex: skill,
        groupId: groupId,
        age: 0,
        warn: warnSec,
        maxLife: maxLife,
        fireTimer: 0,
        disabled: false,
        dead: false
      });
      return true;
    }

    if (normType === 'well') {
      var wellX = clamp(bossX, 320, 960);
      var wellY = clamp(frozenPy-140,260,480);
      var isPull = skill===0;
      b.objects.push({
        id: 'e' + (++b.serial),
        kind: 'enc-well',
        x: wellX,
        y: wellY,
        r: 26,
        hp: 6,
        maxHp: 6,
        safeR: 54,
        fieldR: 280,
        mode: isPull ? 'pull' : 'push',
        skillIndex: skill,
        groupId: groupId,
        heading: 0,
        age: 0,
        warn: warnSec,
        maxLife: maxLife,
        pulseTimer: 0,
        disabled: false,
        dead: false
      });
      return true;
    }

    if (normType === 'gate') {
      var hingeXs = [340,640,940].map(x=>x+side*(e.offset||0)*.35);
      var targetGateY = clamp(bossY + 90, 180, 300);
      for (var h = 0; h < 3; h++) {
        b.objects.push({
          id: 'e' + (++b.serial),
          kind: 'enc-gate',
          hingeIndex: h,
          x: hingeXs[h],
          y: 30,
          targetY: targetGateY,
          vy: 160,
          r: 23,
          hp: 3,
          maxHp: 3,
          skillIndex: skill,
          groupId: groupId,
          cut: false,
          heading: Math.PI * 0.5,
          age: 0,
          warn: warnSec,
          maxLife: maxLife,
          fireTimer: 0,
          disabled: false,
          dead: false
        });
      }
      return true;
    }

    if (normType === 'drones') {
      var leaderId = 'e' + (++b.serial);
      var leadX = 640;
      var leadY = clamp(bossY - 30, 80, 180);
      var leaderObj = {
        id: leaderId,
        kind: 'enc-drones',
        role: 'leader',
        isLeader: true,
        x: leadX,
        y: leadY,
        targetX: frozenPx,
        targetY: frozenPy,
        r: 24,
        hp: 5,
        maxHp: 5,
        skillIndex: skill,
        groupId: groupId,
        heading: Math.atan2(frozenPy - leadY, frozenPx - leadX),
        age: 0,
        warn: warnSec,
        maxLife: maxLife,
        disabled: false,
        dead: false
      };
      b.objects.push(leaderObj);

      for (var d = 0; d < Math.min(6,e.count||6); d++) {
        var dSide = d%2 ? 1 : -1;
        var dStartX=640+dSide*(120+Math.floor(d/2)*81);
        b.objects.push({
          id: 'e' + (++b.serial),
          kind: 'enc-drones',
          role: 'drone',
          flank:e.type==='pincer', order:d,
          isLeader: false,
          leaderId: leaderId,
          x: dStartX,
          y: 90,
          startX: dStartX,
          startY: 90,
          side: dSide,
          r: 18,
          hp: 2,
          maxHp: 2,
          skillIndex: skill,
          groupId: groupId,
          targetX: frozenPx,
          targetY: frozenPy,
          heading: Math.PI * 0.5,
          age: 0,
          warn: warnSec,
          maxLife: maxLife,
          diveTime: 0,
          dropTimer: 0,
          disabled: false,
          dead: false
        });
      }
      return true;
    }

    if (normType === 'rotor') {
      var rotorX = clamp(bossX, 300, 980);
      var rotorY = clamp(bossY + 60, 140, 260);
      b.objects.push({
        id: 'e' + (++b.serial),
        kind: 'enc-rotor',
        x: rotorX,
        y: rotorY,
        r: 30,
        hp: 5,
        maxHp: 5,
        skillIndex: skill,
        groupId: groupId,
        arms: 4,
        rotSpeed: side*.44,
        angle: .45,
        armLength: 1300,
        heading: 0,
        age: 0,
        warn: warnSec,
        maxLife: maxLife,
        pulseTimer: 0,
        disabled: false,
        dead: false
      });
      return true;
    }

    return false;
  }

  function update(b, dt, api) {
    if (!b || !Array.isArray(b.objects) || dt <= 0) return;
    var step = Math.min(dt, 0.1);

    for (var i = 0; i < b.objects.length; i++) {
      var o = b.objects[i];
      if (!o || !o.kind || o.kind.indexOf('enc-') !== 0 || o.kind==='enc-fuse') continue;
      if (o.dead || o.hp <= 0) continue;

      o.age += step;
      if (o.age >= o.maxLife) {
        o.dead = true;
        o.hp = 0;
        continue;
      }

      if (o.disabled) continue;

      if(o.kind==='enc-shield'){
        const ang=o.bearing+o.age*.92,rx=104,ry=64;
        o.x=b.x+Math.cos(ang)*rx;o.y=b.y+55+Math.sin(ang)*ry;
        o.heading=ang+Math.PI/2;
        const release=o.warn+.15;
        if(!o.fired && o.age>=release){
          o.fired=true;
          const h=api.makeHazard(o.x,o.y,ang,b.phase===2?240:210,'bolt');
          if(h){h.bossIndex=b.index;h.skillIndex=o.skillIndex;}
        }
        continue;
      }
      if(o.kind==='enc-recall'||o.kind==='enc-wings'){
        const isRecall=o.kind==='enc-recall';
        const flight=clamp((o.age-o.warn+.1)/.75,0,1);
        const recoil=isRecall?1-flight:1;
        o.x=o.anchorX+o.ox*recoil;o.y=o.anchorY+o.oy*recoil;
        if(!o.fired && o.age>=o.warn+(isRecall?.68:.32+o.order*.055)){
          o.fired=true;
          const heading=isRecall?o.bearing:Math.atan2(o.targetY-o.y,o.targetX-o.x);
          const h=api.makeHazard(o.x,o.y,heading,isRecall?225:315,'bolt');
          if(h){h.bossIndex=b.index;h.skillIndex=o.skillIndex;}
          api.burst(o.x,o.y,isRecall?'#c693ff':'#ffb26e',5);
          if(isRecall)o.hp=0;
        }
        continue;
      }
      if (o.kind === 'enc-pods') {
        if (o.age < o.warn) {
          var formRatio = Math.min(1, o.age / (o.warn * 0.75));
          o.x = o.startX + (o.formX - o.startX) * formRatio;
          o.y = o.startY + (o.formY - o.startY) * formRatio;
          o.aimAngle = Math.atan2(o.targetY - o.y, o.targetX - o.x);
          o.heading = o.aimAngle;
        } else if (!o.fired) {
          o.fired = true;
          o.heading = o.aimAngle;
          if (api && typeof api.burst === 'function') {
            api.burst(o.x, o.y, '#ff8822', 8);
          }
          if (api && typeof api.makeHazard === 'function') {
            var spreads = [-0.14, 0, 0.14];
            for (var s = 0; s < spreads.length; s++) {
              var h = api.makeHazard(o.x, o.y, o.aimAngle + spreads[s], 380, 'bullet');
              if (h) {
                h.bossIndex = b.index;
                h.skillIndex = o.skillIndex;
              }
            }
          }
        } else {
          var retreatVx = o.podSide < 0 ? -240 : 240;
          var retreatVy = -220;
          o.x += retreatVx * step;
          o.y += retreatVy * step;
          o.heading = Math.atan2(retreatVy, retreatVx);
        }
      } else if (o.kind === 'enc-bridge') {
        if(o.anchorIndex===0 && o.tetherActive && o.age>=o.warn){
          const end=b.objects.find(part=>part.id===o.pairId && part.hp>0 && !part.disabled);
          if(end){
            const dx=end.x-o.x,dy=end.y-o.y,len2=dx*dx+dy*dy;
            for(const p of api.pilots){
              const u=clamp(((p.x-o.x)*dx+(p.y-o.y)*dy)/len2,0,1);
              if(p.hp>0 && Math.hypot(p.x-o.x-u*dx,p.y-o.y-u*dy)<10)api.damage(p);
            }
          }
        }
        if (o.anchorIndex === 0 && o.tetherActive && o.age >= o.warn && !o.fired) {
          o.fired = true;
          var other = null;
          for (var k = 0; k < b.objects.length; k++) {
            var cand = b.objects[k];
            if (cand && cand.id === o.pairId && !cand.disabled && cand.tetherActive) {
              other = cand;
              break;
            }
          }
          if (other) {
            other.fired = true;
            if (api && typeof api.burst === 'function') {
              api.burst(o.x, o.y, '#00ffff', 10);
              api.burst(other.x, other.y, '#00ffff', 10);
            }
            if (api && typeof api.makeHazard === 'function') {
              var segs = 7;
              for (var seg = 1; seg < segs; seg++) {
                var tRatio = seg / segs;
                var hzX = o.x + (other.x - o.x) * tRatio;
                var hzY = o.y + (other.y - o.y) * tRatio;
                var hz = api.makeHazard(hzX, hzY, Math.PI * 0.5, 90, 'spark');
                if (hz) {
                  hz.bossIndex = b.index;
                  hz.skillIndex = o.skillIndex;
                }
              }
            }
          }
        }
      } else if (o.kind === 'enc-winch') {
        const speed=b.phase===1?270:305;
        const extend=o.reach/speed;
        const flight=o.age-o.warn;
        const reach=flight<0?0:flight<=extend?flight*speed:flight<extend+.45?o.reach:
          Math.max(0,o.reach-(flight-extend-.45)*speed*1.8);
        o.x=o.originX+Math.cos(o.aimAngle)*reach;
        o.y=o.originY+Math.sin(o.aimAngle)*reach;
        o.heading=o.aimAngle+(flight>extend+.45?Math.PI:0);
        if(flight>=0 && reach>0)for(const pilot of api.pilots){
          if(pilot.hp>0 && Math.hypot(pilot.x-o.x,pilot.y-o.y)<o.r+7)api.damage(pilot);
        }
      } else if (o.kind === 'enc-well') {
        if (o.age >= o.warn) {
          for(const p of api.pilots){
            if(p.hp<=0)continue;
            const dx=o.x-p.x,dy=o.y-p.y,length=Math.hypot(dx,dy);
            if(length>o.safeR && length<o.fieldR){
              const force=(o.mode==='pull'?1:-1)*(b.phase===1?160:200)*step;
              p.x=clamp(p.x+dx/length*force,28,1252);
              p.y=clamp(p.y+dy/length*force,42,678);
            }
          }
          o.pulseTimer = (o.pulseTimer || 0) + step;
          if (o.pulseTimer >= 0.32) {
            o.pulseTimer = 0;
            if (api && typeof api.burst === 'function') {
              api.burst(o.x, o.y, '#c044ff', 6);
            }
            if (api && typeof api.makeHazard === 'function') {
              var count = 8;
              var baseAng = o.age * 1.5;
              for (var wIdx = 0; wIdx < count; wIdx++) {
                var orbAng = baseAng + (wIdx * (Math.PI * 2 / count));
                var spawnR = o.safeR + 24;
                var sx = o.x + Math.cos(orbAng) * spawnR;
                var sy = o.y + Math.sin(orbAng) * spawnR;
                var orbSpd = o.mode === 'pull' ? 140 : 220;
                var hazardAng = o.mode === 'pull' ? orbAng + Math.PI : orbAng;
                var welly = api.makeHazard(sx, sy, hazardAng, orbSpd, 'orb');
                if (welly) {
                  welly.bossIndex = b.index;
                  welly.skillIndex = o.skillIndex;
                }
              }
            }
          }
        }
      } else if (o.kind === 'enc-gate') {
        if (o.y < o.targetY) {
          o.y = Math.min(o.targetY, o.y + o.vy * step);
        }
        if (!o.cut && o.age >= o.warn) {
          o.fireTimer = (o.fireTimer || 0) + step;
          if (o.fireTimer >= 0.28) {
            o.fireTimer = 0;
            if (api && typeof api.makeHazard === 'function') {
              var gh = api.makeHazard(o.x, o.y + o.r + 4, Math.PI * 0.5, 320, 'beam');
              if (gh) {
                gh.bossIndex = b.index;
                gh.skillIndex = o.skillIndex;
              }
            }
          }
        }
      } else if (o.kind === 'enc-drones') {
        if (o.isLeader) {
          o.heading = Math.atan2(o.targetY - o.y, o.targetX - o.x);
        } else {
          const start=o.warn+o.order*.22;
          if(o.age>=start){
            const p=Math.min(1,(o.age-start)/1.55);
            const endX=o.flank?(o.side<0?Math.min(520,o.targetX):Math.max(760,o.targetX)):o.targetX;
            const arc=o.side*Math.sin(Math.PI*p)*(o.flank?100:40);
            o.x=o.startX+(endX-o.startX)*p+arc;
            o.y=o.startY+(o.targetY-o.startY)*p;
            o.heading=Math.atan2(o.targetY-o.startY,endX-o.startX+o.side*100*Math.PI*Math.cos(Math.PI*p));
            for(const pilot of api.pilots)if(pilot.hp>0 && Math.hypot(pilot.x-o.x,pilot.y-o.y)<o.r+8){api.damage(pilot);o.hp=0;break;}
            if(p>=1)o.hp=0;
          }
        }
      } else if (o.kind === 'enc-rotor') {
        if (o.age >= o.warn) {
          o.angle += o.rotSpeed * step;
          o.heading = o.angle;
          for(let arm=0;arm<o.arms;arm++){
            const theta=o.angle+arm*Math.PI*2/o.arms,c=Math.cos(theta),s=Math.sin(theta);
            for(const pilot of api.pilots){
              const dx=pilot.x-o.x,dy=pilot.y-o.y;
              if(pilot.hp>0 && dx*c+dy*s>0 && Math.abs(dy*c-dx*s)<10)api.damage(pilot);
            }
          }
        }
      }
    }
  }

  function draw(ctx, b, time) {
    if (!ctx || !b || !Array.isArray(b.objects)) return;
    var t = typeof time === 'number' ? time : performance.now() * 0.001;

    for (var i = 0; i < b.objects.length; i++) {
      var o = b.objects[i];
      if (!o || !o.kind || o.kind.indexOf('enc-') !== 0 || o.dead || o.hp <= 0) continue;

      ctx.save();

      if (o.kind === 'enc-pods') {
        if (o.age < o.warn) {
          ctx.beginPath();
          ctx.setLineDash([8, 6]);
          ctx.strokeStyle = (Math.sin(t * 18) > 0) ? '#ff4422' : 'rgba(255, 120, 40, 0.4)';
          ctx.lineWidth = 2;
          ctx.moveTo(o.x, o.y);
          ctx.lineTo(o.targetX, o.targetY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.beginPath();
          ctx.strokeStyle = '#ff3311';
          ctx.lineWidth = 1.5;
          ctx.arc(o.targetX, o.targetY, 14 + Math.sin(t * 12) * 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (o.kind === 'enc-bridge') {
        if (o.anchorIndex === 0 && o.tetherActive) {
          var partner = null;
          for (var p = 0; p < b.objects.length; p++) {
            var cand = b.objects[p];
            if (cand && cand.id === o.pairId && !cand.disabled && cand.tetherActive) {
              partner = cand;
              break;
            }
          }
          if (partner) {
            ctx.beginPath();
            if (o.age < o.warn) {
              ctx.setLineDash([10, 8]);
              ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
              ctx.lineWidth = 3;
            } else {
              ctx.setLineDash([]);
              ctx.strokeStyle = '#00ffff';
              ctx.lineWidth = 5 + Math.sin(t * 30) * 2;
              ctx.shadowColor = '#00ffff';
              ctx.shadowBlur = 12;
            }
            ctx.moveTo(o.x, o.y);
            ctx.lineTo(partner.x, partner.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
          }
        }
      } else if (o.kind === 'enc-winch') {
        if (o.age < o.warn) {
          ctx.beginPath();
          ctx.setLineDash([6, 6]);
          ctx.strokeStyle = (Math.sin(t * 22) > 0) ? '#ff2222' : 'rgba(255, 50, 50, 0.3)';
          ctx.lineWidth = 2;
          ctx.moveTo(o.originX, o.originY);
          ctx.lineTo(o.targetX, o.targetY);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.beginPath();
          ctx.strokeStyle = '#cccccc';
          ctx.lineWidth = 4;
          ctx.moveTo(o.originX, o.originY);
          ctx.lineTo(o.x, o.y);
          ctx.stroke();

          ctx.beginPath();
          ctx.fillStyle = '#ffaa00';
          ctx.arc(o.x, o.y, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (o.kind === 'enc-well') {
        ctx.beginPath();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = o.mode === 'pull' ? 'rgba(180, 60, 255, 0.4)' : 'rgba(255, 100, 200, 0.4)';
        ctx.lineWidth = 2;
        ctx.arc(o.x, o.y, o.fieldR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.strokeStyle = '#00ffaa';
        ctx.lineWidth = 3;
        ctx.arc(o.x, o.y, o.safeR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 255, 170, 0.2)';
        ctx.arc(o.x, o.y, o.safeR - 8, 0, Math.PI * 2);
        ctx.stroke();
      } else if (o.kind === 'enc-gate') {
        if (!o.cut && !o.disabled) {
          ctx.beginPath();
          if (o.age < o.warn) {
            ctx.setLineDash([8, 8]);
            ctx.strokeStyle = 'rgba(255, 200, 40, 0.5)';
            ctx.lineWidth = 2;
          } else {
            ctx.setLineDash([]);
            ctx.strokeStyle = '#ffbb00';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#ffaa00';
            ctx.shadowBlur = 8;
          }
          ctx.moveTo(o.x, o.y);
          ctx.lineTo(o.x, 720);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;
        } else {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(80, 255, 80, 0.4)';
          ctx.lineWidth = 2;
          ctx.strokeRect(o.x - 30, o.y, 60, 720 - o.y);
        }
      } else if (o.kind === 'enc-drones') {
        if (o.isLeader) {
          ctx.beginPath();
          ctx.strokeStyle = '#ff2255';
          ctx.lineWidth = 2;
          ctx.arc(o.targetX, o.targetY, 16 + Math.sin(t * 15) * 5, 0, Math.PI * 2);
          ctx.moveTo(o.targetX - 22, o.targetY);
          ctx.lineTo(o.targetX + 22, o.targetY);
          ctx.moveTo(o.targetX, o.targetY - 22);
          ctx.lineTo(o.targetX, o.targetY + 22);
          ctx.stroke();
        } else if (o.age < o.warn) {
          ctx.beginPath();
          ctx.setLineDash([6, 6]);
          ctx.strokeStyle = 'rgba(255, 80, 80, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.moveTo(o.x, o.y);
          ctx.quadraticCurveTo(o.x + (o.side * -180), o.y + 240, o.targetX + (o.side * 140), 720);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else if (o.kind === 'enc-rotor') {
        var baseRot = o.age < o.warn ? o.angle : o.heading;
        for (var armIdx = 0; armIdx < o.arms; armIdx++) {
          var aAngle = baseRot + (armIdx * (Math.PI * 2 / o.arms));
          var endX = o.x + Math.cos(aAngle) * o.armLength;
          var endY = o.y + Math.sin(aAngle) * o.armLength;

          ctx.beginPath();
          if (o.age < o.warn) {
            ctx.setLineDash([8, 8]);
            ctx.strokeStyle = (Math.sin(t * 20 + armIdx) > 0) ? '#ff3344' : 'rgba(255, 50, 70, 0.3)';
            ctx.lineWidth = 2;
          } else {
            ctx.setLineDash([]);
            ctx.strokeStyle = '#ff1144';
            ctx.lineWidth = 5;
            ctx.shadowColor = '#ff2255';
            ctx.shadowBlur = 10;
          }
          ctx.moveTo(o.x, o.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;

          var gapMidAngle = aAngle + (Math.PI / o.arms);
          var gx = o.x + Math.cos(gapMidAngle) * 90;
          var gy = o.y + Math.sin(gapMidAngle) * 90;
          ctx.beginPath();
          ctx.fillStyle = 'rgba(0, 255, 180, 0.3)';
          ctx.arc(gx, gy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      var drawn = false;
      if (window.SpaceBossFX && typeof window.SpaceBossFX.drawSkill === 'function') {
        try {
          drawn = window.SpaceBossFX.drawSkill(ctx, b.index, o.skillIndex, o.x, o.y, o.r * 2, t, o.heading || 0);
        } catch (err) {
          drawn = false;
        }
      }

      if (!drawn) {
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fillStyle = o.disabled ? '#555555' : '#22283a';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#88aacc';
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = o.age < o.warn ? '#ffaa00' : '#ff2244';
      ctx.stroke();

      if (o.maxHp && o.hp > 0 && o.hp < o.maxHp) {
        var pct = clamp(o.hp / o.maxHp, 0, 1);
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r + 5, -Math.PI * 0.5, -Math.PI * 0.5 + (Math.PI * 2 * pct));
        ctx.strokeStyle = '#00ff66';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  function destroy(b, o, api) {
    if (!o || o.dead || o.destroyed) return;
    o.destroyed = true;
    o.hp = 0;
    o.dead = true;
    o.disabled = true;

    if (api && typeof api.burst === 'function') {
      api.burst(o.x, o.y, '#ffffff', 14);
      api.burst(o.x, o.y, '#ff4400', 8);
    }

    if (o.kind === 'enc-bridge') {
      if (b && Array.isArray(b.objects)) {
        for (var i = 0; i < b.objects.length; i++) {
          var pair = b.objects[i];
          if (pair && pair !== o && (pair.id === o.pairId || (o.groupId && pair.groupId === o.groupId && pair.kind === 'enc-bridge'))) {
            pair.tetherActive = false;
            pair.disabled = true;
            if (api && typeof api.burst === 'function') {
              api.burst(pair.x, pair.y, '#00e1ff', 12);
            }
          }
        }
      }
    } else if (o.isLeader || (o.kind === 'enc-drones' && o.role === 'leader')) {
      if (b && Array.isArray(b.objects)) {
        for (var d = 0; d < b.objects.length; d++) {
          var drone = b.objects[d];
          if (drone && drone !== o && (drone.leaderId === o.id || (o.groupId && drone.groupId === o.groupId))) {
            drone.disabled = true;
            drone.hp = 0;
            drone.dead = true;
            if (api && typeof api.burst === 'function') {
              api.burst(drone.x, drone.y, '#ffaa22', 8);
            }
          }
        }
      }
    } else if (o.kind === 'enc-gate') {
      o.cut = true;
      o.disabled = true;
      if (api && typeof api.burst === 'function') {
        api.burst(o.x, o.y, '#ffee66', 10);
      }
    } else if (o.kind === 'enc-rotor') {
      o.disabled = true;
      if (api && typeof api.burst === 'function') {
        api.burst(o.x, o.y, '#ff2277', 18);
      }
    }
  }

  return {
    seed: seed,
    update: update,
    draw: draw,
    destroy: destroy
  };
})();
(function() {
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  // Antigravity's Beacon controller: the cast owns aim; the boss owns waves in flight.
  const BeaconPatterns = (() => {
    const halfGap = 14 * Math.PI / 180;
    function opening(a) {
      // Snapshots from the pre-random version have only the original aim.
      return a.beaconGap ?? Math.atan2(a.py-a.y,a.px-a.x);
    }
    function chooseOpening(a) {
      const y=Math.max(a.y+160,a.py);
      const min=Math.atan2(y-a.y,1220-a.x);
      const max=Math.atan2(y-a.y,60-a.x);
      return min+(window.SpaceFlightRandom?.() ?? Math.random())*(max-min);
    }
    // Mirror seven lanes on each wing. Every salvo preserves the same escape corridor.
    const wingAngle = Math.PI * (90 - 9.75) / 180;
    const volleys = [0, .5, .25].map(offset => {
      const wing = Array.from({length:7}, (_, i) => (i + offset) * wingAngle / 6.5);
      return [...wing, ...wing.map(angle => Math.PI - angle).reverse()];
    });
    const fanHalfGap = Math.PI / 2 - wingAngle;
    function chooseCastGap(a) {
      if (a.skillIndex === 0) return chooseOpening(a);
      const dy = Math.max(160, a.py - a.y);
      const left = Math.max(60, a.px - 260);
      const right = Math.min(1220, a.px + 260);
      const targetX = left + (window.SpaceFlightRandom?.() ?? Math.random()) * (right - left);
      return clamp(Math.atan2(dy, targetX - a.x), fanHalfGap + .08, Math.PI - fanHalfGap - .08);
    }
    function fanAngle(angle, gap) {
      // Keep the outer edges of the fan horizontal while shifting its opening.
      if (angle < Math.PI / 2) return angle * (gap - fanHalfGap) / wingAngle;
      return Math.PI - (Math.PI - angle) * (Math.PI - gap - fanHalfGap) / wingAngle;
    }
    function cast(b,a,skill,prev,dt,api) {
      if(a.beaconGap===undefined) a.beaconGap=chooseCastGap(a);
      const crossed = offset => prev < skill.windup+offset && a.t >= skill.windup+offset;
      if(a.skillIndex===1){
        for(let volley=0;volley<3;volley++){
          if(!crossed(volley*.1))continue;
          for(const lane of volleys[volley]){
            const angle=fanAngle(lane,a.beaconGap);
            const h=api.makeHazard(a.x,a.y,angle,a.hard?275:240,'bolt');
            if(h){h.bossIndex=1;h.skillIndex=1;}
          }
        }
      }else if(crossed(0)){
        (b.beaconWaves??=[]).push({
          x:a.x,y:a.y,radius:24,speed:a.hard?300:270,gapAngle:opening(a),
          hit:[],maxRadius:Math.hypot(Math.max(a.x,1280-a.x),Math.max(a.y,720-a.y))+30
        });
      }
    }
    function segments(gap) {return [[gap+halfGap,gap+2*Math.PI-halfGap]];}
    function touches(p,w,previous,arcs) {
      const dx=p.x-w.x,dy=p.y-w.y;
      const radius=Math.hypot(dx,dy),theta=Math.atan2(dy,dx);
      const margin=9+8; // 18px painted band with round caps, plus pilot collision radius.
      if(radius<previous-margin || radius>w.radius+margin)return false;
      return arcs.some(([lo,hi])=>{
        if(hi<=lo)return false;
        const phase=(theta-lo+4*Math.PI)%(2*Math.PI);
        if(phase<=hi-lo)return true;
        // Nearest point on an end-cap's swept radial segment.
        return [lo,hi].some(angle=>{
          const ux=Math.cos(angle),uy=Math.sin(angle);
          const r=Math.max(previous,Math.min(w.radius,dx*ux+dy*uy));
          return Math.hypot(dx-r*ux,dy-r*uy)<=margin;
        });
      });
    }
    function updateWaves(b,dt,api){
      if(!b.beaconWaves?.length)return;
      for(const wave of b.beaconWaves){
        const previous=wave.radius;
        wave.radius+=wave.speed*dt*(api.projectileScale??1);
        const arcs=segments(wave.gapAngle);
        api.pilots.forEach((p,i)=>{
          const seat=api.pilotSeat?.(p)??i;
          if(p.hp<=0 || wave.hit.includes(seat) || !touches(p,wave,previous,arcs))return;
          wave.hit.push(seat);
          api.damage(p);
        });
      }
      b.beaconWaves=b.beaconWaves.filter(w=>w.radius<=w.maxRadius);
    }
    function stroke(ctx,x,y,r,parts,width,color){
      ctx.lineWidth=width;ctx.strokeStyle=color;
      for(const [lo,hi] of parts){
        if(hi<=lo)continue;
        ctx.beginPath();ctx.arc(x,y,r,lo,hi);ctx.stroke();
      }
    }
    function drawWaves(ctx,b){
      if(!b.beaconWaves?.length)return;
      ctx.save();
      ctx.lineCap='round';
      for(const wave of b.beaconWaves){
        const {x,y,radius:r,gapAngle}=wave;
        const parts=segments(gapAngle);
        if(parts.every(([lo,hi])=>window.SpaceBossFX?.waveArc?.(ctx,x,y,r,lo,hi,18,b.clock)))continue;
        stroke(ctx,x,y,r,parts,18,'#158aa9bd');
        stroke(ctx,x,y,r-5,parts,1.5,'#8de8ef');
        stroke(ctx,x,y,r,parts,3,'#e3ffff');
        stroke(ctx,x,y,r+5,parts,2,'#63eaf5');
        ctx.fillStyle='#cbfffa';
        for(const angle of [gapAngle-halfGap,gapAngle+halfGap]){
          ctx.beginPath();ctx.arc(x+r*Math.cos(angle),y+r*Math.sin(angle),5,0,Math.PI*2);ctx.fill();
        }
      }
      ctx.restore();
    }
    function drawWarning(ctx,b,a,s){
      if(!a || a.t>=s.windup)return;
      const progress=a.t/s.windup;
      ctx.save();
      const radius=40+progress*98;
      if(a.skillIndex===1){
        ctx.setLineDash([4,6]);ctx.lineWidth=1.5;ctx.strokeStyle='#ffc368ac';
        const gap=a.beaconGap ?? Math.PI/2;
        ctx.strokeStyle='#afffe0ac';
        for(const edge of [gap-fanHalfGap,gap+fanHalfGap]){
          ctx.beginPath();ctx.moveTo(a.x+Math.cos(edge)*24,a.y+Math.sin(edge)*24);
          ctx.lineTo(a.x+Math.cos(edge)*420,a.y+Math.sin(edge)*420);ctx.stroke();
        }
        ctx.strokeStyle='#ffc368ac';
        for(const lane of volleys[0]){
          const angle=fanAngle(lane,gap);
          ctx.beginPath();ctx.moveTo(a.x+Math.cos(angle)*24,a.y+Math.sin(angle)*24);
          ctx.lineTo(a.x+Math.cos(angle)*radius,a.y+Math.sin(angle)*radius);ctx.stroke();
        }
      }else{
        const gap=opening(a);
        stroke(ctx,a.x,a.y,radius,segments(gap),3,'#6bedff');
        ctx.setLineDash([3,5]);ctx.strokeStyle='#afffe0ac';ctx.lineWidth=1.5;
        for(const edge of [gap-halfGap,gap+halfGap]){
          ctx.beginPath();ctx.moveTo(a.x+Math.cos(edge)*24,a.y+Math.sin(edge)*24);
          ctx.lineTo(a.x+Math.cos(edge)*420,a.y+Math.sin(edge)*420);ctx.stroke();
        }
      }
      ctx.restore();
    }
    return {volleys,cast,updateWaves,drawWaves,drawWarning,chooseCastGap};
  })();

const RailPatterns = (() => {
  const DEG2RAD = Math.PI / 180;
  const RANGE = 1600;

  function setSector(a,t){
    const initial=8*DEG2RAD, p=Math.min(1,Math.max(0,t/5));
    const lower=a.aim-initial, upper=a.aim+initial;
    // All playable corners lie below the bow. In y-down coordinates their bearings are in [0,pi].
    const corners=[[28,344],[1252,344],[28,678],[1252,678]];
    const bearings=corners.map(([x,y])=>Math.atan2(y-a.cy,x-a.cx));
    const lowEnd=Math.min(lower,...bearings)-DEG2RAD;
    const highEnd=Math.max(upper,...bearings)+DEG2RAD;
    const low=lower+(lowEnd-lower)*p, high=upper+(highEnd-upper)*p;
    a.ang=(high+low)/2;
    a.halfAngle=(high-low)/2;
  }

  const escortHold = .55;
  function updateEscorts(b, api) {
    if (!b.railEscorts) {
      b.railEscorts = [-1,1].map(side => ({
        side, phaseX:(window.SpaceFlightRandom?.() ?? Math.random())*Math.PI*2, phaseY:(window.SpaceFlightRandom?.() ?? Math.random())*Math.PI*2,
        rateX:.8+(window.SpaceFlightRandom?.() ?? Math.random())*.55, rateY:1+(window.SpaceFlightRandom?.() ?? Math.random())*.65,
        aimX:640, aimY:600, lockBeat:-1, hit:[]
      }));
    }
    const period=window.SpaceBosses.cooldown(b,3), escortChargeStart=period-1;
    const beat=Math.floor((b.clock+1e-9)/period);
    const elapsed=Math.max(0,b.clock-beat*period);
    const living=api.pilots.filter(p=>p.hp>0);
    for(const [i,ship] of b.railEscorts.entries()){
      if(elapsed>=escortChargeStart && ship.lockBeat!==beat+1 && living.length){
        const target=living[(beat+i)%living.length];
        ship.aimX=target.x;ship.aimY=target.y;ship.lockBeat=beat+1;ship.hit=[];
      }
      if(beat===0 || elapsed>=escortHold || ship.lockBeat!==beat)continue;
      const m=escortMuzzle(b,ship);
      for(const p of living){
        const seat=api.pilotSeat?.(p) ?? api.pilots.indexOf(p);
        const x=p.x-m.x,y=p.y-m.y,dx=Math.cos(m.angle),dy=Math.sin(m.angle);
        const along=x*dx+y*dy;
        if(!ship.hit.includes(seat) && along>=0 && along<=RANGE && Math.abs(x*dy-y*dx)<=15){
          ship.hit.push(seat);
          // Both beams share one damage allowance per pilot per volley.
          if(!b.railEscorts.some(other=>other!==ship && other.hit.includes(seat)))api.damage(p);
        }
      }
    }
  }
  function escortMuzzle(b,ship){
    const x=b.x+ship.side*(164+42*Math.sin(b.clock*ship.rateX+ship.phaseX));
    const y=b.y+19+45*Math.sin(b.clock*ship.rateY+ship.phaseY);
    return {x,y,angle:Math.atan2(ship.aimY-y,ship.aimX-x)};
  }

  function begin(b, a) {
    a.t = 0;
    a.baseX = b.x;
    a.baseY = b.y;
    a.hitPilots = [];
    a.railVersion = 3;
    a.hold = 0.55;
    a.fireAt = a.skillIndex === 1 ? 1 : 5;
    if (a.skillIndex === 0) {
      a.cx = a.baseX; a.cy = a.baseY + 58;
      a.aim = Math.atan2(a.py - a.cy, a.px - a.cx);
      setSector(a,0);

      a.hits = 0;
      a.locked = false;
    }
  }

  function hit(b, a) {
    if (a.skillIndex === 0 && !a.locked && a.t < a.fireAt) {
      a.hits = (a.hits || 0) + 1;
      if (a.hits >= 5) {
        a.locked = true;
        a.fireAt = a.t + 0.5;
        setSector(a,a.t);
        b.cycle = 0.5 + a.hold + 0.55;
        a.span = a.fireAt + a.hold + 0.55;
      }
    }
  }

  function tick(b, a, previous, dt, api) {
    if (a.skillIndex === 1) return;
    const isDischarging = a.t >= a.fireAt && previous < a.fireAt + a.hold;
    if (!a.locked) setSector(a,a.t);

    if (!isDischarging) return;
    if(previous<a.fireAt)api.sound?.('skill');

    const pilots = api.pilots || [];
    for (let i = 0; i < pilots.length; i++) {
      const p = pilots[i];
      const seat = api.pilotSeat?.(p) ?? i;
      if (p.hp <= 0 || a.hitPilots.includes(seat)) continue;
      let collides = false;

      {
        const dx = p.x - a.cx, dy = p.y - a.cy;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d <= RANGE) {
          const pAngle = Math.atan2(dy, dx);
          let diff = Math.abs(pAngle - a.ang) % (Math.PI * 2);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;
          collides = diff <= a.halfAngle + Math.asin(Math.min(1, 8 / d));
        }
      }

      if (collides) {
        a.hitPilots.push(seat);
        api.damage(p);

      }
    }
  }

  function draw(ctx, b, a, time) {
    if(a.skillIndex===1)return;
    ctx.save();
    {
      const lockProg = Math.min(1, a.t / a.fireAt);
      const isFire = a.t >= a.fireAt && a.t < a.fireAt + 0.55;
      const isGlow = a.t >= a.fireAt + 0.55 && a.t < a.fireAt + 0.90;

      if (a.t < a.fireAt) {
        const r = a.locked ? 255 : Math.floor(220 + 35 * lockProg);
        const g = a.locked ? 35 : Math.floor(220 * (1 - lockProg * 0.8));
        ctx.fillStyle = `rgba(${r}, ${g}, 20, ${0.12 + 0.08 * Math.sin(time * 12)})`;
        ctx.strokeStyle = `rgb(${r}, ${g}, 20)`;
        ctx.lineWidth = a.locked ? 2.5 : 1.5;

        ctx.beginPath();
        ctx.moveTo(a.cx, a.cy);
        ctx.arc(a.cx, a.cy, RANGE, a.ang - a.halfAngle, a.ang + a.halfAngle);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (isFire) {
        ctx.fillStyle = "rgba(255, 40, 40, 0.65)";
        ctx.strokeStyle = "#fff0f0";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(a.cx, a.cy);
        ctx.arc(a.cx, a.cy, RANGE, a.ang - a.halfAngle, a.ang + a.halfAngle);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (isGlow) {
        const fade = 1 - (a.t - (a.fireAt + 0.55)) / 0.35;
        ctx.fillStyle = `rgba(255, 60, 30, ${0.28 * fade})`;
        ctx.beginPath();
        ctx.moveTo(a.cx, a.cy);
        ctx.arc(a.cx, a.cy, RANGE, a.ang - a.halfAngle, a.ang + a.halfAngle);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function trace(ctx,m){
    ctx.beginPath();ctx.moveTo(m.x,m.y);
    ctx.lineTo(m.x+Math.cos(m.angle)*RANGE,m.y+Math.sin(m.angle)*RANGE);ctx.stroke();
  }

  function chargeOrb(ctx,x,y,f,t,id){
    ctx.save();
    const radius=2+8*f;
    for(let i=0;i<9;i++){
      const phase=(t*2.8+i/9)%1, angle=i*2.4+id+phase*.85;
      const distance=radius+(1-phase)*34;
      const dx=Math.cos(angle),dy=Math.sin(angle);
      ctx.strokeStyle=i%3===0?'#dbfff8':'#5ad5ed';
      ctx.lineWidth=i%3===0?2:1;
      ctx.beginPath();ctx.moveTo(x+dx*(distance+5),y+dy*(distance+5));
      ctx.lineTo(x+dx*distance-dy*2,y+dy*distance+dx*2);
      ctx.lineTo(x+dx*(distance-4),y+dy*(distance-4));ctx.stroke();
    }
    if(window.SpaceMinerArt?.sprite(ctx,5,x,y,Math.round(radius*2.5))){ctx.restore();return;}
    ctx.fillStyle='#2395b8';ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#deffff';ctx.beginPath();ctx.arc(x,y,radius*.54,0,Math.PI*2);ctx.fill();ctx.restore();
  }

  function drawGuns(ctx,b,a,time){
    ctx.save();
    const period=window.SpaceBosses.cooldown(b,3), escortChargeStart=period-1;
    const beat=Math.floor((b.clock+1e-9)/period);
    const elapsed=Math.max(0,b.clock-beat*period);
    for(const ship of b.railEscorts || []){
        const side=ship.side, m=escortMuzzle(b,ship);
        const charging=ship.lockBeat===beat+1 && elapsed>=escortChargeStart;
        const firing=beat>0 && ship.lockBeat===beat && elapsed<escortHold;
        const charge=charging ? elapsed-escortChargeStart : 0;
        if(charging){
          ctx.setLineDash([4,7]);ctx.strokeStyle='#59d7ffad';ctx.lineWidth=2;
          trace(ctx,m);ctx.setLineDash([]);
        }else if(firing && !window.SpaceBossFX?.strip?.(ctx,3,m.x,m.y,m.x+Math.cos(m.angle)*RANGE,m.y+Math.sin(m.angle)*RANGE,14,time)){
          for(const [color,width] of [['#258ab6',14],['#6ff3ff',7],['#ffffff',2]]){
            ctx.strokeStyle=color;ctx.lineWidth=width;trace(ctx,m);
          }
        }
        if(!window.SpaceBossFX?.drawRailEscort?.(ctx,m.x,m.y,m.angle,side,charge)){
          // Keep each escort readable even before its artwork is available.
          ctx.save();ctx.translate(m.x,m.y);ctx.rotate(m.angle-Math.PI/2);
          ctx.fillStyle='#20374d';
          ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(12,-20);ctx.lineTo(18,-31);
          ctx.lineTo(6,-27);ctx.lineTo(3,-33);ctx.lineTo(-3,-33);ctx.lineTo(-6,-27);
          ctx.lineTo(-18,-31);ctx.lineTo(-12,-20);ctx.closePath();ctx.fill();
          ctx.fillStyle='#70c5df';ctx.fillRect(-3,-20,6,9);
          ctx.fillStyle='#efaa49';ctx.fillRect(-3,-36,6,4);ctx.restore();
        }
        if(charging)chargeOrb(ctx,m.x,m.y,charge,time,side);
    }
    if(a?.skillIndex===0 && a.railVersion===3){
      const f=a.locked?Math.max(0,(a.fireAt-.5)/5):Math.min(1,a.t/5);
      if(a.t<a.fireAt){
        chargeOrb(ctx,a.cx,a.cy,f,time,2);
        for(let i=0;i<5;i++){
          ctx.fillStyle=i<a.hits?'#ffe188':'#364756';
          ctx.fillRect(Math.round(b.x)-16+i*7,Math.round(b.y+70),5,4);
        }
      }
    }
    ctx.restore();
  }

  return { begin, tick, hit, draw, drawGuns, updateEscorts };
})();

function drawHoundBay(ctx, x, y, skill, charge, angle) {
  const c = Math.max(0, Math.min(1, charge));
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(angle);

  // The hull already depicts the doors. Illuminate the active aperture in place.
  ctx.fillStyle = skill === 0 ? '#ff5861' : skill === 1 ? '#ffaf54' : '#c1a6ff';
  ctx.globalAlpha *= .4 + .6 * c;
  if(!window.SpaceMinerArt?.sprite(ctx,5,0,0,8+6*c))ctx.fillRect(-3,-2,6,4);
  ctx.translate(-14,0);

  if (skill === 0) {
    const range = 24 + Math.floor(c * 64);
    const spread = Math.floor((1 - c) * 7);
    ctx.fillStyle = `rgba(255, 51, 68, ${0.4 + c * 0.6})`;
    [-spread, 0, spread].forEach((offY) => {
      for (let px = 14; px < 14 + range; px += 4) {
        ctx.fillRect(px, offY, 2, 1);
      }
      const rx = 14 + range;
      ctx.fillRect(rx, offY - 2, 1, 5);
      ctx.fillRect(rx - 2, offY, 5, 1);
    });
    if (c > 0.75) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(13, -1, 3, 3);
    }
  } else if (skill === 1) {
    const reach = 18 + Math.floor(c * 54);
    const halfWidth = 5 + Math.floor(c * 18);
    ctx.fillStyle = `rgba(255, 152, 40, ${0.12 + c * 0.28})`;
    for (let dx = 0; dx < reach; dx += 2) {
      const h = Math.floor((dx / reach) * halfWidth);
      ctx.fillRect(14 + dx, -h, 2, h * 2 + 1);
    }
    ctx.fillStyle = `rgba(255, 213, 120, ${0.6 + c * 0.4})`;
    for (let dx = 0; dx < reach; dx += 4) {
      const h = Math.floor((dx / reach) * halfWidth);
      ctx.fillRect(14 + dx, -h, 3, 1);
      ctx.fillRect(14 + dx, h, 3, 1);
    }
    const spark = Math.floor((c * 23) % 5) - 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(14, spark - 3, 2, 2);
    ctx.fillRect(16, -spark + 2, 2, 2);
  } else {
    const jawDist = Math.max(2, Math.floor((1 - c) * 20));
    const boreLen = 14 + Math.floor(c * 72);

    ctx.fillStyle = `rgba(170, 133, 255, ${0.3 + c * 0.5})`;
    ctx.fillRect(14, -1, boreLen, 3);
    ctx.fillStyle = '#ead4ff';
    ctx.fillRect(14, 0, boreLen, 1);

    const toothColor = c > 0.85 && Math.floor(c * 30) % 2 === 0 ? '#ffffff' : '#9762ff';
    ctx.fillStyle = toothColor;
    for (let i = 0; i < 3; i++) {
      const kx = 18 + i * 16;
      const ky = jawDist + i * 2;
      ctx.fillRect(kx, -ky, 4, 2);
      ctx.fillRect(kx + 1, -ky + 2, 2, 2);
      ctx.fillRect(kx, ky - 2, 4, 2);
      ctx.fillRect(kx + 1, ky - 4, 2, 2);
    }

    const p = Math.floor((1 - (c * 2.5) % 1) * 28);
    ctx.fillStyle = '#d8b4ff';
    ctx.fillRect(14 + p, -3, 2, 2);
    ctx.fillRect(14 + p, 2, 2, 2);
  }

  ctx.restore();
}


  const HoundPatterns = (() => {
    const cellSize = 128;
    const hullExtent = Math.round(172 * 1.1);
    const portRows = [35.5,46,56.5,67,77.5];
    const volleyCounts = [4,6,1];
    function launchPorts(b, skill, round) {
      // The sixth rain pair reuses the first physical bay. Duo splitters use two separated bay pairs.
      const rows = skill === 2 ? (b.coop ? [4,1] : [4]) : [round % portRows.length];
      const left = Math.round(b.x-hullExtent/2), top = Math.round(b.y-hullExtent/2);
      return rows.flatMap(row => [-1,1].map(side => ({
        side,
        x:left + (side < 0 ? 33.5 : 93.5)*hullExtent/cellSize,
        y:top + portRows[row]*hullExtent/cellSize
      })));
    }
    function cast(b, a, skill, prev, sys) {
      const arc = a.skillIndex === 1;
      const volleys = volleyCounts[a.skillIndex];
      const livingPilots = sys.pilots.filter(p => p.hp > 0);
      for (let round = 0; round < volleys; round++) {
        const launchAt = skill.windup + round * .1;
        if (prev >= launchAt || a.t < launchAt) continue;
        const living = a.skillIndex === 0
          ? (sys.hazards || []).filter(h => h.houndKind === 'persistent' && h.life > 0 && h.hp !== 0)
          : [];
        const ports = launchPorts(b,a.skillIndex,round);
        // Pick three homing children across the entire cast before any mother can be intercepted.
        const seekers = [];
        if (a.skillIndex === 2) {
          const slots = Array.from({length:ports.length*6}, (_, i) => i);
          for (let i=0;i<3;i++) seekers.push(slots.splice(Math.floor((window.SpaceFlightRandom?.() ?? Math.random())*slots.length),1)[0]);
        }
        for (const [mount,{side,x,y}] of ports.entries()) {
          if (a.skillIndex === 0 && (living.filter(h => h.houndSide === side).length >= volleys)) continue;
          const pilot = livingPilots[(a.turn - 1 + (side === 1 ? 1 : 0)) % Math.max(livingPilots.length,1)];
          const aim = Math.atan2((pilot?.y ?? a.py) - y, (pilot?.x ?? a.px) - x);
          const angle = arc ? Math.PI / 2 - side * (1.38 - round * .11)
                            : a.skillIndex === 0 ? aim - side * .42 : (side < 0 ? Math.PI : 0);
          const missile = sys.makeHazard(x,y,angle,a.hard ? skill.hardSpeed : skill.speed,'missile');
          if (!missile) continue;
          Object.assign(missile, {
            bossIndex:3, skillIndex:a.skillIndex, houndKind:skill.missileKind,
            houndAge:0, houndSide:side, color:skill.color,
            targetSeat:pilot ? (sys.pilotSeat?.(pilot) ?? sys.pilots.indexOf(pilot)) : 0
          });
          if (arc) {
            missile.houndArcTime = .48;
            missile.houndHomingTime = 1;
          } else if (a.skillIndex === 2) {
            missile.houndSplitAt = .95;
            missile.seekerSlots = seekers.filter(slot => Math.floor(slot / 6) === mount).map(slot => slot % 6);
          } else {
            living.push(missile);
          }
        }
      }
      if(a.t >= a.span) a.active = false;
    }
    function draw(ctx,b,a,skill) {
      const lastRound = volleyCounts[a.skillIndex]-1;
      if (!a.active || a.t > skill.windup + .1 * lastRound) return;
      const charge=Math.min(1,a.t / skill.windup);
      const round = clamp(Math.floor((a.t-skill.windup)/.1)+1,0,lastRound);
      for (const {side,x,y} of launchPorts(b,a.skillIndex,round)) {
        const angle=a.skillIndex===0 ? Math.atan2(a.py-y,a.px-x)-side*.42
          : a.skillIndex===1 ? Math.PI/2-side*(1.38-round*.11) : (side<0 ? Math.PI : 0);
        drawHoundBay(ctx,x,y,a.skillIndex,charge,angle);
      }
    }
    return {cast,draw,hullExtent};
  })();



  function begin(b, a, s) {
    if (!a) a = b.attack = {};
    a.name = s ? s.name || '' : '';
    a.skillIndex = (a.skillIndex != null) ? a.skillIndex : (b.index || 0);
    a.x = (a.x != null) ? a.x : (b.x != null ? b.x : 640);
    a.y = (a.y != null) ? a.y : (b.y != null ? b.y : 150);
    a.startX = a.x;
    a.startY = a.y;
    a.px = clamp((a.px != null) ? a.px : 640, b.index===2?28:90, b.index===2?1252:1190);
    a.py = clamp((a.py != null) ? a.py : 580, 140, b.index===2?678:660);
    a.side = a.side === -1 ? -1 : 1;
    a.t = 0;
    a.prevT = -0.0001;
    a.active = true;
    a.lanes = [];
    a.rays = [];
    a.mines = [];
    if(b.index===1) a.beaconGap=BeaconPatterns.chooseCastGap(a);
    if(b.index===2)RailPatterns.begin(b,a);
    if(b.index===3)a.houndVersion=1;
    return a;
  }

  function tick(b, a, s, prev, dt, sys) {
    if (!a || !a.active || a.cancelled || !s || !s.events) return;
    if(b.index===1){BeaconPatterns.cast(b,a,s,prev,dt,sys);return;}
    if(b.index===2){RailPatterns.tick(b,a,prev,dt,sys);return;}
    if(b.index===3){HoundPatterns.cast(b,a,s,prev,sys);return;}
    const t = a.t;
    const pt = (a.prevT != null) ? a.prevT : (t - (dt || 0.016));
    const players = sys.pilots.filter(p=>p.hp>0);
    const pilot=players[(a.turn-1)%Math.max(1,players.length)];
    if(pilot && b.index===1 && a.t<Math.max(0,s.windup-.45)){
      a.px=clamp(pilot.x,28,1252);a.py=pilot.y;
    }
    let maxEnd = (s.windup || 0) + (s.cooldown || 0.5);

    for (let i = 0; i < s.events.length; i++) {
      const e=s.events[i];
      if(b.index===10 && b.phase<3 && e.mount!==undefined && !b.units.some(u=>u.id==='unit'+e.mount && u.hp>0))continue;
      const reps = e.repeat ?? 1;
      const step = e.interval ?? 0.35;
      const dur = (e.type === 'rail' || e.type === 'ray') ? (e.duration ?? 0.8) : 0;
      const twin=b.index===5?window.SpaceBosses.hulls(b)[1]-b.x:0;
      const ox = b.index===5 ? b.x+Math.sign(e.dx||a.side)*twin : a.x+(e.dx||0);
      const oy = a.y + (e.dy || 0);
      const tx = clamp(a.px + (e.offset || 0) * a.side, 90, 1190);
      const ty = clamp(a.py, 120, 650);

      for (let k = 0; k < reps; k++) {
        const tf = (s.windup || 0) + (e.at || 0) + k * step;
        const warnStart=tf-s.windup;
        if(pt<warnStart && t>=warnStart){
          if(e.type==='mine'){
            const x=clamp(a.px+(e.offset||0)*a.side,100,1180),y=clamp(a.py-125+(e.dy||0),90,530);
            b.objects.push({id:'f'+(++b.serial),kind:'enc-fuse',x,y,r:14,hp:2,skillIndex:a.skillIndex,token:i+'-'+k});
          }else window.SpaceEncounterObjects?.seed(b,a,{...e,warn:s.windup},k);
        }
        const te = tf + dur;
        if (te > maxEnd) maxEnd = te;

        if (pt < tf && t >= tf) {
          if(e.type==='orbit'){
            const sling=b.index===8 && a.skillIndex===4;
            const n=sling?1:3, speed=sling?2.9:2;
            for(let j=0;j<n;j++){
              const hubX=sling?clamp(a.x+a.side*350,120,1160):a.x;
              const hubY=sling?205:200;
              const hold=sling?1.25:1.3+j*.4;
              const releaseAngle=sling?a.side*.48:(j-1)*.42;
              const start=releaseAngle-speed*hold;
              const radius=sling?87:58+j*9;
              const h=sys.makeHazard(hubX+Math.cos(start)*radius,hubY+Math.sin(start)*radius,0,0,'debris');
              if(h){
                h.bossIndex=b.index;h.skillIndex=a.skillIndex;h.life=7;
                h.orbit={x:hubX,y:hubY,start,radius,hold,t:0,speed,release:a.hard?315:260};
              }
            }
          }else if (e.type === 'fan') {
            const count = e.count ?? 5;
            const spd = (a.hard ? e.hardSpeed : undefined) ?? e.speed ?? 320;
            const spr = (a.hard ? e.hardSpread : undefined) ?? e.spread ?? 0.15;
            const baseA = Math.atan2(ty - oy, tx - ox) + a.side*(e.angle || 0)*Math.PI/180;
            for (let j = 0; j < count; j++) {
              const ang = baseA + (j - (count - 1) / 2) * spr;
              const h = sys.makeHazard(ox, oy, ang, spd, 'bolt');
              if (h) { if(e.gravity)h.gravity=e.gravity; h.bossIndex = b.index; h.skillIndex = a.skillIndex; if (e.color) h.color = e.color; }
            }
          } else if (e.type === 'ring') {
            const count = e.count ?? 12;
            const spd = (a.hard ? e.hardSpeed : undefined) ?? e.speed ?? 260;
            const baseA = ((e.angle || 0) * Math.PI) / 180;
            for (let j = 0; j < count; j++) {
              const ang = baseA + (j * Math.PI * 2) / count;
              const h = sys.makeHazard(ox, oy, ang, spd, 'bolt');
              if (h) { if(e.gravity)h.gravity=e.gravity; h.bossIndex = b.index; h.skillIndex = a.skillIndex; if (e.color) h.color = e.color; }
            }
          } else if (e.type === 'missiles') {
            const count = e.count ?? 2;
            const spd = (a.hard ? e.hardSpeed : undefined) ?? e.speed ?? 230;
            const baseA = Math.atan2(ty - oy, tx - ox) + a.side*(e.angle || 0)*Math.PI/180;
            for (let j = 0; j < count; j++) {
              const ang = baseA + (j - (count - 1) / 2) * (e.spread ?? 0.24);
              const h = sys.makeHazard(ox, oy, ang, spd, 'missile');
              if (h) {
                h.bossIndex = b.index;
                h.skillIndex = a.skillIndex;
                h.lock = (e.lock !== undefined) ? e.lock : true;
                h.targetX = tx;
                h.targetY = ty;
                if (e.color) h.color = e.color;
              }
            }
          } else if (e.type === 'mine') {
            const fuse=b.objects.find(o=>o.kind==='enc-fuse' && o.token===i+'-'+k && o.hp>0);
            if(!fuse)continue;
            const mx = clamp(a.px + (e.offset || 0) * a.side, 100, 1180);
            const my = clamp(a.py - 125 + (e.dy || 0), 90, 530);
            fuse.hp=0;
            sys.sound?.('mine');
            sys.burst(mx, my, e.color || '#ffc76d', 10);
            const count = e.count ?? 8;
            const spd = (a.hard ? e.hardSpeed : undefined) ?? e.speed ?? 210;
            const pilotA = Math.atan2(a.py - my, a.px - mx);
            for (let j = 0; j < count; j++) {
              const ang = (j * Math.PI * 2) / count;
              const diff = Math.abs(Math.atan2(Math.sin(ang - pilotA), Math.cos(ang - pilotA)));
              if (diff < 0.45) continue;
              const h = sys.makeHazard(mx, my, ang, spd, 'bolt');
              if (h) { if(e.gravity)h.gravity=e.gravity; h.bossIndex = b.index; h.skillIndex = a.skillIndex; if (e.color) h.color = e.color; }
            }
          }
        }

        if (t >= tf && t < te && sys.damage) {
          const prog = dur > 0 ? (t - tf) / dur : 0;
          if (e.type === 'rail') {
            const eased = prog * prog * (3 - 2 * prog);
            const rx = clamp(tx + (e.travel || 0) * a.side * eased, 40, 1240);
            const hw = (e.width ?? 48) / 2;
            for (let p of players) {
              if (p && Math.abs(p.x - rx) < hw) sys.damage(p);
            }
          } else if (e.type === 'ray') {
            const rox = (a.startX ?? a.x) + (e.dx || 0);
            const roy = (a.startY ?? a.y) + (e.dy || 0);
            const deg = (e.aimRay ? Math.atan2(a.py-roy,a.px-rox)*180/Math.PI : 90-(e.angle||0)) - prog * (e.travel || 0);
            const rad = (deg * Math.PI) / 180;
            const cos = Math.cos(rad), sin = Math.sin(rad);
            const hw = (e.width ?? 28) / 2;
            for (let p of players) {
              if (!p) continue;
              const pdx = p.x - rox, pdy = p.y - roy;
              const proj = pdx * cos + pdy * sin;
              if (proj > 0) {
                const perp = Math.abs(pdx * sin - pdy * cos);
                if (perp < hw) sys.damage(p);
              }
            }
          }
        }
      }
    }

    if (t >= s.span) a.active = false;
    a.prevT = t;
  }

  function draw(ctx, b, a, s, time) {
    if(b.index===1){BeaconPatterns.drawWarning(ctx,b,a,s);return;}
    if(b.index===2){if(a.railVersion===3)RailPatterns.draw(ctx,b,a,time);return;}
    if(b.index===3)return; // Missile bay lights are rendered over the carrier hull.
    if (!a || !a.active || a.cancelled || !s || !s.events) return;
    const t = a.t;
    const FX = window.SpaceBossFX;
    const drawn = {};

    ctx.save();
    for (let i = 0; i < s.events.length; i++) {
      const e=s.events[i];
      if(b.index===10 && b.phase<3 && e.mount!==undefined && !b.units.some(u=>u.id==='unit'+e.mount && u.hp>0))continue;
      const reps = e.repeat ?? 1;
      const step = e.interval ?? 0.35;
      const dur = (e.type === 'rail' || e.type === 'ray') ? (e.duration ?? 0.8) : 0;
      const warnDur = e.warn ?? s.windup;
      const twin=b.index===5?window.SpaceBosses.hulls(b)[1]-b.x:0;
      const ox = b.index===5 ? b.x+Math.sign(e.dx||a.side)*twin : a.x+(e.dx||0);
      const oy = a.y + (e.dy || 0);
      const tx = clamp(a.px + (e.offset || 0) * a.side, 90, 1190);
      const ty = clamp(a.py, 120, 650);

      for (let k = 0; k < reps; k++) {
        const tf = (s.windup || 0) + (e.at || 0) + k * step;
        const tw = tf - warnDur;
        const te = tf + dur;

        if (t >= tw && t < tf) {
          const wp = (t - tw) / warnDur;
          const alpha = 0.25 + 0.45 * Math.sin(wp * Math.PI);

          if (e.type === 'rail') {
            const w = e.width ?? 48;
            ctx.fillStyle = e.color ? e.color+'28' : `rgba(255,70,70,${alpha * 0.35})`;
            ctx.fillRect(tx - w / 2, 0, w, 720);
            ctx.strokeStyle = e.color || `rgba(255,100,100,${alpha})`;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([8, 8]);
            ctx.lineDashOffset = -time * 50;
            ctx.strokeRect(tx - w / 2, 0, w, 720);
            const key = 'rail_' + k;
            if (!drawn[key]) {
              FX?.drawSkill(ctx, b.index, a.skillIndex, tx, 45, 20, time, 0);
              drawn[key] = true;
            }
          } else if (e.type === 'mine') {
            const fuse=b.objects.find(o=>o.kind==='enc-fuse' && o.token===i+'-'+k && o.hp>0);
            if(!fuse)continue;
            const mx = clamp(a.px + (e.offset || 0) * a.side, 100, 1180);
            const my = clamp(a.py - 125 + (e.dy || 0), 90, 530);
            const r = 24 - 8 * wp;
            ctx.strokeStyle = e.color || `rgba(255,180,60,${alpha})`;
            ctx.lineWidth = 1.8;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(mx, my, Math.max(8, r), 0, Math.PI * 2);
            ctx.stroke();
            const key = 'mine_' + k;
            if (!drawn[key]) {
              FX?.drawSkill(ctx, b.index, a.skillIndex, mx, my, 22, time, 0);
              drawn[key] = true;
            }
          } else if (e.type === 'ray') {
            const rox = (a.startX ?? a.x) + (e.dx || 0);
            const roy = (a.startY ?? a.y) + (e.dy || 0);
            const deg = (e.aimRay ? Math.atan2(a.py-roy,a.px-rox)*180/Math.PI : 90-(e.angle||0));
            const rad = (deg * Math.PI) / 180;
            ctx.strokeStyle = e.color || `rgba(255,60,160,${alpha})`;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([8, 6]);
            ctx.lineDashOffset = -time * 60;
            ctx.beginPath();
            ctx.moveTo(rox, roy);
            ctx.lineTo(rox + Math.cos(rad) * 1400, roy + Math.sin(rad) * 1400);
            ctx.stroke();
            const key = 'ray_' + k;
            if (!drawn[key]) {
              FX?.drawSkill(ctx, b.index, a.skillIndex, rox, roy, 20, time, rad);
              drawn[key] = true;
            }
          } else {
            if (!drawn[e.type]) {
              const ang = Math.atan2(ty - oy, tx - ox) + a.side*(e.angle||0)*Math.PI/180;
              if(e.type==='fan'||e.type==='missiles'){
                ctx.setLineDash([4,6]);ctx.lineWidth=2;ctx.strokeStyle=e.color||'#f1c67a';
                const n=e.count||1;
                const spacing=(a.hard?e.hardSpread:undefined)??e.spread??0;
                for(let j=0;j<n;j++){
                  const ray=ang+(j-(n-1)/2)*spacing;
                  const distance=55+wp*98;
                  ctx.beginPath();ctx.moveTo(ox+Math.cos(ray)*30,oy+Math.sin(ray)*30);
                  ctx.lineTo(ox+Math.cos(ray)*distance,oy+Math.sin(ray)*distance);ctx.stroke();
                }
                ctx.setLineDash([]);
              }
              FX?.drawSkill(ctx, b.index, a.skillIndex, ox, oy, 22, time, ang);
              drawn[e.type] = true;
            }
          }
        }

        if (t >= tf && t < te) {
          const prog = dur > 0 ? (t - tf) / dur : 0;
          if (e.type === 'rail') {
            const eased = prog * prog * (3 - 2 * prog);
            const rx = clamp(tx + (e.travel || 0) * a.side * eased, 40, 1240);
            const w = e.width ?? 48;
            ctx.fillStyle = e.color || 'rgba(255,220,120,0.32)';
            ctx.fillRect(rx - w / 2, 0, w, 720);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.strokeRect(rx - w / 2, 0, w, 720);
            FX?.drawBeam?.(ctx,b.index,a.skillIndex,rx,0,Math.PI/2,720,w,time,e.color);
          } else if (e.type === 'ray') {
            const rox = (a.startX ?? a.x) + (e.dx || 0);
            const roy = (a.startY ?? a.y) + (e.dy || 0);
            const deg = (e.aimRay ? Math.atan2(a.py-roy,a.px-rox)*180/Math.PI : 90-(e.angle||0)) - prog * (e.travel || 0);
            const rad = (deg * Math.PI) / 180;
            const w = e.width ?? 28;
            ctx.strokeStyle = e.color || 'rgba(255,100,200,0.65)';
            ctx.lineWidth = w;
            ctx.lineCap = 'round';
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(rox, roy);
            ctx.lineTo(rox + Math.cos(rad) * 1400, roy + Math.sin(rad) * 1400);
            ctx.stroke();
            FX?.drawBeam?.(ctx,b.index,a.skillIndex,rox,roy,rad,1400,w,time,e.color);
          }
        }
      }
    }
    ctx.restore();
  }

  function steerHazard(h,dt){
    if(h.gravity)h.vy+=h.gravity*dt;
    if(!h.orbit)return;
    const o=h.orbit;
    o.t+=dt;
    const angle=o.start+o.speed*Math.min(o.t,o.hold);
    h.x=o.x+Math.cos(angle)*o.radius;h.y=o.y+Math.sin(angle)*o.radius;
    if(o.t<o.hold){h.vx=0;h.vy=0;return;}
    h.vx=-Math.sin(angle)*o.release*Math.sign(o.speed);
    h.vy=Math.cos(angle)*o.release*Math.sign(o.speed);
    delete h.orbit;
  }
  window.SpaceEncounterEngine = { beaconVolleys:BeaconPatterns.volleys, begin, tick, draw, steerHazard, houndHullExtent:HoundPatterns.hullExtent, drawHoundBays:HoundPatterns.draw, updateRailEscorts:RailPatterns.updateEscorts, railHit:RailPatterns.hit, drawRailGuns:RailPatterns.drawGuns, updateBeaconWaves:BeaconPatterns.updateWaves, drawBeaconWaves:BeaconPatterns.drawWaves };
})();
window.SpaceEncounterSkills = [
[
  {
    "name": "Solar Fan",
    "hint": "The ring has one random opening. Follow the two marked edges.",
    "windup": 0.85,
    "cooldown": 2.5,
    "hardCooldown": 2.5,
    "recovery": 1.65,
    "events": [
      {
        "type": "ripple",
        "at": 0
      }
    ],
    "span": 2.5
  },
  {
    "name": "Echo Fan",
    "hint": "Follow the marked gap. Its direction changes with each cast and holds through all three volleys.",
    "windup": 0.85,
    "cooldown": 2.5,
    "hardCooldown": 2.5,
    "recovery": 1.45,
    "events": [
      {
        "type": "fan",
        "at": 0,
        "repeat": 3,
        "interval": 0.1
      }
    ],
    "span": 2.5
  }
],
[
  {
    "name": "Afterimage Rail",
    "hint": "Five hits stop the widening fan. At full charge, it reaches every flight lane.",
    "windup": 5,
    "cooldown": 7.5,
    "hardCooldown": 5.8,
    "recovery": 0.55,
    "events": [
      {
        "type": "charge-sector"
      }
    ],
    "span": 6.1
  },
  {
    "name": "Twin Rails",
    "hint": "Two roaming escorts charge and fire every three seconds. Cross their marked beams before they flash.",
    "windup": 1,
    "cooldown": 3,
    "hardCooldown": 3,
    "recovery": 0.55,
    "events": [
      {
        "type": "twin-cannon"
      }
    ],
    "span": 2
  }
],
  [
    {
      "name": "Twin Seekers",
      "hint": "Four pairs of homing missiles launch in succession. They self-destruct after four seconds of pursuit.",
      "windup": 0.95,
      "cooldown": 6.5,
      "hardCooldown": 5,
      "recovery": 0.8,
      "span": 1.75,
      "missileKind": "persistent",
      "speed": 217,
      "hardSpeed": 273,
      "color": "#ff696f",
      "events": []
    },
    {
      "name": "Crescent Salvo",
      "hint": "Six missiles peel away from each wing. Move across their path once their one-second lock expires.",
      "windup": 1,
      "cooldown": 8,
      "hardCooldown": 6.2,
      "recovery": 0.8,
      "span": 2.4,
      "missileKind": "arc",
      "speed": 260,
      "hardSpeed": 340,
      "color": "#ffaf54",
      "events": []
    },
    {
      "name": "Brood Splitters",
      "hint": "Intercept the mother missiles before they split into six each. Two launch solo and four in co-op. Three of the fragments can track a pilot for half a second.",
      "windup": 1.1,
      "cooldown": 9.5,
      "hardCooldown": 7.5,
      "recovery": 0.8,
      "span": 2.9,
      "missileKind": "mother",
      "speed": 175,
      "hardSpeed": 210,
      "color": "#b19bff",
      "events": []
    }
  ],
  [
    {"name":"Cluster Mine Salvo","hint":"Three mines drift down every two seconds. Dodge the small mines along the flashing spokes.","windup":0,"cooldown":2,"hardCooldown":2,"events":[],"span":2},
    {"name":"Tether Bridge Mine","hint":"The orb opens near the top. The gate sweeps down one third of the arena; fly around its ends.","windup":0.65,"cooldown":8.5,"hardCooldown":6.8,"events":[],"span":5},
    {"name":"Heavy Anchor Winch","hint":"Four cables pin one ship. Tap the matching arrow or WASD key three times within 1.5 seconds. Failure costs two hull.","windup":0,"cooldown":10,"hardCooldown":8,"events":[],"span":1.5}
  ],
  [
    {
      "name": "Crossing Vents",
      "hint": "Slip through the intersecting seam between twin diagonal streams.",
      "windup": 0.9,
      "cooldown": 6.2,
      "hardCooldown": 4.8,
      "recovery": 0.75,
      "events": [
        {
          "type": "fan",
          "at": 0.0,
          "repeat": 3,
          "interval": 0.21,
          "count": 4,
          "spread": 0.13,
          "speed": 340,
          "hardSpeed": 410,
          "dx": -160,
          "dy": 0,
          "angle": 28,
          "color": "#4da6ff"
        },
        {
          "type": "fan",
          "at": 0.0,
          "repeat": 3,
          "interval": 0.21,
          "count": 4,
          "spread": 0.13,
          "speed": 340,
          "hardSpeed": 410,
          "dx": 160,
          "dy": 0,
          "angle": -28,
          "color": "#a64dff"
        },
        {
          "type": "fan",
          "at": 0.6,
          "dx": -50,
          "dy": 20,
          "count": 3,
          "spread": 0.115,
          "speed": 316,
          "hardSpeed": 350,
          "color": "#92efef"
        }
      ],
      "span": 2.35
    },
    {
      "name": "Shift Change",
      "hint": "Dash into the central pocket before the perimeter ring contracts.",
      "windup": 1.0,
      "cooldown": 8.5,
      "hardCooldown": 6.8,
      "recovery": 0.85,
      "events": [
        {
          "type": "ring",
          "at": 0.3,
          "count": 12,
          "angle": 10,
          "speed": 200,
          "hardSpeed": 230,
          "color": "#66ccff"
        }
      ],
      "span": 2.25
    },
    {
      "name": "Mirrored Lance",
      "hint": "Hold center lane while twin high-speed beams sweep outward.",
      "windup": 0.95,
      "cooldown": 7.5,
      "hardCooldown": 5.8,
      "recovery": 0.8,
      "events": [
        {
          "type": "ray",
          "at": 0.0,
          "dx": -150,
          "dy": 10,
          "angle": 330,
          "travel": -40,
          "width": 52,
          "duration": 0.6,
          "color": "#38bdf8"
        },
        {
          "type": "ray",
          "at": 0.0,
          "dx": 150,
          "dy": 10,
          "angle": 30,
          "travel": 40,
          "width": 52,
          "duration": 0.6,
          "color": "#e879f9"
        }
      ],
      "span": 2.35
    },
    {
      "name": "Broken-Link Burst",
      "hint": "Locate the open wedge in the severed tether explosion.",
      "windup": 1.1,
      "cooldown": 10.5,
      "hardCooldown": 8.2,
      "recovery": 0.9,
      "events": [
        {
          "type": "bridge",
          "at": 0,
          "dx": -130,
          "dy": 0,
          "offset": 260,
          "duration": 1,
          "width": 18,
          "color": "#f43f5e"
        },
        {
          "type": "fan",
          "at": 1.08,
          "count": 5,
          "spread": 0.19,
          "speed": 225,
          "hardSpeed": 275,
          "angle": -52,
          "color": "#fb7185"
        },
        {
          "type": "fan",
          "at": 1.234,
          "count": 5,
          "spread": 0.19,
          "speed": 260,
          "hardSpeed": 310,
          "angle": 52,
          "color": "#fda4af"
        }
      ],
      "span": 3.334
    }
  ],
  Object.entries(window.SpaceDreadnoughtConfig.types).map(([name,spec])=>({
    name:{fan:'Fan Wave',orb:'Expanding Orb',twin:'Twin Crossfire',homing:'Light Homing Missiles',
      shotgun:'Shotgun Missiles',sprinkler:'Sprinkler',laser:'Telegraphed Laser'}[name],
    hint:'Deck weapon. Watch the charge, destroy priority targets and leave the marked fighter corridors.',
    cooldown:spec.cooldown,hardCooldown:spec.cooldown,windup:spec.chargeTime,span:spec.fireDuration,events:[]
  })),
  [
    {
      "name": "Folding Hinges",
      "hint": "Thread through the narrowing center corridor as the folding jaws clamp inward.",
      "windup": 0.9,
      "cooldown": 6.5,
      "hardCooldown": 5.0,
      "recovery": 0.8,
      "events": [
        {
          "type": "ray",
          "at": 0.0,
          "dx": -70,
          "dy": 20,
          "angle": -35.0,
          "travel": 30.0,
          "width": 28,
          "duration": 0.75,
          "color": "#e056fd"
        },
        {
          "type": "ray",
          "at": 0.0,
          "dx": 70,
          "dy": 20,
          "angle": 35.0,
          "travel": -30.0,
          "width": 28,
          "duration": 0.75,
          "color": "#e056fd"
        }
      ],
      "span": 2.45
    },
    {
      "name": "Crosslink",
      "hint": "Break off the diagonal laser lattice and slip through the open outer flank.",
      "windup": 1.0,
      "cooldown": 7.5,
      "hardCooldown": 5.8,
      "recovery": 0.85,
      "events": [
        {
          "type": "bridge",
          "at": 0.0,
          "dx": -260,
          "dy": 60,
          "offset": 220,
          "width": 16,
          "duration": 1.6,
          "color": "#be2edd"
        }
      ],
      "span": 3.45
    },
    {
      "name": "Gate Needles",
      "hint": "Read the four vertical needle lanes early and hold position between beams.",
      "windup": 0.85,
      "cooldown": 6.0,
      "hardCooldown": 4.6,
      "recovery": 0.7,
      "events": [
        {
          "type": "rail",
          "at": 0.0,
          "repeat": 1,
          "interval": 0.14,
          "offset": -172.5,
          "travel": 0,
          "width": 18,
          "duration": 0.55,
          "color": "#686de0"
        },
        {
          "type": "rail",
          "at": 0.13,
          "repeat": 1,
          "interval": 0.14,
          "offset": -57.5,
          "travel": 0,
          "width": 18,
          "duration": 0.55,
          "color": "#686de0"
        },
        {
          "type": "rail",
          "at": 0.26,
          "repeat": 1,
          "interval": 0.14,
          "offset": 57.5,
          "travel": 0,
          "width": 18,
          "duration": 0.55,
          "color": "#686de0"
        },
        {
          "type": "rail",
          "at": 0.39,
          "repeat": 1,
          "interval": 0.14,
          "offset": 172.5,
          "travel": 0,
          "width": 18,
          "duration": 0.55,
          "color": "#686de0"
        }
      ],
      "span": 2.49
    },
    {
      "name": "Hinge Dash",
      "hint": "Clear the 35% sweep path, dodge the three trailing sparks, then punish the braking stall.",
      "windup": 1.05,
      "cooldown": 9.5,
      "hardCooldown": 7.5,
      "recovery": 0.95,
      "events": [
        {
          "type": "ring",
          "at": 0.32,
          "count": 1,
          "angle": 90,
          "speed": 270,
          "hardSpeed": 360,
          "color": "#badc58",
          "repeat": 3,
          "interval": 0.16
        }
      ],
      "span": 2.74
    },
    {
      "name": "Lock Lattice",
      "hint": "Weave through the two successive barrier rows by aligning inside the safe 1.5-ship seam.",
      "windup": 1.1,
      "cooldown": 10.5,
      "hardCooldown": 8.2,
      "recovery": 0.9,
      "events": [
        {
          "type": "gate",
          "at": 0.0,
          "offset": -130,
          "dy": 0,
          "width": 240,
          "speed": 280,
          "hardSpeed": 340,
          "color": "#4834d4",
          "duration": 1.2
        },
        {
          "type": "gate",
          "at": 0.48,
          "offset": 130,
          "dy": 0,
          "width": 240,
          "speed": 280,
          "hardSpeed": 340,
          "color": "#30336b",
          "duration": 1.2
        }
      ],
      "span": 3.68
    }
  ],
  [
    {
      "name": "Gravity Pull",
      "hint": "Destroy the singularity or boost perpendicular to resist its inward pull.",
      "windup": 0.95,
      "cooldown": 6.8,
      "hardCooldown": 5.2,
      "recovery": 0.75,
      "events": [
        {
          "type": "well",
          "at": 0.0,
          "offset": 0,
          "dy": 0,
          "speed": 160,
          "hardSpeed": 200,
          "duration": 1.4,
          "color": "#7a3cf0"
        },
        {
          "type": "ring",
          "at": 0.35,
          "count": 10,
          "angle": 18,
          "speed": 130,
          "hardSpeed": 160,
          "color": "#a865f8"
        }
      ],
      "span": 3.1
    },
    {
      "name": "Polarity Reversal",
      "hint": "Brace against the repulsor pulse and weave through the twin outward arcs.",
      "windup": 0.9,
      "cooldown": 7.5,
      "hardCooldown": 5.8,
      "recovery": 0.7,
      "events": [
        {
          "type": "well",
          "at": 0.0,
          "offset": 0,
          "dy": -30,
          "speed": -190,
          "hardSpeed": -230,
          "duration": 1.2,
          "color": "#44d4ff"
        },
        {
          "type": "fan",
          "at": 0.25,
          "count": 2,
          "spread": 1.15,
          "speed": 210,
          "hardSpeed": 250,
          "color": "#8be9fd"
        }
      ],
      "span": 2.8
    },
    {
      "name": "Orbital Stones",
      "hint": "Circle the boss while tracking the three staggered tangential rock releases.",
      "windup": 1.0,
      "cooldown": 8.5,
      "hardCooldown": 6.6,
      "recovery": 0.85,
      "events": [
        {
          "type": "orbit",
          "at": 0,
          "duration": 2.15
        }
      ],
      "span": 4.0
    },
    {
      "name": "Gravity Lance",
      "hint": "Evacuate the locked trajectory before the beam erupts and spawns wake mines.",
      "windup": 1.0,
      "cooldown": 7.2,
      "hardCooldown": 5.6,
      "recovery": 0.65,
      "events": [
        {
          "type": "rail",
          "at": 0.0,
          "offset": 0,
          "width": 56,
          "travel": 0,
          "duration": 0.45,
          "lock": 0.85,
          "color": "#ff3864"
        },
        {
          "type": "rail",
          "at": 0.53,
          "offset": 0,
          "width": 16,
          "duration": 0.32,
          "color": "#97b3ff"
        }
      ],
      "span": 2.5
    },
    {
      "name": "Shepherd Sling",
      "hint": "Stay centered in the safe channel while flanking asteroids slingshot inward.",
      "windup": 1.1,
      "cooldown": 10.0,
      "hardCooldown": 7.8,
      "recovery": 0.9,
      "events": [
        {
          "type": "orbit",
          "at": 0,
          "duration": 1.3
        }
      ],
      "span": 3.3
    }
  ],
  [
    {
      "name": "Flight Leader",
      "hint": "Focus fire on the gold lead drone to collapse the entire formation mid-dive.",
      "windup": 0.9,
      "cooldown": 6.5,
      "hardCooldown": 5.0,
      "recovery": 0.7,
      "events": [
        {
          "type": "drones",
          "at": 0.0,
          "repeat": 1,
          "interval": 0.22,
          "count": 6,
          "speed": 340,
          "offset": 0,
          "dx": 0,
          "dy": -40,
          "color": "#ffd700",
          "duration": 3
        }
      ],
      "span": 4.6
    },
    {
      "name": "Pincer Flight",
      "hint": "Hold the center channel while dual curving wings sweep in diagonally from the flanks.",
      "windup": 0.95,
      "cooldown": 7.5,
      "hardCooldown": 5.8,
      "recovery": 0.75,
      "events": [
        {
          "type": "pincer",
          "at": 0.0,
          "count": 6,
          "speed": 320,
          "angle": -45,
          "offset": -380,
          "spread": 0.35,
          "color": "#ff8800",
          "repeat": 1,
          "duration": 3
        }
      ],
      "span": 4.7
    },
    {
      "name": "Hive Needles",
      "hint": "Slip through the narrow seam between the five rapid targeted stinger lancets.",
      "windup": 0.85,
      "cooldown": 6.0,
      "hardCooldown": 4.6,
      "recovery": 0.65,
      "events": [
        {
          "type": "fan",
          "at": 0.0,
          "count": 5,
          "spread": 0.42,
          "speed": 460,
          "dx": 0,
          "dy": 30,
          "color": "#00ffcc"
        }
      ],
      "span": 1.6
    },
    {
      "name": "Recall Bloom",
      "hint": "Evade returning escort drones, then weave between the expanding ring of six spores.",
      "windup": 1.0,
      "cooldown": 8.5,
      "hardCooldown": 6.6,
      "recovery": 0.85,
      "events": [
        {
          "type": "recall",
          "at": 0,
          "duration": 1.5
        }
      ],
      "span": 3.35
    },
    {
      "name": "Brood Shield",
      "hint": "Identify and dash through the two rotating gaps in the hexagonal perimeter.",
      "windup": 1.05,
      "cooldown": 9.5,
      "hardCooldown": 7.5,
      "recovery": 0.8,
      "events": [
        {
          "type": "shield",
          "at": 0,
          "duration": 1.8
        }
      ],
      "span": 3.65
    },
    {
      "name": "Royal Salvo",
      "hint": "Dodge the central trident volley; destroy outer wings early to thin incoming fire.",
      "windup": 1.1,
      "cooldown": 10.5,
      "hardCooldown": 8.2,
      "recovery": 0.95,
      "events": [
        {
          "type": "wings",
          "at": 0,
          "duration": 1.45
        },
        {
          "type": "fan",
          "at": 0.0,
          "count": 3,
          "spread": 0.28,
          "speed": 400,
          "dx": 0,
          "dy": 22,
          "color": "#f43f5e"
        }
      ],
      "span": 3.5
    }
  ],
  [
    {
      "name": "Outer Barrage",
      "hint": "Hold the center channel; outer flanks fire three successive staggered salvos.",
      "windup": 0.9,
      "cooldown": 6.0,
      "hardCooldown": 4.6,
      "recovery": 0.75,
      "events": [
        {
          "type": "fan",
          "at": 0.0,
          "repeat": 3,
          "interval": 0.35,
          "count": 3,
          "spread": 0.12,
          "speed": 340,
          "hardSpeed": 410,
          "dx": -131,
          "dy": 17,
          "color": "#4da6ff",
          "mount": 0,
          "angle": -28
        },
        {
          "type": "fan",
          "at": 0.0,
          "repeat": 3,
          "interval": 0.35,
          "count": 3,
          "spread": 0.12,
          "speed": 340,
          "hardSpeed": 410,
          "dx": 131,
          "dy": 17,
          "color": "#4da6ff",
          "mount": 3,
          "angle": 28
        }
      ],
      "span": 2.45
    },
    {
      "name": "Inner Crossfire",
      "hint": "Evacuate the center intersection toward either flank to slip between diagonal streams.",
      "windup": 0.95,
      "cooldown": 6.8,
      "hardCooldown": 5.2,
      "recovery": 0.8,
      "events": [
        {
          "type": "ray",
          "at": 0.0,
          "repeat": 2,
          "interval": 0.45,
          "dx": -62,
          "dy": 17,
          "angle": 24,
          "travel": -5,
          "duration": 0.65,
          "width": 22,
          "speed": 380,
          "hardSpeed": 440,
          "color": "#79c0ff",
          "mount": 1,
          "aimRay": true
        },
        {
          "type": "ray",
          "at": 0.0,
          "repeat": 2,
          "interval": 0.45,
          "dx": 62,
          "dy": 17,
          "angle": -24,
          "travel": 5,
          "duration": 0.65,
          "width": 22,
          "speed": 380,
          "hardSpeed": 440,
          "color": "#79c0ff",
          "mount": 2,
          "aimRay": true
        }
      ],
      "span": 2.85
    },
    {
      "name": "Reactor Surge",
      "hint": "Weave downward through the first expanding crescent, then slip through the second wave.",
      "windup": 1.0,
      "cooldown": 8.0,
      "hardCooldown": 6.2,
      "recovery": 0.85,
      "events": [
        {
          "type": "fan",
          "at": 0.0,
          "count": 7,
          "spread": 0.18,
          "speed": 290,
          "hardSpeed": 355,
          "dx": -79,
          "dy": 17,
          "color": "#ffaa33",
          "mount": 0,
          "angle": -6
        },
        {
          "type": "fan",
          "at": 0.55,
          "count": 7,
          "spread": 0.18,
          "speed": 290,
          "hardSpeed": 355,
          "dx": 79,
          "dy": 17,
          "color": "#ffaa33",
          "mount": 1,
          "angle": 6
        }
      ],
      "span": 2.5
    },
    {
      "name": "Thermal Vent",
      "hint": "Settle into one of three neutral vertical slots between sustained twin exhaust pillars.",
      "windup": 1.0,
      "cooldown": 8.8,
      "hardCooldown": 6.8,
      "recovery": 0.9,
      "events": [
        {
          "type": "rail",
          "at": 0.0,
          "offset": -220,
          "width": 56,
          "duration": 1.3,
          "speed": 0,
          "hardSpeed": 0,
          "color": "#ff5533",
          "mount": 0,
          "dx": -79,
          "dy": 17
        },
        {
          "type": "rail",
          "at": 0.0,
          "offset": 220,
          "width": 56,
          "duration": 1.3,
          "speed": 0,
          "hardSpeed": 0,
          "color": "#ff5533",
          "mount": 1,
          "dx": 79,
          "dy": 17
        }
      ],
      "span": 3.2
    },
    {
      "name": "Eclipse Beam",
      "hint": "Clear the spine before the core lance fires and drift around slow perimeter embers.",
      "windup": 1.1,
      "cooldown": 9.5,
      "hardCooldown": 7.5,
      "recovery": 0.95,
      "events": [
        {
          "type": "rail",
          "at": 0.0,
          "offset": 0,
          "width": 56,
          "duration": 0.9,
          "speed": 0,
          "hardSpeed": 0,
          "color": "#b366ff"
        },
        {
          "type": "fan",
          "at": 0.15,
          "repeat": 2,
          "interval": 0.4,
          "count": 3,
          "spread": 0.18,
          "speed": 175,
          "hardSpeed": 220,
          "dx": -69,
          "dy": 70,
          "color": "#d98cff"
        },
        {
          "type": "fan",
          "at": 0.15,
          "repeat": 2,
          "interval": 0.4,
          "count": 3,
          "spread": 0.18,
          "speed": 175,
          "hardSpeed": 220,
          "dx": 69,
          "dy": 70,
          "color": "#d98cff"
        }
      ],
      "span": 2.95
    },
    {
      "name": "Corona Nova",
      "hint": "Punch through radial gaps in the first ring, then slide 15 degrees to clear the second.",
      "windup": 1.15,
      "cooldown": 10.5,
      "hardCooldown": 8.2,
      "recovery": 1.0,
      "events": [
        {
          "type": "ring",
          "at": 0.0,
          "count": 12,
          "angle": 0,
          "speed": 260,
          "hardSpeed": 320,
          "dx": 0,
          "dy": 75,
          "color": "#ffdd44"
        },
        {
          "type": "ring",
          "at": 0.6,
          "count": 12,
          "angle": 15,
          "speed": 260,
          "hardSpeed": 320,
          "dx": 0,
          "dy": 75,
          "color": "#ffdd44"
        }
      ],
      "span": 2.85
    }
  ]
];

// Anchor Miner keeps mines and gates in the encounter snapshot across overlapping casts.
window.SpaceMiner = (() => {
  const directions=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
  const between=(min,max)=>min+(max-min)*(window.SpaceFlightRandom?.() ?? Math.random());
  function press(b,seat,id,key){
    const t=b?.miner?.tether;
    if(!t || t.id!==id || t.seat!==seat || !directions.includes(key))return false;
    t.index=key===t.sequence[t.index] ? t.index+1 : 0;
    if(t.index===t.sequence.length)b.miner.tether=null;
    return true;
  }
  function cast(b,m,k,api){
    b.attack={mode:'miner',skillIndex:k,turn:++b.serial,t:0};
    if(k===0){
      const y=b.y+80;
      for(let i=0;i<3;i++){
        const heading=between(.32,Math.PI-.32);
        m.mines.push({x:b.x,y:b.y+32,startX:b.x,startY:b.y+32,
          laneX:between(48+i*405,394+i*405),rowY:y,age:0,
          blastY:between(370,660),speed:85,angles:[-.85,-.28,.28,.85].map(v=>v+heading)});
      }
    }else if(k===1){
      const lane=Math.floor((window.SpaceFlightRandom?.() ?? Math.random())*3);
      m.gates.push({startX:b.x,startY:b.y+32,x:(lane+.5)*1280/3,y:28,age:0});
    }else{
      const pilots=api.pilots.filter(p=>p.hp>0);
      if(!pilots.length)return;
      const duration=1.5;
      const p=pilots[m.turn++%pilots.length];
      m.tether={id:b.serial,seat:api.pilotSeat?.(p)??api.pilots.indexOf(p),index:0,
        sequence:Array(3).fill(directions[Math.floor((window.SpaceFlightRandom?.() ?? Math.random())*directions.length)]),duration,remaining:duration};
    }
  }
  function update(b,dt,api,skills){
    if(!b.miner){
      b.objects=[];
      b.miner={mines:[],gates:[],tether:null,turn:0,next:[0,4,8].map(delay=>b.clock-dt+delay)};
      if(Number.isInteger(b.practiceSkill))b.miner.next[b.practiceSkill]=b.clock-dt;
    }
    const m=b.miner;
    if(b.attack)b.attack.t+=dt;
    const tether=m.tether;
    if(tether){
      const p=api.pilots.find((p,i)=>(api.pilotSeat?.(p)??i)===tether.seat && p.hp>0);
      tether.remaining-=dt;
      if(!p || tether.remaining<=1e-8){
        m.tether=null;
        if(p)api.penalty(p);
      }
    }
    for(let k=0;k<3;k++){
      if(b.practiceSkill!==undefined && b.practiceSkill!==k)continue;
      if(b.clock+1e-8<m.next[k])continue;
      cast(b,m,k,api);
      m.next[k]+=window.SpaceBosses.cooldown(b,b.phase===1?skills[k].cooldown:skills[k].hardCooldown);
    }
    for(const mine of m.mines){
      mine.age+=dt;
      const progress=Math.min(1,mine.age/.34);
      mine.x=mine.startX+(mine.laneX-mine.startX)*progress;
      mine.y=mine.startY+(mine.rowY-mine.startY)*progress+Math.max(0,mine.age-.34)*mine.speed;
      if(mine.y>=mine.blastY){
        api.sound?.('mine');
        api.miniBlast(mine.x,mine.blastY,48);
        for(const angle of mine.angles){
          const h=api.makeHazard(mine.x,mine.blastY,angle,180,'bolt');
          if(h)Object.assign(h,{bossIndex:4,skillIndex:0});
        }
      }else if(mine.age>=.34){
        const p=api.pilots.find(p=>p.hp>0 && Math.hypot(p.x-mine.x,p.y-mine.y)<18);
        if(p)api.damage(p);
      }
    }
    m.mines=m.mines.filter(mine=>mine.y<mine.blastY);
    for(const gate of m.gates){
      const previousAge=gate.age;
      gate.age+=dt;
      // Only the part of this frame after the orb arrives moves the gate.
      gate.y+=160*(Math.max(0,gate.age-.65)-Math.max(0,previousAge-.65));
      if(gate.age<=.65 || gate.y>=728)continue;
      const halfWidth=Math.min(1,(gate.age-.65)/.4)*1280/6;
      for(const p of api.pilots){
        if(p.hp>0 && Math.hypot(Math.max(0,Math.abs(p.x-gate.x)-halfWidth),p.y-gate.y)<=13)api.damage(p);
      }
    }
    m.gates=m.gates.filter(g=>g.y<728);
  }
  return {update,press};
})();
