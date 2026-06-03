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
        const fd=firstDayOf(id); const first=(fd&&fd!==ref.day)?` <span class="note-first" data-cid="d:${fd}">↩ 初出 Day ${fd}</span>`:"";
        return `<a class="note-clink" data-cid="${id}">📎 ${text}</a>${first}`;
      }
      const id=titleToId(target); const text=label||target;
      return id ? `<a class="note-nlink" data-nid="${id}">🔗 ${text}</a>`
                : `<a class="note-broken" data-newtitle="${target}">🔗 ${text}</a>`;
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
  function badge(n){ return n.provenance&&n.provenance.kind==="ai-qa" ? `<span class="np-badge ai">🤖 AI</span>` : `<span class="np-badge">✍️ 手写</span>`; }

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
        <div class="np-item-top">${badge(n)}<b>${esc(n.title||"（无标题）")}</b>${bl?`<span class="np-bl">⇠${bl}</span>`:""}</div>
        <div class="np-snip">${snip||"<i>空笔记</i>"}</div>
        <div class="np-tags">${tags}<span class="np-date">${(n.updatedAt||"").slice(0,10)}</span></div>
      </div>`;
    }).join("");
    return `<div class="np-head">
        <h1>📓 我的笔记 <span class="np-count">${allNotes().length}</span></h1>
        <button id="np-new" class="primary">＋ 新建笔记</button>
      </div>
      <p class="np-intro">这里记「你真正想通的东西」，区别于课程大纲。用 <code>[[标题]]</code> 链接其它笔记，用「关联课程」把笔记接回某一课，并能溯源到知识点最早出现的那天。AI 问答也能一键存成笔记。</p>
      <div class="np-bar">
        <input id="np-q" placeholder="🔍 搜索标题 / 正文 / 标签" value="${esc(N.q)}">
        <select id="np-filter">
          <option value="all"${N.filter==="all"?" selected":""}>全部</option>
          <option value="manual"${N.filter==="manual"?" selected":""}>✍️ 手写</option>
          <option value="ai"${N.filter==="ai"?" selected":""}>🤖 来自 AI</option>
        </select>
      </div>
      <div class="np-list">${items||`<div class="np-empty">还没有笔记。点「＋ 新建笔记」，或在学习时用右下角 🤖 提问后「存为笔记」。</div>`}</div>`;
  }
  function courseOptions(){
    const l=LESSONS[STATE.day-1]; if(!l) return "";
    let o=`<option value="">＋ 关联课程…</option><option value="d:${l.day}">整课 · Day ${l.day}</option>`;
    (l.grammar||[]).forEach(g=>{ if(/^[①-⑩\d]/.test(g.point)) return; o+=`<option value="g:${l.day}:${slug(g.point)}|${esc(g.point)}">语法 · ${esc(g.point)}</option>`; });
    (l.vocab||[]).forEach(v=>{ o+=`<option value="v:${slug(v.w)}|${esc(v.w)}">词 · ${esc(v.w)}</option>`; });
    return o;
  }
  function detailHTML(id){
    const n=getNote(id)||{ title:"", body:"", tags:[], provenance:{kind:"manual"} };
    const isNew=!getNote(id);
    const bls=backlinksTo(id);
    const blHTML=bls.length?`<div class="np-backlinks"><h4>⇠ 被这些笔记引用</h4>${bls.map(b=>`<a class="note-nlink" data-nid="${b.id}">${esc(b.title||"（无标题）")}</a>`).join("")}</div>`:"";
    const prov=n.provenance&&n.provenance.kind==="ai-qa"?`<div class="np-prov">🤖 由 AI 问答生成${n.provenance.ai&&n.provenance.ai.studyContext?`（当时在 Day ${n.provenance.ai.studyContext.day}）`:""}</div>`:"";
    return `<div class="np-detail">
      <div class="np-dhead"><button id="np-back">← 返回</button>${isNew?"<span class='np-newtag'>新笔记</span>":badge(n)}<div class="np-dactions"><button id="np-save" class="primary">保存</button>${isNew?"":'<button id="np-del" class="np-danger">删除</button>'}</div></div>
      ${prov}
      <input id="np-title" class="np-title" placeholder="标题…" value="${esc(n.title||"")}">
      <div class="np-toolbar">
        <select id="np-course">${courseOptions()}</select>
        <input id="np-tags" class="np-tags-in" placeholder="标签，逗号分隔（如 语法, 音便）" value="${esc((n.tags||[]).join(", "))}">
      </div>
      <textarea id="np-body" class="np-body" placeholder="写下你的理解…&#10;支持 **加粗**、- 列表、漢字[かな] 振假名。&#10;[[另一条笔记的标题]] 链接笔记；用上面「关联课程」插入课程链接。">${esc(n.body||"")}</textarea>
      <div class="np-prevwrap"><div class="np-prevlabel">预览</div><div class="np-preview" id="np-preview">${renderBody(n.body)}</div></div>
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
    // detail
    const back=document.getElementById("np-back"); if(back) back.onclick=()=>{ persistDetail(); N.open=null; renderPage(); };
    const body=document.getElementById("np-body");
    if(body){ const prev=document.getElementById("np-preview"); body.oninput=()=>{ prev.innerHTML=renderBody(body.value); }; }
    const save=document.getElementById("np-save"); if(save) save.onclick=()=>{ const id=persistDetail(); save.textContent="已保存 ✓"; setTimeout(()=>{ if(document.getElementById("np-save")) document.getElementById("np-save").textContent="保存"; },1200); renderPage(); if(id){ N.open=id; renderPage(); } };
    const del=document.getElementById("np-del"); if(del) del.onclick=()=>{ if(confirm("删除这条笔记？")){ deleteNote(N.open); N.open=null; renderPage(); } };
    const cs=document.getElementById("np-course"); if(cs) cs.onchange=()=>{ const v=cs.value; if(!v) return; const [id,label]=v.split("|"); const ref=CINDEX.byId[id]; const text=label||(ref?ref.display:id); insertAtCursor(document.getElementById("np-body"), `[[course:${id}|${text}]]`); document.getElementById("np-preview").innerHTML=renderBody(document.getElementById("np-body").value); cs.value=""; };
    // link clicks (delegate within page-notes)
    r.addEventListener("click",(e)=>{
      const cl=e.target.closest(".note-clink,.note-first"); if(cl){ persistDetail(); gotoCourse(cl.dataset.cid); return; }
      const nl=e.target.closest(".note-nlink"); if(nl){ persistDetail(); N.open=nl.dataset.nid; renderPage(); return; }
      const bk=e.target.closest(".note-broken[data-newtitle]"); if(bk){ persistDetail(); N.open=createNote({ title:bk.dataset.newtitle, body:"" }); renderPage(); return; }
    });
  }

  /* ---------- AI assistant integration ---------- */
  function saveBtnHTML(){ return `<button class="note-save-ai">📝 存为笔记</button>`; }
  function bindSaveBtn(node, ex){
    const b=node.querySelector(".note-save-ai"); if(!b) return;
    b.onclick=()=>{
      const day=ex.day, theme=(LESSONS[day-1]||{}).theme||"";
      const id=createNote({
        title:(ex.q||"AI 问答").slice(0,28)+((ex.q||"").length>28?"…":""),
        body:`**问：** ${ex.q}\n\n**答：**\n${ex.a}\n\n关联：[[course:d:${day}|Day ${day} · ${theme}]]`,
        tags:["AI", "Day"+day].filter(Boolean),
        provenance:{ kind:"ai-qa", ai:{ question:ex.q, answer:ex.a, studyContext:{ day:ex.day, session:ex.session } } }
      });
      b.textContent="已存为笔记 ✓"; b.disabled=true;
      b.insertAdjacentHTML("afterend", ` <button class="note-goto" data-nid="${id}">查看</button>`);
      const go=b.nextElementSibling; if(go) go.onclick=()=>{ N.open=id; showPage("notes"); };
    };
  }

  window.Notes={ renderPage, saveBtnHTML, bindSaveBtn, count:()=>allNotes().length, reload:()=>{ STORE=load(); } };
})();
