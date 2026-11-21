import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const base=new URL('../apps/space-dominators/',import.meta.url);
function fixture(decoded=false){
  const handlers={},sources=[],parameters=[];
  const param=()=>({value:1,setValueAtTime(v,t){this.value=v;parameters.push(['set',v,t]);},linearRampToValueAtTime(v,t){parameters.push(['linear',v,t]);},exponentialRampToValueAtTime(v,t){parameters.push(['exp',v,t]);}});
  class Context{
    constructor(){this.currentTime=0;this.state='running';this.sampleRate=8000;this.destination={};Context.instance=this;}
    createGain(){return {gain:param(),connect(){},disconnect(){}};}
    createBuffer(channels,length,rate){return {duration:length/rate,getChannelData:()=>new Float32Array(length)};}
    createBufferSource(){const s={playbackRate:param(),connect(){},disconnect(){},start(t){s.started=t;sources.push(s);},stop(t){s.stopped=t;}};return s;}
    createOscillator(){const s=this.createBufferSource();s.frequency=param();return s;}
    decodeAudioData(){return Promise.resolve({duration:.8});}
  }
  const document={hidden:false,addEventListener:(name,fn)=>{handlers[name]=fn;}};
  const scope=vm.createContext({AudioContext:Context,document,Math,Float32Array,
    addEventListener(){},fetch:async()=>{if(!decoded)throw Error('offline');return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};}});
  scope.window=scope;
  for(const file of ['sfx-config.js','sound.js'])vm.runInContext(readFileSync(new URL(file,base),'utf8'),scope);
  handlers.pointerdown();
  return {scope,document,handlers,sources,parameters,context:Context.instance,finish(){for(const s of sources)s.onended?.();}};
}
test('all manifested SFX files exist and every event synthesizes when offline',()=>{
  const manifest=JSON.parse(readFileSync(new URL('assets/sfx/manifest.json',base),'utf8'));
  for(const [name,event] of Object.entries(manifest.events)){
    assert.ok(existsSync(new URL(event.file,new URL('assets/sfx/',base))),name);
    const f=fixture();f.scope.SpaceSound.play(name);
    assert.equal(f.sources.length,1,name);
    assert.ok(f.sources[0].stopped>0,name+' has a finite envelope');
    if(name==='laserCharge')assert.ok(f.parameters.some(v=>v[0]==='exp' && v[1]===1250));
  }
});
test('SFX cooldown, per-event cap, shared cap, mute and background silence',()=>{
  const f=fixture(),sound=f.scope.SpaceSound;
  sound.play('fighterExplosion');sound.play('fighterExplosion');assert.equal(f.sources.length,1);
  f.context.currentTime=.1;sound.play('fighterExplosion');
  f.context.currentTime=.2;sound.play('fighterExplosion');
  f.context.currentTime=.3;sound.play('fighterExplosion');assert.equal(f.sources.length,3);
  for(const name of ['fanFire','orbFire','twinFire','missileLaunch','shotgunLaunch','armorHit'])sound.play(name);
  assert.equal(f.sources.length,8,'global budget');
  f.finish();sound.volume(0);f.context.currentTime=2;sound.play('laserFire');assert.equal(f.sources.length,8);
  sound.volume(.5);f.document.hidden=true;sound.play('laserFire');assert.equal(f.sources.length,8);
});
test('decoded local buffers are reused and charges ramp playback rate',async()=>{
  const f=fixture(true);await new Promise(resolve=>setImmediate(resolve));
  f.scope.SpaceSound.play('laserCharge');
  assert.equal(f.sources.length,1);assert.ok(f.sources[0].buffer);
  assert.ok(f.parameters.some(v=>v[0]==='exp' && v[1]===1.8));
});
