/* Boss Lab 11. A mixed formation in perspective, painted from far to near. */
(() => {
  'use strict';
  const assetBase = new URL('./assets/', document.currentScript.src);
  const hulls = new Map();
  const jumpSeconds = .20;
  const duration = 6.8;
  const horizon = {x: 640, y: 235};
  // Coordinates are the staging positions just after each jump. Scale adjusts
  // the framing independently of the approach path and its audio cues.
  const fleet = [
    {model:'dreadnought', x: 474, y: 153, depth: 18,  at: 1.23},
    {model:'venator',     x: 915, y: 106, depth: 16,  at: 1.51},
    {model:'acclamator',  x: 596, y: 170, depth: 13,  at: 1.97},
    {model:'acclamator',  x:1102, y: 211, depth: 10,  at: 1.73},
    {model:'imperial',    x: 450, y: 235, depth: 8.4, at: 2.33},
    {model:'imperial',    x: 759, y: 199, depth: 7.5, at: 2.60},
    {model:'venator',     x: 199, y: 299, depth: 5.4, at: 2.11},
    {model:'venator',     x:1045, y: 357, depth: 5.0, at: 2.83},
    {model:'dreadnought', x: 640, y: 384, depth: 2.7, at: 3.67, scale: 1.30}
  ];
  const cues = fleet.map(ship=>({
    impact: ship.at+jumpSeconds,
    pan: (ship.x-horizon.x)/horizon.x,
    gain: .10+.9/ship.depth
  }));
  let loading, frameId = 0, finish = null;

  function shadeHull(image) {
    const hull=document.createElement('canvas');
    hull.width=image.naturalWidth;
    hull.height=image.naturalHeight;
    const ctx=hull.getContext('2d');
    // The ridge casts a short shadow onto the starboard face, fading outboard.
    const across=ctx.createLinearGradient(0,0,hull.width,0);
    across.addColorStop(.48,'rgba(0,0,0,0)');
    across.addColorStop(.52,'rgba(0,0,0,.48)');
    across.addColorStop(.56,'rgba(0,0,0,.65)');
    across.addColorStop(.72,'rgba(0,0,0,.37)');
    across.addColorStop(.88,'rgba(0,0,0,.12)');
    across.addColorStop(.99,'rgba(0,0,0,0)');
    ctx.fillStyle=across;
    ctx.fillRect(0,0,hull.width,hull.height);

    const along=ctx.createLinearGradient(0,0,0,hull.height);
    along.addColorStop(0,'rgba(0,0,0,.18)');  // Distant stern.
    along.addColorStop(.56,'black');            // Mid-hull.
    along.addColorStop(1,'rgba(0,0,0,.58)');
    ctx.globalCompositeOperation='destination-in';
    ctx.fillStyle=along;
    ctx.fillRect(0,0,hull.width,hull.height);

    // Place the sprite behind the shadow and clip the result to its alpha.
    ctx.globalCompositeOperation='destination-atop';
    ctx.drawImage(image,0,0);
    return hull;
  }

  function load() {
    if (!loading) {
      const models = new Set(fleet.map(ship=>ship.model));
      loading = Promise.all(Array.from(models, model => new Promise(resolve => {
        if(hulls.has(model)){resolve(true);return;}
        const image = new Image();
        image.onload = () => { hulls.set(model,shadeHull(image)); resolve(true); };
        image.onerror = () => resolve(false);
        image.src = new URL('fleet-lab-'+model+'.png', assetBase).href;
      }))).then(results=>{
        const ready = results.every(Boolean);
        if(!ready)loading=null;
        return ready;
      });
    }
    return loading;
  }

  function pose(ship, time) {
    const age = time - ship.at;
    const u = Math.max(0, Math.min(1, age / jumpSeconds));
    const jump = u * u * (3 - 2 * u);
    const coast = Math.max(0, age - jumpSeconds);
    // Constant forward travel after a brief braking impulse, all in camera space.
    const advance = .064 * coast + .13 * (1 - Math.exp(-coast * 2.8));
    const perspective = ship.depth / (ship.depth - advance);
    const spread = (.72 + .28 * jump) * perspective;
    // The three foreground hulls sit at depth 5.4 or closer. Emphasize
    // only the rear ships' growth after arrival, keeping their flight paths.
    const sizePerspective = ship.depth > 5.4 ? 1 + 2 * (perspective - 1) : perspective;
    return {
      age,
      x: horizon.x + (ship.x - horizon.x) * spread,
      y: horizon.y + (ship.y - horizon.y) * spread,
      width: (ship.scale ?? 1) * 1400 / ship.depth * (.008 + .992 * jump) * sizePerspective
    };
  }

  function draw(ctx, time, deepSpace=false) {
    // This stretch of the chart keeps the foreground clear of close-up planets.
    SpaceBackdrop.draw(ctx, 105 + time * .16, deepSpace);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const ship of fleet) {
      const p = pose(ship, time);
      if (p.age < -.19) continue;
      if (p.age >= 0) {
        const hull = hulls.get(ship.model);
        if (!hull) continue;
        const height = p.width * hull.height / hull.width;
        ctx.globalAlpha = 1;
        ctx.drawImage(hull, p.x - p.width / 2, p.y - height / 2, p.width, height);
      }
      if (p.age < .14) {
        const glow = Math.max(0, 1 - Math.abs(p.age / (p.age < 0 ? .19 : .14)));
        const radius = (5 + 54 / ship.depth) * glow;
        ctx.globalAlpha = glow * .7;
        ctx.fillStyle = '#9fd8ff';
        ctx.fillRect(p.x - radius, p.y - 1, radius * 2, 2);
        ctx.fillRect(p.x - 1, p.y - radius * .42, 2, radius * .84);
        ctx.fillStyle = '#effdff';
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
    }
    ctx.restore();
  }

  function stop(completed = false) {
    cancelAnimationFrame(frameId);
    const done = finish;
    finish = null;
    if (done) { SpaceSound.silence(); done(completed); }
  }

  function start(canvas, done) {
    stop();
    finish = done;
    Promise.all([load(),SpaceSound.prepareFleetJump()]).then(results => {
      if (finish !== done) return;
      if (!results.every(Boolean)) { finish = null; done(false, true); return; }
      const ctx = canvas.getContext('2d');
      // Build the backdrop's cached layers before setting the audiovisual clock.
      draw(ctx, 0);
      const elapsed = SpaceSound.scheduleFleetJumps(cues);
      function frame() {
        const time = Math.min(duration,elapsed());
        draw(ctx, time);
        if (time >= duration) stop(true);
        else frameId = requestAnimationFrame(frame);
      }
      frameId = requestAnimationFrame(frame);
    });
  }

  window.addEventListener('pagehide', () => stop());
  document.addEventListener('visibilitychange', () => {if(document.hidden && finish) stop();});
  window.SpaceFleetStudy = Object.freeze({load, start, stop, draw, duration,
    advanceSound(previous, time) {
      for(const cue of cues)window.SpaceSound?.fleetCue?.(cue,previous,time);
    },
    thumbnail(ctx) {
      const hull = hulls.get(fleet[fleet.length-1].model);
      const width = 146, height = width * hull.height / hull.width;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(hull, 3, (152 - height) / 2, width, height);
    }
  });
})();
