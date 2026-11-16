
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../../config/skins/catalog.js'):root.SkySkinCatalog);if(typeof module==='object'&&module.exports)module.exports=api;else root.SkyProgressCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(S){
'use strict';
const SCHEMA=2,PRICE=500,MIN_SCORE=10000,MAX_SCORE=999999;
const AIRCRAFT_KEYS=Object.freeze(['fighter_1','titan','phantom','corsair','phantom_prototype','viper','reaper','nightbat','chronos','bomber']);
const names=['Rookie','Silver I','Silver II','Gold I','Gold II','Platinum I','Platinum II','Emerald I','Emerald II','Diamond I','Diamond II','Celestial I','Celestial II','Galaxy I','Galaxy II','Eternal Sovereign'];
const iconFiles=['rank_iron_1.png','rank_silver_1.png','rank_silver_2.png','rank_gold_1.png','rank_gold_2.png','rank_platinum_1.png','rank_platinum_2.png','rank_emerald_1.png','rank_emerald_2.png','rank_diamond_1.png','rank_diamond_2.png','rank_celestial_1.png','rank_celestial_2.png','rank_galaxy_1.png','rank_galaxy_2.png','rank_eternal_sovereign.png'];
const RANKS=Object.freeze(names.map((name,index)=>Object.freeze({name,index,id:name.toLowerCase().replaceAll(' ','_'),icon:'assets/rank-progress/'+iconFiles[index]})));
const norm=value=>String(value||'').normalize('NFKC').trim().toLowerCase();
function integer(value,label,min=0,max=Number.MAX_SAFE_INTEGER){if(!Number.isSafeInteger(value)||value<min||value>max)throw Error('Invalid '+label);return value;}
function rank(count){return RANKS[Math.min(15,integer(count,'qualifying-flight count'))];}
function reward(score){integer(score,'score',0,MAX_SCORE);const n=Math.floor(score/10000);return 5*n*(n+3)/2;}
function initial(){return {schemaVersion:SCHEMA,revision:0,qualifyingFlights:0,coins:0,coinsEarned:0,coinsSpent:0,ownedAircraft:[0],selectedAircraft:0,ownedSkins:['factory_default'],skinOwnershipVersion:2,selectedSkins:{},personalBest:null,completedFlights:0,pendingPromotions:[],migrationComplete:false,updatedAt:null};}
function normalize(value){
 const s={...initial(),...value};if(s.schemaVersion!==SCHEMA)throw Error('Unsupported saved profile version');
 for(const field of ['revision','qualifyingFlights','coins','coinsEarned','coinsSpent','completedFlights'])integer(s[field],field);
 if(!Array.isArray(s.ownedAircraft)||!s.ownedAircraft.every(i=>Number.isInteger(i)&&i>=0&&i<AIRCRAFT_KEYS.length))throw Error('Invalid saved aircraft ownership');
 s.ownedAircraft=[...new Set([0,...s.ownedAircraft])];s.selectedAircraft=s.ownedAircraft.includes(s.selectedAircraft)?s.selectedAircraft:0;
 s.ownedSkins=normalizeSkinOwnership(s.ownedSkins);s.skinOwnershipVersion=2;grantRankSkins(s);
 s.selectedSkins=Object.fromEntries(Object.entries(s.selectedSkins||{}).filter(([key,id])=>ownsSkin(s,AIRCRAFT_KEYS.indexOf(key),id)));
 if(s.personalBest){integer(s.personalBest.score,'personal-best score',MIN_SCORE,MAX_SCORE);if(s.personalBest.aircraftIndex!==null)integer(s.personalBest.aircraftIndex,'personal-best aircraft',0,AIRCRAFT_KEYS.length-1);}
 if(!Array.isArray(s.pendingPromotions))throw Error('Invalid saved promotions');
 return s;
}
function validFlight(input){
 if(!input||typeof input.id!=='string'||!/^[-_a-zA-Z0-9]{8,150}$/.test(input.id))throw Error('Invalid flight ID');
 integer(input.score,'score',0,MAX_SCORE);integer(input.aircraftIndex,'aircraft',0,AIRCRAFT_KEYS.length-1);
 if(input.completed!==true)throw Error('Only completed flights can be saved');
 return {id:input.id,score:input.score,aircraftIndex:input.aircraftIndex,completed:true,finishedAt:Number.isFinite(input.finishedAt)?input.finishedAt:0,targetsCleared:Number.isSafeInteger(input.targetsCleared)&&input.targetsCleared>=0?input.targetsCleared:0};
}
function betterBest(current,candidate){if(!candidate||candidate.score<MIN_SCORE)return current;if(!current||candidate.score>current.score)return {...candidate};return current;}
function applyFlight(previous,input,at,{legacy=false,retroCoins=true}={}){
 const flight=validFlight(input),s=normalize(previous),before=rank(s.qualifyingFlights),qualifies=flight.score>=MIN_SCORE;
 if(!legacy&&!s.ownedAircraft.includes(flight.aircraftIndex))throw Error('This aircraft is not owned');
 const coins=legacy&&!retroCoins?0:reward(flight.score);
 s.completedFlights++;if(qualifies)s.qualifyingFlights++;
 s.coins+=coins;s.coinsEarned+=coins;integer(s.coins,'Coin balance');integer(s.coinsEarned,'earned Coins');
 s.personalBest=betterBest(s.personalBest,{score:flight.score,aircraftIndex:flight.aircraftIndex,flightId:flight.id,finishedAt:flight.finishedAt});
 const skinsAwarded=grantRankSkins(s);
 const after=rank(s.qualifyingFlights),transition=!legacy&&after.index>before.index?{flightId:flight.id,from:before.index,to:after.index,acknowledgedAt:null}:null;
 if(transition)s.pendingPromotions=[...s.pendingPromotions,transition];
 s.updatedAt=at;s.revision++;
 return {state:s,result:{...flight,kind:'flight',qualifies,coinsAwarded:coins,skinsAwarded,rankBefore:before.index,rankAfter:after.index,transition,source:legacy?'verified-legacy':'new-flight',savedAt:at}};
}
function purchase(previous,index,at){
 integer(index,'aircraft',0,AIRCRAFT_KEYS.length-1);const s=normalize(previous);
 if(s.ownedAircraft.includes(index))return {state:s,duplicate:true,charged:0};
 if(s.coins<PRICE)throw Error('Insufficient Coins: this aircraft costs 500 Coins.');
 s.coins-=PRICE;s.coinsSpent+=PRICE;s.ownedAircraft.push(index);s.updatedAt=at;s.revision++;
 return {state:s,duplicate:false,charged:PRICE};
}
function skinCompatible(index,id){const line=S.lines.find(l=>l.id===id),key=AIRCRAFT_KEYS[index];return Number.isInteger(index)&&!!key&&!!line&&(!line.aircraft||line.aircraft.includes(key))&&(id==='factory_default'||!!S.bodies[key]?.[id]);}
function skinOwnershipId(index,id){if(!skinCompatible(index,id))throw Error('This skin is not compatible with this aircraft.');return AIRCRAFT_KEYS[index]+'__'+id;}
function normalizeSkinOwnership(values){
 const owned=new Set(['factory_default']);
 for(const value of Array.isArray(values)?values:[]){
  if(typeof value!=='string'||value==='factory_default')continue;
  const split=value.indexOf('__');
  if(split>=0){const key=value.slice(0,split),id=value.slice(split+2),index=AIRCRAFT_KEYS.indexOf(key);if(skinCompatible(index,id)&&id!=='factory_default')owned.add(skinOwnershipId(index,id));continue;}
  // Old receipts sold a whole line and contain no aircraft ID. Preserve those existing entitlements,
  // expanding them once to the supported current aircraft; every NEW purchase writes one exact ID.
  if(S.lines.some(l=>l.id===value))for(let i=0;i<AIRCRAFT_KEYS.length;i++)if(skinCompatible(i,value))owned.add(skinOwnershipId(i,value));
 }
 return [...owned];
}
function ownsSkin(state,index,id){return skinCompatible(index,id)&&(id==='factory_default'||state.ownedSkins?.includes(skinOwnershipId(index,id)));}
// Rank gifts use the same aircraft-specific ownership keys as purchases, without currency writes.
function grantRankSkins(state){
 const added=[];
 for(const line of S.lines){
  if(line.unlock?.type!=='rank')continue;
  const required=RANKS.find(r=>r.id===line.unlock.rankId);if(!required||rank(state.qualifyingFlights).index<required.index)continue;
  for(let i=0;i<AIRCRAFT_KEYS.length;i++)if(skinCompatible(i,line.id)){
   const key=skinOwnershipId(i,line.id);if(!state.ownedSkins.includes(key)){state.ownedSkins.push(key);added.push(key);}
  }
 }
 return added;
}
function sortedSkins(index){return S.lines.filter(l=>skinCompatible(index,l.id)).sort((a,b)=>(b.hangarPriority||0)-(a.hangarPriority||0)||(b.price??-1)-(a.price??-1));}
function purchaseSkin(previous,index,id,at){
 const key=skinOwnershipId(index,id),line=S.lines.find(l=>l.id===id),s=normalize(previous);
 if(!s.ownedAircraft.includes(index))throw Error('This aircraft is locked.');
 if(ownsSkin(s,index,id))return {state:s,duplicate:true,charged:0};
 if(line.unlock?.type==='rank')throw Error('Reach '+(RANKS.find(r=>r.id===line.unlock.rankId)?.name||line.unlock.rankId)+' to receive this skin. It cannot be purchased.');
 if(!Number.isSafeInteger(line.price)||line.price<0)throw Error('This skin is not available to unlock yet.');
 if(s.coins<line.price)throw Error('Insufficient Coins: this skin costs '+line.price+' Coins.');
 s.coins-=line.price;s.coinsSpent+=line.price;s.ownedSkins.push(key);s.updatedAt=at;s.revision++;
 return {state:s,duplicate:false,charged:line.price};
}
function equipSkin(previous,index,id,at){
 const s=normalize(previous);integer(index,'aircraft',0,AIRCRAFT_KEYS.length-1);
 if(!s.ownedAircraft.includes(index))throw Error('This aircraft is locked.');
 if(!skinCompatible(index,id))throw Error('This skin is not compatible with this aircraft.');
 if(!ownsSkin(s,index,id))throw Error('This skin is locked.');
 if(s.selectedSkins[AIRCRAFT_KEYS[index]]!==id){s.selectedSkins[AIRCRAFT_KEYS[index]]=id;s.updatedAt=at;s.revision++;}return s;
}
function legacyFlight(raw,id){
 if(!raw||raw.isDemo===true||raw.abandoned===true||raw.completed===false||['aircraftPurchase','skinPurchase'].includes(raw.kind))return null;
 if(raw.outcome&&raw.outcome!=='completed')return null;
 try{return validFlight({id:raw.matchId||raw.id||id,score:raw.score,aircraftIndex:raw.aircraftIndex,targetsCleared:raw.targetsCleared,finishedAt:raw.completedAt||raw.timestamp||0,completed:true});}catch{return null;}
}
function mergeLegacy(leaderboard,matches){
 const flights=new Map();
 // Exact match histories preserve aircraft indices that the older leaderboard clamped to 0..4.
 for(const doc of [...leaderboard,...matches]){const flight=legacyFlight(doc.data,doc.id);if(flight)flights.set(flight.id,flight);}
 return [...flights.values()].sort((a,b)=>a.finishedAt-b.finishedAt||a.id.localeCompare(b.id));
}
function migrationBase(old,flights,selectedAircraft=0){
 const state=initial(),warnings=[];
 const oldBalance=old?.coins??old?.coinBalance??0;integer(oldBalance,'legacy Coin balance');
 state.coins=oldBalance;state.coinsEarned=old?.coinsEarned??oldBalance;state.coinsSpent=old?.coinsSpent??0;
 for(const key of ['coinsEarned','coinsSpent'])integer(state[key],key);
 const owned=old?.purchasedAircraft||old?.ownedAircraft||[];
 if(!Array.isArray(owned))throw Error('Legacy purchases require review; saved data was not reset.');
 for(const value of owned){const index=typeof value==='string'?AIRCRAFT_KEYS.indexOf(value):value;if(Number.isInteger(index)&&index>=0&&index<AIRCRAFT_KEYS.length)state.ownedAircraft.push(index);}
 state.ownedAircraft=[...new Set(state.ownedAircraft)];state.selectedAircraft=state.ownedAircraft.includes(selectedAircraft)?selectedAircraft:0;
 for(const f of flights)state.personalBest=betterBest(state.personalBest,{score:f.score,aircraftIndex:f.aircraftIndex,flightId:f.id,finishedAt:f.finishedAt});
 // Never erase a legacy best just because its matching aircraft/history is unavailable.
 const oldBest=Math.max(Number(old?.highestScore)||0,Number(old?.bestRankedScore)||0,Number(old?.personalBest?.score)||0);
 if(oldBest>=MIN_SCORE&&oldBest<=MAX_SCORE&&Number.isInteger(oldBest)&&oldBest>(state.personalBest?.score||0)){
  const index=old?.personalBest?.aircraftIndex;state.personalBest={score:oldBest,aircraftIndex:Number.isInteger(index)&&index>=0&&index<AIRCRAFT_KEYS.length?index:null,flightId:old?.personalBest?.flightId||null,finishedAt:null,legacyUnpaired:true};
  warnings.push('A historical best has no matching flight record; its score is retained and its aircraft may be unknown.');
 }
 if(oldBalance>0)warnings.push('Existing Coins retained. Historical Coin overlap requires review before retroactive rewards.');
 state.migration={version:SCHEMA,retroCoins:oldBalance===0,verifiedFlights:flights.length,warnings};
 return normalize(state);
}
return {SCHEMA,PRICE,MIN_SCORE,MAX_SCORE,AIRCRAFT_KEYS,RANKS,norm,rank,reward,initial,normalize,validFlight,betterBest,applyFlight,purchase,purchaseSkin,equipSkin,skinCompatible,skinOwnershipId,normalizeSkinOwnership,ownsSkin,legacyFlight,mergeLegacy,migrationBase,grantRankSkins,sortedSkins};
});
