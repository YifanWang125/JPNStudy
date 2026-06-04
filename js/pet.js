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
  const T=(z,e)=>{ const L=window.LANG; if(L==="ja") return (e!=null&&window.JA_UI&&window.JA_UI[e]!=null)?window.JA_UI[e]:(e!=null?e:z); return (L==="en"&&e!=null)?e:z; };   // mirrors app.js T()

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

  // ---- Study XP — growth = EFFORT (showing up) + PROGRESS (real mastery) -----
  // Philosophy: marking sessions "done" is a weak, gameable signal → it's only a
  // small FLOOR (effort). The pet truly grows from PROGRESS — best test scores and
  // best pronunciation. Best-score is un-gameable & monotonic: a plateau adds
  // nothing, beating your record adds exactly the gain, and being stuck low keeps
  // the pet small. Progress is weighted far higher than effort, per the design.
  const J=(k,d)=>{ try{ return JSON.parse(localStorage.getItem(k))||d; }catch(e){ return d; } };
  function effortXP(){
    let e=0; const p=J("jpn-n2-progress",{});
    for(const d in p){ const o=p[d]||{}; ["morning","noon","night"].forEach(s=>{ if(o[s]) e+=5; });
      if(o.morning&&o.noon&&o.night) e+=10; }
    e += (J("jpn-active-dates",[]).length)*4;        // showing up daily
    return e;
  }
  function progressXP(){
    let pr=0;
    const b=J("jpn-test-best",{});                    // mastery = best test scores (un-gameable)
    for(const id in b){ const t=b[id]; if(t&&t.total) pr += (t.score/t.total*100)*1.2; }
    const pb=pronBest(); if(pb>0) pr += pb*0.8;        // best pronunciation
    let exCorrect=0; J("jpn-exercise-log",[]).forEach(x=>{ exCorrect+=(x.score||0); });
    pr += exCorrect*1.6;                               // PRODUCTION reps (highest-value output) → strong growth
    return Math.round(pr);
  }
  function pronBest(){ let m=0; J("jpn-pron-log",[]).forEach(x=>{ if((x.score||0)>m) m=x.score; }); return m; }
  function studySXP(){ return effortXP()+progressXP(); }
  // recent improvement (for the pet to NOTICE & comment) — last two distinct attempts
  function recentGain(log,valFn){ const a=J(log,[]); if(a.length<2) return 0;
    return Math.round((valFn(a[a.length-1]) - valFn(a[a.length-2]))); }
  function coins(){ return Math.max(0, Math.floor(studySXP()*TUNE.coinsPerSXP) + (S.bonus||0) - (S.spent||0)); }
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
      if(p.hp<=0){ die(p); return; }
      if(p.sick && petReg(p)!=="rough" && Math.random()<0.015) evolveRegister(p,"rough");   // neglect → an angry form
    }
    // hatch / stage-up
    if(p.stage==="egg" && studySXP()>=(p.hatchAt||Infinity)) hatch(p);
    else if(p.stage!=="egg"){ const ns=stageOf(p);
      if(ns!==p.stage){ const ord=["hatchling","child","teen","adult","elder"]; const up=ord.indexOf(ns)>ord.indexOf(p.stage); p.stage=ns; if(up) onStageUp(p); }
    }
  }
  function milestone(p,label){ p.milestones=p.milestones||[]; p.milestones.push({ts:now(),label}); while(p.milestones.length>50) p.milestones.shift(); }
  function hatch(p){ p.stage="hatchling"; p.hatchBase=studySXP(); p.bornAt=now();
    p.meters={hunger:80,clean:85,happy:95,energy:80,ts:now()}; p.hp=100; p.hasPoop=false;
    p.poopAt=now()+TUNE.poopEveryH*3.6e6; if(!p.name) p.name=NAMES[Math.floor(Math.random()*NAMES.length)];
    p.milestones=[{ts:now(),label:T("たまごから うまれた！","Hatched from its egg!")}];
    S.dex[p.species]=S.dex[p.species]||{}; S.dex[p.species].hatched=true; save(); }
  function die(p){ p.diedAt=now(); S.memorial.push({name:p.name,seed:p.seed,bornAt:p.bornAt,diedAt:p.diedAt});
    S.active=null; S.mourning=true; save(); }

  // ---- adoption: fate hands you ONE precious egg (no choosing) ---------------
  function adopt(seed){ const uid="p"+now().toString(36);
    S.pets[uid]={ uid, seed, nature:natureOf(seed), species:"sp"+(seed%24), name:null, stage:"egg", found:now(),
      adoptSXP:studySXP(), hatchAt:studySXP()+TUNE.hatchCost, bornAt:now(),
      meters:{hunger:100,clean:100,happy:100,energy:100,ts:now()}, hp:100 };
    S.active=uid; S.dex["sp"+(seed%24)]={seen:true}; S.dex.nat=S.dex.nat||{}; S.dex.nat[natureOf(seed)]=true; save(); }
  function ensureEgg(){ if(!S.active && !S.mourning) adopt(Math.floor(Math.random()*1e9)); }

  // ---- first-time WORLD INTRO (the 言霊 story) — shown once, when the egg first appears ----
  const INTRO=[
    { jp:"むかしむかし——言葉[ことば]には 魂[たましい]が 宿[やど]ると 言[い]われていた。人[ひと]は それを「言霊[ことだま]」と 呼[よ]んだ。",
      zh:"很久很久以前，人们相信：话语之中栖宿着灵魂——他们称它为「言霊」(ことだま)。",
      en:"Long ago, it was said that words carry a spirit. People called it 言霊 (kotodama) — the soul of language." },
    { jp:"多[おお]くの人[ひと]は 気[き]づかない。けれど、あなたの 日本語[にほんご]は——少[すこ]しずつ 光[ひか]りはじめた。",
      zh:"多数人从未察觉。但你的日语，已经一点一点地，开始发出光芒。",
      en:"Most never notice it. But your Japanese has begun, little by little, to glow." },
    { jp:"その光[ひかり]に 引[ひ]き寄[よ]せられ、一[ひと]つの タマゴが あなたのもとへ。それは 言霊[ことだま]を 糧[かて]に 生[い]きるという。",
      zh:"被那光芒吸引，一颗蛋来到了你的身边。据说，它以「言霊」为食而生。",
      en:"Drawn by that glow, an egg has found its way to you — a creature said to live on 言霊 itself." },
    { jp:"えらばれたんだ。学[まな]べば学[まな]ぶほど 言霊[ことだま]は あふれ、この子[こ]は あなたと ともに 育[そだ]っていく。",
      zh:"你被选中了。你学得越深，言霊便越充盈，这孩子也将与你一同成长。",
      en:"You've been chosen. The more deeply you learn, the more 言霊 flows — and it grows alongside you." },
    { jp:"大切[たいせつ]に 育[そだ]てよう。さあ、一緒[いっしょ]に。",
      zh:"好好养育它吧。来，一起。",
      en:"Raise it with care. Now — together." },
  ];
  function maybePetIntro(){ const p=pet(); if(!p||p.stage!=="egg"||S.introSeen) return; showPetIntro(); }
  function showPetIntro(){
    let ov=document.getElementById("pet-intro-ov");
    if(ov) return;
    ov=document.createElement("div"); ov.id="pet-intro-ov"; ov.className="pet-intro-ov"; document.body.appendChild(ov);
    const ruby=s=>window.toRuby?window.toRuby(s):esc(s);
    const lines=INTRO.map((b,i)=>`<div class="pintro-line" style="animation-delay:${0.5+i*1.7}s"><p class="pintro-jp">${ruby(b.jp)}</p><p class="pintro-tr">${esc(window.LANG==="en"?b.en:b.zh)}</p></div>`).join("");
    ov.innerHTML=`<div class="pet-intro">
      <div class="pintro-egg"><canvas class="pet-canvas" width="120" height="120"></canvas></div>
      <h2 class="pintro-title">${ruby(T("言霊[ことだま]の たまご","The Egg of Kotodama"))}</h2>
      <div class="pintro-lines">${lines}</div>
      <button class="pintro-ok" style="animation-delay:${0.5+INTRO.length*1.7}s">${ruby(T("🥚 タマゴを 受[う]け取[と]る","🥚 Receive the egg"))}</button>
      <button class="pintro-skip">${T("スキップ","Skip")}</button>
    </div>`;
    const close=()=>{ S.introSeen=true; save(); ov.remove(); refresh(); };
    ov.querySelector(".pintro-ok").onclick=close;
    ov.querySelector(".pintro-skip").onclick=close;
    startAnim();
  }
  function welcomeNewEgg(){ S.mourning=false; adopt(Math.floor(Math.random()*1e9)); refresh(); }

  // ---- mood + speech --------------------------------------------------------
  function moodOf(p){ if(p.diedAt) return "dead"; if(p.sick) return "sick";
    const m=p.meters, avg=(m.hunger+m.clean+m.happy+m.energy)/4;
    if(m.energy<15) return "sleepy"; if(avg<35||m.hunger<20) return "sad"; if(avg>70) return "happy"; return "ok"; }
  let JUST_STUDIED=0;
  function says(p){ const m=p.meters;
    if(AI_SAY && now()-AI_SAY.ts<12000 && AI_SAY.text) return AI_SAY.text;   // pet's agent spoke
    if(JUST_STUDIED && now()-JUST_STUDIED<9000){
      const tl=J("jpn-test-log",[]), pl=J("jpn-pron-log",[]);   // react to whichever was JUST done
      const usePron=(pl.length?pl[pl.length-1].ts:0) >= (tl.length?tl[tl.length-1].ts:0);
      const g = usePron ? recentGain("jpn-pron-log",x=>x.score||0)
                        : recentGain("jpn-test-log",x=>x.total?x.score/x.total*100:0);
      if(g>=5)  return usePron ? T(`発音[はつおん]、${g}点[てん]アップ！その調子[ちょうし]！`,`Your pronunciation jumped ${g} points — keep it up!`)
                               : T(`前[まえ]より${g}点[てん]アップ！えらい！`,`Up ${g} points from last time — nice work!`);
      if(g<=-5) return T("今回[こんかい]はちょっと残念[ざんねん]…次[つぎ]はいけるよ！","A bit lower this time… you'll get it next round!");
      return T("一緒[いっしょ]に頑張[がんば]ろうね！","Let's keep at it together!");
    }
    if(p.sick) return T("ぐすん…ちょっと具合悪いよ…💊","I don't feel so good… 💊");
    if(p.hasPoop) return T("うんち、そうじ してほしいな…","Could you clean up after me…");
    if(m.hunger<25) return T("おなかすいた…ごはん つれてって！","I'm hungry… take me to eat!");
    if(m.energy<20) return T("ねむい…zzz","So sleepy… zzz");
    if(m.happy<30) return T("ねえねえ、あそぼうよ！","Hey, let's play!");
    if(p.stage==="egg"){
      if(now()-(p.found||0)<60000) return T("ふしぎな タマゴだ…日本語[にほんご]の 言霊[ことだま]で 育[そだ]つらしい。","A mysterious egg… they say it grows on the 言霊 of Japanese.");
      return T("勉強[べんきょう]すると 言霊[ことだま]が あつまって、生[う]まれるよ…！","Study to gather 言霊, and I'll hatch…!");
    }
    const reg=REGISTERS[petReg(p)];                  // evolved dialect/register flavor (zh-mode)
    if(window.LANG!=="en" && reg && reg.idle && reg.idle.length && Math.random()<0.6) return reg.idle[Math.floor(Math.random()*reg.idle.length)];
    const nat=NATURES[petNature(p)];                 // personality-flavored idle line
    if(nat&&nat.idle) return T(nat.idle.jp, nat.idle.en);
    return T("きょうも えらいね！","You're doing great today!");
  }

  // ---- B1: autonomous activity while away → JP log + diary (reading practice) ----
  // Everything the pet "did" is narrated in Japanese, so following its life IS reading
  // drill. Events roll on return, weighted by how long you were gone; seeded by the
  // absence window so a given visit's log is stable on re-open. Templated & offline;
  // Claude can enrich later (Phase B2). Slots: {n}=pet, {f}=friend, {g}=thing.
  const FRIENDS=["ポチ","タマ","くるみ","だんご","ぷりん","こてつ","あおい","モカ"];
  const THINGS=["マンガ","絵本[えほん]","図鑑[ずかん]","小説[しょうせつ]"];
  const EVENTS=[
    {id:"read",  w:3, fx:{happy:4},            jp:"{n}は {g}を 読[よ]んでいた。", zh:"{n}在读{g}。", en:"{n} was reading {g}.", dia:{jp:"{g}を よんだよ。", zh:"读了{g}。", en:"I read {g}."}},
    {id:"walk",  w:3, fx:{energy:-4,happy:3},  jp:"{n}は お散歩[さんぽ]に 行[い]ってきた。", zh:"{n}出去散步了。", en:"{n} went for a walk.", dia:{jp:"おさんぽ、たのしかった。", zh:"散步很开心。", en:"The walk was fun."}},
    {id:"friend",w:3, fx:{happy:8},            jp:"{f}が 遊[あそ]びに 来[き]た。", zh:"{f}来玩了。", en:"{f} came over to play.", dia:{jp:"{f}が きてくれて うれしかった！", zh:"{f}来了，好开心！", en:"{f} came over — I was so happy!"}},
    {id:"karaoke",w:2,fx:{happy:10,energy:-5}, jp:"{n}と {f}は カラオケで 歌[うた]った。", zh:"{n}和{f}唱了卡拉OK。", en:"{n} and {f} sang karaoke.", dia:{jp:"カラオケで いっぱい うたった♪", zh:"在卡拉OK唱了好多♪", en:"We sang a ton of karaoke ♪"}},
    {id:"eat",   w:3, fx:{hunger:10},          jp:"{n}は おやつを 食[た]べた。", zh:"{n}吃了点心。", en:"{n} had a snack.", dia:{jp:"おやつ、おいしかった！", zh:"点心好好吃！", en:"The snack was yummy!"}},
    {id:"fight", w:1, fx:{health:-6,happy:-6}, jp:"{n}は {f}と けんかして、ちょっと 怪我[けが]を した。", zh:"{n}和{f}吵架了，受了点小伤。", en:"{n} squabbled with {f} and got a little hurt.", dia:{jp:"でも ちょっと けんかして、いたかった…。", zh:"不过吵了架，有点痛…。", en:"But we had a little fight… it hurt."}},
    {id:"nap",   w:2, fx:{energy:12},          jp:"{n}は ひなたで ひるねを した。", zh:"{n}在阳光下午睡了。", en:"{n} napped in the sun.", dia:{jp:"ひるね、きもちよかった〜。", zh:"午睡好舒服～。", en:"That nap felt so good~"}},
    {id:"study", w:2, fx:{happy:5},            jp:"{n}は ひとりで ひらがなを 練習[れんしゅう]していた。", zh:"{n}自己练了平假名。", en:"{n} practiced hiragana on its own.", dia:{jp:"べんきょうも がんばったんだよ！", zh:"我也努力学习了哦！", en:"I studied hard too!"}},
    {id:"coin",  w:1, fx:{coin:2},             jp:"{n}は 道[みち]で コインを 拾[ひろ]った。", zh:"{n}在路上捡到了硬币。", en:"{n} found a coin on the road.", dia:{jp:"コインも ひろっちゃった！ラッキー。", zh:"还捡到了硬币！真幸运。", en:"I even found a coin! Lucky."}},
  ];
  // ---- PERSONALITY (nature) — drives tone, activity bias & the JP VOCABULARY DOMAIN ----
  // Like a Pokémon nature: deterministic from the seed. Each nature biases which events
  // happen and ADDS its own domain-flavored events, so a sporty pet's diary teaches sports
  // Japanese, a foodie's teaches food words, etc. (the "richer learning scenarios" idea).
  // idle = the pet's characteristic bubble line; ev = its signature activities w/ domain vocab.
  const NATURES={
    genki:{ jp:"元気[げんき]", zh:"活泼·爱运动", en:"Energetic", idle:{jp:"いっしょに 体[からだ]、動[うご]かそうぜ！",en:"Let's get moving together!"}, ev:[
      {w:9,fx:{happy:8,energy:-6},jp:"{n}は {f}と バスケで タイマン勝負[しょうぶ]した。{f}、めっちゃ上手[うま]かった！",zh:"{n}和{f}打篮球单挑。{f}超厉害！",en:"{n} played 1-on-1 basketball with {f} — {f} was so good!",dia:{jp:"{f}と バスケで タイマンしたよ。負[ま]けたけど 楽[たの]しかった！",zh:"和{f}打篮球单挑了。虽然输了但很开心！",en:"Had a 1-on-1 hoops match with {f}. Lost, but it was fun!"}},
      {w:7,fx:{energy:-8,happy:6},jp:"{n}は 公園[こうえん]を 全力[ぜんりょく]で 走[はし]り回[まわ]った。",zh:"{n}在公园里拼命地跑。",en:"{n} ran around the park at full speed.",dia:{jp:"きょうは いっぱい 走[はし]ったぞ！",zh:"今天跑了好多！",en:"I ran a ton today!"}} ]},
    shizuka:{ jp:"物静[ものしず]か", zh:"安静·爱看书", en:"Quiet", idle:{jp:"…おかえり。静[しず]かに 読書[どくしょ]、いいよね。",en:"…Welcome back. A quiet read is nice, isn't it."}, ev:[
      {w:9,fx:{happy:5},jp:"{n}は 窓辺[まどべ]で 静[しず]かに 小説[しょうせつ]を 読[よ]んでいた。",zh:"{n}在窗边静静地读小说。",en:"{n} read a novel quietly by the window.",dia:{jp:"いい小説[しょうせつ]に 出会[であ]えた。静[しず]かな時間[じかん]が 好[す]き。",zh:"遇到了一本好小说。我喜欢安静的时光。",en:"I found a lovely novel. I love quiet time."}},
      {w:7,fx:{happy:4},jp:"{n}は カフェで ゆっくり 日記[にっき]を 書[か]いた。",zh:"{n}在咖啡馆慢慢写日记。",en:"{n} wrote in its diary slowly at a café.",dia:{jp:"カフェで 日記[にっき]を 書[か]いたよ。",zh:"在咖啡馆写了日记。",en:"I wrote in my diary at a café."}} ]},
    gourmet:{ jp:"食[た]いしん坊[ぼう]", zh:"吃货", en:"Foodie", idle:{jp:"ねえ、今日[きょう]は 何[なに] 食[た]べる？",en:"Hey, what are we eating today?"}, ev:[
      {w:9,fx:{hunger:14,happy:6},jp:"{n}は 話題[わだい]の ラーメン屋[や]に 並[なら]んだ。こってり 最高[さいこう]！",zh:"{n}去排了网红拉面店。浓汤太赞了！",en:"{n} queued at a famous ramen shop. The rich broth was the best!",dia:{jp:"ラーメン、こってりで 最高[さいこう]だった！また 行[い]きたい。",zh:"拉面又浓又香，太棒了！还想再去。",en:"The ramen was rich and amazing! I want to go again."}},
      {w:7,fx:{hunger:10},jp:"{n}は 自分[じぶん]で おやつを 手作[てづく]りした。",zh:"{n}自己做了点心。",en:"{n} made a snack from scratch.",dia:{jp:"おやつ、手作[てづく]りしてみた！",zh:"试着自己做了点心！",en:"I tried making a snack myself!"}} ]},
    yancha:{ jp:"やんちゃ", zh:"调皮·爱玩游戏", en:"Mischievous", idle:{jp:"へへっ、なんか おもしろいこと ないかな？",en:"Heheh… anything fun going on?"}, ev:[
      {w:9,fx:{happy:8,energy:-4},jp:"{n}は ゲームで {f}を 倒[たお]した。「よゆうだぜ！」",zh:"{n}在游戏里打败了{f}。“小菜一碟！”",en:"{n} beat {f} at a game. \"Too easy!\"",dia:{jp:"{f}と 対戦[たいせん]して 勝[か]った！よゆう よゆう♪",zh:"和{f}对战赢了！轻轻松松♪",en:"Beat {f} in a match! Easy peasy ♪"}},
      {w:7,fx:{happy:6},jp:"{n}は いたずらして {f}を 驚[おどろ]かせた。",zh:"{n}搞恶作剧吓了{f}一跳。",en:"{n} pulled a prank and startled {f}.",dia:{jp:"{f}を びっくりさせちゃった！へへ。",zh:"把{f}吓了一跳！嘿嘿。",en:"I gave {f} a fright! Hehe."}} ]},
    amaenbo:{ jp:"甘[あま]えん坊[ぼう]", zh:"爱撒娇·黏人", en:"Clingy", idle:{jp:"おとうさ〜ん、さみしかったよ〜！",en:"I missed you so much~!"}, ev:[
      {w:9,fx:{happy:-2},jp:"{n}は ずっと あなたの 帰[かえ]りを 待[ま]っていた。",zh:"{n}一直在等你回来。",en:"{n} waited and waited for you to come back.",dia:{jp:"ずっと あなたを 待[ま]ってたんだよ。さみしかった…。",zh:"我一直在等你哦。好寂寞…。",en:"I waited for you the whole time. I was lonely…"}},
      {w:7,fx:{happy:5},jp:"{n}は ぬいぐるみを ぎゅっと 抱[だ]きしめた。",zh:"{n}紧紧抱着布偶。",en:"{n} hugged its plushie tight.",dia:{jp:"ぬいぐるみと ぎゅっとしてた。",zh:"抱着布偶蹭蹭。",en:"I cuddled my plushie."}} ]},
    cool:{ jp:"クール", zh:"高冷·酷", en:"Cool", idle:{jp:"ふん、まあまあだな。",en:"Hmph. Not bad."}, ev:[
      {w:9,fx:{happy:3},jp:"{n}は 屋根[やね]の 上[うえ]で 一人[ひとり]、月[つき]を 見[み]ていた。",zh:"{n}一个人在屋顶上看月亮。",en:"{n} watched the moon alone on the roof.",dia:{jp:"屋根[やね]の上[うえ]で 月[つき]を 見[み]てた。…悪[わる]くない。",zh:"在屋顶看月亮。…还不赖。",en:"Watched the moon from the roof. …Not bad."}},
      {w:7,fx:{energy:4},jp:"{n}は 黙[だま]って コーヒーを 飲[の]んでいた。",zh:"{n}默默地喝着咖啡。",en:"{n} sipped coffee in silence.",dia:{jp:"コーヒーを 飲[の]んで のんびりした。",zh:"喝着咖啡放松了一下。",en:"Had coffee and took it easy."}} ]},
  };
  function natureOf(seed){ const k=Object.keys(NATURES); return k[Math.floor(mulberry32((seed^0x7a7a)>>>0)()*k.length)]; }
  function petNature(p){ return (p&&NATURES[p.nature]) ? p.nature : natureOf((p&&p.seed)||1); }
  function natLabel(p){ const nt=NATURES[petNature(p)]||{}; return window.LANG==="en"?(nt.en||"") : String(nt.jp||"").replace(/\[[^\]]*\]/g,""); }

  // ---- B3: EVOLUTION = a new register/dialect of Japanese (the real payoff) ----
  // Evolving doesn't just change the look — it changes HOW the pet speaks Japanese, so the
  // learner gets exposed to a new variety (Kansai / keigo / net-slang / literary / gruff).
  // `register` drives canned idle lines (zh-mode) AND the Claude persona prompt (chat+diary).
  const REGISTERS={
    std:{ jp:"標準語[ひょうじゅんご]", zh:"标准语", en:"Standard", ai:"ふつうの標準語で話す。" },
    kansai:{ jp:"関西弁[かんさいべん]", zh:"关西腔", en:"Kansai-ben",
      idle:["まいど！ぼちぼち やろか〜","なんでやねん！","知[し]らんけど。"], ai:"関西弁（〜やで／〜へん／ほんま／おおきに／なんでやねん 等）で話す。" },
    keigo:{ jp:"敬語[けいご]", zh:"敬语", en:"Keigo",
      idle:["ごきげんよう。本日[ほんじつ]も よろしく お願[ねが]い いたします。"], ai:"とても丁寧な敬語（〜でございます／〜いたします）で上品に話す。" },
    net:{ jp:"ネット語[ご]", zh:"网络用语", en:"Net-slang",
      idle:["それな！","勉強[べんきょう]してて えらみ〜","ワンチャン いけるって！"], ai:"若者のネットスラング（草／それな／〜み／ワンチャン 等）でくだけて話す。" },
    literary:{ jp:"文語[ぶんご]ふう", zh:"文绉绉", en:"Literary",
      idle:["学[まな]びとは、一生[いっしょう]の旅[たび]なり。"], ai:"少し硬めで文学的・格調の高い日本語で話す。" },
    rough:{ jp:"オラオラ系[けい]", zh:"凶巴巴", en:"Gruff",
      idle:["……ほっとくなよ。","ちっ、やる気[き] なくすわ。"], ai:"ぶっきらぼうで荒っぽい男言葉（〜だぜ／〜かよ）で不機嫌そうに話す。" },
  };
  function petReg(p){ return (p&&REGISTERS[p.register])?p.register:"std"; }
  function regLabel(p){ const r=REGISTERS[petReg(p)]; return window.LANG==="en"?(r.en||"") : String(r.jp||"").replace(/\[[^\]]*\]/g,""); }
  function evolveRegister(p, bias){
    const keys=Object.keys(REGISTERS).filter(k=>k!=="std" && k!==petReg(p));
    const pick=(bias&&REGISTERS[bias]&&bias!==petReg(p))?bias:keys[Math.floor(Math.random()*keys.length)];
    if(!pick) return false;
    p.register=pick; S.dex=S.dex||{}; S.dex.reg=S.dex.reg||{}; S.dex.reg[pick]=true;
    const r=REGISTERS[pick], nm=p.name||"この子";
    milestone(p, T(`「${String(r.jp).replace(/\[[^\]]*\]/g,"")}」を 話[はな]せるように なった`,`Learned to speak ${r.en}`));
    const evo={ jp:`✨ ${nm}は「${r.jp}」を 話[はな]せるように なった！`, zh:`✨ ${nm}学会了说「${r.zh}」！`, en:`✨ ${nm} learned to speak ${r.en}!` };
    S.activity=S.activity||[]; S.activity.unshift({ ts:now(), span:[now(),now()], evo:true, events:[Object.assign({dia:evo},evo)], diary:evo });
    AI_SAY={ text:(r.idle&&r.idle[0])||evo.jp, ts:now() }; S.chatNudge=now(); save(); return true;
  }
  function onStageUp(p){
    const nm=p.name||"この子"; AI_SAY={ text:T(`${nm}は ぐんと せいちょうした！`,`${nm} grew up!`), ts:now() }; S.chatNudge=now();
    const g={ jp:`🌱 ${nm}は「${({hatchling:"あかちゃん",child:"こども",teen:"わかもの",adult:"おとな",elder:"ちょうろう"})[p.stage]||""}」に なった！`,
      zh:`🌱 ${nm}成长了一个阶段！`, en:`🌱 ${nm} grew to a new stage!` };
    S.activity=S.activity||[]; S.activity.unshift({ ts:now(), span:[now(),now()], evo:true, events:[Object.assign({dia:g},g)], diary:g });
    milestone(p, T(`「${({hatchling:"あかちゃん",child:"こども",teen:"わかもの",adult:"おとな",elder:"ちょうろう"})[p.stage]||""}」に なった`,`Grew into a new stage`));
    if(Math.random()<0.55){ evolveRegister(p, S.evoBias); S.evoBias=null; }   // evolving often = a new way of speaking
    save();
  }
  function rng(seed){ return mulberry32((seed>>>0)||1); }
  function fill(s,c){ return s.replace(/{n}/g,c.n).replace(/{f}/g,c.f).replace(/{g}/g,c.g); }
  function wpick(r,arr){ const tot=arr.reduce((s,e)=>s+e.w,0); let x=r()*tot; for(const e of arr){ if((x-=e.w)<0) return e; } return arr[0]; }
  function applyFx(p,fx){ if(!fx) return; const m=p.meters;
    if(fx.hunger) m.hunger=clamp(m.hunger+fx.hunger); if(fx.happy) m.happy=clamp(m.happy+fx.happy);
    if(fx.energy) m.energy=clamp(m.energy+fx.energy); if(fx.health) p.hp=clamp((p.hp==null?100:p.hp)+fx.health);
    if(fx.coin) S.bonus=(S.bonus||0)+fx.coin; }
  function composeDiary(events,happy){
    const open = happy ? {jp:"今日[きょう]は たのしい 一日[いちにち]だった！",zh:"今天过得很开心！",en:"Today was a fun day!"}
                       : {jp:"今日[きょう]は ふつうの 一日[いちにち]。",zh:"今天很平常。",en:"Today was an ordinary day."};
    const close = {jp:"また あした、あそんでね！",zh:"明天也陪我玩哦！",en:"Play with me again tomorrow!"};
    const frags = events.slice(0,4).map(e=>e.dia);
    const build = k => [open[k], ...frags.map(f=>f[k]), close[k]].join(" ");
    return { jp:build("jp"), zh:build("zh"), en:build("en") };
  }
  function rollActivity(){
    const p=pet(); if(!p||p.diedAt||p.stage==="egg") return;
    const last=S.activityTs||p.bornAt||now(); const gap=now()-last;
    if(gap < 2*3.6e6) return;                              // need ≥2h away to "live a little"
    const r=rng(Math.floor(last/3.6e6)+(p.seed||1));        // stable per absence window
    const n=Math.max(1,Math.min(6,Math.round(gap/(3*3.6e6))));
    const ctx={ n:p.name||"この子", f:FRIENDS[Math.floor(r()*FRIENDS.length)], g:THINGS[Math.floor(r()*THINGS.length)] };
    const nat=NATURES[petNature(p)];                        // personality biases what happens…
    const pool=EVENTS.concat(nat&&nat.ev?nat.ev:[]);        // …and adds its domain-vocab events
    const events=[]; let lastE=null; for(let i=0;i<n;i++){ let e=wpick(r,pool);
      if(e===lastE) e=wpick(r,pool);                        // avoid back-to-back repeats
      lastE=e; applyFx(p,e.fx);
      events.push({ jp:fill(e.jp,ctx), zh:fill(e.zh,ctx), en:fill(e.en,ctx),
        dia:{jp:fill(e.dia.jp,ctx),zh:fill(e.dia.zh,ctx),en:fill(e.dia.en,ctx)} }); }
    const happy=(p.meters.happy>=55 && (p.hp==null||p.hp>40));
    S.activity=S.activity||[]; S.activity.unshift({ ts:now(), span:[last,now()], events, diary:composeDiary(events,happy) });
    while(S.activity.length>30) S.activity.pop();
    S.activityTs=now(); S.chatNudge=now(); save();   // it has news → nudge the 💬
  }
  function unseenLog(){ return (S.activity&&S.activity.length) ? (S.activity[0].ts>(S.logSeen||0)) : false; }

  // ---- B2: agent-on-demand — persona + memory → Claude writes the diary & a line ----
  // Not a running process: a persona spec (nature/stage/nickname) + the activity log as
  // memory, fed to ONE cheap Claude call when something is shown. Templated B1 stays as the
  // offline/no-key fallback. Uses the shared BYOK config via window.Assistant.complete.
  let AI_SAY=null;                                  // transient AI-written speech override
  function aiOn(){ return !!(window.Assistant && window.Assistant.hasKey && window.Assistant.hasKey()); }
  function nickname(){ try{ return (localStorage.getItem("jpn-name")||"").trim(); }catch(e){ return ""; } }
  function personaSystem(p){
    const nat=NATURES[petNature(p)]||{}, nick=nickname();
    const stageJ={hatchling:"赤[あか]ちゃん",child:"こども",teen:"わかもの",adult:"おとな",elder:"長老[ちょうろう]"}[p.stage]||"";
    return [
      `あなたは「${p.name||"この子"}」という名前の、ユーザーが大切に育てている小さな生きものです。ゲームのキャラクターになりきってください。`,
      `性格は「${(nat.jp||"").replace(/\[[^\]]*\]/g,"")}」（${nat.zh||nat.en||""}）。口調・話題・興味はこの性格に合わせる。`,
      `成長段階は「${stageJ}」。${(p.stage==="hatchling"||p.stage==="child")?"まだ幼いので、やさしくて短い言葉で話す。":""}`,
      nick?`飼[か]い主[ぬし]のことは「${nick}」と呼[よ]ぶ（性格しだいで甘[あま]えた呼び方でもよい）。`:`飼[か]い主[ぬし]のことは親[した]しみを込[こ]めて呼[よ]ぶ。`,
      `飼い主は中国語が母語で、JLPT N2 を目指して日本語を勉強している学習者。`,
      `話し方：${(REGISTERS[petReg(p)]||REGISTERS.std).ai}`,
      `【出力ルール｜厳守】日本語だけで書く。漢字には必ず「漢字[かんじ]」の形でふりがなを付ける。N4〜N3 のやさしい日本語。キャラクターになりきって、短く、自然に。説明や前置きは書かない。`,
    ].join("\n");
  }
  function petMemory(p){
    const ev=((S.activity&&S.activity[0]&&S.activity[0].events)||[]).map(e=>"・"+(window.toPlain?toPlain(e.jp):e.jp)).join("\n")||"・（とくに何もなかった）";
    const m=p.meters;
    return `【さっきまでのできごと】\n${ev}\n【${p.name||"この子"}のいまの様子】気分:${moodOf(p)}／おなか:${Math.round(m.hunger)}／元気:${Math.round(m.energy)}`;
  }
  function studyDeltaJP(){
    const tl=J("jpn-test-log",[]), pl=J("jpn-pron-log",[]);
    const usePron=(pl.length?pl[pl.length-1].ts:0)>=(tl.length?tl[tl.length-1].ts:0);
    const g=usePron?recentGain("jpn-pron-log",x=>x.score||0):recentGain("jpn-test-log",x=>x.total?x.score/x.total*100:0);
    const what=usePron?"発音の練習":"テスト";
    if(g>=5) return `飼い主は ${what} で前より ${g} 点ものびた（成長している！）。`;
    if(g<=-5) return `飼い主は ${what} の点が前より下がってしまった（やさしくはげまして）。`;
    return `飼い主は さっき 勉強をがんばった。`;
  }
  function generateDiary(batch,p){
    if(!aiOn()||!batch||batch.ai||batch._aip) return;
    batch._aip=true;
    const langName=(window.LANG==="en")?"英語":"中国語";
    const user=`${petMemory(p)}\n\n上のできごとをもとに、${p.name||"わたし"}の一人称の「日記[にっき]」を3〜4文で書いて。\nそのあと、改行して「===」だけの行を入れ、改行して${langName}の訳を書いて。`;
    window.Assistant.complete({ system:personaSystem(p), messages:[{role:"user",content:user}], model:"claude-haiku-4-5", max_tokens:430 })
      .then(txt=>{ const parts=String(txt).split(/\n?===\n?/); batch.ai={ jp:(parts[0]||"").trim(), tr:(parts[1]||"").trim() }; delete batch._aip; save();
        const ov=document.getElementById("pet-log-ov"); if(ov&&ov.style.display!=="none") renderLog(ov); })
      .catch(()=>{ delete batch._aip; });
  }
  function generateStudyLine(p){
    if(!aiOn()||!p||p.stage==="egg"||p.diedAt) return;
    const user=`${studyDeltaJP()}\n${p.name||"あなた"}として、飼い主にひとこと、短く声をかけて（1文だけ、日本語、ふりがな付き、キャラクターらしく）。`;
    window.Assistant.complete({ system:personaSystem(p), messages:[{role:"user",content:user}], model:"claude-haiku-4-5", max_tokens:120 })
      .then(txt=>{ AI_SAY={ text:String(txt).trim().replace(/\s*\n\s*/g," "), ts:now() }; refresh(); })
      .catch(()=>{});
  }

  // ---- B2: dedicated PET CHAT (conversation practice; pet stays front-and-center) ----
  // Talking unlocks at TEEN (the "it got smart!" payoff). Younger = cute canned baby-talk
  // that defers hard stuff to 📖 Sensei. No key = canned + a hint. Real chat = Claude in the
  // pet persona + its memory; replies are Japanese w/ furigana = conversation reading drill.
  let CHAT_BUSY=false;
  function canChat(p){ return aiOn() && ["teen","adult","elder"].indexOf(p.stage)>=0; }
  function chatHistory(p){ p.chat=p.chat||[]; return p.chat; }
  function pushChat(p,role,text){ const h=chatHistory(p); h.push({role,text}); while(h.length>16) h.shift(); save(); }
  function unseenChat(){ return (S.chatNudge||0) > (S.chatSeen||0); }
  function petCanned(p){
    const nat=NATURES[petNature(p)]||{};
    const bank=[ T("うー、まだ よく わかんない…！","Uhh, I don't get it yet…!"),
      T("むずかしいことは 先生[せんせい]（📖）に 聞[き]いてみて！","For hard stuff, ask Sensei (📖)!"),
      T("でも、いっしょに いるの たのしい！","But being with you is fun!"),
      T("はやく おっきく なって、いっぱい おしゃべりしたいな！","I wanna grow up and chat lots!"),
      nat.idle?T(nat.idle.jp,nat.idle.en):T("えへへ。","Hehe.") ];
    return bank[Math.floor(Math.random()*bank.length)];
  }
  function greeting(p){ const nat=NATURES[petNature(p)]||{}; return nat.idle?T(nat.idle.jp,nat.idle.en):T("やっほー！","Hi!"); }
  function openChat(){ const p=pet(); if(!p||p.diedAt||p.stage==="egg") return;
    p.meters.happy=clamp(p.meters.happy+4); S.chatSeen=now();
    if(!chatHistory(p).length) pushChat(p,"pet",greeting(p)); else save();
    let ov=document.getElementById("pet-chat-ov");
    if(!ov){ ov=document.createElement("div"); ov.id="pet-chat-ov"; ov.className="pet-chat-ov";
      ov.addEventListener("click",e=>{ if(e.target===ov) closeChat(); }); document.body.appendChild(ov); }
    renderChat(ov); ov.style.display="flex"; startAnim();
    const inp=ov.querySelector(".pchat-input"); if(inp) inp.focus(); refresh();
  }
  function closeChat(){ const ov=document.getElementById("pet-chat-ov"); if(ov) ov.style.display="none"; }
  function renderChat(ov){ const p=pet(); if(!p) return; const ruby=s=>window.toRuby?toRuby(s):esc(s);
    const young=!canChat(p)&&aiOn();
    const msgs=chatHistory(p).map(m=> m.role==="user"
      ? `<div class="pchat-msg me">${esc(m.text)}</div>`
      : `<div class="pchat-msg pet">${ruby(m.text)}</div>`).join("");
    const note = !aiOn() ? `<div class="pchat-note">${T("⚙ で API キーを入れると、日本語で おしゃべりできるよ。","Add an API key in ⚙ to chat in Japanese.")}</div>`
      : young ? `<div class="pchat-note">${T("この子はまだ小[ちい]さいので、かんたんな話[はなし]だけ。むずかしいことは 📖 先生[せんせい]に！","Still little — simple chat only. For hard questions, ask 📖 Sensei!")}</div>` : "";
    ov.innerHTML=`<div class="pet-chat"><button class="pchat-close" title="${T('閉じる','Close')}">✕</button>
      <div class="pchat-head"><canvas class="pet-canvas pchat-face" width="44" height="44"></canvas><b>${esc(p.name||"")}</b><span class="pet-nature">${esc(natLabel(p))}</span></div>
      <div class="pchat-msgs">${msgs}<div class="pchat-typing" style="display:none">…</div></div>${note}
      <div class="pchat-bar"><input class="pchat-input" placeholder="${T('日本語で話しかけてみよう…','Say something in Japanese…')}" maxlength="200"><button class="pchat-send">${T('送信','Send')}</button><button class="pchat-sensei" title="${T('先生に聞く','Ask Sensei')}">📖</button></div></div>`;
    ov.querySelector(".pchat-close").onclick=closeChat;
    ov.querySelector(".pchat-sensei").onclick=()=>{ closeChat(); if(window.Assistant&&window.Assistant.open) window.Assistant.open(); };
    const inp=ov.querySelector(".pchat-input"), send=ov.querySelector(".pchat-send");
    const go=()=>{ const v=inp.value; inp.value=""; sendChat(v); };
    send.onclick=go; inp.onkeydown=e=>{ if(e.key==="Enter"){ e.preventDefault(); go(); } };
    const box=ov.querySelector(".pchat-msgs"); if(box) box.scrollTop=box.scrollHeight;
  }
  function sendChat(text){ text=(text||"").trim(); if(!text||CHAT_BUSY) return; const p=pet(); if(!p) return;
    pushChat(p,"user",text); let ov=document.getElementById("pet-chat-ov"); renderChat(ov);
    if(!canChat(p)){ pushChat(p,"pet",petCanned(p)); renderChat(ov); return; }   // young / no key
    CHAT_BUSY=true; const t=ov.querySelector(".pchat-typing"); if(t) t.style.display="block";
    const box=ov.querySelector(".pchat-msgs"); if(box) box.scrollTop=box.scrollHeight;
    const sys=personaSystem(p)+"\n\n"+petMemory(p)+"\n\n【会話モード】飼い主とカジュアルに雑談する。返事は短く（1〜3文）、キャラクターらしく、ときどき あなたから 質問[しつもん]を返[かえ]す。飼い主が日本語で書いて まちがいがあれば、さりげなく 直[なお]してあげてもよい。文法[ぶんぽう]のむずかしい質問は「先生[せんせい]に聞[き]いてみて！」と言ってよい。";
    const msgs=chatHistory(p).slice(-10).map(m=>({ role:m.role==="user"?"user":"assistant", content:m.text }));
    // Promise.resolve(...) wraps any SYNCHRONOUS throw (e.g. complete() with no key) into a
    // rejection so .catch always runs and CHAT_BUSY can never get stuck true.
    Promise.resolve().then(()=>window.Assistant.complete({ system:sys, messages:msgs, max_tokens:320 }))
      .then(txt=>{ CHAT_BUSY=false; pushChat(p,"pet",String(txt).trim()||petCanned(p)); renderChat(document.getElementById("pet-chat-ov")); })
      .catch(()=>{ CHAT_BUSY=false; pushChat(p,"pet",petCanned(p)); renderChat(document.getElementById("pet-chat-ov")); });
  }

  // ---- panel UI -------------------------------------------------------------
  // compact pixel meter: a single-kanji dot-font label + a thin bar (no emoji)
  function meter(label,v){ v=clamp(v); return `<div class="pm${v<25?' low':''}"><span class="pm-l">${label}</span><i><b style="width:${Math.round(v)}%"></b></i></div>`; }
  function panelHTML(){
    const p=pet();
    if(!p) return "";   // renderInto guarantees a pet via ensureEgg() before calling this
    if(S.out && p.stage!=="egg" && !p.diedAt) return awayHTML(p);   // "out playing" → away card
    const since=studySXP()-(p.hatchBase||p.adoptSXP||0);
    let next=null,prev=0; for(const [n,need] of STAGES){ if(since>=need) prev=need; else { next=need; break; } }
    const toNext = p.stage==="egg" ? Math.round((studySXP()-(p.adoptSXP||0))/TUNE.hatchCost*100)
                 : next==null?100:Math.round((since-prev)/(next-prev)*100);
    const stageLbl={egg:T("たまご","Egg"),hatchling:T("あかちゃん","Baby"),child:T("こども","Child"),teen:T("わかもの","Teen"),adult:T("おとな","Adult"),elder:T("ちょうろう","Elder")};
    const hp=clamp(p.hp==null?100:p.hp);
    const egg = p.stage==="egg";
    const warn = (!egg && (p.sick||hp<60)) ? `<div class="pet-warn">${p.sick?T("ぐあいが わるいよ…「くすり」を つかってね","Feeling sick… use medicine"):T("げんきが ないみたい。やすませてあげて","Looking weak — let it rest")}<i class="pm-hp"><b style="width:${hp}%"></b></i></div>` : "";
    return `<div class="pet-box pix" data-uid="${p.uid}">
      <div class="pet-screen"><canvas class="pet-canvas" width="120" height="120"></canvas></div>
      <div class="pet-id"><b class="pet-name">${esc(p.name||"たまご")}</b><span class="pet-tags">${stageLbl[p.stage]||""}${egg?"":" · "+esc(natLabel(p))}${(!egg&&petReg(p)!=="std")?' · <span class="pet-reg">'+esc(regLabel(p))+'</span>':""}</span></div>
      <div class="pet-speech">${window.toRuby?toRuby(says(p)):esc(says(p))}</div>
      ${warn}
      <div class="pet-grow" title="${T('勉強でたまる言霊。いっぱいになると成長する','言霊 from studying — fills up, then it grows')}"><span class="pl">${egg?T("ふか","Hatch"):"言霊"}</span><i><b style="width:${clamp(toNext)}%"></b></i></div>
      ${egg?"":`
      <div class="pet-meters">${meter("食",p.meters.hunger)}${meter("浴",p.meters.clean)}${meter("楽",p.meters.happy)}${meter("力",p.meters.energy)}</div>
      <div class="pet-actions">
        <button data-act="feed">ごはん</button><button data-act="wash">おふろ</button>
        <button data-act="poop"${p.hasPoop?"":" disabled"}>そうじ</button><button data-act="play">あそぶ</button>
        <button data-act="sleep">ねる</button>${p.sick?`<button data-act="med" class="med">くすり</button>`:""}
        <button data-act="gift" class="gift" title="${T('おくりもの ◆8（しんかするかも！）','Gift ◆8 (may evolve!)')}">おくる</button>
      </div>
      <div class="pet-foot">
        <button class="pet-chatbtn">はなす</button>
        <button class="pet-logbtn${unseenLog()?" unseen":""}">にっき</button>
        <button class="pet-dexbtn">きろく</button>
        <span class="pet-coins" title="${T('コイン','Coins')}">◆ ${coins()}</span>
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
    else if(a==="gift"){ if(!spend(8)) return flash(T("コインが足りない…勉強してね！","Not enough coins — study more!"));
      m.happy=clamp(m.happy+8); if(!evolveRegister(p)) flash(T("ぜんぶ おぼえちゃった！","I've learned them all!")); }
    save(); refresh();
  }
  let FLASH=""; function flash(msg){ FLASH=msg; refresh(); setTimeout(()=>{ FLASH=""; refresh(); },1800); }

  // ---- mounting + animation -------------------------------------------------
  let RAF=0, FRAME=0;
  // a pet canvas counts as "visible" only if it's laid out (offsetParent!=null) AND, for the
  // roam sprite, only while it's actually shown. → animation runs ONLY when a pet is on screen.
  function visibleCanvas(cv){ if(cv.offsetParent===null) return false;
    const r=cv.closest(".pet-roam"); return !(r && !r.classList.contains("show")); }
  function animTargetsVisible(){ return !document.hidden && [...document.querySelectorAll(".pet-canvas")].some(visibleCanvas); }
  function syncAnim(){ animTargetsVisible() ? startAnim() : stopAnim(); }
  function draw(){ FRAME++; let any=false;
    document.querySelectorAll(".pet-canvas").forEach(cv=>{ if(!visibleCanvas(cv)) return; any=true;
      const p=pet(); if(p) drawCreature(cv, genome(p.seed), p.stage, moodOf(p), FRAME); });
    if(!any){ stopAnim(); return; }          // nothing on screen → stop (save battery/CPU)
    RAF=requestAnimationFrame(draw);
  }
  function startAnim(){ if(!RAF) RAF=requestAnimationFrame(draw); }
  function stopAnim(){ if(RAF) cancelAnimationFrame(RAF); RAF=0; }
  try{ document.addEventListener("visibilitychange", syncAnim); }catch(e){}

  // ---- tap-to-interact: every tap MUST visibly react (egg knocks; pet bounces & speaks) --
  let TAPS=0;
  const EGG_LINES=["コツ…","コツコツ…","ピクッ！","…コトッ","なかで うごいた？"];
  const PET_LINES=["えへへ♪","うれしい！","なでなで、すき！","もっと なでて！","きゃっ"];
  function bumpAnim(el,cls){ if(!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(()=>{ try{ el.classList.remove(cls); }catch(e){} },600); }
  function blip(box,jp){ const sp=box&&box.querySelector(".pet-speech"); if(!sp) return;
    if(sp._restore==null) sp._restore=sp.innerHTML;
    sp.innerHTML=window.toRuby?toRuby(jp):esc(jp);
    clearTimeout(sp._t); sp._t=setTimeout(()=>{ if(sp._restore!=null){ sp.innerHTML=sp._restore; sp._restore=null; } },1500); }
  function petTap(cv){
    const p=pet(); if(!p||p.diedAt) return;
    const box=cv.closest(".pet-box"); TAPS++;
    if(p.stage==="egg"){                                   // egg can't talk — it knocks from inside
      bumpAnim(cv,"egg-knock"); blip(box,EGG_LINES[TAPS%EGG_LINES.length]); return;
    }
    p.meters.happy=clamp(p.meters.happy+5); save();        // tap = pet it (+happy), with a visible bounce
    bumpAnim(cv,"pet-bounce");
    const hp=box&&box.querySelectorAll(".pet-meters .pm")[2];   // 食浴楽力 → 楽 is index 2
    if(hp){ const b=hp.querySelector("b"); if(b) b.style.width=clamp(p.meters.happy)+"%"; hp.classList.toggle("low",p.meters.happy<25); }
    blip(box,PET_LINES[TAPS%PET_LINES.length]);
  }
  function bind(root){
    root.querySelectorAll(".pet-newegg").forEach(b=>b.onclick=welcomeNewEgg);
    root.querySelectorAll(".pet-follow").forEach(b=>b.onclick=()=>{ if(S.out&&window.showPage) showPage(S.out.page); });
    root.querySelectorAll(".pet-actions button").forEach(b=>b.onclick=()=>act(b.dataset.act));
    root.querySelectorAll(".pet-logbtn").forEach(b=>b.onclick=openLog);
    root.querySelectorAll(".pet-dexbtn").forEach(b=>b.onclick=openDex);
    root.querySelectorAll(".pet-chatbtn").forEach(b=>b.onclick=openChat);   // explicit "はなす" → chat
    const cv=root.querySelector(".pet-canvas"); if(cv) cv.onclick=()=>petTap(cv);   // tap = react (egg knock / pet bounce)
  }

  // ---- B1 log/diary overlay (Japanese reading surface) ----------------------
  let LOG_TR=false;
  const trv=o=>(window.LANG==="en"?o.en:o.zh);
  function openLog(){ const p=pet(); if(!p) return; S.logSeen=now(); save();
    let ov=document.getElementById("pet-log-ov");
    if(!ov){ ov=document.createElement("div"); ov.id="pet-log-ov"; ov.className="pet-log-ov";
      ov.addEventListener("click",e=>{ if(e.target===ov) closeLog(); }); document.body.appendChild(ov); }
    renderLog(ov); ov.style.display="flex"; refresh();   // refresh clears the unseen dot
  }
  function closeLog(){ const ov=document.getElementById("pet-log-ov"); if(ov) ov.style.display="none"; }
  function renderLog(ov){
    const p=pet(); const acts=S.activity||[]; const ruby=s=>window.toRuby?toRuby(s):esc(s);
    let html=`<div class="pet-log"><button class="plog-close" title="${T('閉じる','Close')}">✕</button>
      <h3>📔 ${esc(p.name||"")} ${T("の日記","'s diary")}</h3>
      <button class="plog-trtoggle">${LOG_TR?T("訳を隠[かく]す","Hide meaning"):T("💡 意味を見る","💡 Show meaning")}</button>`;
    if(!acts.length){ html+=`<p class="pet-sub">${T("まだ 記録[きろく]が ないよ。少[すこ]し 時間[じかん]が経[た]つと、できごとが 増[ふ]えるよ。","Nothing logged yet — come back after a while and there'll be activity.")}</p>`; }
    else {
      const latest=acts[0];
      if(aiOn() && !latest.ai) generateDiary(latest,p);                  // agent writes it (async)
      const diaJp=(latest.ai&&latest.ai.jp)||latest.diary.jp, diaTr=(latest.ai&&latest.ai.tr)||trv(latest.diary);
      const aiBadge=latest.ai?`<span class="plog-ai">✨AI</span>`:(latest._aip?`<span class="plog-ai">✨…</span>`:"");
      html+=`<div class="plog-diary"><div class="plog-jp" data-jp="${esc(diaJp)}">${ruby(diaJp)}</div>${LOG_TR?`<div class="plog-tr">${esc(diaTr)}</div>`:""}${aiBadge}</div>
        <h4 class="plog-h">🕑 ${T("できごと","What happened")}</h4><ul class="plog-events">`;
      acts.slice(0,6).forEach(b=>b.events.forEach(e=>{ html+=`<li><div class="plog-jp" data-jp="${esc(e.jp)}">${ruby(e.jp)}</div>${LOG_TR?`<div class="plog-tr">${esc(trv(e))}</div>`:""}</li>`; }));
      html+=`</ul>`;
    }
    const canHear = typeof ttsFallbackOn!=="function" || ttsFallbackOn();   // diary lines are dynamic → no pre-gen audio
    html+=`<p class="pet-sub plog-tip">${canHear?T("日本語[にほんご]を 読[よ]む 練習[れんしゅう]。文[ぶん]を タップすると 読[よ]み上[あ]げ。","Reading practice! Tap a line to hear it.")
                                              :T("日本語[にほんご]を 読[よ]む 練習[れんしゅう]だよ。","Reading practice — read it in Japanese!")}</p></div>`;
    ov.innerHTML=html;
    ov.querySelector(".plog-close").onclick=closeLog;
    ov.querySelector(".plog-trtoggle").onclick=()=>{ LOG_TR=!LOG_TR; renderLog(ov); };
    if(canHear) ov.querySelectorAll(".plog-jp[data-jp]").forEach(el=>{ el.style.cursor="pointer";
      el.onclick=()=>{ if(window.speakSequence) speakSequence([{text:el.dataset.jp,node:null}]); }; });
  }
  // ---- B4 (reframed): 成長きろく — this ONE pet's life trail (not a collection) ----
  function openDex(){ let ov=document.getElementById("pet-dex-ov");   // (id kept; it's the growth-record now)
    if(!ov){ ov=document.createElement("div"); ov.id="pet-dex-ov"; ov.className="pet-log-ov";
      ov.addEventListener("click",e=>{ if(e.target===ov) ov.style.display="none"; }); document.body.appendChild(ov); }
    renderDex(ov); ov.style.display="flex"; startAnim(); }
  function fmtDate(ts){ try{ const d=new Date(ts); return (d.getMonth()+1)+"/"+d.getDate(); }catch(e){ return ""; } }
  function renderDex(ov){
    const p=pet(); const en=window.LANG==="en";
    const stageJ={egg:"たまご",hatchling:"あかちゃん",child:"こども",teen:"わかもの",adult:"おとな",elder:"ちょうろう"};
    const days = p&&p.bornAt ? Math.max(0,Math.floor((now()-p.bornAt)/86400000)) : 0;
    const ms = (p&&p.milestones||[]).slice().reverse();   // newest first
    const trail = ms.length ? ms.map(m=>`<li><span class="rec-d">${fmtDate(m.ts)}</span><span class="rec-l">${window.toRuby?toRuby(m.label):esc(m.label)}</span></li>`).join("")
      : `<li><span class="rec-l">${T("これから、たくさんの 思い出を つくろうね！","Lots of memories to make together!")}</span></li>`;
    const mem=(S.memorial||[]).slice().reverse();
    const grave = mem.length ? `<h4 class="plog-h">${T("これまでの なかま","Companions before")}</h4><div class="dex-grave">${
      mem.map(m=>`<div class="dex-tomb"><canvas class="dex-c" width="56" height="56" data-seed="${m.seed||1}"></canvas><b>${esc(m.name||"?")}</b></div>`).join("")}</div>` : "";
    const head = p ? `${esc(p.name||"")} · ${en?"":stageJ[p.stage]||""}${en?"":" · "}${T("うまれて "+days+" 日","day "+days)}` : "";
    ov.innerHTML=`<div class="pet-log pet-rec"><button class="plog-close">✕</button>
      <h3>🌱 ${T("せいちょうの きろく","Growth record")}</h3>
      <p class="pet-sub rec-head">${esc(head)}</p>
      <ul class="rec-trail">${trail}</ul>
      ${grave}
      <p class="pet-sub">${T("この子が 歩[あゆ]んできた 道[みち]だよ。勉強[べんきょう]を つづけると、もっと 成長[せいちょう]する。","This is the path your companion has walked. Keep studying and it grows further.")}</p></div>`;
    ov.querySelector(".plog-close").onclick=()=>{ ov.style.display="none"; };
    ov.querySelectorAll(".dex-c[data-seed]").forEach(cv=>drawCreature(cv, genome(+cv.dataset.seed), "adult", "happy", 0));
  }
  function renderInto(el){ if(!el) return;
    if(!S.mourning) ensureEgg();              // fate grants one egg the first time
    const p=pet(); if(p) decay(p);            // decay may trigger death → sets S.mourning
    el.innerHTML = S.mourning ? deathHTML() : panelHTML();
    if(FLASH){ const sp=el.querySelector(".pet-speech"); if(sp) sp.textContent=FLASH; }
    bind(el); startAnim();
  }
  function deathHTML(){ const last=S.memorial[S.memorial.length-1]||{};
    return `<div class="pet-box pix pet-dead"><h3>🕊️ ${T("おわかれ","Farewell")}</h3>
      <p class="pet-sub">${T(esc(last.name||"パートナー")+" は天国へ旅立ちました。一緒に過ごせてありがとう。",
        esc(last.name||"Your friend")+" has passed on. Thank you for the time together.")}</p>
      <button class="pet-newegg primary">🥚 ${T("新しいたまごを迎える","Welcome a new egg")}</button></div>`; }

  // ---- public mount points --------------------------------------------------
  // The pet now lives as the LEFT COLUMN of a centered [pet | content] home layout
  // (#pet-slot), so the page stays balanced — no more lone fixed gutter rail.
  function mountHome(homeContainer){
    if(!S.mourning){ ensureEgg(); maybePetIntro(); rollActivity(); maybeGoOut(); }   // welcome story + live a little
    const slot = homeContainer && homeContainer.querySelector("#pet-slot");
    if(slot) renderInto(slot);
    dangerBanner(homeContainer);   // B2: pull you back when the pet is in danger
  }
  // a prominent, dismissible top banner when the pet is endangered (sick / HP low) — so
  // neglect is FELT on return and you're pulled back to study & care (it can still die).
  function dangerBanner(homeContainer){
    if(!homeContainer) return;
    const p=pet(), old=homeContainer.querySelector("#pet-danger");
    const danger = p && !p.diedAt && p.stage!=="egg" && (p.sick || (p.hp!=null && p.hp<40)) && !S.mourning;
    if(!danger){ if(old) old.remove(); return; }
    if(old) return;   // already shown this view
    const b=document.createElement("div"); b.id="pet-danger"; b.className="pet-danger";
    const nm=esc(p.name||"この子");
    const msg=T(nm+"が あぶないよ！はやく 勉強[べんきょう]して、お世話[せわ]してあげて。",nm+" is in danger! Study and take care of it — fast.");
    b.innerHTML=`<span>⚠️ ${window.toRuby?toRuby(msg):esc(msg)}</span><button class="pd-x" title="${T('閉じる','Close')}">✕</button>`;
    b.querySelector(".pd-x").onclick=()=>b.remove();
    homeContainer.insertBefore(b, homeContainer.firstChild);
  }
  function refresh(){ const slot=document.getElementById("pet-slot"); if(slot) renderInto(slot); }
  function showRail(){}   // no-op (kept for the app.js call site; layout is now in-flow)

  // ---- B-walk: the house & a roaming pet (navigation as a guided study tour) ----
  // The whole site is the pet's home; each page is a room. It hops in to cheer when you
  // open a study page (a page-relevant JP line = a phrase to read), and sometimes it's
  // "out playing" on a page — leaving a hint home so its whims pull you in to study. Text only.
  const STUDY_PAGES=["daily","general","scenarios","test","notes"];
  const PAGE_LABEL={ daily:["每日","Daily"], general:["基础","Basics"], scenarios:["場面","Scenes"], test:["测试","Tests"], notes:["笔记","Notes"] };
  const PAGE_LINES={
    daily:["きょうも 音読[おんどく]、いっしょに がんばろう！","朗読[ろうどく]、ファイト！"],
    general:["動詞[どうし]の活用[かつよう]、おさらいしよ！","助詞[じょし]、むずかしいけど だいじだよ！","時間[じかん]の 読[よ]み方[かた]、おぼえてる？"],
    scenarios:["ロールプレイ、たのしいよね！","この場面[ばめん]、つかえるよ！"],
    test:["テスト、ファイト！じぶんを ためそう！","ぜったい できるよ！"],
    notes:["メモ、えらい！あとで 見返[みかえ]そうね。","かいたこと、わすれないでね！"],
  };
  function pageLabel(pg){ const l=PAGE_LABEL[pg]; return l?(window.LANG==="en"?l[1]:l[0]):pg; }
  function pageLine(pg){ const a=PAGE_LINES[pg]||["がんばって！"]; return a[Math.floor(Math.random()*a.length)]; }
  let ROAM_T=0;
  function petRoam(pg,found){
    const p=pet(); if(!p||p.diedAt||p.stage==="egg") return;
    let el=document.getElementById("pet-roam");
    if(!el){ el=document.createElement("div"); el.id="pet-roam"; el.className="pet-roam";
      el.innerHTML='<div class="proam-bubble"></div><canvas class="pet-canvas" width="76" height="76"></canvas>';
      document.body.appendChild(el); el.querySelector("canvas").style.cursor="pointer"; el.querySelector("canvas").onclick=()=>{ el.classList.remove("show"); }; }
    const jp = found ? T("みーつけた！いっしょに べんきょうしよ！","Found me! Let's study together!")
                     : (window.LANG==="en"?"Let's do this!":pageLine(pg));
    el.querySelector(".proam-bubble").innerHTML = window.toRuby?toRuby(jp):esc(jp);
    el.classList.add("show"); startAnim();
    clearTimeout(ROAM_T); ROAM_T=setTimeout(()=>{ if(el) el.classList.remove("show"); }, found?5000:4200);
  }
  function maybeGoOut(){
    const p=pet(); if(!p||p.diedAt||p.stage==="egg") return;
    if(S.out){ if(now()-S.out.since > 14*3.6e6){ S.out=null; save(); } return; }   // came home after a while
    if(now()-(S.outAt||0) < 3*3.6e6) return;                                        // not too often
    if(Math.random()<0.22){ const pg=STUDY_PAGES[Math.floor(Math.random()*4)]; S.out={page:pg,since:now()}; S.outAt=now(); save(); }
  }
  function onPageVisit(pg){
    const p=pet(); if(!p||p.diedAt||p.stage==="egg") return;
    if(S.out && S.out.page===pg){ S.out=null; save(); p.meters.happy=clamp(p.meters.happy+6); refresh(); petRoam(pg,true); return; }
    if(pg==="home") return;                                  // maybeGoOut already ran in mountHome
    if(STUDY_PAGES.indexOf(pg)<0) return;
    if(now()-(S.roamAt||0) < 7*60000) return;                // ≤ ~once / 7 min, never naggy
    if(Math.random()<0.5){ S.roamAt=now(); save(); petRoam(pg,false); }
  }
  function awayHTML(p){
    const lbl=pageLabel(S.out.page);
    return `<div class="pet-box pix pet-away">
      <div class="pet-screen empty"><span class="away-z">… ?</span></div>
      <div class="pet-id"><b class="pet-name">${esc(p.name||"")}</b><span class="pet-tags">${T("おでかけ中[ちゅう]","out playing")}</span></div>
      <div class="pet-speech">${window.toRuby?toRuby(T(`${p.name}は「${lbl}」で あそんでるみたい！`,`${p.name} is off playing in "${lbl}"!`)):esc(p.name+" is out playing!")}</div>
      <button class="pet-follow">${T("ついていく →","Go find it →")}</button>
    </div>`;
  }

  // study event hook (called from app.js markSession / test finish)
  function onStudy(){ JUST_STUDIED=now(); AI_SAY=null; S.chatNudge=now(); const p=pet(); if(p) decay(p); save(); refresh();
    if(p) generateStudyLine(p); }   // agent writes a reaction (async) when a key is set

  window.Pet={ mountHome, refresh, onStudy, showRail, onPageVisit,
    _debug:{ studySXP, state:()=>S, reset:()=>{ S=fresh(); save(); refresh(); },
      genome, draw:(cv,seed,stage,mood,frame)=>drawCreature(cv,genome(seed),stage,mood||"happy",frame||0) } };
})();
