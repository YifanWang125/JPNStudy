/* ============================================================================
 *  五十音図 — interactive kana chart (not a boring static image).
 *  ひらがな⇄カタカナ toggle, romaji toggle, tap any kana to HEAR it (VOICEVOX
 *  audio, key "kana_<hira>") + see an example word, and a 練習 quiz (kana→romaji
 *  recall). Built into 基础. Rendered by window.Gojuon.section() into renderGeneral.
 * ==========================================================================*/
(function(){
  "use strict";
  const T=(z,e)=>{ const L=window.LANG; if(L==="ja") return (e!=null&&window.JA_UI&&window.JA_UI[e]!=null)?window.JA_UI[e]:(e!=null?e:z); return (L==="en"&&e!=null)?e:z; };
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const mean=o=>esc((window.LANG==="zh")?(o.zh||o.en||""):(o.en||o.zh||""));
  // hira → kata
  const kata=h=>h.replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60));

  // 清音 rows: [hira, romaji, example {w,r,zh,en}] | null (gap)
  const SEION=[
    [["あ","a",{w:"雨",r:"あめ",zh:"雨",en:"rain"}],["い","i",{w:"家",r:"いえ",zh:"家",en:"house"}],["う","u",{w:"牛",r:"うし",zh:"牛",en:"cow"}],["え","e",{w:"駅",r:"えき",zh:"车站",en:"station"}],["お","o",{w:"お茶",r:"おちゃ",zh:"茶",en:"tea"}]],
    [["か","ka",{w:"傘",r:"かさ",zh:"伞",en:"umbrella"}],["き","ki",{w:"木",r:"き",zh:"树",en:"tree"}],["く","ku",{w:"車",r:"くるま",zh:"车",en:"car"}],["け","ke",{w:"景色",r:"けしき",zh:"景色",en:"scenery"}],["こ","ko",{w:"子供",r:"こども",zh:"孩子",en:"child"}]],
    [["さ","sa",{w:"魚",r:"さかな",zh:"鱼",en:"fish"}],["し","shi",{w:"塩",r:"しお",zh:"盐",en:"salt"}],["す","su",{w:"寿司",r:"すし",zh:"寿司",en:"sushi"}],["せ","se",{w:"世界",r:"せかい",zh:"世界",en:"world"}],["そ","so",{w:"空",r:"そら",zh:"天空",en:"sky"}]],
    [["た","ta",{w:"卵",r:"たまご",zh:"鸡蛋",en:"egg"}],["ち","chi",{w:"地図",r:"ちず",zh:"地图",en:"map"}],["つ","tsu",{w:"月",r:"つき",zh:"月亮",en:"moon"}],["て","te",{w:"手",r:"て",zh:"手",en:"hand"}],["と","to",{w:"鳥",r:"とり",zh:"鸟",en:"bird"}]],
    [["な","na",{w:"夏",r:"なつ",zh:"夏天",en:"summer"}],["に","ni",{w:"肉",r:"にく",zh:"肉",en:"meat"}],["ぬ","nu",{w:"布",r:"ぬの",zh:"布",en:"cloth"}],["ね","ne",{w:"猫",r:"ねこ",zh:"猫",en:"cat"}],["の","no",{w:"海苔",r:"のり",zh:"海苔",en:"seaweed"}]],
    [["は","ha",{w:"花",r:"はな",zh:"花",en:"flower"}],["ひ","hi",{w:"人",r:"ひと",zh:"人",en:"person"}],["ふ","fu",{w:"船",r:"ふね",zh:"船",en:"ship"}],["へ","he",{w:"部屋",r:"へや",zh:"房间",en:"room"}],["ほ","ho",{w:"星",r:"ほし",zh:"星星",en:"star"}]],
    [["ま","ma",{w:"窓",r:"まど",zh:"窗",en:"window"}],["み","mi",{w:"水",r:"みず",zh:"水",en:"water"}],["む","mu",{w:"虫",r:"むし",zh:"虫",en:"insect"}],["め","me",{w:"目",r:"め",zh:"眼睛",en:"eye"}],["も","mo",{w:"森",r:"もり",zh:"森林",en:"forest"}]],
    [["や","ya",{w:"山",r:"やま",zh:"山",en:"mountain"}],null,["ゆ","yu",{w:"雪",r:"ゆき",zh:"雪",en:"snow"}],null,["よ","yo",{w:"夜",r:"よる",zh:"夜晚",en:"night"}]],
    [["ら","ra",{w:"らくだ",r:"らくだ",zh:"骆驼",en:"camel"}],["り","ri",{w:"理由",r:"りゆう",zh:"理由",en:"reason"}],["る","ru",{w:"留守",r:"るす",zh:"不在家",en:"absence"}],["れ","re",{w:"歴史",r:"れきし",zh:"历史",en:"history"}],["ろ","ro",{w:"廊下",r:"ろうか",zh:"走廊",en:"hallway"}]],
    [["わ","wa",{w:"私",r:"わたし",zh:"我",en:"I"}],null,null,null,["を","wo",{w:"（助詞）",r:"を",zh:"宾语助词",en:"object particle"}]],
    [["ん","n",{w:"日本",r:"にほん",zh:"日本",en:"Japan"}],null,null,null,null],
  ];
  const DAKU=[
    [["が","ga"],["ぎ","gi"],["ぐ","gu"],["げ","ge"],["ご","go"]],
    [["ざ","za"],["じ","ji"],["ず","zu"],["ぜ","ze"],["ぞ","zo"]],
    [["だ","da"],["ぢ","ji"],["づ","zu"],["で","de"],["ど","do"]],
    [["ば","ba"],["び","bi"],["ぶ","bu"],["べ","be"],["ぼ","bo"]],
    [["ぱ","pa"],["ぴ","pi"],["ぷ","pu"],["ぺ","pe"],["ぽ","po"]],
  ];
  const YOON=[
    [["きゃ","kya"],["きゅ","kyu"],["きょ","kyo"]],[["しゃ","sha"],["しゅ","shu"],["しょ","sho"]],
    [["ちゃ","cha"],["ちゅ","chu"],["ちょ","cho"]],[["にゃ","nya"],["にゅ","nyu"],["にょ","nyo"]],
    [["ひゃ","hya"],["ひゅ","hyu"],["ひょ","hyo"]],[["みゃ","mya"],["みゅ","myu"],["みょ","myo"]],
    [["りゃ","rya"],["りゅ","ryu"],["りょ","ryo"]],[["ぎゃ","gya"],["ぎゅ","gyu"],["ぎょ","gyo"]],
    [["じゃ","ja"],["じゅ","ju"],["じょ","jo"]],[["びゃ","bya"],["びゅ","byu"],["びょ","byo"]],
    [["ぴゃ","pya"],["ぴゅ","pyu"],["ぴょ","pyo"]],
  ];
  const SETS={ seion:SEION, daku:DAKU, yoon:YOON };
  let script="hira", romaji=true, sec="seion", quiz=null;

  function speak(jp){ if(window.speakSequence) window.speakSequence([{text:jp,node:null,audioKey:"kana_"+jp}]); }
  function cell(c){
    if(!c) return `<div class="gj-cell gj-empty"></div>`;
    const h=c[0], r=c[1]; const disp=script==="kata"?kata(h):h;
    return `<button class="gj-cell" data-h="${esc(h)}"><span class="gj-k">${esc(disp)}</span>${romaji?`<span class="gj-r">${esc(r)}</span>`:""}</button>`;
  }
  function grid(){ const rows=SETS[sec]; return `<div class="gj-grid ${sec}">${rows.map(row=>`<div class="gj-row">${row.map(cell).join("")}</div>`).join("")}</div>`; }

  function section(){   // returns a ref-section block for renderGeneral
    return `<div class="ref-section open" data-id="gojuon">
      <div class="ref-head"><span class="r-emoji">🇯🇵</span><h2>五十音[ごじゅうおん] <span class="r-zh">${esc(T("五十音图 · 假名表","Kana chart (gojūon)"))}</span></h2><span class="r-arrow">▸</span></div>
      <div class="ref-body"><div id="gojuon-app"></div></div></div>`;
  }
  function render(){
    const app=document.getElementById("gojuon-app"); if(!app) return;
    app.innerHTML=`<p class="gj-tip">${T("点任意假名即可听真人发音，并看例词。先切换 平假名/片假名，或开始小测验。","Tap any kana to hear it (real voice) and see an example word. Toggle hiragana/katakana, or start a quiz.")}</p>
      <div class="gj-ctrl">
        <div class="gj-seg" id="gj-script"><button data-v="hira" class="${script==="hira"?"on":""}">ひらがな</button><button data-v="kata" class="${script==="kata"?"on":""}">カタカナ</button></div>
        <div class="gj-seg" id="gj-sec"><button data-v="seion" class="${sec==="seion"?"on":""}">${T("清音","Basic")}</button><button data-v="daku" class="${sec==="daku"?"on":""}">${T("浊音","Dakuten")}</button><button data-v="yoon" class="${sec==="yoon"?"on":""}">${T("拗音","Yōon")}</button></div>
        <label class="gj-rom"><input type="checkbox" id="gj-rom" ${romaji?"checked":""}> ${T("罗马音","Romaji")}</label>
        <button class="gj-quiz" id="gj-quiz">🎯 ${T("练习","Quiz")}</button>
      </div>
      <div id="gj-grid">${grid()}</div>
      <div id="gj-detail" class="gj-detail"></div>`;
    bind();
  }
  function bind(){
    const app=document.getElementById("gojuon-app"); if(!app) return;
    app.querySelectorAll("#gj-script button").forEach(b=>b.onclick=()=>{ script=b.dataset.v; render(); });
    app.querySelectorAll("#gj-sec button").forEach(b=>b.onclick=()=>{ sec=b.dataset.v; render(); });
    const rc=app.querySelector("#gj-rom"); if(rc) rc.onchange=()=>{ romaji=rc.checked; document.getElementById("gj-grid").innerHTML=grid(); bindCells(); };
    app.querySelector("#gj-quiz").onclick=startQuiz;
    bindCells();
  }
  function bindCells(){
    document.querySelectorAll("#gojuon-app .gj-cell[data-h]").forEach(b=>b.onclick=()=>{ const h=b.dataset.h; speak(h); detail(h); });
  }
  function findCell(h){ for(const k in SETS){ for(const row of SETS[k]){ for(const c of row){ if(c&&c[0]===h) return c; } } } return null; }
  function detail(h){
    const c=findCell(h), box=document.getElementById("gj-detail"); if(!c||!box) return;
    const big=script==="kata"?kata(h):h, other=script==="kata"?h:kata(h);
    const ex=c[2];
    box.innerHTML=`<div class="gj-d-k">${esc(big)}</div><div class="gj-d-meta">
      <div class="gj-d-pair">${script==="kata"?"カタカナ":"ひらがな"} <b>${esc(big)}</b> ／ ${script==="kata"?"ひらがな":"カタカナ"} <b>${esc(other)}</b> ／ <span class="gj-d-r">${esc(c[1])}</span></div>
      ${ex&&ex.w?`<div class="gj-d-ex" data-jp="${esc(ex.r)}">${T("例","e.g.")}：<b>${esc(ex.w)}</b>（${esc(ex.r)}）= ${mean(ex)} 🔊</div>`:""}</div>`;
    const exel=box.querySelector(".gj-d-ex"); if(exel) exel.onclick=()=>speak(exel.dataset.jp);
    box.classList.add("show");
  }

  /* ---- quiz: show a kana, recall its romaji ---- */
  function flatCells(){ const out=[]; for(const row of SETS[sec]) for(const c of row) if(c) out.push(c); return out; }
  function startQuiz(){ quiz={pool:flatCells(),score:0,n:0,total:10}; nextQ(); }
  function nextQ(){
    const box=document.getElementById("gj-detail"); if(!box) return;
    if(quiz.n>=quiz.total){ box.innerHTML=`<div class="gj-quizend">${T("练习完成！","Quiz done!")} <b>${quiz.score}/${quiz.total}</b><br><button class="gj-quiz" id="gj-again">${T("再来一次","Again")}</button> <button class="gj-quiz alt" id="gj-stop">${T("结束","Close")}</button></div>`;
      box.classList.add("show"); box.querySelector("#gj-again").onclick=startQuiz; box.querySelector("#gj-stop").onclick=()=>{ quiz=null; box.classList.remove("show"); box.innerHTML=""; }; return; }
    const c=quiz.pool[Math.floor(Math.random()*quiz.pool.length)]; quiz.cur=c;
    const disp=script==="kata"?kata(c[0]):c[0];
    box.innerHTML=`<div class="gj-quizq"><div class="gj-d-k">${esc(disp)}</div>
      <p>${T("这个假名的罗马音是？","Type its romaji:")} <span class="gj-qn">${quiz.n+1}/${quiz.total}</span></p>
      <div class="gj-qrow"><input id="gj-qin" autocomplete="off" placeholder="romaji"><button id="gj-qok" class="gj-quiz">${T("确定","Check")}</button><button id="gj-qhear" class="gj-quiz alt">🔊</button></div>
      <div id="gj-qfb" class="gj-qfb"></div></div>`;
    box.classList.add("show");
    const inp=box.querySelector("#gj-qin"), go=()=>checkQ(inp.value);
    inp.focus(); inp.onkeydown=e=>{ if(e.key==="Enter") go(); };
    box.querySelector("#gj-qok").onclick=go; box.querySelector("#gj-qhear").onclick=()=>speak(quiz.cur[0]);
  }
  // accept both Hepburn (shi/chi/tsu/fu/ji…) and kunrei-shiki (si/ti/tu/hu/zi…) input (D4)
  const KUNREI={si:"shi",ti:"chi",tu:"tsu",hu:"fu",zi:"ji",di:"ji",du:"zu",
    sya:"sha",syu:"shu",syo:"sho",tya:"cha",tyu:"chu",tyo:"cho",zya:"ja",zyu:"ju",zyo:"jo"};
  function checkQ(v){
    const c=quiz.cur, fb=document.getElementById("gj-qfb"); if(!c||!fb) return;
    const v2=(v||"").trim().toLowerCase().replace(/[^a-z]/g,"");
    const ok = v2===c[1] || KUNREI[v2]===c[1];
    if(ok) quiz.score++;
    speak(c[0]);
    fb.className="gj-qfb "+(ok?"ok":"no");
    fb.innerHTML=(ok?"⭕ "+T("正解！","Correct!"):"✗ "+T("正解は","Answer:"))+` <b>${esc(c[1])}</b>`;
    quiz.n++; setTimeout(nextQ,900);
  }

  window.Gojuon={ section, render };
})();
