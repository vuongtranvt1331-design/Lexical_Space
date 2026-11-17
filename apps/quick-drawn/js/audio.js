// Sounds used by the Vietnamese duel. Media is optional; a synthesised cue is
// always available while files load or when either supported format is absent.
class CombatAudio {
  constructor() { this.ctx=null; this.buffers={}; this.loading={}; this.muted=false; }
  unlock() {
    try { const AC=window.AudioContext||window.webkitAudioContext; if(!this.ctx&&AC)this.ctx=new AC(); if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume().catch(()=>{}); } catch (_) {}
    for(const name of ['shout_attack','sword_slash','elephant_charge','bow_shot','scroll_cast','fruit_throw','fall_defeat','tap_click','teacher_vuong_punch','teacher_vuong_slap']) this.load(name);
  }
  load(name) {
    if(this.loading[name])return;
    this.loading[name]=(async()=>{for(const ext of ['mp3','wav']){try{const response=await fetch(`assets/audio/${name}.${ext}`);if(!response.ok)continue;const data=await response.arrayBuffer();if(this.ctx){this.buffers[name]=await this.ctx.decodeAudioData(data);return}}catch(_){}}})();
  }
  play(name) {
    if(this.muted)return; this.unlock(); const c=this.ctx;if(!c)return;
    try { const buffer=this.buffers[name];if(buffer){const source=c.createBufferSource(),gain=c.createGain();source.buffer=buffer;gain.gain.value=.35;source.connect(gain);gain.connect(c.destination);source.start();return}this.synth(name); } catch (_) {}
  }
  synth(name) {
    const c=this.ctx,t=c.currentTime;
    const tones={wood_drop:[460,140,.085,'triangle'],shout_attack:[260,115,.24,'sawtooth'],elephant_charge:[170,70,.38,'sawtooth'],bow_shot:[720,140,.16,'triangle'],scroll_cast:[520,240,.18,'triangle'],fruit_throw:[450,150,.15,'triangle'],fall_defeat:[110,45,.28,'sine'],tap_click:[600,200,.05,'triangle'],sword_slash:[1600,410,.14,'triangle'],impact:[190,70,.13,'sine']};
    const [from,to,duration,type]=tones[name]||tones.impact;const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+duration+.01);
    if(['sword_slash','bow_shot','scroll_cast','fruit_throw','elephant_charge','fall_defeat'].includes(name)){const b=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);const n=c.createBufferSource(),ng=c.createGain();n.buffer=b;ng.gain.value=.035;n.connect(ng);ng.connect(c.destination);n.start(t)}
  }
}
