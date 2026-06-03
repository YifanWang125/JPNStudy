/* ============================================================================
 *  🥚 Study Pet (v1.1, Phase A) — a Tamagotchi-style companion that GROWS from
 *  real study progress. Procedural pixel creatures (seed → genome → canvas), so
 *  every pet is unique & collectible with zero asset files (works on file://).
 *
 *  Design: docs/PET-GAME-DESIGN.md. Principle — "Sensei is the brain, the pet is
 *  the heart": the 📖 AI assistant (assistant.js) is untouched & always available;
 *  this pet is an additive companion. Growth = Study XP (derived from existing
 *  jpn-n2-progress / jpn-test-best / jpn-active-dates, so it's retroactive &
 *  monotonic). Care (feed/wash/clean/play/sleep) keeps it ALIVE; study makes it
 *  GROW. Real stakes: it can get sick and die (permanent) — but never runs away,
 *  and the tuning is forgiving (capped offline decay + warnings).
 * ==========================================================================*/
(function(){
  "use strict";
  const KEY="jpn-pet";
  const T=(z,e)=> (window.LANG==="en" && e!=null) ? e : z;   // mirrors app.js T(), reads global LANG

  // ---- tunables (forgiving; all in one place to dial difficulty) ------------
  const TUNE={
    hatchCost:30,                         // SXP since adoption to hatch the egg
    dec:{hunger:3.0,clean:2.5,happy:3.0,energy:2.6},   // meter loss per hour
    offlineCapH:48,                       // cap catch-up decay so a vacation ≠ instant death
    poopEveryH:7,                         // hours between poops
    sickGraceH:24,                        // hours a meter must stay critical before sickness
    hpDrain:2.0, hpRegen:3.0,             // HP per hour while bad / healthy
    coinsPerSXP:1/3,                      // study → spendable coins
    feedCost:3, medCost:8,                // coin costs
  };
  const STAGES=[["hatchling",0],["child",60],["teen",160],["adult",340],["elder",640]];
  const NAMES=["モチ","あんこ","だいふく","こんぶ","しお","ぽち","たま","くろ","みけ","ちび","まめ","ゆず","きなこ","ふく","そら"];

  // ---- state ----------------------------------------------------------------
  function load(){ try{ return JSON.parse(localStorage.getItem(KEY))||fresh(); }catch(e){ return fresh(); } }
  function fresh(){ return {v:1, active:null, spent:0, pets:{}, memorial:[], dex:{}, mourning:false}; }
  let S=load();
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }
  const clamp=(v,a,b)=>Math.max(a==null?0:a,Math.min(b==null?100:b,v));
  const now=()=>Date.now();

  // ---- Study XP (derived from existing progress; monotonic & retroactive) ---
  function studySXP(){
    let sxp=0;
    try{ const p=JSON.parse(localStorage.getItem("jpn-n2-progress"))||{};
      for(const d in p){ const o=p[d]||{}; ["morning","noon","night"].forEach(s=>{ if(o[s]) sxp+=10; });
        if(o.morning&&o.noon&&o.night) sxp+=20; } }catch(e){}
    try{ const b=JSON.parse(localStorage.getItem("jpn-test-best"))||{};
      for(const id in b){ const t=b[id]; if(t&&t.total) sxp+=Math.round(t.score/t.total*50); } }catch(e){}
    try{ const a=JSON.parse(localStorage.getItem("jpn-active-dates"))||[]; sxp+=a.length*8; }catch(e){}
    return sxp;
  }
  function coins(){ return Math.max(0, Math.floor(studySXP()*TUNE.coinsPerSXP) - (S.spent||0)); }
  function spend(n){ if(coins()<n) return false; S.spent=(S.spent||0)+n; save(); return true; }

  // ---- deterministic genome (seed → traits) ---------------------------------
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const pk=(r,arr)=>arr[Math.floor(r()*arr.length)];
  function genome(seed){
    const r=mulberry32((seed||1)>>>0);
    const hue=Math.floor(r()*360), cool=r()<0.5;
    const sat=cool?55+r()*18:72+r()*22, lit=cool?56+r()*9:62+r()*11;
    const ah=(hue+(r()<.5?40:300))%360;
    return { seed, hue, cool,
      body:`hsl(${hue} ${sat}% ${lit}%)`,
      belly:`hsl(${hue} ${Math.max(18,sat-32)}% ${Math.min(93,lit+20)}%)`,
      outline:`hsl(${hue} ${Math.min(70,sat+5)}% ${Math.max(16,lit-40)}%)`,
      accent:`hsl(${ah} ${sat}% ${Math.max(30,lit-10)}%)`,
      ears:pk(r,["none","cat","bunny","horn","round"]),
      tail:pk(r,["none","cat","spike","puff"]),
      eyes:pk(r,["dot","round","sparkle","sleepy"]),
      pattern:pk(r,["none","belly","spots","stripe"]),
      vibe: cool?"cool":"cute",
    };
  }

  // ---- pixel renderer (32×32 logical grid, symmetric) -----------------------
  const G=32;
  const SP={ egg:{rx:9,ry:12,cy:16,feat:0}, hatchling:{rx:8,ry:8,cy:20,feat:1},
    child:{rx:9.5,ry:9,cy:19,feat:2}, teen:{rx:10.5,ry:10,cy:18,feat:3},
    adult:{rx:11.5,ry:11,cy:17,feat:4}, elder:{rx:11.5,ry:11,cy:17,feat:4} };
  function drawCreature(canvas, g, stage, mood, frame){
    const ctx=canvas.getContext("2d"), size=canvas.width;
    ctx.clearRect(0,0,size,size); ctx.imageSmoothingEnabled=false;
    const cell=size/G, P=SP[stage]||SP.child;
    const oy=(stage==="egg"||mood==="dead")?0:Math.round(Math.sin(frame/22)*1);  // idle bob
    const blink=(stage!=="egg"&&mood!=="dead"&&(frame%140<7));
    const mask={}, kind={};                       // kind: 'body'|'belly'|'accent'
    const add=(x,y,k)=>{ x=Math.round(x); y=Math.round(y)+oy; if(x<0||x>=G||y<0||y>=G)return; mask[x+","+y]=1; if(k)kind[x+","+y]=k; };
    const sym=(x,y,k)=>{ add(x,y,k); add(G-1-x,y,k); };

    if(stage==="egg"){
      for(let y=0;y<G;y++)for(let x=0;x<G;x++){ const dx=(x-15.5)/P.rx, dy=(y-P.cy)/P.ry; if(dx*dx+dy*dy<=1) mask[x+","+y]="body"&&(kind[x+","+y]="body",1)||(mask[x+","+y]=1); }
      // speckles (deterministic)
      const r=mulberry32((g.seed^0x9e37)>>>0);
      for(let i=0;i<14;i++){ const x=4+Math.floor(r()*24), y=8+Math.floor(r()*18); if(mask[x+","+y]) kind[x+","+y]="accent"; }
    } else {
      // body ellipse
      for(let y=0;y<G;y++)for(let x=0;x<G;x++){ const dx=(x-15.5)/P.rx, dy=(y-P.cy)/P.ry; if(dx*dx+dy*dy<=1){ mask[x+","+y]=1; kind[x+","+y]="body"; } }
      // belly (lower-center lighter)
      for(let y=P.cy;y<G;y++)for(let x=0;x<G;x++){ const dx=(x-15.5)/(P.rx*0.6), dy=(y-(P.cy+P.ry*0.45))/(P.ry*0.5); if(mask[x+","+y]&&dx*dx+dy*dy<=1) kind[x+","+y]="belly"; }
      const top=P.cy-P.ry;
      // ears (feat>=2)
      if(P.feat>=2 && g.ears!=="none"){ const ex=Math.round(15.5-P.rx*0.62);
        if(g.ears==="cat"){ for(let i=0;i<4;i++){ sym(ex-1+i,top-1-i,"body"); sym(ex+i,top-1-i,"body"); } }
        else if(g.ears==="bunny"){ for(let i=0;i<6;i++){ sym(ex,top-1-i,"body"); sym(ex+1,top-1-i,"body"); } }
        else if(g.ears==="horn"){ for(let i=0;i<4;i++){ sym(ex+1,top-i,"accent"); } }
        else { for(let i=0;i<3;i++){ sym(ex+i,top-2,"body"); sym(ex,top-2-i,"body"); } } // round
      }
      // tail (feat>=3) on the right side
      if(P.feat>=3 && g.tail!=="none"){ const ty=P.cy+P.ry*0.5, tx=15.5+P.rx*0.8;
        if(g.tail==="spike"){ for(let i=0;i<4;i++) add(tx+i,ty-i,"accent"); }
        else if(g.tail==="puff"){ for(let i=0;i<3;i++){ add(tx+i,ty,"body"); add(tx+i,ty-1,"body"); } }
        else { for(let i=0;i<4;i++) add(tx+i,ty-Math.floor(i/2),"body"); }
      }
      // feet (feat>=4)
      if(P.feat>=4){ const fy=Math.round(P.cy+P.ry*0.92); sym(Math.round(15.5-P.rx*0.45),fy,"body"); sym(Math.round(15.5-P.rx*0.45),fy+1,"body"); }
      // pattern
      if(g.pattern==="spots"||g.pattern==="stripe"){ const r=mulberry32((g.seed^0x51ed)>>>0);
        if(g.pattern==="spots"){ for(let i=0;i<6;i++){ const x=8+Math.floor(r()*16),y=P.cy-2+Math.floor(r()*8); if(kind[x+","+y]==="body"){ kind[x+","+y]="accent"; kind[(x+1)+","+y]="accent"; } } }
        else { for(let x=0;x<G;x++){ const y=Math.round(P.cy-P.ry*0.4); if(kind[x+","+y]==="body") kind[x+","+y]="accent"; } }
      }
    }

    // paint: outline edges, then fill by kind
    const col=(k)=> k==="belly"?g.belly : k==="accent"?g.accent : g.body;
    const has=(x,y)=>mask[x+","+y];
    for(const key in mask){ const [x,y]=key.split(",").map(Number);
      const edge = !has(x-1,y)||!has(x+1,y)||!has(x,y-1)||!has(x,y+1);
      ctx.fillStyle = edge ? g.outline : col(kind[key]);
      ctx.fillRect(x*cell, y*cell, Math.ceil(cell), Math.ceil(cell));
    }

    if(stage==="egg") return;
    // ---- face ----
    const eyeY=Math.round(P.cy-P.ry*0.18+oy), eyeDx=Math.round(P.rx*0.42);
    const ink=g.outline, white="#fff";
    const drawEye=(cx)=>{
      if(mood==="dead"||mood==="sick"){ // x_x
        ctx.fillStyle=ink; ctx.fillRect((cx-1)*cell,(eyeY-1)*cell,cell,cell); ctx.fillRect((cx+1)*cell,(eyeY+1)*cell,cell,cell);
        ctx.fillRect((cx+1)*cell,(eyeY-1)*cell,cell,cell); ctx.fillRect((cx-1)*cell,(eyeY+1)*cell,cell,cell);
        ctx.fillRect(cx*cell,eyeY*cell,cell,cell); return; }
      if(blink||mood==="sleepy"){ ctx.fillStyle=ink; ctx.fillRect((cx-1)*cell,eyeY*cell,3*cell,cell); return; }
      // round eye: white + pupil
      ctx.fillStyle=white; ctx.fillRect((cx-1)*cell,(eyeY-1)*cell,3*cell,3*cell);
      ctx.fillStyle=ink;   const pdx=mood==="sad"?0:0, pdy=mood==="sad"?1:0;
      ctx.fillRect((cx+pdx)*cell,(eyeY+pdy)*cell,cell, (g.eyes==="dot"?cell:1.6*cell));
      if(g.eyes==="sparkle"){ ctx.fillStyle=white; ctx.fillRect((cx-1)*cell,(eyeY-1)*cell,cell,cell); }
    };
    drawEye(Math.round(15.5-eyeDx)); drawEye(Math.round(15.5+eyeDx));
    // mouth
    const my=Math.round(P.cy+P.ry*0.32+oy); ctx.fillStyle=ink;
    if(mood==="happy"){ ctx.fillRect((15.5-2)*cell,my*cell,4*cell,cell); ctx.fillRect((15.5-3)*cell,(my-1)*cell,cell,cell); ctx.fillRect((15.5+2)*cell,(my-1)*cell,cell,cell); }
    else if(mood==="sad"||mood==="sick"){ ctx.fillRect((15.5-2)*cell,my*cell,4*cell,cell); ctx.fillRect((15.5-3)*cell,(my+1)*cell,cell,cell); ctx.fillRect((15.5+2)*cell,(my+1)*cell,cell,cell); }
    else { ctx.fillRect((15.5-1)*cell,my*cell,2*cell,cell); }
    // rosy cheeks when happy
    if(mood==="happy"){ ctx.fillStyle="rgba(255,120,120,.5)"; const chy=Math.round(P.cy+P.ry*0.12+oy);
      ctx.fillRect(Math.round(15.5-eyeDx-1)*cell,chy*cell,2*cell,cell); ctx.fillRect(Math.round(15.5+eyeDx)*cell,chy*cell,2*cell,cell); }
  }

  // ---- lifecycle helpers ----------------------------------------------------
  function pet(){ return S.active?S.pets[S.active]:null; }
  function stageOf(p){ if(p.stage==="egg") return "egg";
    const s=studySXP()-(p.hatchBase||0); let st="hatchling";
    for(const [name,need] of STAGES){ if(s>=need) st=name; } return st; }
  function decay(p){
    if(p.diedAt) return;
    const m=p.meters, h=Math.min(TUNE.offlineCapH,(now()-m.ts)/3.6e6); if(h<=0) return;
    m.hunger=clamp(m.hunger-h*TUNE.dec.hunger); m.clean=clamp(m.clean-h*TUNE.dec.clean);
    m.happy=clamp(m.happy-h*TUNE.dec.happy);  m.energy=clamp(m.energy-h*TUNE.dec.energy); m.ts=now();
    if(p.stage!=="egg"){
      if(!p.hasPoop && now()>=(p.poopAt||0)){ p.hasPoop=true; m.clean=clamp(m.clean-8); }
      const crit = m.clean<20||m.hunger<15;
      if(crit){ p.sickSince=p.sickSince||now(); if((now()-p.sickSince)/3.6e6>=TUNE.sickGraceH) p.sick=true; }
      else { p.sickSince=null; if(m.clean>45&&m.hunger>40) p.sick=false; }
      const bad = p.sick||m.hunger<8||m.energy<8;
      p.hp=clamp((p.hp==null?100:p.hp)+(bad?-1:1)*h*(bad?TUNE.hpDrain:TUNE.hpRegen));
      if(p.hp<=0) die(p);
    }
    // hatch?
    if(p.stage==="egg" && studySXP()>=(p.hatchAt||Infinity)) hatch(p);
    else if(p.stage!=="egg") p.stage=stageOf(p);
  }
  function hatch(p){ p.stage="hatchling"; p.hatchBase=studySXP(); p.bornAt=now();
    p.meters={hunger:80,clean:85,happy:95,energy:80,ts:now()}; p.hp=100; p.hasPoop=false;
    p.poopAt=now()+TUNE.poopEveryH*3.6e6; if(!p.name) p.name=NAMES[Math.floor(Math.random()*NAMES.length)];
    S.dex[p.species]=S.dex[p.species]||{}; S.dex[p.species].hatched=true; save(); }
  function die(p){ p.diedAt=now(); S.memorial.push({name:p.name,seed:p.seed,bornAt:p.bornAt,diedAt:p.diedAt});
    S.active=null; S.mourning=true; save(); }

  // ---- adoption: fate hands you ONE precious egg (no choosing) ---------------
  function adopt(seed){ const uid="p"+now().toString(36);
    S.pets[uid]={ uid, seed, species:"sp"+(seed%24), name:null, stage:"egg", found:now(),
      adoptSXP:studySXP(), hatchAt:studySXP()+TUNE.hatchCost, bornAt:now(),
      meters:{hunger:100,clean:100,happy:100,energy:100,ts:now()}, hp:100 };
    S.active=uid; S.dex["sp"+(seed%24)]={seen:true}; save(); }
  function ensureEgg(){ if(!S.active && !S.mourning) adopt(Math.floor(Math.random()*1e9)); }
  function welcomeNewEgg(){ S.mourning=false; adopt(Math.floor(Math.random()*1e9)); refresh(); }

  // ---- mood + speech --------------------------------------------------------
  function moodOf(p){ if(p.diedAt) return "dead"; if(p.sick) return "sick";
    const m=p.meters, avg=(m.hunger+m.clean+m.happy+m.energy)/4;
    if(m.energy<15) return "sleepy"; if(avg<35||m.hunger<20) return "sad"; if(avg>70) return "happy"; return "ok"; }
  let JUST_STUDIED=0;
  function says(p){ const m=p.meters;
    if(JUST_STUDIED && now()-JUST_STUDIED<8000) return T("やった、一緒に頑張ろう！","Yay — let's study together!");
    if(p.sick) return T("ぐすん…ちょっと具合悪いよ…💊","I don't feel so good… 💊");
    if(p.hasPoop) return T("💩 そうじ してほしいな…","Could you clean my poop? 💩");
    if(m.hunger<25) return T("おなかすいた…ごはん つれてって！","I'm hungry… take me to eat!");
    if(m.energy<20) return T("ねむい…zzz","So sleepy… zzz");
    if(m.happy<30) return T("ねえねえ、あそぼうよ！","Hey, let's play!");
    if(p.stage==="egg"){
      if(now()-(p.found||0)<60000) return T("ふしぎなタマゴが届いた…縁だね。大事に育てよう！","A mysterious egg found its way to you… fate. Let's raise it with care!");
      return T("コツコツ勉強すると、生まれるよ…！","Keep studying and I'll hatch…!");
    }
    return T("きょうも えらいね！","You're doing great today!");
  }

  // ---- panel UI -------------------------------------------------------------
  function bar(label,v,cls){ return `<div class="pet-meter"><span>${label}</span><i class="${cls}"><b style="width:${Math.round(clamp(v))}%"></b></i></div>`; }
  function panelHTML(){
    const p=pet();
    if(!p) return "";   // renderInto guarantees a pet via ensureEgg() before calling this
    const st=p.diedAt?"—":stageOf(p), mood=moodOf(p), since=studySXP()-(p.hatchBase||p.adoptSXP||0);
    let next=null,prev=0; for(const [n,need] of STAGES){ if(since>=need) prev=need; else { next=need; break; } }
    const toNext = p.stage==="egg" ? Math.round((studySXP()-(p.adoptSXP||0))/TUNE.hatchCost*100)
                 : next==null?100:Math.round((since-prev)/(next-prev)*100);
    const stageLbl={egg:T("たまご","Egg"),hatchling:T("赤ちゃん","Baby"),child:T("こども","Child"),teen:T("わかもの","Teen"),adult:T("おとな","Adult"),elder:T("長老","Elder")};
    const warn = (p.sick)?`<div class="pet-warn">🤒 ${T("具合が悪いよ。お薬で治してね（成長が止まってる）","Sick — cure it with medicine (growth is paused)")}</div>`:"";
    return `<div class="pet-box" data-uid="${p.uid}">
      <div class="pet-head"><b class="pet-name">${esc(p.name||"…")}</b><span class="pet-stage">${stageLbl[p.stage]||st}</span><span class="pet-coins">🪙 ${coins()}</span></div>
      <div class="pet-stage-wrap"><canvas class="pet-canvas" width="132" height="132"></canvas></div>
      <div class="pet-speech">${esc(says(p))}</div>
      ${warn}
      <div class="pet-xp"><span>${p.stage==="egg"?T("孵化","Hatch"):T("成长","Growth")}</span><i><b style="width:${clamp(toNext)}%"></b></i></div>
      ${p.stage==="egg"?"":`<div class="pet-meters">
        ${bar("🍙",p.meters.hunger,"m-hunger")}${bar("🛁",p.meters.clean,"m-clean")}
        ${bar("😊",p.meters.happy,"m-happy")}${bar("⚡",p.meters.energy,"m-energy")}
        <div class="pet-meter pet-hp"><span>❤️</span><i class="m-hp"><b style="width:${clamp(p.hp==null?100:p.hp)}%"></b></i></div></div>
        <div class="pet-actions">
          <button data-act="feed" title="${T('喂食 (🪙3)','Feed (🪙3)')}">🍙</button>
          <button data-act="wash" title="${T('洗澡','Wash')}">🛁</button>
          <button data-act="poop" title="${T('清理便便','Clean poop')}"${p.hasPoop?"":" disabled"}>💩</button>
          <button data-act="play" title="${T('玩耍','Play')}">🎾</button>
          <button data-act="sleep" title="${T('睡觉','Sleep')}">😴</button>
          ${p.sick?`<button data-act="med" title="${T('吃药 (🪙8)','Medicine (🪙8)')}">💊</button>`:""}
        </div>`}
    </div>`;
  }
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

  // ---- actions --------------------------------------------------------------
  function act(a){ const p=pet(); if(!p||p.diedAt) return; const m=p.meters; decay(p);
    if(a==="feed"){ if(!spend(TUNE.feedCost)) return flash(T("コインが足りない…勉強してね！","Not enough coins — study more!")); m.hunger=clamp(m.hunger+35); m.happy=clamp(m.happy+5); }
    else if(a==="wash"){ m.clean=clamp(m.clean+40); }
    else if(a==="poop"){ if(p.hasPoop){ p.hasPoop=false; p.poopAt=now()+TUNE.poopEveryH*3.6e6; m.clean=clamp(m.clean+18); } }
    else if(a==="play"){ m.happy=clamp(m.happy+30); m.energy=clamp(m.energy-8); }
    else if(a==="sleep"){ m.energy=clamp(m.energy+50); }
    else if(a==="med"){ if(!spend(TUNE.medCost)) return flash(T("コインが足りない…","Not enough coins…")); p.sick=false; p.sickSince=null; p.hp=clamp((p.hp||0)+15); m.clean=clamp(m.clean+10); }
    save(); refresh();
  }
  let FLASH=""; function flash(msg){ FLASH=msg; refresh(); setTimeout(()=>{ FLASH=""; refresh(); },1800); }

  // ---- mounting + animation -------------------------------------------------
  let RAF=0, FRAME=0;
  function draw(){ FRAME++;
    document.querySelectorAll(".pet-canvas").forEach(cv=>{ const p=pet(); if(p) drawCreature(cv, genome(p.seed), p.stage, moodOf(p), FRAME); });
    RAF=requestAnimationFrame(draw);
  }
  function startAnim(){ if(!RAF) RAF=requestAnimationFrame(draw); }
  function stopAnim(){ if(RAF) cancelAnimationFrame(RAF); RAF=0; }

  function bind(root){
    root.querySelectorAll(".pet-newegg").forEach(b=>b.onclick=welcomeNewEgg);
    root.querySelectorAll(".pet-actions button").forEach(b=>b.onclick=()=>act(b.dataset.act));
    const cv=root.querySelector(".pet-canvas"); if(cv) cv.onclick=()=>{ const p=pet(); if(p&&!p.diedAt){ p.meters.happy=clamp(p.meters.happy+6); save(); } };
  }
  function renderInto(el){ if(!el) return;
    if(!S.mourning) ensureEgg();              // fate grants one egg the first time
    const p=pet(); if(p) decay(p);            // decay may trigger death → sets S.mourning
    el.innerHTML = S.mourning ? deathHTML() : panelHTML();
    if(FLASH){ const sp=el.querySelector(".pet-speech"); if(sp) sp.textContent=FLASH; }
    bind(el); startAnim();
  }
  function deathHTML(){ const last=S.memorial[S.memorial.length-1]||{};
    return `<div class="pet-box pet-dead"><h3>🕊️ ${T("おわかれ","Farewell")}</h3>
      <p class="pet-sub">${T(esc(last.name||"パートナー")+" は天国へ旅立ちました。一緒に過ごせてありがとう。",
        esc(last.name||"Your friend")+" has passed on. Thank you for the time together.")}</p>
      <button class="pet-newegg primary">🥚 ${T("新しいたまごを迎える","Welcome a new egg")}</button></div>`; }

  // ---- public mount points --------------------------------------------------
  const RAIL_ID="pet-rail";
  function mountHome(homeContainer){
    // 1) fixed left-gutter rail (wide screens) — fills the empty side space
    let rail=document.getElementById(RAIL_ID);
    if(!rail){ rail=document.createElement("aside"); rail.id=RAIL_ID; rail.className="pet-rail"; document.body.appendChild(rail); }
    renderInto(rail);
    // 2) in-flow card inside the home grid (narrow screens) — CSS shows one or the other
    if(homeContainer){ let card=homeContainer.querySelector("#pet-home-card");
      if(!card){ card=document.createElement("section"); card.id="pet-home-card"; card.className="home-card pet-card";
        const grid=homeContainer.querySelector(".home-grid"); (grid||homeContainer).insertBefore(card,(grid||homeContainer).firstChild); }
      renderInto(card);
    }
  }
  function refresh(){ const rail=document.getElementById(RAIL_ID); if(rail) renderInto(rail);
    const card=document.getElementById("pet-home-card"); if(card) renderInto(card); }
  function showRail(on){ const rail=document.getElementById(RAIL_ID); if(rail) rail.classList.toggle("show",!!on); }

  // study event hook (called from app.js markSession / test finish)
  function onStudy(){ JUST_STUDIED=now(); const p=pet(); if(p) decay(p); save(); refresh(); }

  window.Pet={ mountHome, refresh, onStudy, showRail,
    _debug:{ studySXP, state:()=>S, reset:()=>{ S=fresh(); save(); refresh(); },
      genome, draw:(cv,seed,stage,mood,frame)=>drawCreature(cv,genome(seed),stage,mood||"happy",frame||0) } };
})();
