import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require=createRequire(process.env.LEXICALSPACE_TEST_MODULES||import.meta.url),{JSDOM}=require('jsdom');
const code=await fs.readFile(new URL('../suite/js/core.js',import.meta.url),'utf8');
async function fixture({tab='Alice',saved='Bob',url='https://example.test/Lexical_Space/apps/arcade/?user=Old'}={}){
 const dom=new JSDOM('<html data-suite-module="arcade"><head><script src="https://example.test/Lexical_Space/suite/js/core.js"></script></head><body><a id="legacy" href="https://vuongtranvt1331-design.github.io/Grammar_Space/" target="_blank">Grammar</a><a id="canonical" href="https://example.test/Lexical_Space/apps/poker/">Poker</a></body></html>',{url,runScripts:'outside-only'});
 if(tab!==null)dom.window.sessionStorage.setItem('ls_active_profile',tab);if(saved!==null)dom.window.localStorage.setItem('vocab_user',saved);
 Object.defineProperty(dom.window.document,'currentScript',{value:dom.window.document.querySelector('script')});dom.window.eval(code);dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));await new Promise(resolve=>setTimeout(resolve,0));return dom;
}
test('all six modules stay in the same installed app, preserving topic/user and bounded return URL',async()=>{
 const d=await fixture(),a=d.window.SpaceSuite;
 for(const name of Object.keys(a.paths)){const u=new URL(a.href(name,{mode:'topic',topic:'People & Places'}));assert.equal(u.origin,'https://example.test');assert.ok(u.pathname.startsWith('/Lexical_Space/'));assert.equal(u.searchParams.get('user'),'Alice');assert.equal(u.searchParams.get('topic'),'People & Places');if(['poker','quick-drawn','sky-dominators','grammar','vocabulary-test'].includes(name)){const back=new URL(u.searchParams.get('returnUrl'));assert.equal(back.pathname,'/Lexical_Space/apps/arcade/');assert.equal(back.searchParams.get('mode'),'topic');assert.equal(back.searchParams.get('topic'),'People & Places');assert.equal(back.searchParams.has('returnUrl'),false)}}
 assert.equal(d.window.document.getElementById('canonical').pathname,'/Lexical_Space/apps/poker/');assert.equal(d.window.document.getElementById('legacy').pathname,'/Lexical_Space/apps/grammar/');assert.equal(d.window.document.getElementById('legacy').target,'_self');assert.equal(new URL(d.window.location.href).searchParams.get('user'),'Alice');d.window.close();
});
test('signed-out tab wins over a stale saved/query username; suite never writes a vocabulary schema',async()=>{
 const d=await fixture({tab:''});assert.equal(d.window.SpaceSuite.profile(),'');assert.equal(new URL(d.window.SpaceSuite.href('poker')).searchParams.has('user'),false);assert.equal(new URL(d.window.location.href).searchParams.has('user'),false);assert.equal(d.window.localStorage.getItem('vocab_user'),'Bob');assert.equal(d.window.sessionStorage.getItem('ls_active_profile'),'');assert.doesNotMatch(code,/indexedDB|localStorage\.setItem|sessionStorage\.setItem/);d.window.close();
});
test('return navigation rejects other origins, sibling repos, arbitrary files and nested return chains',async()=>{
 const d=await fixture(),a=d.window.SpaceSuite;
 for(const value of ['https://evil.test/','javascript:alert(1)','https://example.test/OtherApp/','https://example.test/Lexical_Space/apps/poker/js/poker-1.js'])assert.equal(a.safeReturn(value),a.href('arcade'));
 const u=new URL(a.safeReturn('https://example.test/Lexical_Space/apps/arcade/?user=Other&returnUrl=https%3A%2F%2Fevil.test%2F'));assert.equal(u.searchParams.get('user'),'Alice');assert.equal(u.searchParams.has('returnUrl'),false);d.window.close();
});

test('game return links retain the selected topic without nested URLs or stale profile names',async()=>{
 const d=await fixture({url:'https://example.test/Lexical_Space/apps/quick-drawn/?returnUrl='+encodeURIComponent('https://example.test/Lexical_Space/apps/arcade/?user=Old&mode=topic&topic=People%20%26%20Places')});
 const link=d.window.document.createElement('a');link.href='../arcade/';link.setAttribute('data-suite-return','');d.window.document.body.append(link);await new Promise(resolve=>setTimeout(resolve,0));
 const target=new URL(link.href);assert.equal(target.pathname,'/Lexical_Space/apps/arcade/');assert.equal(target.searchParams.get('user'),'Alice');assert.equal(target.searchParams.get('mode'),'topic');assert.equal(target.searchParams.get('topic'),'People & Places');assert.equal(target.searchParams.has('returnUrl'),false);d.window.close();
});

test('Sky pilot progress uses the shared tab profile, retaining standalone guest nickname behavior',async()=>{
 const script=await fs.readFile(new URL('../apps/sky-dominators/js/systems/progress/client.js',import.meta.url),'utf8'),d=await fixture();
 d.window.SkyProgressCore={};d.window.localStorage.setItem('air_strike_player_nickname','Guest Pilot');d.window.eval(script);
 assert.equal(d.window.SkyProfile.name,'Alice');assert.equal(await d.window.SkyProfile.setName('Different student'),false);
 d.window.sessionStorage.setItem('ls_active_profile','');assert.equal(d.window.SkyProfile.name,'Guest Pilot');assert.equal(d.window.localStorage.getItem('vocab_user'),'Bob');d.window.close();
});
test('the same loader finishes for Grammar/Arcade readiness without audio or forced duration',async()=>{
 const loader=await fs.readFile(new URL('../js/features/loading.js',import.meta.url),'utf8');assert.doesNotMatch(loader,/new Audio|AudioContext|\.play\(/);
 for(const name of ['GrammarSpace','ArcadeSpace']){const d=new JSDOM('<html data-suite-module="grammar"><body><section id="space-loader" data-loader-name="'+name+'"><span data-loader-text></span></section><main><button>App</button></main></body></html>',{runScripts:'outside-only'});d.window.eval(loader);d.window.SpaceLoader.mount();assert.equal(d.window.document.querySelector('[data-loader-text]').textContent,name[0]);d.window.document.dispatchEvent(new d.window.CustomEvent('spacesuite:ready'));assert.ok(d.window.document.getElementById('space-loader').classList.contains('is-ready'));assert.equal(Boolean(d.window.document.querySelector('main').inert),false);d.window.close()}
});
test('all child entrypoints use the central manifest and no child worker is registered',async()=>{
 const root=new URL('../',import.meta.url);
 for(const app of ['grammar','arcade','quick-drawn','sky-dominators','poker']){const text=await fs.readFile(new URL('apps/'+app+'/index.html',root),'utf8');assert.match(text,/href="\.\.\/\.\.\/manifest.webmanifest"/);assert.match(text,/\.\.\/\.\.\/suite\/js\/core.js/);assert.doesNotMatch(text,/serviceWorker\.register\(/);if(['grammar','arcade'].includes(app)){assert.doesNotMatch(text,/data-loader-audio|assets\/space-loader\.js/);assert.match(text,/\.\.\/\.\.\/js\/features\/loading.js/)}}
});
test('Arcade carousel places playable entries first with matching indices and links',async()=>{
 const html=await fs.readFile(new URL('../apps/arcade/index.html',import.meta.url),'utf8');
 const dom=new JSDOM(html),tiles=[...dom.window.document.querySelectorAll('[data-game-tile]')];
 assert.deepEqual(tiles.map(t=>t.dataset.gameName),['Sky Dominators','Grammar Space','Word Battles','Wild West Poker','Test','Dictation Practice','Barn Adventure','Space Dominators']);
 assert.deepEqual(tiles.map(t=>Number(t.dataset.gameIndex)),[0,1,2,3,4,5,6,7]);
 assert.deepEqual(tiles.slice(0,6).map(t=>t.querySelector('[data-game-launch]')?.getAttribute('href')),['../sky-dominators/','../grammar/','../quick-drawn/','../poker/','../vocabulary-test/','../quick-ears/']);
 assert.ok(tiles[6].querySelector('button:disabled') && !tiles[6].querySelector('[data-game-launch]'));
 assert.ok(tiles[7].matches('[data-space-chase]') && tiles[7].querySelector('button:enabled') && !tiles[7].querySelector('[data-game-launch]'));
 dom.window.close();
});
test('offline fetches return the correct child HTML, never the lexical page for another module',async()=>{
 const sw=await fs.readFile(new URL('../service-worker.js',import.meta.url),'utf8'),handlers={},base='https://example.test/Lexical_Space/',entries=new Map([[base+'apps/poker/index.html',{body:'Poker'}],[base+'offline.html',{body:'offline'}]]);
 vm.runInNewContext(sw,{URL,Response,fetch:async()=>{throw Error('offline')},self:{registration:{scope:base},addEventListener:(n,fn)=>handlers[n]=fn},caches:{open:async()=>({match:async key=>entries.get(key)})}});
 let response;handlers.fetch({request:{url:base+'apps/poker/?user=Alice',method:'GET',mode:'navigate'},respondWith:p=>response=p});assert.equal((await response).body,'Poker');handlers.fetch({request:{url:base+'apps/missing/',method:'GET',mode:'navigate'},respondWith:p=>response=p});assert.equal((await response).body,'offline');
 let intercepted=false;handlers.fetch({request:{url:'https://firestore.googleapis.com/v1/test',method:'GET'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});

test('offline CDN allowlist normalizes root URLs and caches only the approved static library families',async()=>{
 const sw=await fs.readFile(new URL('../service-worker.js',import.meta.url),'utf8'),handlers={};
 vm.runInNewContext(sw,{URL,Response,fetch:async()=>({ok:true,clone(){return this}}),self:{registration:{scope:'https://example.test/Lexical_Space/'},addEventListener:(n,fn)=>handlers[n]=fn},caches:{open:async()=>({put:async()=>{}})}});
 for(const url of ['https://cdn.tailwindcss.com/','https://unpkg.com/@phosphor-icons/web','https://unpkg.com/@phosphor-icons/web@2.1.2/src/regular/style.css']){
  let result;handlers.fetch({request:{url,method:'GET'},respondWith:p=>result=p});assert.ok(result,url);await result;
 }
 for(const url of ['https://cdn.tailwindcss.com.evil.test/','https://unpkg.com/unrelated-library/','https://firestore.googleapis.com/v1/test']){
  let intercepted=false;handlers.fetch({request:{url,method:'GET'},respondWith:()=>intercepted=true});assert.equal(intercepted,false,url);
 }
});
