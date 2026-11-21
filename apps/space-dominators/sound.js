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
  const events=window.SpaceSFXConfig?.events??{};
  for(const [key,event] of Object.entries(events)){
    files[key]=event.file.split('/').pop().replace('.ogg','');
    mix[key]=[event.level,event.cooldown,event.duration];
  }
  const activeByKey=new Map();
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
    const [level, gap, maxLength] = settings, now = audio.currentTime;
    if (now - (last.get(key) ?? -Infinity) < gap || voices.size >= 8 || (activeByKey.get(key)??0)>=(events[key]?.maxVoices??2)) return;
    last.set(key, now);
    const synth=events[key]?.fallback??{
      kind:['explosion','bossBlast','mine','missile','arrival','boss','warp'].includes(key)?'noise':'triangle',
      frequency:key==='clear'?490:key==='wrong'?170:700,
      endFrequency:key==='clear'?1020:56
    };
    const noise=!buffer && synth.kind==='noise';
    const source=(buffer || noise)?audio.createBufferSource():audio.createOscillator();
    if(buffer){
      source.buffer=buffer;
      if(key==='laserCharge' || key==='orbCharge'){
        source.playbackRate.setValueAtTime(.65,now);
        source.playbackRate.exponentialRampToValueAtTime(1.8,now+maxLength);
      }
    }
    else if(noise){
      const data=audio.createBuffer(1,Math.ceil(audio.sampleRate*maxLength),audio.sampleRate);
      const channel=data.getChannelData(0);
      let state=12345;
      for(let i=0;i<channel.length;i++){
        state=(Math.imul(state,1664525)+1013904223)>>>0;
        channel[i]=(state/4294967296*2-1)*Math.exp(-i/channel.length*3);
      }
      source.buffer=data;
    }else{
      source.type=synth.kind;
      source.frequency.setValueAtTime(synth.frequency,now);
      source.frequency.exponentialRampToValueAtTime(synth.endFrequency,now+maxLength);
    }
    const end = now + Math.min(maxLength,buffer?.duration ?? maxLength);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, Math.min(now+.009,end));
    gain.gain.setValueAtTime(level, Math.max(now+.009,end-Math.min(.12,maxLength*.4)));
    gain.gain.linearRampToValueAtTime(0,end);
    source.connect(gain); gain.connect(master); voices.add(source);
    activeByKey.set(key,(activeByKey.get(key)??0)+1);
    source.onended = () => {activeByKey.set(key,Math.max(0,(activeByKey.get(key)??1)-1));voices.delete(source); source.disconnect(); gain.disconnect();};
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
  const introFiles={siren:'boss6-siren',engine:'boss6-engine',lasers:'boss6-lasers',flyby:'boss6-flyby',jump:'hyperspaceexit',jumpBang:'bomb-gun-shot-bang'};
  const introBuffers=new Map(),introVoices=new Set(),introFlights=new Map();
  const introRequests=new Map();
  let introLoad=null,introSiren=null,introPrevious=-1,introFlightsFading=false;
  function loadIntroClip(key){
    if (!introRequests.has(key)) {
      const request = (async()=>{
        try{
          const response=await fetch('./assets/audio/'+introFiles[key]+'.mp3');
          if(!response.ok)return false;
          const buffer=await audio.decodeAudioData(await response.arrayBuffer());
          let energy=0,count=0,peak=0;
          for(let channel=0;channel<buffer.numberOfChannels;channel++){
            const samples=buffer.getChannelData(channel);
            for(let i=0;i<samples.length;i+=8){
              energy+=samples[i]*samples[i];peak=Math.max(peak,Math.abs(samples[i]));count++;
            }
          }
          const rms=Math.sqrt(energy/Math.max(1,count));
          const trim=Math.min(2,.18/Math.max(.01,rms),.7/Math.max(.01,peak));
          introBuffers.set(key,{buffer,trim});
          return true;
        }catch{return false;}
      })();
      introRequests.set(key,request);
      request.then(ok=>{if(!ok)introRequests.delete(key);});
    }
    return introRequests.get(key);
  }
  function prepareIntro(){
    unlock();
    if(!audio)return Promise.resolve();
    introLoad??=Promise.all(Object.keys(introFiles).map(loadIntroClip));
    return introLoad;
  }
  function introCue(key,level,pan=0,loop=false,delay=0,firstHalf=false){
    const entry=introBuffers.get(key);
    const flightCue=key==='engine'||key==='flyby';
    if(!entry || audio?.state!=='running' || document.hidden || introVoices.size>=16 ||
       (flightCue && introFlights.size>=5))return null;
    const source=audio.createBufferSource(),gain=audio.createGain();
    const now=audio.currentTime+delay;
    source.buffer=entry.buffer;source.loop=loop;
    gain.gain.setValueAtTime(0,now);
    gain.gain.linearRampToValueAtTime(level*entry.trim,now+(key==='jumpBang'?.008:.15));
    let clipEnd=null;
    if(firstHalf){
      const end=now+entry.buffer.duration*.5;
      gain.gain.setValueAtTime(level*entry.trim,Math.max(now+.15,end-.18));
      gain.gain.linearRampToValueAtTime(0,end);
      clipEnd=end;
    }
    source.connect(gain);
    let stereo=null;
    if(audio.createStereoPanner){
      stereo=audio.createStereoPanner();stereo.pan.value=pan;
      gain.connect(stereo);stereo.connect(master);
    }else gain.connect(master);
    introVoices.add(source);
    if(flightCue)introFlights.set(source,{gain,end:clipEnd});
    source.onended=()=>{
      introFlights.delete(source);introVoices.delete(source);source.disconnect();gain.disconnect();stereo?.disconnect();
      if(introSiren===source)introSiren=null;
    };
    source.start(now);
    if(clipEnd!==null)source.stop(clipEnd);
    return source;
  }
  function stopIntro(fade=.15){
    for(const source of introVoices){
      try{source.stop(audio.currentTime+fade);}catch{}
    }
    introVoices.clear();introFlights.clear();introSiren=null;introPrevious=-1;introFlightsFading=false;
  }
  function introFrame(seconds,releaseAt,playAt,formedAt=playAt){
    if(seconds<introPrevious)stopIntro(0);
    if(document.hidden || seconds>=playAt){if(introPrevious>=0)stopIntro(0);return;}
    calibrate();
    if(!introSiren)introSiren=introCue('siren',.105,0,true);
    const cues=[
      [releaseAt+.35,'lasers',.18,-.35],[releaseAt+1.8,'lasers',.16,.35]
    ];
    for(const [at,key,level,pan] of cues){
      if(introPrevious<at && seconds>=at)introCue(key,level,pan);
    }
    // A steady staggered stream builds at most five simultaneous aircraft layers.
    // Only the leading ship keeps its full flyaway tail; subsequent passes use the active first half.
    const flightEnd=Math.min(formedAt,Math.max(releaseAt,playAt-1.5));
    const pans=[-.8,.65,-.35,.85,0];
    for(let index=0,at=releaseAt;at<flightEnd;index++,at=releaseAt+index*.62){
      if(introPrevious>=at || seconds<at)continue;
      const key=index%2?'flyby':'engine';
      const level=index===0?.4:.19+(index%3)*.025;
      introCue(key,level,pans[index%pans.length],false,0,index>0);
    }
    if(seconds>=formedAt && !introFlightsFading){
      introFlightsFading=true;
      const now=audio?.currentTime??0;
      for(const [source,voice] of introFlights){
        const end=Math.min(now+.5,voice.end??Infinity);
        const parameter=voice.gain.gain;
        if(parameter.cancelAndHoldAtTime)parameter.cancelAndHoldAtTime(now);
        else{
          const current=parameter.value;
          parameter.cancelScheduledValues(now);
          parameter.setValueAtTime(current,now);
        }
        parameter.linearRampToValueAtTime(0,Math.max(now,end));
        try{source.stop(Math.max(now,end));}catch{}
      }
    }
    introPrevious=seconds;
  }
  function fleetJump(index){
    const pan=[-.6,0,.6][index]??0;
    // The arrival crack lands first; the longer hyperspace tail follows closely.
    introCue('jumpBang',.65,pan);
    introCue('jump',.5,pan,false,.07);
  }
  async function prepareFleetJump(){
    unlock();
    if(!audio)return true;
    const resumed = audio.state==='suspended' && window.navigator?.userActivation?.hasBeenActive
      ? audio.resume().catch(()=>{}) : Promise.resolve();
    const [loaded] = await Promise.all([loadIntroClip('jump'),resumed]);
    return loaded;
  }
  const impactOffset=1.41;
  function fleetCue({impact,pan,gain},previous,time){
    const start=impact-impactOffset;
    if(previous<start && time>=start)introCue('jump',gain,pan);
  }
  function scheduleFleetJumps(cues){
    // Measured onset of the broad-band crack in hyperspaceexit.mp3.
    const wallStart=performance.now();
    if(!audio || audio.state!=='running')return ()=> (performance.now()-wallStart)/1000;
    const epoch=audio.currentTime+.05;
    for(const {impact,pan,gain} of cues){
      introCue('jump',gain,pan,false,epoch+impact-impactOffset-audio.currentTime);
    }
    // Draw against the output clock so the buffer and display share their origin.
    return ()=>{
      const stamp=audio.getOutputTimestamp?.();
      const presented=stamp?.performanceTime
        ? stamp.contextTime+(performance.now()-stamp.performanceTime)/1000
        : audio.currentTime-(audio.outputLatency||0);
      return Math.max(0, Math.min(audio.currentTime,presented)-epoch);
    };
  }
  function silence() {
    const previous=introPrevious;
    stopIntro(0);
    introPrevious=previous;
    missileFlight(false);
    for (const voice of voices) {try{voice.stop();}catch{}}
  }
  window.addEventListener('pagehide',silence);
  document.addEventListener('visibilitychange',() => {if(document.hidden)silence();});
  window.SpaceSound = {play, missileFlight, silence, prepareIntro, introFrame, stopIntro, fleetJump, fleetCue, prepareFleetJump, scheduleFleetJumps, volume(value){volume=value;calibrate();}};
})();
