import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require = createRequire(process.env.LEXICALSPACE_TEST_MODULES || import.meta.url);
const {JSDOM} = require('jsdom');
const file = name => readFileSync(new URL('../apps/quick-ears/' + name, import.meta.url), 'utf8');
const item = {topic:'english-conversations',slug:'fixture',title:'Fixture'};
const rows = Array.from({length:21}, (_,i)=>({answer:'word '+i,audio:'https://example.org/'+i+'.mp3'}));

async function open(storage = {}, profile = 'A') {
  const dom = new JSDOM(file('index.html'), {url:'https://suite.example/apps/quick-ears/',runScripts:'outside-only'});
  const w = dom.window;
  Object.entries(storage).forEach(([k,v])=>w.localStorage.setItem(k,v));
  w.sessionStorage.setItem('ls_active_profile',profile);
  w.HTMLMediaElement.prototype.pause = () => {};
  w.fetch = async url => ({ok:true,json:async()=>url==='./lessons.json' ? [item] :
    url.endsWith('available.json') ? [item.slug] : url.includes('translated.net') ? {responseStatus:500} : rows});
  w.eval(file('history.js'));w.eval(file('practice.js'));
  await new Promise(r=>setTimeout(r,0));
  return {dom,w,el:id=>w.document.getElementById(id)};
}
test('draft, attempts, block recap and final result survive navigation under the right profile',async()=>{
  let app=await open();
  const click=id=>app.el(id).click();
  const submit=value=>{app.el('answer').value=value;app.w.document.querySelector('form').onsubmit({preventDefault(){}})};
  const reopen=async(profile='A')=>{
    app.w.dispatchEvent(new app.w.Event('pagehide'));
    const data={...app.w.localStorage};app.dom.window.close();app=await open(data,profile);
  };
  const enter=async id=>{click(id);await new Promise(r=>setTimeout(r,0));};
  try {
    click('open-picker');assert.deepEqual([...app.w.document.querySelector('.picker-actions').children].map(b=>b.id),['close-picker','continue-lesson','start']);assert.equal(app.el('continue-lesson').disabled,true);await enter('start');submit('wrong');submit('wrong');
    app.el('answer').value='draft';await reopen('B');assert.equal(app.el('continue-lesson').disabled,true);
    await reopen();click('open-picker');await enter('continue-lesson');assert.equal(app.el('answer').value,'draft');
    submit('word 0');click('next');submit('wrong');submit('wrong');submit('wrong');
    await reopen();click('open-picker');await enter('continue-lesson');submit('word 1');click('next');
    for(let i=2;i<20;i++)click('skip');
    assert.equal(app.el('summary-title').textContent,'Sentences 1–20');await reopen();click('open-picker');await enter('continue-lesson');
    assert.equal(app.el('summary').hidden,false);click('continue');assert.equal(app.el('position').textContent,'Sentence 21 / 21');
    click('skip');assert.equal(app.el('summary-title').textContent,'Lesson results');
    const runs=Object.keys(app.w.localStorage).filter(k=>k.startsWith('qe_run_'));
    assert.equal(runs.length,1);
    const run=JSON.parse(app.w.localStorage.getItem(runs[0]));
    assert.deepEqual([run.first,run.replayed,run.skipped,run.completed,run.checkpoint],[1,1,19,true,null]);
    await reopen();assert.equal(app.el('continue-lesson').disabled,true);
  }finally{app.dom.window.close();}
});

test('one row per lesson shows latest attempt; restart requires consent and cancellation preserves draft',async()=>{
  const old={profile:'A',slug:item.slug,topic:item.topic,title:'Fixture',start:'2025-01-01',total:21,first:21,replayed:0,skipped:0,completed:true};
  const partial={...old,start:'2025-02-01',first:5,completed:false};
  const app=await open({qe_run_1:JSON.stringify(old),qe_run_2:JSON.stringify(partial),qe_run_3:JSON.stringify({...old,profile:'B'})});
  const {w,el}=app;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
  w.HTMLDialogElement.prototype.close=function(){this.open=false};
  const settle=()=>new Promise(r=>setTimeout(r,0));
  try {
    el('menu-history').click();
    assert.equal(w.document.querySelectorAll('.history-item').length,1);
    assert.match(el('history-list').textContent,/5\/21/);
    w.document.querySelector('.history-item button').click();assert.equal(el('continue-lesson').disabled,false);assert.equal(el('picker').hidden,false);
    w.confirm=()=>false;el('start').click();assert.equal(el('picker').hidden,false);
    assert.equal(w.localStorage.length,3);el('continue-lesson').click();await settle();
    assert.equal(el('position').textContent,'Sentence 6 / 21');
    w.HTMLMediaElement.prototype.load=()=>{};el('back-menu').click();el('open-picker').click();el('start').click();
    w.confirm=()=>true;el('start').click();await settle();
    assert.equal(el('position').textContent,'Sentence 1 / 21');
    el('back-menu').click();el('menu-history').click();
    assert.equal(w.document.querySelectorAll('.history-item').length,1);
    assert.match(el('history-list').textContent,/0\/21/);
    el('history-profile').value='B';el('history-profile').dispatchEvent(new w.Event('change'));
    assert.match(el('history-list').textContent,/21\/21/);assert.equal(w.document.querySelector('.history-item button'),null);
  }finally{app.dom.window.close();}
});
