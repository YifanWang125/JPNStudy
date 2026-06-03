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
    { id:"claude-sonnet-4-6", name:"Sonnet 4.6（推荐 · 均衡）" },
    { id:"claude-haiku-4-5",  name:"Haiku 4.5（最快 · 最省）" },
    { id:"claude-opus-4-8",   name:"Opus 4.8（最强 · 较贵）" },
  ];
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
2. 以中文讲解为主。所有日语例句都必须带振假名，格式为「漢字[かんじ]」——每个含汉字的词都要标读音（这是学生最需要的）。
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
    const t=jaText(full); if(!t) return "";
    return `<button class="ai-speak" data-t="${esc(t)}" title="朗读答案中的日语">🔊 读日语</button>`;
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
    const tips=["「〜ています」和「〜てから」的 て 有什么区别？","这一课的「を」为什么用在这里？","帮我用今天的语法各造一个句子"];
    const keyWarn = hasKey()? "" :
      `<div class="ai-note">⚠️ 还没设置 API Key。点右上角 ⚙ → 「AI 学习助手」填入你的 Claude API Key（仅存本机）。<a id="ai-go-set">去设置</a></div>`;
    return `<div class="ai-msg assistant"><div class="ai-body">你好！我是你的日语学习助手 🌸 学习中有任何疑问都可以问我——语法、读音、近义词、为什么这么说都行。${keyWarn}
      <div class="ai-tips">${tips.map(t=>`<button class="ai-tip">${esc(t)}</button>`).join("")}</div></div></div>`;
  }
  function resetMsgs(){ MSGS=[]; $id("ai-msgs").innerHTML=greeting(); }

  function gotoDay(n){
    if(!(n>=1&&n<=TOTAL_DAYS)) return;
    STATE.day=n; STATE.session="noon"; STATE.showZh=true;
    showPage("daily"); window.scrollTo(0,0);
  }

  function open(){
    $id("ai-panel").classList.add("show");
    const l=LESSONS[STATE.day-1];
    $id("ai-ctx").textContent = l ? `Day ${l.day} · ${(SESSIONS[STATE.session]||{}).name||""}` : "";
    if(!$id("ai-msgs").innerHTML.trim()) resetMsgs();
    // if the user had text selected on the page, offer a one-tap "ask about this"
    const sel=(window.getSelection && String(window.getSelection()).trim())||"";
    const box=$id("ai-sel");
    if(sel && sel.length<=80){
      box.style.display="block";
      box.innerHTML=`选中：「${esc(sel)}」 <button id="ai-sel-ask">就这句提问</button>`;
      $id("ai-sel-ask").onclick=()=>{ $id("ai-text").value=`「${sel}」 这里是什么意思／怎么用？`; box.style.display="none"; autoGrow($id("ai-text")); $id("ai-text").focus(); };
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
    bubble("user", esc(q).replace(/\n/g,"<br>"));
    MSGS.push({ role:"user", content:q });
    busy=true; $id("ai-send").disabled=true;
    const node=bubble("assistant", `<span class="ai-typing">●●●</span>`);
    const body=node.querySelector(".ai-body");
    try{
      const full=await callClaude(MSGS, (sofar)=>{ body.innerHTML=fmt(sofar); scrollBot(); });
      MSGS.push({ role:"assistant", content:full });
      Object.assign(last, { q, a:full, day:STATE.day, session:STATE.session });
      body.innerHTML=fmt(full)+`<div class="ai-actions">${speakBtn(full)}${(window.Notes&&window.Notes.saveBtnHTML)?window.Notes.saveBtnHTML():""}</div>`;
      if(window.Notes && window.Notes.bindSaveBtn) window.Notes.bindSaveBtn(node, { q, a:full, day:STATE.day, session:STATE.session });
    }catch(e){
      body.innerHTML=`<span class="ai-err">出错了：${esc(e.message)}</span><div class="ai-note">检查 ⚙ 里的 API Key / 模型名是否正确、账户是否有额度。</div>`;
    }finally{
      busy=false; $id("ai-send").disabled=false; scrollBot();
    }
  }
  function greetingNeedsKey(){ return `还没设置 API Key。点右上角 ⚙ → 「AI 学习助手」填入你的 Claude API Key（仅存本机，可在 Anthropic 控制台设消费上限）。<a id="ai-go-set">去设置</a>`; }
  function wireGreeting(){
    const go=$id("ai-go-set"); if(go) go.onclick=()=>{ close(); if(window.openSettings) openSettings(); };
  }

  function mic(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){ alert("此浏览器不支持语音输入，建议用 Chrome。"); return; }
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
    fab.id="ai-fab"; fab.type="button"; fab.title="AI 学习助手"; fab.textContent="🤖";
    document.body.appendChild(fab);
    const panel=document.createElement("div"); panel.id="ai-panel";
    panel.innerHTML=`
      <div class="ai-head"><b>🤖 AI 学习助手</b><span class="ai-ctx" id="ai-ctx"></span><button id="ai-close" title="关闭">✕</button></div>
      <div class="ai-msgs" id="ai-msgs"></div>
      <div class="ai-sel" id="ai-sel" style="display:none"></div>
      <div class="ai-inputbar">
        <textarea id="ai-text" rows="1" placeholder="问我任何日语问题…（中／日均可，Enter 发送）"></textarea>
        <button id="ai-mic" title="语音输入（中文）">🎤</button>
        <button id="ai-send" class="primary">发送</button>
      </div>
      <div class="ai-foot">仅限日语学习 · 解释由 AI 生成仅供参考 · <a id="ai-clear">清空</a></div>`;
    document.body.appendChild(panel);
    if(window.makeDraggable) makeDraggable(fab, "jpn-aifab-pos", open); else fab.onclick=open;
    fab.title="AI 学习助手（可拖动）";
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
    return `<section><h3>🤖 AI 学习助手（Claude）</h3>
      <p class="m-note">填入你自己的 <b>Anthropic (Claude) API Key</b> 即可在学习时随时提问（右下角 🤖）。Key 只存本机浏览器、直接发往 Anthropic，不经过任何中间服务器。建议在 <a href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a> 给该 Key 设个消费上限。</p>
      <label>API Key <input type="password" id="ai-key" value="${esc(c.key||"")}" placeholder="sk-ant-..."></label>
      <label>模型 <select id="ai-model">${MODELS.map(m=>`<option value="${m.id}"${(c.model||MODELS[0].id)===m.id?" selected":""}>${esc(m.name)}</option>`).join("")}</select></label>
      <div class="m-actions"><button id="ai-test" class="primary">🔌 测试连接</button><button id="ai-save">保存</button><button id="ai-clear-key">清除</button><span id="ai-key-status" class="m-note"></span></div>
      <div class="conn-status" id="ai-conn"></div>
      <details class="ai-guide"><summary>📘 怎么获取 API Key？（点开看图文步骤）</summary>
        <ol>
          <li>打开 <a href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a>，注册 / 登录（支持邮箱、Google）。</li>
          <li>首次需要在 <b>Billing（账单）</b> 里充值一点额度（最低约 $5；按用量计费，问答很便宜，几乎用不完）。</li>
          <li>左侧进入 <b>API Keys</b> → <b>Create Key</b>，给它起个名字（如 <code>jpn-study</code>），点 <b>Copy</b> 复制（形如 <code>sk-ant-...</code>，只显示一次）。</li>
          <li><b>强烈建议</b>：在 <b>Limits / Usage limits</b> 给这个 Key 设一个每月上限（如 $5），防止意外超支。</li>
          <li>回到这里，把 Key 粘进上面的输入框 → <b>保存</b>。完成！点右下角 🤖 就能用了。</li>
        </ol>
        <p class="m-note">完整图文版见仓库 <code>docs/API-KEY-GUIDE.md</code>。Key 只存在你这台电脑的浏览器里，直接发往 Anthropic，不经过任何第三方。</p>
      </details>
      <p class="m-note">提示：助手会自动结合你“当前所在那一课”的课文、单词、语法来回答，并标注知识点最早出现在第几天（可点 Day N 跳转）。若提示模型不存在，改这里的模型名即可。</p>
    </section>`;
  }
  function bindSettings(){
    const save=$id("ai-save"); if(!save) return;
    save.onclick=()=>{ const key=$id("ai-key").value.trim(), m=$id("ai-model").value;
      saveCfg({ key, model:m }); $id("ai-key-status").textContent = key?"已保存 ✓":"已保存（未填 Key）"; };
    $id("ai-clear-key").onclick=()=>{ saveCfg({ model:$id("ai-model").value }); $id("ai-key").value=""; $id("ai-key-status").textContent="已清除 Key"; $id("ai-conn").className="conn-status"; $id("ai-conn").textContent=""; };
    const test=$id("ai-test"); if(test) test.onclick=async()=>{
      const key=($id("ai-key").value||"").trim()||cfg().key, mdl=$id("ai-model").value;
      const box=$id("ai-conn");
      if(!key){ box.className="conn-status bad"; box.textContent="✗ 先填入 API Key 再测试"; return; }
      box.className="conn-status testing"; box.textContent="🔌 正在连接 Claude…";
      test.disabled=true;
      try{
        const r=await ping(key, mdl);
        if(r.ok){ box.className="conn-status ok"; box.textContent=`✓ 连接成功！模型 ${r.model} · 响应 ${r.ms}ms。已自动保存，点右下角 🤖 即可使用。`;
          saveCfg({ key, model:mdl }); $id("ai-key-status").textContent="已验证并保存 ✓"; }
        else{ box.className="conn-status bad"; box.textContent=`✗ 连接失败（${r.status}）：${r.error}`; }
      }catch(e){ box.className="conn-status bad"; box.textContent=`✗ 出错：${e.message}（多半是网络问题、Key 写错、或模型名过时）`; }
      finally{ test.disabled=false; }
    };
  }

  window.Assistant={ injectUI, settingsHTML, bindSettings, open, get last(){ return last; } };
  if(document.readyState!=="loading") injectUI();
  else document.addEventListener("DOMContentLoaded", injectUI);
})();
