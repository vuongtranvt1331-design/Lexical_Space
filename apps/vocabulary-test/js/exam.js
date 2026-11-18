(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { data:null, index:0, answers:[], flags:[], deadline:0, duration:0, timer:null, submitted:false };
  const setButtons = [...document.querySelectorAll('[data-question-set]')];
  let builtInSets = [], loadRevision = 0, activeSet = -1;
  function markSet(index) {
    activeSet = index;
    setButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    if (state.data) updateExamCode();
  }
  function updateExamCode() {
    const q = state.data.questions[state.index];
    const level = typeof q.cefr === 'string' ? q.cefr : (typeof q.level === 'string' ? q.level : 'B2/C1');
    $('examCodeDisplay').textContent = activeSet >= 0 ? `Bộ ${activeSet + 1} · ${level}` : (typeof state.data.testCode === 'string' && state.data.testCode.trim() ? state.data.testCode : 'Custom · ' + level);
  }
  function validate(data) {
    if (!data || !Array.isArray(data.questions) || !data.questions.length) throw Error('Provide a non-empty questions array.');
    if (data.durationMinutes !== undefined && (!Number.isFinite(data.durationMinutes) || data.durationMinutes <= 0 || data.durationMinutes > 180)) throw Error('durationMinutes must be between 0 and 180.');
    data.questions.forEach((q, i) => {
      if (!q || typeof q.question !== 'string' || !q.question.trim() || !Array.isArray(q.options) || q.options.length !== 4) throw Error(`Question ${i + 1} needs a question and four options.`);
      const keys = q.options.map(o => o && o.key);
      if (!['A','B','C','D'].every(k => keys.filter(x => x === k).length === 1) || q.options.some(o => typeof o.text !== 'string' || !o.text.trim()) || !keys.includes(q.correctAnswer)) throw Error(`Question ${i + 1} needs unique A–D options and a matching correctAnswer.`);
    });
    return data;
  }
  function init(data) {
    validate(data); clearInterval(state.timer);
    Object.assign(state,{data,index:0,answers:Array(data.questions.length).fill(null),flags:Array(data.questions.length).fill(false),submitted:false});
    state.duration = Math.round((data.durationMinutes || 15) * 60); state.deadline = Date.now() + state.duration * 1000;
    render(); tick(); state.timer = setInterval(tick, 1000);
  }
  function remaining() { return Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000)); }
  function format(seconds) { return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`; }
  function tick() { const left = remaining(); $('timerDigits').textContent = format(left); $('timerBox').classList.toggle('warning', left <= 120); if (!left) { clearInterval(state.timer); if ($('submitModal').open) $('submitModal').close(); submit(); } }
  function render() {
    const q = state.data.questions[state.index], total = state.data.questions.length;
    $('qNumberTag').textContent = `Câu ${state.index+1}/${total}`;
    $('qLevelTag').textContent = typeof q.cefr === 'string' ? q.cefr : (typeof q.level === 'string' ? q.level : 'B2/C1');
    $('qTopicTag').textContent = typeof q.topic === 'string' ? q.topic : 'Vocabulary'; $('qPromptText').textContent = q.question; updateExamCode();
    $('qContextBox').hidden = !q.context; $('qContextBox').textContent = q.context || '';
    $('btnFlagQuestion').setAttribute('aria-pressed', String(state.flags[state.index])); $('flagBtnText').textContent = state.flags[state.index] ? 'Flagged for review' : 'Flag for review';
    const options = $('optionsGrid'); options.replaceChildren();
    ['A','B','C','D'].forEach(key => { const opt=q.options.find(o=>o.key===key), button=document.createElement('button'), label=document.createElement('span'), text=document.createElement('span'); button.type='button'; button.className='option'; button.setAttribute('aria-pressed',String(state.answers[state.index]===key)); label.className='option-key'; label.textContent=key; text.textContent=opt.text; button.append(label,text); button.addEventListener('click',()=>select(key)); options.append(button); });
    $('btnPrevQ').disabled=state.index===0; $('btnNextQ').disabled=state.index===total-1;
    const grid=$('paletteGrid'); grid.replaceChildren();
    state.data.questions.forEach((_,i)=>{const b=document.createElement('button');b.type='button';b.textContent=i+1;b.classList.toggle('current',i===state.index);b.classList.toggle('answered',!!state.answers[i]);b.classList.toggle('flagged',state.flags[i]);b.setAttribute('aria-label',`Question ${i+1}${state.answers[i]?', answered':', unanswered'}${state.flags[i]?', flagged':''}${i===state.index?', current':''}`);if(i===state.index)b.setAttribute('aria-current','step');b.addEventListener('click',()=>go(i));grid.append(b);});
    $('answeredRatioText').textContent=`${state.answers.filter(Boolean).length}/${total}`;
  }
  function go(index) { if(index>=0 && index<state.data.questions.length){state.index=index;render();} }
  function select(key) { if(state.submitted || !state.data)return;state.answers[state.index]=key;render(); }
  $('btnPrevQ').addEventListener('click',()=>go(state.index-1)); $('btnNextQ').addEventListener('click',()=>go(state.index+1));
  $('btnFlagQuestion').addEventListener('click',()=>{state.flags[state.index]=!state.flags[state.index];render();});
  $('btnOpenSubmitModal').addEventListener('click',()=>{if(!state.data)return;const left=state.answers.filter(a=>!a).length; $('submitWarningMsg').textContent=left?`You have ${left} unanswered question${left===1?'':'s'}. Unanswered questions count as incorrect.`:'You have answered every question. Ready to see your results?';$('submitModal').showModal();});
  $('btnCancelSubmit').addEventListener('click',()=>$('submitModal').close()); $('btnConfirmFinalSubmit').addEventListener('click',()=>{$('submitModal').close();submit();});
  function line(parent,label,value,cls) {const p=document.createElement('p');if(cls)p.className=cls;const strong=document.createElement('strong');strong.textContent=label;p.append(strong,document.createTextNode(value));parent.append(p);}
  function submit() {
    if(state.submitted || !state.data)return;state.submitted=true;clearInterval(state.timer);
    let correct=0;const list=$('reviewListContainer');list.replaceChildren();
    state.data.questions.forEach((q,i)=>{const choice=state.answers[i], right=choice===q.correctAnswer;if(right)correct++;const card=document.createElement('article');card.className='review-item';const title=document.createElement('h4');title.textContent=`${i+1}. ${q.question}`;card.append(title);line(card,'Result: ',right?'Correct':choice?'Incorrect':'Unanswered','outcome');line(card,'Your answer: ',choice?`${choice}. ${q.options.find(o=>o.key===choice).text}`:'Unanswered');const answer=q.options.find(o=>o.key===q.correctAnswer);line(card,'Correct answer: ',`${answer.key}. ${answer.text}`);line(card,'Explanation: ',typeof q.explanation==='string' && q.explanation.trim()?q.explanation:'No explanation provided.','explanation');list.append(card);});
    const total=state.data.questions.length, percent=Math.round(correct/total*100);$('resScoreVal').textContent=`${correct}/${total}`;$('resPercentVal').textContent=`${percent}%`;$('resTimeVal').textContent=format(Math.max(0,state.duration-remaining()));$('resUnansweredVal').textContent=state.answers.filter(a=>!a).length;$('resultFeedbackText').textContent=`${correct} correct out of ${total} questions.`;$('resultModal').showModal();
  }
  $('btnRestartExam').addEventListener('click',()=>{$('resultModal').close();init(state.data);});
  setButtons.forEach((button, index) => button.addEventListener('click', () => {
    if (!builtInSets[index]) return;
    loadRevision++; init(builtInSets[index]); markSet(index); $('status').textContent = '';
  }));
  $('jsonFileInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;const revision=++loadRevision;try {const data=validate(JSON.parse(await file.text()));if(revision!==loadRevision)return;init(data);markSet(-1);$('status').textContent=`Loaded ${file.name}: ${data.questions.length} questions.`;}catch(err){if(revision===loadRevision)$('status').textContent=`Could not load test: ${err.message}`;}finally{e.target.value='';}});
  window.addEventListener('keydown',e=>{if(!state.data || state.submitted || $('submitModal').open || $('resultModal').open || e.ctrlKey || e.altKey || e.metaKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable)return;const key=e.key.toUpperCase();if(['A','B','C','D'].includes(key))select(key);else if(['1','2','3','4'].includes(key))select('ABCD'[Number(key)-1]);else if(e.key==='ArrowLeft')go(state.index-1);else if(e.key==='ArrowRight')go(state.index+1);else return;e.preventDefault();});
  fetch('./assets/vocabulary_test_bank.json').then(r=>{if(!r.ok)throw Error('Could not load the question bank.');return r.json();}).then(bank=>{
    if (!Array.isArray(bank.sets) || bank.sets.length !== setButtons.length) throw Error('The question bank must contain five sets.');
    builtInSets = bank.sets.map(validate); setButtons.forEach(button => button.disabled = false);
    if (!state.data) { init(builtInSets[0]); markSet(0); }
  }).catch(err=>{if(!state.data)$('qPromptText').textContent='Unable to load the test.';$('status').textContent=err.message;});
})();
