/* Test page only: ephemeral profile, no Firebase, localStorage or IndexedDB writes. */
(function(){
 'use strict';
 const C=SkyProgressCore,listeners=new Set(),results=new Map();
 let state=C.normalize({...C.initial(),qualifyingFlights:11,migrationComplete:true,
  ownedAircraft:allAircraft(),ownedSkins:allSkins(),selectedSkins:{fighter_1:'celestial'}});
 // This script loads before the aircraft entity configuration; use the progression roster.
 function allAircraft(){return C.AIRCRAFT_KEYS.map((_,i)=>i);}
 function allSkins(){return ['factory_default',...C.AIRCRAFT_KEYS.flatMap((_,i)=>C.sortedSkins(i).filter(s=>s.id!=='factory_default').map(s=>C.skinOwnershipId(i,s.id)))];}
 const emit=()=>{for(const fn of listeners)fn();window.dispatchEvent(new CustomEvent('sky-profile'));};
 window.SkyProfile={
  get name(){return 'LOCAL BOSS TEST';},get state(){return state;},get status(){return 'TEST ONLY · No cloud saves';},get confirmed(){return true;},get selected(){return state.selectedAircraft;},
  connect(){emit();return Promise.resolve();},init(){emit();return Promise.resolve();},ready:Promise.resolve(),syncIdentity(){},setName:async()=>false,
  on(fn){listeners.add(fn);return()=>listeners.delete(fn);},owns:i=>state.ownedAircraft.includes(i),ownsSkin:(i,id)=>C.ownsSkin(state,i,id),
  skin:i=>state.selectedSkins[C.AIRCRAFT_KEYS[i]]||'factory_default',rank:()=>C.rank(state.qualifyingFlights),
  async select(i){if(!state.ownedAircraft.includes(i))throw Error('Unknown aircraft');state={...state,selectedAircraft:i};emit();},
  async equipSkin(i,id){state=C.equipSkin(state,i,id,Date.now());emit();},
  async buy(){return {duplicate:true,charged:0};},async buySkin(){return {duplicate:true,charged:0};},
  complete(_owner,f){results.set(f.id,{...f,coinsAwarded:0,rankBefore:11,rankAfter:11,skinsAwarded:[],test:true});emit();return Promise.resolve();},
  flush:async()=>{},pending:()=>[],promotions:()=>[],acknowledge:async()=>{},result:id=>results.get(id),leaderboard:async()=>[],history:async()=>[]
 };
})();
