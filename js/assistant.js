/* ============================================================================
 *  AI 学习助手 (Claude) — Phase 1: grounded, scoped text Q&A
 *
 *  BYOK: the user pastes their own Anthropic API key (⚙ 设置), stored ONLY in
 *  this browser's localStorage. The browser calls the Anthropic Messages API
 *  directly (header anthropic-dangerous-direct-browser-access). For a single
 *  personal user this key exposure is acceptable; set a spend cap on the key.
 *
 *  Grounding: every request injects (a) a compact 30-day course index so the
 *  tutor can do cross-lesson comparisons and cite where a point first appeared,
 *  and (b) the FULL current lesson. "Day N" mentions become clickable jumps.
 *
 *  Depends on globals from app.js: LESSONS, TOTAL_DAYS, STATE, SESSIONS,
 *  esc, toRuby, toPlain, speak, stopSpeak, speakSequence, showPage, render.
 * ==========================================================================*/
(function(){
  "use strict";
  const LS_CFG  = "jpn-ai-cfg";
  const API_URL = "https://api.anthropic.com/v1/messages";
  const MODELS  = [
    { id:"claude-sonnet-4-6", zh:"Sonnet 4.6（推荐 · 均衡）", en:"Sonnet 4.6 (recommended · balanced)" },
    { id:"claude-haiku-4-5",  zh:"Haiku 4.5（最快 · 最省）",  en:"Haiku 4.5 (fastest · cheapest)" },
    { id:"claude-opus-4-8",   zh:"Opus 4.8（最强 · 较贵）",   en:"Opus 4.8 (strongest · pricier)" },
  ];
  const modelName = (m)=> (typeof T==="function" ? T(m.zh,m.en) : m.zh);
  function cfg(){ try{ return JSON.parse(localStorage.getItem(LS_CFG))||{}; }catch(e){ return {}; } }
  function saveCfg(c){ try{ localStorage.setItem(LS_CFG, JSON.stringify(c)); }catch(e){} }
  function hasKey(){ return !!cfg().key; }
  function model(){ return cfg().model || MODELS[0].id; }

  /* ---------------- grounding ---------------- */
  function courseIndex(){
    return LESSONS.map(l=>{
      const g=(l.grammar||[]).map(x=>x.point).filter(p=>!/^[①-⑩\d]/.test(p)).join("、");
      const v=(l.vocab||[]).map(x=>x.w).join("、");
      return `Day${l.day}[${l.level}]「${l.theme}」 语法:${g||"—"} 词:${v||"—"}`;
    }).join("\n");
  }
  function currentLessonText(){
    const l=LESSONS[STATE.day-1]; if(!l) return "（学生暂不在某一课。）";
    const para =(l.paragraph||[]).map(s=>toPlain(s.jp)).join("");
    const vocab=(l.vocab||[]).map(v=>`${v.w}(${v.r})=${v.zh}`).join("；");
    const gram =(l.grammar||[]).map(g=>`・${g.point}：${g.zh}`).join("\n");
    const sess = (SESSIONS[STATE.session]||{}).name || STATE.session;
    return `【学生当前位置】Day${l.day}「${l.theme}」（${l.level}），${sess}环节。\n`
         + `【今日课文】${para}\n`
         + `【今日单词】${vocab}\n`
         + `【今日语法】\n${gram}`;
  }
  function systemPrompt(){
    return `你是「日语学习助手」，一位耐心、地道的日语老师。学生母语是中文，正在备考 JLPT N2；他的弱项是汉字的【读音 / 音高】，最终目标是【能开口流利说日语】。

规则：
1. 只回答与日语学习相关的问题（语法、词汇、读音/声调、表达、近义辨析、文化、考试等）。无关问题礼貌地把话题引回日语学习。
2. ${window.LANG==="ja"?"説明は主に日本語で（必要なら英語も）。":window.LANG==="en"?"Explain mainly in English.":"以中文讲解为主。"}所有日语例句都必须带振假名，格式为「漢字[かんじ]」——每个含汉字的词都要标读音（这是学生最需要的）。
3. 深入浅出：必要时用中文或英文类比帮助理解；助词、近义词要做对比辨析。
4. 学生常把正在学的语法和以前学过的联系起来提问（例如「〜ています」的 て 和「〜てから」的 て），请主动对比、点明区别。
5. 当你提到的语法点或单词在课程里出现过，请用「Day N」(N 为数字) 注明它最早出现在第几天，方便学生跳回原文复习。可参考下面的课程索引判断。
6. 回答简洁、有重点、多给例句，并鼓励他开口说。

—— 学生的 30 天课程索引（用于跨课对比与“最早出现在第几天”）——
${courseIndex()}`;
  }

  /* ---------------- Anthropic Messages API (streaming) ---------------- */
  async function callClaude(messages, onDelta){
    const c=cfg();
    const body={
      model: model(),
      max_tokens: 1500,
      system: systemPrompt() + "\n\n" + currentLessonText(),
      messages: messages,
      stream: true,
    };
    const resp=await fetch(API_URL, {
      method:"POST",
      headers:{
        "content-type":"application/json",
        "x-api-key": c.key,
        "anthropic-version":"2023-06-01",
        "anthropic-dangerous-direct-browser-access":"true",
      },
      body: JSON.stringify(body),
    });
    if(!resp.ok || !resp.body){
      let detail=""; try{ const j=await resp.json(); detail=(j.error&&j.error.message)||JSON.stringify(j); }catch(e){ detail=resp.statusText; }
      throw new Error(`${resp.status} ${detail}`.slice(0,400));
    }
    const reader=resp.body.getReader(), dec=new TextDecoder();
    let buf="", full="";
    while(true){
      const {done,value}=await reader.read(); if(done) break;
      buf+=dec.decode(value,{stream:true});
      let nl;
      while((nl=buf.indexOf("\n"))>=0){
        const line=buf.slice(0,nl).trim(); buf=buf.slice(nl+1);
        if(!line.startsWith("data:")) continue;
        const d=line.slice(5).trim(); if(!d) continue;
        let j; try{ j=JSON.parse(d); }catch(_){ continue; }
        if(j.type==="content_block_delta" && j.delta && typeof j.delta.text==="string"){ full+=j.delta.text; onDelta(full); }
        else if(j.type==="error"){ throw new Error((j.error&&j.error.message)||"stream error"); }
      }
    }
    return full;
  }

  /* ---------------- general one-shot completion (reused by the pet's agent) ----------------
     Non-streaming; takes a CUSTOM system prompt (not the tutor one). Cheap model by default. */
  async function complete({ system, messages, model:mdl, max_tokens }){
    const c=cfg(); if(!c.key) throw new Error("no API key");
    const resp=await fetch(API_URL, {
      method:"POST",
      headers:{ "content-type":"application/json", "x-api-key":c.key,
        "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
      body: JSON.stringify({ model: mdl||model(), max_tokens: max_tokens||400,
        system: system||"", messages: messages||[] }),
    });
    if(!resp.ok){ let d=""; try{ const j=await resp.json(); d=(j.error&&j.error.message)||""; }catch(e){} throw new Error(`${resp.status} ${d}`.slice(0,300)); }
    const j=await resp.json();
    return (j.content && j.content[0] && j.content[0].text) || "";
  }

  /* ---------------- safe render (escape → markdown-lite → furigana → links) ---------------- */
  /* ---------- connection test (lightweight non-streaming ping) ---------- */
  async function ping(key, mdl){
    const t0=(window.performance&&performance.now)?performance.now():Date.now();
    const resp=await fetch(API_URL, {
      method:"POST",
      headers:{ "content-type":"application/json", "x-api-key":key,
        "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
      body: JSON.stringify({ model:mdl, max_tokens:8, messages:[{role:"user",content:"ping"}] }),
    });
    const ms=Math.round(((window.performance&&performance.now)?performance.now():Date.now())-t0);
    if(!resp.ok){
      let d=""; try{ const j=await resp.json(); d=(j.error&&j.error.message)||JSON.stringify(j); }catch(e){ d=resp.statusText||("HTTP "+resp.status); }
      return { ok:false, status:resp.status, ms, error:d };
    }
    let j={}; try{ j=await resp.json(); }catch(e){}
    return { ok:true, ms, model:j.model||mdl };
  }

  // ruby-ify 漢字[かな] without re-escaping (input already escaped; app's toRuby would
  // double-escape and break the HTML tags we insert here).
  function rubyKeep(s){ return s.replace(RUBY_RE, (m,k,r)=>`<ruby>${k}<rt>${r}</rt></ruby>`); }
  function fmt(text){
    let s=esc(text);                                              // 1. neutralize HTML first (XSS-safe)
    s=s.replace(/`([^`]+)`/g, (m,a)=>`<code>${a}</code>`);
    s=s.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
    s=s.replace(/^#{1,6}\s*(.+)$/gm, "<b>$1</b>");
    s=s.replace(/^\s*[-*•]\s+(.+)$/gm, "・$1");
    s=rubyKeep(s);                                                // 2. 漢字[かな] → <ruby>
    s=s.replace(/Day\s?(\d{1,2})/g, (m,n)=>{ const d=+n; return (d>=1&&d<=TOTAL_DAYS)?`<a class="ai-day" data-d="${d}">Day ${d}</a>`:m; });
    return s.replace(/\n/g, "<br>");
  }
  // pull speakable Japanese (sentences containing kana) out of a bilingual answer
  function jaText(full){
    return full.split(/[\n。！？!?]/).map(x=>x.trim())
      .filter(x=>/[ぁ-んァ-ヶ]/.test(x)).map(toPlain).join("。");
  }
  function speakBtn(full){
    // dynamic AI text has no pre-generated audio → only works via system-TTS, which is OFF
    // by default. Hide the button when TTS is off so it's never a dead button. (R5 F3b)
    if(typeof ttsFallbackOn==="function" && !ttsFallbackOn()) return "";
    const t=jaText(full); if(!t) return "";
    return `<button class="ai-speak" data-t="${escAttr(t)}" title="${T('朗读答案中的日语','Read the Japanese aloud')}">🔊 ${T('读日语','Read aloud')}</button>`;
  }

  /* ---------------- UI ---------------- */
  let MSGS=[], busy=false;
  const $id=(x)=>document.getElementById(x);
  const last={ q:null, a:null, day:null, session:null };
  function scrollBot(){ const m=$id("ai-msgs"); if(m) m.scrollTop=m.scrollHeight; }
  function autoGrow(t){ t.style.height="auto"; t.style.height=Math.min(t.scrollHeight,120)+"px"; }

  function bubble(role, html){
    const m=$id("ai-msgs");
    const wrap=document.createElement("div");
    wrap.className="ai-msg "+role;
    wrap.innerHTML=`<div class="ai-body">${html}</div>`;
    m.appendChild(wrap); scrollBot(); return wrap;
  }
  function greeting(){
    const tips=[T("「〜ています」和「〜てから」的 て 有什么区别？","What's the difference between the て in 〜ています and 〜てから?"),
                T("这一课的「を」为什么用在这里？","Why is を used here in this lesson?"),
                T("帮我用今天的语法各造一个句子","Make an example sentence with each of today's grammar points")];
    const keyWarn = hasKey()? "" :
      `<div class="ai-note">⚠️ ${T("还没设置 API Key。点右上角 ⚙ → 「AI 学习助手」填入你的 Claude API Key（仅存本机）。","No API key yet. Top-right ⚙ → \"AI Assistant\" → enter your Claude API key (stored on this device only).")}<a id="ai-go-set">${T("去设置","Set up")}</a></div>`;
    return `<div class="ai-msg assistant"><div class="ai-body">${T("你好！我是你的日语学习助手 🌸 学习中有任何疑问都可以问我——语法、读音、近义词、为什么这么说都行。","Hi! I'm your Japanese study assistant 🌸 Ask me anything — grammar, readings, synonyms, or why we say it a certain way.")}${keyWarn}
      <div class="ai-tips">${tips.map(t=>`<button class="ai-tip">${esc(t)}</button>`).join("")}</div></div></div>`;
  }
  function resetMsgs(){ MSGS=[]; $id("ai-msgs").innerHTML=greeting(); }

  function gotoDay(n){
    if(!(n>=1&&n<=TOTAL_DAYS)) return;
    if(window.pushNav) window.pushNav();              // universal back: return to where you were
    STATE.day=n; STATE.session="noon"; STATE.showZh=true;
    showPage("daily"); window.scrollTo(0,0);
  }

  function setCtx(){ const l=LESSONS[STATE.day-1], c=$id("ai-ctx"); if(c) c.textContent = l ? `Day ${l.day} · ${(SESSIONS[STATE.session]||{}).name||""}` : ""; }
  function open(){
    $id("ai-panel").classList.add("show");
    setCtx();
    if(!$id("ai-msgs").innerHTML.trim()) resetMsgs();
    // if the user had text selected on the page, offer a one-tap "ask about this"
    const sel=(window.getSelection && String(window.getSelection()).trim())||"";
    const box=$id("ai-sel");
    if(sel && sel.length<=80){
      box.style.display="block";
      box.innerHTML=`${T("选中","Selected")}：「${esc(sel)}」 <button id="ai-sel-ask">${T("就这句提问","Ask about this")}</button>`;
      $id("ai-sel-ask").onclick=()=>{ $id("ai-text").value=`「${sel}」 ${T("这里是什么意思／怎么用？","— what does this mean / how is it used?")}`; box.style.display="none"; autoGrow($id("ai-text")); $id("ai-text").focus(); };
    } else box.style.display="none";
    setTimeout(()=>$id("ai-text").focus(),60);
  }
  function close(){ $id("ai-panel").classList.remove("show"); }

  async function send(preset){
    if(busy) return;
    const ta=$id("ai-text");
    const q=(preset!=null?preset:ta.value).trim(); if(!q) return;
    if(!hasKey()){ bubble("assistant", greetingNeedsKey()); wireGreeting(); return; }
    ta.value=""; autoGrow(ta);
    setCtx();                                    // R3-2: keep the "current lesson" label in sync with STATE
    bubble("user", esc(q).replace(/\n/g,"<br>"));
    MSGS.push({ role:"user", content:q });
    // R3-7: cap history — only send the last ~8 exchanges (16 msgs), starting on a user turn.
    let hist=MSGS.slice(-16); while(hist.length && hist[0].role!=="user") hist=hist.slice(1);
    busy=true; $id("ai-send").disabled=true;
    const node=bubble("assistant", `<span class="ai-typing">●●●</span>`);
    const body=node.querySelector(".ai-body");
    try{
      const full=await callClaude(hist, (sofar)=>{ body.innerHTML=fmt(sofar); scrollBot(); });
      MSGS.push({ role:"assistant", content:full });
      if(MSGS.length>24) MSGS=MSGS.slice(-24);   // keep in-memory history bounded
      Object.assign(last, { q, a:full, day:STATE.day, session:STATE.session });
      body.innerHTML=fmt(full)+`<div class="ai-actions">${speakBtn(full)}${(window.Notes&&window.Notes.saveBtnHTML)?window.Notes.saveBtnHTML():""}</div>`;
      if(window.Notes && window.Notes.bindSaveBtn) window.Notes.bindSaveBtn(node, { q, a:full, day:STATE.day, session:STATE.session });
    }catch(e){
      body.innerHTML=`<span class="ai-err">${T("出错了","Error")}：${esc(e.message)}</span><div class="ai-note">${T("检查 ⚙ 里的 API Key / 模型名是否正确、账户是否有额度。","Check the API key / model name in ⚙ settings, and that your account has credit.")}</div>`;
    }finally{
      busy=false; $id("ai-send").disabled=false; scrollBot();
    }
  }
  function greetingNeedsKey(){ return `${T("还没设置 API Key。点右上角 ⚙ → 「AI 学习助手」填入你的 Claude API Key（仅存本机，可在 Anthropic 控制台设消费上限）。","No API key yet. Top-right ⚙ → \"AI Assistant\" → enter your Claude API key (stored on this device only; you can set a spend cap in the Anthropic console).")}<a id="ai-go-set">${T("去设置","Set up")}</a>`; }
  function wireGreeting(){
    const go=$id("ai-go-set"); if(go) go.onclick=()=>{ close(); if(window.openSettings) openSettings(); };
  }

  function mic(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){ alert(T("此浏览器不支持语音输入，建议用 Chrome。","This browser doesn't support voice input — try Chrome.")); return; }
    const r=new SR(); r.lang="zh-CN"; r.interimResults=false; r.maxAlternatives=1;
    const btn=$id("ai-mic"); btn.classList.add("rec");
    r.onresult=(e)=>{ const t=e.results[0][0].transcript; const ta=$id("ai-text"); ta.value=(ta.value?ta.value+" ":"")+t; autoGrow(ta); };
    r.onerror=()=>btn.classList.remove("rec");
    r.onend=()=>btn.classList.remove("rec");
    try{ r.start(); }catch(e){ btn.classList.remove("rec"); }
  }

  function injectUI(){
    if($id("ai-fab")) return;
    const fab=document.createElement("button");
    fab.id="ai-fab"; fab.type="button"; fab.title=T("AI 学习助手","AI Assistant"); fab.textContent="🤖";
    document.body.appendChild(fab);
    const panel=document.createElement("div"); panel.id="ai-panel";
    panel.innerHTML=`
      <div class="ai-head"><b>🤖 ${T("AI 学习助手","AI Assistant")}</b><span class="ai-ctx" id="ai-ctx"></span><button id="ai-close" title="${T('关闭','Close')}">✕</button></div>
      <div class="ai-msgs" id="ai-msgs"></div>
      <div class="ai-sel" id="ai-sel" style="display:none"></div>
      <div class="ai-inputbar">
        <textarea id="ai-text" rows="1" placeholder="${T('问我任何日语问题…（中／日均可，Enter 发送）','Ask me any Japanese question… (Enter to send)')}"></textarea>
        <button id="ai-mic" title="${T('语音输入（中文）','Voice input')}">🎤</button>
        <button id="ai-send" class="primary">${T('发送','Send')}</button>
      </div>
      <div class="ai-foot">${T("仅限日语学习 · 解释由 AI 生成仅供参考","Japanese study only · AI-generated, for reference")} · <a id="ai-clear">${T('清空','Clear')}</a></div>`;
    document.body.appendChild(panel);
    if(window.makeDraggable) makeDraggable(fab, "jpn-aifab-pos", open); else fab.onclick=open;
    fab.title=T("AI 学习助手（可拖动）","AI Assistant (draggable)");
    $id("ai-close").onclick=close;
    $id("ai-send").onclick=()=>send();
    $id("ai-clear").onclick=resetMsgs;
    $id("ai-mic").onclick=mic;
    const ta=$id("ai-text");
    ta.addEventListener("input",()=>autoGrow(ta));
    ta.addEventListener("keydown",(e)=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); }});
    $id("ai-msgs").addEventListener("click",(e)=>{
      const day=e.target.closest(".ai-day"); if(day){ gotoDay(+day.dataset.d); close(); return; }
      const tip=e.target.closest(".ai-tip"); if(tip){ send(tip.textContent); return; }
      const sp=e.target.closest(".ai-speak"); if(sp){ stopSpeak(); speakSequence([{text:sp.dataset.t,node:null}]); return; }
      if(e.target.id==="ai-go-set"){ close(); if(window.openSettings) openSettings(); }
    });
  }

  // settings-panel HTML + wiring (called by app.js openSettings)
  function settingsHTML(){
    const c=cfg();
    return `<section><h3>🤖 ${T("AI 学习助手（Claude）","AI Study Assistant (Claude)")}</h3>
      <p class="m-note">${T("填入你自己的 <b>Anthropic (Claude) API Key</b> 即可在学习时随时提问（右下角 🤖）。Key 只存本机浏览器、直接发往 Anthropic，不经过任何中间服务器。建议在 <a href=\"https://console.anthropic.com/\" target=\"_blank\" rel=\"noopener\">console.anthropic.com</a> 给该 Key 设个消费上限。","Enter your own <b>Anthropic (Claude) API key</b> to ask questions while you study (🤖 bottom-right). The key is stored only in this browser and sent directly to Anthropic — never through any middleman server. We recommend setting a spend cap on the key at <a href=\"https://console.anthropic.com/\" target=\"_blank\" rel=\"noopener\">console.anthropic.com</a>.")}</p>
      <label>API Key <input type="password" id="ai-key" value="${esc(c.key||"")}" placeholder="sk-ant-..."></label>
      <label>${T("模型","Model")} <select id="ai-model">${MODELS.map(m=>`<option value="${m.id}"${(c.model||MODELS[0].id)===m.id?" selected":""}>${esc(modelName(m))}</option>`).join("")}</select></label>
      <div class="m-actions"><button id="ai-test" class="primary">🔌 ${T("测试连接","Test connection")}</button><button id="ai-save">${T("保存","Save")}</button><button id="ai-clear-key">${T("清除","Clear")}</button><span id="ai-key-status" class="m-note"></span></div>
      <div class="conn-status" id="ai-conn"></div>
      <details class="ai-guide"><summary>📘 ${T("怎么获取 API Key？（点开看图文步骤）","How to get an API key (step-by-step)")}</summary>
        <ol>
          <li>${T("打开 <a href=\"https://console.anthropic.com/\" target=\"_blank\" rel=\"noopener\">console.anthropic.com</a>，注册 / 登录（支持邮箱、Google）。","Open <a href=\"https://console.anthropic.com/\" target=\"_blank\" rel=\"noopener\">console.anthropic.com</a> and sign up / log in (email or Google).")}</li>
          <li>${T("首次需要在 <b>Billing（账单）</b> 里充值一点额度（最低约 $5；按用量计费，问答很便宜，几乎用不完）。","First time, add a little credit under <b>Billing</b> (about $5 minimum; pay-as-you-go, and Q&A is very cheap).")}</li>
          <li>${T("左侧进入 <b>API Keys</b> → <b>Create Key</b>，给它起个名字（如 <code>jpn-study</code>），点 <b>Copy</b> 复制（形如 <code>sk-ant-...</code>，只显示一次）。","Go to <b>API Keys</b> → <b>Create Key</b>, name it (e.g. <code>jpn-study</code>), and <b>Copy</b> it (looks like <code>sk-ant-...</code>; shown only once).")}</li>
          <li>${T("<b>强烈建议</b>：在 <b>Limits / Usage limits</b> 给这个 Key 设一个每月上限（如 $5），防止意外超支。","<b>Strongly recommended</b>: set a monthly cap under <b>Limits / Usage limits</b> (e.g. $5) to avoid surprise charges.")}</li>
          <li>${T("回到这里，把 Key 粘进上面的输入框 → <b>保存</b>。完成！点右下角 🤖 就能用了。","Come back here, paste the key into the box above → <b>Save</b>. Done — tap 🤖 bottom-right to use it.")}</li>
        </ol>
        <p class="m-note">${T("完整图文版见仓库 <code>docs/API-KEY-GUIDE.md</code>。Key 只存在你这台电脑的浏览器里，直接发往 Anthropic，不经过任何第三方。","Full illustrated guide in <code>docs/API-KEY-GUIDE.md</code>. The key lives only in this browser and goes straight to Anthropic — no third party.")}</p>
      </details>
      <p class="m-note">${T("提示：助手会自动结合你“当前所在那一课”的课文、单词、语法来回答，并标注知识点最早出现在第几天（可点 Day N 跳转）。若提示模型不存在，改这里的模型名即可。","Tip: the assistant automatically uses your current lesson's text, vocab, and grammar, and cites the day a point first appeared (tap Day N to jump). If a model is reported missing, just change the model above.")}</p>
    </section>`;
  }
  function bindSettings(){
    const save=$id("ai-save"); if(!save) return;
    save.onclick=()=>{ const key=$id("ai-key").value.trim(), m=$id("ai-model").value;
      saveCfg({ key, model:m }); $id("ai-key-status").textContent = key?T("已保存 ✓","Saved ✓"):T("已保存（未填 Key）","Saved (no key entered)"); };
    $id("ai-clear-key").onclick=()=>{ saveCfg({ model:$id("ai-model").value }); $id("ai-key").value=""; $id("ai-key-status").textContent=T("已清除 Key","Key cleared"); $id("ai-conn").className="conn-status"; $id("ai-conn").textContent=""; };
    const test=$id("ai-test"); if(test) test.onclick=async()=>{
      const key=($id("ai-key").value||"").trim()||cfg().key, mdl=$id("ai-model").value;
      const box=$id("ai-conn");
      if(!key){ box.className="conn-status bad"; box.textContent=T("✗ 先填入 API Key 再测试","✗ Enter an API key before testing"); return; }
      box.className="conn-status testing"; box.textContent=T("🔌 正在连接 Claude…","🔌 Connecting to Claude…");
      test.disabled=true;
      try{
        const r=await ping(key, mdl);
        if(r.ok){ box.className="conn-status ok"; box.textContent=T(`✓ 连接成功！模型 ${r.model} · 响应 ${r.ms}ms。已自动保存，点右下角 🤖 即可使用。`,`✓ Connected! Model ${r.model} · ${r.ms}ms. Saved automatically — tap 🤖 bottom-right to use it.`);
          saveCfg({ key, model:mdl }); $id("ai-key-status").textContent=T("已验证并保存 ✓","Verified & saved ✓"); }
        else{ box.className="conn-status bad"; box.textContent=T(`✗ 连接失败（${r.status}）：${r.error}`,`✗ Connection failed (${r.status}): ${r.error}`); }
      }catch(e){ box.className="conn-status bad"; box.textContent=T(`✗ 出错：${e.message}（多半是网络问题、Key 写错、或模型名过时）`,`✗ Error: ${e.message} (likely network, wrong key, or outdated model name)`); }
      finally{ test.disabled=false; }
    };
  }

  window.Assistant={ injectUI, settingsHTML, bindSettings, open, refreshCtx:setCtx, get last(){ return last; },
    complete, hasKey };   // reused by js/pet.js (agent-on-demand)
  if(document.readyState!=="loading") injectUI();
  else document.addEventListener("DOMContentLoaded", injectUI);
})();
