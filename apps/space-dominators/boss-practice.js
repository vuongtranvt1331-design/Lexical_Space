(() => {
  const el=id=>document.getElementById(id);
  const panel=el('lab');
  const catalog = SpaceBosses.catalog;
  catalog.forEach((boss,index)=>el('encounter').add(new Option((index+1)+'. '+boss.name,index+1)));
  function setup(){
    const boss=Number(el('encounter').value),phase=Number(el('phase').value),level=el('level').selectedIndex+1;
    const entry=catalog[boss-1];
    const hard=phase>1;
    const choice=el('skill').value;
    const skillIndex=choice==='' ? undefined : Number(choice);
    const skill=entry.skills?.[skillIndex];
    el('moveName').textContent=skill?.name || entry.name;
    el('intel').textContent=skill?.hint || entry.hint;
    const goal=Math.floor(entry.seconds/60)+':'+String(entry.seconds%60).padStart(2,'0');
    const cooldown=hard ? skill?.hardCooldown : skill?.cooldown;
    el('cadence').textContent=skill
      ? 'Warning '+skill.windup+' s · Cooldown '+(cooldown ?? skill.cooldown)+' s'
      : (entry.skills?.length||0)+' patterns · Full fight target '+goal;
    const params=new URLSearchParams(location.search);params.delete('skill');for(const [k,v] of Object.entries({boss,phase,level}))params.set(k,v);
    if(skill) params.set('skill',skillIndex);
    el('wingmate').href='./index.html?'+params;
    el('skillBrief').textContent=skill ? 'This pattern repeats until the encounter ends.' : (entry.skills||[]).map(s=>s.name).join(' / ');
    const strip=el('skillFrames');
    strip.hidden=true;
    if(boss===5)el('cadence').textContent="Type to clear asteroids. Each clear cuts the next flight time by 3%.";
    if(skill && boss!==5) SpaceBossFX.load(boss).ready.then(ready=>{
      if (!ready || Number(el('encounter').value)!==boss || el('skill').value!==choice) return;
      const ctx=strip.getContext('2d');
      ctx.clearRect(0,0,strip.width,strip.height);
      for(let i=0;i<4;i++){
        const x=32+i*64;
        if(boss===1 && skillIndex===0){
          ctx.strokeStyle='#88edf9';
          ctx.lineWidth=2;
          ctx.beginPath();
          ctx.arc(x,32,8+i*6,Math.PI*104/180,Math.PI*(2+76/180));
          ctx.stroke();
        }else if(boss===1){
          ctx.fillStyle='#ffd68a';
          for(let turn=0;turn<Math.min(i+1,3);turn++){
            for(const angle of SpaceEncounterEngine.beaconVolleys[turn]){
              const radius=12+i*4-turn*4;
              ctx.fillRect(x+radius*Math.cos(angle)-1,14+radius*Math.sin(angle),2,2);
            }
          }
        }else if(boss===2 && skillIndex===1){
          ctx.strokeStyle='#9ce7ff';ctx.fillStyle='#bddfff';
          for(const side of [-1,1]){
            const muzzle=x+side*(6+i*3);
            ctx.beginPath();ctx.arc(muzzle,18,2+i*.6,0,2*Math.PI);ctx.fill();
            ctx.beginPath();ctx.moveTo(muzzle,18);ctx.lineTo(x-side*4,53);ctx.stroke();
          }
        }else if(boss===2){
          const half=(8+i*24)*Math.PI/180;
          ctx.fillStyle='rgba(192,135,255,.42)';ctx.strokeStyle='#d9aaff';
          ctx.beginPath();ctx.moveTo(x,10);ctx.arc(x,10,36,Math.PI/2-half,Math.PI/2+half);
          ctx.closePath();ctx.fill();ctx.stroke();
        }else SpaceBossFX.drawSkill(ctx,boss,skillIndex,32+i*64,32,64,(i+0.1)/12);
      }
      strip.hidden=false;
    });
    if(boss<=3) SpaceBossFX.loadHull(boss).ready.then(ready=>{
      if(!ready || Number(el('encounter').value)!==boss || Number(el('phase').value)!==phase) return;
      const ctx=el('bossPreview').getContext('2d');
      ctx.clearRect(0,0,152,152);
      SpaceBossFX.drawHull(ctx,{index:boss,max:100,hp:phase===1?100:50},0,76,76,135,0);
    });
    return {boss,phase,level,skillIndex};
  }
  function describe(){
    const index=Number(el('encounter').value)-1,boss=catalog[index];
    const prior=Number(el('phase').value)||2;
    el('phase').replaceChildren();
    for(let n=1;n<=boss.phases;n++)el('phase').add(new Option(n===1?'1 · Opening':n===3?'3 · Exposed core':'2 · Advanced pattern',n));
    el('phase').value=Math.min(prior,boss.phases);
    const select=el('skill');
    const oldSkill=select.dataset.boss===String(index) ? select.value : '';
    select.dataset.boss=String(index);
    select.replaceChildren(new Option('Full encounter',''));
    (boss.skills||[]).forEach((skill,i)=>select.add(new Option(skill.name,i)));
    select.value=oldSkill;
    const ctx=el('bossPreview').getContext('2d');
    ctx.clearRect(0,0,152,152);
    if(index===4)window.SpaceBackdrop.drawMeteor(ctx,76,76,115,0,1);
    else if(index>=3) SpaceCampaignSprites.draw(ctx,index,76,76,150,150);
    SpaceBossFX.load(index+1).ready.then(ready=>{
      if (!ready || index===4 || index<3 || Number(el('encounter').value)!==index+1) return;
      ctx.clearRect(0,0,152,152);
      SpaceBossFX.drawHull(ctx,{index:index+1},0,76,76,150,0);
    });
    setup();
  }
  SpaceCampaignSprites.ready.then(describe);
  el('encounter').onchange=describe;
  el('skill').onchange=()=>{
    if(Number(el('encounter').value)===10 && el('skill').value!=='') {
      el('phase').value=1+Math.floor(Number(el('skill').value)/2);
    }
    setup();
  };
  el('phase').onchange=()=>{
    if(Number(el('encounter').value)===10 && el('skill').value!=='' &&
       1+Math.floor(Number(el('skill').value)/2)!==Number(el('phase').value)) el('skill').value='';
    setup();
  };
  el('level').onchange=setup;
  el('rush').hidden=!SpaceGame.bossRushUnlocked();
  el('rush').onclick=()=>{if(SpaceGame.startBossRush(el('craft').value)){panel.hidden=true;el('flight').focus();}};
  describe();
  function menu(title,message,paused){
    el('title').textContent=title;
    el('status').textContent=message;
    el('resume').hidden=!paused;
    panel.hidden=false;
  }
  function resume(){
    panel.hidden=true;el('resume').hidden=true;SpaceGame.resume();el('flight').focus();
  }
  el('start').onclick=()=>{
    panel.hidden=true;el('resume').hidden=true;
    const options=setup();
    SpaceGame.startBossPractice(options.boss,el('craft').value,options);
    el('start').textContent='Start encounter';el('flight').focus();
  };
  function paused(){menu('Practice paused','Resume this fight or start another encounter.',true);}
  el('pause').onclick=()=>{if(SpaceGame.pause())paused();};
  el('resume').onclick=resume;
  window.addEventListener('flight-pause',paused);
  window.addEventListener('flight-end',e=>menu(e.detail.status==='victory'?'Encounter cleared':'Ship lost',
    'Start again or choose another boss.',false));
  panel.hidden=false;
  Promise.all([SpaceArt.ready,SpaceWords.ready]).then(()=>{el('start').disabled=false;}).catch(()=>{el('status').textContent='Spacecraft art could not load. Reload to try again.';});
})();
