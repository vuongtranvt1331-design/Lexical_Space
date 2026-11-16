'use strict';
// Only metadata is read; only game-scoped standings/result documents are written.
class SharedStandingService{
 constructor(config){this.config=config;this.db=null;this.profileCache=new Map();this.listeners=[];this.seen=new Set();this.state='offline'}
 async start(onRows){
  if(typeof firebase==='undefined')throw new Error('Firebase SDK unavailable');
  const app=firebase.apps.find(app=>app.name==='quickdrawn-shared')||firebase.initializeApp(this.config,'quickdrawn-shared');
  this.db=app.firestore();this.db.settings({ignoreUndefinedProperties:true,merge:true});
  // Firestore's cache is separate from the externally owned LexicalSpaceDB.
  await this.db.enablePersistence({synchronizeTabs:true}).catch(()=>{});
  this.unsubscribe=this.db.collection('standings').where('gameId','==','quickdrawn').onSnapshot({includeMetadataChanges:true},snapshot=>{
   const rows=snapshot.docs.map(doc=>doc.data()).filter(row=>row.gameId==='quickdrawn'&&typeof row.id==='string');
   this.state=snapshot.metadata.fromCache?'cached':'online';onRows(rows,this.state);
  },()=>{this.state='offline';onRows(null,'offline')});
  const profiles=await this.deadline(this.db.collection('metadata').get());
  profiles.docs.forEach(doc=>{const data=doc.data();if(typeof data.username==='string'&&data.username.trim()){const name=data.username.trim();this.profileCache.set(name,{username:name})}});
  return [...this.profileCache.keys()].sort((a,b)=>a.localeCompare(b));
 }
 deadline(promise,ms=6000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Cloud timeout')),ms);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)})})}
 async profile(name){
  if(!this.db||!name)return null;
  if(this.profileCache.has(name))return this.profileCache.get(name);
  const snapshot=await this.deadline(this.db.collection('metadata').where('username','==',name).limit(1).get());
  if(snapshot.empty)return null;
  const username=snapshot.docs[0].data().username;if(typeof username!=='string'||username.trim()!==name)return null;
  const profile={username:name};this.profileCache.set(name,profile);return profile;
 }
 ref(id){return this.db.collection('standings').doc('quickdrawn__'+id)}
 async player(id){const snapshot=await this.deadline(this.ref(id).get());return snapshot.exists?snapshot.data():null}
 async sync(result,profile){
  const key=profile.id+':'+result.id;if(this.seen.has(key))return;
  if(!await this.profile(profile.name))throw new Error('Profile not found in Homepage metadata');
  const ref=this.ref(profile.id),event=ref.collection('results').doc(result.matchId);
  await this.deadline(this.db.runTransaction(async transaction=>{
   const [saved,current]=await Promise.all([transaction.get(event),transaction.get(ref)]);if(saved.exists)return;
   const row=current.exists?current.data():{id:profile.id,name:profile.name,elo:1000,wins:0,losses:0,matchesPlayed:0,maxDeckSize:0,bestSurvivalScore:0};
   if(!Number.isSafeInteger(row.elo)||row.elo<100||!['wins','losses','matchesPlayed','maxDeckSize'].every(key=>Number.isSafeInteger(row[key])&&row[key]>=0))throw new Error('Invalid remote standing');
   const elo=Math.max(100,row.elo+result.deltaElo),win=result.outcome==='win',time=firebase.firestore.FieldValue.serverTimestamp();
   const player={id:profile.id,username:profile.name,name:profile.name,gameId:'quickdrawn',elo,wins:row.wins+(win?1:0),losses:row.losses+(result.outcome==='loss'?1:0),matchesPlayed:row.matchesPlayed+1,maxDeckSize:Math.max(row.maxDeckSize,result.deckSize),bestSurvivalScore:Math.max(row.bestSurvivalScore||0,result.mode==='pvc'?result.correctCount:0),updatedAt:time};
   transaction.set(ref,player,{merge:true});transaction.set(event,{...result,gameId:'quickdrawn',username:profile.name,serverEloBefore:row.elo,serverEloAfter:elo,syncedAt:time});
  }));this.seen.add(key);
 }
 async result(id,matchId){const doc=await this.deadline(this.ref(id).collection('results').doc(matchId).get());return doc.exists?doc.data():null}
 async syncPair(results,profiles){
  if(!Array.isArray(results)||results.length!==2||!Array.isArray(profiles)||profiles.length!==2||profiles[0].id===profiles[1].id||results[0].matchId!==results[1].matchId||results[0].mode!==results[1].mode||results[0].deckSize!==results[1].deckSize||results[0].deckWeight!==results[1].deckWeight||(results[0].outcome==='draw'?results[1].outcome!=='draw':results[0].outcome===results[1].outcome)||results.some((r,i)=>r.playerId!==profiles[i].id||r.opponentId!==profiles[1-i].id||!['pvp','chess'].includes(r.mode)||!['win','loss','draw'].includes(r.outcome)||!Number.isSafeInteger(r.deltaElo)))throw Error('Invalid paired result');
  if(!(await Promise.all(profiles.map(p=>this.profile(p.name)))).every(Boolean))throw Error('Unknown profile');
  const refs=profiles.map(p=>this.ref(p.id)),events=refs.map(ref=>ref.collection('results').doc(results[0].matchId));
  await this.deadline(this.db.runTransaction(async tx=>{
   const docs=await Promise.all([...events,...refs].map(ref=>tx.get(ref))),saved=docs.slice(0,2),existing=saved.findIndex(s=>s.exists);
   const actual=r=>r.outcome==='win'?1:r.outcome==='draw'?.5:0;
   for(let i=0;i<2;i++){
    if(saved[i].exists)continue;
    const row=docs[i+2].exists?docs[i+2].data():{id:profiles[i].id,name:profiles[i].name,elo:1000,wins:0,losses:0,matchesPlayed:0,maxDeckSize:0,bestSurvivalScore:0};
    if(!Number.isSafeInteger(row.elo)||row.elo<100||!['wins','losses','matchesPlayed','maxDeckSize'].every(k=>Number.isSafeInteger(row[k])&&row[k]>=0))throw Error('Invalid remote standing');
    let result={...results[i]};
    // A previously committed event wins; fill only the missing complementary side.
    if(existing>=0){const score=1-actual(saved[existing].data()),weight=result.mode==='chess'?1:result.deckWeight,k=row.matchesPlayed<30?32:16,expected=1/(1+Math.pow(10,(profiles[1-i].elo-profiles[i].elo)/400));result.outcome=score===1?'win':score===0?'loss':'draw';result.deltaElo=Math.round(k*(score-expected)*weight)}
    const elo=Math.max(100,row.elo+result.deltaElo),time=firebase.firestore.FieldValue.serverTimestamp();
    result={...result,eloBefore:row.elo,eloAfter:elo,appliedDeltaElo:elo-row.elo};
    const player={id:profiles[i].id,username:profiles[i].name,name:profiles[i].name,gameId:'quickdrawn',elo,wins:row.wins+(result.outcome==='win'?1:0),losses:row.losses+(result.outcome==='loss'?1:0),matchesPlayed:row.matchesPlayed+1,maxDeckSize:Math.max(row.maxDeckSize,result.deckSize),bestSurvivalScore:row.bestSurvivalScore||0,updatedAt:time};
    tx.set(refs[i],player,{merge:true});tx.set(events[i],{...result,gameId:'quickdrawn',username:profiles[i].name,serverEloBefore:row.elo,serverEloAfter:elo,syncedAt:time});
   }
  }));
 }

}
