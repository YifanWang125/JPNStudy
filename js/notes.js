/* ============================================================================
 *  智能笔记系统 (notes.js) — Phase 1
 *
 *  Distinguishes "what the syllabus teaches" (course content, read-only, in
 *  lessons.js) from "what I actually understood" (my notes, in localStorage).
 *
 *  Features:
 *   - free-form Markdown notes (safe-rendered, furigana-aware)
 *   - [[wikilinks]] between notes  +  [[course:<id>]] links into lessons
 *   - backlinks panel ("被哪些笔记引用")
 *   - trace a grammar point back to the lesson where it FIRST appeared (Day N)
 *   - capture an AI Q&A exchange as a note, auto-linked to the lesson you were on
 *   - rides along in the existing progress export/import (key "jpn-notes")
 *
 *  Stable course-entity IDs survive content edits:
 *    d:<day> · d:<day>:<session> · g:<day>:<slug(point)> · v:<slug(word)>
 *
 *  Depends on app.js globals: LESSONS, TOTAL_DAYS, STATE, SESSIONS,
 *  esc, toRuby, toPlain, showPage.
 * ==========================================================================*/
(function(){
  "use strict";
  const LS="jpn-notes";

  /* ---------- store ---------- */
  function load(){ try{ const o=JSON.parse(localStorage.getItem(LS)); if(o&&o.notes) return o; }catch(e){} return {_schema:1, notes:{}}; }
  function save(s){ try{ localStorage.setItem(LS, JSON.stringify(s)); }catch(e){ alert("保存失败（本地存储已满？）"); } }
  let STORE=load();
  function allNotes(){ return Object.values(STORE.notes).sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||"")); }
  function getNote(id){ return STORE.notes[id]; }
  function nid(){ return "n_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6); }
  function nowISO(){ return new Date().toISOString(); }
  function createNote(p){
    const id=nid();
    STORE.notes[id]=Object.assign({ id, title:"", body:"", tags:[], provenance:{kind:"manual"}, createdAt:nowISO(), updatedAt:nowISO() }, p, { id });
    save(STORE); return id;
  }
  function updateNote(id, p){ const n=STORE.notes[id]; if(!n) return; Object.assign(n, p, { updatedAt:nowISO() }); save(STORE); }
  function deleteNote(id){ delete STORE.notes[id]; save(STORE); }

  /* ---------- course-entity index (stable IDs + first-appearance) ---------- */
  function slug(s){ return String(s||"").replace(/\[[^\]]+\]/g,"").replace(/[\s〜~・。、，,.\/「」『』]/g,"").trim(); }
  const CINDEX=(function(){
    const byId={}, firstGrammar={};
    (typeof LESSONS!=="undefined"?LESSONS:[]).forEach(l=>{
      byId["d:"+l.day]={type:"lesson",day:l.day,session:"morning",display:`Day ${l.day} · ${l.theme}`};
      ["morning","noon","night"].forEach(s=>{ byId["d:"+l.day+":"+s]={type:"session",day:l.day,session:s,display:`Day ${l.day} ${(SESSIONS[s]||{}).name||s}`}; });
      (l.grammar||[]).forEach(g=>{ if(/^[①-⑩\d]/.test(g.point)) return; const sg=slug(g.point); const id="g:"+l.day+":"+sg;
        byId[id]={type:"grammar",day:l.day,session:"noon",display:g.point}; if(firstGrammar[sg]==null||l.day<firstGrammar[sg]) firstGrammar[sg]=l.day; });
      (l.vocab||[]).forEach(v=>{ const id="v:"+slug(v.w); if(!byId[id]) byId[id]={type:"vocab",day:l.day,session:"noon",display:v.w}; });
    });
    return { byId, firstGrammar };
  })();
  function firstDayOf(id){ const m=/^g:\d+:(.+)$/.exec(id); if(m) return CINDEX.firstGrammar[m[1]]; const r=CINDEX.byId[id]; return r?r.day:null; }
  function gotoCourse(id){
    const ref=CINDEX.byId[id]; if(!ref) return false;
    STATE.day=ref.day; STATE.session=ref.session||"noon"; STATE.showZh=true;
    showPage("daily"); window.scrollTo(0,0); return true;
  }

  /* ---------- link parsing / resolution ---------- */
  function titleToId(title){ const t=(title||"").trim().toLowerCase(); const hit=allNotes().find(n=>(n.title||"").trim().toLowerCase()===t && t); return hit?hit.id:null; }
  const LINK_RE=/\[\[([^\]]+)\]\]/g;
  function parseLinks(body){
    const notes=[], course=[]; let m;
    LINK_RE.lastIndex=0;
    while((m=LINK_RE.exec(body||""))){
      const t=m[1].split("|")[0].trim();
      if(t.indexOf("course:")===0) course.push(t.slice(7));
      else { const id=titleToId(t); if(id) notes.push(id); }
    }
    return { notes, course };
  }
  function backlinksTo(noteId){
    return allNotes().filter(n=>n.id!==noteId && parseLinks(n.body).notes.indexOf(noteId)>=0);
  }

  /* ---------- safe render (escape → wikilinks → markdown → furigana) ---------- */
  // ruby-ify 漢字[かな] WITHOUT re-escaping (input is already escaped; app's toRuby would
  // double-escape and mangle the HTML tags we insert, so we use RUBY_RE directly here).
  function rubyKeep(s){ return s.replace(RUBY_RE, (m,k,r)=>`<ruby>${k}<rt>${r}</rt></ruby>`); }
  function renderBody(md){
    let s=esc(md||"");                                  // escape first (XSS-safe); [[ ]] survive
    s=s.replace(LINK_RE,(m,inner)=>{
      const parts=inner.split("|"); const target=parts[0].trim(); const label=(parts[1]||"").trim();
      if(target.indexOf("course:")===0){
        const id=target.slice(7); const ref=CINDEX.byId[id]; const text=label||(ref?ref.display:id);
        if(!ref) return `<span class="note-broken">📎 ${text}</span>`;
        const fd=firstDayOf(id); const first=(fd&&fd!==ref.day)?` <span class="note-first" data-cid="d:${fd}">${T("↩ 初出 Day "+fd,"↩ first appeared Day "+fd)}</span>`:"";
        return `<a class="note-clink" data-cid="${id}">📎 ${text}</a>${first}`;
      }
      const id=titleToId(target); const text=label||target;
      return id ? `<a class="note-nlink" data-nid="${escAttr(id)}">🔗 ${esc(text)}</a>`
                : `<a class="note-broken" data-newtitle="${escAttr(target)}">🔗 ${esc(text)}</a>`;
    });
    s=s.replace(/`([^`]+)`/g,(m,a)=>`<code>${a}</code>`);
    s=s.replace(/\*\*([^*\n]+)\*\*/g,"<b>$1</b>");
    s=s.replace(/^#{1,6}\s*(.+)$/gm,"<b>$1</b>");
    s=s.replace(/^\s*[-*•]\s+(.+)$/gm,"・$1");
    s=rubyKeep(s);
    return s.replace(/\n/g,"<br>");
  }
  function plain(md){ return toPlain((md||"").replace(LINK_RE,(m,i)=>i.split("|").slice(-1)[0])).replace(/[#*`>]/g,""); }

  /* ---------- page UI ---------- */
  const N={ open:null, q:"", filter:"all" };
  function root(){ return document.getElementById("page-notes"); }
  function badge(n){ return n.provenance&&n.provenance.kind==="ai-qa" ? `<span class="np-badge ai">🤖 AI</span>` : `<span class="np-badge">${T("✍️ 手写","✍️ Note")}</span>`; }

  function renderPage(){
    const r=root(); if(!r) return;
    if(N.open) r.innerHTML=detailHTML(N.open); else r.innerHTML=listHTML();
    wire();
  }
  function listHTML(){
    let list=allNotes();
    if(N.filter==="manual") list=list.filter(n=>!(n.provenance&&n.provenance.kind==="ai-qa"));
    if(N.filter==="ai")     list=list.filter(n=> (n.provenance&&n.provenance.kind==="ai-qa"));
    if(N.q){ const q=N.q.toLowerCase(); list=list.filter(n=>((n.title||"")+" "+(n.body||"")+" "+(n.tags||[]).join(" ")).toLowerCase().indexOf(q)>=0); }
    const items=list.map(n=>{
      const snip=esc(plain(n.body).slice(0,90));
      const tags=(n.tags||[]).map(t=>`<span class="np-tag">#${esc(t)}</span>`).join("");
      const bl=backlinksTo(n.id).length;
      return `<div class="np-item" data-open="${n.id}">
        <div class="np-item-top">${badge(n)}<b>${esc(n.title||T("（无标题）","(Untitled)"))}</b>${bl?`<span class="np-bl">⇠${bl}</span>`:""}</div>
        <div class="np-snip">${snip||"<i>"+T("空笔记","Empty note")+"</i>"}</div>
        <div class="np-tags">${tags}<span class="np-date">${(n.updatedAt||"").slice(0,10)}</span></div>
      </div>`;
    }).join("");
    return `<div class="np-head">
        <h1>${T("📓 我的笔记","📓 My Notes")} <span class="np-count">${allNotes().length}</span></h1>
        <button id="np-new" class="primary">${T("＋ 新建笔记","＋ New note")}</button>
      </div>
      <p class="np-intro">${T("这里是你的<b>笔记库</b>（正式笔记），区别于课程大纲。用 <code>[[标题]]</code> 链接其它笔记，用「关联课程」把笔记接回某一课，并能溯源到知识点最早出现的那天。<br>💡 想<b>随手记</b>？用右下角 <b>🗒️ 速记本</b>（自动保存草稿），整理好按「保存为 Section」就会出现在这里。AI 问答也能一键存成笔记。","This is your <b>note library</b> (formal notes), separate from the syllabus. Use <code>[[Title]]</code> to link notes, use \"Link to lesson\" to tie a note back to a day, and trace a point back to where it first appeared.<br>💡 Want to <b>jot quickly</b>? Use the <b>🗒️ Quick notes</b> button (bottom-right; auto-saves a draft); press \"Save as Section\" and it shows up here. AI answers can be saved as notes too.")}</p>
      <div class="np-bar">
        <input id="np-q" placeholder="${T("🔍 搜索标题 / 正文 / 标签","🔍 Search title / body / tags")}" value="${escAttr(N.q)}">
        <select id="np-filter">
          <option value="all"${N.filter==="all"?" selected":""}>${T("全部","All")}</option>
          <option value="manual"${N.filter==="manual"?" selected":""}>${T("✍️ 手写","✍️ Notes")}</option>
          <option value="ai"${N.filter==="ai"?" selected":""}>${T("🤖 来自 AI","🤖 From AI")}</option>
        </select>
      </div>
      <div class="np-list">${items||`<div class="np-empty">${T("还没有笔记。点「＋ 新建笔记」，或在学习时用右下角 🤖 提问后「存为笔记」。","No notes yet. Tap \"＋ New note\", or ask the 🤖 assistant while studying and save the answer.")}</div>`}</div>`;
  }
  function courseOptions(){
    const l=LESSONS[STATE.day-1]; if(!l) return "";
    let o=`<option value="">${T("＋ 关联课程…","＋ Link to lesson…")}</option><option value="d:${l.day}">${T("整课","Whole day")} · Day ${l.day}</option>`;
    (l.grammar||[]).forEach(g=>{ if(/^[①-⑩\d]/.test(g.point)) return; o+=`<option value="g:${l.day}:${slug(g.point)}|${esc(g.point)}">${T("语法","Grammar")} · ${esc(g.point)}</option>`; });
    (l.vocab||[]).forEach(v=>{ o+=`<option value="v:${slug(v.w)}|${esc(v.w)}">${T("词","Word")} · ${esc(v.w)}</option>`; });
    return o;
  }
  function detailHTML(id){
    const n=getNote(id)||{ title:"", body:"", tags:[], provenance:{kind:"manual"} };
    const isNew=!getNote(id);
    const bls=backlinksTo(id);
    const blHTML=bls.length?`<div class="np-backlinks"><h4>${T("⇠ 被这些笔记引用","⇠ Linked from")}</h4>${bls.map(b=>`<a class="note-nlink" data-nid="${b.id}">${esc(b.title||T("（无标题）","(Untitled)"))}</a>`).join("")}</div>`:"";
    const prov=n.provenance&&n.provenance.kind==="ai-qa"?`<div class="np-prov">${T("🤖 由 AI 问答生成","🤖 From an AI Q&A")}${n.provenance.ai&&n.provenance.ai.studyContext?T("（当时在 Day "+n.provenance.ai.studyContext.day+"）"," (while on Day "+n.provenance.ai.studyContext.day+")"):""}</div>`:"";
    return `<div class="np-detail">
      <div class="np-dhead"><button id="np-back">${T("← 返回","← Back")}</button>${badge(n)}<div class="np-dactions"><span class="np-autosave" id="np-autosave">${T("自动保存","Auto-saved")}</span><button id="np-del" class="np-danger">${T("删除","Delete")}</button><button id="np-save" class="primary">${T("完成","Done")}</button></div></div>
      ${prov}
      <input id="np-title" class="np-title" placeholder="${T("标题…","Title…")}" value="${escAttr(n.title||"")}">
      <div class="np-toolbar">
        <select id="np-course">${courseOptions()}</select>
        <input id="np-tags" class="np-tags-in" placeholder="${T("标签，逗号分隔（如 语法, 音便）","Tags, comma-separated (e.g. grammar, onbin)")}" value="${escAttr((n.tags||[]).join(", "))}">
      </div>
      <textarea id="np-body" class="np-body" placeholder="${T("写下你的理解…&#10;支持 **加粗**、- 列表、漢字[かな] 振假名。&#10;[[另一条笔记的标题]] 链接笔记；用上面「关联课程」插入课程链接。","Write your understanding…&#10;Supports **bold**, - lists, 漢字[かな] furigana.&#10;[[Another note title]] links notes; use \"Link to lesson\" above to insert a lesson link.")}">${esc(n.body||"")}</textarea>
      <div class="np-prevwrap"><div class="np-prevlabel">${T("预览","Preview")}</div><div class="np-preview" id="np-preview">${renderBody(n.body)}</div></div>
      ${blHTML}
    </div>`;
  }

  function insertAtCursor(ta, text){
    const s=ta.selectionStart||ta.value.length, e=ta.selectionEnd||ta.value.length;
    ta.value=ta.value.slice(0,s)+text+ta.value.slice(e);
    ta.selectionStart=ta.selectionEnd=s+text.length; ta.focus();
  }
  function currentEditId(){ return (N.open && getNote(N.open))?N.open:null; }
  function persistDetail(){
    const id=N.open; const t=document.getElementById("np-title"), b=document.getElementById("np-body"), tg=document.getElementById("np-tags");
    if(!t||!b) return null;
    const tags=tg.value.split(/[,，]/).map(x=>x.trim()).filter(Boolean);
    const data={ title:t.value.trim(), body:b.value, tags };
    if(getNote(id)) updateNote(id, data);
    else { const newId=createNote(Object.assign({}, getNote(id)||{}, data, { provenance:{kind:"manual"} })); N.open=newId; return newId; }
    return id;
  }

  function wire(){
    const r=root(); if(!r) return;
    // list
    const nw=document.getElementById("np-new"); if(nw) nw.onclick=()=>{ N.open=createNote({ title:"", body:"" }); renderPage(); };
    const q=document.getElementById("np-q"); if(q) q.oninput=()=>{ N.q=q.value; const list=r.querySelector(".np-list"); if(list){ /* re-render list only */ renderPage(); document.getElementById("np-q").focus(); document.getElementById("np-q").setSelectionRange(q.value.length,q.value.length); } };
    const fl=document.getElementById("np-filter"); if(fl) fl.onchange=()=>{ N.filter=fl.value; renderPage(); };
    r.querySelectorAll(".np-item").forEach(it=>it.onclick=()=>{ N.open=it.dataset.open; renderPage(); });
    // detail — auto-saves while you type; "完成" just returns to the list
    const finish=()=>{ persistDetail(); cleanupIfEmpty(); N.open=null; renderPage(); };
    const back=document.getElementById("np-back"); if(back) back.onclick=finish;
    const title=document.getElementById("np-title"); if(title) title.oninput=autosave;
    const body=document.getElementById("np-body");
    if(body){ const prev=document.getElementById("np-preview"); body.oninput=()=>{ prev.innerHTML=renderBody(body.value); autosave(); }; }
    const save=document.getElementById("np-save"); if(save) save.onclick=finish;
    const del=document.getElementById("np-del"); if(del) del.onclick=()=>{ if(confirm(T("删除这条笔记？","Delete this note?"))){ deleteNote(N.open); N.open=null; renderPage(); } };
    const cs=document.getElementById("np-course"); if(cs) cs.onchange=()=>{ const v=cs.value; if(!v) return; const [id,label]=v.split("|"); const ref=CINDEX.byId[id]; const text=label||(ref?ref.display:id); insertAtCursor(document.getElementById("np-body"), `[[course:${id}|${text}]]`); document.getElementById("np-preview").innerHTML=renderBody(document.getElementById("np-body").value); cs.value=""; };
    // link clicks (delegate within page-notes)
    r.addEventListener("click",(e)=>{
      const cl=e.target.closest(".note-clink,.note-first"); if(cl){ persistDetail(); gotoCourse(cl.dataset.cid); return; }
      const nl=e.target.closest(".note-nlink"); if(nl){ persistDetail(); N.open=nl.dataset.nid; renderPage(); return; }
      const bk=e.target.closest(".note-broken[data-newtitle]"); if(bk){ persistDetail(); N.open=createNote({ title:bk.dataset.newtitle, body:"" }); renderPage(); return; }
    });
  }

  let _asT;
  function autosave(){ clearTimeout(_asT); _asT=setTimeout(()=>{ persistDetail(); const a=document.getElementById("np-autosave"); if(a){ const sv=T("已保存 ✓","Saved ✓"); a.textContent=sv; setTimeout(()=>{ if(a&&a.textContent===sv) a.textContent=T("自动保存","Auto-saved"); },1200); } }, 500); }
  function cleanupIfEmpty(){ const n=getNote(N.open); if(n && !(n.title||"").trim() && !(n.body||"").trim()){ deleteNote(N.open); } }

  /* ---------- quick-notes side panel (always at hand; auto-saves a scratchpad) ---------- */
  function getScratch(){ return STORE.scratch||""; }
  let _scratchT;
  function qOpen(){
    injectQuick();
    const p=document.getElementById("qn-panel"); p.classList.add("show");
    const l=LESSONS[STATE.day-1];
    document.getElementById("qn-ctx").textContent=l?`Day ${l.day}`:"";
    document.getElementById("qn-assoc-day").textContent=l?`Day ${l.day}`:"";
    const ta=document.getElementById("qn-scratch"); ta.value=getScratch(); renderRecent();
    setTimeout(()=>ta.focus(),60);
  }
  function qClose(){ const p=document.getElementById("qn-panel"); if(p) p.classList.remove("show"); }
  function qStatus(html){ const s=document.getElementById("qn-status"); if(!s) return; s.innerHTML=html; }
  function saveSection(){
    const ta=document.getElementById("qn-scratch"); const text=(ta.value||"").trim();
    if(!text){ qStatus(T("草稿是空的，先写点什么吧。","Draft is empty — write something first.")); return; }
    const assoc=document.getElementById("qn-assoc").checked, day=STATE.day, theme=(LESSONS[day-1]||{}).theme||"";
    const first=text.split("\n").find(x=>x.trim())||"";
    const body=text + (assoc?`\n\n${T("关联","Linked")}：[[course:d:${day}|Day ${day} · ${theme}]]`:"");
    const id=createNote({ title:first.slice(0,28)||((LANG==="en"?"Note ":"速记 ")+new Date().toISOString().slice(0,10)),
      body, tags:assoc?[T("速记","quick"),"Day"+day]:[T("速记","quick")], provenance:{kind:"manual", source:"scratch"} });
    renderRecent();
    qStatus(`${T("已存为 Section ✓","Saved as a Section ✓")} <a class="qn-view" data-nid="${id}">${T("查看","View")}</a> · <a class="qn-clear">${T("清空草稿","Clear draft")}</a>`);
  }
  function renderRecent(){
    const box=document.getElementById("qn-recent"); if(!box) return;
    const items=allNotes().slice(0,5);
    box.innerHTML=`<div class="qn-recent-h">${T("最近的笔记","Recent notes")}</div>`+(items.length
      ? items.map(n=>`<a class="qn-rec-item" data-nid="${n.id}">${badge(n)} ${esc(n.title||T("（无标题）","(Untitled)"))}</a>`).join("")
      : `<div class="qn-empty">${T("还没有笔记。","No notes yet.")}</div>`);
  }
  function injectQuick(){
    if(document.getElementById("qn-fab")) return;
    const fab=document.createElement("button"); fab.id="qn-fab"; fab.type="button"; fab.textContent="🗒️"; fab.title=T("速记本（可拖动）","Quick notes (draggable)");
    document.body.appendChild(fab);
    const p=document.createElement("div"); p.id="qn-panel";
    p.innerHTML=`<div class="qn-head"><b>${T("🗒️ 速记本","🗒️ Quick Notes")}</b><span class="qn-tag-draft">${T("草稿","draft")}</span><span class="qn-ctx" id="qn-ctx"></span><button id="qn-close">✕</button></div>
      <div class="qn-hint">${T("随手记，<b>自动保存</b>。这是<b>草稿箱</b>；整理好按「保存为 Section」存成一条正式笔记（进入顶部 📓 笔记库），并可选择是否关联当前课。","Jot freely — <b>auto-saved</b>. This is your <b>draft pad</b>; press \"Save as Section\" to turn it into a formal note (it appears in 📓 My Notes), optionally linked to the current day.")}</div>
      <textarea id="qn-scratch" placeholder="${T("在这里随手记下疑问、心得、想背的句子…（自动保存）","Jot questions, insights, sentences to memorize… (auto-saved)")}"></textarea>
      <div class="qn-saverow">
        <label class="qn-assoc"><input type="checkbox" id="qn-assoc" checked> ${T("关联当前课","Link to current day")} <b id="qn-assoc-day"></b></label>
        <button id="qn-section" class="primary">${T("保存为 Section","Save as Section")}</button>
      </div>
      <div class="qn-status" id="qn-status"></div>
      <div class="qn-recent" id="qn-recent"></div>
      <div class="qn-foot"><a id="qn-manage">${T("管理全部笔记 →","Manage all notes →")}</a></div>`;
    document.body.appendChild(p);
    if(window.makeDraggable) makeDraggable(fab,"jpn-qnfab-pos",qOpen); else fab.onclick=qOpen;
    document.getElementById("qn-close").onclick=qClose;
    const ta=document.getElementById("qn-scratch"); ta.value=getScratch();
    ta.addEventListener("input",()=>{ clearTimeout(_scratchT); _scratchT=setTimeout(()=>{ STORE.scratch=ta.value; save(STORE); const m=T("已自动保存 ✓","Auto-saved ✓"); qStatus(m); setTimeout(()=>{ const s=document.getElementById("qn-status"); if(s&&s.textContent===m) s.textContent=""; },1200); },400); });
    document.getElementById("qn-section").onclick=saveSection;
    document.getElementById("qn-manage").onclick=()=>{ qClose(); showPage("notes"); };
    p.addEventListener("click",(e)=>{
      const v=e.target.closest(".qn-view,.qn-rec-item"); if(v){ N.open=v.dataset.nid; qClose(); showPage("notes"); return; }
      if(e.target.classList.contains("qn-clear")){ document.getElementById("qn-scratch").value=""; STORE.scratch=""; save(STORE); qStatus(T("已清空草稿","Draft cleared")); }
    });
  }

  /* ---------- home card ---------- */
  function homeCardHTML(){
    const items=allNotes().slice(0,3);
    const list=items.length
      ? items.map(n=>`<a class="np-home-item" data-nid="${n.id}">${badge(n)} ${esc(n.title||T("（无标题）","(Untitled)"))}</a>`).join("")
      : `<p class="hc-empty">${T("还没有笔记。学习时点右下角 🗒️ 随手记，自动保存。","No notes yet. Tap 🗒️ (bottom-right) to jot as you study — auto-saved.")}</p>`;
    return `<section class="home-card">
      <h2>${T("🗒️ 速记本","🗒️ Quick Notes")} <span class="np-count">${allNotes().length}</span></h2>
      <p class="np-home-tip">${T("手边的笔记：随时记下疑问与心得，自动保存；可整理成与课程关联的 Section。","Notes at hand: jot questions & insights anytime (auto-saved); turn them into lesson-linked Sections.")}</p>
      <div class="np-home-list">${list}</div>
      <div class="np-home-actions"><button class="np-home-open">${T("✍️ 打开速记本","✍️ Open quick notes")}</button><a class="np-home-all">${T("管理全部 →","Manage all →")}</a></div>
    </section>`;
  }
  // delegated handlers for the home card (home is re-rendered by app.js)
  document.addEventListener("click",(e)=>{
    if(e.target.closest(".np-home-open")){ qOpen(); return; }
    if(e.target.closest(".np-home-all")){ showPage("notes"); return; }
    const it=e.target.closest(".np-home-item"); if(it){ N.open=it.dataset.nid; showPage("notes"); }
  });

  /* ---------- AI assistant integration ---------- */
  function saveBtnHTML(){ return `<button class="note-save-ai">${T("📝 存为笔记","📝 Save as note")}</button>`; }
  function bindSaveBtn(node, ex){
    const b=node.querySelector(".note-save-ai"); if(!b) return;
    b.onclick=()=>{
      const day=ex.day, theme=(LESSONS[day-1]||{}).theme||"";
      const id=createNote({
        title:(ex.q||"AI Q&A").slice(0,28)+((ex.q||"").length>28?"…":""),
        body:`**${T("问","Q")}：** ${ex.q}\n\n**${T("答","A")}：**\n${ex.a}\n\n${T("关联","Linked")}：[[course:d:${day}|Day ${day} · ${theme}]]`,
        tags:["AI", "Day"+day].filter(Boolean),
        provenance:{ kind:"ai-qa", ai:{ question:ex.q, answer:ex.a, studyContext:{ day:ex.day, session:ex.session } } }
      });
      b.textContent=T("已存为笔记 ✓","Saved as note ✓"); b.disabled=true;
      b.insertAdjacentHTML("afterend", ` <button class="note-goto" data-nid="${id}">${T("查看","View")}</button>`);
      const go=b.nextElementSibling; if(go) go.onclick=()=>{ N.open=id; showPage("notes"); };
    };
  }

  window.Notes={ renderPage, saveBtnHTML, bindSaveBtn, homeCardHTML, openQuick:qOpen,
    count:()=>allNotes().length, reload:()=>{ STORE=load(); } };
  window.QuickNotes={ open:qOpen, close:qClose };
  if(document.readyState!=="loading") injectQuick();
  else document.addEventListener("DOMContentLoaded", injectQuick);
})();
