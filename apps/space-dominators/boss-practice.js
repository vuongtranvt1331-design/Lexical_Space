(() => {
  const el=id=>document.getElementById(id);
  const panel=el('lab');
  let labVolume=.5,labAudible=.5;
  try{labVolume=Math.max(0,Math.min(1,Number(JSON.parse(localStorage.getItem('space_dominators_pilot_v1'))?.volume??.5)));}catch{}
  function labSound(value){
    labVolume=value;if(value>0)labAudible=value;
    SpaceSound.volume(value);el('labVolume').value=Math.round(value*100);
    el('labMute').textContent=value?'🔊':'❌';
    el('labMute').setAttribute('aria-label',value?'Mute effects':'Unmute effects');
    el('labMute').setAttribute('aria-pressed',String(!value));
  }
  el('labVolume').oninput=()=>labSound(Number(el('labVolume').value)/100);
  el('labMute').onclick=()=>labSound(labVolume?0:labAudible);
  labSound(labVolume);
  const catalog = SpaceBosses.catalog;
  const fleetStudy = 11;
  let combatReady = false, studyPlayed = false;
  catalog.forEach((boss,index)=>el('encounter').add(new Option((index+1)+'. '+boss.name,index+1)));
  el('encounter').add(new Option('11. Hyperspace Fleet · Animation Lab', fleetStudy));
  const requestedBoss=Number(new URLSearchParams(location.search).get('boss'));
  if([...el('encounter').options].some(option=>option.value===String(requestedBoss)))el('encounter').value=requestedBoss;
  function setup(){
    const boss=Number(el('encounter').value),phase=Number(el('phase').value),level=el('level').selectedIndex+1;
    const entry=catalog[boss-1];
    el('previewSix').hidden=boss!==6;
    el('previewFinale').hidden=boss!==6;
    el('previewFive').hidden=boss!==5;
    const hard=phase>1;
    const choice=el('skill').value;
    const skillIndex=boss===6 || choice==='' ? undefined : Number(choice);
    const skill=boss===6?null:entry.skills?.[skillIndex];
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
    if(boss===6)el('cadence').textContent='Four formations rotate after 15 s or 10 fighter kills. Destroy 100 targets solo or 150 in co-op.';
    if(skill && boss!==5 && boss!==6) SpaceBossFX.load(boss).ready.then(ready=>{
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
    if(boss<=4) SpaceBossFX.loadHull(boss).ready.then(ready=>{
      if(!ready || Number(el('encounter').value)!==boss || Number(el('phase').value)!==phase) return;
      const ctx=el('bossPreview').getContext('2d');
      ctx.clearRect(0,0,152,152);
      SpaceBossFX.drawHull(ctx,{index:boss,max:100,hp:phase===1?100:50},0,76,76,135,0);
    });
    return {boss,phase,level,skillIndex};
  }
  function describe(){
    const index=Number(el('encounter').value)-1,boss=catalog[index];
    const study = index + 1 === fleetStudy;
    panel.classList.toggle('fleet-study', study);
    for (const node of document.querySelectorAll('[data-combat]')) node.hidden = study;
    el('start').disabled = !study && !combatReady;
    el('start').textContent = study ? (studyPlayed ? 'Replay animation' : 'Play animation') : 'Start encounter';
    if (study) {
      el('moveName').textContent = 'Hyperspace Fleet';
      el('intel').textContent = 'The dreadnought leads nine ships from four classes out of hyperspace.';
      el('cadence').textContent = '6.8 s · Esc to return';
      for (const id of ['previewFive','previewSix','previewFinale','skillFrames']) el(id).hidden = true;
      const ctx = el('bossPreview').getContext('2d');
      ctx.clearRect(0,0,152,152);
      SpaceFleetStudy.load().then(ready=>{
        if(ready && Number(el('encounter').value)===fleetStudy) SpaceFleetStudy.thumbnail(ctx);
      });
      return;
    }
    const prior=Number(el('phase').value)||2;
    el('phase').replaceChildren();
    for(let n=1;n<=boss.phases;n++)el('phase').add(new Option(n===1?'1 · Opening':n===3?'3 · Exposed core':'2 · Advanced pattern',n));
    el('phase').value=Math.min(prior,boss.phases);
    const select=el('skill');
    const oldSkill=select.dataset.boss===String(index) ? select.value : '';
    select.dataset.boss=String(index);
    select.replaceChildren(new Option('Full encounter',''));
    select.disabled=index===5;
    (index===5?[]:boss.skills||[]).forEach((skill,i)=>select.add(new Option(skill.name,i)));
    select.value=oldSkill;
    const ctx=el('bossPreview').getContext('2d');
    ctx.clearRect(0,0,152,152);
    if(index===5)window.SpaceDreadnought.sprite(ctx,'enemy_fighter',76,76,110);
    else if(index===4)window.SpaceBackdrop.drawMeteor(ctx,76,76,115,0,1);
    else if(index>=4) SpaceCampaignSprites.draw(ctx,index,76,76,150,150);
    SpaceBossFX.load(index+1).ready.then(ready=>{
      if (!ready || index===4 || index===5 || index<4 || Number(el('encounter').value)!==index+1) return;
      ctx.clearRect(0,0,152,152);
      SpaceBossFX.drawHull(ctx,{index:index+1},0,76,76,150,0);
    });
    setup();
  }
  Promise.all([SpaceCampaignSprites.ready,SpaceDreadnought.ready]).then(describe);
  el('encounter').onchange=()=>{
    el('status').textContent='Choose an encounter. Campaign progress and credits are separate.';
    describe();
  };
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
    if (Number(el('encounter').value) === fleetStudy) {
      SpaceGame.stop();
      previewing = true;
      el('pause').textContent = '×';
      el('pause').setAttribute('aria-label','Return to Boss Lab');
      el('flight').focus();
      SpaceFleetStudy.start(el('flight'), (completed, failed) => {
        previewing = false;
        studyPlayed = !failed;
        el('pause').textContent = 'Ⅱ';
        el('pause').setAttribute('aria-label','Pause practice');
        menu('Boss Lab', failed ? 'Fleet media could not load. Select Play animation to retry.' :
          (completed ? 'Fleet arrival complete.' : 'Fleet preview stopped.'), false);
        describe();
        el('start').focus();
      });
      return;
    }
    const options=setup();
    SpaceGame.startBossPractice(options.boss,el('craft').value,options);
    el('start').textContent='Start encounter';el('flight').focus();
  };
  function paused(){if(previewing){stopPreview();return;}menu('Practice paused','Resume this fight or start another encounter.',true);}
  let previewing=false;
  function stopPreview(){
    if(Number(el('encounter').value)===fleetStudy) SpaceFleetStudy.stop();
    else {SpaceFleetArrival.stop();SpaceBossSixPreview.stop();}
  }
  el('previewFive').onclick=async()=>{
    if(previewing)return;
    SpaceGame.stop();panel.hidden=true;previewing=true;
    const launched=await SpaceFleetArrival.start(el('flight'),()=>{
      previewing=false;menu('Boss Lab','Hyperspace arrival preview complete.',false);
    });
    if(!launched){previewing=false;menu('Boss Lab','Fleet art could not load. Reload to try again.',false);}
    el('flight').focus();
  };
  el('previewSix').textContent='Launch dreadnought assault';
  el('previewSix').onclick=()=>el('start').click();
  el('previewFinale').onclick=()=>{
    panel.hidden=true;el('resume').hidden=true;
    SpaceGame.startBossPractice(6,el('craft').value,{...setup(),reactorFinish:true});
    el('flight').focus();
  };
  el('pause').onclick=()=>{
    if(previewing){stopPreview();return;}
    if(SpaceGame.pause())paused();
  };
  window.addEventListener('keydown',e=>{
    if(previewing && e.code==='Escape'){e.preventDefault();stopPreview();}
  });
  el('resume').onclick=resume;
  window.addEventListener('flight-pause',paused);
  window.addEventListener('flight-end',e=>menu(e.detail.status==='victory'?'Encounter cleared':'Ship lost',
    'Start again or choose another boss.',false));
  panel.hidden=false;
  Promise.all([SpaceArt.ready,SpaceWords.ready,SpaceDreadnoughtEnding.ready,SpaceDreadnought.ready,SpaceBossSixPreview.ready]).then(async()=>{
    combatReady=true;
    el('start').disabled=false;
    el('previewFinale').disabled=false;
    el('previewSix').disabled=!await SpaceBossSixPreview.ready;
    if(new URLSearchParams(location.search).get('preview')==='6'){
      el('encounter').value='6';describe();el('previewSix').click();
    }
  }).catch(()=>{el('status').textContent='Spacecraft art could not load. Reload to try again.';});
})();
