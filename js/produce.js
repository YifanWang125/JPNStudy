/* ============================================================================
 *  産出 (Output) — a DEDICATED production gym, separate from the per-day 練習 tab
 *  (which stays). Closes the receptive→productive gap the user named: he can read
 *  & listen, but struggles to PRODUCE (build sentences, write paragraphs, speak).
 *  Three drills, drawing on ALL studied content (days the user has touched):
 *    ✍️ 造句  — a ladder: 替换(swap) → 引导(guided) → 自由(free, about your life) → 词汇(combine)
 *    📝 段落  — write a short paragraph (describe your day / self-intro / retell a passage)
 *    🎤 説    — SPEAK your answer (Web Speech → transcript); graded on CONTENT not pronunciation
 *  Free output is Claude-graded (BYOK via window.Assistant); offline → show a model /
 *  "keep producing" so it's never a dead end. Reps feed the pet's progress growth.
 * ==========================================================================*/
(function(){
  "use strict";
  const T=(z,e)=>{ const L=window.LANG; if(L==="ja") return (e!=null&&window.JA_UI&&window.JA_UI[e]!=null)?window.JA_UI[e]:(e!=null?e:z); return (L==="en"&&e!=null)?e:z; };
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const ruby=s=>window.toRuby?window.toRuby(s):esc(s);
  const plain=s=>String(s||"").replace(/\[[^\]]*\]/g,"");
  const aiOn=()=>!!(window.Assistant&&window.Assistant.hasKey&&window.Assistant.hasKey());
  function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  const lessons=()=> (typeof LESSONS!=="undefined"?LESSONS:[]);
  const prog=()=> (typeof PROG!=="undefined"?PROG:{});

  let DRILL="sentence", CARDS=null, BUSY=false;

  /* ---------- which content has the user actually studied ---------- */
  function studiedPool(){
    const P=prog(), G=[], V=[], themes=[]; let days=[];
    lessons().forEach(l=>{ if(l&&!l.planned){ const p=P[l.day]; if(p&&(p.morning||p.noon||p.night)) days.push(l.day); } });
    if(!days.length){ const f=lessons().find(l=>l&&!l.planned); if(f) days=[f.day]; }   // nothing done yet → day 1
    days.forEach(d=>{ const l=lessons()[d-1]; if(!l) return;
      (l.grammar||[]).forEach(g=>{ if(g&&g.point) G.push({point:g.point, zh:g.zh, en:g.en, ex:(g.examples&&g.examples[0]&&g.examples[0].jp)||""}); });
      (l.vocab||[]).forEach(v=>{ if(v&&v.w) V.push(v); });
      if(l.theme) themes.push({theme:l.theme, day:d});
    });
    return {G,V,themes,days};
  }

  /* ---------- ✍️ sentence ladder ---------- */
  function sentenceCards(){
    const {G,V}=studiedPool(); const Gs=shuffle(G), Vs=shuffle(V), out=[];
    if(Gs[0]&&Gs[0].ex) out.push({kind:"sub", grammar:Gs[0].point, model:Gs[0].ex, show:Gs[0].ex,
      q:T("照着下面这句的结构，换上你自己的内容，改写一句：","Following the structure below, rewrite one with your own content:")});
    if(Gs[1]) out.push({kind:"guided", grammar:Gs[1].point, hint:Gs[1].zh, model:Gs[1].ex,
      q:T(`用「${plain(Gs[1].point)}」造一句话。`,`Make a sentence using 「${plain(Gs[1].point)}」.`)});
    if(Gs[2]) out.push({kind:"free", grammar:Gs[2].point, model:Gs[2].ex,
      q:T(`用「${plain(Gs[2].point)}」说一句你自己的事（今天 / 最近 / 你的生活）。`,`Use 「${plain(Gs[2].point)}」 to say something about YOUR life (today / recently).`)});
    if(Vs[0]&&Vs[1]) out.push({kind:"vocab", words:[Vs[0],Vs[1]],
      q:T(`用「${Vs[0].w}」和「${Vs[1].w}」造一句话。`,`Make a sentence using 「${Vs[0].w}」 and 「${Vs[1].w}」.`)});
    return out;
  }
  const SENT_TAG={sub:["替换","Swap","order"],guided:["引导","Guided","compose"],free:["自由·说自己","Free","scene"],vocab:["词汇","Vocab","cloze"]};

  /* ---------- 📝 paragraph prompts ---------- */
  function paraPrompt(){
    const {themes}=studiedPool(); const opts=[
      {q:T("用日语写 3–5 句，说说你今天做了什么。","In Japanese, write 3–5 sentences about what you did today.")},
      {q:T("用日语写一小段自我介绍（名字 / 工作 / 爱好 / 为什么学日语）。","Write a short self-introduction in Japanese (name / job / hobbies / why you study Japanese).")},
      {q:T("用日语写一段，说说你周末通常怎么过。","Write a paragraph in Japanese about how you usually spend your weekend.")},
    ];
    if(themes.length){ const t=shuffle(themes)[0];
      opts.push({q:T(`用学过的语法，写一段你对「${t.theme}」的想法。`,`Using grammar you've learned, write a paragraph with your thoughts on 「${t.theme}」.`)});
      opts.push({q:T(`把 Day ${t.day} 的课文，用你自己的话简单复述一段。`,`Briefly retell the Day ${t.day} passage in your own words.`), retellDay:t.day});
    }
    return shuffle(opts)[0];
  }

  /* ---------- 🎤 speaking prompts ---------- */
  const SPEAK=[
    {jp:"今日[きょう]は何[なに]をしましたか？", zh:"今天你做了什么？", en:"What did you do today?"},
    {jp:"週末[しゅうまつ]の予定[よてい]を 教[おし]えてください。", zh:"说说你周末的计划。", en:"Tell me your plans for the weekend."},
    {jp:"簡単[かんたん]な自己紹介[じこしょうかい]を してください。", zh:"做个简短的自我介绍。", en:"Please give a short self-introduction."},
    {jp:"好[す]きな食[た]べ物[もの]について 話[はな]してください。", zh:"说说你喜欢的食物。", en:"Talk about a food you like."},
    {jp:"最近[さいきん]、うれしかったことは 何[なん]ですか？", zh:"最近有什么开心的事？", en:"What's something that made you happy recently?"},
    {jp:"あなたの町[まち]について 教[おし]えてください。", zh:"介绍一下你住的地方。", en:"Tell me about the town where you live."},
  ];
  const promptZh=it=> (window.LANG==="en" ? (it.en||it.zh) : it.zh);

  /* ---------- render ---------- */
  function render(){
    const c=document.getElementById("page-produce"); if(!c) return;
    c.innerHTML=`<div class="ref-intro"><h1>${T("🗣️ 产出 · 开口说，动手写","🗣️ Output · Speak & Write")}</h1>
      <p>${T("把「看得懂」变成「说得出、写得出」——用你已经学过的内容主动造句、写段落、开口说，AI 即时批改。","Turn 'I get it' into 'I can say & write it' — actively build sentences, write paragraphs, and speak, using what you've studied; AI grades instantly.")}</p>
      ${aiOn()?"":`<p class="pr-nokey">${T("（在 ⚙ 填入 Claude Key 即可获得 AI 批改；现在也能练习并对照示范。）","(Add a Claude key in ⚙ for AI feedback; you can still practice and compare with a model.)")}</p>`}</div>
      <div class="pr-tabs">
        <button class="pr-tab${DRILL==="sentence"?" on":""}" data-d="sentence">✍️ ${T("造句","Sentences")}</button>
        <button class="pr-tab${DRILL==="para"?" on":""}" data-d="para">📝 ${T("段落","Paragraph")}</button>
        <button class="pr-tab${DRILL==="speak"?" on":""}" data-d="speak">🎤 ${T("说出来","Speak")}</button>
      </div>
      <div id="pr-body" class="pr-body"></div>`;
    c.querySelectorAll(".pr-tab").forEach(b=>b.onclick=()=>{ DRILL=b.dataset.d; CARDS=null; render(); });
    paintDrill();
  }
  function paintDrill(){ if(DRILL==="sentence") renderSentence(); else if(DRILL==="para") renderPara(); else renderSpeak(); }

  function renderSentence(){
    const body=document.getElementById("pr-body"); if(!body) return;
    if(!CARDS) CARDS=sentenceCards();
    if(!CARDS.length){ body.innerHTML=`<p class="hc-empty">${T("先去「每日」学一点内容，这里就能用学过的语法练造句。","Study a little on the Daily page first — then practice with the grammar you've learned.")}</p>`; return; }
    body.innerHTML=`<div class="pr-bar"><button class="pr-new">🎲 ${T("换一批","New set")}</button></div><div class="ex-list">`+
      CARDS.map((it,i)=>sentenceCardHTML(it,i)).join("")+`</div>`;
    body.querySelector(".pr-new").onclick=()=>{ CARDS=sentenceCards(); paintDrill(); };
    body.querySelectorAll(".ex-grade").forEach(b=>b.onclick=()=>gradeFree(+b.dataset.i,false));
    body.querySelectorAll(".ex-model").forEach(b=>b.onclick=()=>{ CARDS[+b.dataset.i]._showModel=true; paintDrill(); });
  }
  function sentenceCardHTML(it,i){
    const tg=SENT_TAG[it.kind]||["","","compose"]; const tag=T(tg[0],tg[1]);
    let h=`<div class="ex-item" data-i="${i}"><span class="ex-tag t-${tg[2]}">${tag}</span>`;
    h+=`<div class="ex-q">${esc(it.q)}${it.grammar?` <span class="ex-gp">${ruby(it.grammar)}</span>`:""}</div>`;
    if(it.show) h+=`<div class="pr-model-line">${ruby(it.show)}</div>`;
    if(it.hint) h+=`<div class="pr-hint">💡 ${esc(it.hint)}</div>`;
    h+=`<textarea class="ex-ta" data-i="${i}" rows="2" placeholder="${T('用日语写…','Write in Japanese…')}"${it._done?" disabled":""}>${esc(it._ans||"")}</textarea>`;
    h+=`<div class="ex-row"><button class="ex-grade" data-i="${i}"${it._done?" disabled":""}>${aiOn()?T("✓ 批改","✓ Check"):T("✓ 看示范","✓ Show model")}</button>`+
       `${it.model?`<button class="ex-model" data-i="${i}">${T("示范","Model")}</button>`:""}</div>`;
    if(it._fb) h+=`<div class="ex-fb ${it._ok?"ok":"no"}">${it._fb}</div>`;
    if(it._showModel&&it.model) h+=`<div class="ex-fb model">${T("示范","Model")}: ${ruby(it.model)}</div>`;
    return h+`</div>`;
  }

  function renderPara(){
    const body=document.getElementById("pr-body"); if(!body) return;
    if(!CARDS) CARDS=[Object.assign({kind:"para"}, paraPrompt())];
    const it=CARDS[0];
    body.innerHTML=`<div class="pr-bar"><button class="pr-new">🎲 ${T("换一个题","New prompt")}</button></div>
      <div class="ex-item pr-para">
        <div class="ex-q">${esc(it.q)}</div>
        ${it.retellDay?`<div class="pr-hint">💡 ${T("可以先回「每日」读一遍 Day "+it.retellDay+"，再用自己的话写。","Re-read Day "+it.retellDay+" on the Daily page first, then write it in your own words.")}</div>`:""}
        <textarea class="ex-ta pr-bigta" data-i="0" rows="6" placeholder="${T('用日语写一段…','Write a paragraph in Japanese…')}"${it._done?" disabled":""}>${esc(it._ans||"")}</textarea>
        <div class="ex-row"><button class="ex-grade" data-i="0"${it._done?" disabled":""}>${aiOn()?T("✓ 批改这段","✓ Check my paragraph"):T("✓ 完成","✓ Done")}</button></div>
        ${it._fb?`<div class="ex-fb ${it._ok?"ok":"no"}">${it._fb}</div>`:""}
      </div>`;
    body.querySelector(".pr-new").onclick=()=>{ CARDS=null; paintDrill(); };
    body.querySelector(".ex-grade").onclick=()=>gradePara();
  }

  function renderSpeak(){
    const body=document.getElementById("pr-body"); if(!body) return;
    if(!CARDS) CARDS=[Object.assign({kind:"speak"}, shuffle(SPEAK)[0])];
    const it=CARDS[0];
    const hasSR=!!(window.SpeechRecognition||window.webkitSpeechRecognition);
    body.innerHTML=`<div class="pr-bar"><button class="pr-new">🎲 ${T("换一个问题","New question")}</button></div>
      <div class="ex-item pr-speak">
        <div class="pr-prompt">${ruby(it.jp)}</div><div class="pr-prompt-zh">${esc(promptZh(it))}</div>
        <div class="pr-note">${T("用日语「说」出你的回答——这里评的是你说的内容（语法 / 用词 / 自然度），不是发音（发音去「每日」的发音练习）。","Answer OUT LOUD in Japanese — this grades WHAT you say (grammar / words / naturalness), not pronunciation (for pronunciation, use the Daily page).")}</div>
        ${hasSR
          ? `<button class="pr-mic">🎤 ${T("点我开始说","Tap to speak")}</button><div class="pr-status" id="pr-status"></div>`
          : `<div class="pr-hint">${T("此浏览器不支持语音识别（建议用 Chrome）。也可以直接打字回答：","This browser doesn't support speech recognition (Chrome works best). You can type your answer instead:")}</div>`}
        <textarea class="ex-ta" data-i="0" rows="3" placeholder="${T('你说的话会显示在这里（也可手动输入）…','What you say appears here (or type)…')}"${it._done?" disabled":""}>${esc(it._ans||"")}</textarea>
        <div class="ex-row"><button class="ex-grade" data-i="0"${it._done?" disabled":""}>${aiOn()?T("✓ 批改我说的","✓ Check what I said"):T("✓ 完成","✓ Done")}</button></div>
        ${it._fb?`<div class="ex-fb ${it._ok?"ok":"no"}">${it._fb}</div>`:""}
      </div>`;
    body.querySelector(".pr-new").onclick=()=>{ CARDS=null; paintDrill(); };
    const mic=body.querySelector(".pr-mic"); if(mic) mic.onclick=startSR;
    body.querySelector(".ex-grade").onclick=()=>gradeFree(0,true);
  }

  function startSR(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR) return;
    const ta=document.querySelector('#pr-body .ex-ta[data-i="0"]'), status=document.getElementById("pr-status"), btn=document.querySelector("#pr-body .pr-mic");
    let rec; try{ rec=new SR(); }catch(e){ if(status) status.textContent="⚠️ "+T("无法使用麦克风","Can't use the mic"); return; }
    rec.lang="ja-JP"; rec.interimResults=true; rec.maxAlternatives=1; let finalT="";
    if(status) status.textContent="🔴 "+T("听着呢…请用日语说","Listening… speak in Japanese");
    if(btn) btn.classList.add("rec");
    rec.onresult=e=>{ let interim=""; for(let k=e.resultIndex;k<e.results.length;k++){ const r=e.results[k]; if(r.isFinal) finalT+=r[0].transcript; else interim+=r[0].transcript; } if(ta) ta.value=finalT+interim; };
    rec.onerror=()=>{ if(status) status.textContent="⚠️ "+T("没听清，可手动输入","Didn't catch that — you can type instead"); if(btn) btn.classList.remove("rec"); };
    rec.onend=()=>{ if(status) status.textContent=(ta&&ta.value.trim())?("✓ "+T("识别完成，点「批改」","Got it — tap Check")):T("没听到，再试一次","Nothing heard — try again"); if(btn) btn.classList.remove("rec"); };
    try{ rec.start(); setTimeout(()=>{ try{ rec.stop(); }catch(e){} }, 15000); }
    catch(e){ if(status) status.textContent="⚠️ "+T("麦克风启动失败","Mic failed to start"); if(btn) btn.classList.remove("rec"); }
  }

  /* ---------- grading (Claude BYOK; offline = show model / encourage) ---------- */
  async function gradeFree(i, spoken){
    const it=CARDS[i], ta=document.querySelector(`#pr-body .ex-ta[data-i="${i}"]`); if(!ta) return;
    const ans=(ta.value||"").trim(); it._ans=ans; if(!ans) return;
    if(!aiOn()){ it._done=true; it._ok=true; if(it.model) it._showModel=true;
      it._fb=it.model?T("和示范比一比，注意差在哪。","Compare with the model — note the differences."):T("已记录。多写多说，越练越顺！","Logged — keep producing!"); paintDrill(); logRep(); return; }
    if(BUSY) return; BUSY=true; it._fb=T("批改中…","Checking…"); paintDrill();
    try{
      const task = spoken ? (T("質問","Question")+`: ${plain(it.jp)}`)
        : (it.q + (it.grammar?`（${T("必须用","must use")}: ${plain(it.grammar)}）`:"") + (it.words?`（${T("用到","words")}: ${it.words.map(w=>w.w).join("、")}）`:""));
      const sys=`あなたは日本語の先生。中国語母語のN2学習者の【産出（自分で作った${spoken?"発話":"文"}）】を添削する。漢字には「漢字[かな]」の形でふりがなを付ける。励ましつつ、自然で正しい日本語に直す。${spoken?"発音ではなく、内容（文法・語彙・自然さ）を見る。":""}`;
      const usr=`お題: ${task}\n学生の${spoken?"発話":"文"}:「${ans}」\n\nJSONだけ出力（前後に何も書かない）: {"ok":true/false(自然で正しいか),"fix":"自然な日本語に直した${spoken?"文":"文"}（ふりがな付き。正しければそのまま）","tip":"短い助言（中国語でOK）"}`;
      const txt=await window.Assistant.complete({system:sys, messages:[{role:"user",content:usr}], max_tokens:320});
      const m=String(txt).match(/\{[\s\S]*\}/); const j=m?JSON.parse(m[0]):{ok:true,fix:ans,tip:""};
      it._done=true; it._ok=!!j.ok;
      it._fb=`${j.ok?"⭕ "+T("いいね！","Nice!"):"✏️ "+T("こう直すと自然：","More natural:")} ${ruby(j.fix||"")}${j.tip?`<br><span class="ex-tip">${esc(j.tip)}</span>`:""}`;
    }catch(e){ it._done=true; it._ok=true; if(it.model) it._showModel=true; it._fb=T("（批改失败）和示范比一比。","(couldn't grade) compare with the model."); }
    BUSY=false; paintDrill(); logRep();
  }

  async function gradePara(){
    const it=CARDS[0], ta=document.querySelector('#pr-body .ex-ta[data-i="0"]'); if(!ta) return;
    const ans=(ta.value||"").trim(); it._ans=ans; if(!ans) return;
    if(!aiOn()){ it._done=true; it._ok=true; it._fb=T("已记录。坚持写段落，是产出能力提升最快的练习！","Logged — writing paragraphs is the fastest way to grow production. Keep at it!"); paintDrill(); logRep(); return; }
    if(BUSY) return; BUSY=true; it._fb=T("批改中…","Checking…"); paintDrill();
    try{
      const sys=`あなたは日本語の作文の先生。中国語母語のN2学習者の段落を添削する。漢字には「漢字[かな]」の形でふりがなを付ける。まず良い点を一つ、次に自然で正しい日本語に直した段落全文、最後に1〜2個の具体的な助言。`;
      const usr=`お題: ${it.q}\n学生の段落:\n「${ans}」\n\nJSONだけ出力: {"ok":true/false,"good":"良かった点（中国語でOK、1つ）","fix":"自然に直した段落（ふりがな付き）","tips":"1〜2個の助言（中国語でOK）"}`;
      const txt=await window.Assistant.complete({system:sys, messages:[{role:"user",content:usr}], max_tokens:760});
      const m=String(txt).match(/\{[\s\S]*\}/); const j=m?JSON.parse(m[0]):{ok:true,fix:ans};
      it._done=true; it._ok=!!j.ok;
      it._fb=`${j.good?`<div class="pr-good">👍 ${esc(j.good)}</div>`:""}<div>✏️ ${T("润色后：","Polished:")}<br>${ruby(j.fix||"")}</div>${j.tips?`<div class="ex-tip">${esc(j.tips)}</div>`:""}`;
    }catch(e){ it._done=true; it._ok=true; it._fb=T("（批改失败）下次再试，或对照课文。","(couldn't grade) try again, or compare with a lesson passage."); }
    BUSY=false; paintDrill(); logRep();
  }

  function logRep(){
    try{ if(window.pushScoreLog) pushScoreLog("jpn-produce-log",{kind:DRILL}); }catch(e){}
    try{ if(window.Pet&&Pet.onStudy) Pet.onStudy(); }catch(e){}
  }

  window.Produce={ render };
})();
