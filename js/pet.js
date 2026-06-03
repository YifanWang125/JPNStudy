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
    const events=[]; for(let i=0;i<n;i++){ const e=wpick(r,EVENTS); applyFx(p,e.fx);
      events.push({ jp:fill(e.jp,ctx), zh:fill(e.zh,ctx), en:fill(e.en,ctx),
        dia:{jp:fill(e.dia.jp,ctx),zh:fill(e.dia.zh,ctx),en:fill(e.dia.en,ctx)} }); }
    const happy=(p.meters.happy>=55 && (p.hp==null||p.hp>40));
    S.activity=S.activity||[]; S.activity.unshift({ ts:now(), span:[last,now()], events, diary:composeDiary(events,happy) });
    while(S.activity.length>30) S.activity.pop();
    S.activityTs=now(); save();
  }
  function unseenLog(){ return (S.activity&&S.activity.length) ? (S.activity[0].ts>(S.logSeen||0)) : false; }

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
      <div class="pet-head"><b class="pet-name">${esc(p.name||"…")}</b><span class="pet-stage">${stageLbl[p.stage]||st}</span>
        ${p.stage!=="egg"?`<button class="pet-logbtn${unseenLog()?" unseen":""}" title="${T('日记・活动','Diary & activity')}">📔</button>`:""}
        <span class="pet-coins">🪙 ${coins()}</span></div>
      <div class="pet-stage-wrap"><canvas class="pet-canvas" width="132" height="132"></canvas></div>
      <div class="pet-speech">${window.toRuby?toRuby(says(p)):esc(says(p))}</div>
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
    root.querySelectorAll(".pet-logbtn").forEach(b=>b.onclick=openLog);
    const cv=root.querySelector(".pet-canvas"); if(cv) cv.onclick=()=>{ const p=pet(); if(p&&!p.diedAt){ p.meters.happy=clamp(p.meters.happy+6); save(); } };
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
      html+=`<div class="plog-diary"><div class="plog-jp" data-jp="${esc(latest.diary.jp)}">${ruby(latest.diary.jp)}</div>${LOG_TR?`<div class="plog-tr">${esc(trv(latest.diary))}</div>`:""}</div>
        <h4 class="plog-h">🕑 ${T("できごと","What happened")}</h4><ul class="plog-events">`;
      acts.slice(0,6).forEach(b=>b.events.forEach(e=>{ html+=`<li><div class="plog-jp" data-jp="${esc(e.jp)}">${ruby(e.jp)}</div>${LOG_TR?`<div class="plog-tr">${esc(trv(e))}</div>`:""}</li>`; }));
      html+=`</ul>`;
    }
    html+=`<p class="pet-sub plog-tip">${T("日本語[にほんご]を 読[よ]む 練習[れんしゅう]だよ。文[ぶん]を タップすると 読[よ]み上[あ]げ（音声[おんせい]がオンのとき）。","Reading practice! Tap a line to hear it (when audio fallback is on).")}</p></div>`;
    ov.innerHTML=html;
    ov.querySelector(".plog-close").onclick=closeLog;
    ov.querySelector(".plog-trtoggle").onclick=()=>{ LOG_TR=!LOG_TR; renderLog(ov); };
    ov.querySelectorAll(".plog-jp[data-jp]").forEach(el=>el.onclick=()=>{ if(window.speakSequence) speakSequence([{text:el.dataset.jp,node:null}]); });
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
    if(!S.mourning){ ensureEgg(); rollActivity(); }   // live a little while you were away
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
