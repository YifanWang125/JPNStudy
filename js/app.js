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
  rate: 1.0,                 // natural speed for the real voice; the global speed lever scales all playback
};
try{ const r=parseFloat(localStorage.getItem("jpn-rate")); if(r>=0.5&&r<=1.5) STATE.rate=r; }catch(e){}
/* ONE global speed lever for all playback (audio playbackRate + TTS rate). Persisted,
   and reflected in every speed control on the page (settings slider + scenarios lever). */
function setRate(v){
  STATE.rate=Math.max(0.5,Math.min(1.5,v));
  try{ localStorage.setItem("jpn-rate", STATE.rate); }catch(e){}
  document.querySelectorAll(".speed-range").forEach(el=>{ el.value=STATE.rate; });
  document.querySelectorAll(".speed-val").forEach(el=>{ el.textContent=STATE.rate.toFixed(2)+"×"; });
  if(CURRENT_AUDIO){ try{ CURRENT_AUDIO.playbackRate=STATE.rate; }catch(e){} }  // apply live mid-playback
}
/* ---------- i18n: explanation language (learner's native language) ---------- */
function getLang(){ try{ const l=localStorage.getItem("jpn-lang"); return (l==="en"||l==="ja")?l:"zh"; }catch(e){ return "zh"; } }
let LANG = getLang();
try{ window.LANG = LANG; }catch(e){}   // expose to modules (pet/exercises/gojuon read window.LANG)
function setLang(l){ LANG=(l==="en"||l==="ja")?l:"zh"; try{ window.LANG=LANG; }catch(e){} try{ localStorage.setItem("jpn-lang", LANG); }catch(e){} }
/* nav labels per language: [zh, en, ja] */
const NAV_LABELS={ home:["主页","Home","ホーム"], daily:["每日","Daily","毎日"], general:["基础","Basics","基礎"], scenarios:["场景","Scenes","場面"], test:["测试","Tests","テスト"], produce:["产出","Output","アウトプット"], notes:["笔记","Notes","ノート"] };
function applyLang(){
  const ix=LANG==="en"?1:(LANG==="ja"?2:0);
  document.querySelectorAll("#page-nav button").forEach(b=>{ const l=NAV_LABELS[b.dataset.p], s=b.querySelector(".pnl"); if(l&&s) s.textContent=" "+(l[ix]||l[0]); });
  document.documentElement.setAttribute("lang", LANG);
  const fm=document.getElementById("footer-motto"); if(fm) fm.textContent={en:"· a little every day, one step at a time.",ja:"· 毎日少しずつ、一歩ずつ。",zh:"· 每天一点点，一步一步来。"}[LANG];
  const fn=document.getElementById("footer-note"); if(fn) fn.textContent={
    en:"Progress is saved in this browser · real-voice audio (VOICEVOX), falls back to system TTS · open via a local server (localhost) for recording & pronunciation scoring",
    ja:"学習データはこのブラウザに保存されます · 音声は VOICEVOX（無い場合はシステム音声）· 録音と発音採点はローカルサーバー（localhost）で開いてください",
    zh:"进度自动保存在本机浏览器 · 真人音频(VOICEVOX)，缺失时回退系统语音 · 录音与发音评估请用本地服务器(localhost)打开"}[LANG];
}
/* UI string: T("中文","English"). zh by default; en in en-mode; in ja-mode use the Japanese
   override (window.JA_UI keyed by the English) and fall back to English, then Chinese. */
function T(zh, en){
  if(LANG==="ja"){ if(en!=null && window.JA_UI && window.JA_UI[en]!=null) return window.JA_UI[en]; return en!=null?en:zh; }
  return (LANG==="en" && en!=null) ? en : zh;
}
/* data field (lesson explanations etc.): English in en- AND ja-mode (the study materials'
   paired explanations show English for Japanese staff); Chinese otherwise. */
function zhen(zh, en){ return ((LANG==="en"||LANG==="ja") && en!=null && en!=="") ? en : (zh!=null?zh:""); }
/* English lesson content (js/i18n-en.js); ENL(day) → that day's en fields or {} */
function ENL(day){ return (typeof window!=="undefined" && window.EN && window.EN[day]) || {}; }
/* English data for tests (window.EN_TESTS[id]) */
function ENT(id){ return (typeof window!=="undefined" && window.EN_TESTS && window.EN_TESTS[id]) || {}; }
const CAT_EN={ "文法":"Grammar","語彙":"Vocabulary","読解":"Reading" };
/* part-of-speech labels → English */
const POS_EN={ "名詞":"noun","動詞":"verb","自動詞":"intransitive verb","他動詞":"transitive verb","な形容詞":"na-adjective","い形容詞":"i-adjective","副詞":"adverb","助詞":"particle","接続詞":"conjunction","接続助詞":"conjunctive particle","連体詞":"adnominal","感動詞":"interjection","補助動詞":"auxiliary verb","代名詞":"pronoun","連語":"phrase","慣用句":"idiom","表現":"expression","接尾":"suffix","接頭":"prefix","接尾辞":"suffix","形容動詞":"na-adjective","数詞":"numeral","する動詞":"suru-verb" };
function posLabel(pos){ if(!pos) return ""; if(LANG!=="en") return pos;
  if(POS_EN[pos]) return POS_EN[pos];
  return pos.replace(/[（(]([^）)]*)[）)]/g,(m,inner)=>"("+(POS_EN[inner]||inner)+")")   // e.g. 自動詞（する）
    .replace(/名詞|動詞|自動詞|他動詞|な形容詞|い形容詞|副詞|助詞|複合|する|词组|動詞词组/g,x=>({"名詞":"noun","動詞":"verb","自動詞":"intransitive","他動詞":"transitive","な形容詞":"na-adj","い形容詞":"i-adj","副詞":"adverb","助詞":"particle","複合":"compound","する":"suru","词组":"phrase","動詞词组":"verb phrase"}[x]||x)); }

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const SESSIONS = {
  morning:{ emoji:"🌅", name:"朝の朗読", sub:"Morning · 读 & 跟读", subEn:"Morning · Read & Shadow", hint:"专注「读」。先听标准发音，再跟读。默认隐藏译文——这一节只练读音和节奏，听不懂没关系。", hintEn:"Focus on READING. Listen to the model audio, then shadow it. Translations are hidden by default — this session is just about sound and rhythm; it's fine not to understand yet." },
  noon:   { emoji:"☀️", name:"昼の理解", sub:"Noon · 懂 & 学语法", subEn:"Noon · Understand & Grammar", hint:"现在弄懂意思。对照译文，记单词，吃透今天的语法点，看它们怎么用在日常对话里。", hintEn:"Now understand it. Use the translations, learn the vocab, master today's grammar points, and see how they're used in everyday conversation." },
  night:  { emoji:"🌙", name:"夜の反思", sub:"Night · 写 & 反思", subEn:"Night · Write & Reflect", hint:"抄写与默写。先用「输入核对」练打字与假名，再用「遮挡默写」凭记忆复述，最后回答反思问题。", hintEn:"Copy and recall. First use Type & Check to practice typing the kana, then Hide & Recall to reproduce it from memory, and finally answer the reflection questions." },
};

/* ---------- localStorage progress ---------- */
const PKEY = "jpn-n2-progress";
function loadProg(){ try{ return JSON.parse(localStorage.getItem(PKEY))||{}; }catch(e){ return {}; } }
function saveProg(p){ localStorage.setItem(PKEY, JSON.stringify(p)); }
let PROG = loadProg();      // { "3":{morning:true,noon:false,night:true}, ... }
function dayDone(day){ const d=PROG[day]; return d && d.morning && d.noon && d.night; }
function markSession(day,session,val){
  PROG[day]=PROG[day]||{}; PROG[day][session]=val; saveProg(PROG);
  if(val){ recordActivity(); if(window.Pet) Pet.onStudy(); }   // feed the pet's study XP
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
/* esc() for ATTRIBUTE values — also escapes quotes so user text can't break out of value="…"
   (H1: prevents stored-XSS via note titles / names / AI text placed in double-quoted attrs). */
function escAttr(s){ return esc(String(s==null?"":s)).replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
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
  const vs = speechSynthesis.getVoices().filter(v=>/^ja\b|ja[-_]JP/i.test(v.lang));
  // prefer a natural/female voice over the robotic male default (e.g. macOS "Otoya").
  const score=v=>{ const n=(v.name||"").toLowerCase();
    if(/otoya|hattori|男/.test(n)) return -2;                 // known robotic/male → avoid
    if(/(premium|enhanced|neural|siri)/.test(n)) return 3;     // high-quality variants
    if(/kyoko|o-?ren|sora|haruka|nanami|女/.test(n)) return 2; // pleasant female voices
    return 0; };
  JA_VOICE = vs.slice().sort((a,b)=>score(b)-score(a))[0] || null;
}
/* System-TTS fallback is OFF by default — the user disliked the robotic system voice,
   and lessons/vocab/examples/scenarios/每日一句 are all covered by VOICEVOX audio.
   A ⚙ toggle (jpn-tts="1") re-enables it for any clip without a generated file. */
function ttsFallbackOn(){ try{ return localStorage.getItem("jpn-tts")==="1"; }catch(e){ return false; } }
function noAudioFlash(node){ if(node){ node.classList.add("no-audio"); setTimeout(()=>node.classList.remove("no-audio"),600); } }
/* fallback when a pre-generated clip is missing: TTS only if the user opted in,
   otherwise a brief visual flash so a tap never feels "broken". */
function fallbackSpeak(text,node){ return ttsFallbackOn() ? ttsOne(text,node) : (noAudioFlash(node), Promise.resolve()); }
if("speechSynthesis" in window){
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}
let AUDIO_MANIFEST = {};          // { "d1_s0": "audio/d1_s0.mp3", ... }
let CURRENT_AUDIO = null;
let SPEAK_TOKEN = 0;              // cancels sequential playback
let SPEAK_PAUSED = false;        // pause/resume for sequence playback (vs. stop = clear)
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
  if(!src) return fallbackSpeak(item.text, item.node);
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
        else { done=true; unhighlight(); fallbackSpeak(item.text, item.node).then(res); }  // last resort (opt-in TTS)
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

/* STOP: clear everything — cancels the sequence; next play starts from the top. */
function stopSpeak(){
  SPEAK_TOKEN++;
  if("speechSynthesis" in window) speechSynthesis.cancel();
  if(CURRENT_AUDIO){ try{ CURRENT_AUDIO.pause(); }catch(e){} CURRENT_AUDIO=null; }
  clearHighlight();
  hidePlayCtl();
}
/* PAUSE: freeze in place — the sequence loop is parked on its `await playOne`; pausing the
   current clip just delays its onended, so resume() continues the very same sentence. */
function pauseSpeak(){
  if(SPEAK_PAUSED) return; SPEAK_PAUSED=true;
  try{ if(CURRENT_AUDIO) CURRENT_AUDIO.pause(); }catch(e){}
  try{ if("speechSynthesis" in window) speechSynthesis.pause(); }catch(e){}
  updatePlayCtl();
}
function resumeSpeak(){
  if(!SPEAK_PAUSED) return; SPEAK_PAUSED=false;
  try{ if(CURRENT_AUDIO) CURRENT_AUDIO.play().catch(()=>{}); }catch(e){}
  try{ if("speechSynthesis" in window) speechSynthesis.resume(); }catch(e){}
  updatePlayCtl();
}
/* floating pause/stop bar — shown only for multi-item (continuous) playback. Reusable: it
   appears for ANY speakSequence of length>1 (scenario play-all, paragraph read, noon listen). */
function playCtlEl(){
  let b=document.getElementById("play-ctl");
  if(!b){
    b=document.createElement("div"); b.id="play-ctl"; b.className="play-ctl";
    b.innerHTML=`<span class="pc-label">🔊 <span id="pc-text"></span></span>`+
      `<button id="pc-pause" class="pc-btn"></button>`+
      `<button id="pc-stop" class="pc-btn pc-stop"></button>`;
    document.body.appendChild(b);
    b.querySelector("#pc-pause").onclick=()=>{ SPEAK_PAUSED ? resumeSpeak() : pauseSpeak(); };
    b.querySelector("#pc-stop").onclick=()=>{ stopSpeak(); };
  }
  return b;
}
function updatePlayCtl(){
  const t=document.getElementById("pc-text"); if(t) t.textContent=SPEAK_PAUSED?T("已暂停","Paused"):T("播放中","Playing");
  const p=document.getElementById("pc-pause"); if(p) p.textContent=SPEAK_PAUSED?("▶ "+T("继续","Resume")):("⏸ "+T("暂停","Pause"));
  const s=document.getElementById("pc-stop"); if(s) s.textContent="⏹ "+T("停止","Stop");
}
function showPlayCtl(){ const b=playCtlEl(); updatePlayCtl(); b.classList.add("show"); }
function hidePlayCtl(){ const b=document.getElementById("play-ctl"); if(b) b.classList.remove("show"); SPEAK_PAUSED=false; }
/* play sentences in sequence, highlighting nodes; audio or TTS per item */
async function speakSequence(items){
  stopSpeak();
  const token = ++SPEAK_TOKEN;
  const seq = items.length>1;            // controls only make sense for continuous playback
  if(seq) showPlayCtl();
  for(const it of items){
    if(token!==SPEAK_TOKEN) break;
    await playOne(it);
  }
  if(token===SPEAK_TOKEN){ clearHighlight(); hidePlayCtl(); }
}
function clearHighlight(){ document.querySelectorAll(".speaking").forEach(n=>n.classList.remove("speaking")); }
function audioKeyFor(day, idx){ return "d"+day+"_s"+idx; }

/* ---------- helpers ---------- */
function lessonByDay(d){ return LESSONS.find(l=>l.day===d); }
const $ = sel => document.querySelector(sel);

/* ============================================================================
 *  RENDER
 * ==========================================================================*/
function render(){
  stopSpeak();
  if(!lessonByDay(STATE.day)) STATE.day=Math.min(Math.max(1,STATE.day||1),TOTAL_DAYS);  // R6-8: never render an invalid day
  if(window.Assistant && window.Assistant.refreshCtx) window.Assistant.refreshCtx();  // R3-2
  localStorage.setItem("jpn-last-day", STATE.day);
  localStorage.setItem("jpn-last-session", STATE.session);   // remember which sub-page (morning/noon/night) for "继续学习"
  const L = lessonByDay(STATE.day) || lessonByDay(1);
  renderHeader(L);
  if(L.planned){ renderPlanned(L); return; }
  renderDayHead(L);
  renderTabs(L);
  if(STATE.session==="morning") renderMorning(L);
  else if(STATE.session==="noon") renderNoon(L);
  else if(STATE.session==="exercise"){ if(window.Exercises) Exercises.render(L); else renderNight(L); }
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
  const EH=ENL(L.day);
  $("#day-head").innerHTML = `
    <span class="week-chip">${WEEK_LABELS[L.week]||""}</span>
    <h1>${esc(L.theme)}<span class="level-badge">${L.level}</span></h1>
    <div class="theme-zh">${esc(zhen(L.themeZh, EH.themeEn))}</div>
    <div class="source">${T("📖 来源 / Source","📖 Source")}：${esc(zhen(L.source, L.sourceEn))}</div>
    <div class="goals">${(L.goals||[]).map((g,i)=>`<span>🎯 ${esc(zhen(g,(EH.goalsEn||[])[i]))}</span>`).join("")}</div>
  `;
}

function renderTabs(L){
  const wrap=$("#tabs");
  wrap.innerHTML = Object.entries(SESSIONS).map(([key,s])=>{
    const done = PROG[L.day] && PROG[L.day][key];
    return `<button data-s="${key}" class="${STATE.session===key?'active':''}">
      <span class="t-emoji">${s.emoji}</span>${done?'<span class="done-dot">✓</span>':''}
      <span class="t-name">${s.name}</span>
      <span class="t-sub">${zhen(s.sub, s.subEn)}</span>
    </button>`;
  }).join("") + `<button data-s="exercise" class="${STATE.session==="exercise"?'active':''}">
      <span class="t-emoji">✍️</span>
      <span class="t-name">練習</span>
      <span class="t-sub">${T("产出 · 造句","Produce · Output")}</span>
    </button>`;
  wrap.querySelectorAll("button").forEach(b=>b.onclick=()=>{ STATE.session=b.dataset.s; if(b.dataset.s==="morning") STATE.showZh=false; render(); });
}

/* ----------------------------- MORNING ----------------------------- */
function renderMorning(L){
  const body = $("#panel-body");
  body.innerHTML = `
    <div class="session-hint">${zhen(SESSIONS.morning.hint, SESSIONS.morning.hintEn)}</div>
    <div class="audio-bar">
      <button id="play-all">${T("▶ 全文を聴く","▶ Play all")}</button>
      <button id="stop-all" class="ghost">${T("■ 停止","■ Stop")}</button>
      <div class="speed">${T("速さ","Speed")} <input type="range" id="rate" class="speed-range" min="0.6" max="1.4" step="0.05" value="${STATE.rate}"><b id="rate-v" class="speed-val">${STATE.rate.toFixed(2)}×</b></div>
    </div>
    <div class="mini-toggles">
      <button id="m-zh" class="${STATE.showZh?'on':''}">${T("中文译文","Translation")}</button>
      <button id="m-furi" class="${STATE.furi?'on':''}">${T("ふりがな","Furigana")}</button>
    </div>
    <div class="para ${STATE.furi?'':'hide-furi'} ${STATE.showZh?'':'hide-zh'}" id="para"></div>
    <p class="typing-tip">${T("💡 点击任意一句可单独播放并跟读。早上目标：跟着读 3 遍，先不求懂意思。","💡 Tap any sentence to play and shadow it. Morning goal: read along 3 times — don't worry about meaning yet.")}</p>
  `;
  const para=$("#para");
  L.paragraph.forEach((s,idx)=>{
    const el=document.createElement("span");
    el.className="sent";
    el.innerHTML = toRuby(s.jp) + `<span class="zh">${esc(zhen(s.zh,(ENL(L.day).paraEn||[])[idx]))}</span>`;
    el.onclick=()=>speakSequence([{text:s.jp,node:el,audioKey:audioKeyFor(L.day,idx)}]);
    para.appendChild(el);
  });
  $("#play-all").onclick=()=>{
    const items=[...para.querySelectorAll(".sent")].map((node,i)=>({text:L.paragraph[i].jp,node,audioKey:audioKeyFor(L.day,i)}));
    speakSequence(items);
  };
  $("#stop-all").onclick=stopSpeak;
  $("#rate").oninput=e=>setRate(parseFloat(e.target.value));
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
  acc:["正確さ","发音准确度：每个假名/音有没有读对。低 = 个别音发错或走音。","Accuracy: did you pronounce each kana/sound correctly? Low = some sounds off."],
  flu:["流暢さ","流利度：有没有不自然的停顿、卡顿、拖音。低 = 读得断断续续。","Fluency: any unnatural pauses or halting? Low = choppy delivery."],
  comp:["完整さ","完整度：句子读全了吗、有没有漏字/吞字。低 = 有遗漏。","Completeness: did you read the whole sentence, no dropped words? Low = omissions."],
  pro:["抑揚","语调·韵律：句子高低起伏是否自然（日语靠音高表意，很关键）。低 = 读得太平。","Prosody: is the pitch rise/fall natural? (Japanese conveys meaning through pitch — important.) Low = too flat."]
};
function metricTip(k){ return T(METRIC_DEF[k][1], METRIC_DEF[k][2]); }
function scoreBand(s){
  if(s>=90) return {t:T("優秀 · 近母语","Excellent · near-native"),c:"great"};
  if(s>=75) return {t:T("良好 · 熟练","Good · fluent"),c:"great"};
  if(s>=60) return {t:T("合格线 · 还行","Pass · okay"),c:"ok"};
  return {t:T("要加强","Needs work"),c:"again"};
}
function azureInterpret(d){
  const dims=[["acc",d.acc],["flu",d.flu],["comp",d.comp],["pro",d.pro]];
  const weak=dims.reduce((a,b)=>b[1]<a[1]?b:a);
  const tips={ acc:T("看下面红/黄的字，单独跟读那几个假名，把音对准。","Look at the red/yellow letters below; shadow those kana on their own to fix the sounds."),
    flu:T("先放慢，把整句连起来读顺，别一个词一个词蹦，再慢慢提速。","Slow down first, read the whole sentence smoothly (not word-by-word), then speed up."),
    comp:T("对照原文，每个字都读出来，别吞音、别漏字。","Check against the text; say every word — don't swallow or skip any."),
    pro:T("日语靠高低音表意——重点模仿示范的“起伏”，别从头到尾一个调。","Japanese uses pitch for meaning — copy the model's rise/fall instead of staying on one tone.") };
  if(weak[1]>=85) return T("四项都很均衡，非常棒！保持这个状态，挑战下一句/整段。","All four are well balanced — great! Keep it up and try the next sentence/passage.");
  return T(`你最该练的是「${METRIC_DEF[weak[0]][0]}」(${weak[1]}分)：${tips[weak[0]]}`, `Focus on 「${METRIC_DEF[weak[0]][0]}」(${weak[1]}): ${tips[weak[0]]}`);
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
  if(azureEnabled()) return `<button class="pron-engine on" id="pron-engine" title="${T("点击管理 / 关闭 AI 引擎","Manage / turn off the AI engine")}">${T("● AI 引擎已开启 · 逐音素＋语调 ⚙","● AI engine on · phoneme + prosody ⚙")}</button>`;
  if(SpeechRec)      return `<button class="pron-engine" id="pron-engine" title="${T("点此开启 AI 精评（逐音素＋语调）","Enable AI scoring (phoneme + prosody)")}">${T("○ 基础版 · 点此开启 AI 精评","○ Basic · enable AI scoring")}</button>`;
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
  const modeTabs=`<div class="pron-modes"><button class="${PRON.mode==='sentence'?'on':''}" id="pm-sent">${T("逐句","By sentence")}</button><button class="${PRON.mode==='paragraph'?'on':''}" id="pm-para">${T("整段","Whole passage")}</button></div>`;
  let nav="";
  if(PRON.mode==="sentence"){
    let chips=""; for(let i=0;i<total;i++) chips+=`<button class="pj-chip ${i===PRON.idx?'on':''}" data-jump="${i}">${i+1}</button>`;
    nav=`<div class="pron-nav"><button class="nav" id="pron-prev">◀</button><span class="pron-sub">${T("第 "+(PRON.idx+1)+" / "+total+" 句","Sentence "+(PRON.idx+1)+" / "+total)}</span><button class="nav" id="pron-next">▶</button></div><div class="pj-chips">${chips}</div>`;
  }
  let head=`<h3>${T("🎤 発音チェック · 跟读评估","🎤 Pronunciation Check")} ${pronEngineBadge()}</h3>
    <div class="pron-sub">${T("跟读 → 录音 → <b>回听自己的声音</b>并对比标准音。","Shadow → record → <b>listen back to yourself</b> and compare with the model.")}${PRON.mode==='paragraph'?T("整段模式：一口气读完，读完点「■ 停止」。"," Whole-passage mode: read it all the way through, then tap ■ Stop."):T("逐句模式：点下面数字可跳到任意句。"," By-sentence mode: tap a number below to jump to any sentence.")}</div>
    ${modeTabs}<div class="pron-target">${t.jpRuby}</div>`;
  if(IS_FILE){
    box.innerHTML=head+`<div class="pron-unsupported">${T("🔌 你正用 file:// 打开。麦克风需要本地服务器：终端跑 <code>python3 -m http.server 4173</code> 再开 <b>http://localhost:4173</b>。现在仍可「🔊 听示范」。","🔌 You opened this via file://. The mic needs a local server: run <code>python3 -m http.server 4173</code> in a terminal, then open <b>http://localhost:4173</b>. You can still use 🔊 Listen.")}</div><div class="pron-ctrl"><button class="listen" id="pron-listen">${T("🔊 听示范","🔊 Listen")}</button></div>${nav}`;
    bindPron(L,t,total); return;
  }
  if(!SpeechRec && !azureEnabled()){
    box.innerHTML=head+`<div class="pron-unsupported">${T("⚠️ 此浏览器不支持录音识别。建议用 <b>Chrome</b>，或在 ⚙ 开启 AI 引擎。仍可「🔊 听示范」。","⚠️ This browser doesn't support speech recognition. Use <b>Chrome</b>, or enable the AI engine in ⚙. You can still use 🔊 Listen.")}</div><div class="pron-ctrl"><button class="listen" id="pron-listen">${T("🔊 听示范","🔊 Listen")}</button></div>${nav}`;
    bindPron(L,t,total); return;
  }
  box.innerHTML=head+`
    <div class="pron-ctrl">
      <button class="rec ${PRON.recording?'recording':''}" id="pron-rec">${PRON.recording?T("■ 停止","■ Stop"):T("🎤 録音して読む","🎤 Record & read")}</button>
      <button class="listen" id="pron-listen">${T("🔊 听标准示范","🔊 Listen to model")}</button>
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
function updatePronBtn(){ const b=$("#pron-rec"); if(!b) return; b.textContent=PRON.recording?T("■ 停止","■ Stop"):T("🎤 録音して読む","🎤 Record & read"); b.classList.toggle('recording',PRON.recording); }

/* ---- record (MediaRecorder → playback) + score (engine); finalize ONCE when BOTH ready (R2-2) ---- */
async function startRec(L){
  stopSpeak();
  const res=$("#pron-result"); if(res) res.innerHTML=`<div class="pron-sub">${T("🎙️ 准备麦克风…","🎙️ Preparing mic…")}</div>`;
  let stream;
  try{ stream=await navigator.mediaDevices.getUserMedia({audio:true}); }
  catch(e){ if(res) res.innerHTML=`<div class="pron-unsupported">${T("无法使用麦克风：","Can't use the mic: ")}${esc(String(e.name||e))}${T("。请允许麦克风权限，并用 <b>http://localhost</b> 打开（file:// 不行）。",". Allow mic permission and open via <b>http://localhost</b> (not file://).")}</div>`; return; }
  PRON.stream=stream; PRON.chunks=[]; PRON._scored=false;
  // R6-3: lock the target sentence/paragraph AT RECORD START. pronKey() reads the
  // current PRON.idx/mode, which can change (user jumps to another sentence) before
  // the async score returns — without this, the score would land on the wrong line.
  PRON.pending={ url:null, urlReady:false, score:undefined, scoreReady:false, key:pronKey() };
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
  if(res) res.innerHTML=`<div class="pron-sub">${T("🔴 録音中… ゆっくり、はっきり。读完","🔴 Recording… slow and clear. When done, ")}${PRON.mode==='paragraph'?T("点「■ 停止」","tap ■ Stop"):T("停顿一下会自动结束","pause briefly and it stops automatically")}${T("。",".")}</div>`;
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
  if(!PRON.pending){ PRON.pending={url:null,urlReady:true,score:undefined,scoreReady:false,key:pronKey()}; }
  PRON.pending.score=obj; PRON.pending.scoreReady=true;
  PRON.recording=false; updatePronBtn();
  if(PRON.recorder && PRON.recorder.state==="recording"){ try{ PRON.recorder.stop(); }catch(e){ PRON.pending.urlReady=true; tryFinalize(L); } }
  else tryFinalize(L);
}
function tryFinalize(L){
  const p=PRON.pending; if(!p || !p.scoreReady || !p.urlReady) return;   // both audio + score must be ready → ONE record
  PRON.pending=null;
  const obj = p.score || {type:"basic",overall:0,heard:"",html:"",noscore:true};
  const key = p.key || pronKey();   // R6-3: use the key captured at record start, not the (possibly-changed) current one
  const arr=PRON.history[key]||(PRON.history[key]=[]);
  arr.push({url:p.url||null, score:(obj.overall||0), data:obj, ts:Date.now()});
  while(arr.length>3){ const old=arr.shift(); if(old.url) try{URL.revokeObjectURL(old.url);}catch(e){} }
  if(!obj.noscore){ pushScoreLog("jpn-pron-log",{day:L.day,k:key,score:(obj.overall||0),kind:obj.type});  // persist score → pet progress
    if(window.Pet) Pet.onStudy(); }
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
  if(!arr.length){ res.innerHTML=`<div class="pron-sub">${T("点「🎤 録音して読む」开始：读完会自动评分，并能<b>回听自己的录音</b>，和标准音对比。系统保留你最近 3 次，方便看进步。","Tap 🎤 Record & read to start: you'll be scored automatically and can <b>listen back to your own recording</b> against the model. The last 3 attempts are kept so you can see progress.")}</div>`; return; }
  const a=arr[arr.length-1], d=a.data, b=scoreBand(a.score||0);
  let imp="";
  if(arr.length>=2){ const delta=(a.score||0)-(arr[arr.length-2].score||0);
    if(delta>0) imp=`<div class="pron-imp up">${T("📈 比上次 +"+delta+" 分，进步了！继续保持～","📈 +"+delta+" vs last time — nice progress! Keep it up.")}</div>`;
    else if(delta<0) imp=`<div class="pron-imp down">${T("比上次低了 "+(-delta)+" 分，别灰心，再来一次准更好。","Down "+(-delta)+" from last time — don't worry, try again.")}</div>`;
    else imp=`<div class="pron-imp">${T("和上次持平，稳住，再冲一点点。","Same as last time — steady; push a little more.")}</div>`;
  }
  let body="";
  if(d.type==="azure"){
    const dims=[["acc",d.acc],["flu",d.flu],["comp",d.comp],["pro",d.pro]];
    const bars=dims.map(([k,v])=>{ const bd=scoreBand(v); return `<div class="bar-row"><span class="bar-lab" title="${esc(metricTip(k))}">${METRIC_DEF[k][0]} ⓘ</span><div class="pbar"><i class="bf-${bd.c}" style="width:${v}%"></i></div><span class="bar-val">${v}</span></div>`; }).join("");
    body=`<div class="pron-overall ${b.c}">${T("総合","Overall")} <b>${a.score}</b> ${T("点","pts")} · <span class="band ${b.c}">${b.t}</span></div>
      <div class="pron-bars">${bars}</div>
      <div class="pron-sub" style="margin-top:6px">${T("逐字（绿=好 / 黄=一般 / <span class=\"miss\">红=不准</span>，鼠标悬停指标看含义）：","Per word (green=good / yellow=ok / <span class=\"miss\">red=off</span>; hover a metric for its meaning):")}</div>
      <div class="pron-heard">${d.wordsHtml}</div>
      <div class="pron-interp">💡 ${azureInterpret(d)}</div>`;
  } else {
    body=`<div class="pron-overall ${b.c}">${T("一致度","Match")} <b>${a.score}%</b> · <span class="band ${b.c}">${b.t}</span></div>
      <div class="pron-sub" title="${T("把你读的转成文字、与原文比对的吻合度；衡量“读清楚/读对了没”，是近似值，不评语调。","How well your speech (transcribed) matches the text — measures clarity/correctness; approximate, no pitch grading.")}">${T("一致度 ⓘ：识别一致度（近似 · 不含语调评估）","Match ⓘ: recognition match (approximate · no prosody grading)")}</div>
      <div class="pron-sub">${T("识别到：","Heard:")}</div><div class="pron-heard">${d.heard?esc(d.heard):'<span class="miss">'+T("（未识别到声音）","(no speech detected)")+'</span>'}</div>
      <div class="pron-sub">${T("原文对照（<span class=\"miss\">下线</span>＝没读清 / 读错）：","Against the text (<span class=\"miss\">underline</span> = unclear / wrong):")}</div><div class="pron-heard">${d.html||""}</div>
      <div class="pron-interp">💡 ${T("想要逐音素＋<b>语调</b>的精细评分，点上方「开启 AI 精评」。","For phoneme-level + <b>prosody</b> scoring, enable the AI engine above.")}</div>`;
  }
  body+=`<div class="pron-playback">
    ${a.url?`<button class="pron-play mine" data-url="${a.url}">${T("▶ 听我的录音","▶ My recording")}</button>`:`<span class="pron-sub">${T("（这次没录到音频）","(no audio this time)")}</span>`}
    <button class="pron-play demo" id="pb-demo">${T("🔊 听标准示范","🔊 Model")}</button></div>`;
  if(arr.length>1){
    const hist=arr.map((x,i)=>`<button class="hist-chip ${i===arr.length-1?'cur':''}" ${x.url?`data-url="${x.url}"`:''}>${T("第"+(i+1)+"次","#"+(i+1))} · ${x.data.type==='azure'?(x.score+T("分","")):(x.score+'%')}${x.url?' ▶':''}</button>`).join("");
    body+=`<div class="pron-sub" style="margin-top:8px">${T("最近 "+arr.length+" 次（点击回听对比）：","Last "+arr.length+" (tap to replay & compare):")}</div><div class="pron-hist">${hist}</div>`;
  }
  body+=imp;
  res.innerHTML=body;
  res.querySelectorAll(".pron-play[data-url],.hist-chip[data-url]").forEach(el=>el.onclick=()=>{ try{ new Audio(el.dataset.url).play(); }catch(e){} });
  const demo=$("#pb-demo"); if(demo) demo.onclick=()=>speakSequence(pronTarget(L).listen);
}

/* ----------------------------- NOON ----------------------------- */
function renderNoon(L){
  const body=$("#panel-body");
  const E=ENL(L.day);
  let html = `<div class="session-hint">${zhen(SESSIONS.noon.hint, SESSIONS.noon.hintEn)}</div>`;

  /* paragraph with translations shown */
  html += `<section class="block"><h2>${T("📝 本文と訳 · 课文与翻译","📝 Passage & Translation")}</h2><div class="para" id="para2"></div></section>`;

  /* vocab — cards: word + reading + 🔊 + 词性 + 释义(术语可点) + 拆解 + 例句 */
  html += `<section class="block"><h2>${T("📚 単語 · 词汇","📚 Vocabulary")} <span class="blk-hint">${T("点术语看解释 · 🔊朗读 · 📝例句","🔊 tap to hear · 📝 examples")}</span></h2>
    <div class="vcards">
    ${L.vocab.map(v=>`<div class="vcard">
      <div class="vc-head"><span class="v-word">${esc(v.w)}</span><span class="v-read">${esc(v.r)}</span><button class="play-w" data-w="${esc(v.r)}">🔊</button>${v.pos?`<span class="v-pos">${esc(posLabel(v.pos))}</span>`:""}</div>
      <div class="vc-mean">${LANG!=="zh" ? esc((E.vocabEn&&E.vocabEn[v.w])||v.en||v.zh) : (linkTerms(v.zh)+(v.en?`<span class="v-en"> · ${esc(v.en)}</span>`:""))}</div>
      ${v.parts?`<div class="vc-parts"><span class="vc-tag">${T("🧩 拆解","🧩 Breakdown")}</span>${v.parts.map(p=>`<span class="vc-part" ${p.r?`data-w="${esc(p.r)}"`:""}><b>${esc(p.p)}</b>${p.r?`<i>${esc(p.r)}</i>`:""}＝${esc(LANG!=="zh"?(POS_EN[p.m]||p.m):p.m)}</span>`).join('<span class="vc-plus">＋</span>')}</div>`:""}
      ${v.ex?`<div class="vc-ex" data-jp="${esc(v.ex.jp)}"><span class="vc-tag">${T("📝 例","📝 e.g.")}</span>${toRuby(v.ex.jp)}<span class="zh">${esc(zhen(v.ex.zh,(E.vocabExEn&&E.vocabExEn[v.w])))}</span></div>`:""}
    </div>`).join("")}
    </div></section>`;

  /* grammar */
  html += `<section class="block"><h2>${T("🔧 文法 · 语法精讲","🔧 Grammar")}</h2>
    ${L.grammar.map(g=>{ const ge=(E.gramEn&&E.gramEn[g.point])||{}; return `<div class="gram">
      <h3>${esc(g.point)}</h3>
      <div class="label">${esc(g.label||"")}</div>
      <div class="exp">${LANG!=="zh"&&ge.exp ? esc(ge.exp) : linkTerms(g.zh)}</div>
      ${g.examples.map((ex,k)=>`<div class="ex" data-jp="${esc(ex.jp)}">${toRuby(ex.jp)}<span class="zh">${esc(zhen(ex.zh,(ge.ex||[])[k]))}</span></div>`).join("")}
    </div>`; }).join("")}
  </section>`;

  /* conversation */
  html += `<section class="block"><h2>${T("💬 会話で使う · 日常对话用法","💬 In Conversation")}</h2>
    ${L.conversation.map((c,i)=>`<div class="conv-item" data-jp="${esc(c.jp)}">${toRuby(c.jp)}<span class="zh">${esc(zhen(c.zh,(E.convEn||[])[i]))}</span></div>`).join("")}
  </section>`;

  /* extended */
  if(L.extended){
    html += `<section class="block"><h2>🌱 ${esc(zhen(L.extended.title, T(null,"Extended · synonyms & related")))}</h2>
      <ul class="ext-list">${L.extended.items.map((it,i)=>`<li>${LANG!=="zh"&&(E.extEn||[])[i]?esc(E.extEn[i]):linkTerms(it)}</li>`).join("")}</ul></section>`;
  }
  body.innerHTML=html;

  /* fill para2 with ruby + zh */
  const para2=$("#para2");
  L.paragraph.forEach((s,idx)=>{
    const el=document.createElement("span");
    el.className="sent";
    el.innerHTML=toRuby(s.jp)+`<span class="zh">${esc(zhen(s.zh,(E.paraEn||[])[idx]))}</span>`;
    el.onclick=()=>speakSequence([{text:s.jp,node:el,audioKey:audioKeyFor(L.day,idx)}]);
    para2.appendChild(el);
  });
  if(!STATE.furi) para2.classList.add("hide-furi");

  /* click handlers: play vocab + examples + conversation + 拆解 + 术语跳转 */
  body.querySelectorAll(".play-w").forEach(b=>b.onclick=()=>speakSequence([{text:b.dataset.w,node:null,audioKey:"v_"+speechNorm(b.dataset.w)}]));
  body.querySelectorAll(".ex,.conv-item,.vc-ex").forEach(el=>el.onclick=()=>speakSequence([{text:el.dataset.jp,node:el,audioKey:"x_"+speechNorm(el.dataset.jp)}]));
  // 🧩 breakdown parts: try the vocab clip for that reading; only wire it when there's a chance
  // of sound (a matching v_ clip, or TTS fallback on) so it isn't a silent tap. (R5 F3d)
  body.querySelectorAll(".vc-part[data-w]").forEach(el=>{ const k="v_"+speechNorm(el.dataset.w);
    if(AUDIO_MANIFEST[k] || ttsFallbackOn()){ el.style.cursor="pointer"; el.onclick=()=>speakSequence([{text:el.dataset.w,node:null,audioKey:k}]); } });
  body.querySelectorAll(".gloss").forEach(el=>el.onclick=(e)=>{ e.stopPropagation(); gotoGlossary(parseInt(el.dataset.g,10)); });
  addCompleteButton(L,"noon",body);
}

/* ----------------------------- NIGHT ----------------------------- */
function renderNight(L){
  const body=$("#panel-body");
  const E=ENL(L.day);
  body.innerHTML = `
    <div class="session-hint">${zhen(SESSIONS.night.hint, SESSIONS.night.hintEn)}</div>
    <div class="write-modes">
      <button data-m="type" class="${STATE.writeMode==='type'?'active':''}">${T("⌨️ 输入核对 Type & Check","⌨️ Type & Check")}</button>
      <button data-m="hide" class="${STATE.writeMode==='hide'?'active':''}">${T("🙈 遮挡默写 Hide & Recall","🙈 Hide & Recall")}</button>
    </div>
    <div id="write-area"></div>
    <section class="block" style="margin-top:30px"><h2>${T("🪞 反思 · 反思问题","🪞 Reflection")}</h2>
      <ul class="reflect-list">${L.reflect.map((r,i)=>`<li>${esc(zhen(r,(E.reflectEn||[])[i]))}</li>`).join("")}</ul>
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
    <p class="typing-tip">${T("看着原文（或先听一句），在下面把它打出来。日语输入法（macOS：かな/ローマ字）打不出来的字，正是你最该记的。点「核对」高亮差异。","Read the text (or listen first), then type it below. The characters your IME (macOS: kana/romaji) can't produce are exactly the ones to memorize. Tap Check to highlight differences.")}</p>
    <div class="copy-ref" id="ref">${fullRubyHtml(L)}</div>
    <textarea class="typing" id="typed" placeholder="${T("ここに日本語で入力してください…（用日语输入法在此输入）","ここに日本語で入力してください… (type in Japanese here)")}"></textarea>
    <div class="check-row">
      <button id="check">${T("✓ 核对 Check","✓ Check")}</button>
      <button id="clear" class="ghost">${T("クリア Clear","クリア Clear")}</button>
      <button id="hear" class="ghost">${T("🔊 全文を聴く","🔊 Play all")}</button>
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
    <p class="typing-tip">${T("原文已被遮挡。拿出纸笔，凭记忆把整段写（抄）出来，或大声背诵。写完点「揭晓」对照。你也可以只关掉 ふりがな，考自己的读音。","The text is hidden. Grab pen and paper and write the whole passage from memory (or recite it aloud), then tap Reveal to compare. You can also just turn off ふりがな to test your readings.")}</p>
    <button class="reveal-btn" id="reveal">${T("👁 揭晓 Reveal","👁 Reveal")}</button>
    <button class="reveal-btn" id="hear2" style="background:var(--panel-2);color:var(--ink);border:1px solid var(--line)">${T("🔊 ヒントに聴く","🔊 Hint (listen)")}</button>
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
      <h2>${T("这一天已规划好","This day is planned")}</h2>
      <p>${T("主题、级别与来源都已排定，完整内容（课文＋音频＋语法＋抄写）会随你的进度逐日填充。","The theme, level, and source are set; the full content (text + audio + grammar + copywork) fills in day by day as you progress.")}</p>
      <div class="source" style="color:var(--ink-faint);font-size:.85rem">📖 ${T("来源","Source")}：${esc(L.source)}</div>
      <div class="goals">${(L.goals||[]).map(g=>`<span>🎯 ${esc(g)}</span>`).join("")}</div>
      <p style="margin-top:18px;color:var(--ink-faint)">${T("想现在就解锁这一天？告诉我「把 Day "+L.day+" 写出来」，我就为你生成完整课文。","Want to unlock this day now? Tell me \"write out Day "+L.day+"\" and I'll generate the full lesson.")}</p>
    </div>
  `;
}

/* ----------------------------- complete button ----------------------------- */
function addCompleteButton(L,session,body){
  const done = PROG[L.day] && PROG[L.day][session];
  const btn=document.createElement("button");
  btn.className="complete-btn"+(done?" done":"");
  btn.textContent = done ? `✓ ${SESSIONS[session].name} ${T("已完成 — 点此取消","done — tap to undo")}` : T("把这一节标记为完成 ✓","Mark this session complete ✓");
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
            <div class="d">Day ${l.day}${l.planned?' · '+T('计划中','planned'):''}</div>
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
  $("#map-toggle").textContent = show?T("← 回到今天","← Back to today"):T("🗺️ 30天地图","🗺️ 30-day map");
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
      <button class="fab-act" data-act="ai">🤖 <span>${T("提问","Ask")}</span></button>
      <button class="fab-act" data-act="note">🗒️ <span>${T("速记","Note")}</span></button>
    </div><button class="fab-main" id="fab-main" title="${T('工具','Tools')}">✦</button>`;
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
  if(p!=="test" && TEST && !TEST.submitted){ try{ clearInterval(TEST.interval); }catch(e){} TEST=null; }  // H4: don't let an abandoned test keep ticking / auto-submit in the background
  document.querySelectorAll("#page-nav button").forEach(b=>b.classList.toggle("active",b.dataset.p===p));
  $("#page-home").style.display = p==="home"?"block":"none";
  $("#page-daily").style.display = p==="daily"?"block":"none";
  $("#page-general").style.display = p==="general"?"block":"none";
  if($("#page-scenarios")) $("#page-scenarios").style.display = p==="scenarios"?"block":"none";
  $("#page-test").style.display = p==="test"?"block":"none";
  if($("#page-produce")) $("#page-produce").style.display = p==="produce"?"block":"none";
  if($("#page-notes")) $("#page-notes").style.display = p==="notes"?"block":"none";
  $("#daily-controls").style.display = p==="daily"?"flex":"none";
  if(p!=="daily"){ $("#map-view").classList.remove("show"); $("#day-num").textContent=""; }
  localStorage.setItem("jpn-page",p);
  if(p==="home") renderHome();
  else if(p==="daily") render();
  else if(p==="general") renderGeneral();
  else if(p==="scenarios") renderScenarios();
  else if(p==="test") renderTestHome();
  else if(p==="produce" && window.Produce) window.Produce.render();
  else if(p==="notes" && window.Notes) window.Notes.renderPage();
  if(window.Assistant && window.Assistant.refreshCtx) window.Assistant.refreshCtx();  // R3-2: keep AI panel ctx fresh
  if(window.Pet){ Pet.showRail(p==="home"); Pet.onPageVisit(p); }   // pet may hop in to cheer / be found
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
    cells+=`<div class="hm-cell lv${c}" data-day="${l.day}" title="${T('Day '+l.day+'：'+c+'/3 完成','Day '+l.day+': '+c+'/3 done')}">${l.day}</div>`; });
  return `<div class="hm-grid">${cells}</div>
    <div class="hm-legend">${T("每天完成数","Sessions per day")}：<span class="hm-cell lv0">0</span><span class="hm-cell lv1">1</span><span class="hm-cell lv2">2</span><span class="hm-cell lv3">3</span> · ${T("点格子跳到那天","tap a cell to jump to that day")}</div>`;
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
  const phIdx = dayOfYear() % DAILY_PHRASES.length;
  const ph = DAILY_PHRASES[phIdx];
  const phEn = ((typeof window!=="undefined"&&window.EN_DAILY&&window.EN_DAILY.phrases)||[])[phIdx]||{};

  // --- stats ---
  let done=0,vocabL=0,gramL=0;
  LESSONS.forEach(l=>{ const p=PROG[l.day]||{}; done+=["morning","noon","night"].filter(s=>p[s]).length; if(p.noon){ vocabL+=(l.vocab||[]).length; gramL+=(l.grammar||[]).length; } });
  const total=LESSONS.length*3, best=loadTestBest();

  // --- to-do for current day ---
  const p=PROG[N]||{};
  let todo="";
  [["morning",T("🌅 朝の朗読（听 & 跟读）","🌅 Morning · Read & Shadow")],["noon",T("☀️ 昼の理解（词汇 & 语法）","☀️ Noon · Understand & Grammar")],["night",T("🌙 夜の反思（抄写 & 反思）","🌙 Night · Write & Reflect")]].forEach(([s,label])=>{
    todo+=`<li class="${p[s]?'tdone':''}" data-go="day:${N}:${s}"><span class="tk-box">${p[s]?'✓':''}</span><span>Day ${N} · ${label}</span></li>`;
  });
  if(prevDay) todo+=`<li data-go="day:${prevDay}:morning"><span class="tk-box rv">↻</span><span>${T("复习 Day "+prevDay+"：朗读一遍、再听一次音频","Review Day "+prevDay+": read it once, listen again")}</span></li>`;
  if(prevDay && prevDay%7===0){ const tid=prevDay/7; if(tid>=1&&tid<=4) todo+=`<li data-go="test"><span class="tk-box rv">📝</span><span>${T("第"+tid+"周学完了——做 模試"+tid+" 检验一下","Week "+tid+" done — try Mock Test "+tid)}</span></li>`; }

  const seenIntro = (()=>{ try{ return localStorage.getItem("jpn-seen-intro")==="1"; }catch(e){ return true; } })();
  const introBanner = seenIntro ? "" : `
    <div class="home-intro" id="home-intro">
      <button class="hi-close" id="hi-close" title="${T("知道了","Got it")}">✕</button>
      <h2>${T("👋 欢迎！这里有几样趁手的工具","👋 Welcome! A few handy tools here")}</h2>
      <div class="hi-items">
        <span>🔊 <b>${T("真人音色","Real voices")}</b>：${T("课文/单词都能点朗读，⚙ 里可换不同声音","tap any sentence/word to hear it; switch voices in ⚙")}</span>
        <span>🤖 <b>${T("AI 提问","Ask AI")}</b>：${T("右下角随时问任何日语问题（需在 ⚙ 填 Claude Key）","ask any Japanese question, bottom-right (add a Claude key in ⚙)")}</span>
        <span>🗒️ <b>${T("速记本","Quick notes")}</b>：${T("学习时随手记，自动保存，可存成笔记","jot as you study — auto-saved, savable as notes")}</span>
        <span>☀️ <b>${T("浅/深色","Light/Dark")}</b>：${T("右上角一键切换主题","toggle the theme, top-right")}</span>
        <span>🥚 <b>${T("言霊ペット","Kotodama pet")}</b>：${T("学习会孵化并养成你的『言霊』宠物——坚持学它就长大；偷懒太久它会离开。","studying hatches & raises your 言霊 pet — keep at it and it grows; neglect it too long and it slips away.")}</span>
      </div>
      <button class="hi-ok" id="hi-ok">${T("知道了，开始学习 →","Got it — start learning →")}</button>
    </div>`;
  c.innerHTML='<div class="home-layout"><div id="pet-slot" class="home-pet"></div><div class="home-body">'+introBanner+`
    <div class="home-hero">
      <div class="hh-top">
        <div class="greet">おかえりなさい${name?('、<b>'+esc(name)+'</b>'):''}！<span class="hh-sub">${toRuby("続[つづ]けることが、何[なに]より大切[たいせつ]です。")}</span></div>
        <div class="hh-streak">🔥 <b>${streak}</b> ${T("日連続","day streak")}</div>
      </div>
      ${ allDone
        ? `<div class="continue-cta done"><span class="cc-main">${T("🎉 30 天全部完成！","🎉 All 30 days complete!")}</span><small>${T("復習やテストで仕上げよう · 点此回顾","Polish with review & tests · tap to revisit")}</small></div>`
        : `<button class="continue-cta" data-go="day:${rDay}:${rSess}"><span class="cc-main">${T("▶ 继续学习","▶ Continue")} · Day ${rDay} · ${LANG==="en"?({morning:"Morning",noon:"Noon",night:"Night"}[rSess]):SESSION_LABEL[rSess]}</span><small>${esc(Lr.theme)}</small></button>` }
    </div>

    <div class="home-grid">
      <section class="home-card">
        <h2>${T("💬 每日一句","💬 Phrase of the Day")}</h2>
        <div class="phrase-jp" data-jp="${esc(ph.jp)}">${toRuby(ph.jp)} <button class="phrase-play" title="${T('朗读','Read aloud')}">🔊</button></div>
        <div class="phrase-zh">${esc(zhen(ph.zh, phEn.en))}</div>
        <div class="phrase-note">${esc(zhen(ph.note, phEn.noteEn))}</div>
        <div class="phrase-ex" data-jp="${esc(ph.ex.jp)}">「${toRuby(ph.ex.jp)}」<span class="zh">${esc(zhen(ph.ex.zh, phEn.exEn))}</span></div>
      </section>

      <section class="home-card">
        <h2>📌 ${prevDay?(T("昨日の復習","Yesterday's Review")+` · Day ${prevDay}`):T("はじめの一歩","First Step")}</h2>
        ${ Lprev ? `
          <div class="rv-theme">${esc(Lprev.theme)}</div>
          <div class="rv-label">${T("要记牢的语法点：","Grammar to remember:")}</div>
          <ul class="rv-list">${(Lprev.grammar||[]).slice(0,4).map(g=>`<li>${esc(g.point)}</li>`).join("")}</ul>
          <div class="rv-label">${T("重点词：","Key words:")}</div>
          <div class="rv-vocab">${(Lprev.vocab||[]).slice(0,6).map(v=>`<span data-jp="${esc(v.r)}">${esc(v.w)}<i>${esc(v.r)}</i></span>`).join("")}</div>
          <button class="rv-go" data-go="day:${prevDay}:noon">${T("↻ 打开 Day "+prevDay+" 复习","↻ Review Day "+prevDay)}</button>
        ` : `<p class="hc-empty">${T("还没有学过的内容。从今天的 Day "+N+" 开始你的第一步吧！每天坚持，30 天后回头看，你会惊讶于自己的变化。","Nothing studied yet. Start with Day "+N+" today! Keep at it daily — in 30 days you'll be amazed at the difference.")}</p>` }
      </section>

      <section class="home-card">
        <h2>${T("✅ 今日のタスク","✅ Today's Tasks")}</h2>
        <ul class="todo-list">${todo}</ul>
      </section>

      ${window.Notes ? window.Notes.homeCardHTML() : ""}
    </div>

    <section class="home-card">
      <h2>${T("🗓️ 30 天全景","🗓️ 30-Day Map")}</h2>
      ${heatmapHTML()}
    </section>

    <section class="home-card">
      <h2>${T("📊 我的数据","📊 My Stats")}</h2>
      <div class="dash-stats">
        <div class="stat big"><div class="num">🔥 ${streak}</div><div class="lbl">${T("连续学习天数","day streak")}</div></div>
        <div class="stat"><div class="num">${done}<span style="font-size:.5em;color:var(--ink-faint)">/${total}</span></div><div class="lbl">${T("完成的小节","sessions done")}</div></div>
        <div class="stat"><div class="num">${vocabL}</div><div class="lbl">${T("已学词条","words learned")}</div></div>
        <div class="stat"><div class="num">${gramL}</div><div class="lbl">${T("已学语法点","grammar points")}</div></div>
      </div>
      <div class="dash-stats" style="margin-top:6px">${TESTS.map(t=>{const b=best[t.id];return `<div class="stat"><div class="num" style="font-size:1.3rem">${b?Math.round(b.score/b.total*100)+'%':'—'}</div><div class="lbl">${esc(t.title.split('—')[0].trim())}</div></div>`;}).join("")}</div>
    </section></div></div>`;

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
  if(pp) pp.onclick=(e)=>{ e.stopPropagation(); speakSequence([{text:ph.jp,node:null,audioKey:"x_"+speechNorm(ph.jp)}]); };
  if(pe) pe.onclick=()=>speakSequence([{text:ph.ex.jp,node:null,audioKey:"x_"+speechNorm(ph.ex.jp)}]);
  c.querySelectorAll(".rv-vocab span[data-jp]").forEach(el=>el.onclick=()=>speakSequence([{text:el.dataset.jp,node:null,audioKey:"v_"+speechNorm(el.dataset.jp)}]));
  if(window.Pet) Pet.mountHome(c);   // 🥚 study pet — side companion fills the home gutters
}

/* ============================================================================
 *  SETTINGS MODAL + BACKUP (export / import)
 * ==========================================================================*/
function openSettings(){
  const cfg=getAzureCfg()||{key:"",region:""};
  const ov=$("#modal-overlay"); ov.style.display="flex";
  ov.innerHTML=`<div class="modal">
    <div class="modal-head"><h2>⚙️ ${T("设置","Settings")}</h2><button id="modal-close">✕</button></div>
    <div class="modal-body">
      <section><h3>${T("🌐 语言 / Language","🌐 Language")}</h3>
        <p class="m-note">${T("选择界面 / 讲解语言（日语原文不变）。选「日本語」时，界面为日语、讲解用英文。","Choose the interface / explanation language (the Japanese itself never changes). With 日本語, the UI is Japanese and explanations show in English.")}</p>
        <div class="theme-pick" id="lang-pick">
          ${[["zh","🇨🇳 中文"],["en","🇬🇧 English"],["ja","🇯🇵 日本語"]].map(([v,l])=>`<button data-lang-val="${v}" class="${getLang()===v?"on":""}">${l}</button>`).join("")}
        </div>
      </section>
      <section><h3>${T("🎨 外观 / テーマ","🎨 Appearance")}</h3>
        <p class="m-note">${T("选浅色或深色主题（也可跟随系统）。页眉那个 ☀️/🌙 按钮也能一键切换。","Pick a light or dark theme (or follow the system). The ☀️/🌙 button in the header also toggles it.")}</p>
        <div class="theme-pick" id="theme-pick">
          ${[["light",T("☀️ 浅色","☀️ Light")],["dark",T("🌙 深色","🌙 Dark")],["auto",T("🖥 跟随系统","🖥 System")]].map(([v,l])=>`<button data-theme-val="${v}" class="${getTheme()===v?"on":""}">${l}</button>`).join("")}
        </div>
      </section>
      <section><h3>👤 ${T("你的名字（可选）","Your name (optional)")}</h3>
        <p class="m-note">${T("填了之后，主页会用它跟你打招呼（おかえりなさい、…！）。只存在本机浏览器。","If set, the home page greets you with it (おかえりなさい、…！). Stored on this device only.")}</p>
        <label>${T("名字","Name")} <input type="text" id="usr-name" value="${escAttr(getName())}" placeholder="${T("例如 Bob / 王","e.g. Bob / 王")}"></label>
        <div class="m-actions"><button id="name-save" class="primary">${T("保存","Save")}</button><span id="name-status" class="m-note"></span></div>
      </section>
      ${window.Assistant?window.Assistant.settingsHTML():""}
      <section><h3>🎤 ${T("发音评估引擎","Pronunciation engine")}</h3>
        <p class="m-note">${T("不填则用浏览器识别（近似）。填入 Azure 语音服务的 <b>Key + Region</b> 可获得逐音素＋语调评分（免费层每月 5 小时）。仅存于本机浏览器，不上传。","Leave blank to use browser recognition (approximate). Add an Azure Speech <b>Key + Region</b> for phoneme + prosody scoring (free tier: 5 h/month). Stored on this device only; never uploaded.")}</p>
        <label>Azure Key <input type="password" id="az-key" value="${escAttr(cfg.key||"")}" placeholder="${T("Speech 资源的密钥","Speech resource key")}"></label>
        <label>Region <input type="text" id="az-region" value="${escAttr(cfg.region||"")}" placeholder="${T("如 japaneast / eastus","e.g. japaneast / eastus")}"></label>
        <div class="m-actions"><button id="az-test" class="primary">🔌 ${T("测试连接","Test connection")}</button><button id="az-save">${T("保存","Save")}</button><button id="az-clear">${T("清除","Clear")}</button><span id="az-status" class="m-note"></span></div>
        <div class="conn-status" id="az-conn"></div>
      </section>
      <section><h3>💾 ${T("进度备份","Progress backup")}</h3>
        <p class="m-note">${T("进度只存在本机浏览器，清缓存就会丢。考前建议导出一份。","Progress lives only in this browser — clearing cache loses it. Export a copy before the exam.")}</p>
        <div class="m-actions"><button id="exp-prog" class="primary">${T("导出进度 JSON","Export progress JSON")}</button><button id="imp-prog">${T("导入进度…","Import progress…")}</button><input type="file" id="imp-file" accept="application/json" style="display:none"><span id="bk-status" class="m-note"></span></div>
      </section>
      <section><h3>🎙️ ${T("声音模型","Voice model")}</h3>
        <p class="m-note">${T("选择朗读用的声音。每个角色都有「普通版」和「有意思版」，切换后全站真人语音都会用它。","Pick the voice used for read-aloud. Each character has a standard and a fun version; switching applies site-wide.")}</p>
        <label>${T("声音","Voice")} <select id="voice-sel">${voiceOptionsHTML()}</select></label>
        <p class="m-note" id="voice-desc"></p>
        <div class="m-actions"><button id="voice-demo">▶ ${T("试听","Preview")}</button><span id="voice-status" class="m-note"></span></div>
      </section>
      <section><h3>🔊 ${T("真人音频（VOICEVOX）","Real-voice audio (VOICEVOX)")}</h3>
        <p class="m-note">${Object.keys(AUDIO_MANIFEST).length?T(`已加载 <b>${Object.keys(AUDIO_MANIFEST).length}</b> 条预生成真人音频 ✓ （课文・单词・例句・每日一句・场景全覆盖）`,`<b>${Object.keys(AUDIO_MANIFEST).length}</b> pre-generated real-voice clips loaded ✓ (lessons, vocab, examples, daily phrases & scenarios)`):T("当前使用系统 TTS（机械音）。","Currently using system TTS (robotic).")} ${T("要新增声音：启动 VOICEVOX（或 AivisSpeech）引擎后运行","To add a voice: start the VOICEVOX (or AivisSpeech) engine, run")} <code>python3 tools/gen_audio.py --voice-dir &lt;name&gt; --speaker &lt;id&gt;</code>${T("，再在 <code>audio/voices.js</code> 注册即可（详见 README）。需通过本地服务器打开。"," and register it in <code>audio/voices.js</code> (see README). Open via a local server.")}</p>
        <label class="m-check"><input type="checkbox" id="tts-fb"> ${T("缺音频时用系统语音兜底（机械音，默认关闭）","Fall back to the system voice when a clip is missing (robotic; off by default)")}</label>
        <p class="m-note">${T("默认关闭——你不喜欢那个机械音。现在内容已全部用真人音频，几乎用不到兜底。","Off by default — you disliked the robotic voice. All content now uses real-voice audio, so the fallback is rarely needed.")}</p>
      </section>
    </div></div>`;
  $("#modal-close").onclick=closeSettings;
  ov.onclick=(e)=>{ if(e.target===ov) closeSettings(); };
  $("#theme-pick").querySelectorAll("button").forEach(b=>b.onclick=()=>{ setTheme(b.dataset.themeVal); $("#theme-pick").querySelectorAll("button").forEach(x=>x.classList.toggle("on", x===b)); });
  $("#lang-pick").querySelectorAll("button").forEach(b=>b.onclick=()=>{ if(getLang()===b.dataset.langVal) return; setLang(b.dataset.langVal); applyLang(); showPage(STATE.page); openSettings(); });
  $("#name-save").onclick=()=>{ const v=$("#usr-name").value.trim(); if(v) localStorage.setItem("jpn-name",v); else localStorage.removeItem("jpn-name"); $("#name-status").textContent=T("已保存 ✓","Saved ✓"); };
  $("#az-save").onclick=()=>{ const key=$("#az-key").value.trim(), region=$("#az-region").value.trim(); if(key&&region){ localStorage.setItem("jpn-azure-cfg",JSON.stringify({key,region})); $("#az-status").textContent=T("已保存 ✓ 发音评估将用 Azure","Saved ✓ — Azure will be used"); } else { $("#az-status").textContent=T("Key 和 Region 都要填","Enter both Key and Region"); } };
  $("#az-clear").onclick=()=>{ localStorage.removeItem("jpn-azure-cfg"); $("#az-key").value=""; $("#az-region").value=""; $("#az-status").textContent=T("已清除，将用浏览器识别","Cleared — browser recognition will be used"); const cc=$("#az-conn"); if(cc){ cc.className="conn-status"; cc.textContent=""; } };
  if($("#az-test")) $("#az-test").onclick=()=>testAzureConn();
  $("#exp-prog").onclick=exportProgress;
  $("#imp-prog").onclick=()=>$("#imp-file").click();
  $("#imp-file").onchange=importProgress;
  if(window.Assistant) window.Assistant.bindSettings();
  // system-TTS fallback toggle (default off)
  if($("#tts-fb")){ $("#tts-fb").checked=ttsFallbackOn();
    $("#tts-fb").onchange=()=>{ try{ localStorage.setItem("jpn-tts", $("#tts-fb").checked?"1":"0"); }catch(e){} }; }
  // voice picker
  const vdesc=()=>{ const v=VOICES.find(x=>x.id===$("#voice-sel").value)||VOICES[0]; if($("#voice-desc")) $("#voice-desc").textContent=v?v.desc||"":""; };
  if($("#voice-sel")){
    vdesc();
    $("#voice-sel").onchange=()=>{ setVoice($("#voice-sel").value); vdesc(); $("#voice-status").textContent=T("已切换 ✓","Switched ✓"); };
    $("#voice-demo").onclick=()=>{ stopSpeak(); $("#voice-status").textContent=T("试听中…","Playing…"); speakSequence([{text:"日本語[にほんご]を勉強[べんきょう]しています。",node:null,audioKey:"d1_s1"}]).then(()=>{ if($("#voice-status")) $("#voice-status").textContent=""; }); };
  }
}
function closeSettings(){ const ov=$("#modal-overlay"); ov.style.display="none"; ov.innerHTML=""; }
function exportProgress(){
  const keys=["jpn-n2-progress","jpn-test-best","jpn-last-day","jpn-last-session","jpn-page","jpn-active-dates","jpn-name","jpn-notes","jpn-pet","jpn-rate","jpn-test-log","jpn-pron-log","jpn-exercise-log","jpn-produce-log","jpn-wrong"];
  const out={ _app:"jpn-n4-n2", _exported:new Date().toISOString(), data:{} };
  keys.forEach(k=>{ const v=localStorage.getItem(k); if(v!==null) out.data[k]=v; });
  const blob=new Blob([JSON.stringify(out,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob), a=document.createElement("a");
  const d=new Date(), stamp=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  a.href=url; a.download=`jpn-progress-${stamp}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  const st=$("#bk-status"); if(st) st.textContent=T("已导出 ✓","Exported ✓");
}
function importProgress(e){
  const file=e.target.files&&e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const obj=JSON.parse(reader.result);
      if(!obj||typeof obj.data!=="object") throw new Error(T("文件格式不符","unrecognized file format"));
      if(!confirm(T("导入会用文件里的进度覆盖同名项（不会清除文件里没有的项）。确定继续？","Importing overwrites matching items with the file's data (items not in the file are kept). Continue?"))){ return; }
      Object.keys(obj.data).forEach(k=>{ if(/^jpn-/.test(k)) localStorage.setItem(k, obj.data[k]); });
      PROG=loadProg();
      if(window.Notes && window.Notes.reload) window.Notes.reload();
      try{ setLang(getLang()); applyLang(); }catch(e){}        // R6-11: re-apply imported language…
      try{ setTheme(getTheme()); }catch(e){}                    // …and theme
      const last=parseInt(localStorage.getItem("jpn-last-day")||"1",10); STATE.day=(last>=1&&last<=TOTAL_DAYS)?last:1;
      alert(T("导入成功！进度已恢复。","Import complete — your progress has been restored."));
      closeSettings(); showPage(STATE.page);
    }catch(err){ alert(T("导入失败：","Import failed: ")+err.message); }
  };
  reader.readAsText(file);
}

/* ============================================================================
 *  GENERAL / REFERENCE PAGE
 * ==========================================================================*/
function rubyMd(s){ return toRuby(s).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>"); }
function renderBlocks(blocks, eb){
  eb=eb||[];
  return blocks.map((b,i)=>{
    const e=eb[i]||{};
    if(b.t==="p") return `<p>${rubyMd(zhen(b.zh,e.en))}</p>`;
    if(b.t==="why") return `<div class="r-why"><span class="r-why-tag">${T("🤔 为什么","🤔 Why")}</span>${rubyMd(zhen(b.zh,e.en))}</div>`;
    if(b.t==="analogy") return `<div class="r-analogy"><span class="r-an-tag">${T("🔗 类比","🔗 Analogy")}</span>${rubyMd(zhen(b.zh,e.en))}</div>`;
    if(b.t==="note") return `<div class="r-note">${rubyMd(zhen(b.zh,e.en))}</div>`;
    if(b.t==="rules") return `<ul class="r-rules">${b.items.map((it,k)=>`<li>${rubyMd(zhen(it,(e.items||[])[k]))}</li>`).join("")}</ul>`;
    if(b.t==="ex") return b.items.map((ex,k)=>`<div class="r-ex" data-jp="${esc(ex.jp)}">${toRuby(ex.jp)}<span class="zh">${esc(zhen(ex.zh,(e.items||[])[k]))}</span></div>`).join("");
    if(b.t==="table"){ const head=(LANG!=="zh"&&e.head)?e.head:b.head, rows=(LANG!=="zh"&&e.rows)?e.rows:b.rows;
      return `<div class="r-table-wrap"><table class="r-table"><thead><tr>${head.map(h=>`<th>${toRuby(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${toRuby(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`; }
    return "";
  }).join("");
}
/* ---- term glossary + auto-linker (用户反馈 #2b/2c): 把 自動詞/な形容詞/音便 等术语在词义里变成可点的解释 ---- */
const GLOSSARY = [
  {term:"自動詞", aliases:["自動詞","自动词"], def:"自动词（intransitive）：动作不带宾语、表示主体自身的变化或动作，如 開[あ]く・始[はじ]まる・変[か]わる。多与「が」搭配。↔ 他动词。", defEn:"Intransitive verb: no direct object; describes the subject's own change/action (開く・始まる・変わる). Usually takes が. ↔ transitive."},
  {term:"他動詞", aliases:["他動詞","他动词"], def:"他动词（transitive）：动作作用于宾语，需要「を」，如 開[あ]ける・始[はじ]める・変[か]える。很多自他成对：開く↔開ける。", defEn:"Transitive verb: acts on an object, needs を (開ける・始める・変える). Many pair with an intransitive: 開く↔開ける."},
  {term:"な形容詞", aliases:["な形容詞","な形容词","な形"], def:"な形容词（也叫“形容动词”）：修饰名词时加「な」（静[しず]かな町[まち]），更像名词，要靠 だ／な／です 撑。", defEn:"na-adjective (a.k.a. 'adjectival noun'): adds な before a noun (静かな町); behaves like a noun, propped up by だ／な／です."},
  {term:"い形容詞", aliases:["い形容詞","い形容词","い形"], def:"い形容词：以「い」结尾，会自己变时态（高[たか]い→高[たか]かった），更像动词。", defEn:"i-adjective: ends in い and conjugates for tense itself (高い→高かった); behaves more like a verb."},
  {term:"可能形", aliases:["可能形"], def:"可能形：表示“能/会做”。書[か]く→書[か]ける、食[た]べる→食[た]べられる、する→できる。", defEn:"Potential form: 'can / be able to.' 書く→書ける, 食べる→食べられる, する→できる."},
  {term:"受身形", aliases:["受身形","受身"], def:"受身（被动）：“被…”。書[か]く→書[か]かれる、食[た]べる→食[た]べられる；施动者用「に」。", defEn:"Passive: 'to be …ed.' 書く→書かれる, 食べる→食べられる; the agent takes に."},
  {term:"使役形", aliases:["使役形","使役"], def:"使役：“让/使…做”。書[か]く→書[か]かせる、食[た]べる→食[た]べさせる。", defEn:"Causative: 'make / let someone do.' 書く→書かせる, 食べる→食べさせる."},
  {term:"使役受身", aliases:["使役受身"], def:"使役受身：“被迫做”（不情愿）。書[か]く→書[か]かされる、食[た]べる→食[た]べさせられる。", defEn:"Causative-passive: 'be made to do' (unwillingly). 書く→書かされる, 食べる→食べさせられる."},
  {term:"音便", aliases:["音便"], def:"音便：为了顺口发生的音变，主要在第1组动词的 て形/た形：書[か]く→書[か]いて、飲[の]む→飲[の]んで、話[はな]す→話[はな]して。详见“动词的活用”。", defEn:"Euphonic change (onbin): a sound change for ease of pronunciation, mainly in Group-1 verbs' て/た forms: 書く→書いて, 飲む→飲んで, 話す→話して."}
];
function glossDef(g){ return (LANG!=="zh" && g.defEn) ? g.defEn : g.def; }
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
  return esc(String(text)).replace(glossRegex(), m=>{ const i=_glossMap[m]; const def=glossDef(GLOSSARY[i]).replace(/\[[^\]]+\]/g,""); return `<span class="gloss" data-g="${i}" title="${escAttr(def)}">${m}</span>`; });
}
function glossarySection(){
  const items=GLOSSARY.map((g,i)=>`<div class="gloss-item" id="gloss-${i}"><b>${esc(g.term)}</b> ${rubyMd(glossDef(g))}</div>`).join("");
  return `<div class="ref-section" data-id="glossary">
    <div class="ref-head"><span class="r-emoji">📖</span><h2>${T("语法术语小词典","Grammar Term Glossary")} <span class="r-zh">${T("自動詞 / な形容詞 / 音便… 在单词页点这些术语会跳到这里","自動詞 / な形容詞 / 音便… tap these terms on a vocab card to jump here")}</span></h2><span class="r-arrow">▸</span></div>
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
    <div class="ref-head"><span class="r-emoji">🗂️</span><h2>全文法インデックス <span class="r-zh">${T("全部语法点索引 · 点击跳到对应天","All grammar points · tap to jump to its day")}</span></h2><span class="r-arrow">▸</span></div>
    <div class="ref-body"><div class="gidx-grid">${items}</div></div></div>`;
}
function renderGeneral(){
  const c=$("#page-general");
  const ER=(typeof window!=="undefined"&&window.EN_REF)||{};
  let html=`<div class="ref-intro"><h1>${T("📚 基础总览","📚 General Reference")}</h1><p>${T("随时回来查阅的通用参考：五十音、动词分组与变位、形容词、助词、助数词与特殊读音、敬语速查、全语法索引、关西弁。点标题展开/收起；例句可点击朗读。","A reference to come back to anytime: the kana chart, verb groups & conjugation, adjectives, particles, counters & special readings, a keigo cheat-sheet, the full grammar index, and Kansai dialect. Tap a heading to expand/collapse; tap an example to hear it.")}</p></div>`;
  html+=(window.Gojuon?Gojuon.section():"");      // 🇯🇵 interactive kana chart, first
  REFERENCE.forEach((sec,i)=>{
    const er=ER[sec.id]||{};
    html+=`<div class="ref-section" data-id="${esc(sec.id)}">
      <div class="ref-head"><span class="r-emoji">${sec.icon}</span><h2>${esc(sec.title)} <span class="r-zh">${esc(zhen(sec.titleZh, er.titleEn))}</span></h2><span class="r-arrow">▸</span></div>
      <div class="ref-body">${renderBlocks(sec.blocks, er.blocks)}</div></div>`;
  });
  html+=glossarySection();
  html+=grammarIndexSection();
  c.innerHTML=html;
  c.querySelectorAll(".ref-head").forEach(h=>h.onclick=()=>h.parentElement.classList.toggle("open"));
  c.querySelectorAll(".r-ex").forEach(el=>el.onclick=()=>speakSequence([{text:el.dataset.jp,node:null,audioKey:"x_"+speechNorm(el.dataset.jp)}]));
  c.querySelectorAll(".gidx-item").forEach(el=>el.onclick=()=>{ STATE.day=parseInt(el.dataset.day,10); STATE.session="noon"; showPage("daily"); });
  if(window.Gojuon) Gojuon.render();             // mount the interactive kana app
}

/* ============================================================================
 *  SCENARIOS PAGE (situational Japanese)
 * ==========================================================================*/
/* split a dialogue line into an optional speaker label + the spoken body.
   "患者：すみません…" → {label:"患者", body:"すみません…"}; unlabeled → {label:"", body:jp} */
function scnSplit(jp){
  // label may carry furigana (adult lines: "看護師[かんごし]：…"), so allow up to ~14 chars
  const m=(jp||"").match(/^([^：:\n]{1,14})[：:]\s*([\s\S]*)$/);
  return m ? {label:m[1], body:m[2]} : {label:"", body:jp||""};
}
/* speaker-label localisation: keep Japanese readable for zh AND en learners (esp.
   katakana roles like フロント/トレーナー that a Chinese reader can't decode). */
const SCN_ROLE={ "患者":["患者","Patient"],"受付":["前台","Reception"],"医師":["医生","Doctor"],
  "看護師":["护士","Nurse"],"客":["客人","Customer"],"フロント":["前台","Front desk"],
  "店員":["店员","Clerk"],"トレーナー":["教练","Trainer"],"キャスト":["陪侍","Hostess"] };
function adultOn(){ try{ return localStorage.getItem("jpn-adult")==="1"; }catch(e){ return false; } }
function renderScenarios(){
  const c=$("#page-scenarios"); if(!c) return;
  const list=(typeof window!=="undefined"&&window.SCENARIOS)||[];
  const ADULT=(typeof window!=="undefined"&&window.SCENARIOS_ADULT)||{};
  const adult=adultOn();
  const roleTag=(sp,label)=>{ const p=(label||"").replace(/\[[^\]]*\]/g,"");  // strip furigana for lookup
    if(p) return SCN_ROLE[p]?esc(zhen(SCN_ROLE[p][0],SCN_ROLE[p][1])):esc(p);
    return sp==="s" ? T("店员","Staff") : T("你","You"); };
  let html=`<div class="ref-intro"><h1>${T("🗺️ 場面 · 场景日语","🗺️ Scenarios · Real-life Japanese")}</h1>
    <p>${T("按真实生活场景学：实用对话、关键词、礼仪与文化贴士。","Learn by real-life scene: practical dialogue, key words, and etiquette/culture tips.")}</p>
    <p class="tap-hint">🔊 ${T("点标题展开/收起 · 点任意单词或对话即可听真人发音（VOICEVOX）","Tap a heading to expand · tap any word or line to hear it in a real voice (VOICEVOX)")}</p>
    <div class="scn-controls">
      <label class="speed-ctl">🐢 ${T("朗读速度","Speed")} <input type="range" class="speed-range" min="0.6" max="1.4" step="0.05" value="${STATE.rate}"> 🐇 <b class="speed-val">${STATE.rate.toFixed(2)}×</b></label>
      <button id="scn-adult" class="scn-adult-btn${adult?" on":""}">🔞 ${adult?T("成人模式：开","Adult mode: ON"):T("成人模式","Adult mode")}</button>
    </div></div>`;
  if(!list.length) html+=`<p class="hc-empty">${T("场景内容尚未加载。","Scenario content not loaded yet.")}</p>`;
  list.forEach((s,i)=>{
    const adlg=(adult&&ADULT[s.id]&&ADULT[s.id].length)?ADULT[s.id]:null;
    const dlg=adlg||s.dialogue||[];
    const keyPre=adlg?`scna_${s.id}_`:`scn_${s.id}_`;
    html+=`<div class="ref-section${i===0?" open":""}" data-id="scn-${esc(s.id)}">
      <div class="ref-head"><span class="r-emoji">${s.icon||"🗺️"}</span><h2>${esc(s.title)} <span class="r-zh">${esc(LANG!=="zh"?(s.titleEn||s.titleZh||""):(s.titleZh||""))}</span></h2><span class="r-arrow">▸</span></div>
      <div class="ref-body">
        ${s.intro?`<p class="scn-intro">${esc(zhen(s.intro.zh,s.intro.en))}</p>`:""}
        ${(s.vocab&&s.vocab.length)?`<h4 class="scn-h">${T("🔑 キーワード","🔑 Key words")}</h4><div class="scn-vocab">${s.vocab.map(v=>`<div class="scn-v tappable" data-jp="${esc(v.r||v.w)}" data-key="v_${esc(speechNorm(v.r||v.w))}" title="${T('点击朗读','tap to hear')}"><b class="v-word">${esc(v.w)}</b><span class="v-read">${esc(v.r||"")}</span><span class="v-mean">${esc(zhen(v.zh,v.en))}</span><span class="tap-spk">🔊</span></div>`).join("")}</div>`:""}
        ${dlg.length?`<div class="scn-dh"><h4 class="scn-h">${T("💬 会話","💬 Dialogue")}${adlg?` <span class="scn-spicy">🔞 ${T("成人版","18+")}</span>`:""}</h4><button class="scn-playall" data-scn="${esc(s.id)}">▶ ${T("全部播放","Play all")}</button></div>
          <div class="scn-dialogue">${dlg.map((d,di)=>{const p=scnSplit(d.jp);return `<div class="scn-line sp-${d.sp==="s"?"s":"c"}" data-key="${keyPre}${di}" title="${T('点击朗读','tap to hear')}"><span class="scn-spk">${roleTag(d.sp,p.label)}</span><div class="scn-bubble">${toRuby(p.body)}<span class="zh">${esc(zhen(d.zh,d.en))}</span></div></div>`;}).join("")}</div>`:""}
        ${(s.manners&&s.manners.length)?`<h4 class="scn-h">${T("🎎 マナー・文化","🎎 Manners & Culture")}</h4><ul class="r-rules scn-manners">${s.manners.map(m=>`<li>${rubyMd(zhen(m.zh,m.en))}</li>`).join("")}</ul>`:""}
      </div></div>`;
  });
  c.innerHTML=html;
  c.querySelectorAll(".ref-head").forEach(h=>h.onclick=()=>h.parentElement.classList.toggle("open"));
  // global speed lever (one control, scales all playback site-wide)
  c.querySelectorAll(".speed-range").forEach(el=>el.oninput=e=>setRate(parseFloat(e.target.value)));
  // 🔞 adult-mode toggle (opt-in with a confirm gate; off by default)
  const ab=$("#scn-adult"); if(ab) ab.onclick=()=>{
    if(adultOn()){ try{ localStorage.setItem("jpn-adult","0"); }catch(e){} renderScenarios(); return; }
    const ok=confirm(T("成人模式：18+ 趣味擦边对话（暗示性、搞笑，非露骨），使用性感音色。仅供娱乐。确定开启？",
                      "Adult mode: 18+ playful, suggestive dialogue (innuendo & comedy, not explicit) with sultry voices. For fun only. Enable?"));
    if(ok){ try{ localStorage.setItem("jpn-adult","1"); }catch(e){} renderScenarios(); }
  };
  // vocab + single dialogue line → play that one clip, highlighting the element
  c.querySelectorAll(".scn-v,.scn-line").forEach(el=>el.onclick=()=>
    speakSequence([{text:el.dataset.jp||"",node:el,audioKey:el.dataset.key}]));
  // play the whole conversation, each line highlighting as it speaks
  c.querySelectorAll(".scn-playall").forEach(btn=>btn.onclick=(e)=>{
    e.stopPropagation();
    const sec=btn.closest(".ref-section"), lines=[...sec.querySelectorAll(".scn-line")];
    speakSequence(lines.map(el=>({text:el.dataset.jp||"",node:el,audioKey:el.dataset.key})));
  });
}

/* ============================================================================
 *  TEST PAGE
 * ==========================================================================*/
function loadTestBest(){ try{ return JSON.parse(localStorage.getItem("jpn-test-best"))||{}; }catch(e){ return {}; } }
function saveTestBest(id,score,total){ const b=loadTestBest(); if(!b[id]||score>b[id].score){ b[id]={score,total}; localStorage.setItem("jpn-test-best",JSON.stringify(b)); } }
/* append a timestamped score attempt to a capped log → lets the pet SEE real progress
   (improvement over time), not just activity. key: "jpn-test-log" | "jpn-pron-log". */
function pushScoreLog(key, entry){
  try{ const a=JSON.parse(localStorage.getItem(key))||[]; a.push(Object.assign({ts:Date.now()},entry));
    while(a.length>200) a.shift(); localStorage.setItem(key, JSON.stringify(a)); }catch(e){}
}

let TEST=null;   // { def, answers[], remaining, interval, submitted }

/* ---- 错题本 / Mistakes notebook: auto-collect missed questions + targeted review ----
   Stored in jpn-wrong, keyed by question text. Missing a question adds/re-activates it;
   answering it correctly (in any test, incl. the review) marks it cleared (mastered).
   AI-generated questions (_ai) are excluded so unreviewed content is never reinforced. */
function loadWrong(){ try{ return JSON.parse(localStorage.getItem("jpn-wrong"))||{}; }catch(e){ return {}; } }
function saveWrong(w){ try{ localStorage.setItem("jpn-wrong", JSON.stringify(w)); }catch(e){} }
function wrongKey(q){ return (q&&q.q?String(q.q):"").replace(/\s+/g,"").slice(0,120); }
const WRONG_CATNAME={ "文法":["文法","Grammar"], "語彙":["語彙","Vocabulary"], "読解":["読解","Reading"] };
function wrongCatLabel(c){ const m=WRONG_CATNAME[c]; return m?T(m[0],m[1]):c; }
function wrongOutstanding(){ const w=loadWrong(); return Object.keys(w).filter(k=>!w[k].cleared).map(k=>Object.assign({key:k},w[k])); }
function recordWrongAnswers(d){
  if(!d||!d.questions||!TEST) return;
  const w=loadWrong(); let changed=false;
  d.questions.forEach((q,i)=>{
    if(q._ai) return;                                  // never reinforce unreviewed AI questions
    const key=wrongKey(q); if(!key) return;
    const got=TEST.answers[i];
    if(got===q.answer){
      if(w[key] && !w[key].cleared){ w[key].cleared=true; w[key].clearedTs=Date.now(); changed=true; }
    } else {
      const prev=w[key]||{};
      const enExp = (d.isMock||d.isReview) ? (q._explainEn||"") : (((ENT(d.id).q||[])[i]||{}).explainEn||"");
      w[key]=Object.assign({}, prev, {
        q:q.q, options:q.options, answer:q.answer, cat:q.cat, point:q.point, day:q.day||0,
        explain:q.explain, explainEn:prev.explainEn||enExp, srcTitle:d.title||prev.srcTitle||"",
        misses:(prev.misses||0)+1, cleared:false, lastTs:Date.now()
      });
      changed=true;
    }
  });
  if(changed){
    const keys=Object.keys(w);
    if(keys.length>300){ keys.sort((a,b)=>(w[a].lastTs||0)-(w[b].lastTs||0)).slice(0,keys.length-300).forEach(k=>{ if(w[k].cleared) delete w[k]; }); }
    saveWrong(w);
  }
}
function buildWrongReview(){
  const items=wrongOutstanding(); if(!items.length) return null;
  const pick=shuffled(items).slice(0,20).map(it=>({ q:it.q, options:it.options, answer:it.answer, cat:it.cat, point:it.point, day:it.day, explain:it.explain, _explainEn:it.explainEn }));
  return { id:"wrong", isReview:true, title:T("📕 错题复习","📕 Mistake Review"), timeMin:Math.max(5,Math.ceil(pick.length*0.8)), questions:pick };
}

function renderTestHome(){
  if(TEST&&TEST.interval) clearInterval(TEST.interval);
  TEST=null;
  const c=$("#page-test"); const best=loadTestBest();
  const mb=best["mock"], aiN=(window.Exam&&Exam.aiCount)?Exam.aiCount():0;
  const wrongN=wrongOutstanding().length;
  const aiKey=!!(window.Assistant&&window.Assistant.hasKey&&window.Assistant.hasKey());
  let html=`<div class="test-intro"><h1>${T("📝 N2 考试中心","📝 N2 Exam Center")}</h1><p>${T("「考前指导」把考试吃透；「模拟考」按真实结构＋JLPT 计分练笔试；「官方样题」是最接近真题的官方材料（含真实听力音频）。下面的周测可日常快速诊断。","Read the Guide; drill the Mock (real structure + JLPT scoring, written part); use Official Samples — the most authentic material, with real listening audio. Weekly sets below are quick diagnostics.")}</p></div>
    <div class="exam-hub">
      <button class="exam-hub-card guide" id="exam-go-guide"><span class="ehc-ico">📋</span><span class="ehc-tt">${T("考前指导","Exam Guide")}</span><span class="ehc-d">${T("结构 / 时间 / 评分 / 合格线 / 应试技巧 / 当天流程","structure · timing · scoring · pass · tactics · day-of")}</span></button>
      <button class="exam-hub-card mock" id="exam-go-mock"><span class="ehc-ico">🎯</span><span class="ehc-tt">${T("模拟考","Mock Exam")}</span><span class="ehc-d">${T("真实题型顺序 ＋ JLPT 计分（笔试部分，不含听力）","real section order + JLPT score (written part; no listening)")}${mb?` · ${T("最佳","best")} ${mb.score}/${mb.total}`:""}${aiN?` · ✨${T("已扩充","+AI")} ${aiN}`:""}</span></button>
      <button class="exam-hub-card listen" id="exam-go-listen"><span class="ehc-ico">🎧</span><span class="ehc-tt">${T("听力练习","Listening")}</span><span class="ehc-d">${T("真人配音短对话 ＋ 选择 ＋ 脚本（站内练习）","voiced short dialogues + MCQ + transcript (in-app)")}</span></button>
      <button class="exam-hub-card official" id="exam-go-official"><span class="ehc-ico">📚</span><span class="ehc-tt">${T("官方样题","Official Samples")}</span><span class="ehc-d">${T("JLPT 官网免费样题 · 含真实听力音频","Official JLPT samples · real listening audio")}</span></button>
      <button class="exam-hub-card wrong" id="exam-go-wrong"><span class="ehc-ico">📕</span><span class="ehc-tt">${T("错题本","Mistakes")}</span><span class="ehc-d">${T("做错的题自动收集 · 针对性复习","missed questions auto-collected · targeted review")}${wrongN?` · <b>${wrongN}</b> ${T("待复习","to review")}`:""}</span></button>
    </div>
    <div class="exam-aiexpand">${aiKey?`<button id="exam-ai-gen">✨ ${T("用 AI 把模拟卷扩充到完整长度","Expand the mock to full length with AI")}</button><span id="exam-ai-stat" class="exam-ai-stat"></span>`:`<span class="exam-ai-stat">${T("💡 在 ⚙ 填入 Claude Key，即可用 AI 把模拟卷扩充到完整长度（生成更多新题）。","💡 Add a Claude key in ⚙ to expand the mock to full length with AI-generated questions.")}</span>`}</div>
    <h2 class="test-sub">${T("📝 周测 · 快速练习","📝 Weekly sets · quick practice")}</h2>
    <div class="test-grid">`;
  TESTS.forEach(t=>{
    const b=best[t.id], et=ENT(t.id);
    html+=`<div class="test-card" data-id="${t.id}">
      <span class="tc-lv">${esc(t.level)}</span>
      <h3>${esc(t.title)}</h3>
      <div class="tc-meta">${esc(zhen(t.titleZh, et.titleEn))}</div>
      <div class="tc-meta">⏱ ${t.timeMin} ${T("分钟","min")} · ${t.questions.length} ${T("题","Q")}</div>
      <div class="tc-desc">${esc(zhen(t.desc, et.descEn))}</div>
      ${b?`<div class="tc-best">${T("★ 最佳：","★ Best: ")}${b.score}/${b.total}（${Math.round(b.score/b.total*100)}%）</div>`:`<div class="tc-best" style="color:var(--ink-faint)">${T("尚未挑战","Not attempted")}</div>`}
    </div>`;
  });
  html+=`</div>`;
  c.innerHTML=html;
  if($("#exam-go-guide")) $("#exam-go-guide").onclick=()=>renderExamGuide();
  if($("#exam-go-mock")) $("#exam-go-mock").onclick=()=>{ if(window.Exam) startTest(Exam.buildFullMock()); };
  if($("#exam-go-official")) $("#exam-go-official").onclick=()=>renderExamOfficial();
  if($("#exam-go-listen")) $("#exam-go-listen").onclick=()=>renderExamListening();
  if($("#exam-go-wrong")) $("#exam-go-wrong").onclick=()=>renderMistakes();
  const gen=$("#exam-ai-gen");
  if(gen) gen.onclick=async()=>{
    if(!window.Exam||!Exam.generateAI) return; gen.disabled=true; const st=$("#exam-ai-stat");
    if(st) st.textContent=T("AI 出题中…（约 1 分钟）","AI is writing questions… (~1 min)");
    try{ const n=await Exam.generateAI(cat=>{ if(st) st.textContent=T("正在生成：","Generating: ")+cat+"…"; });
      if(st) st.textContent=n?("✓ "+T("已新增","Added ")+n+T(" 题，模拟卷已扩充","Q — mock expanded")):T("（这次没生成成功，请重试）","(nothing generated — try again)");
    }catch(e){ if(st) st.textContent=T("（生成失败）","(generation failed)"); }
    gen.disabled=false; setTimeout(()=>{ if(STATE.page==="test") renderTestHome(); },1600);
  };
  c.querySelectorAll(".test-card").forEach(card=>card.onclick=()=>startTest(parseInt(card.dataset.id,10)));
}
function renderExamGuide(){
  const c=$("#page-test"); if(!window.Exam) return;
  c.innerHTML=Exam.guideHTML();
  c.querySelectorAll("#exam-back,#exam-back2").forEach(b=>b.onclick=()=>renderTestHome());
  window.scrollTo({top:0,behavior:"smooth"});
}
function renderExamOfficial(){
  const c=$("#page-test"); if(!window.Exam) return;
  c.innerHTML=Exam.officialHTML();
  c.querySelectorAll("#exam-back,#exam-back2").forEach(b=>b.onclick=()=>renderTestHome());
  window.scrollTo({top:0,behavior:"smooth"});
}
function renderExamListening(){
  const c=$("#page-test"); if(window.Exam&&Exam.renderListening) Exam.renderListening(c);
}
function renderMistakes(){
  const c=$("#page-test"); const w=loadWrong();
  const all=Object.keys(w).map(k=>Object.assign({key:k},w[k]));
  const out=all.filter(x=>!x.cleared).sort((a,b)=>(b.lastTs||0)-(a.lastTs||0));
  const cleared=all.filter(x=>x.cleared);
  let html=`<div class="exam-guide"><button class="exam-back" id="exam-back">← ${T("返回考试中心","Back to Exam Center")}</button>
    <h1>📕 ${T("错题本","Mistakes")}</h1>
    <p class="exam-lead">${T("做错的题会自动收进来；复习时答对就「掌握」并移出。AI 生成的题不计入（避免强化未审校内容）。","Missed questions are collected automatically; answer one correctly in review to clear it. AI-generated questions are excluded so unreviewed content isn't reinforced.")}</p>`;
  if(!out.length){
    html+=`<p class="hc-empty">${cleared.length?T("🎉 错题都掌握了！继续做题保持手感。","🎉 All mistakes cleared! Keep practicing to stay sharp."):T("还没有错题。做几套周测或模拟考，做错的题会自动收进这里。","No mistakes yet. Take a weekly set or the mock — missed questions land here automatically.")}</p>`;
  } else {
    html+=`<div class="wrong-top"><button id="wrong-review" class="primary">📕 ${T("复习错题","Review mistakes")}（${Math.min(20,out.length)}）</button>
      <span class="wrong-stat">${T("待复习","To review")} <b>${out.length}</b> · ${T("已掌握","Cleared")} ${cleared.length}</span></div>`;
    const byCat={}; out.forEach(x=>{ (byCat[x.cat]=byCat[x.cat]||[]).push(x); });
    Object.keys(byCat).forEach(cat=>{
      html+=`<h2 class="test-sub">${esc(wrongCatLabel(cat))} · ${byCat[cat].length}</h2><div class="wrong-list">`;
      byCat[cat].forEach(x=>{
        const correct=(x.options&&x.options[x.answer]!=null)?x.options[x.answer]:"";
        const dayLink = x.day ? ` <a data-day="${x.day}">→ ${T("复习 Day "+x.day,"Review Day "+x.day)}</a>` : "";
        html+=`<div class="wrong-item"><div class="wi-q">${toRuby(x.q)}</div>
          <div class="wi-a">${T("正解","Answer")}：<b>${toRuby(correct)}</b>${x.misses>1?` · ${T("错了","missed")} ${x.misses}×`:""}</div>
          <div class="wi-exp"><span class="gp">${esc(x.point||"")}</span> — ${toRuby(zhen(x.explain, x.explainEn||""))}${dayLink}</div>
          <button class="wi-clear" data-key="${escAttr(x.key)}">✓ ${T("标记已掌握","Mark cleared")}</button></div>`;
      });
      html+=`</div>`;
    });
    if(cleared.length) html+=`<details class="ai-guide"><summary>${T("已掌握","Cleared")} (${cleared.length})</summary><div class="wrong-list">`+cleared.map(x=>`<div class="wrong-item cleared"><div class="wi-q">${toRuby(x.q)}</div></div>`).join("")+`</div></details>`;
  }
  html+=`<button class="exam-back" id="exam-back2">← ${T("返回考试中心","Back to Exam Center")}</button></div>`;
  c.innerHTML=html;
  c.querySelectorAll("#exam-back,#exam-back2").forEach(b=>b.onclick=()=>renderTestHome());
  const rv=$("#wrong-review"); if(rv) rv.onclick=()=>{ const def=buildWrongReview(); if(def) startTest(def); };
  c.querySelectorAll(".wi-clear").forEach(b=>b.onclick=()=>{ const wl=loadWrong(), k=b.dataset.key; if(wl[k]){ wl[k].cleared=true; wl[k].clearedTs=Date.now(); saveWrong(wl); } renderMistakes(); });
  c.querySelectorAll("#page-test a[data-day]").forEach(a=>a.onclick=()=>{ STATE.day=+a.dataset.day; STATE.session="noon"; showPage("daily"); });
  window.scrollTo({top:0,behavior:"smooth"});
}

function shuffled(arr){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function startTest(idOrDef){
  const def=(idOrDef&&typeof idOrDef==="object") ? idOrDef : TESTS.find(t=>t.id===idOrDef);
  if(!def) return;
  TEST={ def, answers:new Array(def.questions.length).fill(null), remaining:def.timeMin*60, interval:null, submitted:false,
         order:def.questions.map(()=>shuffled([0,1,2,3])) };  // display order of options per question
  renderQuiz();
  TEST.interval=setInterval(()=>{ if(!TEST){return;} TEST.remaining--; updateTimer(); if(TEST.remaining<=0) finishTest(true); },1000);
}

function renderQuiz(){
  const c=$("#page-test"); const d=TEST.def;
  let html=`<div class="quiz-bar"><span class="q-title">${esc(d.title)}</span><span class="q-count" id="q-count"></span><span class="timer" id="timer">--:--</span><button id="quit-test">${T("退出","Quit")}</button></div>`;
  if(d.isMock && d.aiCount) html+=`<div class="mock-aiwarn">${T(`⚠️ 本卷含 ${d.aiCount} 道 AI 生成题（<b>未审校</b>，可能有误），仅作额外练习；权威满分卷请用「官方样题」。`,`⚠️ This paper contains ${d.aiCount} AI-generated questions (<b>unreviewed</b>, may contain errors) — extra practice only; for authoritative material use the Official Samples.`)}</div>`;
  d.questions.forEach((q,i)=>{
    const optsHtml=TEST.order[i].map((origJ,pos)=>`<div class="q-opt" data-i="${i}" data-j="${origJ}"><span class="mark">${"ABCD"[pos]}</span><span>${toRuby(q.options[origJ])}</span></div>`).join("");
    html+=`<div class="q-card" data-i="${i}"><span class="q-num">${T("問","Q")} ${i+1}</span><span class="q-cat">${esc(LANG!=="zh"?(CAT_EN[q.cat]||q.cat):q.cat)}</span>${q._ai?`<span class="q-aitag">✨ ${T("AI·未审校","AI·unreviewed")}</span>`:""}
      <div class="q-text">${toRuby(q.q)}</div>
      <div class="q-opts">${optsHtml}</div>
      <div class="q-explain" id="exp-${i}"></div></div>`;
  });
  html+=`<button class="submit-test" id="submit-test">${T("提出する · 交卷并评分","提出する · Submit & Score")}</button>`;
  c.innerHTML=html;
  c.querySelectorAll(".q-opt").forEach(opt=>opt.onclick=()=>{
    if(TEST.submitted) return;
    const i=+opt.dataset.i, j=+opt.dataset.j;
    TEST.answers[i]=j;
    document.querySelectorAll(`.q-opt[data-i="${i}"]`).forEach(o=>o.classList.remove("sel"));
    opt.classList.add("sel"); updateCount();
  });
  $("#submit-test").onclick=()=>finishTest(false);
  $("#quit-test").onclick=()=>{ if(confirm(T("退出测试？本次进度不会保存。","Quit the test? This attempt won't be saved."))){ clearInterval(TEST.interval); TEST=null; renderTestHome(); } };
  updateTimer(); updateCount();
}
function updateTimer(){ const t=$("#timer"); if(!t||!TEST) return; const m=Math.floor(TEST.remaining/60), s=TEST.remaining%60; t.textContent=`${m}:${String(s).padStart(2,"0")}`; t.classList.toggle("warn",TEST.remaining<=30); }
function updateCount(){ const e=$("#q-count"); if(!e||!TEST) return; e.textContent=`${T("已答","Answered")} ${TEST.answers.filter(a=>a!==null).length}/${TEST.def.questions.length}`; }

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
    const okTxt = got===q.answer?`<span style="color:var(--good)">✓ ${T("正解","Correct")}</span>`:(got===null?`<span style="color:var(--ink-faint)">— ${T("未作答","Unanswered")}</span>`:`<span style="color:var(--bad)">✗ ${T("不正解","Incorrect")}</span>`);
    const correctLetter="ABCD"[TEST.order[i].indexOf(q.answer)];
    const eq=(ENT(d.id).q||[])[i]||{};
    const enExp = (d.isMock||d.isReview) ? (q._explainEn||"") : (eq.explainEn||"");   // R6-5: mock/review carry their own EN explain
    const dayLink = q.day ? ` <a data-day="${q.day}">→ ${T("复习 Day "+q.day,"Review Day "+q.day)}</a>` : "";  // R6-8: no link for AI day:0
    const aiMark = q._ai ? ` <span class="q-aimark">✨ ${T("AI·未审校","AI·unreviewed")}</span>` : "";
    exp.innerHTML=`<div>${okTxt} · ${T("正解","Answer")}：${correctLetter}</div><div><span class="gp">${esc(q.point)}</span>${aiMark} — ${toRuby(zhen(q.explain, enExp))}${dayLink}</div>`;
    exp.classList.add("show");
  });
  recordWrongAnswers(d);                                                   // 错题本: collect misses / clear mastered
  showEvaluation(auto);
  const score=d.questions.reduce((s,q,i)=>s+(TEST.answers[i]===q.answer?1:0),0);
  if(!d.isReview) saveTestBest(d.id,score,d.questions.length);             // review (id "wrong") isn't a real set → no phantom best
  pushScoreLog("jpn-test-log",{id:d.id,score,total:d.questions.length});   // attempt history → pet progress
  if(window.Pet) Pet.onStudy();
  document.querySelectorAll("#page-test a[data-day]").forEach(a=>a.onclick=()=>{ STATE.day=+a.dataset.day; STATE.session="noon"; showPage("daily"); });
  window.scrollTo({top:0,behavior:"smooth"});
}

function showEvaluation(auto){
  const d=TEST.def, total=d.questions.length;
  const score=d.questions.reduce((s,q,i)=>s+(TEST.answers[i]===q.answer?1:0),0);
  if(d.isMock && window.Exam){                       // realistic mock → JLPT-style result
    const res=Exam.scoreMock(d, TEST.answers);
    const used=d.timeMin*60-Math.max(0,TEST.remaining), tm=Math.floor(used/60), ts=used%60;
    const html=`<div class="eval-box mock">${Exam.resultHTML(res)}
      <div class="eval-sub">${score}/${total} ${T("题答对","correct")} · ${T("用时","time")} ${tm}:${String(ts).padStart(2,"0")}${auto?T(" · ⏰ 时间到，自动交卷"," · ⏰ time up, auto-submitted"):""}</div>
      <div class="eval-actions"><button class="review" id="ev-review">${T("查看逐题解析 ↓","See per-question review ↓")}</button><button class="retry" id="ev-retry">${T("再考一次","Retry")}</button></div></div>`;
    $("#page-test").insertAdjacentHTML("afterbegin",html);
    $("#ev-retry").onclick=()=>{ if(window.Exam) startTest(Exam.buildFullMock()); };
    $("#ev-review").onclick=()=>{ const q=document.querySelector(".q-card"); if(q) q.scrollIntoView({behavior:"smooth"}); };
    return;
  }
  const pct=Math.round(score/total*100), passed=pct>=60;
  const cats={};
  d.questions.forEach((q,i)=>{ const c=q.cat; (cats[c]=cats[c]||{n:0,ok:0,wrong:[]}); cats[c].n++; if(TEST.answers[i]===q.answer) cats[c].ok++; else cats[c].wrong.push({point:q.point,day:q.day}); });
  const cd=c=>LANG!=="zh"?(CAT_EN[c]||c):c;
  let catRows="";
  Object.keys(cats).forEach(c=>{ const o=cats[c], p=Math.round(o.ok/o.n*100); catRows+=`<div class="row"><span class="lab">${esc(cd(c))}</span><div class="bar"><i style="width:${p}%"></i></div><span class="pct">${o.ok}/${o.n}</span></div>`; });
  const strong=Object.keys(cats).filter(c=>cats[c].ok/cats[c].n>=0.8);
  const weak=Object.keys(cats).filter(c=>cats[c].ok/cats[c].n<0.6);
  let advice="";
  if(strong.length) advice+=`<p class="good">${T("👍 表现不错：","👍 Solid: ")}${strong.map(cd).join("、")}${T("——这些方面已经比较稳。","")}</p>`;
  if(weak.length) advice+=`<p class="weak">${T("📌 需要加强：","📌 Needs work: ")}${weak.map(cd).join("、")}。</p>`;
  const wrong=[]; Object.values(cats).forEach(o=>o.wrong.forEach(w=>wrong.push(w)));
  if(wrong.length) advice+=`<p>${T("重点复习这些语法点：","Review these grammar points:")}</p><p>`+wrong.map(w=>`<a data-day="${w.day}">${esc(w.point)}（Day ${w.day}）</a>`).join("　·　")+`</p>`;
  else advice+=`<p class="good">${T("全部答对！🎉 可以挑战下一套更难的。","All correct! 🎉 Try the next set.")}</p>`;
  const used=d.timeMin*60-Math.max(0,TEST.remaining), tm=Math.floor(used/60), ts=used%60;
  const html=`<div class="eval-box">
    <div class="eval-score"><div class="big ${passed?"pass":"fail"}">${pct}%</div>
      <div class="sub">${score} / ${total} ${T("正解","correct")} · ${T("用时","time")} ${tm}:${String(ts).padStart(2,"0")}${auto?T(" · ⏰ 时间到，自动交卷"," · ⏰ time up, auto-submitted"):""} · ${passed?T("达到合格线 (60%) ✓","Passed (60%) ✓"):T("未达合格线 (60%)","Below pass (60%)")}</div></div>
    <div class="eval-cat">${catRows}</div>
    <div class="eval-advice">${advice}</div>
    <div class="eval-actions"><button class="review" id="ev-review">${T("查看逐题解析 ↓","See per-question review ↓")}</button><button class="retry" id="ev-retry">${T("重做这套","Retry")}</button></div>
  </div>`;
  $("#page-test").insertAdjacentHTML("afterbegin",html);
  $("#ev-retry").onclick=()=>{ if(d.isReview){ const def=buildWrongReview(); if(def) startTest(def); else renderMistakes(); } else startTest(d.id); };
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
  applyLang();
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
