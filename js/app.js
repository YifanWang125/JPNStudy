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
  rate: 1.0,                 // natural speed for the real voice; slider can slow it for shadowing
};
/* ---------- i18n: explanation language (learner's native language) ---------- */
function getLang(){ try{ return localStorage.getItem("jpn-lang")||"zh"; }catch(e){ return "zh"; } }
let LANG = getLang();
function setLang(l){ LANG=(l==="en"?"en":"zh"); try{ localStorage.setItem("jpn-lang", LANG); }catch(e){} }
/* UI string: T("中文","English") → picks by LANG (falls back to zh if no en given) */
function T(zh, en){ return (LANG==="en" && en!=null) ? en : zh; }
/* data field: show the English value when in en-mode AND it exists; else the Chinese */
function zhen(zh, en){ return (LANG==="en" && en!=null && en!=="") ? en : (zh!=null?zh:""); }

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
let VOICES = [];                  // selectable voice models (window.VOICES); [0] = default
let VOICE_PREFIX = "audio/";      // path prefix of the currently selected voice
function setVoice(id){
  const v = VOICES.find(x=>x.id===id) || VOICES[0];
  VOICE_PREFIX = (v && v.prefix) || "audio/";
  try{ localStorage.setItem("jpn-voice", v?v.id:"default"); }catch(e){}
}
function currentVoiceId(){ try{ return localStorage.getItem("jpn-voice")||"default"; }catch(e){ return "default"; } }
function voiceOptionsHTML(){
  const cur=currentVoiceId(), groups={};
  VOICES.forEach(v=>{ const c=v.char||v.name||"声音"; (groups[c]=groups[c]||[]).push(v); });
  return Object.keys(groups).map(c=>
    `<optgroup label="${esc(c)}">`+groups[c].map(v=>
      `<option value="${esc(v.id)}"${v.id===cur?" selected":""}>${esc(v.style||v.tag||v.name)}</option>`).join("")+`</optgroup>`
  ).join("");
}

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
  // candidate sources: selected voice's parallel file first, then the default file,
  // then system TTS. Alternate voices reuse the same filenames under their own prefix,
  // so a missing clip (e.g. examples not generated for that voice) gracefully falls back.
  const srcs = (VOICE_PREFIX && VOICE_PREFIX!=="audio/")
    ? [VOICE_PREFIX + src.replace(/^audio\//,""), src] : [src];
  return new Promise(res=>{
    if(item.node) item.node.classList.add("speaking");
    let done=false, idx=0, a=null;
    const unhighlight=()=>{ if(item.node) item.node.classList.remove("speaking"); };
    const finish=()=>{ if(done) return; done=true; unhighlight(); if(CURRENT_AUDIO===a) CURRENT_AUDIO=null; res(); };
    const start=()=>{
      a=new Audio(srcs[idx]); CURRENT_AUDIO=a; a.playbackRate=STATE.rate;
      let advanced=false;                         // ensure this source advances at most ONCE
      const advance=()=>{ if(advanced||done) return; advanced=true;
        idx++;
        if(idx<srcs.length){ start(); }           // try the next file (e.g. default voice)
        else { done=true; unhighlight(); ttsOne(item.text, item.node).then(res); }  // last resort: TTS
      };
      a.onended=finish;
      a.onerror=advance;                          // file missing/failed → next source
      a.play().catch(advance);                    // play rejected → next source (guarded, won't double-fire)
    };
    start();
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
  if(window.Assistant && window.Assistant.refreshCtx) window.Assistant.refreshCtx();  // R3-2
  localStorage.setItem("jpn-last-day", STATE.day);
  localStorage.setItem("jpn-last-session", STATE.session);   // remember which sub-page (morning/noon/night) for "继续学习"
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
/* "测试连接" for the Azure key: a tiny synth round-trip confirms key+region auth
   (same Speech resource as pronunciation assessment). No audible playback (pull stream). */
function testAzureConn(){
  const key=$("#az-key").value.trim(), region=$("#az-region").value.trim();
  const box=$("#az-conn"); if(!box) return;
  if(!key||!region){ box.className="conn-status bad"; box.textContent="✗ Key 和 Region 都要填（如 japaneast）"; return; }
  box.className="conn-status testing"; box.textContent="🔌 正在连接 Azure 语音…（首次需联网下载 SDK）";
  const btn=$("#az-test"); if(btn) btn.disabled=true;
  const done=()=>{ if(btn) btn.disabled=false; };
  const t0=Date.now();
  loadAzureSDK().then(SDK=>{
    const cfg=SDK.SpeechConfig.fromSubscription(key, region);
    cfg.speechSynthesisVoiceName="ja-JP-NanamiNeural";
    const out=SDK.AudioConfig.fromStreamOutput(SDK.AudioOutputStream.createPullStream());
    const synth=new SDK.SpeechSynthesizer(cfg, out);
    synth.speakTextAsync("テスト", res=>{
      const ms=Date.now()-t0;
      try{
        if(res.reason===SDK.ResultReason.SynthesizingAudioCompleted){
          box.className="conn-status ok"; box.textContent=`✓ 连接成功 · 用时 ${ms}ms · 发音评估可用。已自动保存。`;
          localStorage.setItem("jpn-azure-cfg", JSON.stringify({key,region})); $("#az-status").textContent="已验证并保存 ✓";
        } else {
          const c=SDK.CancellationDetails.fromResult(res);
          box.className="conn-status bad"; box.textContent="✗ 失败："+((c&&(c.errorDetails||c.reason))||res.reason);
        }
      } finally { try{ synth.close(); }catch(e){} done(); }
    }, err=>{ box.className="conn-status bad"; box.textContent="✗ 连接出错："+err; try{ synth.close(); }catch(e){} done(); });
  }).catch(e=>{ box.className="conn-status bad"; box.textContent="✗ 无法加载/连接语音 SDK（需联网）："+e.message; done(); });
}

/* metric definitions (shown as ⓘ tooltips + used in advice) */
const METRIC_DEF = {
  acc:["正確さ","发音准确度：每个假名/音有没有读对。低 = 个别音发错或走音。"],
  flu:["流暢さ","流利度：有没有不自然的停顿、卡顿、拖音。低 = 读得断断续续。"],
  comp:["完整さ","完整度：句子读全了吗、有没有漏字/吞字。低 = 有遗漏。"],
  pro:["抑揚","语调·韵律：句子高低起伏是否自然（日语靠音高表意，很关键）。低 = 读得太平。"]
};
function scoreBand(s){
  if(s>=90) return {t:"優秀 · 近母语",c:"great"};
  if(s>=75) return {t:"良好 · 熟练",c:"great"};
  if(s>=60) return {t:"合格线 · 还行",c:"ok"};
  return {t:"要加强",c:"again"};
}
function azureInterpret(d){
  const dims=[["acc",d.acc],["flu",d.flu],["comp",d.comp],["pro",d.pro]];
  const weak=dims.reduce((a,b)=>b[1]<a[1]?b:a);
  const tips={ acc:"看下面红/黄的字，单独跟读那几个假名，把音对准。",
    flu:"先放慢，把整句连起来读顺，别一个词一个词蹦，再慢慢提速。",
    comp:"对照原文，每个字都读出来，别吞音、别漏字。",
    pro:"日语靠高低音表意——重点模仿示范的“起伏”，别从头到尾一个调。" };
  if(weak[1]>=85) return "四项都很均衡，非常棒！保持这个状态，挑战下一句/整段。";
  return `你最该练的是「${METRIC_DEF[weak[0]][0]}」(${weak[1]}分)：${tips[weak[0]]}`;
}

let PRON = null;
function pronKey(){ return PRON.mode==="paragraph" ? "P" : ("s"+PRON.idx); }
function revokePronUrls(p){ if(!p||!p.history) return; try{ Object.keys(p.history).forEach(k=>p.history[k].forEach(a=>{ if(a.url){ try{URL.revokeObjectURL(a.url);}catch(e){} } })); }catch(e){} }
function appendPron(L, body){
  if(PRON && PRON.day===L.day){
    // same-day re-render (e.g. clicking 标记完成): KEEP recording history; reset only transient state (R2-5)
    PRON.recording=false; PRON.recorder=null; PRON.chunks=[]; PRON.recog=null; PRON.recognizer=null; PRON.stream=null; PRON.pending=null; PRON._scored=false;
  } else {
    revokePronUrls(PRON);   // free old day's recordings before switching (R2-5: no objectURL leak)
    PRON = { day:L.day, mode:"sentence", idx:0, recording:false, recorder:null, chunks:[], recog:null, recognizer:null, stream:null, history:{}, pending:null, _scored:false };
  }
  const box=document.createElement("div");
  box.className="pron-box"; box.id="pron-box";
  body.appendChild(box);
  renderPron(L);
}
/* user-friendly, clickable engine badge (no "Azure" jargon; click → settings to manage/turn off) */
function pronEngineBadge(){
  if(azureEnabled()) return `<button class="pron-engine on" id="pron-engine" title="点击管理 / 关闭 AI 引擎">● AI 引擎已开启 · 逐音素＋语调 ⚙</button>`;
  if(SpeechRec)      return `<button class="pron-engine" id="pron-engine" title="点此开启 AI 精评（逐音素＋语调）">○ 基础版 · 点此开启 AI 精评</button>`;
  return "";
}
function pronTarget(L){
  if(PRON.mode==="paragraph"){
    return { jpRuby:L.paragraph.map(s=>toRuby(s.jp)).join(""),
             plain:L.paragraph.map(s=>speechNorm(s.jp)).join("、"),
             listen:L.paragraph.map((s,i)=>({text:s.jp,node:null,audioKey:audioKeyFor(L.day,i)})) };
  }
  const s=L.paragraph[PRON.idx];
  return { jpRuby:toRuby(s.jp), plain:speechNorm(s.jp),
           listen:[{text:s.jp,node:null,audioKey:audioKeyFor(L.day,PRON.idx)}] };
}
function renderPron(L){
  const box=$("#pron-box"); if(!box) return;
  const total=L.paragraph.length, t=pronTarget(L);
  const modeTabs=`<div class="pron-modes"><button class="${PRON.mode==='sentence'?'on':''}" id="pm-sent">逐句</button><button class="${PRON.mode==='paragraph'?'on':''}" id="pm-para">整段</button></div>`;
  let nav="";
  if(PRON.mode==="sentence"){
    let chips=""; for(let i=0;i<total;i++) chips+=`<button class="pj-chip ${i===PRON.idx?'on':''}" data-jump="${i}">${i+1}</button>`;
    nav=`<div class="pron-nav"><button class="nav" id="pron-prev">◀</button><span class="pron-sub">第 ${PRON.idx+1} / ${total} 句</span><button class="nav" id="pron-next">▶</button></div><div class="pj-chips">${chips}</div>`;
  }
  let head=`<h3>🎤 発音チェック · 跟读评估 ${pronEngineBadge()}</h3>
    <div class="pron-sub">跟读 → 录音 → <b>回听自己的声音</b>并对比标准音。${PRON.mode==='paragraph'?'整段模式：一口气读完，读完点「■ 停止」。':'逐句模式：点下面数字可跳到任意句。'}</div>
    ${modeTabs}<div class="pron-target">${t.jpRuby}</div>`;
  if(IS_FILE){
    box.innerHTML=head+`<div class="pron-unsupported">🔌 你正用 file:// 打开。麦克风需要本地服务器：终端跑 <code>python3 -m http.server 4173</code> 再开 <b>http://localhost:4173</b>。现在仍可「🔊 听示范」。</div><div class="pron-ctrl"><button class="listen" id="pron-listen">🔊 听示范</button></div>${nav}`;
    bindPron(L,t,total); return;
  }
  if(!SpeechRec && !azureEnabled()){
    box.innerHTML=head+`<div class="pron-unsupported">⚠️ 此浏览器不支持录音识别。建议用 <b>Chrome</b>，或在 ⚙ 开启 AI 引擎。仍可「🔊 听示范」。</div><div class="pron-ctrl"><button class="listen" id="pron-listen">🔊 听示范</button></div>${nav}`;
    bindPron(L,t,total); return;
  }
  box.innerHTML=head+`
    <div class="pron-ctrl">
      <button class="rec ${PRON.recording?'recording':''}" id="pron-rec">${PRON.recording?'■ 停止':'🎤 録音して読む'}</button>
      <button class="listen" id="pron-listen">🔊 听标准示范</button>
    </div>${nav}
    <div class="pron-result" id="pron-result"></div>`;
  $("#pron-rec").onclick=()=>{ if(PRON.recording) stopRec(); else startRec(L); };
  bindPron(L,t,total);
  renderResult(L);
}
function bindPron(L,t,total){
  if($("#pron-engine")) $("#pron-engine").onclick=openSettings;
  if($("#pron-listen")) $("#pron-listen").onclick=()=>speakSequence(t.listen);
  if($("#pron-prev"))   $("#pron-prev").onclick=()=>{ if(PRON.recording)stopRec(); if(PRON.idx>0){PRON.idx--;renderPron(L);} };
  if($("#pron-next"))   $("#pron-next").onclick=()=>{ if(PRON.recording)stopRec(); if(PRON.idx<total-1){PRON.idx++;renderPron(L);} };
  if($("#pm-sent"))     $("#pm-sent").onclick=()=>{ if(PRON.recording)stopRec(); PRON.mode="sentence"; renderPron(L); };
  if($("#pm-para"))     $("#pm-para").onclick=()=>{ if(PRON.recording)stopRec(); PRON.mode="paragraph"; renderPron(L); };
  document.querySelectorAll(".pj-chip[data-jump]").forEach(b=>b.onclick=()=>{ if(PRON.recording)stopRec(); PRON.idx=parseInt(b.dataset.jump,10); renderPron(L); });
}
function updatePronBtn(){ const b=$("#pron-rec"); if(!b) return; b.textContent=PRON.recording?'■ 停止':'🎤 録音して読む'; b.classList.toggle('recording',PRON.recording); }

/* ---- record (MediaRecorder → playback) + score (engine); finalize ONCE when BOTH ready (R2-2) ---- */
async function startRec(L){
  stopSpeak();
  const res=$("#pron-result"); if(res) res.innerHTML=`<div class="pron-sub">🎙️ 准备麦克风…</div>`;
  let stream;
  try{ stream=await navigator.mediaDevices.getUserMedia({audio:true}); }
  catch(e){ if(res) res.innerHTML=`<div class="pron-unsupported">无法使用麦克风：${esc(String(e.name||e))}。请允许麦克风权限，并用 <b>http://localhost</b> 打开（file:// 不行）。</div>`; return; }
  PRON.stream=stream; PRON.chunks=[]; PRON._scored=false;
  PRON.pending={ url:null, urlReady:false, score:undefined, scoreReady:false };
  try{
    const rec=new MediaRecorder(stream); PRON.recorder=rec;
    rec.ondataavailable=e=>{ if(e.data&&e.data.size) PRON.chunks.push(e.data); };
    rec.onstop=()=>{
      let url=null;
      try{ if(PRON.chunks.length){ url=URL.createObjectURL(new Blob(PRON.chunks,{type:PRON.chunks[0].type||"audio/webm"})); } }catch(e){}
      if(PRON.stream){ PRON.stream.getTracks().forEach(t=>t.stop()); PRON.stream=null; }
      if(PRON.pending){ PRON.pending.url=url; PRON.pending.urlReady=true; tryFinalize(L); }
    };
    rec.start();
  }catch(e){ PRON.recorder=null; if(PRON.pending) PRON.pending.urlReady=true; }   // no recorder → don't block finalize on audio
  PRON.recording=true; updatePronBtn();
  if(res) res.innerHTML=`<div class="pron-sub">🔴 録音中… ゆっくり、はっきり。读完${PRON.mode==='paragraph'?'点「■ 停止」':'停顿一下会自动结束'}。</div>`;
  const t=pronTarget(L);
  if(azureEnabled()) scoreAzure(L, t.plain); else scoreBrowser(L, t.plain);
}
function stopRec(){
  PRON.recording=false; updatePronBtn();
  if(PRON.recog){ try{PRON.recog.stop();}catch(e){} }                                  // browser SR → onend → gotScore
  if(PRON.recognizer && PRON.recognizer.stopContinuousRecognitionAsync){ try{ PRON.recognizer.stopContinuousRecognitionAsync(()=>{},()=>{}); }catch(e){} } // azure paragraph → sessionStopped
  // R2-2: never finalize on stop alone — wait for the score callback; the recorder is stopped inside gotScore.
}
function gotScore(L, obj){
  if(!PRON.pending){ PRON.pending={url:null,urlReady:true,score:undefined,scoreReady:false}; }
  PRON.pending.score=obj; PRON.pending.scoreReady=true;
  PRON.recording=false; updatePronBtn();
  if(PRON.recorder && PRON.recorder.state==="recording"){ try{ PRON.recorder.stop(); }catch(e){ PRON.pending.urlReady=true; tryFinalize(L); } }
  else tryFinalize(L);
}
function tryFinalize(L){
  const p=PRON.pending; if(!p || !p.scoreReady || !p.urlReady) return;   // both audio + score must be ready → ONE record
  PRON.pending=null;
  const obj = p.score || {type:"basic",overall:0,heard:"",html:"",noscore:true};
  const key=pronKey();
  const arr=PRON.history[key]||(PRON.history[key]=[]);
  arr.push({url:p.url||null, score:(obj.overall||0), data:obj, ts:Date.now()});
  while(arr.length>3){ const old=arr.shift(); if(old.url) try{URL.revokeObjectURL(old.url);}catch(e){} }
  renderResult(L);
}
function scoreBrowser(L, target){
  if(!SpeechRec){ gotScore(L,{type:"basic",overall:0,heard:"",html:""}); return; }
  const r=new SpeechRec();
  r.lang="ja-JP"; r.maxAlternatives=1; r.interimResults=false; r.continuous=(PRON.mode==="paragraph");
  PRON.recog=r; PRON._scored=false; let heard="";
  r.onresult=(e)=>{ for(let i=e.resultIndex;i<e.results.length;i++){ heard+=e.results[i][0].transcript; } };
  r.onerror=()=>{};
  r.onend=()=>{ if(!PRON._scored){ PRON._scored=true; PRON.recog=null; gotScore(L, browserScoreObj(target, heard)); } };
  try{ r.start(); }catch(e){ if(!PRON._scored){ PRON._scored=true; gotScore(L, browserScoreObj(target,"")); } }
}
function browserScoreObj(target, heard){
  const norm=s=>(s||"").replace(/[\s。、，．！？!?「」『』・]/g,"");
  const t=norm(target), h=norm(heard);
  const {html,correct}=diffStrings(t,h);
  return {type:"basic", overall: t.length?Math.round(correct/t.length*100):0, heard, html};
}
/* ---- Azure: sentence = recognizeOnce; paragraph = continuous + aggregate over all utterances (R2-1) ---- */
async function scoreAzure(L, target){
  let SDK;
  try{ SDK=await loadAzureSDK(); }
  catch(e){ const res=$("#pron-result"); if(res) res.innerHTML+=`<div class="pron-sub">AI 引擎加载失败，改用基础版评分。</div>`; scoreBrowser(L,target); return; }
  try{
    const cfg=getAzureCfg();
    const sc=SDK.SpeechConfig.fromSubscription(cfg.key,cfg.region); sc.speechRecognitionLanguage="ja-JP";
    // R3-6: reuse the SAME getUserMedia stream MediaRecorder is using (one mic, not two).
    // fromStreamInput accepts a browser MediaStream; fall back to the default mic if unavailable.
    let ac;
    try{ ac = PRON.stream ? SDK.AudioConfig.fromStreamInput(PRON.stream) : SDK.AudioConfig.fromDefaultMicrophoneInput(); }
    catch(e){ ac = SDK.AudioConfig.fromDefaultMicrophoneInput(); }
    const pac=new SDK.PronunciationAssessmentConfig(target, SDK.PronunciationAssessmentGradingSystem.HundredMark, SDK.PronunciationAssessmentGranularity.Phoneme, true);
    try{ pac.enableProsodyAssessment=true; }catch(e){}
    const recog=new SDK.SpeechRecognizer(sc,ac); pac.applyTo(recog); PRON.recognizer=recog; PRON._scored=false;
    if(PRON.mode==="paragraph"){
      const segs=[];
      recog.recognized=(s,e)=>{ try{ if(e.result && e.result.reason===SDK.ResultReason.RecognizedSpeech && e.result.text){ segs.push(azureScoreObj(SDK, e.result)); } }catch(err){} };
      const finish=()=>{ if(PRON._scored) return; PRON._scored=true; try{recog.close();}catch(e){} gotScore(L, segs.length?aggregateAzure(segs):null); };
      recog.canceled=()=>finish();
      recog.sessionStopped=()=>finish();
      recog.startContinuousRecognitionAsync(()=>{}, ()=>{ scoreBrowser(L,target); });   // start failed → fall back
    } else {
      recog.recognizeOnceAsync(result=>{
        if(PRON._scored){ try{recog.close();}catch(e){} return; } PRON._scored=true;
        let obj=null; try{ obj=azureScoreObj(SDK, result); }catch(e){ obj=null; }
        try{recog.close();}catch(e){} gotScore(L,obj);
      }, err=>{
        if(PRON._scored){ return; } PRON._scored=true; try{recog.close();}catch(e){}
        const res=$("#pron-result"); if(res) res.innerHTML=`<div class="pron-unsupported">AI 引擎出错：${esc(String(err))}。请检查 ⚙ 里的 Key / Region（或网络）。这次先回听录音吧。</div>`;
        gotScore(L, null);
      });
    }
  }catch(e){ scoreBrowser(L,target); }
}
function aggregateAzure(segs){
  let acc=0,flu=0,comp=0,pro=0,ov=0,html="";
  segs.forEach(s=>{ acc+=s.acc; flu+=s.flu; comp+=s.comp; pro+=s.pro; ov+=s.overall; html+=s.wordsHtml; });
  const n=segs.length||1;
  return {type:"azure", overall:Math.round(ov/n), acc:Math.round(acc/n), flu:Math.round(flu/n), comp:Math.round(comp/n), pro:Math.round(pro/n), wordsHtml:html};
}
/* parse ONE Azure result → unified score obj; per-word coloring with JSON fallback (R2-3) */
function azureScoreObj(SDK, result){
  const pa=SDK.PronunciationAssessmentResult.fromResult(result);
  let json=null; try{ json=result.properties && result.properties.getProperty(SDK.PropertyId.SpeechServiceResponse_JsonResult); }catch(e){}
  let words=(pa.detailResult&&pa.detailResult.Words)||pa.words||null;
  if((!words||!words.length) && json){ try{ const nb=JSON.parse(json).NBest; if(nb&&nb[0]&&nb[0].Words) words=nb[0].Words; }catch(e){} }
  let wordsHtml="";
  if(words&&words.length){ words.forEach(w=>{ const paw=w.PronunciationAssessment||{}; const s=(paw.AccuracyScore!==undefined?paw.AccuracyScore:(w.AccuracyScore!==undefined?w.AccuracyScore:(w.accuracyScore!==undefined?w.accuracyScore:100))); const c=s>=80?"ok":(s>=50?"":"miss"); wordsHtml+=`<span class="${c}">${esc(w.Word||w.word||"")}</span>`; }); }
  else wordsHtml=esc(result.text||"");
  return {type:"azure", overall:Math.round(pa.pronunciationScore||0), acc:Math.round(pa.accuracyScore||0), flu:Math.round(pa.fluencyScore||0), comp:Math.round(pa.completenessScore||0), pro:Math.round(pa.prosodyScore||0), wordsHtml};
}
function renderResult(L){
  const res=$("#pron-result"); if(!res) return;
  const key=pronKey(), arr=PRON.history[key]||[];
  if(!arr.length){ res.innerHTML=`<div class="pron-sub">点「🎤 録音して読む」开始：读完会自动评分，并能<b>回听自己的录音</b>，和标准音对比。系统保留你最近 3 次，方便看进步。</div>`; return; }
  const a=arr[arr.length-1], d=a.data, b=scoreBand(a.score||0);
  let imp="";
  if(arr.length>=2){ const delta=(a.score||0)-(arr[arr.length-2].score||0);
    if(delta>0) imp=`<div class="pron-imp up">📈 比上次 +${delta} 分，进步了！继续保持～</div>`;
    else if(delta<0) imp=`<div class="pron-imp down">比上次低了 ${-delta} 分，别灰心，再来一次准更好。</div>`;
    else imp=`<div class="pron-imp">和上次持平，稳住，再冲一点点。</div>`;
  }
  let body="";
  if(d.type==="azure"){
    const dims=[["acc",d.acc],["flu",d.flu],["comp",d.comp],["pro",d.pro]];
    const bars=dims.map(([k,v])=>{ const bd=scoreBand(v); return `<div class="bar-row"><span class="bar-lab" title="${esc(METRIC_DEF[k][1])}">${METRIC_DEF[k][0]} ⓘ</span><div class="pbar"><i class="bf-${bd.c}" style="width:${v}%"></i></div><span class="bar-val">${v}</span></div>`; }).join("");
    body=`<div class="pron-overall ${b.c}">総合 <b>${a.score}</b> 点 · <span class="band ${b.c}">${b.t}</span></div>
      <div class="pron-bars">${bars}</div>
      <div class="pron-sub" style="margin-top:6px">逐字（绿=好 / 黄=一般 / <span class="miss">红=不准</span>，鼠标悬停指标看含义）：</div>
      <div class="pron-heard">${d.wordsHtml}</div>
      <div class="pron-interp">💡 ${azureInterpret(d)}</div>`;
  } else {
    body=`<div class="pron-overall ${b.c}">一致度 <b>${a.score}%</b> · <span class="band ${b.c}">${b.t}</span></div>
      <div class="pron-sub" title="把你读的转成文字、与原文比对的吻合度；衡量“读清楚/读对了没”，是近似值，不评语调。">一致度 ⓘ：识别一致度（近似 · 不含语调评估）</div>
      <div class="pron-sub">识别到：</div><div class="pron-heard">${d.heard?esc(d.heard):'<span class="miss">（未识别到声音）</span>'}</div>
      <div class="pron-sub">原文对照（<span class="miss">下线</span>＝没读清 / 读错）：</div><div class="pron-heard">${d.html||""}</div>
      <div class="pron-interp">💡 想要逐音素＋<b>语调</b>的精细评分，点上方「开启 AI 精评」。</div>`;
  }
  body+=`<div class="pron-playback">
    ${a.url?`<button class="pron-play mine" data-url="${a.url}">▶ 听我的录音</button>`:`<span class="pron-sub">（这次没录到音频）</span>`}
    <button class="pron-play demo" id="pb-demo">🔊 听标准示范</button></div>`;
  if(arr.length>1){
    const hist=arr.map((x,i)=>`<button class="hist-chip ${i===arr.length-1?'cur':''}" ${x.url?`data-url="${x.url}"`:''}>第${i+1}次 · ${x.data.type==='azure'?(x.score+'分'):(x.score+'%')}${x.url?' ▶':''}</button>`).join("");
    body+=`<div class="pron-sub" style="margin-top:8px">最近 ${arr.length} 次（点击回听对比）：</div><div class="pron-hist">${hist}</div>`;
  }
  body+=imp;
  res.innerHTML=body;
  res.querySelectorAll(".pron-play[data-url],.hist-chip[data-url]").forEach(el=>el.onclick=()=>{ try{ new Audio(el.dataset.url).play(); }catch(e){} });
  const demo=$("#pb-demo"); if(demo) demo.onclick=()=>speakSequence(pronTarget(L).listen);
}

/* ----------------------------- NOON ----------------------------- */
function renderNoon(L){
  const body=$("#panel-body");
  let html = `<div class="session-hint">${SESSIONS.noon.hint}</div>`;

  /* paragraph with translations shown */
  html += `<section class="block"><h2>📝 本文と訳 · 课文与翻译</h2><div class="para" id="para2"></div></section>`;

  /* vocab — cards: word + reading + 🔊 + 词性 + 释义(术语可点) + 拆解 + 例句 */
  html += `<section class="block"><h2>📚 単語 · 词汇 <span class="blk-hint">点术语看解释 · 🔊朗读 · 📝例句</span></h2>
    <div class="vcards">
    ${L.vocab.map(v=>`<div class="vcard">
      <div class="vc-head"><span class="v-word">${esc(v.w)}</span><span class="v-read">${esc(v.r)}</span><button class="play-w" data-w="${esc(v.r)}">🔊</button>${v.pos?`<span class="v-pos">${esc(v.pos)}</span>`:""}</div>
      <div class="vc-mean">${LANG==="en" ? esc(v.en||v.zh) : (linkTerms(v.zh)+(v.en?`<span class="v-en"> · ${esc(v.en)}</span>`:""))}</div>
      ${v.parts?`<div class="vc-parts"><span class="vc-tag">🧩 拆解</span>${v.parts.map(p=>`<span class="vc-part" ${p.r?`data-w="${esc(p.r)}"`:""}><b>${esc(p.p)}</b>${p.r?`<i>${esc(p.r)}</i>`:""}＝${esc(p.m)}</span>`).join('<span class="vc-plus">＋</span>')}</div>`:""}
      ${v.ex?`<div class="vc-ex" data-jp="${esc(v.ex.jp)}"><span class="vc-tag">📝 例</span>${toRuby(v.ex.jp)}<span class="zh">${esc(v.ex.zh)}</span></div>`:""}
    </div>`).join("")}
    </div></section>`;

  /* grammar */
  html += `<section class="block"><h2>🔧 文法 · 语法精讲</h2>
    ${L.grammar.map(g=>`<div class="gram">
      <h3>${esc(g.point)}</h3>
      <div class="label">${esc(g.label||"")}</div>
      <div class="exp">${linkTerms(g.zh)}</div>
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
      <ul class="ext-list">${L.extended.items.map(it=>`<li>${linkTerms(it)}</li>`).join("")}</ul></section>`;
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

  /* click handlers: play vocab + examples + conversation + 拆解 + 术语跳转 */
  body.querySelectorAll(".play-w").forEach(b=>b.onclick=()=>speakSequence([{text:b.dataset.w,node:null,audioKey:"v_"+speechNorm(b.dataset.w)}]));
  body.querySelectorAll(".ex,.conv-item,.vc-ex").forEach(el=>el.onclick=()=>speakSequence([{text:el.dataset.jp,node:el,audioKey:"x_"+speechNorm(el.dataset.jp)}]));
  body.querySelectorAll(".vc-part[data-w]").forEach(el=>el.onclick=()=>speakSequence([{text:el.dataset.w,node:null}]));
  body.querySelectorAll(".gloss").forEach(el=>el.onclick=(e)=>{ e.stopPropagation(); gotoGlossary(parseInt(el.dataset.g,10)); });
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
    STATE.day=parseInt(c.dataset.day,10); STATE.session="morning"; STATE.showZh=false; toggleMap(false); render();
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
/* make a floating element drag-anywhere; remembers position; calls onTap on a click (no drag) */
/* ---- mobile FAB launcher: collapse 🤖 + 🗒️ into one expandable button on phones ---- */
function buildFabMenu(){
  if(document.getElementById("fab-menu")) return;
  const wrap=document.createElement("div"); wrap.id="fab-menu";
  wrap.innerHTML=`<div class="fab-actions">
      <button class="fab-act" data-act="ai">🤖 <span>提问</span></button>
      <button class="fab-act" data-act="note">🗒️ <span>速记</span></button>
    </div><button class="fab-main" id="fab-main" title="工具">✦</button>`;
  document.body.appendChild(wrap);
  const setOpen=(on)=>wrap.classList.toggle("open", on);
  document.getElementById("fab-main").onclick=(e)=>{ e.stopPropagation(); setOpen(!wrap.classList.contains("open")); };
  wrap.querySelectorAll(".fab-act").forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); setOpen(false);
    if(b.dataset.act==="ai"){ window.Assistant&&window.Assistant.open(); } else { window.QuickNotes&&window.QuickNotes.open(); } });
  document.addEventListener("click",()=>setOpen(false));
}

/* ---- theme: light / dark / auto (follow system) ---- */
function getTheme(){ try{ return localStorage.getItem("jpn-theme")||"dark"; }catch(e){ return "dark"; } }
function resolvedTheme(t){ return t==="auto" ? ((window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark") : t; }
function applyTheme(t){
  const r=resolvedTheme(t);
  document.documentElement.setAttribute("data-theme", r);
  const b=$("#theme-btn");
  // header button shows the CURRENT mode's icon (☀️ light / 🌙 dark) — never 🖥, to avoid confusion.
  if(b){ b.textContent = r==="light"?"☀️":"🌙";
    b.title = (r==="light"?T("浅色模式","Light mode"):T("深色模式","Dark mode"))+(t==="auto"?T("（跟随系统）","(auto)"):"")+T("，点击切换",", click to switch"); }
}
function setTheme(t){ try{ localStorage.setItem("jpn-theme", t); }catch(e){} applyTheme(t); }
/* header quick toggle: binary flip of the CURRENT appearance — always changes in one click (auto lives in ⚙) */
function toggleLightDark(){ const r=document.documentElement.getAttribute("data-theme")||resolvedTheme(getTheme()); setTheme(r==="light"?"dark":"light"); }

function makeDraggable(el, key, onTap){
  try{ const p=JSON.parse(localStorage.getItem(key)); if(p&&p.left!=null){ el.style.left=p.left+"px"; el.style.top=p.top+"px"; el.style.right="auto"; el.style.bottom="auto"; } }catch(e){}
  let sx,sy,ox,oy,moved=false,down=false;
  const move=(e)=>{ if(!down) return; const dx=e.clientX-sx, dy=e.clientY-sy; if(Math.abs(dx)>4||Math.abs(dy)>4) moved=true;
    let nx=Math.max(4,Math.min(innerWidth-el.offsetWidth-4, ox+dx)), ny=Math.max(4,Math.min(innerHeight-el.offsetHeight-4, oy+dy));
    el.style.left=nx+"px"; el.style.top=ny+"px"; el.style.right="auto"; el.style.bottom="auto"; };
  const end=()=>{ if(!down) return; down=false; document.removeEventListener("pointermove",move); document.removeEventListener("pointerup",end);
    if(moved){ try{ localStorage.setItem(key,JSON.stringify({left:parseInt(el.style.left,10),top:parseInt(el.style.top,10)})); }catch(e){} }
    else if(onTap) onTap(); };
  el.addEventListener("pointerdown",(e)=>{ down=true; moved=false; sx=e.clientX; sy=e.clientY; const r=el.getBoundingClientRect(); ox=r.left; oy=r.top;
    document.addEventListener("pointermove",move); document.addEventListener("pointerup",end); });
}

function showPage(p){
  STATE.page=p;
  stopSpeak(); if(PRON && PRON.recording) stopRec();
  document.querySelectorAll("#page-nav button").forEach(b=>b.classList.toggle("active",b.dataset.p===p));
  $("#page-home").style.display = p==="home"?"block":"none";
  $("#page-daily").style.display = p==="daily"?"block":"none";
  $("#page-general").style.display = p==="general"?"block":"none";
  $("#page-test").style.display = p==="test"?"block":"none";
  if($("#page-notes")) $("#page-notes").style.display = p==="notes"?"block":"none";
  $("#daily-controls").style.display = p==="daily"?"flex":"none";
  if(p!=="daily"){ $("#map-view").classList.remove("show"); $("#day-num").textContent=""; }
  localStorage.setItem("jpn-page",p);
  if(p==="home") renderHome();
  else if(p==="daily") render();
  else if(p==="general") renderGeneral();
  else if(p==="test") renderTestHome();
  else if(p==="notes" && window.Notes) window.Notes.renderPage();
  if(window.Assistant && window.Assistant.refreshCtx) window.Assistant.refreshCtx();  // R3-2: keep AI panel ctx fresh
  window.scrollTo(0,0);
}

/* ============================================================================
 *  HOME (personalized dashboard)
 * ==========================================================================*/
function getName(){ try{ return (localStorage.getItem("jpn-name")||"").trim(); }catch(e){ return ""; } }
function nextStudyDay(){           // frontier: first day not fully complete (else last day)
  for(const l of LESSONS){ const p=PROG[l.day]||{}; if(!(p.morning&&p.noon&&p.night)) return l.day; }
  return LESSONS.length;
}
function dayOfYear(){
  const n=new Date(), s=new Date(n.getFullYear(),0,0);
  return Math.floor((n-s)/86400000);
}
function heatmapHTML(){
  let cells="";
  LESSONS.forEach(l=>{ const p=PROG[l.day]||{}; const c=["morning","noon","night"].filter(s=>p[s]).length;
    cells+=`<div class="hm-cell lv${c}" data-day="${l.day}" title="Day ${l.day}：${c}/3 完成">${l.day}</div>`; });
  return `<div class="hm-grid">${cells}</div>
    <div class="hm-legend">每天完成数：<span class="hm-cell lv0">0</span><span class="hm-cell lv1">1</span><span class="hm-cell lv2">2</span><span class="hm-cell lv3">3</span> · 点格子跳到那天</div>`;
}

function renderHome(){
  const c=$("#page-home");
  const name=getName(), streak=computeStreak();
  const N=nextStudyDay(), L=lessonByDay(N);
  const allDone = N===LESSONS.length && (()=>{const p=PROG[N]||{};return p.morning&&p.noon&&p.night;})();
  const prevDay = N>1 ? N-1 : null, Lprev = prevDay ? lessonByDay(prevDay) : null;
  // "继续学习" resumes the EXACT spot you left (day + sub-session), not always morning (user feedback #4)
  const SESSION_LABEL={morning:"朝の朗読",noon:"昼の理解",night:"夜の反思"};
  let rDay=parseInt(localStorage.getItem("jpn-last-day")||"0",10); if(!(rDay>=1&&rDay<=LESSONS.length)) rDay=N;
  let rSess=localStorage.getItem("jpn-last-session")||"morning"; if(!SESSION_LABEL[rSess]) rSess="morning";
  const Lr=lessonByDay(rDay);
  const ph = DAILY_PHRASES[dayOfYear() % DAILY_PHRASES.length];

  // --- stats ---
  let done=0,vocabL=0,gramL=0;
  LESSONS.forEach(l=>{ const p=PROG[l.day]||{}; done+=["morning","noon","night"].filter(s=>p[s]).length; if(p.noon){ vocabL+=(l.vocab||[]).length; gramL+=(l.grammar||[]).length; } });
  const total=LESSONS.length*3, best=loadTestBest();

  // --- to-do for current day ---
  const p=PROG[N]||{};
  let todo="";
  [["morning","🌅 朝の朗読（听 & 跟读）"],["noon","☀️ 昼の理解（词汇 & 语法）"],["night","🌙 夜の反思（抄写 & 反思）"]].forEach(([s,label])=>{
    todo+=`<li class="${p[s]?'tdone':''}" data-go="day:${N}:${s}"><span class="tk-box">${p[s]?'✓':''}</span><span>Day ${N} · ${label}</span></li>`;
  });
  if(prevDay) todo+=`<li data-go="day:${prevDay}:morning"><span class="tk-box rv">↻</span><span>复习 Day ${prevDay}：朗读一遍、再听一次音频</span></li>`;
  if(prevDay && prevDay%7===0){ const tid=prevDay/7; if(tid>=1&&tid<=4) todo+=`<li data-go="test"><span class="tk-box rv">📝</span><span>第${tid}周学完了——做 模試${tid} 检验一下</span></li>`; }

  const seenIntro = (()=>{ try{ return localStorage.getItem("jpn-seen-intro")==="1"; }catch(e){ return true; } })();
  const introBanner = seenIntro ? "" : `
    <div class="home-intro" id="home-intro">
      <button class="hi-close" id="hi-close" title="知道了">✕</button>
      <h2>👋 欢迎！这里有几样趁手的工具</h2>
      <div class="hi-items">
        <span>🔊 <b>真人音色</b>：课文/单词都能点朗读，⚙ 里可换不同声音</span>
        <span>🤖 <b>AI 提问</b>：右下角随时问任何日语问题（需在 ⚙ 填 Claude Key）</span>
        <span>🗒️ <b>速记本</b>：学习时随手记，自动保存，可存成笔记</span>
        <span>☀️ <b>浅/深色</b>：右上角一键切换主题</span>
      </div>
      <button class="hi-ok" id="hi-ok">知道了，开始学习 →</button>
    </div>`;
  c.innerHTML=introBanner+`
    <div class="home-hero">
      <div class="hh-top">
        <div class="greet">おかえりなさい${name?('、<b>'+esc(name)+'</b>'):''}！<span class="hh-sub">${toRuby("続[つづ]けることが、何[なに]より大切[たいせつ]です。")}</span></div>
        <div class="hh-streak">🔥 <b>${streak}</b> 日連続</div>
      </div>
      ${ allDone
        ? `<div class="continue-cta done"><span class="cc-main">🎉 30 天全部完成！</span><small>復習やテストで仕上げよう · 点此回顾</small></div>`
        : `<button class="continue-cta" data-go="day:${rDay}:${rSess}"><span class="cc-main">▶ 继续学习 · Day ${rDay} · ${SESSION_LABEL[rSess]}</span><small>${esc(Lr.theme)}</small></button>` }
    </div>

    <div class="home-grid">
      <section class="home-card">
        <h2>💬 每日一句</h2>
        <div class="phrase-jp" data-jp="${esc(ph.jp)}">${toRuby(ph.jp)} <button class="phrase-play" title="朗读">🔊</button></div>
        <div class="phrase-zh">${esc(ph.zh)}</div>
        <div class="phrase-note">${esc(ph.note)}</div>
        <div class="phrase-ex" data-jp="${esc(ph.ex.jp)}">「${toRuby(ph.ex.jp)}」<span class="zh">${esc(ph.ex.zh)}</span></div>
      </section>

      <section class="home-card">
        <h2>📌 ${prevDay?`昨日の復習 · Day ${prevDay}`:'はじめの一歩'}</h2>
        ${ Lprev ? `
          <div class="rv-theme">${esc(Lprev.theme)}</div>
          <div class="rv-label">要记牢的语法点：</div>
          <ul class="rv-list">${(Lprev.grammar||[]).slice(0,4).map(g=>`<li>${esc(g.point)}</li>`).join("")}</ul>
          <div class="rv-label">重点词：</div>
          <div class="rv-vocab">${(Lprev.vocab||[]).slice(0,6).map(v=>`<span data-jp="${esc(v.r)}">${esc(v.w)}<i>${esc(v.r)}</i></span>`).join("")}</div>
          <button class="rv-go" data-go="day:${prevDay}:noon">↻ 打开 Day ${prevDay} 复习</button>
        ` : `<p class="hc-empty">还没有学过的内容。从今天的 Day ${N} 开始你的第一步吧！每天坚持，30 天后回头看，你会惊讶于自己的变化。</p>` }
      </section>

      <section class="home-card">
        <h2>✅ 今日のタスク</h2>
        <ul class="todo-list">${todo}</ul>
      </section>

      ${window.Notes ? window.Notes.homeCardHTML() : ""}
    </div>

    <section class="home-card">
      <h2>🗓️ 30 天全景</h2>
      ${heatmapHTML()}
    </section>

    <section class="home-card">
      <h2>📊 我的数据</h2>
      <div class="dash-stats">
        <div class="stat big"><div class="num">🔥 ${streak}</div><div class="lbl">连续学习天数</div></div>
        <div class="stat"><div class="num">${done}<span style="font-size:.5em;color:var(--ink-faint)">/${total}</span></div><div class="lbl">完成的小节</div></div>
        <div class="stat"><div class="num">${vocabL}</div><div class="lbl">已学词条</div></div>
        <div class="stat"><div class="num">${gramL}</div><div class="lbl">已学语法点</div></div>
      </div>
      <div class="dash-stats" style="margin-top:6px">${TESTS.map(t=>{const b=best[t.id];return `<div class="stat"><div class="num" style="font-size:1.3rem">${b?Math.round(b.score/b.total*100)+'%':'—'}</div><div class="lbl">${esc(t.title.split('—')[0].trim())}</div></div>`;}).join("")}</div>
    </section>`;

  // --- wire interactions ---
  const dismissIntro=()=>{ try{ localStorage.setItem("jpn-seen-intro","1"); }catch(e){} const b=$("#home-intro"); if(b) b.remove(); };
  if($("#hi-close")) $("#hi-close").onclick=dismissIntro;
  if($("#hi-ok")) $("#hi-ok").onclick=dismissIntro;
  c.querySelectorAll("[data-go]").forEach(el=>el.onclick=()=>{
    const g=el.dataset.go;
    if(g==="test"){ showPage("test"); return; }
    const m=g.match(/^day:(\d+):(\w+)$/);
    if(m){ STATE.day=parseInt(m[1],10); STATE.session=m[2]; if(m[2]==="morning") STATE.showZh=false; showPage("daily"); }
  });
  c.querySelectorAll(".hm-cell[data-day]").forEach(el=>el.onclick=()=>{ STATE.day=parseInt(el.dataset.day,10); STATE.session="morning"; STATE.showZh=false; showPage("daily"); });
  const pj=$(".phrase-jp"), pp=$(".phrase-play"), pe=$(".phrase-ex");
  if(pp) pp.onclick=(e)=>{ e.stopPropagation(); speakSequence([{text:ph.jp,node:null}]); };
  if(pe) pe.onclick=()=>speakSequence([{text:ph.ex.jp,node:null}]);
  c.querySelectorAll(".rv-vocab span[data-jp]").forEach(el=>el.onclick=()=>speakSequence([{text:el.dataset.jp,node:null}]));
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
      <section><h3>${T("🌐 讲解语言 / Language","🌐 Explanation language")}</h3>
        <p class="m-note">${T("选择你的母语——所有讲解会用这个语言显示（日语原文不变）。","Choose your native language — all explanations switch to it (the Japanese itself never changes).")}</p>
        <div class="theme-pick" id="lang-pick">
          ${[["zh","🇨🇳 中文"],["en","🇬🇧 English"]].map(([v,l])=>`<button data-lang-val="${v}" class="${getLang()===v?"on":""}">${l}</button>`).join("")}
        </div>
      </section>
      <section><h3>${T("🎨 外观 / テーマ","🎨 Appearance")}</h3>
        <p class="m-note">${T("选浅色或深色主题（也可跟随系统）。页眉那个 ☀️/🌙 按钮也能一键切换。","Pick a light or dark theme (or follow the system). The ☀️/🌙 button in the header also toggles it.")}</p>
        <div class="theme-pick" id="theme-pick">
          ${[["light",T("☀️ 浅色","☀️ Light")],["dark",T("🌙 深色","🌙 Dark")],["auto",T("🖥 跟随系统","🖥 System")]].map(([v,l])=>`<button data-theme-val="${v}" class="${getTheme()===v?"on":""}">${l}</button>`).join("")}
        </div>
      </section>
      <section><h3>👤 你的名字（可选）</h3>
        <p class="m-note">填了之后，主页会用它跟你打招呼（おかえりなさい、…！）。只存在本机浏览器。</p>
        <label>名字 / Name <input type="text" id="usr-name" value="${esc(getName())}" placeholder="例如 Bob / 王"></label>
        <div class="m-actions"><button id="name-save" class="primary">保存</button><span id="name-status" class="m-note"></span></div>
      </section>
      ${window.Assistant?window.Assistant.settingsHTML():""}
      <section><h3>🎤 发音评估引擎</h3>
        <p class="m-note">不填则用浏览器识别（近似）。填入 Azure 语音服务的 <b>Key + Region</b> 可获得逐音素＋语调评分（免费层每月 5 小时）。仅存于本机浏览器，不上传。</p>
        <label>Azure Key <input type="password" id="az-key" value="${esc(cfg.key||"")}" placeholder="Speech 资源的密钥"></label>
        <label>Region <input type="text" id="az-region" value="${esc(cfg.region||"")}" placeholder="如 japaneast / eastus"></label>
        <div class="m-actions"><button id="az-test" class="primary">🔌 测试连接</button><button id="az-save">保存</button><button id="az-clear">清除</button><span id="az-status" class="m-note"></span></div>
        <div class="conn-status" id="az-conn"></div>
      </section>
      <section><h3>💾 进度备份</h3>
        <p class="m-note">进度只存在本机浏览器，清缓存就会丢。考前建议导出一份。</p>
        <div class="m-actions"><button id="exp-prog" class="primary">导出进度 JSON</button><button id="imp-prog">导入进度…</button><input type="file" id="imp-file" accept="application/json" style="display:none"><span id="bk-status" class="m-note"></span></div>
      </section>
      <section><h3>🎙️ 声音模型 / Voice</h3>
        <p class="m-note">选择朗读用的声音。每个角色都有「普通版」和「有意思版」，切换后全站真人语音都会用它。</p>
        <label>声音 <select id="voice-sel">${voiceOptionsHTML()}</select></label>
        <p class="m-note" id="voice-desc"></p>
        <div class="m-actions"><button id="voice-demo">▶ 试听</button><span id="voice-status" class="m-note"></span></div>
      </section>
      <section><h3>🔊 真人音频（VOICEVOX）</h3>
        <p class="m-note">${Object.keys(AUDIO_MANIFEST).length?`已加载 <b>${Object.keys(AUDIO_MANIFEST).length}</b> 条预生成音频 ✓`:"当前使用系统 TTS（机械音）。"} 要新增声音：启动 VOICEVOX（或 AivisSpeech）引擎后运行 <code>python3 tools/gen_audio.py --voice-dir &lt;名字&gt; --speaker &lt;id&gt;</code>，再在 <code>audio/voices.js</code> 注册即可（详见 README）。需通过本地服务器打开。</p>
      </section>
    </div></div>`;
  $("#modal-close").onclick=closeSettings;
  ov.onclick=(e)=>{ if(e.target===ov) closeSettings(); };
  $("#theme-pick").querySelectorAll("button").forEach(b=>b.onclick=()=>{ setTheme(b.dataset.themeVal); $("#theme-pick").querySelectorAll("button").forEach(x=>x.classList.toggle("on", x===b)); });
  $("#lang-pick").querySelectorAll("button").forEach(b=>b.onclick=()=>{ if(getLang()===b.dataset.langVal) return; setLang(b.dataset.langVal); showPage(STATE.page); openSettings(); });
  $("#name-save").onclick=()=>{ const v=$("#usr-name").value.trim(); if(v) localStorage.setItem("jpn-name",v); else localStorage.removeItem("jpn-name"); $("#name-status").textContent="已保存 ✓"; };
  $("#az-save").onclick=()=>{ const key=$("#az-key").value.trim(), region=$("#az-region").value.trim(); if(key&&region){ localStorage.setItem("jpn-azure-cfg",JSON.stringify({key,region})); $("#az-status").textContent="已保存 ✓ 发音评估将用 Azure"; } else { $("#az-status").textContent="Key 和 Region 都要填"; } };
  $("#az-clear").onclick=()=>{ localStorage.removeItem("jpn-azure-cfg"); $("#az-key").value=""; $("#az-region").value=""; $("#az-status").textContent="已清除，将用浏览器识别"; const cc=$("#az-conn"); if(cc){ cc.className="conn-status"; cc.textContent=""; } };
  if($("#az-test")) $("#az-test").onclick=()=>testAzureConn();
  $("#exp-prog").onclick=exportProgress;
  $("#imp-prog").onclick=()=>$("#imp-file").click();
  $("#imp-file").onchange=importProgress;
  if(window.Assistant) window.Assistant.bindSettings();
  // voice picker
  const vdesc=()=>{ const v=VOICES.find(x=>x.id===$("#voice-sel").value)||VOICES[0]; if($("#voice-desc")) $("#voice-desc").textContent=v?v.desc||"":""; };
  if($("#voice-sel")){
    vdesc();
    $("#voice-sel").onchange=()=>{ setVoice($("#voice-sel").value); vdesc(); $("#voice-status").textContent="已切换 ✓"; };
    $("#voice-demo").onclick=()=>{ stopSpeak(); $("#voice-status").textContent="试听中…"; speakSequence([{text:"日本語[にほんご]を勉強[べんきょう]しています。",node:null,audioKey:"d1_s1"}]).then(()=>{ if($("#voice-status")) $("#voice-status").textContent=""; }); };
  }
}
function closeSettings(){ const ov=$("#modal-overlay"); ov.style.display="none"; ov.innerHTML=""; }
function exportProgress(){
  const keys=["jpn-n2-progress","jpn-test-best","jpn-last-day","jpn-last-session","jpn-page","jpn-active-dates","jpn-name","jpn-notes"];
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
      if(window.Notes && window.Notes.reload) window.Notes.reload();
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
    if(b.t==="why") return `<div class="r-why"><span class="r-why-tag">🤔 为什么</span>${rubyMd(b.zh)}</div>`;
    if(b.t==="analogy") return `<div class="r-analogy"><span class="r-an-tag">🔗 类比</span>${rubyMd(b.zh)}</div>`;
    if(b.t==="note") return `<div class="r-note">${rubyMd(b.zh)}</div>`;
    if(b.t==="rules") return `<ul class="r-rules">${b.items.map(it=>`<li>${rubyMd(it)}</li>`).join("")}</ul>`;
    if(b.t==="ex") return b.items.map(e=>`<div class="r-ex" data-jp="${esc(e.jp)}">${toRuby(e.jp)}<span class="zh">${esc(e.zh)}</span></div>`).join("");
    if(b.t==="table") return `<div class="r-table-wrap"><table class="r-table"><thead><tr>${b.head.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${b.rows.map(r=>`<tr>${r.map(c=>`<td>${toRuby(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    return "";
  }).join("");
}
/* ---- term glossary + auto-linker (用户反馈 #2b/2c): 把 自動詞/な形容詞/音便 等术语在词义里变成可点的解释 ---- */
const GLOSSARY = [
  {term:"自動詞", aliases:["自動詞","自动词"], def:"自动词（intransitive）：动作不带宾语、表示主体自身的变化或动作，如 開[あ]く・始[はじ]まる・変[か]わる。多与「が」搭配。↔ 他动词。"},
  {term:"他動詞", aliases:["他動詞","他动词"], def:"他动词（transitive）：动作作用于宾语，需要「を」，如 開[あ]ける・始[はじ]める・変[か]える。很多自他成对：開く↔開ける。"},
  {term:"な形容詞", aliases:["な形容詞","な形容词","な形"], def:"な形容词（也叫“形容动词”）：修饰名词时加「な」（静[しず]かな町[まち]），更像名词，要靠 だ／な／です 撑。"},
  {term:"い形容詞", aliases:["い形容詞","い形容词","い形"], def:"い形容词：以「い」结尾，会自己变时态（高[たか]い→高[たか]かった），更像动词。"},
  {term:"可能形", aliases:["可能形"], def:"可能形：表示“能/会做”。書[か]く→書[か]ける、食[た]べる→食[た]べられる、する→できる。"},
  {term:"受身形", aliases:["受身形","受身"], def:"受身（被动）：“被…”。書[か]く→書[か]かれる、食[た]べる→食[た]べられる；施动者用「に」。"},
  {term:"使役形", aliases:["使役形","使役"], def:"使役：“让/使…做”。書[か]く→書[か]かせる、食[た]べる→食[た]べさせる。"},
  {term:"使役受身", aliases:["使役受身"], def:"使役受身：“被迫做”（不情愿）。書[か]く→書[か]かされる、食[た]べる→食[た]べさせられる。"},
  {term:"音便", aliases:["音便"], def:"音便：为了顺口发生的音变，主要在第1组动词的 て形/た形：書[か]く→書[か]いて、飲[の]む→飲[の]んで、話[はな]す→話[はな]して。详见“动词的活用”。"}
];
let _glossRe=null, _glossMap=null;
function glossRegex(){
  if(_glossRe) return _glossRe;
  _glossMap={}; const all=[];
  GLOSSARY.forEach((g,i)=>g.aliases.forEach(a=>{ _glossMap[a]=i; all.push(a); }));
  all.sort((a,b)=>b.length-a.length);            // longest first → 使役受身 before 受身
  _glossRe=new RegExp("("+all.join("|")+")","g");
  return _glossRe;
}
function linkTerms(text){
  if(text==null) return "";
  return esc(String(text)).replace(glossRegex(), m=>{ const i=_glossMap[m]; const def=GLOSSARY[i].def.replace(/\[[^\]]+\]/g,""); return `<span class="gloss" data-g="${i}" title="${esc(def)}">${m}</span>`; });
}
function glossarySection(){
  const items=GLOSSARY.map((g,i)=>`<div class="gloss-item" id="gloss-${i}"><b>${esc(g.term)}</b> ${rubyMd(g.def)}</div>`).join("");
  return `<div class="ref-section" data-id="glossary">
    <div class="ref-head"><span class="r-emoji">📖</span><h2>语法术语小词典 <span class="r-zh">自動詞 / な形容詞 / 音便… 在单词页点这些术语会跳到这里</span></h2><span class="r-arrow">▸</span></div>
    <div class="ref-body">${items}</div></div>`;
}
function gotoGlossary(idx){
  showPage("general");
  setTimeout(()=>{
    const sec=document.querySelector('#page-general .ref-section[data-id="glossary"]');
    if(!sec) return; sec.classList.add("open");
    const it=(idx!=null)?document.getElementById("gloss-"+idx):null;
    (it||sec).scrollIntoView({behavior:"smooth",block:"center"});
    if(it){ it.classList.add("flash"); setTimeout(()=>it.classList.remove("flash"),1600); }
  },70);
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
  html+=glossarySection();
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
  applyTheme(getTheme());
  buildFabMenu();
  if($("#theme-btn")) $("#theme-btn").onclick=toggleLightDark;
  if(window.matchMedia){ try{ matchMedia("(prefers-color-scheme: light)").addEventListener("change",()=>{ if(getTheme()==="auto") applyTheme("auto"); }); }catch(e){} }
  document.querySelectorAll("#page-nav button").forEach(b=>b.onclick=()=>showPage(b.dataset.p));

  // pre-generated audio manifest (VOICEVOX). Prefer the <script>-loaded global
  // (works on file:// too); else fetch the JSON (http only). Absent → {} → TTS fallback.
  if(typeof window!=="undefined" && window.AUDIO_MANIFEST){
    AUDIO_MANIFEST = window.AUDIO_MANIFEST;
  } else if(typeof fetch==="function" && location.protocol!=="file:"){
    fetch("audio/manifest.json").then(r=>r.ok?r.json():{}).then(m=>{ AUDIO_MANIFEST=m||{}; }).catch(()=>{ AUDIO_MANIFEST={}; });
  }
  // voice models (registry script-loaded). Always include a built-in default first.
  VOICES = (typeof window!=="undefined" && Array.isArray(window.VOICES) && window.VOICES.length)
    ? window.VOICES
    : [{id:"default",name:"标准",tag:"标准",desc:"标准声音。",prefix:"audio/"}];
  setVoice(currentVoiceId());
  setHeaderVar();
  window.addEventListener("resize", setHeaderVar);

  showPage("home");               // always land on the personalized home (it has the "continue Day N" CTA)
  setTimeout(setHeaderVar,300);   // after fonts/layout settle
}
document.addEventListener("DOMContentLoaded",init);
