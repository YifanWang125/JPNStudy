/* ============================================================================
 *  練習 — PRODUCTION exercises (the missing output skill). Per-day tab; drills
 *  THAT day's grammar + vocab so you APPLY what you just learned (not just read).
 *  Types: cloze (word/particle), order (sentence building), compose (zh→jp),
 *  scene (say-it-in-context). With a BYOK Claude key → fresh, leveled items +
 *  AI grading of free answers; offline → auto-generated cloze + compose w/ model
 *  answers. Scores feed the pet's progress-growth (real output = real progress).
 * ==========================================================================*/
(function(){
  "use strict";
  const T=(z,e)=>{ const L=window.LANG; if(L==="ja") return (e!=null&&window.JA_UI&&window.JA_UI[e]!=null)?window.JA_UI[e]:(e!=null?e:z); return (L==="en"&&e!=null)?e:z; };
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const ruby=s=>window.toRuby?window.toRuby(s):esc(s);
  const plain=s=>String(s||"").replace(/\[[^\]]*\]/g,"").replace(/\s+/g,"").replace(/[。、！？]/g,"");
  function aiOn(){ return !!(window.Assistant&&window.Assistant.hasKey&&window.Assistant.hasKey()); }
  function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

  let SET=null, BUSY=false, LOGGED=false;

  /* ---------- offline generation from the lesson itself ---------- */
  function offlineSet(L){
    const items=[]; const V=(L.vocab||[]).filter(v=>v.w&&v.zh), G=(L.grammar||[]).filter(g=>g.point);
    // vocab-recall cloze: meaning → choose the Japanese word
    shuffle(V).slice(0,3).forEach(v=>{
      const distract=shuffle(V.filter(x=>x.w!==v.w)).slice(0,2).map(x=>x.w);
      const opts=shuffle([v.w,...distract]);
      items.push({ type:"cloze", q:T(`「${v.zh}」は 日本語[にほんご]で どれ？`,`Which is "${v.en||v.zh}" in Japanese?`),
        options:opts, answer:opts.indexOf(v.w), explain:`${v.w}（${v.r}）= ${v.zh}` });
    });
    // compose from grammar, with a model answer to self-check
    shuffle(G).slice(0,2).forEach(g=>{
      const model=(g.examples&&g.examples[0]&&g.examples[0].jp)||"";
      items.push({ type:"compose", grammar:g.point, zh:T(`「${g.point}」を つかって、文[ぶん]を 作[つく]ってみよう。`,`Make a sentence using ${g.point}.`),
        model });
    });
    return items;
  }

  /* ---------- Claude generation (BYOK) ---------- */
  async function claudeSet(L){
    const gram=(L.grammar||[]).map(g=>`・${g.point}：${g.zh}`).join("\n");
    const vocab=(L.vocab||[]).map(v=>`${v.w}(${v.r})=${v.zh}`).join("、");
    const sys=`あなたは日本語の出題[しゅつだい]の先生。中国語母語のN2学習者むけに、【産出（自分で作る）】を鍛える練習問題を作る。読解ではなく、文を作る・語を選ぶ練習。漢字には必ず「漢字[かな]」の形でふりがなを付ける。やさしい〜中級（N4〜N3）。`;
    const usr=`今日[きょう]の文法[ぶんぽう]:\n${gram}\n今日の単語[たんご]:${vocab}\n\n上の文法・単語を使う練習問題を6問、種類をまぜて作る。JSON配列だけを出力（前後に説明やコードブロックを書かない）。各要素は次のいずれか:\n`+
      `{"type":"cloze","q":"日本語の文（___が空所、ふりがな付き）","options":["A","B","C"],"answer":0,"explain":"なぜ正解か（中国語可）"}\n`+
      `{"type":"order","chunks":["ふりがな付きの語のかたまり",...],"answer":"正しい全文（ふりがな付き）","zh":"中文の意味"}\n`+
      `{"type":"compose","grammar":"使う文法","zh":"中文の文（これを日本語にする）","model":"模範解答（ふりがな付き）"}\n`+
      `{"type":"scene","zh":"場面の説明（中国語。この状況で日本語で一言）","model":"模範解答（ふりがな付き）"}\n`+
      `clozeとorderを各1〜2問、composeとsceneも入れること。`;
    const txt=await window.Assistant.complete({ system:sys, messages:[{role:"user",content:usr}], max_tokens:1400 });
    const m=String(txt).match(/\[[\s\S]*\]/); if(!m) throw new Error("no json");
    const arr=JSON.parse(m[0]);
    return arr.filter(x=>x&&x.type).slice(0,8);
  }

  /* ---------- render ---------- */
  function render(L){
    const body=document.getElementById("panel-body"); if(!body) return;
    LOGGED=false;
    body.innerHTML=`<div class="ex-wrap">
      <div class="ex-intro"><h2>${T("✍️ 練習[れんしゅう] · 产出练习","✍️ Practice · Produce, don't just read")}</h2>
        <p>${T("用今天的语法和单词，自己造句、选词、应对场景——把「看得懂」变成「说得出」。","Use today's grammar & vocab to build sentences, pick words, and handle situations — turn 'I understand it' into 'I can say it.'")}</p></div>
      <div class="ex-bar"><button id="ex-gen" class="ex-genbtn">🎲 ${T("新しい問題","New set")}</button><span id="ex-mode" class="ex-mode"></span><span id="ex-score" class="ex-score"></span></div>
      <div id="ex-list" class="ex-list"></div></div>`;
    document.getElementById("ex-gen").onclick=()=>load(L,true);
    if(SET && SET._day===L.day){ paint(L); } else load(L,false);
  }
  async function load(L,fresh){
    const list=document.getElementById("ex-list"), mode=document.getElementById("ex-mode");
    if(BUSY) return;
    if(aiOn()){
      BUSY=true; if(mode) mode.textContent=T("AI が問題を作成中…","AI is writing exercises…"); if(list) list.innerHTML=`<div class="ex-loading">…</div>`;
      try{ const items=await claudeSet(L); SET={items, _day:L.day, ai:true}; }
      catch(e){ SET={items:offlineSet(L), _day:L.day, ai:false}; }
      BUSY=false;
    } else { SET={items:offlineSet(L), _day:L.day, ai:false}; }
    paint(L);
  }
  function paint(L){
    const list=document.getElementById("ex-list"), mode=document.getElementById("ex-mode");
    if(mode) mode.textContent = SET.ai ? T("✨ AI 出題","✨ AI-generated") : (aiOn()?"":T("（⚙ でキーを入れると AI 出題＆添削）","(add a key in ⚙ for AI exercises & grading)"));
    if(!SET.items.length){ list.innerHTML=`<p class="hc-empty">${T("今日は問題がありません。","No exercises for today.")}</p>`; return; }
    list.innerHTML=SET.items.map((it,i)=>itemHTML(it,i)).join("");
    bind(L); score();
  }
  function itemHTML(it,i){
    const tag={cloze:T("語選[ご えら]び","Word choice"),order:T("並[なら]べ替[か]え","Build"),compose:T("作文[さくぶん]","Compose"),scene:T("場面[ばめん]","In context")}[it.type]||"";
    let inner="";
    if(it.type==="cloze"){
      inner=`<div class="ex-q">${ruby(it.q||"")}</div><div class="ex-opts">${(it.options||[]).map((o,j)=>`<button class="ex-opt" data-i="${i}" data-j="${j}"${it._done?" disabled":""}>${ruby(o)}</button>`).join("")}</div>`;
      if(it._done) inner+=`<div class="ex-fb ${it._ok?"ok":"no"}">${it._ok?"⭕ "+T("正解！","Correct!"):"✗ "+T("不正解","Not quite")} <span>${ruby(it.explain||"")}</span></div>`;
    } else if(it.type==="order"){
      inner=`<div class="ex-q">${it.zh?esc(it.zh):T("ことばを ならべて 文を つくろう","Arrange the words into a sentence")}</div>
        <div class="ex-build" data-i="${i}"></div><div class="ex-chips">${shuffle((it.chunks||[]).map((c,j)=>({c,j}))).map(o=>`<button class="ex-chip" data-i="${i}" data-j="${o.j}">${ruby(o.c)}</button>`).join("")}</div>
        <div class="ex-row"><button class="ex-check" data-i="${i}"${it._done?" disabled":""}>${T("こたえあわせ","Check")}</button><button class="ex-reset" data-i="${i}">${T("やりなおし","Reset")}</button></div>`;
      if(it._done) inner+=`<div class="ex-fb ${it._ok?"ok":"no"}">${it._ok?"⭕ "+T("正解！","Correct!"):"✗ "+T("正解は","Answer:")} ${ruby(it.answer||"")}</div>`;
    } else { // compose / scene
      inner=`<div class="ex-q">${esc(it.zh||"")}${it.grammar?` <span class="ex-gp">${ruby(it.grammar)}</span>`:""}</div>
        <textarea class="ex-ta" data-i="${i}" rows="2" placeholder="${T('日本語で書いてみよう…','Write it in Japanese…')}"${it._done?" disabled":""}>${esc(it._ans||"")}</textarea>
        <div class="ex-row"><button class="ex-grade" data-i="${i}"${it._done?" disabled":""}>${aiOn()?T("✓ 添削してもらう","✓ Check it"):T("✓ 答え合わせ","✓ Show answer")}</button>${it.model?`<button class="ex-model" data-i="${i}">${T("模範解答","Model")}</button>`:""}</div>`;
      if(it._fb) inner+=`<div class="ex-fb ${it._ok?"ok":"no"}">${it._fb}</div>`;
      if(it._showModel && it.model) inner+=`<div class="ex-fb model">${T("模範","Model")}: ${ruby(it.model)}</div>`;
    }
    return `<div class="ex-item" data-i="${i}"><span class="ex-tag t-${it.type}">${tag}</span>${inner}</div>`;
  }

  function bind(L){
    const list=document.getElementById("ex-list");
    list.querySelectorAll(".ex-opt").forEach(b=>b.onclick=()=>{ const it=SET.items[+b.dataset.i]; if(it._done) return;
      it._done=true; it._ok=(+b.dataset.j===it.answer); paint(L); });
    list.querySelectorAll(".ex-chip").forEach(b=>b.onclick=()=>{ const i=+b.dataset.i, it=SET.items[i]; it._built=it._built||[]; it._built.push(+b.dataset.j); b.style.visibility="hidden"; drawBuild(i); });
    list.querySelectorAll(".ex-reset").forEach(b=>b.onclick=()=>{ const i=+b.dataset.i; SET.items[i]._built=[]; paint(L); });
    list.querySelectorAll(".ex-check").forEach(b=>b.onclick=()=>{ const i=+b.dataset.i, it=SET.items[i]; const built=(it._built||[]).map(j=>it.chunks[j]).join("");
      it._done=true; it._ok=plain(built)===plain(it.answer); paint(L); });
    list.querySelectorAll(".ex-model").forEach(b=>b.onclick=()=>{ const it=SET.items[+b.dataset.i]; it._showModel=true; paint(L); });
    list.querySelectorAll(".ex-grade").forEach(b=>b.onclick=()=>gradeFree(L,+b.dataset.i));
    // restore built rows
    SET.items.forEach((it,i)=>{ if(it.type==="order") drawBuild(i); });
  }
  function drawBuild(i){ const it=SET.items[i]; const slot=document.querySelector(`.ex-build[data-i="${i}"]`); if(!slot) return;
    slot.innerHTML=(it._built||[]).map(j=>`<span class="ex-bchip">${ruby(it.chunks[j])}</span>`).join(""); }

  async function gradeFree(L,i){
    const it=SET.items[i], ta=document.querySelector(`.ex-ta[data-i="${i}"]`); if(!ta) return;
    const ans=(ta.value||"").trim(); it._ans=ans; if(!ans) return;
    if(!aiOn()){ it._done=true; it._ok=true; it._showModel=true; it._fb=T("自分の文と模範を くらべてみよう。","Compare your sentence with the model."); paint(L); return; }
    if(BUSY) return; BUSY=true; it._fb=T("添削中…","Checking…"); paint(L);
    try{
      const sys=`あなたは日本語の先生。中国語母語のN2学習者の作文を添削する。漢字には「漢字[かな]」の形でふりがなを付ける。`;
      const usr=`お題: ${it.zh}${it.grammar?`（文法:${it.grammar}）`:""}\n学生の答え:「${ans}」\n\nJSONだけ出力: {"ok":true/false(自然で正しいか),"fix":"自然な日本語に直した文（ふりがな付き。正しければ同じでよい）","tip":"短い助言（中国語可）"}`;
      const txt=await window.Assistant.complete({ system:sys, messages:[{role:"user",content:usr}], max_tokens:300 });
      const m=String(txt).match(/\{[\s\S]*\}/); const j=m?JSON.parse(m[0]):{ok:true,fix:ans,tip:""};
      it._done=true; it._ok=!!j.ok;
      it._fb=`${j.ok?"⭕ "+T("いいね！","Nice!"):"✏️ "+T("こう直すと自然：","More natural:")} ${ruby(j.fix||"")}${j.tip?`<br><span class="ex-tip">${esc(j.tip)}</span>`:""}`;
    }catch(e){ it._done=true; it._ok=true; it._showModel=true; it._fb=T("（採点できなかった）模範とくらべてね。","(couldn't grade) compare with the model."); }
    BUSY=false; paint(L);
  }

  function score(){
    const el=document.getElementById("ex-score"); if(!el||!SET) return;
    const done=SET.items.filter(it=>it._done), ok=done.filter(it=>it._ok);
    el.textContent = done.length ? `${ok.length}/${SET.items.length} ⭕` : "";
    if(done.length===SET.items.length && SET.items.length && !LOGGED){ LOGGED=true;
      if(window.pushScoreLog) pushScoreLog("jpn-exercise-log",{score:ok.length,total:SET.items.length});
      if(window.Pet) Pet.onStudy(); }
  }

  window.Exercises={ render };
})();
