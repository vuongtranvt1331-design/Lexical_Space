(() => {
  'use strict';
  const duration = 1500;
  const lag = .14;
  const sheet = new Image();
  sheet.src = './assets/space-chase.png';
  const ready = sheet.decode().then(() => true, () => false);
  const laser = document.querySelector('[data-chase-laser]');
  const shotTimes = [160, 440, 740, 1050];
  let shotTimers = [];
  let active = null;

  function stop() {
    if (!active) return;
    for (const timer of shotTimers) clearTimeout(timer);
    shotTimers = [];
    active.remove();
    active = null;
    laser.pause();
  }

  // Draw in a landscape coordinate system. On tall viewports exchange the
  // long and short axes so the entry and exit corners stay the same.
  function point(t, w, h) {
    const first = t < .5, u = first ? 2*t : 2*t-1, v = 1-u;
    const a = v*v*v, b = 3*v*v*u, c = 3*v*u*u, d = u*u*u;
    const along = first ? .99*a+.96*b+.82*c+.59*d : .59*a+.36*b+.16*c-.23*d;
    const across = first ? .99*a+.84*b+.42*c+.41*d : .41*a+.40*b+.19*c-.19*d;
    return w>=h ? {x:w*along,y:h*across} : {x:w*across,y:h*along};
  }

  async function play() {
    if (active || document.hidden) return;
    const layer = document.createElement('div');
    active = layer;
    layer.className = 'space-chase-overlay';
    layer.setAttribute('aria-hidden','true');
    if (!laser.muted && laser.volume > 0) {
      // Unlock this preloaded element during the tap, before the delayed first shot.
      laser.play().catch(() => {});
      laser.pause();
    }
    const loaded = await ready;
    if (active !== layer) return;
    if (!loaded || document.hidden) { stop(); return; }
    document.body.append(layer);
    const w = layer.clientWidth, h = layer.clientHeight;
    const size = Math.min(w,h)*.17;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = .09, rate = 1 + lag - start;
    for (let ship=0; ship<2; ship++) {
      const sprite = document.createElement('i');
      sprite.className='chase-fighter';
      sprite.style.width=sprite.style.height=size+'px';
      sprite.style.backgroundPosition=ship?'100% 0':'0 0';
      layer.append(sprite);
      // The browser interpolates transform frames independently of carousel JS.
      const frames=Array.from({length:61},(_,i)=>{
        const t=start+rate*i/60-ship*lag;
        const p=point(t,w,h), next=point(t+.001,w,h);
        const angle=Math.atan2(next.x-p.x,p.y-next.y);
        const near=Math.max(0,(t-.35)/.65);
        const scale=1+(reduced ? .45 : 3.05)*near*near;
        return {transform:'translate3d('+(p.x-size/2)+'px,'+(p.y-size/2)+'px,0) rotate('+angle+'rad) scale('+scale+')'};
      });
      sprite.animate(frames,{duration,fill:'both'});
    }

    for (const delay of shotTimes) {
      const fired = start + rate * delay / duration;
      const beam=document.createElement('i');
      beam.className='chase-beam';
      const a=point(fired-lag+.022,w,h), b=point(fired+.16,w,h);
      b.y-=h*.025;
      const angle=Math.atan2(b.y-a.y,b.x-a.x);
      beam.style.width=Math.max(22,Math.hypot(b.x-a.x,b.y-a.y)*.27)+'px';
      layer.append(beam);
      const transform=p=>'translate3d('+p.x+'px,'+p.y+'px,0) rotate('+angle+'rad)';
      beam.animate([{transform:transform(a),opacity:0},{opacity:1,offset:.12},
        {transform:transform(b),opacity:0}],{duration:duration*.22/rate,delay,fill:'both'});
      shotTimers.push(setTimeout(() => {
        if (active !== layer || document.hidden || laser.muted || !laser.volume) return;
        laser.currentTime = 0;
        laser.play().catch(() => {});
      }, delay));
    }
    const fade=layer.animate([{opacity:1},{opacity:1,offset:.88},{opacity:0}],{duration,fill:'both'});
    fade.onfinish=()=>{if(active===layer)stop();};
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);
  window.SpaceChase=Object.freeze({play});
})();
