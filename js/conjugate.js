/* ============================================================================
 *  conjugate.js — deterministic Japanese verb conjugation engine.
 *  Given a verb (kanji word + kana reading [+ optional explicit group]), returns
 *  the full 活用 table + common-usage forms, in BOTH kanji and kana. Reliable:
 *  rules are exact; group is detected (i/e-row + godan-exception list) and can be
 *  overridden by an explicit `g` on a vocab entry for the rare ambiguous case.
 *  window.Conjugate = { group, isVerb, table }.
 * ==========================================================================*/
(function(){
  "use strict";
  // godan ending-kana → its a/i/e/o-row kana + て/た euphonic suffix
  const G={
    "く":{a:"か",i:"き",e:"け",o:"こ",te:"いて",ta:"いた"},
    "ぐ":{a:"が",i:"ぎ",e:"げ",o:"ご",te:"いで",ta:"いだ"},
    "す":{a:"さ",i:"し",e:"せ",o:"そ",te:"して",ta:"した"},
    "つ":{a:"た",i:"ち",e:"て",o:"と",te:"って",ta:"った"},
    "ぬ":{a:"な",i:"に",e:"ね",o:"の",te:"んで",ta:"んだ"},
    "ぶ":{a:"ば",i:"び",e:"べ",o:"ぼ",te:"んで",ta:"んだ"},
    "む":{a:"ま",i:"み",e:"め",o:"も",te:"んで",ta:"んだ"},
    "る":{a:"ら",i:"り",e:"れ",o:"ろ",te:"って",ta:"った"},
    "う":{a:"わ",i:"い",e:"え",o:"お",te:"って",ta:"った"}
  };
  // -iru/-eru verbs that are actually GODAN (look ichidan but aren't). Common, unambiguous ones.
  const GODAN_EXC=new Set(["かえる","はいる","はしる","しる","きる","いる","かぎる","すべる","しゃべる","ちる","にぎる","へる","まいる","あせる","しげる","くだる","のぼる","ける","ふける","ひねる","てる"]);
  const IROW="いきしちにひみりぎじぢびぴ", EROW="えけせてねへめれげぜでべぺ";
  // keyed by the KANJI word — the kanji disambiguates homonyms that the reading can't
  // (帰る/返る godan vs 変える ichidan; 切る godan vs 着る ichidan; 要る godan vs 居る ichidan…).
  const OVERRIDE={
    "帰る":"godan","返る":"godan","振り返る":"godan","見返る":"godan","寝返る":"godan","裏返る":"godan",
    "入る":"godan","走る":"godan","知る":"godan","切る":"godan","要る":"godan","限る":"godan","限られる":"ichidan",
    "散る":"godan","握る":"godan","減る":"godan","蹴る":"godan","滑る":"godan","喋る":"godan","茂る":"godan",
    "湿る":"godan","遮る":"godan","陥る":"godan","参る":"godan","焦る":"godan","練る":"godan",
    "変える":"ichidan","着る":"ichidan","経る":"ichidan","老ける":"ichidan","得る":"ichidan"
  };

  function group(r, explicit, w){
    if(explicit) return explicit;
    if(w && OVERRIDE[w]) return OVERRIDE[w];
    r=String(r||"");
    if(r==="する"||/.+する$/.test(r)) return "suru";
    if(r==="くる"||r==="来る") return "kuru";
    if(!/る$/.test(r)) return "godan";              // ends in う/く/ぐ/す/つ/ぬ/ぶ/む
    if(GODAN_EXC.has(r)) return "godan";
    const pre=r.charAt(r.length-2);
    return (IROW.indexOf(pre)>=0 || EROW.indexOf(pre)>=0) ? "ichidan" : "godan";
  }
  function isVerb(w, r, pos){
    return /動詞|动词/.test(pos||"") && /[うくぐすつぬぶむる]$/.test(String(r||"")) && !/[をにがへ・〜]/.test(String(w||""));
  }

  // kanji form = (kanji word minus its conjugating tail) + (the kana form minus its base)
  function kanjiOf(w, kanaBase, kanaForm, grp){
    if(grp==="kuru"){ return /来/.test(w) ? "来"+kanaForm.slice(1) : kanaForm; }
    let wBase;
    if(grp==="suru") wBase=w.replace(/する$/,"");
    else wBase=w.slice(0,-1);                        // ichidan: drop る · godan: drop last kana
    if(!kanaForm.startsWith(kanaBase)) return kanaForm;   // safety
    return wBase + kanaForm.slice(kanaBase.length);
  }

  function forms(r, grp){
    // returns kana forms keyed by id, plus the kana base used (for kanji reconstruction)
    if(grp==="ichidan"){ const s=r.slice(0,-1); return { base:s, o:{
      masu:s+"ます", te:s+"て", ta:s+"た", nai:s+"ない", pot:s+"られる", pass:s+"られる",
      caus:s+"させる", vol:s+"よう", ba:s+"れば", imp:s+"ろ", stem:s }}; }
    if(grp==="suru"){ const p=r.replace(/する$/,""); return { base:p, o:{
      masu:p+"します", te:p+"して", ta:p+"した", nai:p+"しない", pot:p+"できる", pass:p+"される",
      caus:p+"させる", vol:p+"しよう", ba:p+"すれば", imp:p+"しろ", stem:p+"し" }}; }
    if(grp==="kuru"){ return { base:"", o:{
      masu:"きます", te:"きて", ta:"きた", nai:"こない", pot:"こられる", pass:"こられる",
      caus:"こさせる", vol:"こよう", ba:"くれば", imp:"こい", stem:"き" }}; }
    // godan
    const L=r.slice(-1), base=r.slice(0,-1), g=G[L]; if(!g) return null;
    const iku = /いく$/.test(r);                       // 行く euphonic exception
    return { base, o:{
      masu:base+g.i+"ます", te: iku?base+"って":base+g.te, ta: iku?base+"った":base+g.ta,
      nai:base+g.a+"ない", pot:base+g.e+"る", pass:base+g.a+"れる", caus:base+g.a+"せる",
      vol:base+g.o+"う", ba:base+g.e+"ば", imp:base+g.e, stem:base+g.i } };
  }

  // full table: [{id, zh, ja, kanji, kana}]  +  usage:[{zh, kanji, kana}]
  function table(w, r, pos, explicit){
    w=String(w||""); r=String(r||"");
    const grp=group(r, explicit, w);
    const f=forms(r, grp); if(!f) return null;
    const o=f.o, base=f.base;
    const K=(kana)=>kanjiOf(w, base, kana, grp);
    const row=(id,zh,ja,kana)=>({id,zh,ja,kana,kanji:K(kana)});
    const rows=[
      {id:"dict",zh:"辞书形（原形）",ja:"辞書形",kana:r,kanji:w},
      row("masu","ます形（礼貌）","ます形",o.masu),
      row("te","て形（连接）","て形",o.te),
      row("ta","た形（过去）","た形",o.ta),
      row("nai","ない形（否定）","ない形",o.nai),
      row("pot","可能形（能…）","可能",o.pot),
      row("pass","受身形（被…）","受身",o.pass),
      row("caus","使役形（让…做）","使役",o.caus),
      row("vol","意向形（…吧）","意向",o.vol),
      row("ba","条件形（如果…）","条件ば",o.ba),
      row("imp","命令形（命令）","命令",o.imp)
    ];
    // everyday usage built from the forms (real, mechanically-correct frames)
    const teKana=o.te, stemKana=o.stem;
    const usage=[
      {zh:"正在做 / 状态",  kana:teKana+"います", kanji:K(teKana)+"います"},
      {zh:"想做（愿望）",    kana:stemKana+"たいです", kanji:K(stemKana)+"たいです"},
      {zh:"请做（请求）",    kana:teKana+"ください", kanji:K(teKana)+"ください"},
      {zh:"做了（礼貌过去）",kana:stemKana+"ました", kanji:K(stemKana)+"ました"}
    ];
    const GNAME={ichidan:"II类·一段",godan:"I类·五段",suru:"III类·サ変(する)",kuru:"III类·カ変(来る)"};
    return { group:grp, groupName:GNAME[grp]||grp, rows, usage };
  }

  window.Conjugate={ group, isVerb, table };
})();
