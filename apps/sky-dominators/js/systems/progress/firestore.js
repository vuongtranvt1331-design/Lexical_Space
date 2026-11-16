
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.SkyProgressCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.SkyProgressStore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
'use strict';
const ids=new Map();
async function uidForName(name){const key=C.norm(name);if(!key||key.length>80)throw Error('Enter a pilot name (1–80 characters).');if(!ids.has(key))ids.set(key,(async()=>{const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));return 'name_'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');})());return ids.get(key);}
function create(db,{now=()=>Date.now(),documentId='__name__'}={}){
 const initializing=new Map(),cached=new Map(),legacyCache=new Map();let boardCache=null,boardRequest=null;
 const pRef=uid=>db.doc('rankedPlayers/'+uid),bRef=uid=>db.doc('leaderboard/arcade_'+uid);
 const envelope=(uid,name,state)=>({uid,displayName:name,state:C.normalize(state)});
 function summary(uid,name,state){return {entryType:'arcade-player-v2',uid,nickname:name,score:state.personalBest?.score||0,aircraftIndex:state.personalBest?.aircraftIndex??null,flightId:state.personalBest?.flightId||null,qualifyingFlights:state.qualifyingFlights,rankId:C.rank(state.qualifyingFlights).id,legacyFlightIds:state.migration?.legacyFlightIds||[],updatedAt:now()};}
 function remember(value){if((cached.get(value.uid)?.state.revision||0)>value.state.revision)return value;cached.set(value.uid,value);if(boardCache&&value.state.personalBest){const row=summary(value.uid,value.displayName,value.state);boardCache.rows=boardCache.rows.filter(x=>x.uid!==value.uid&&C.norm(x.nickname)!==C.norm(row.nickname));boardCache.rows.push(row);boardCache.rows.sort((a,b)=>b.score-a.score||C.norm(a.nickname).localeCompare(C.norm(b.nickname)));}return value;}
 async function commit(fn){const value=await db.runTransaction(fn);if(value?.profile)remember(value.profile);else if(value?.uid&&value?.state)remember(value);return value;}
 async function matches(uid){let q=pRef(uid).collection('matches').orderBy(documentId),cursor=null,all=[];do{let next=q.limit(50);if(cursor)next=next.startAfter(cursor);const page=await next.get({source:'server'});all.push(...page.docs.map(d=>({id:d.id,data:d.data()})));cursor=page.size===50?page.docs.at(-1).id:null;}while(cursor);return all;}
 async function legacy(name,own){
  const alias=String(name).trim().toUpperCase().slice(0,12);
  let rows=legacyCache.get(alias);if(!rows){const snap=await db.collection('leaderboard').where('nickname','==',alias).get({source:'server'});rows=snap.docs.filter(d=>d.data().entryType!=='arcade-player-v2').map(d=>({id:d.id,data:d.data()}));legacyCache.set(alias,rows);}
  // Old leaderboard names were truncated. Long names can only claim rows linked by a known flight ID.
  if(String(name).trim().length>=12){const known=new Set(own.map(d=>d.id));return rows.filter(d=>known.has(d.id)||known.has(d.data.id));}
  return rows;
 }
 async function initialize(name,options={}){
  const uid=await uidForName(name);if(initializing.has(uid))return initializing.get(uid);if(cached.has(uid)&&!options.force)return cached.get(uid);
  const work=(async()=>{
   const ref=pRef(uid),rawSnap=await ref.get({source:'server'}),raw=rawSnap.data()||{};
   // Established profiles need one server read per visit. Explicit refresh also scans for late legacy-client writes.
   if(raw.arcade?.migrationComplete&&!options.force){
    const normalized=C.normalize(raw.arcade);
    const needsMigration=raw.arcade.skinOwnershipVersion!==2||JSON.stringify(raw.arcade.ownedSkins)!==JSON.stringify(normalized.ownedSkins)||JSON.stringify(raw.arcade.selectedSkins||{})!==JSON.stringify(normalized.selectedSkins);
    if(!needsMigration)return remember(envelope(uid,raw.displayName||String(name).trim(),normalized));
    // Read the current profile again inside the transaction, preserving concurrent purchases and balances.
    return commit(async tx=>{const snap=await tx.get(ref),data=snap.data();if(!data?.arcade)throw Error('Saved profile is unavailable. Retry without resetting progress.');const state=C.normalize(data.arcade);
     state.revision++;state.updatedAt=now();
     tx.update(ref,{'arcade.ownedSkins':state.ownedSkins,'arcade.skinOwnershipVersion':2,'arcade.selectedSkins':state.selectedSkins,'arcade.revision':state.revision,'arcade.updatedAt':state.updatedAt});
     return envelope(uid,data.displayName||String(name).trim(),state);
    });
   }
   if(options.force)legacyCache.delete(String(name).trim().toUpperCase().slice(0,12));
   const own=await matches(uid),oldBoard=await legacy(raw.displayName||name,own),flights=C.mergeLegacy(oldBoard,own.filter(d=>d.data.kind!=='aircraftPurchase'));
   const displayName=raw.displayName||String(name).trim().slice(0,80);
   await db.runTransaction(async tx=>{
    const snap=await tx.get(ref),data=snap.data()||{};
    if(data.arcade){C.normalize(data.arcade);return;}
    const state=C.migrationBase(data,flights,options.selectedAircraft||0);
    tx.set(ref,{uid,displayName:data.displayName||displayName,studentId:data.studentId||uid,arcade:state},{merge:true});
   });
   for(let offset=0;offset<flights.length;offset+=30){
    const chunk=flights.slice(offset,offset+30);
    await db.runTransaction(async tx=>{
     const [profile,...docs]=await Promise.all([tx.get(ref),...chunk.map(f=>tx.get(ref.collection('matches').doc(f.id)))]);
     let state=C.normalize(profile.data().arcade),changed=false;const writes=[];
     chunk.forEach((flight,i)=>{
      if(docs[i].data()?.arcadeResult)return;
      const applied=C.applyFlight(state,flight,now(),{legacy:true,retroCoins:state.migration?.retroCoins!==false});state=applied.state;changed=true;
      writes.push([ref.collection('matches').doc(flight.id),{kind:'completedFlight',arcadeResult:applied.result}]);
     });
     if(changed){for(const [target,data] of writes)tx.set(target,data,{merge:true});tx.set(ref,{arcade:state},{merge:true});}
    });
   }
   return commit(async tx=>{
    const [snap,board]=await Promise.all([tx.get(ref),tx.get(bRef(uid))]);const data=snap.data(),state=C.normalize(data.arcade);
    state.migrationComplete=true;state.migration={...state.migration,verifiedFlights:flights.length,legacyFlightIds:flights.map(f=>f.id),completedAt:state.migration?.completedAt||now()};
    // Preserve an already confirmed higher board record if a historical profile is incomplete.
    if(board.data()?.entryType==='arcade-player-v2'&&board.data().score>=C.MIN_SCORE)state.personalBest=C.betterBest(state.personalBest,{score:board.data().score,aircraftIndex:board.data().aircraftIndex??null,flightId:board.data().flightId||null,finishedAt:null});
    if(JSON.stringify(data.arcade)!==JSON.stringify(state))tx.set(ref,{arcade:state},{merge:true});
    const entry=summary(uid,data.displayName||displayName,state),previous=board.data();
    if(state.personalBest&&(!previous||['score','aircraftIndex','qualifyingFlights','nickname','legacyFlightIds'].some(k=>JSON.stringify(previous[k])!==JSON.stringify(entry[k]))))tx.set(bRef(uid),entry);
    return envelope(uid,data.displayName||displayName,state);
   });
  })();initializing.set(uid,work);
  try{return await work;}finally{if(initializing.get(uid)===work)initializing.delete(uid);}
 }
 async function complete(name,input,{recoveredPending=false}={}){
  const flight=C.validFlight(input),owner=await initialize(name),ref=pRef(owner.uid),record=ref.collection('matches').doc(flight.id);
  return commit(async tx=>{
   const [profile,old,board]=await Promise.all([tx.get(ref),tx.get(record),tx.get(bRef(owner.uid))]),data=profile.data();
   if(!data?.arcade?.migrationComplete)throw Error('Previous records are still being restored. Your result remains pending.');
   if(old.data()?.arcadeResult)return {profile:envelope(owner.uid,data.displayName,data.arcade),result:old.data().arcadeResult,duplicate:true};
   const previous=C.normalize(data.arcade);
   if(board.data()?.entryType==='arcade-player-v2'&&board.data().score>=C.MIN_SCORE)previous.personalBest=C.betterBest(previous.personalBest,{score:board.data().score,aircraftIndex:board.data().aircraftIndex??null,flightId:board.data().flightId||null,finishedAt:null});
   const applied=C.applyFlight(previous,flight,now(),{legacy:recoveredPending});
   if(recoveredPending)applied.result.source="recovered-owner-outbox";
   tx.set(record,{kind:'completedFlight',arcadeResult:applied.result},{merge:true});tx.set(ref,{arcade:applied.state},{merge:true});
   if(applied.state.personalBest)tx.set(bRef(owner.uid),summary(owner.uid,data.displayName,applied.state));
   return {profile:envelope(owner.uid,data.displayName,applied.state),result:applied.result,duplicate:false};
  });
 }
 async function buy(name,index){
  const owner=await initialize(name),ref=pRef(owner.uid),journal=ref.collection('matches').doc('purchase_'+C.AIRCRAFT_KEYS[index]);
  return commit(async tx=>{
   const [profile,receipt]=await Promise.all([tx.get(ref),tx.get(journal)]),data=profile.data(),state=C.normalize(data.arcade);
   if(receipt.data()?.kind==='aircraftPurchase'&&receipt.data().aircraftIndex===index){if(!state.ownedAircraft.includes(index)){state.ownedAircraft.push(index);tx.set(ref,{arcade:state},{merge:true});}return {profile:envelope(owner.uid,data.displayName,state),charged:0,duplicate:true};}
   const result=C.purchase(state,index,now());
   if(!result.duplicate){tx.set(ref,{arcade:result.state},{merge:true});tx.set(journal,{kind:'aircraftPurchase',aircraftIndex:index,coinsSpent:C.PRICE,purchasedAt:now(),transactionId:journal.id});}
   return {profile:envelope(owner.uid,data.displayName,result.state),charged:result.charged,duplicate:result.duplicate};
  });
 }
 async function buySkin(name,index,id){
  const ownershipId=C.skinOwnershipId(index,id);
  const owner=await initialize(name),ref=pRef(owner.uid),journal=ref.collection('matches').doc('skin_purchase_'+ownershipId),legacyJournal=ref.collection('matches').doc('skin_purchase_'+id);
  return commit(async tx=>{
   const [profile,receipt,legacyReceipt]=await Promise.all([tx.get(ref),tx.get(journal),tx.get(legacyJournal)]),data=profile.data();if(!data?.arcade)throw Error('Saved profile unavailable.');let state=C.normalize(data.arcade);
   if(!state.ownedAircraft.includes(index))throw Error('This aircraft is locked.');
   const record=receipt.data();
   if(record?.kind==='skinPurchase'&&record.skinId===ownershipId&&record.aircraftId===C.AIRCRAFT_KEYS[index]){
    if(!C.ownsSkin(state,index,id)){state.ownedSkins.push(ownershipId);state.revision++;state.updatedAt=now();tx.set(ref,{arcade:state},{merge:true});}
    return {profile:envelope(owner.uid,data.displayName,state),charged:0,duplicate:true};
   }
   if(receipt.exists)throw Error('Skin purchase receipt does not match this aircraft.');
   const old=legacyReceipt.data();
   if(old?.kind==='skinPurchase'&&old.skinId===id&&old.aircraftId===undefined&&old.aircraftIndex===undefined){
    const restored=C.normalize({...state,ownedSkins:[...state.ownedSkins,id]});
    if(JSON.stringify(restored.ownedSkins)!==JSON.stringify(state.ownedSkins)){restored.revision++;restored.updatedAt=now();tx.set(ref,{arcade:restored},{merge:true});}state=restored;
   }
   const result=C.purchaseSkin(state,index,id,now());
   if(!result.duplicate){tx.set(ref,{arcade:result.state},{merge:true});tx.set(journal,{kind:'skinPurchase',skinId:ownershipId,skinLineId:id,aircraftId:C.AIRCRAFT_KEYS[index],aircraftIndex:index,coinsSpent:result.charged,purchasedAt:now(),transactionId:journal.id});}
   return {profile:envelope(owner.uid,data.displayName,result.state),charged:result.charged,duplicate:result.duplicate};
  });
 }
 async function equipSkin(name,index,id){
  const owner=await initialize(name),ref=pRef(owner.uid);
  return commit(async tx=>{const snap=await tx.get(ref),data=snap.data(),state=C.equipSkin(data.arcade,index,id,now());tx.set(ref,{arcade:state},{merge:true});return envelope(owner.uid,data.displayName,state);});
 }
 async function select(name,index){
  const owner=await initialize(name),ref=pRef(owner.uid);
  return commit(async tx=>{const snap=await tx.get(ref),data=snap.data(),state=C.normalize(data.arcade);if(!state.ownedAircraft.includes(index))throw Error('This aircraft is locked.');if(state.selectedAircraft!==index){state.selectedAircraft=index;state.updatedAt=now();state.revision++;tx.set(ref,{arcade:state},{merge:true});}return envelope(owner.uid,data.displayName,state);});
 }
 async function acknowledge(name,flightId){
  const owner=await initialize(name),ref=pRef(owner.uid),flight=ref.collection('matches').doc(flightId);
  return commit(async tx=>{
   const [profile,record]=await Promise.all([tx.get(ref),tx.get(flight)]),data=profile.data(),state=C.normalize(data.arcade),result=record.data()?.arcadeResult;
   if(!result?.transition||result.transition.acknowledgedAt)return envelope(owner.uid,data.displayName,state);
   result.transition.acknowledgedAt=now();state.revision++;state.pendingPromotions=state.pendingPromotions.filter(p=>p.flightId!==flightId);
   tx.set(flight,{arcadeResult:result},{merge:true});tx.set(ref,{arcade:state},{merge:true});return envelope(owner.uid,data.displayName,state);
  });
 }
 async function history(name){
  const owner=await initialize(name);return (await matches(owner.uid)).filter(d=>d.data.arcadeResult?.kind==='flight').map(d=>d.data.arcadeResult).sort((a,b)=>b.finishedAt-a.finishedAt||a.id.localeCompare(b.id));
 }
 async function leaderboard({force=false,limit=10}={}){
  if(boardRequest)return boardRequest;if(boardCache&&!force&&now()-boardCache.at<300000)return boardCache.rows.slice(0,limit);
  const work=(async()=>{
   let rows=[],cursor=null;const unique=new Set();
   // Page only until enough distinct players are found; old repeated-flight rows are folded by identity.
   do{let q=db.collection('leaderboard').orderBy('score','desc').orderBy(documentId,'desc').limit(50);if(cursor)q=q.startAfter(cursor.score,cursor.id);const page=await q.get({source:'server'});
    for(const d of page.docs){const value=d.data();if(value.isDemo||value.score<C.MIN_SCORE)continue;rows.push({...value,id:d.id});}
    const ownerIds=new Map();for(const row of rows)if(row.entryType==='arcade-player-v2')for(const id of row.legacyFlightIds||[])ownerIds.set(id,row.nickname);
    unique.clear();for(const row of rows)unique.add(C.norm(ownerIds.get(row.flightId||row.id)||row.nickname));
    const last=page.docs.at(-1);cursor=page.size===50&&last&&last.data().score>=C.MIN_SCORE?{score:last.data().score,id:last.id}:null;
   }while(cursor&&unique.size<limit);
   const owners=new Map();for(const row of rows)if(row.entryType==='arcade-player-v2')for(const id of row.legacyFlightIds||[])owners.set(id,row);
   rows=rows.map(row=>{const owner=owners.get(row.flightId||row.id);return owner&&row.entryType!=='arcade-player-v2'?{...row,uid:owner.uid,nickname:owner.nickname}:row;});
   const groups=new Map();
   for(const row of rows){const key=C.norm(row.nickname),prior=groups.get(key);if(!prior||row.score>prior.score||(row.score===prior.score&&row.entryType==='arcade-player-v2'))groups.set(key,row);}
   const leaders=[...groups.values()].sort((a,b)=>b.score-a.score||C.norm(a.nickname).localeCompare(C.norm(b.nickname))).slice(0,limit);
   const result=[];
   for(const row of leaders){
    const uid=row.uid||await uidForName(row.nickname);let state=cached.get(uid)?.state;
    if(!state){const snap=await pRef(uid).get({source:'server'}),profile=snap.data();if(profile?.arcade?.migrationComplete)state=C.normalize(profile.arcade);
     else{const own=await matches(uid),oldRows=await legacy(row.nickname,own),flights=C.mergeLegacy(oldRows,own);state=C.migrationBase(profile||{},flights);state.qualifyingFlights=flights.filter(f=>f.score>=C.MIN_SCORE).length;}
    }
    const best=C.betterBest(state.personalBest,{score:row.score,aircraftIndex:row.aircraftIndex??null,flightId:row.flightId||row.id,finishedAt:row.timestamp||null});
    result.push({uid,nickname:row.nickname,score:best.score,aircraftIndex:best.aircraftIndex,qualifyingFlights:state.qualifyingFlights,rankId:C.rank(state.qualifyingFlights).id});
   }
   result.sort((a,b)=>b.score-a.score||C.norm(a.nickname).localeCompare(C.norm(b.nickname)));boardCache={at:now(),rows:result};return result;
  })();boardRequest=work;try{return await work;}finally{if(boardRequest===work)boardRequest=null;}
 }
 return {profile:initialize,complete,recoverPending:(name,input)=>complete(name,input,{recoveredPending:true}),buy,buySkin,equipSkin,select,acknowledge,history,leaderboard,uidForName};
}
return {create,uidForName};
});
