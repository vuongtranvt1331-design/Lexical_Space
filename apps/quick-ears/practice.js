const $ = selector => document.querySelector(selector);
const topic = $('#topic'), lesson = $('#lesson'), player = $('audio'), input = $('#answer'), result = $('#result');
const panel = $('#panel');
const names = {'ielts-listening':'IELTS Listening','english-conversations':'English Conversations','short-stories':'Short Stories','toefl-listening':'TOEFL Listening',numbers:'Numbers','spelling-names':'Spelling Names'};
let catalog = [], parts = [], records = [], index = 0, ticket = 0, scene = 'menu';
let volume = 50;
let fullAnswer = false;
try {
  const saved = JSON.parse(localStorage.getItem('quick_ears_settings'));
  if (Number.isFinite(saved?.volume)) volume = Math.max(0, Math.min(100, saved.volume));
  fullAnswer = saved?.fullAnswer === true;
} catch {}
function applySettings() {
  $('#full-answer').checked = fullAnswer;
  $('#volume').value = volume;
  player.volume = $('#volume').valueAsNumber / 100;
  $('#level').textContent = $('#volume').value + '%';

}
$('#preferences').oninput = () => {
  volume = $('#volume').valueAsNumber;
  fullAnswer = $('#full-answer').checked;
  applySettings();
  try { localStorage.setItem('quick_ears_settings', JSON.stringify({volume, fullAnswer})); } catch {}
};
applySettings();
function show(sceneName) {
  scene = sceneName;
  for (const id of ['menu','picker','exercise','summary','history']) ($('#'+id) && ($('#'+id).hidden = scene !== id));
  $('#pause').hidden = scene !== 'exercise'; $('main').dataset.scene = scene;
}
function openPanel() {
  player.pause();
  if (!panel.open) panel.showModal();
}
$('#menu-settings').onclick = $('#pause').onclick = openPanel;
$('#resume').onclick = () => panel.close();
function menu() {
  ticket++; player.pause(); player.removeAttribute('src'); player.load();
  if (panel.open) panel.close(); show('menu'); $('#status').textContent = ''; $('#retry').hidden = true;
  $('#start').disabled = !lesson.value;
}
$('#back-menu').onclick = $('#close-picker').onclick = menu;
if ($('#history-back')) $('#history-back').onclick = menu;
if ($('#menu-history')) $('#menu-history').onclick = () => {
  show('history');
  window.QuickEarsHistory?.renderHistoryView();
};
if ($('#history-profile')) $('#history-profile').onchange = (e) => {
  window.QuickEarsHistory?.renderHistoryView(e.target.value);
};
$('#open-picker').onclick = $('#done').onclick = () => { const slug = lesson.value;
populate(2);
if (slug) lesson.value = slug;
show('picker');
topic.focus(); };
function groupOf(item) {
  const cam = item.title.match(/^(Cam\d+)\s*-\s*(Test\s*\d+)/i);
  if (cam) return [cam[1].replace('Cam','Cambridge '),cam[2]];
  return ['Other IELTS lessons',item.title.split(/\s*-\s*Part\b/i)[0]];
}
function options(select,items) {select.replaceChildren(...items.map(([value,text])=>new Option(text,value)));}
function populate(stage=0) {
  let rows = catalog.filter(row=>row.topic===topic.value);
  const grouped = topic.value==='ielts-listening';
  $('#groups').hidden = !grouped;
  if (grouped) {
    if (stage===0) options($('#book'),[...new Set(rows.map(x=>groupOf(x)[0]))].map(x=>[x,x]));
    rows=rows.filter(x=>groupOf(x)[0]===$('#book').value);
    if (stage<2) options($('#test'),[...new Set(rows.map(x=>groupOf(x)[1]))].map(x=>[x,x]));
    rows=rows.filter(x=>groupOf(x)[1]===$('#test').value);
  }
  const statusMap = window.QuickEarsHistory?.getProfileLessonStatusMap() || new Map();
  options(lesson,rows.map(x=>{
    const rawTitle = [x.level,x.title,x.detail].filter(Boolean).join(' · ');
    const prefix = window.QuickEarsHistory?.formatStatusPrefix(statusMap.get(x.slug)) || '';
    return [x.slug, prefix + rawTitle];
  }));
  lesson.disabled = $('#start').disabled = !rows.length;
}
topic.onchange=()=>populate(); $('#book').onchange=()=>populate(1); $('#test').onchange=()=>populate(2);
async function loadLesson() {
  const id=++ticket, slug=lesson.value;
  $('#retry').hidden=true; $('#start').disabled=true;
  $('#status').textContent='Loading lesson…';
  try {
    let res=await fetch('./api/lesson/'+encodeURIComponent(slug),{cache:'no-store'});
    if(res.status===502 && id===ticket) res=await fetch('./api/lesson/'+encodeURIComponent(slug),{cache:'no-store'});
    if(!res.ok) throw Error();
    const rows=await res.json();
    if(!Array.isArray(rows)||!rows.length) throw Error();
    if(id!==ticket || slug!==lesson.value) return;
    parts=rows; index=0;
    records=parts.map(()=>newRecord());
    const rawTitle = lesson.selectedOptions[0]?.text || '';
    const cleanTitle = window.QuickEarsHistory?.cleanLessonTitle(rawTitle) || rawTitle;
    $('#title').textContent = cleanTitle;
    window.QuickEarsHistory?.tracker.startNewRun(topic.value, slug, cleanTitle, parts.length);
    $('#source').href='https://dailydictation.com/exercises/'+topic.value+'/'+slug+'/listen-and-type';
    show('exercise'); showPart();
  } catch {
    if(id!==ticket || slug!==lesson.value) return;
    $('#status').textContent='Couldn’t load the lesson. Check your connection or choose another lesson.';
    if(location.port==='8000') {
      const link=document.createElement('a'), url=new URL(location.href);
      url.port='8011';url.searchParams.set('lesson',slug);
      link.href=url.href;link.textContent='Open in the local app';$('#status').append(' ',link);
    }
    $('#retry').hidden=false;
  } finally { if(id===ticket) $('#start').disabled=false; }
}
function newRecord() {
  return {attempts:0,first:false,correct:false,heard:false,repeated:false,ended:false,skipped:false};
}
const translations=new Map();
async function translatePart() {
  const row=parts[index], label=$('#translation');
  const record=records[index];
  if(scene!=='exercise'||!record?.correct)return;
  label.lang='en';label.hidden=false;label.textContent='Translating…';
  let pending=translations.get(row.answer);
  if(!pending){
    const params=new URLSearchParams({q:row.answer,langpair:'en|vi'});
    pending=fetch('https://api.mymemory.translated.net/get?'+params,{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)})
      .then(async res=>{
        if(!res.ok)throw Error();
        const data=await res.json();
        if(Number(data.responseStatus)!==200 || !data.responseData?.translatedText)throw Error();
        return data.responseData.translatedText;
      });
    translations.set(row.answer,pending);
  }
  try {
    const vi=await pending;
    if(scene==='exercise' && record===records[index]){label.lang='vi';label.textContent=vi;}
  }catch{
    translations.delete(row.answer);
    if(scene==='exercise' && record===records[index])label.textContent='Translation temporarily unavailable.';
  }
}
player.onplaying=()=>{
  const r=records[index];if(scene!=='exercise'||!r)return;
  if(r.ended && !r.correct)r.repeated=true;
  r.ended=false;r.heard=true;
  window.QuickEarsHistory?.tracker.onInteraction(records);
};
player.onended=()=>{if(records[index]) records[index].ended=true;};
player.ontimeupdate=()=>{const r=records[index];if(r && !player.seeking)r.lastTime=player.currentTime;};
player.onseeking=()=>{
  const r=records[index];
  if(r?.heard&&!r.correct && player.currentTime+0.15<(r.lastTime||0))r.repeated=true;
};
$('#replay').onclick=()=>{
  const r=records[index];
  if(r.heard&&!r.correct)r.repeated=true;
  player.currentTime=0;player.play().catch(()=>{$('#status').textContent='Audio couldn’t play. Press Replay to try again.';});
};
// Trigger on release so Ctrl+C, Ctrl+V and other shortcuts keep their usual behavior.
let ctrlAlone = false;
window.addEventListener('keydown', event => {
  if (event.repeat) return;
  ctrlAlone = event.key === 'Control' && !event.altKey && !event.shiftKey &&
    !event.metaKey && scene === 'exercise' && !panel.open;
});
window.addEventListener('keyup', event => {
  if (event.key !== 'Control') return;
  if (ctrlAlone && scene === 'exercise' && !panel.open) $('#replay').click();
  ctrlAlone = false;
});
window.addEventListener('blur', () => { ctrlAlone = false; });
function showPart() {
  $('#status').textContent='';player.src=parts[index].audio;
  $('#translation').hidden=true;$('#translation').textContent='';
  input.readOnly=false;input.value='';result.replaceChildren();$('#next').hidden=true;
  $('#position').textContent='Sentence '+(index+1)+' / '+parts.length;
  $('#next').textContent=index+1===parts.length?'View results':'Next sentence';
}
const blockSize = 20;
function stats(rows) {
  const green = rows.filter(r => r.correct && r.first).length;
  const yellow = rows.filter(r => r.correct && !r.first).length;
  const red = rows.filter(r => r.skipped).length;
  const counts = [green, yellow, red];
  const labels = ['🟢 Correct on first try', '🟡 Replayed or corrected', '🔴 Skipped'];
  const percentages = counts.map(count => 100 * count / rows.length);
  const text = labels.map((label,i) => label+': '+counts[i]+'/'+rows.length+' ('+Math.round(percentages[i])+'%)').join(' · ');
  return {percentages, text};
}
function advance() {
  if (scene !== 'exercise') return;
  player.pause();
  index++;
  const final = index === parts.length;
  if (!final && index % blockSize !== 0) { showPart(); return; }
  show('summary');
  $('#status').textContent='';
  const blockStart = Math.floor((index-1)/blockSize)*blockSize;
  const block = stats(records.slice(blockStart,index));
  const range = 'Sentences '+(blockStart+1)+'–'+index;
  const summary = final ? stats(records) : block;
  $('#summary-title').textContent = final ? 'Lesson results' : range;
  summary.percentages.forEach((value,i) => $('#bar').children[i].style.width=value+'%');
  $('#bar').setAttribute('aria-label',summary.text);
  $('#scores').textContent = summary.text;
  $('#last-block').hidden = !final || blockStart === 0;
  $('#last-block').textContent = range+' · '+block.text;
  $('#continue').hidden = final;
  $('#continue').textContent = 'Continue from sentence '+(index+1);
  $('#restart').hidden = $('#done').hidden = !final;
  (final ? $('#restart') : $('#continue')).focus();
}
$('#continue').onclick = () => {show('exercise');showPart();};
function norm(w){return w.toLowerCase().normalize('NFKC').replace(/[’‘]/g,"'").replace(/[^\p{L}\p{N}']/gu,'');}
function words(s){return s.trim().split(/\s+/).filter(w=>norm(w));}
function showHint(target, wrong) {
  result.replaceChildren();
  target.forEach((word, i) => {
    if (i) result.append(' ');
    if (i === wrong) {
      const hint = document.createElement('strong');
      hint.textContent = word;
      result.append(hint);
    } else result.append('***');
  });
}
function feedback() {
  const target = words(parts[index].answer), typed = words(input.value);
  const wrong = target.findIndex((word,i) => norm(word) !== norm(typed[i] || ''));
  const correct = wrong === -1 && typed.length === target.length;
  const record=records[index];
  if(typed.length) {
    if(record.attempts===0) record.first=correct && !record.repeated;
    record.attempts++; if(correct)record.correct=true;
  }
  if(typed.length || correct) window.QuickEarsHistory?.tracker.onInteraction(records);
  if(correct && record.correct){input.readOnly=true;result.textContent='Correct!';translatePart();$('#next').hidden=false;return;}
  if (fullAnswer) result.textContent = parts[index].answer;
  else showHint(target, wrong);
  if (wrong === -1 && typed.length > target.length) result.append(' · Extra word: '+typed[target.length]);
}
$('form').onsubmit=e=>{e.preventDefault(); if(!$('#next').hidden)advance();else feedback();};
input.oninput = () => result.replaceChildren();
$('#next').onclick=advance;
$('#skip').onclick=()=>{if(!records[index].correct)records[index].skipped=true;window.QuickEarsHistory?.tracker.onInteraction(records, true);advance();};
$('#retry').onclick=$('#start').onclick=loadLesson;
$('#restart').onclick=()=>{
  show('exercise');
  records=parts.map(()=>newRecord());
  index=0;
  const rawTitle = lesson.selectedOptions[0]?.text || '';
  const cleanTitle = window.QuickEarsHistory?.cleanLessonTitle(rawTitle) || rawTitle;
  window.QuickEarsHistory?.tracker.startNewRun(topic.value, lesson.value, cleanTitle, parts.length);
  showPart();
};
player.onerror=()=>{if(scene==='exercise'&&player.getAttribute('src'))$('#status').textContent='Audio unavailable. Skip this sentence or open the original lesson.';};
async function init(){
  if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname)){$('#status').textContent='Listening practice is only available on localhost.';return;}
  try{
    const res=await fetch('./lessons.json');if(!res.ok)throw Error();catalog=await res.json();
    options(topic,Object.entries(names));topic.disabled=false;
    const requested=catalog.find(x=>x.slug===new URLSearchParams(location.search).get('lesson'));
    if(requested)topic.value=requested.topic;
    populate();
    if(requested){
      if(requested.topic==='ielts-listening'){const [book,test]=groupOf(requested);$('#book').value=book;populate(1);$('#test').value=test;populate(2);}
      lesson.value=requested.slug;
    }
  }catch{$('#status').textContent='Couldn’t load the lesson list.';}
}
init();
