/* Confirmed cloud state is cached; completed flights are durable commands, never balance snapshots. */
(function(){
'use strict';
const C=SkyProgressCore, prefix='sky.v2.', listeners=new Set(), running=new Map(), memoryPending=new Map(), backupWrites=new Map(), results=new Map();
let store=null, current=null, name='', status='Connecting…', epoch=0, boot=null, selected=0, isFlying=()=>false;
const safeGet=(key,fallback=null)=>{try{const raw=localStorage.getItem(key);return raw===null?fallback:JSON.parse(raw);}catch{return fallback;}};
const cacheKey=n=>prefix+'profile:'+C.norm(n), pendingPrefix=n=>prefix+'pending:'+encodeURIComponent(C.norm(n))+':';
const emit=()=>{for(const fn of listeners)fn();window.dispatchEvent(new CustomEvent('sky-profile'));};
function localText(key){try{return localStorage.getItem(key)||'';}catch{return '';}}
function linkedName(){return window.SpaceSuite?SpaceSuite.profile():(new URLSearchParams(location.search).get('user')||localText('vocab_user')).trim();}
function readName(){return (linkedName()||localText('air_strike_player_nickname')||'').trim();}
function durable(action,key,value){
 return new Promise((resolve,reject)=>{const r=indexedDB.open('SkyDominatorsProgress',1);r.onupgradeneeded=()=>r.result.createObjectStore('outbox',{keyPath:'key'});r.onerror=()=>reject(r.error);r.onsuccess=()=>{
  const db=r.result,tx=db.transaction('outbox',action==='all'?'readonly':'readwrite'),store=tx.objectStore('outbox');
  const request=action==='all'?store.getAll():action==='put'?store.put({key,...value}):store.delete(key);let result;
  request.onsuccess=()=>result=request.result;tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};
 };});
}
async function restorePending(n){try{for(const row of await durable('all'))if(C.norm(row.name)===C.norm(n))memoryPending.set(row.key,row);}catch{}}

function setStatus(text){status=text;emit();}
function accept(p){
 if(C.norm(p.displayName)!==C.norm(name)&&p.uid!==current?.uid)return;
 if(current&&p.state.revision<current.state.revision)return;
 current=p;try{localStorage.setItem(cacheKey(name),JSON.stringify(p));}catch{}
 const preference=safeGet(prefix+'selected:'+C.norm(name));selected=p.state.ownedAircraft.includes(preference)?preference:p.state.selectedAircraft;
 emit();
}
function pending(n){
 const map=new Map();try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith(pendingPrefix(n))){const row=safeGet(key);if(row?.flight)map.set(key,row);}}}catch{}
 for(const [key,row] of memoryPending)if(key.startsWith(pendingPrefix(n)))map.set(key,row);
 return [...map].map(([key,row])=>({key,...row})).sort((a,b)=>a.flight.finishedAt-b.flight.finishedAt);
}
function queue(n,flight,legacyKey=null){
 const value={name:n,flight:C.validFlight(flight),legacyKey},key=pendingPrefix(n)+flight.id;
 memoryPending.set(key,value);
 try{localStorage.setItem(key,JSON.stringify(value));memoryPending.delete(key);}
 catch{
  const task=durable('put',key,value).catch(()=>setStatus('Device storage unavailable. Keep this page open until the flight is saved to cloud.'));
  backupWrites.set(key,task);task.finally(()=>backupWrites.delete(key));
 }
 return key;
}
function importPending(n){
 const key='ranked.outbox.name:'+C.norm(n),rows=safeGet(key,[]);
 if(!Array.isArray(rows))return;
 for(const f of rows){try{queue(n,{...f,id:f.matchId,finishedAt:f.finishedAt||f.completedAt||0},key);}catch{/* Preserve malformed legacy entries for recovery. */}}
}
function markSeen(id){const key=prefix+'promotion:'+C.norm(name)+':'+id;try{localStorage.setItem(key,'true');}catch{}}
function seen(id){return safeGet(prefix+'promotion:'+C.norm(name)+':'+id,false)===true;}
async function ackSeen(n){
 if(C.norm(n)!==C.norm(name)||isFlying()||!current)return;
 for(const p of current.state.pendingPromotions)if(seen(p.flightId)){try{accept(await store.acknowledge(n,p.flightId));}catch{return;}}
}
async function flush(n=name){
 if(!store||!n||isFlying())return;if(running.has(C.norm(n)))return running.get(C.norm(n));
 const task=(async()=>{
  try{
   const p=await store.profile(n);if(C.norm(n)===C.norm(name))accept(p);
   for(const item of pending(n)){
    if(isFlying())break;
    if(backupWrites.has(item.key))await backupWrites.get(item.key);
    const saved=await (item.legacyKey?store.recoverPending(n,item.flight):store.complete(n,item.flight));
    if(C.norm(n)===C.norm(name)){accept(saved.profile);results.set(item.flight.id,saved.result);}
    try{localStorage.removeItem(item.key);}catch{}await durable('delete',item.key).catch(()=>{});memoryPending.delete(item.key);
    if(item.legacyKey){const old=safeGet(item.legacyKey,[]);localStorage.setItem(item.legacyKey,JSON.stringify(old.filter(f=>f.matchId!==item.flight.id)));}
    emit();
   }
   if(C.norm(n)===C.norm(name)){status=pending(n).length?'Save pending — will resume after this flight.':'Cloud saved';emit();await ackSeen(n);}
  }catch(error){if(C.norm(n)===C.norm(name))setStatus((pending(n).length?'Result kept on this device; save pending. ':'Offline — showing last confirmed profile. ')+(error.message||'Retry when connected.'));}
 })();running.set(C.norm(n),task);try{return await task;}finally{running.delete(C.norm(n));}
}
async function init(force=false){
 const n=readName();if(!n){name='PILOT-'+crypto.randomUUID().slice(0,6).toUpperCase();localStorage.setItem('air_strike_player_nickname',name);}else name=n;
 const requestEpoch=++epoch;current=null;selected=0;const old=safeGet(cacheKey(name));
 try{if(old){old.state=C.normalize(old.state);current=old;selected=old.state.selectedAircraft;}}catch{}
 const local=safeGet(prefix+'selected:'+C.norm(name));if(current?.state.ownedAircraft.includes(local))selected=local;
 status=current?'Loading saved profile…':'Connecting — Rookie until your saved profile loads';emit();importPending(name);
 const captured=name;
 boot=(async()=>{try{await restorePending(captured);const p=await store.profile(captured,{force});if(requestEpoch!==epoch)return;accept(p);status='Cloud saved';emit();await flush(captured);}catch(error){if(requestEpoch===epoch)setStatus('Cloud unavailable. Saved records have not been reset. '+error.message);}})();
 return boot;
}
async function setName(value){
 const linked=linkedName();
 if(linked){setStatus('Pilot linked to LexicalSpace / Arcade Hub: '+linked+'. Change students there.');return false;}
 const next=String(value).trim();if(!next||next.length>80)throw Error('Use a pilot name of 1–80 characters.');
 if(isFlying())throw Error('Finish or leave this flight before changing pilots.');
 localStorage.setItem('air_strike_player_nickname',next);await init();return true;
}
async function select(index){
 if(!api.owns(index))throw Error('This aircraft is locked.');
 selected=index;try{localStorage.setItem(prefix+'selected:'+C.norm(name),JSON.stringify(index));}catch{}
 emit();const n=name;
 if(!isFlying())try{const p=await store.select(n,index);if(C.norm(n)===C.norm(name))accept(p);}catch{setStatus('Aircraft selected on this device; cloud selection pending.');}
}
async function buy(index){
 if(isFlying())throw Error('Purchases are available in the Hangar between flights.');
 const n=name,saved=await store.buy(n,index);if(C.norm(n)===C.norm(name))accept(saved.profile);
 setStatus(saved.duplicate?'Aircraft already owned.':'Aircraft purchased — 500 Coins');return saved;
}
const skinRequests=new Map();
async function buySkin(index,id){
 if(isFlying())throw Error('Finish this flight before purchasing a skin.');
 if(!store)throw Error('Connect to cloud before purchasing.');
 const n=name,key=C.norm(n)+':'+C.skinOwnershipId(index,id);if(skinRequests.has(key))return skinRequests.get(key);
 const work=(async()=>{const saved=await store.buySkin(n,index,id);if(C.norm(n)===C.norm(name))accept(saved.profile);setStatus(saved.duplicate?'Skin already owned.':'Skin unlocked — '+saved.charged+' Coins');return saved;})();
 skinRequests.set(key,work);try{return await work;}finally{skinRequests.delete(key);}
}
async function equipSkin(index,id){
 if(isFlying())throw Error('Finish this flight before changing skins.');
 if(!store)throw Error('Connect to cloud to save your skin.');
 const n=name,p=await store.equipSkin(n,index,id);if(C.norm(n)===C.norm(name))accept(p);return p;
}
function complete(owner,flight){
 queue(owner,flight);if(C.norm(owner)===C.norm(name)){status='Saving completed flight…';emit();}void flush(owner);
}
const api={
 connect(config,options={}){isFlying=options.isFlying||isFlying;try{const app=firebase.apps.length?firebase.app():firebase.initializeApp(config);store=SkyProgressStore.create(app.firestore(),{documentId:firebase.firestore.FieldPath.documentId()});void init();}catch(error){status='Cloud unavailable. '+error.message;emit();}},
 get name(){return name||readName();},get state(){return current?.state||C.initial();},get status(){return status;},get confirmed(){return !!current;},get selected(){return selected;},
 owns:index=>Number.isInteger(index)&&(current?.state.ownedAircraft||[0]).includes(index),
 syncIdentity(){if(readName()&&C.norm(readName())!==C.norm(name)&&!isFlying())void init();},
 on:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},init,setName,select,buy,buySkin,equipSkin,complete,flush,
 ownsSkin:(index,id)=>C.ownsSkin(api.state,index,id),
 skin:index=>{const id=api.state.selectedSkins[C.AIRCRAFT_KEYS[index]];return C.ownsSkin(api.state,index,id)?id:'factory_default';},
 pending:()=>pending(name),result:id=>results.get(id),rank:()=>C.rank(api.state.qualifyingFlights),
 async leaderboard(force=false){if(!store)throw Error('Cloud connection unavailable');return store.leaderboard({force,limit:10});},
 async history(){if(!store)throw Error('Cloud connection unavailable');return store.history(name);},
 promotions:()=>api.state.pendingPromotions.filter(p=>!seen(p.flightId)),
 async acknowledge(id){markSeen(id);if(!store||isFlying())return;try{accept(await store.acknowledge(name,id));}catch{setStatus('Promotion shown; confirmation pending.');}},
 get ready(){return boot;}
};
window.SkyProfile=api;
window.addEventListener('online',()=>{if(!isFlying())void init(true);});
window.addEventListener('storage',e=>{
 if(['vocab_user','air_strike_player_nickname'].includes(e.key)){if(!isFlying())void init();}
 if(e.key?.startsWith(prefix+'pending:')&&!isFlying())void flush();
 if(e.key===cacheKey(name)){const p=safeGet(e.key);if(p)try{p.state=C.normalize(p.state);accept(p);}catch{}}
});
})();
