const $ = selector => document.querySelector(selector);
const topic = $('#topic'), lesson = $('#lesson'), player = $('audio'), input = $('#answer'), result = $('#result');
const panel = $('#panel');
const names = {'ielts-listening':'IELTS Listening','english-conversations':'English Conversations','short-stories':'Short Stories','toefl-listening':'TOEFL Listening',numbers:'Numbers','spelling-names':'Spelling Names'};
const localPreview = ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
let packedLessons = new Set();
let catalog = [], parts = [], records = [], index = 0, ticket = 0, scene = 'menu';
const historyStore = window.QuickEarsHistory;
const emptyCarry = () => ({first:0,replayed:0,skipped:0});
let carry = emptyCarry(), signature = '', pendingSave, latest = new Map();
function lessonSignature(rows) {
  let hash = 2166136261;
  for (const row of rows) for (const ch of row.answer+'\n'+row.audio+'\n') hash=Math.imul(hash^ch.codePointAt(0),16777619);
  return hash>>>0;
}
function saveProgress(final = false) {
  clearTimeout(pendingSave);
  if (!parts.length || !['exercise','summary'].includes(scene)) return;
  const checkpoint = final ? null : {signature, stage:scene, index, carry,
    draft:scene==='exercise' ? input.value : '',
    records:records.slice(0,index+1).map(r=>[r.attempts,
      Number(r.correct)+2*Number(r.first)+4*Number(r.skipped)+8*Number(r.heard)+16*Number(r.repeated)+32*Number(r.ended)])};
  if (!historyStore.tracker.save(records,checkpoint,carry)) $('#status').textContent='Could not save progress. Check storage or reopen the latest saved run.';
}
function flushProgress() {
  if(scene==='exercise' || (scene==='summary' && index<parts.length)) saveProgress();
}
window.addEventListener('pagehide',flushProgress);
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushProgress();});
function refreshResume() {
  latest=historyStore.latestRuns();
  const run=[...latest.values()].find(r=>historyStore.resumable(r)&&catalog.some(x=>x.slug===r.slug));
  const button=$('#continue-lesson');button.hidden=!run;
  if(run){
    button.textContent='Continue · '+run.title;
    button.onclick=()=>{selectLesson(catalog.find(x=>x.slug===run.slug));show('picker');loadLesson();};
  }
}
function selectLesson(item) {
  topic.value=item.topic;populate();
  if(item.topic==='ielts-listening'){
    const [book,test]=groupOf(item);$('#book').value=book;populate(1);$('#test').value=test;populate(2);
  }
  lesson.value=item.slug;updateStartLabel();
}
function updateStartLabel(){
  $('#start').textContent=historyStore.resumable(latest.get(lesson.value))?'Open lesson':latest.has(lesson.value)?'View lesson':'Start lesson';
}
lesson.onchange=updateStartLabel;
function restoreProgress(run) {
  if(!historyStore.resumable(run)||run.total!==parts.length)return false;
  const c=run.checkpoint;
  if(!c){
    carry={first:run.first,replayed:run.replayed,skipped:run.skipped};
    index=carry.first+carry.replayed+carry.skipped;
    historyStore.tracker.restore(run);historyStore.tracker.currentRun.grading='mixed';
    show('exercise');showPart();saveProgress();return true;
  }
  if(c.signature!==signature || !Number.isInteger(c.index)||c.index<0||c.index>=parts.length||
    !['exercise','summary'].includes(c.stage)||typeof c.draft!=='string'||!c.carry||
    !['first','replayed','skipped'].every(k=>Number.isSafeInteger(c.carry[k])&&c.carry[k]>=0)||
    !Array.isArray(c.records)||c.records.length!==c.index+1||
    !c.records.every(r=>Array.isArray(r)&&Number.isSafeInteger(r[0])&&r[0]>=0&&Number.isInteger(r[1])&&r[1]>=0&&r[1]<64))return false;
  historyStore.tracker.restore(run);index=c.index;carry=c.carry;
  c.records.forEach(([attempts,flags],i)=>{
    const r=records[i];r.attempts=attempts;
    ['correct','first','skipped','heard','repeated','ended'].forEach((name,bit)=>{r[name]=Boolean(flags&(1<<bit));});
  });
  if(c.stage==='summary'){renderSummary(false);return true;}
  show('exercise');showPart();input.value=c.draft;
  if(records[index].correct){input.readOnly=true;result.textContent='Correct!';$('#next').hidden=false;translatePart();}
  return true;
}

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
  flushProgress(); ticket++; player.pause(); player.removeAttribute('src'); player.load();
  if (panel.open) panel.close(); show('menu'); $('#status').textContent = ''; $('#retry').hidden = true;
  $('#start').disabled = !lesson.value; refreshResume();
}
$('#back-menu').onclick = $('#close-picker').onclick = menu;
if ($('#history-back')) $('#history-back').onclick = menu;
if ($('#menu-history')) $('#menu-history').onclick = () => {
  show('history');
  window.QuickEarsHistory?.renderHistoryView(undefined,openHistoryLesson);
};
if ($('#history-profile')) $('#history-profile').onchange = (e) => {
  window.QuickEarsHistory?.renderHistoryView(e.target.value,openHistoryLesson);
};
$('#open-picker').onclick = $('#done').onclick = () => { const slug = lesson.value;
refreshResume(); populate(2);
if (slug) lesson.value = slug;
show('picker'); updateStartLabel();
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
  lesson.disabled = $('#start').disabled = !rows.length; updateStartLabel();
}
topic.onchange=()=>populate(); $('#book').onchange=()=>populate(1); $('#test').onchange=()=>populate(2);
function openHistoryLesson(slug) {
  const item = catalog.find(row=>row.slug===slug);
  if (!item) { $('#status').textContent='This lesson is unavailable.'; return; }
  selectLesson(item);
  openSelectedLesson();
}

function openSelectedLesson() {
  const run = historyStore.latestRuns().get(lesson.value);
  if (!run) { loadLesson(); return; }
  const dialog = $('#lesson-actions'), primary = $('#lesson-primary');
  const answered = run.first + run.replayed + run.skipped;
  const resume = historyStore.resumable(run);
  $('#lesson-action-title').textContent = run.title;
  $('#lesson-action-progress').textContent = answered + ' / ' + run.total + ' sentences completed';
  const scores = $('#previous-scores'); scores.hidden = true;
  primary.textContent = resume ? 'Continue from sentence '+Math.min(run.total,(run.checkpoint?.index ?? answered)+1) : 'View results';
  primary.onclick = () => {
    if (resume) { dialog.close(); show('picker'); loadLesson(); }
    else {
      const label = run.grading === 'three-tries' ? 'Correct within 3 tries' : run.grading === 'mixed' ? 'Counted correct' : 'First try';
      scores.textContent = label + ': ' + run.first + ' · Needed practice: ' + run.replayed + ' · Skipped: ' + run.skipped;
      scores.hidden = false;
    }
  };
  $('#lesson-restart').onclick = () => {
    if (!confirmRestart()) return;
    dialog.close(); show('picker'); loadLesson(true);
  };
  dialog.showModal();
}
function confirmRestart() {
  return window.confirm('Start again from sentence 1? The new attempt will replace the progress shown for this lesson.');
}
async function loadLesson(startOver = false) {
  const id=++ticket, slug=lesson.value;
  $('#retry').hidden=true; $('#start').disabled=true;
  $('#status').textContent='Loading lesson…';
  try {
    const name = encodeURIComponent(slug);
    const packed = packedLessons.has(slug);
    let res = await fetch(packed ? './lesson-packs/' + name + '.json' : './api/lesson/' + name);
    if (!res.ok && localPreview && (packed || res.status === 502) && id === ticket) {
      res = await fetch('./api/lesson/' + name, {cache:'no-store'});
    }
    if(!res.ok) throw Error();
    const rows=await res.json();
    if(!Array.isArray(rows)||!rows.length) throw Error();
    if(id!==ticket || slug!==lesson.value) return;
    parts=rows; index=0; signature=lessonSignature(rows); carry=emptyCarry();
    records=parts.map(()=>newRecord());
    const rawTitle = lesson.selectedOptions[0]?.text || '';
    const cleanTitle = window.QuickEarsHistory?.cleanLessonTitle(rawTitle) || rawTitle;
    $('#title').textContent = cleanTitle;
    $('#source').href='https://dailydictation.com/exercises/'+topic.value+'/'+slug+'/listen-and-type';
    const saved = historyStore.latestRuns().get(slug);
    if (startOver || !restoreProgress(saved)) {
      if (!startOver && historyStore.resumable(saved) &&
          !window.confirm('This lesson has changed and the saved position cannot be restored. Start again from sentence 1?')) {
        $('#status').textContent='Saved progress kept.';
        return;
      }
      historyStore.tracker.startNewRun(topic.value, slug, cleanTitle, parts.length);
      show('exercise'); showPart(); saveProgress();
    }
  } catch {
    if(id!==ticket || slug!==lesson.value) return;
    $('#status').textContent='Couldn’t load the lesson. Check your connection or choose another lesson.';
    if(localPreview && location.port==='8000') {
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
  saveProgress();
};
player.onended=()=>{if(scene==='exercise' && records[index]) {records[index].ended=true;saveProgress();}};
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
function stats(rows, previous = emptyCarry()) {
  const green = previous.first + rows.filter(r => r.correct && r.first).length;
  const yellow = previous.replayed + rows.filter(r => r.correct && !r.first).length;
  const red = previous.skipped + rows.filter(r => r.skipped).length;
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
  if (!final && index % blockSize !== 0) { showPart(); saveProgress(); return; }
  renderSummary(final); saveProgress(final);
}
function renderSummary(final) {
  show('summary');
  $('#status').textContent='';
  const blockStart = Math.floor((index-1)/blockSize)*blockSize;
  const cumulative = blockStart < carry.first + carry.replayed + carry.skipped;
  const block = cumulative ? stats(records.slice(0,index),carry) : stats(records.slice(blockStart,index));
  const range = 'Sentences '+(cumulative ? 1 : blockStart+1)+'–'+index;
  const summary = final ? stats(records,carry) : block;
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
$('#continue').onclick = () => {show('exercise');showPart();saveProgress();};
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
    } else result.append(wrong === -1 || i < wrong ? word : '***');
  });
}
function feedback() {
  const target = words(parts[index].answer), typed = words(input.value);
  const wrong = target.findIndex((word,i) => norm(word) !== norm(typed[i] || ''));
  const correct = wrong === -1 && typed.length === target.length;
  const record=records[index];
  if(typed.length) {
    if(correct) record.first=record.attempts < 3;
    record.attempts++; if(correct)record.correct=true;
  }
  if(typed.length || correct) saveProgress();
  if(correct && record.correct){input.readOnly=true;result.textContent='Correct!';translatePart();$('#next').hidden=false;return;}
  if (fullAnswer) result.textContent = parts[index].answer;
  else showHint(target, wrong);
  if (wrong === -1 && typed.length > target.length) result.append(' · Extra word: '+typed[target.length]);
}
$('form').onsubmit=e=>{e.preventDefault(); if(!$('#next').hidden)advance();else feedback();};
input.oninput = () => { result.replaceChildren(); clearTimeout(pendingSave); pendingSave=setTimeout(flushProgress,200); };
$('#next').onclick=advance;
$('#skip').onclick=()=>{if(!records[index].correct)records[index].skipped=true;advance();};
$('#retry').onclick=$('#start').onclick=openSelectedLesson;
$('#restart').onclick=()=>{
  if (!confirmRestart()) return;
  carry=emptyCarry();
  show('exercise');
  records=parts.map(()=>newRecord());
  index=0;
  const rawTitle = lesson.selectedOptions[0]?.text || '';
  const cleanTitle = window.QuickEarsHistory?.cleanLessonTitle(rawTitle) || rawTitle;
  window.QuickEarsHistory?.tracker.startNewRun(topic.value, lesson.value, cleanTitle, parts.length);
  showPart(); saveProgress();
};
player.onerror=()=>{if(scene==='exercise'&&player.getAttribute('src'))$('#status').textContent='Audio unavailable. Skip this sentence or open the original lesson.';};
async function init(){
  try{
    const res = await fetch('./lessons.json');
    if (!res.ok) throw Error();
    catalog = await res.json();
    try {
      const available = await fetch('./lesson-packs/available.json');
      if (!available.ok) throw Error();
      packedLessons = new Set(await available.json());
    } catch (error) {
      if (!localPreview) throw error;
    }
    if (!localPreview) catalog = catalog.filter(item => packedLessons.has(item.slug));
    if (!catalog.length) throw Error();
    options(topic,Object.entries(names).filter(([key]) => catalog.some(item => item.topic === key)));
    topic.disabled=false;
    const requested=catalog.find(x=>x.slug===new URLSearchParams(location.search).get('lesson'));
    refreshResume();
    if(requested)selectLesson(requested); else populate();
  }catch{$('#status').textContent='Couldn’t load the lesson list.';}
}
init();
