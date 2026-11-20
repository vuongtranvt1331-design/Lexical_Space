// Kenney Sci-Fi Sounds (CC0). Frequent cues have short envelopes and a shared voice budget.
(() => {
  const files = {
    shoot: 'laserSmall_000', enemyShot: 'laserRetro_001', impact: 'impactMetal_000',
    explosion: 'explosionCrunch_000', bossBlast: 'lowFrequency_explosion_000',
    mine: 'explosionCrunch_003', boss: 'spaceEngineLow_000', arrival: 'spaceEngineLow_000',
    missile: 'thrusterFire_000', flight: 'spaceEngineSmall_000', warp: 'engineCircular_001',
    skill: 'forceField_000'
  };
  // Level, retrigger interval, maximum length (seconds).
  const mix = {
    shoot:[.22,.095,.11], enemyShot:[.12,.22,.12], impact:[.18,.12,.12],
    explosion:[.44,.18,.38], bossBlast:[.8,1,1.2], mine:[.58,.22,.55],
    boss:[.39,1,1.15], arrival:[.21,1,.72], missile:[.33,.22,.32],
    warp:[.52,1,.62], skill:[.4,.25,.45], wrong:[.4,.2,.24], clear:[.45,.2,.24]
  };
  const buffers = new Map(), last = new Map(), voices = new Set();
  let audio, master, flight, volume = .5;
  function calibrate() {
    if (master) master.gain.value = volume * (window.SpaceEffects?.gain() ?? .1);
  }
  function unlock() {
    try {
      if (!audio) {
        audio = new (window.AudioContext || window.webkitAudioContext)();
        master = audio.createGain(); master.connect(audio.destination); calibrate();
        for (const file of new Set(Object.values(files))) {
          fetch('./assets/audio/' + file + '.ogg').then(r => {
            if (!r.ok) throw Error(r.status);
            return r.arrayBuffer();
          }).then(bytes => audio.decodeAudioData(bytes)).then(b => buffers.set(file,b)).catch(() => {});
        }
      }
      if (audio.state === 'suspended') audio.resume().catch(() => {});
    } catch {}
  }
  for (const event of ['pointerdown','keydown']) document.addEventListener(event, unlock, {capture:true,passive:true});
  function play(key) {
    const settings = mix[key];
    if (!settings || audio?.state !== 'running' || document.hidden || !master.gain.value) return;
    const buffer = buffers.get(files[key]);
    if (!buffer && key !== 'wrong' && key !== 'clear') return;
    const [level, gap, maxLength] = settings, now = audio.currentTime;
    if (now - (last.get(key) ?? -Infinity) < gap || voices.size >= 8) return;
    last.set(key, now);
    const source = buffer ? audio.createBufferSource() : audio.createOscillator();
    if (buffer) source.buffer = buffer;
    else {
      source.type = 'triangle';
      const correct = key === 'clear';
      source.frequency.setValueAtTime(correct ? 490 : 170,now);
      source.frequency.exponentialRampToValueAtTime(correct ? 1020 : 56,now+maxLength);
    }
    const end = now + Math.min(maxLength,buffer?.duration ?? maxLength);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, Math.min(now+.009,end));
    gain.gain.setValueAtTime(level, Math.max(now+.009,end-Math.min(.12,maxLength*.4)));
    gain.gain.linearRampToValueAtTime(0,end);
    source.connect(gain); gain.connect(master); voices.add(source);
    source.onended = () => {voices.delete(source); source.disconnect(); gain.disconnect();};
    source.start(now); source.stop(end);
  }
  function missileFlight(active) {
    const buffer = buffers.get(files.flight);
    if (!active || document.hidden || !master?.gain.value) {
      if (flight) {flight.stop(); flight = null;}
      return;
    }
    if (flight || !buffer || audio.state !== 'running') return;
    const source = audio.createBufferSource(), gain = audio.createGain();
    source.buffer = buffer; source.loop = true;
    gain.gain.value = .055; source.connect(gain); gain.connect(master);
    source.onended = () => {source.disconnect();gain.disconnect();};
    source.start(); flight = source;
  }
  function silence() {
    missileFlight(false);
    for (const voice of voices) voice.stop();
  }
  window.addEventListener('pagehide',silence);
  document.addEventListener('visibilitychange',() => {if(document.hidden)silence();});
  window.SpaceSound = {play, missileFlight, silence, volume(value){volume=value;calibrate();}};
})();
