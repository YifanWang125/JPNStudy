/* ============================================================================
 *  N4 → N2  —  app logic
 *  Dependency-free. Furigana via <ruby>, audio via Web Speech API.
 * ==========================================================================*/

/* ---------- state ---------- */
const STATE = {
  page: "daily",             // daily | general | test
  day: 1,
  session: "morning",        // morning | noon | night
  furi: true,                // furigana visible
  showZh: false,             // translations under paragraph (morning hides by default)
  writeMode: "type",         // type | hide
  rate: 0.8,
};
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const SESSIONS = {
  morning:{ emoji:"🌅", name:"朝の朗読", sub:"Morning · 读 & 跟读", hint:"专注「读」。先听标准发音，再跟读。默认隐藏译文——这一节只练读音和节奏，听不懂没关系。" },
  noon:   { emoji:"☀️", name:"昼の理解", sub:"Noon · 懂 & 学语法", hint:"现在弄懂意思。对照译文，记单词，吃透今天的语法点，看它们怎么用在日常对话里。" },
  night:  { emoji:"🌙", name:"夜の反思", sub:"Night · 写 & 反思", hint:"抄写与默写。先用「输入核对」练打字与假名，再用「遮挡默写」凭记忆复述，最后回答反思问题。" },
};

/* ---------- localStorage progress ---------- */
const PKEY = "jpn-n2-progress";
function loadProg(){ try{ return JSON.parse(localStorage.getItem(PKEY))||{}; }catch(e){ return {}; } }
function saveProg(p){ localStorage.setItem(PKEY, JSON.stringify(p)); }
let PROG = loadProg();      // { "3":{morning:true,noon:false,night:true}, ... }
function dayDone(day){ const d=PROG[day]; return d && d.morning && d.noon && d.night; }
function markSession(day,session,val){
  PROG[day]=PROG[day]||{}; PROG[day][session]=val; saveProg(PROG);
  if(val) recordActivity();
}
function todayISO(){ const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function recordActivity(){ try{ const k="jpn-active-dates"; const s=JSON.parse(localStorage.getItem(k))||[]; const t=todayISO(); if(!s.includes(t)){ s.push(t); localStorage.setItem(k,JSON.stringify(s)); } }catch(e){} }
function computeStreak(){
  let dates=[]; try{ dates=JSON.parse(localStorage.getItem("jpn-active-dates"))||[]; }catch(e){}
  const set=new Set(dates);
  const iso=x=>x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0");
  let cur=new Date(), streak=0;
  if(!set.has(iso(cur))) cur.setDate(cur.getDate()-1);   // allow streak to count up to yesterday
  while(set.has(iso(cur))){ streak++; cur.setDate(cur.getDate()-1); }
  return streak;
}

/* ---------- furigana parser ----------
 * 漢字[かな]  →  <ruby>漢字<rt>かな</rt></ruby>
 * also escapes the rest as text.                                         */
const KANJI = "\\u4e00-\\u9fff\\u3005\\u3006\\u3007\\u30f6";
const RUBY_RE = new RegExp("([" + KANJI + "]+)\\[([^\\]]+)\\]","g");
function esc(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function toRuby(text){
  let out="", last=0, m;
  RUBY_RE.lastIndex=0;
  while((m=RUBY_RE.exec(text))!==null){
    out += esc(text.slice(last, m.index));
    out += "<ruby>"+esc(m[1])+"<rt>"+esc(m[2])+"</rt></ruby>";
    last = m.index + m[0].length;
  }
  out += esc(text.slice(last));
  return out;
}
/* strip furigana brackets → plain Japanese for TTS */
function toPlain(text){ return text.replace(/\[[^\]]+\]/g,""); }

/* ---------- speech / audio ----------
 * Prefers pre-generated VOICEVOX audio files (audio/manifest.json keyed e.g.
 * "d15_s3") for real-voice playback; falls back to Web Speech TTS when a clip
 * is missing or fails. STATE.rate drives both <audio>.playbackRate and TTS rate.
 */
let JA_VOICE=null;
function pickVoice(){
  const vs = speechSynthesis.getVoices();
  JA_VOICE = vs.find(v=>/ja[-_]JP/i.test(v.lang)) || vs.find(v=>/^ja/i.test(v.lang)) || null;
}
if("speechSynthesis" in window){
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}
let AUDIO_MANIFEST = {};          // { "d1_s0": "audio/d1_s0.mp3", ... }
let CURRENT_AUDIO = null;
let SPEAK_TOKEN = 0;              // cancels sequential playback

/* normalize text for TTS / file lookup: drop furigana, 「〜」placeholder, edge punct */
function speechNorm(text){ return toPlain(text).replace(/[〜～]/g,"").replace(/^[、。・「」『』\s]+|[、。・「」『』\s]+$/g,"").trim(); }

function ttsOne(text, node){
  return new Promise(res=>{
    if(!("speechSynthesis" in window) || !speechNorm(text)){ res(); return; }
    const u = new SpeechSynthesisUtterance(speechNorm(text));
    u.lang="ja-JP"; if(JA_VOICE) u.voice=JA_VOICE; u.rate=STATE.rate; u.pitch=1;
    u.onstart=()=>{ if(node) node.classList.add("speaking"); };
    u.onend  =()=>{ if(node) node.classList.remove("speaking"); res(); };
    u.onerror=()=>{ if(node) node.classList.remove("speaking"); res(); };
    speechSynthesis.speak(u);
  });
}
function playOne(item){           // {text, node, audioKey}
  const key=item.audioKey, src=key && AUDIO_MANIFEST[key];
  if(!src) return ttsOne(item.text, item.node);
  return new Promise(res=>{
    const a=new Audio(src); CURRENT_AUDIO=a; a.playbackRate=STATE.rate;
    if(item.node) item.node.classList.add("speaking");
    const clear=()=>{ if(item.node) item.node.classList.remove("speaking"); if(CURRENT_AUDIO===a) CURRENT_AUDIO=null; };
    a.onended=()=>{ clear(); res(); };
    a.onerror=()=>{ clear(); ttsOne(item.text, item.node).then(res); };
    a.play().catch(()=>{ clear(); ttsOne(item.text, item.node).then(res); });
  });
}
/* one-off speak (vocab readings, single examples) */
function speak(text){ stopSpeak(); return ttsOne(text, null); }

function stopSpeak(){
  SPEAK_TOKEN++;
  if("speechSynthesis" in window) speechSynthesis.cancel();
  if(CURRENT_AUDIO){ try{ CURRENT_AUDIO.pause(); }catch(e){} CURRENT_AUDIO=null; }
  clearHighlight();
}
/* play sentences in sequence, highlighting nodes; audio or TTS per item */
async function speakSequence(items){
  stopSpeak();
  const token = ++SPEAK_TOKEN;
  for(const it of items){
    if(token!==SPEAK_TOKEN) break;
    await playOne(it);
  }
  if(token===SPEAK_TOKEN) clearHighlight();
}
function clearHighlight(){ document.querySelectorAll(".sent.speaking").forEach(n=>n.classList.remove("speaking")); }
function audioKeyFor(day, idx){ return "d"+day+"_s"+idx; }

/* ---------- helpers ---------- */
function lessonByDay(d){ return LESSONS.find(l=>l.day===d); }
const $ = sel => document.querySelector(sel);

/* ============================================================================
 *  RENDER
 * ==========================================================================*/
function render(){
  stopSpeak();
  localStorage.setItem("jpn-last-day", STATE.day);
  const L = lessonByDay(STATE.day);
  renderHeader(L);
  if(L.planned){ renderPlanned(L); return; }
  renderDayHead(L);
  renderTabs(L);
  if(STATE.session==="morning") renderMorning(L);
  else if(STATE.session==="noon") renderNoon(L);
  else renderNight(L);
  updateProgressBar();
}

function renderHeader(L){
  $("#day-num").textContent = "Day " + L.day;
  const pick=$("#day-pick");
  if(pick.options.length!==LESSONS.length){
    pick.innerHTML = LESSONS.map(l=>`<option value="${l.day}">Day ${l.day} · ${l.level}</option>`).join("");
  }
  pick.value=STATE.day;
  $("#furi-toggle").classList.toggle("on", STATE.furi);
}

function renderDayHead(L){
  $("#planned").style.display="none";
  $("#lesson").style.display="block";
  $("#day-head").innerHTML = `
    <span class="week-chip">${WEEK_LABELS[L.week]||""}</span>
    <h1>${esc(L.theme)}<span class="level-badge">${L.level}</span></h1>
    <div class="theme-zh">${esc(L.themeZh)}</div>
    <div class="source">📖 来源 / Source：${esc(L.source)}</div>
    <div class="goals">${(L.goals||[]).map(g=>`<span>🎯 ${esc(g)}</span>`).join("")}</div>
  `;
}

function renderTabs(L){
  const wrap=$("#tabs");
  wrap.innerHTML = Object.entries(SESSIONS).map(([key,s])=>{
    const done = PROG[L.day] && PROG[L.day][key];
    return `<button data-s="${key}" class="${STATE.session===key?'active':''}">
      <span class="t-emoji">${s.emoji}</span>${done?'<span class="done-dot">✓</span>':''}
      <span class="t-name">${s.name}</span>
      <span class="t-sub">${s.sub}</span>
    </button>`;
  }).join("");
  wrap.querySelectorAll("button").forEach(b=>b.onclick=()=>{ STATE.session=b.dataset.s; if(b.dataset.s==="morning") STATE.showZh=false; render(); });
}

/* ----------------------------- MORNING ----------------------------- */
function renderMorning(L){
  const body = $("#panel-body");
  body.innerHTML = `
    <div class="session-hint">${SESSIONS.morning.hint}</div>
    <div class="audio-bar">
      <button id="play-all">▶ 全文を聴く</button>
      <button id="stop-all" class="ghost">■ 停止</button>
      <div class="speed">速さ <input type="range" id="rate" min="0.5" max="1.1" step="0.05" value="${STATE.rate}"><b id="rate-v">${STATE.rate.toFixed(2)}</b></div>
    </div>
    <div class="mini-toggles">
      <button id="m-zh" class="${STATE.showZh?'on':''}">中文译文</button>
      <button id="m-furi" class="${STATE.furi?'on':''}">ふりがな</button>
    </div>
    <div class="para ${STATE.furi?'':'hide-furi'} ${STATE.showZh?'':'hide-zh'}" id="para"></div>
    <p class="typing-tip">💡 点击任意一句可单独播放并跟读。早上目标：跟着读 3 遍，先不求懂意思。</p>
  `;
  const para=$("#para");
  L.paragraph.forEach((s,idx)=>{
    const el=document.createElement("span");
    el.className="sent";
    el.innerHTML = toRuby(s.jp) + `<span class="zh">${esc(s.zh)}</span>`;
    el.onclick=()=>speakSequence([{text:s.jp,node:el,audioKey:audioKeyFor(L.day,idx)}]);
    para.appendChild(el);
  });
  $("#play-all").onclick=()=>{
    const items=[...para.querySelectorAll(".sent")].map((node,i)=>({text:L.paragraph[i].jp,node,audioKey:audioKeyFor(L.day,i)}));
    speakSequence(items);
  };
  $("#stop-all").onclick=stopSpeak;
  $("#rate").oninput=e=>{ STATE.rate=parseFloat(e.target.value); $("#rate-v").textContent=STATE.rate.toFixed(2); };
  $("#m-zh").onclick=()=>{ STATE.showZh=!STATE.showZh; para.classList.toggle("hide-zh",!STATE.showZh); $("#m-zh").classList.toggle("on",STATE.showZh); };
  $("#m-furi").onclick=()=>{ STATE.furi=!STATE.furi; para.classList.toggle("hide-furi",!STATE.furi); $("#m-furi").classList.toggle("on",STATE.furi); $("#furi-toggle").classList.toggle("on",STATE.furi); };
  appendPron(L, body);
  addCompleteButton(L,"morning",body);
}

/* ----------------------------- PRONUNCIATION (speech recognition) ----------------------------- */
const IS_FILE = (typeof location!=="undefined" && location.protocol==="file:");

/* ----- Azure pronunciation assessment (optional cloud engine) ----- */
function getAzureCfg(){ try{ return JSON.parse(localStorage.getItem("jpn-azure-cfg"))||null; }catch(e){ return null; } }
function azureEnabled(){ const c=getAzureCfg(); return !!(c && c.key && c.region); }
let _azureSDK=null;
function loadAzureSDK(){
  if(typeof window!=="undefined" && window.SpeechSDK) return Promise.resolve(window.SpeechSDK);
  if(_azureSDK) return _azureSDK;
  _azureSDK=new Promise((res,rej)=>{
    const s=document.createElement("script");
    // 离线优先：把 SDK vendored 到 js/vendor/ 再改本地路径；下面 CDN 需联网。
    s.src="https://aka.ms/csspeech/jsbrowserpackageraw";
    s.onload=()=>res(window.SpeechSDK); s.onerror=()=>rej(new Error("SDK load failed"));
    document.head.appendChild(s);
  });
  return _azureSDK;
}

let PRON = { idx:0, recog:null, recording:false };
function appendPron(L, body){
  PRON = { idx:0, recog:null, recording:false };
  const box=document.createElement("div");
  box.className="pron-box"; box.id="pron-box";
  body.appendChild(box);
  renderPron(L);
}
function pronEngineBadge(){
  if(azureEnabled()) return `<span class="pron-engine azure">引擎：Azure 发音评估（逐音素＋语调）</span>`;
  if(SpeechRec)      return `<span class="pron-engine">引擎：浏览器识别（近似）· <a id="pron-upgrade">接入 Azure 获取逐音素评分 ⚙</a></span>`;
  return "";
}
function renderPron(L){
  const box=$("#pron-box"); if(!box) return;
  const total=L.paragraph.length, s=L.paragraph[PRON.idx];
  const listenItem=[{text:s.jp,node:null,audioKey:audioKeyFor(L.day,PRON.idx)}];
  const targetHtml=`<div class="pron-target">${toRuby(s.jp)}</div>`;
  const navHtml=`<button class="nav" id="pron-prev">◀</button><span class="pron-sub">${PRON.idx+1} / ${total}</span><button class="nav" id="pron-next">▶</button>`;
  let html=`<h3>🎤 発音チェック · 跟读评估</h3>
    <div class="pron-sub">跟读一句，AI 对比你读出的内容，指出哪里清晰、哪里可能不准。逐句练习。${pronEngineBadge()}</div>`;
  if(IS_FILE){
    html+=`<div class="pron-unsupported">🔌 你正用 <b>file://</b> 打开本页，浏览器会禁止麦克风。请改用本地服务器：终端运行 <code>python3 -m http.server 4173</code>，再打开 <b>http://127.0.0.1:4173</b> —— 即可启用录音评估。现在仍可点「🔊 听示范」跟读。</div>
      ${targetHtml}<div class="pron-ctrl"><button class="listen" id="pron-listen">🔊 听示范</button>${navHtml}</div>`;
    box.innerHTML=html; bindPronNav(L,listenItem,total); return;
  }
  if(!SpeechRec && !azureEnabled()){
    html+=`<div class="pron-unsupported">⚠️ 当前浏览器不支持语音识别。建议用 <b>Chrome</b> 打开，或在 ⚙ 设置里接入 Azure 发音评估。你仍可点「🔊 听示范」跟读。</div>
      ${targetHtml}<div class="pron-ctrl"><button class="listen" id="pron-listen">🔊 听示范</button>${navHtml}</div>`;
    box.innerHTML=html; bindPronNav(L,listenItem,total); return;
  }
  html+=`${targetHtml}
    <div class="pron-ctrl">
      <button class="rec ${PRON.recording?'recording':''}" id="pron-rec">${PRON.recording?'■ 停止':'🎤 録音して読む'}</button>
      <button class="listen" id="pron-listen">🔊 听示范</button>${navHtml}
    </div>
    <div class="pron-result" id="pron-result"></div>`;
  box.innerHTML=html;
  $("#pron-rec").onclick=()=>startPronCheck(L);
  bindPronNav(L,listenItem,total);
}
function bindPronNav(L,listenItem,total){
  if($("#pron-listen")) $("#pron-listen").onclick=()=>speakSequence(listenItem);
  if($("#pron-prev"))   $("#pron-prev").onclick=()=>{ if(PRON.recording)stopRecog(); if(PRON.idx>0){PRON.idx--;renderPron(L);} };
  if($("#pron-next"))   $("#pron-next").onclick=()=>{ if(PRON.recording)stopRecog(); if(PRON.idx<total-1){PRON.idx++;renderPron(L);} };
  if($("#pron-upgrade"))$("#pron-upgrade").onclick=openSettings;
}
function startPronCheck(L){
  if(PRON.recording){ stopRecog(); return; }
  if(azureEnabled()) evalPronAzure(L);
  else toggleRecog(L);
}
function updatePronBtn(){ const b=$("#pron-rec"); if(!b) return; b.textContent=PRON.recording?'■ 停止':'🎤 録音して読む'; b.classList.toggle('recording',PRON.recording); }
function stopRecog(){ if(PRON.recog){ try{PRON.recog.stop();}catch(e){} } PRON.recording=false; updatePronBtn(); }
function toggleRecog(L){
  if(PRON.recording){ stopRecog(); return; }
  stopSpeak();
  const r=new SpeechRec();
  r.lang="ja-JP"; r.interimResults=false; r.maxAlternatives=1;
  PRON.recog=r; PRON.recording=true; updatePronBtn();
  const res=$("#pron-result"); if(res) res.innerHTML=`<div class="pron-sub">🔴 録音中… ゆっくり、はっきり読んでください。</div>`;
  r.onresult=(e)=>{ evalPron(L, e.results[0][0].transcript); };
  r.onerror=(e)=>{ const res=$("#pron-result"); if(res) res.innerHTML=`<div class="pron-sub">识别出错（${esc(e.error)}）。请确认已允许麦克风权限，并在安静环境重试。</div>`; };
  r.onend=()=>{ PRON.recording=false; updatePronBtn(); };
  try{ r.start(); }catch(e){ PRON.recording=false; updatePronBtn(); }
}
function evalPron(L, heard){
  const res=$("#pron-result"); if(!res) return;
  const norm=s=>(s||"").replace(/[\s。、，．！？!?「」『』・]/g,"");
  const target=norm(toPlain(L.paragraph[PRON.idx].jp));
  const h=norm(heard);
  const {html,correct}=diffStrings(target,h);
  const pct = target.length? Math.round(correct/target.length*100):0;
  let cls,verdict;
  if(pct>=85){ cls="great"; verdict=`✅ とても良い！発音がクリアです（一致度 ${pct}%）`; }
  else if(pct>=60){ cls="ok"; verdict=`🟡 おおむね良好（一致度 ${pct}%）。下線の音をもう一度。`; }
  else { cls="again"; verdict=`🔴 もう一度ゆっくり（一致度 ${pct}%）。下線部分が聞き取れませんでした。`; }
  res.innerHTML=`
    <div class="pron-verdict ${cls}">${verdict}</div>
    <div class="pron-sub">識別された音声：</div>
    <div class="pron-heard">${esc(heard)||'<span class="miss">（無音 / 未識別）</span>'}</div>
    <div class="pron-sub">原文との照合（<span class="miss">下線</span>＝うまく識別されなかった＝発音が不明瞭な可能性）：</div>
    <div class="pron-heard">${html}</div>
    <div class="pron-tips">💡 これは音声認識による近似評価です。下線部は「読み方が違う」か「発音が不明瞭」のサイン——🔊で示範を聞き、その音だけ繰り返してみましょう。${PRON.idx<L.paragraph.length-1?'うまくいったら「▶」で次の文へ。':'これで最後の文です。お疲れさま！'}</div>`;
}

/* ----- Azure path: phoneme + prosody scoring ----- */
async function evalPronAzure(L){
  const res=$("#pron-result"), cfg=getAzureCfg();
  if(res) res.innerHTML=`<div class="pron-sub">⏳ Azure エンジン準備中…（初回は SDK 読み込みに数秒）</div>`;
  let SDK;
  try{ SDK=await loadAzureSDK(); }
  catch(e){ if(res) res.innerHTML=`<div class="pron-sub">⚠️ Azure SDK を読み込めません（ネット接続を確認）。ブラウザ識別にフォールバックします。</div>`; toggleRecog(L); return; }
  try{
    const ref=speechNorm(L.paragraph[PRON.idx].jp);
    const speechConfig=SDK.SpeechConfig.fromSubscription(cfg.key, cfg.region);
    speechConfig.speechRecognitionLanguage="ja-JP";
    const audioConfig=SDK.AudioConfig.fromDefaultMicrophoneInput();
    const pa=new SDK.PronunciationAssessmentConfig(ref,
      SDK.PronunciationAssessmentGradingSystem.HundredMark,
      SDK.PronunciationAssessmentGranularity.Phoneme, true);
    try{ pa.enableProsodyAssessment=true; }catch(e){}
    const recognizer=new SDK.SpeechRecognizer(speechConfig, audioConfig);
    pa.applyTo(recognizer);
    PRON.recording=true; updatePronBtn();
    if(res) res.innerHTML=`<div class="pron-sub">🔴 録音中… はっきり読んでください。</div>`;
    recognizer.recognizeOnceAsync(result=>{
      PRON.recording=false; updatePronBtn();
      try{ renderAzureResult(L, SDK.PronunciationAssessmentResult.fromResult(result), result.text); }
      catch(e){ if(res) res.innerHTML=`<div class="pron-sub">評価を取得できませんでした。もう一度どうぞ。</div>`; }
      recognizer.close();
    }, err=>{ PRON.recording=false; updatePronBtn(); if(res) res.innerHTML=`<div class="pron-sub">Azure エラー：${esc(String(err))}。キー / リージョンを確認してください。</div>`; recognizer.close(); });
  }catch(e){ PRON.recording=false; updatePronBtn(); if(res) res.innerHTML=`<div class="pron-sub">初期化エラー。ブラウザ識別にフォールバックします。</div>`; toggleRecog(L); }
}
function renderAzureResult(L, pa, heardText){
  const res=$("#pron-result"); if(!res) return;
  const acc=Math.round(pa.accuracyScore||0), flu=Math.round(pa.fluencyScore||0),
        comp=Math.round(pa.completenessScore||0), pro=Math.round(pa.prosodyScore||0),
        overall=Math.round(pa.pronunciationScore||0);
  let wordsHtml="";
  try{
    const words=(pa.detailResult&&pa.detailResult.Words)||pa.words||[];
    words.forEach(w=>{
      const ws=(w.PronunciationAssessment&&w.PronunciationAssessment.AccuracyScore);
      const sc=(ws!==undefined?ws:(w.accuracyScore!==undefined?w.accuracyScore:100));
      const cls=sc>=80?"ok":(sc>=50?"":"miss");
      wordsHtml+=`<span class="${cls}">${esc(w.Word||w.word||"")}</span>`;
    });
  }catch(e){}
  if(!wordsHtml) wordsHtml=esc(heardText||"");
  const cls=overall>=80?"great":(overall>=60?"ok":"again");
  const prosodyTip = (pro && pro<60) ? `<div class="pron-tips">🎵 抑揚（语调）${pro} 点偏低：注意整句的高低起伏，模仿示范的语调，别每个字都读平。</div>` : "";
  res.innerHTML=`
    <div class="pron-verdict ${cls}">総合 ${overall} 点</div>
    <div class="az-scores"><span>正確さ <b>${acc}</b></span><span>流暢さ <b>${flu}</b></span><span>完整さ <b>${comp}</b></span><span>抑揚 <b>${pro}</b></span></div>
    <div class="pron-sub">逐字評価（绿=好 / 黄=一般 / <span class="miss">红下划线</span>=不准）：</div>
    <div class="pron-heard">${wordsHtml}</div>
    ${prosodyTip}
    <div class="pron-tips">💡 Azure 逐音素评估。把红/黄的字用 🔊 听示范，单独重复几遍。${PRON.idx<L.paragraph.length-1?'好了点「▶」下一句。':'最后一句，お疲れさま！'}</div>`;
}

/* ----------------------------- NOON ----------------------------- */
function renderNoon(L){
  const body=$("#panel-body");
  let html = `<div class="session-hint">${SESSIONS.noon.hint}</div>`;

  /* paragraph with translations shown */
  html += `<section class="block"><h2>📝 本文と訳 · 课文与翻译</h2><div class="para" id="para2"></div></section>`;

  /* vocab */
  html += `<section class="block"><h2>📚 単語 · 词汇</h2>
    <table class="vocab-table"><thead><tr><th>語 Word</th><th>読み Reading</th><th>意味 Meaning</th><th></th></tr></thead><tbody>
    ${L.vocab.map((v,i)=>`<tr>
      <td class="v-word">${esc(v.w)}</td>
      <td class="v-read">${esc(v.r)}</td>
      <td>${esc(v.zh)}<div class="v-en">${esc(v.en||"")}</div></td>
      <td><button class="play-w" data-w="${esc(v.r)}">🔊</button></td>
    </tr>`).join("")}
    </tbody></table></section>`;

  /* grammar */
  html += `<section class="block"><h2>🔧 文法 · 语法精讲</h2>
    ${L.grammar.map(g=>`<div class="gram">
      <h3>${esc(g.point)}</h3>
      <div class="label">${esc(g.label||"")}</div>
      <div class="exp">${esc(g.zh)}</div>
      ${g.examples.map(ex=>`<div class="ex" data-jp="${esc(ex.jp)}">${toRuby(ex.jp)}<span class="zh">${esc(ex.zh)}</span></div>`).join("")}
    </div>`).join("")}
  </section>`;

  /* conversation */
  html += `<section class="block"><h2>💬 会話で使う · 日常对话用法</h2>
    ${L.conversation.map(c=>`<div class="conv-item" data-jp="${esc(c.jp)}">${toRuby(c.jp)}<span class="zh">${esc(c.zh)}</span></div>`).join("")}
  </section>`;

  /* extended */
  if(L.extended){
    html += `<section class="block"><h2>🌱 ${esc(L.extended.title)}</h2>
      <ul class="ext-list">${L.extended.items.map(it=>`<li>${esc(it)}</li>`).join("")}</ul></section>`;
  }
  body.innerHTML=html;

  /* fill para2 with ruby + zh */
  const para2=$("#para2");
  L.paragraph.forEach((s,idx)=>{
    const el=document.createElement("span");
    el.className="sent";
    el.innerHTML=toRuby(s.jp)+`<span class="zh">${esc(s.zh)}</span>`;
    el.onclick=()=>speakSequence([{text:s.jp,node:el,audioKey:audioKeyFor(L.day,idx)}]);
    para2.appendChild(el);
  });
  if(!STATE.furi) para2.classList.add("hide-furi");

  /* click handlers: play vocab + examples + conversation */
  body.querySelectorAll(".play-w").forEach(b=>b.onclick=()=>speakSequence([{text:b.dataset.w,node:null,audioKey:"v_"+speechNorm(b.dataset.w)}]));
  body.querySelectorAll(".ex,.conv-item").forEach(el=>el.onclick=()=>speakSequence([{text:el.dataset.jp,node:el}]));
  addCompleteButton(L,"noon",body);
}

/* ----------------------------- NIGHT ----------------------------- */
function renderNight(L){
  const body=$("#panel-body");
  body.innerHTML = `
    <div class="session-hint">${SESSIONS.night.hint}</div>
    <div class="write-modes">
      <button data-m="type" class="${STATE.writeMode==='type'?'active':''}">⌨️ 输入核对 Type & Check</button>
      <button data-m="hide" class="${STATE.writeMode==='hide'?'active':''}">🙈 遮挡默写 Hide & Recall</button>
    </div>
    <div id="write-area"></div>
    <section class="block" style="margin-top:30px"><h2>🪞 反思 · 反思问题</h2>
      <ul class="reflect-list">${L.reflect.map(r=>`<li>${esc(r)}</li>`).join("")}</ul>
    </section>
  `;
  body.querySelectorAll(".write-modes button").forEach(b=>b.onclick=()=>{ STATE.writeMode=b.dataset.m; renderNight(L); });
  if(STATE.writeMode==="type") renderTypeMode(L);
  else renderHideMode(L);
  addCompleteButton(L,"night",body);
}

const fullPlain = L => L.paragraph.map(s=>toPlain(s.jp)).join("");
const fullRubyHtml = L => L.paragraph.map(s=>toRuby(s.jp)).join("");

function renderTypeMode(L){
  const area=$("#write-area");
  area.innerHTML=`
    <p class="typing-tip">看着原文（或先听一句），在下面把它打出来。日语输入法（macOS：かな/ローマ字）打不出来的字，正是你最该记的。点「核对」高亮差异。</p>
    <div class="copy-ref" id="ref">${fullRubyHtml(L)}</div>
    <textarea class="typing" id="typed" placeholder="ここに日本語で入力してください…（用日语输入法在此输入）"></textarea>
    <div class="check-row">
      <button id="check">✓ 核对 Check</button>
      <button id="clear" class="ghost">クリア Clear</button>
      <button id="hear" class="ghost">🔊 全文を聴く</button>
      <span class="score" id="score"></span>
    </div>
    <div class="diff" id="diff"></div>
  `;
  if(!STATE.furi) $("#ref").classList.add("hide-furi");
  $("#check").onclick=()=>{
    const target=fullPlain(L);
    const typed=$("#typed").value.replace(/\s/g,"");
    const t=target.replace(/\s/g,"");
    const {html,correct}=diffStrings(t,typed);
    $("#diff").innerHTML=html;
    const pct = t.length? Math.round(correct/t.length*100):0;
    $("#score").textContent=`正确 ${correct}/${t.length} 字 · ${pct}%`;
  };
  $("#clear").onclick=()=>{ $("#typed").value=""; $("#diff").innerHTML=""; $("#score").textContent=""; };
  $("#hear").onclick=()=>speakSequence(L.paragraph.map((s,i)=>({text:s.jp,node:null,audioKey:audioKeyFor(L.day,i)})));
}

/* char-level LCS diff so insertions/deletions don't cascade */
function diffStrings(target, typed){
  const n=target.length, m=typed.length;
  const dp=Array.from({length:n+1},()=>new Int32Array(m+1));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)
    dp[i][j]= target[i]===typed[j] ? dp[i+1][j+1]+1 : Math.max(dp[i+1][j],dp[i][j+1]);
  let i=0,j=0,html="",correct=0;
  while(i<n&&j<m){
    if(target[i]===typed[j]){ html+=`<span class="ok">${esc(target[i])}</span>`; correct++; i++;j++; }
    else if(dp[i+1][j]>=dp[i][j+1]){ html+=`<span class="miss">${esc(target[i])}</span>`; i++; }     // missing/wrong
    else { html+=`<span class="extra">${esc(typed[j])}</span>`; j++; }                                  // extra typed
  }
  while(i<n){ html+=`<span class="miss">${esc(target[i++])}</span>`; }
  while(j<m){ html+=`<span class="extra">${esc(typed[j++])}</span>`; }
  return {html,correct};
}

function renderHideMode(L){
  const area=$("#write-area");
  area.innerHTML=`
    <p class="typing-tip">原文已被遮挡。拿出纸笔，凭记忆把整段写（抄）出来，或大声背诵。写完点「揭晓」对照。你也可以只关掉 ふりがな，考自己的读音。</p>
    <button class="reveal-btn" id="reveal">👁 揭晓 Reveal</button>
    <button class="reveal-btn" id="hear2" style="background:var(--panel-2);color:var(--ink);border:1px solid var(--line)">🔊 ヒントに聴く</button>
    <div class="copy-ref masked" id="ref2">${L.paragraph.map(s=>maskSentence(s.jp)).join("")}</div>
  `;
  $("#reveal").onclick=()=>{
    const ref=$("#ref2");
    ref.classList.remove("masked");
    ref.innerHTML=fullRubyHtml(L);
    if(!STATE.furi) ref.classList.add("hide-furi");
  };
  $("#hear2").onclick=()=>speakSequence(L.paragraph.map((s,i)=>({text:s.jp,node:null,audioKey:audioKeyFor(L.day,i)})));
}
/* wrap visible glyphs in .mask blocks (keep ruby structure but hide) */
function maskSentence(jp){
  return "<span class='mask'>"+toRuby(jp)+"</span>";
}

/* ----------------------------- PLANNED ----------------------------- */
function renderPlanned(L){
  $("#lesson").style.display="none";
  const box=$("#planned");
  box.style.display="block";
  box.innerHTML=`
    <div class="day-head">
      <span class="week-chip">${WEEK_LABELS[L.week]||""}</span>
      <h1>${esc(L.theme)}<span class="level-badge">${L.level}</span></h1>
      <div class="theme-zh">${esc(L.themeZh)}</div>
    </div>
    <div class="planned-box">
      <div class="big">🗓️</div>
      <h2>这一天已规划好</h2>
      <p>主题、级别与来源都已排定，完整内容（课文＋音频＋语法＋抄写）会随你的进度逐日填充。</p>
      <div class="source" style="color:var(--ink-faint);font-size:.85rem">📖 来源 / Source：${esc(L.source)}</div>
      <div class="goals">${(L.goals||[]).map(g=>`<span>🎯 ${esc(g)}</span>`).join("")}</div>
      <p style="margin-top:18px;color:var(--ink-faint)">想现在就解锁这一天？告诉我「把 Day ${L.day} 写出来」，我就为你生成完整课文。</p>
    </div>
  `;
}

/* ----------------------------- complete button ----------------------------- */
function addCompleteButton(L,session,body){
  const done = PROG[L.day] && PROG[L.day][session];
  const btn=document.createElement("button");
  btn.className="complete-btn"+(done?" done":"");
  btn.textContent = done ? `✓ ${SESSIONS[session].name} 已完成 — 点此取消` : `把这一节标记为完成 ✓`;
  btn.onclick=()=>{ markSession(L.day,session,!done); render(); };
  body.appendChild(btn);
}

/* ----------------------------- progress bar ----------------------------- */
function updateProgressBar(){
  const totalReal = LESSONS.filter(l=>!l.planned).length*3 || 1;
  let done=0;
  LESSONS.forEach(l=>{ if(!l.planned){ const p=PROG[l.day]||{}; ["morning","noon","night"].forEach(s=>{ if(p[s]) done++; }); }});
  $("#prog-fill").style.width = Math.min(100, done/totalReal*100)+"%";
}

/* ----------------------------- 30-day map ----------------------------- */
function renderMap(){
  const v=$("#map-view");
  const weeks={};
  LESSONS.forEach(l=>{ (weeks[l.week]=weeks[l.week]||[]).push(l); });
  v.innerHTML = Object.keys(weeks).map(w=>`
    <div class="map-week">
      <h2>${WEEK_LABELS[w]||("Week "+w)}</h2>
      <div class="map-grid">
        ${weeks[w].map(l=>{
          const p=PROG[l.day]||{};
          const dots=["morning","noon","night"].map(s=>`<i class="${p[s]?'':'off'}">●</i>`).join(" ");
          return `<div class="map-card" data-day="${l.day}">
            <span class="lv">${l.level}</span>
            <div class="d">Day ${l.day}${l.planned?' · 计划中':''}</div>
            <div class="th">${esc(l.theme)}</div>
            <div class="thz">${esc(l.themeZh)}</div>
            ${l.planned?'':`<div class="prog">🌅☀️🌙 ${dots}</div>`}
          </div>`;
        }).join("")}
      </div>
    </div>
  `).join("");
  v.querySelectorAll(".map-card").forEach(c=>c.onclick=()=>{
    STATE.day=parseInt(c.dataset.day,10); STATE.session="morning"; toggleMap(false); render();
  });
}
function toggleMap(show){
  const v=$("#map-view"), main=$("#page-daily");
  v.classList.toggle("show",show);
  main.style.display = show?"none":"block";
  $("#map-toggle").textContent = show?"← 回到今天":"🗺️ 30天地图";
  if(show) renderMap();
}

/* ============================================================================
 *  INIT
 * ==========================================================================*/
/* ============================================================================
 *  PAGE ROUTING
 * ==========================================================================*/
function showPage(p){
  STATE.page=p;
  stopSpeak(); if(PRON.recording) stopRecog();
  document.querySelectorAll("#page-nav button").forEach(b=>b.classList.toggle("active",b.dataset.p===p));
  $("#page-daily").style.display = p==="daily"?"block":"none";
  $("#page-general").style.display = p==="general"?"block":"none";
  $("#page-test").style.display = p==="test"?"block":"none";
  $("#page-progress").style.display = p==="progress"?"block":"none";
  $("#daily-controls").style.display = p==="daily"?"flex":"none";
  if(p!=="daily"){ $("#map-view").classList.remove("show"); $("#day-num").textContent=""; }
  localStorage.setItem("jpn-page",p);
  if(p==="daily") render();
  else if(p==="general") renderGeneral();
  else if(p==="test") renderTestHome();
  else if(p==="progress") renderProgress();
  window.scrollTo(0,0);
}

/* ============================================================================
 *  PROGRESS DASHBOARD
 * ==========================================================================*/
function renderProgress(){
  const c=$("#page-progress");
  const total=LESSONS.length*3;
  let done=0, vocabL=0, gramL=0;
  LESSONS.forEach(l=>{ const p=PROG[l.day]||{}; done+=["morning","noon","night"].filter(s=>p[s]).length; if(p.noon){ vocabL+=(l.vocab||[]).length; gramL+=(l.grammar||[]).length; } });
  const streak=computeStreak(), best=loadTestBest();
  let cells=""; LESSONS.forEach(l=>{ const p=PROG[l.day]||{}; const cnt=["morning","noon","night"].filter(s=>p[s]).length; cells+=`<div class="hm-cell lv${cnt}" data-day="${l.day}" title="Day ${l.day}：${cnt}/3 完成">${l.day}</div>`; });
  const weeks={}; LESSONS.forEach(l=>{ (weeks[l.week]=weeks[l.week]||{done:0,total:0}); const p=PROG[l.day]||{}; weeks[l.week].done+=["morning","noon","night"].filter(s=>p[s]).length; weeks[l.week].total+=3; });
  let weekBars=""; Object.keys(weeks).forEach(w=>{ const o=weeks[w], pc=Math.round(o.done/o.total*100); weekBars+=`<div class="row"><span class="lab" style="width:auto;min-width:150px">${esc(WEEK_LABELS[w]||("第"+w+"周"))}</span><div class="bar"><i style="width:${pc}%"></i></div><span class="pct">${o.done}/${o.total}</span></div>`; });
  const testRow=TESTS.map(t=>{ const b=best[t.id]; return `<div class="stat"><div class="num">${b?Math.round(b.score/b.total*100)+"%":"—"}</div><div class="lbl">${esc(t.title.split("—")[0].trim())}</div></div>`; }).join("");
  c.innerHTML=`
    <div class="ref-intro"><h1>📊 学习进度</h1><p>坚持的可视化。数据存在本机浏览器；可在 ⚙ 设置里导出备份。</p></div>
    <div class="dash-stats">
      <div class="stat big"><div class="num">🔥 ${streak}</div><div class="lbl">连续学习天数</div></div>
      <div class="stat"><div class="num">${done}<span style="font-size:.5em;color:var(--ink-faint)">/${total}</span></div><div class="lbl">完成的小节</div></div>
      <div class="stat"><div class="num">${vocabL}</div><div class="lbl">已学词条</div></div>
      <div class="stat"><div class="num">${gramL}</div><div class="lbl">已学语法点</div></div>
    </div>
    <div class="dash-card"><h2>📅 30 天热力图</h2><div class="hm-grid">${cells}</div>
      <div class="hm-legend">每天完成数：<span class="hm-cell lv0">0</span><span class="hm-cell lv1">1</span><span class="hm-cell lv2">2</span><span class="hm-cell lv3">3</span> · 点格子跳到那天</div></div>
    <div class="dash-card"><h2>📈 分周完成度</h2><div class="eval-cat">${weekBars}</div></div>
    <div class="dash-card"><h2>📝 测试最佳成绩</h2><div class="dash-stats">${testRow||'<div class="lbl">还没做过测试</div>'}</div></div>`;
  c.querySelectorAll(".hm-cell[data-day]").forEach(el=>el.onclick=()=>{ STATE.day=parseInt(el.dataset.day,10); STATE.session="morning"; STATE.showZh=false; showPage("daily"); });
}

/* ============================================================================
 *  SETTINGS MODAL + BACKUP (export / import)
 * ==========================================================================*/
function openSettings(){
  const cfg=getAzureCfg()||{key:"",region:""};
  const ov=$("#modal-overlay"); ov.style.display="flex";
  ov.innerHTML=`<div class="modal">
    <div class="modal-head"><h2>⚙️ 设置</h2><button id="modal-close">✕</button></div>
    <div class="modal-body">
      <section><h3>🎤 发音评估引擎</h3>
        <p class="m-note">不填则用浏览器识别（近似）。填入 Azure 语音服务的 <b>Key + Region</b> 可获得逐音素＋语调评分（免费层每月 5 小时）。仅存于本机浏览器，不上传。</p>
        <label>Azure Key <input type="password" id="az-key" value="${esc(cfg.key||"")}" placeholder="Speech 资源的密钥"></label>
        <label>Region <input type="text" id="az-region" value="${esc(cfg.region||"")}" placeholder="如 japaneast / eastus"></label>
        <div class="m-actions"><button id="az-save" class="primary">保存</button><button id="az-clear">清除</button><span id="az-status" class="m-note"></span></div>
      </section>
      <section><h3>💾 进度备份</h3>
        <p class="m-note">进度只存在本机浏览器，清缓存就会丢。考前建议导出一份。</p>
        <div class="m-actions"><button id="exp-prog" class="primary">导出进度 JSON</button><button id="imp-prog">导入进度…</button><input type="file" id="imp-file" accept="application/json" style="display:none"><span id="bk-status" class="m-note"></span></div>
      </section>
      <section><h3>🔊 真人音频（VOICEVOX）</h3>
        <p class="m-note">${Object.keys(AUDIO_MANIFEST).length?`已加载 <b>${Object.keys(AUDIO_MANIFEST).length}</b> 条预生成音频 ✓`:"当前使用系统 TTS（机械音）。"} 要换成真人声优音频：启动 VOICEVOX 引擎后运行 <code>python3 tools/gen_audio.py</code> 生成到 <code>audio/</code>，刷新即可（详见 README）。需通过本地服务器打开。</p>
      </section>
    </div></div>`;
  $("#modal-close").onclick=closeSettings;
  ov.onclick=(e)=>{ if(e.target===ov) closeSettings(); };
  $("#az-save").onclick=()=>{ const key=$("#az-key").value.trim(), region=$("#az-region").value.trim(); if(key&&region){ localStorage.setItem("jpn-azure-cfg",JSON.stringify({key,region})); $("#az-status").textContent="已保存 ✓ 发音评估将用 Azure"; } else { $("#az-status").textContent="Key 和 Region 都要填"; } };
  $("#az-clear").onclick=()=>{ localStorage.removeItem("jpn-azure-cfg"); $("#az-key").value=""; $("#az-region").value=""; $("#az-status").textContent="已清除，将用浏览器识别"; };
  $("#exp-prog").onclick=exportProgress;
  $("#imp-prog").onclick=()=>$("#imp-file").click();
  $("#imp-file").onchange=importProgress;
}
function closeSettings(){ const ov=$("#modal-overlay"); ov.style.display="none"; ov.innerHTML=""; }
function exportProgress(){
  const keys=["jpn-n2-progress","jpn-test-best","jpn-last-day","jpn-page","jpn-active-dates"];
  const out={ _app:"jpn-n4-n2", _exported:new Date().toISOString(), data:{} };
  keys.forEach(k=>{ const v=localStorage.getItem(k); if(v!==null) out.data[k]=v; });
  const blob=new Blob([JSON.stringify(out,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob), a=document.createElement("a");
  const d=new Date(), stamp=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  a.href=url; a.download=`jpn-progress-${stamp}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  const st=$("#bk-status"); if(st) st.textContent="已导出 ✓";
}
function importProgress(e){
  const file=e.target.files&&e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const obj=JSON.parse(reader.result);
      if(!obj||typeof obj.data!=="object") throw new Error("文件格式不符");
      if(!confirm("导入将覆盖当前进度，确定继续？")){ return; }
      Object.keys(obj.data).forEach(k=>{ if(/^jpn-/.test(k)) localStorage.setItem(k, obj.data[k]); });
      PROG=loadProg();
      const last=parseInt(localStorage.getItem("jpn-last-day")||"1",10); STATE.day=(last>=1&&last<=TOTAL_DAYS)?last:1;
      alert("导入成功！进度已恢复。");
      closeSettings(); showPage(STATE.page);
    }catch(err){ alert("导入失败："+err.message); }
  };
  reader.readAsText(file);
}

/* ============================================================================
 *  GENERAL / REFERENCE PAGE
 * ==========================================================================*/
function rubyMd(s){ return toRuby(s).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>"); }
function renderBlocks(blocks){
  return blocks.map(b=>{
    if(b.t==="p") return `<p>${rubyMd(b.zh)}</p>`;
    if(b.t==="note") return `<div class="r-note">${rubyMd(b.zh)}</div>`;
    if(b.t==="rules") return `<ul class="r-rules">${b.items.map(it=>`<li>${rubyMd(it)}</li>`).join("")}</ul>`;
    if(b.t==="ex") return b.items.map(e=>`<div class="r-ex" data-jp="${esc(e.jp)}">${toRuby(e.jp)}<span class="zh">${esc(e.zh)}</span></div>`).join("");
    if(b.t==="table") return `<div class="r-table-wrap"><table class="r-table"><thead><tr>${b.head.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${b.rows.map(r=>`<tr>${r.map(c=>`<td>${toRuby(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    return "";
  }).join("");
}
function grammarIndexSection(){
  let items="";
  LESSONS.forEach(l=>{ if(l.grammar){ l.grammar.forEach(g=>{
    if(/^[①-⑩\d]/.test(g.point)) return;   // skip review-numbered entries
    items += `<div class="gidx-item" data-day="${l.day}"><span class="d">D${l.day}</span><b>${esc(g.point)}</b></div>`;
  }); }});
  return `<div class="ref-section" data-id="grammar-index">
    <div class="ref-head"><span class="r-emoji">🗂️</span><h2>全文法インデックス <span class="r-zh">全部语法点索引 · 点击跳到对应天</span></h2><span class="r-arrow">▸</span></div>
    <div class="ref-body"><div class="gidx-grid">${items}</div></div></div>`;
}
function renderGeneral(){
  const c=$("#page-general");
  let html=`<div class="ref-intro"><h1>📚 基础总览</h1><p>随时回来查阅的通用参考：动词分组与变位、形容词、助词、助数词与特殊读音、敬语速查、全语法索引、关西弁。点标题展开/收起；例句可点击朗读。</p></div>`;
  REFERENCE.forEach((sec,i)=>{
    html+=`<div class="ref-section${i===0?" open":""}" data-id="${esc(sec.id)}">
      <div class="ref-head"><span class="r-emoji">${sec.icon}</span><h2>${esc(sec.title)} <span class="r-zh">${esc(sec.titleZh)}</span></h2><span class="r-arrow">▸</span></div>
      <div class="ref-body">${renderBlocks(sec.blocks)}</div></div>`;
  });
  html+=grammarIndexSection();
  c.innerHTML=html;
  c.querySelectorAll(".ref-head").forEach(h=>h.onclick=()=>h.parentElement.classList.toggle("open"));
  c.querySelectorAll(".r-ex").forEach(el=>el.onclick=()=>speakSequence([{text:el.dataset.jp,node:null}]));
  c.querySelectorAll(".gidx-item").forEach(el=>el.onclick=()=>{ STATE.day=parseInt(el.dataset.day,10); STATE.session="noon"; showPage("daily"); });
}

/* ============================================================================
 *  TEST PAGE
 * ==========================================================================*/
function loadTestBest(){ try{ return JSON.parse(localStorage.getItem("jpn-test-best"))||{}; }catch(e){ return {}; } }
function saveTestBest(id,score,total){ const b=loadTestBest(); if(!b[id]||score>b[id].score){ b[id]={score,total}; localStorage.setItem("jpn-test-best",JSON.stringify(b)); } }

let TEST=null;   // { def, answers[], remaining, interval, submitted }

function renderTestHome(){
  if(TEST&&TEST.interval) clearInterval(TEST.interval);
  TEST=null;
  const c=$("#page-test"); const best=loadTestBest();
  let html=`<div class="test-intro"><h1>📝 N2 模拟测试</h1><p>4 套限时测试，全部以 N2 标准评分。每套对应一周的语法重点；交卷后给出<b>分项自评</b>（文法 / 語彙 / 読解）和针对性的复习建议。</p></div><div class="test-grid">`;
  TESTS.forEach(t=>{
    const b=best[t.id];
    html+=`<div class="test-card" data-id="${t.id}">
      <span class="tc-lv">${esc(t.level)}</span>
      <h3>${esc(t.title)}</h3>
      <div class="tc-meta">${esc(t.titleZh)}</div>
      <div class="tc-meta">⏱ ${t.timeMin} 分钟 · ${t.questions.length} 题</div>
      <div class="tc-desc">${esc(t.desc)}</div>
      ${b?`<div class="tc-best">★ 最佳：${b.score}/${b.total}（${Math.round(b.score/b.total*100)}%）</div>`:`<div class="tc-best" style="color:var(--ink-faint)">尚未挑战</div>`}
    </div>`;
  });
  html+=`</div>`;
  c.innerHTML=html;
  c.querySelectorAll(".test-card").forEach(card=>card.onclick=()=>startTest(parseInt(card.dataset.id,10)));
}

function shuffled(arr){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function startTest(id){
  const def=TESTS.find(t=>t.id===id);
  TEST={ def, answers:new Array(def.questions.length).fill(null), remaining:def.timeMin*60, interval:null, submitted:false,
         order:def.questions.map(()=>shuffled([0,1,2,3])) };  // display order of options per question
  renderQuiz();
  TEST.interval=setInterval(()=>{ if(!TEST){return;} TEST.remaining--; updateTimer(); if(TEST.remaining<=0) finishTest(true); },1000);
}

function renderQuiz(){
  const c=$("#page-test"); const d=TEST.def;
  let html=`<div class="quiz-bar"><span class="q-title">${esc(d.title)}</span><span class="q-count" id="q-count"></span><span class="timer" id="timer">--:--</span><button id="quit-test">退出</button></div>`;
  d.questions.forEach((q,i)=>{
    const optsHtml=TEST.order[i].map((origJ,pos)=>`<div class="q-opt" data-i="${i}" data-j="${origJ}"><span class="mark">${"ABCD"[pos]}</span><span>${toRuby(q.options[origJ])}</span></div>`).join("");
    html+=`<div class="q-card" data-i="${i}"><span class="q-num">問 ${i+1}</span><span class="q-cat">${esc(q.cat)}</span>
      <div class="q-text">${toRuby(q.q)}</div>
      <div class="q-opts">${optsHtml}</div>
      <div class="q-explain" id="exp-${i}"></div></div>`;
  });
  html+=`<button class="submit-test" id="submit-test">提出する · 交卷并评分</button>`;
  c.innerHTML=html;
  c.querySelectorAll(".q-opt").forEach(opt=>opt.onclick=()=>{
    if(TEST.submitted) return;
    const i=+opt.dataset.i, j=+opt.dataset.j;
    TEST.answers[i]=j;
    document.querySelectorAll(`.q-opt[data-i="${i}"]`).forEach(o=>o.classList.remove("sel"));
    opt.classList.add("sel"); updateCount();
  });
  $("#submit-test").onclick=()=>finishTest(false);
  $("#quit-test").onclick=()=>{ if(confirm("退出测试？本次进度不会保存。")){ clearInterval(TEST.interval); TEST=null; renderTestHome(); } };
  updateTimer(); updateCount();
}
function updateTimer(){ const t=$("#timer"); if(!t||!TEST) return; const m=Math.floor(TEST.remaining/60), s=TEST.remaining%60; t.textContent=`${m}:${String(s).padStart(2,"0")}`; t.classList.toggle("warn",TEST.remaining<=30); }
function updateCount(){ const e=$("#q-count"); if(!e||!TEST) return; e.textContent=`已答 ${TEST.answers.filter(a=>a!==null).length}/${TEST.def.questions.length}`; }

function finishTest(auto){
  if(!TEST||TEST.submitted) return;
  TEST.submitted=true; clearInterval(TEST.interval);
  const d=TEST.def;
  d.questions.forEach((q,i)=>{
    const card=document.querySelector(`.q-card[data-i="${i}"]`);
    card.querySelectorAll(".q-opt").forEach(opt=>{
      const j=+opt.dataset.j;
      if(j===q.answer) opt.classList.add("correct");
      else if(TEST.answers[i]===j) opt.classList.add("wrong");
    });
    const exp=document.getElementById("exp-"+i);
    const got=TEST.answers[i];
    const okTxt = got===q.answer?'<span style="color:var(--good)">✓ 正解</span>':(got===null?'<span style="color:var(--ink-faint)">— 未作答</span>':'<span style="color:var(--bad)">✗ 不正解</span>');
    const correctLetter="ABCD"[TEST.order[i].indexOf(q.answer)];
    exp.innerHTML=`<div>${okTxt} · 正解：${correctLetter}</div><div><span class="gp">${esc(q.point)}</span> — ${toRuby(q.explain)} <a data-day="${q.day}">→ 复习 Day ${q.day}</a></div>`;
    exp.classList.add("show");
  });
  showEvaluation(auto);
  const score=d.questions.reduce((s,q,i)=>s+(TEST.answers[i]===q.answer?1:0),0);
  saveTestBest(d.id,score,d.questions.length);
  document.querySelectorAll("#page-test a[data-day]").forEach(a=>a.onclick=()=>{ STATE.day=+a.dataset.day; STATE.session="noon"; showPage("daily"); });
  window.scrollTo({top:0,behavior:"smooth"});
}

function showEvaluation(auto){
  const d=TEST.def, total=d.questions.length;
  const score=d.questions.reduce((s,q,i)=>s+(TEST.answers[i]===q.answer?1:0),0);
  const pct=Math.round(score/total*100), passed=pct>=60;
  const cats={};
  d.questions.forEach((q,i)=>{ const c=q.cat; (cats[c]=cats[c]||{n:0,ok:0,wrong:[]}); cats[c].n++; if(TEST.answers[i]===q.answer) cats[c].ok++; else cats[c].wrong.push({point:q.point,day:q.day}); });
  let catRows="";
  Object.keys(cats).forEach(c=>{ const o=cats[c], p=Math.round(o.ok/o.n*100); catRows+=`<div class="row"><span class="lab">${esc(c)}</span><div class="bar"><i style="width:${p}%"></i></div><span class="pct">${o.ok}/${o.n}</span></div>`; });
  const strong=Object.keys(cats).filter(c=>cats[c].ok/cats[c].n>=0.8);
  const weak=Object.keys(cats).filter(c=>cats[c].ok/cats[c].n<0.6);
  let advice="";
  if(strong.length) advice+=`<p class="good">👍 表现不错：${strong.join("、")}——这些方面已经比较稳。</p>`;
  if(weak.length) advice+=`<p class="weak">📌 需要加强：${weak.join("、")}。</p>`;
  const wrong=[]; Object.values(cats).forEach(o=>o.wrong.forEach(w=>wrong.push(w)));
  if(wrong.length) advice+=`<p>重点复习这些语法点：</p><p>`+wrong.map(w=>`<a data-day="${w.day}">${esc(w.point)}（Day ${w.day}）</a>`).join("　·　")+`</p>`;
  else advice+=`<p class="good">全部答对！🎉 可以挑战下一套更难的。</p>`;
  const used=d.timeMin*60-Math.max(0,TEST.remaining), tm=Math.floor(used/60), ts=used%60;
  const html=`<div class="eval-box">
    <div class="eval-score"><div class="big ${passed?"pass":"fail"}">${pct}%</div>
      <div class="sub">${score} / ${total} 正解 · 用时 ${tm}:${String(ts).padStart(2,"0")}${auto?" · ⏰ 时间到，自动交卷":""} · ${passed?"达到合格线 (60%) ✓":"未达合格线 (60%)"}</div></div>
    <div class="eval-cat">${catRows}</div>
    <div class="eval-advice">${advice}</div>
    <div class="eval-actions"><button class="review" id="ev-review">查看逐题解析 ↓</button><button class="retry" id="ev-retry">重做这套</button></div>
  </div>`;
  $("#page-test").insertAdjacentHTML("afterbegin",html);
  $("#ev-retry").onclick=()=>startTest(d.id);
  $("#ev-review").onclick=()=>{ const q=document.querySelector(".q-card"); if(q) q.scrollIntoView({behavior:"smooth"}); };
}

/* ============================================================================
 *  INIT
 * ==========================================================================*/
function setHeaderVar(){ const h=document.querySelector("header.top"); if(h) document.documentElement.style.setProperty("--header-h", h.offsetHeight+"px"); }

function init(){
  const last=parseInt(localStorage.getItem("jpn-last-day")||"1",10);
  STATE.day = (last>=1 && last<=TOTAL_DAYS)? last : 1;

  $("#prev").onclick=()=>{ if(STATE.day>1){STATE.day--;STATE.session="morning";STATE.showZh=false;render();} };
  $("#next").onclick=()=>{ if(STATE.day<TOTAL_DAYS){STATE.day++;STATE.session="morning";STATE.showZh=false;render();} };
  $("#day-pick").onchange=e=>{ STATE.day=parseInt(e.target.value,10); STATE.session="morning"; STATE.showZh=false; render(); };
  $("#furi-toggle").onclick=()=>{ STATE.furi=!STATE.furi; render(); };
  $("#map-toggle").onclick=()=>toggleMap(!$("#map-view").classList.contains("show"));
  $("#gear-btn").onclick=openSettings;
  document.querySelectorAll("#page-nav button").forEach(b=>b.onclick=()=>showPage(b.dataset.p));

  // pre-generated audio manifest (VOICEVOX). Prefer the <script>-loaded global
  // (works on file:// too); else fetch the JSON (http only). Absent → {} → TTS fallback.
  if(typeof window!=="undefined" && window.AUDIO_MANIFEST){
    AUDIO_MANIFEST = window.AUDIO_MANIFEST;
  } else if(typeof fetch==="function" && location.protocol!=="file:"){
    fetch("audio/manifest.json").then(r=>r.ok?r.json():{}).then(m=>{ AUDIO_MANIFEST=m||{}; }).catch(()=>{ AUDIO_MANIFEST={}; });
  }
  setHeaderVar();
  window.addEventListener("resize", setHeaderVar);

  const startPage=localStorage.getItem("jpn-page")||"daily";
  showPage(["daily","general","test","progress"].includes(startPage)?startPage:"daily");
  setTimeout(setHeaderVar,300);   // after fonts/layout settle
}
document.addEventListener("DOMContentLoaded",init);
