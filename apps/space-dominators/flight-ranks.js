import {flightStore} from './flight-ranks-store.js';

const store=flightStore();
const panel=document.querySelector('#flightRanks');
const toggle=panel.querySelector('[data-rank-mode]');
const list=panel.querySelector('ol');
const identity=panel.querySelector('[data-rank-pilot]');
const status=panel.querySelector('[role=status]');
const small=matchMedia('(max-width: 959px)');
const keyPrefix='space_flight_ranks_v1:';
const queuePrefix=keyPrefix+'pending:';
const ttl=5*60*1000;
const profile=()=>window.SpaceSuite.profile();
const cloudPilot=name=>Boolean(name && name.toLowerCase()!=='guest');
let mode='solo', generation=0, flushing=null, retry=0, retryMs=15000;
const recent=new Map();
const jobs=new Map();
const get=key=>{try{return JSON.parse(localStorage.getItem(key))}catch{return null}};
const set=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
const station=document.querySelector('#station');
const visible=()=>!panel.hidden && !station.hidden && (!station.dataset.hangar || station.dataset.hangar==='main') && !document.hidden && (!small.matches || panel.classList.contains('expanded'));
const boardKey=(m,name)=>keyPrefix+'board:'+m+':'+encodeURIComponent(name);
function draw(rows,name) {
  const own=rows.find(r=>r.pilot===name);
  identity.textContent=(name || 'Guest')+' · '+(own?'#'+own.rank:'Unranked');
  list.replaceChildren();
  for(const row of rows) {
    const item=document.createElement('li');
    if(row.pilot===name)item.className='rank-self';
    const position=document.createElement('b');position.textContent='#'+row.rank;
    const canvas=document.createElement('canvas');canvas.width=82;canvas.height=96;
    canvas.setAttribute('role','img');canvas.setAttribute('aria-label',row.ship);
    const info=document.createElement('div'),pilot=document.createElement('strong'),stats=document.createElement('span');
    pilot.textContent=row.pilot;pilot.title=row.pilot;
    stats.textContent=row.score.toLocaleString('en-US')+' pts · '+row.kills+' ships';
    info.append(pilot,stats);item.append(position,canvas,info);list.append(item);
    SpaceArt.playerReady.then(()=>SpaceArt.draw(canvas.getContext('2d'),row.ship,41,40,84,80,2)).catch(()=>{});
  }
}
async function refresh(force=false) {
  if(!visible())return;
  const id=++generation, name=profile(), current=mode, key=boardKey(current,name);
  const cache=recent.get(key)||get(key);
  draw(cache?.rows || [],name);
  toggle.querySelectorAll('span').forEach(span=>span.classList.toggle('active',span.textContent.toLowerCase()===mode));
  toggle.setAttribute('aria-label','Flight ranks: '+mode+'. Switch to '+(mode==='solo'?'team':'solo'));
  status.textContent=cache?.rows?.length ? '' : cache ? 'No ranked missions yet.' : 'Loading standings…';
  if(!force && cache && Date.now()-cache.time<ttl)return;
  try {
    let job=jobs.get(key);
    if(force || !job){
      job=store.board(current,cloudPilot(name)?name:'');
      jobs.set(key,job);
    }
    let rows;
    try { rows=await job; } finally { if(jobs.get(key)===job)jobs.delete(key); }
    if(id!==generation)return;
    const next={time:Date.now(),rows};recent.set(key,next);set(key,next);
    if(id!==generation || mode!==current || name!==profile())return;
    draw(rows,name);status.textContent=rows.length?'':'No ranked missions yet.';
  } catch {
    if(id===generation)status.textContent=cache?'Showing saved standings.':'Standings temporarily unavailable.';
  }
}
function pending() {
  const entries=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key?.startsWith(queuePrefix)){const run=get(key);if(run)entries.push([key,run]);}
  }
  return entries;
}
function scheduleRetry() {
  if(retry || !navigator.onLine)return;
  retry=setTimeout(()=>{retry=0;flush();},retryMs);retryMs=Math.min(retryMs*2,300000);
}
function flush() {
  if(flushing || !navigator.onLine)return flushing;
  flushing=(async()=>{
    const changed=new Set();
    for(const [key,run] of pending()){
      try{
        await store.save(run);localStorage.removeItem(key);
        const cache=boardKey(run.mode,run.pilot);recent.delete(cache);localStorage.removeItem(cache);
        changed.add(run.mode);
      } catch {scheduleRetry();break;}
    }
    if(changed.size){retryMs=15000;if(changed.has(mode)) await refresh(true);}
  })().catch(scheduleRetry).finally(()=>{flushing=null;});
  return flushing;
}
window.addEventListener('spaceflight:record',event=>{
  const run=event.detail;
  if(!cloudPilot(run.pilot))return;
  const key=queuePrefix+run.mode+':'+encodeURIComponent(run.pilot)+':'+run.id;
  set(key,run);
  Promise.resolve(flush()).then(()=>{if(get(key) && !retry)scheduleRetry();});
});
toggle.addEventListener('click',event=>{
  const option=event.target.closest('span');
  const next=option ? option.textContent.toLowerCase() : mode==='solo'?'team':'solo';
  if(next!==mode){mode=next;refresh();}
});
const disclosure=document.querySelector('#showFlightRanks');
disclosure.addEventListener('click',()=>{
  const open=panel.classList.toggle('expanded');
  disclosure.setAttribute('aria-expanded',String(open));if(open)refresh();
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){flush();refresh();}});
window.addEventListener('online',()=>{flush();refresh(true);});
window.addEventListener('storage',e=>{if(e.key?.startsWith(queuePrefix) && e.newValue)flush();});
new MutationObserver(()=>{if(visible())refresh();}).observe(document.querySelector('#station'),{attributes:true,attributeFilter:['hidden','data-hangar']});
small.addEventListener('change',()=>refresh());
flush();refresh();
