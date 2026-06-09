/* ============================================================================
 *  JLPT N2 EXAM CENTER (exam.js → window.Exam)
 *  Dedicated to the real exam (the user sits N2 on ~July 5–6). Two parts:
 *   1) 考前指导 — accurate guide: structure, timing, scoring/pass rules, every
 *      question type (問題1–14 + listening 1–5), per-section strategy, day-of checklist.
 *   2) 完整模拟考 — assembles the authored question bank (tests.js) into the REAL
 *      written-section order and applies REAL JLPT scoring: each section scaled to
 *      /60, pass = total ≥90/180 AND every section ≥19/60 (the sectional minimum that
 *      trips people up). Reuses app.js's test engine (startTest/finishTest); only the
 *      result box is JLPT-style (see showEvaluation's isMock branch).
 *  N2 ONLY for now (N1 later, not yet).
 * ==========================================================================*/
(function(){
  "use strict";
  const T=(z,e)=>{ const L=window.LANG; if(L==="ja") return (e!=null&&window.JA_UI&&window.JA_UI[e]!=null)?window.JA_UI[e]:(e!=null?e:z); return (L==="en"&&e!=null)?e:z; };
  const tests=()=> (typeof TESTS!=="undefined"?TESTS:(window.TESTS||[]));
  const ruby=s=>window.toRuby?window.toRuby(s):(typeof esc==="function"?esc(s):String(s==null?"":s));

  // ---- real N2 scoring model ----
  const PASS_TOTAL=90, PASS_SECTION=19, SECTION_MAX=60, TOTAL_MAX=180;

  /* ---------- 考前指导 ---------- */
  function guideHTML(){
    const row=(a,b,c)=>`<tr><td>${a}</td><td>${b}</td><td class="ec-c">${c}</td></tr>`;
    return `<div class="exam-guide">
      <button class="exam-back" id="exam-back">← ${T("返回考试中心","Back to Exam Center")}</button>
      <h1>📋 ${T("N2 考前指导","N2 Exam Guide")}</h1>
      <p class="exam-lead">${T("考前把考试本身吃透——结构、时间、评分、合格线、各部分技巧。考场上不慌，就赢了一半。","Know the exam itself cold before test day — structure, timing, scoring, the pass line, and per-section tactics. Walking in calm is half the battle.")}</p>

      <section class="exam-sec"><h2>① ${T("考试结构与时间","Structure & Timing")}</h2>
        <table class="exam-tbl"><thead><tr><th>${T("科目","Section")}</th><th>${T("内容","Contents")}</th><th>${T("时间","Time")}</th></tr></thead><tbody>
        ${row(T("言語知識","Language Knowledge")+"<br>＋"+T("読解","Reading"), T("文字・語彙・文法 ＋ 読解（一整张卷）","Vocab/Kanji + Grammar + Reading (one combined booklet)"), "105 "+T("分","min"))}
        ${row(T("聴解","Listening"), T("听力（中场休息后单独一节）","Listening (a separate section after a short break)"), "50 "+T("分","min"))}
        </tbody></table>
        <p class="exam-note">${T("总时长约 155 分钟（含中间休息）。第一节是 105 分钟的<b>「言語知識＋読解」合卷</b>——时间分配是这一节的胜负手（见④）。","~155 min total (plus a break). The first block is a single 105-min booklet combining Language Knowledge + Reading — time management here decides this section (see ④).")}</p>
      </section>

      <section class="exam-sec"><h2>② ${T("评分与合格线（最关键）","Scoring & Pass Line (most important)")}</h2>
        <div class="exam-callout">
          <p>${T("满分 <b>180</b>，分三个计分项，每项 <b>0–60</b>：","Max <b>180</b>, three scored sections, each <b>0–60</b>:")}</p>
          <ul><li>${T("言語知識（文字・語彙・文法）","Language Knowledge (Vocab/Kanji/Grammar)")} — /60</li>
              <li>${T("読解（阅读）","Reading")} — /60</li>
              <li>${T("聴解（听力）","Listening")} — /60</li></ul>
          <p class="exam-big">${T("合格 = 总分 ≥ <b>90</b>／180　<u>并且</u>　每一项都 ≥ <b>19</b>／60","Pass = total ≥ <b>90</b>/180　<u>AND</u>　every section ≥ <b>19</b>/60")}</p>
          <p>${T("⚠️ <b>任何一项低于 19 就直接不合格</b>，哪怕总分很高。很多人栽在这条——别偏科，尤其别放弃听力。","⚠️ <b>Any single section below 19 = fail</b>, even with a high total. Many people fail here — don't neglect any section, especially listening.")}</p>
          <p class="exam-note">${T("注：官方采用「等化」换算分，不是简单的答对百分比；本站模拟考给的是<b>估算</b>，用来判断「大概过没过、哪一科危险」。","Note: the official score is equated/scaled, not raw %; this site's mock gives an <b>estimate</b> to gauge 'roughly pass/fail, and which section is at risk.'")}</p>
        </div>
      </section>

      <section class="exam-sec"><h2>③ ${T("题型一览","Question Types")}</h2>
        <h3>${T("言語知識：文字・語彙","Vocab & Kanji")}</h3>
        <ul class="exam-q">
          <li><b>問題1 ${T("漢字読み","Kanji reading")}</b> — ${T("汉字→读音（你的弱项，重点练）","kanji → reading (your weak spot — drill this)")}</li>
          <li><b>問題2 ${T("表記","Orthography")}</b> — ${T("假名→汉字写法","kana → correct kanji")}</li>
          <li><b>問題3 ${T("語形成","Word formation")}</b> — ${T("派生・复合词","derivation / compounds")}</li>
          <li><b>問題4 ${T("文脈規定","Context")}</b> — ${T("按上下文选词","pick the word that fits the context")}</li>
          <li><b>問題5 ${T("言い換え類義","Paraphrase")}</b> — ${T("近义替换","closest in meaning")}</li>
          <li><b>問題6 ${T("用法","Usage")}</b> — ${T("词的正确用法","the word used correctly")}</li>
        </ul>
        <h3>${T("言語知識：文法","Grammar")}</h3>
        <ul class="exam-q">
          <li><b>問題7 ${T("文法形式の判断","Grammar form")}</b> — ${T("选最合适的语法形式","choose the right grammar form")}</li>
          <li><b>問題8 ${T("文の組み立て（★並べ替え）","Sentence building (★ reorder)")}</b> — ${T("排序，求★处的词","reorder; answer = what goes in the ★")}</li>
          <li><b>問題9 ${T("文章の文法","Text grammar (cloze)")}</b> — ${T("短文填空（连贯性）","fill blanks in a passage")}</li>
        </ul>
        <h3>${T("読解","Reading")}</h3>
        <ul class="exam-q">
          <li><b>問題10 ${T("短文","Short")}</b> · <b>問題11 ${T("中文","Mid")}</b> · <b>問題12 ${T("統合理解（比较两篇）","Integrated (compare 2 texts)")}</b></li>
          <li><b>問題13 ${T("主張理解（長文）","Long passage")}</b> · <b>問題14 ${T("情報検索","Information retrieval")}</b></li>
        </ul>
        <h3>${T("聴解","Listening")}</h3>
        <ul class="exam-q">
          <li><b>問題1 ${T("課題理解","Task-based")}</b> · <b>問題2 ${T("ポイント理解","Point")}</b> · <b>問題3 ${T("概要理解","Gist")}</b></li>
          <li><b>問題4 ${T("即時応答（快问快答）","Quick response")}</b> · <b>問題5 ${T("統合理解","Integrated")}</b></li>
        </ul>
      </section>

      <section class="exam-sec"><h2>④ ${T("应试技巧（按部分）","Test-Taking Tactics (by section)")}</h2>
        <div class="exam-tip"><b>${T("⏱ 时间管理（第一节 105 分钟）","⏱ Time (the 105-min block)")}</b><p>${T("文字・語彙・文法要<b>快</b>（约 40–45 分钟），把时间留给读解（约 55–60 分钟）。读解一题卡住就先<b>标记跳过</b>，别死磕；最后回头。","Move <b>fast</b> through vocab/grammar (~40–45 min) and save ~55–60 min for reading. If a reading question stalls you, <b>mark it and skip</b> — come back at the end.")}</p></div>
        <div class="exam-tip"><b>${T("✅ 一定要全部作答","✅ Answer every question")}</b><p>${T("答错不倒扣——<b>空着等于白送分</b>。最后留 1 分钟把没把握的全涂上，4 选 1 也有 25%。","No penalty for wrong answers — <b>a blank is a wasted point</b>. In the last minute, fill in every blank; even a guess is 25%.")}</p></div>
        <div class="exam-tip"><b>${T("📖 読解","📖 Reading")}</b><p>${T("先看问题再读文章，带着问题找答案；情報検索（問題14）是「找信息」不是「读懂全文」，按题目条件扫描表格/广告即可。","Read the question first, then hunt for the answer. Info-retrieval (Q14) is scanning for facts, not reading everything — match the conditions against the notice/table.")}</p></div>
        <div class="exam-tip"><b>${T("🧩 文法 ★並べ替え（問題8）","🧩 Grammar reorder (Q8)")}</b><p>${T("先把四块拼成通顺的整句，再数到★的位置选那一块——别一上来就盯★。","Assemble the whole sentence first, then count to the ★ position and pick what lands there — don't stare at the ★ first.")}</p></div>
        <div class="exam-tip"><b>${T("🎧 聴解","🎧 Listening")}</b><p>${T("放音前<b>先扫一眼选项/插图</b>，预判要听什么；一边听一边记关键词；即時応答（問題4）只听一句话就要答，别纠结上一题，立刻进入下一题。","<b>Skim the options/pictures before</b> each clip and predict what to listen for; jot keywords. Quick-response (Q4) gives one line — answer fast and let go; never let a missed item cost you the next.")}</p></div>
        <div class="exam-tip"><b>${T("✂️ 排除法","✂️ Elimination")}</b><p>${T("文法/词汇拿不准时，先划掉明显错的两个，再在剩下两个里选——正确率立刻翻倍。","When unsure on grammar/vocab, cross out the two clearly-wrong options first, then choose between the remaining two — your odds double.")}</p></div>
      </section>

      <section class="exam-sec"><h2>⑤ ${T("当天流程与必带物品","Day-Of: Process & What to Bring")}</h2>
        <ul class="exam-q">
          <li>📄 <b>${T("受験票（准考证）","Test voucher")}</b> ${T("＋ 一张有效证件（护照/在留卡）","+ a valid photo ID (passport / residence card)")}</li>
          <li>✏️ <b>${T("HB / No.2 铅笔几支 ＋ 橡皮","HB / No.2 pencils + eraser")}</b>（${T("机读卡涂卡，别用自动铅笔以外的；多带一支","mark-sheet; bring spares")}）</li>
          <li>⌚ <b>${T("无声手表","A silent analog watch")}</b>（${T("考场不一定有钟；禁用智能手表/手机","rooms may have no clock; smartwatches/phones are banned")}）</li>
          <li>🔇 ${T("手机关机收好；提前 30 分钟到，找好考场和厕所。","Phone OFF and away; arrive ~30 min early, locate your room and the toilets.")}</li>
          <li>🍫 ${T("中场休息很短，带点水和小零食、提前上厕所。","The break is short — bring water/a snack and use the toilet beforehand.")}</li>
        </ul>
      </section>

      <section class="exam-sec"><h2>⑥ ${T("最后冲刺（考前几周）","Final Sprint (the last weeks)")}</h2>
        <ul class="exam-q">
          <li>🎯 ${T("每隔几天做一次<b>限时模拟考</b>（下方「完整模拟考」），练的是<b>配速</b>和<b>心态</b>，不只是对错。","Do a <b>timed mock</b> (below) every few days — you're training <b>pacing</b> and <b>nerves</b>, not just accuracy.")}</li>
          <li>🎧 ${T("听力每天都要碰——这是最容易「一项低于 19」翻车的地方。用官方过去问/公式問題集的音频。","Touch listening every day — it's the easiest section to fall below 19. Use official past papers / 公式問題集 audio.")}</li>
          <li>🗣️ ${T("用本站「产出」练造句/口语，把「看得懂」变「用得出」；错题回去复习对应天的语法。","Use this site's 产出 (Output) to convert comprehension into production; review wrong-answer grammar on its Day page.")}</li>
          <li>📚 ${T("官方样题免费：在 JLPT 官网搜「N2 問題例」；最接近真题的是官方《公式問題集》。","Official sample questions are free (search 'JLPT N2 sample questions'); the closest to the real thing is the official 公式問題集.")}</li>
        </ul>
      </section>
      <button class="exam-back" id="exam-back2">← ${T("返回考试中心","Back to Exam Center")}</button>
    </div>`;
  }

  /* ---------- 完整模拟考: assemble bank into real written-section order ---------- */
  // section bucket: 文字・語彙 + 文法 → 言語知識; 読解 → 読解
  function bucket(cat){ return cat==="読解" ? "doku" : "lang"; }
  function buildMock(){
    const pool=[];
    tests().forEach(t=>(t.questions||[]).forEach(q=>pool.push(q)));
    // order: 語彙 → 文法 → 読解 (mirrors the real booklet)
    const order={ "語彙":0, "文法":1, "読解":2 };
    const qs=pool.slice().sort((a,b)=>(order[a.cat]??1)-(order[b.cat]??1));
    return { id:"mock", isMock:true, timeMin:105,
      title:T("🎯 完整模拟考 · 105分","🎯 Full Mock · 105 min"),
      titleZh:T("真实结构 · JLPT 计分估算","Real structure · JLPT-style scoring"),
      questions:qs };
  }
  // JLPT-style estimate from the written sections
  function scoreMock(def, answers){
    const sec={ lang:{ok:0,n:0,wrong:[]}, doku:{ok:0,n:0,wrong:[]} };
    def.questions.forEach((q,i)=>{ const b=bucket(q.cat); sec[b].n++; if(answers[i]===q.answer) sec[b].ok++; else sec[b].wrong.push({point:q.point,day:q.day}); });
    const scale=o=>o.n?Math.round(o.ok/o.n*SECTION_MAX):0;
    const lang={...sec.lang, scaled:scale(sec.lang), pass:scale(sec.lang)>=PASS_SECTION};
    const doku={...sec.doku, scaled:scale(sec.doku), pass:scale(sec.doku)>=PASS_SECTION};
    const writtenScaled=lang.scaled+doku.scaled;               // /120 (listening not included here)
    // "on track" = both written sections clear 19 AND average ≥50% (the 90/180 bar)
    const onTrack = lang.pass && doku.pass && writtenScaled>=(SECTION_MAX*2*0.5);
    return {lang,doku,writtenScaled,onTrack};
  }
  function resultHTML(res){
    const bar=(label,o)=>{
      const pct=Math.round(o.scaled/SECTION_MAX*100), thr=Math.round(PASS_SECTION/SECTION_MAX*100), few=o.n<8;
      return `<div class="exr-row"><span class="exr-lab">${label}</span>
        <div class="exr-bar"><i class="exr-fill ${o.pass?'ok':'no'}" style="width:${pct}%"></i><span class="exr-thr" style="left:${thr}%" title="${T('合格线 19','pass 19')}"></span></div>
        <span class="exr-num ${few?'':(o.pass?'ok':'no')}">${o.scaled}/60 ${few?('· '+T(`样本仅${o.n}题`,`only ${o.n}Q`)):(o.pass?'✓':'✗')}</span></div>`;
    };
    return `<div class="exam-result ${res.onTrack?'pass':'fail'}">
      <div class="exr-verdict">${res.onTrack?("🎉 "+T("两个笔试科目均达标","Both written sections on track")):("⚠️ "+T("还没稳过——看下面哪一科拖后腿","Not safe yet — see which section is dragging"))}</div>
      ${bar(T("言語知識（文字・語彙・文法）","Language Knowledge"),res.lang)}
      ${bar(T("読解","Reading"),res.doku)}
      <p class="exr-note">${T("这是<b>估算</b>（按答对率换算到 /60）。真实合格 = 三项总分 ≥90/180 <u>且</u>每项 ≥19/60——<b>听力(聴解)是第三项，本模拟未含</b>，务必另用官方音频单独练，别让它低于 19。","An <b>estimate</b> (accuracy scaled to /60). Real pass = total ≥90/180 across <u>three</u> sections AND each ≥19/60 — <b>listening is the 3rd section and isn't in this mock</b>; practice it separately with official audio so it doesn't fall below 19.")}</p>
    </div>`;
  }

  /* ---------- 官方样题 (real Japan Foundation/JEES samples — LINKED, not copied) ---------- */
  const OBASE="https://www.jlpt.jp/samples/sample2018/";
  const OFFICIAL={
    test:[["文字・語彙","Vocabulary","pdf/N2V.pdf"],["文法","Grammar","pdf/N2G.pdf"],["読解","Reading","pdf/N2R.pdf"],["聴解（問題冊子）","Listening booklet","pdf/N2L.pdf"]],
    audio:[["問題1 課題理解","Q1 Task-based","mp3/N2Q1.mp3"],["問題2 ポイント理解","Q2 Point","mp3/N2Q2.mp3"],["問題3 概要理解","Q3 Gist","mp3/N2Q3.mp3"],["問題4 即時応答","Q4 Quick response","mp3/N2Q4.mp3"],["問題5 統合理解","Q5 Integrated","mp3/N2Q5.mp3"]],
    doc:[["解答","Answer key","pdf/N2answer.pdf"],["聴解スクリプト","Listening transcript","pdf/N2script.pdf"],["解答用紙","Answer sheet","pdf/N2sheet.pdf"]]
  };
  const lk=arr=>arr.map(([ja,en,p])=>`<a class="of-link" href="${OBASE}${p}" target="_blank" rel="noopener">📎 ${esc(ja)} <span class="of-en">${esc(en)}</span> <span class="of-ext">↗</span></a>`).join("");
  function officialHTML(){
    return `<div class="exam-guide">
      <button class="exam-back" id="exam-back">← ${T("返回考试中心","Back to Exam Center")}</button>
      <h1>📚 ${T("官方样题（JLPT 公式）","Official Samples (JLPT)")}</h1>
      <p class="exam-lead">${T("这些是 JLPT 官方（国际交流基金・日本国际教育支援协会）免费公开的 N2 样题——<b>最接近真题</b>，而且<b>有真实听力音频</b>。强烈建议<b>限时、按真实流程</b>整套做一遍。","Official free N2 samples from the Japan Foundation & JEES — the <b>closest thing to the real exam</b>, with <b>real listening audio</b>. Do the full set under <b>timed, exam-like conditions</b>.")}</p>
      <section class="exam-sec"><h2>📄 ${T("试题册","Test booklets")}</h2><div class="of-grid">${lk(OFFICIAL.test)}</div></section>
      <section class="exam-sec"><h2>🎧 ${T("听力音频（真实！）","Listening audio (real!)")}</h2><div class="of-grid">${lk(OFFICIAL.audio)}</div>
        <p class="exam-note">${T("配合上面的「聴解（問題冊子）」边听边做；这是练听力最真实的材料，每天都该碰。做完用下面的「听力脚本」核对。","Play these with the Listening booklet above — the most authentic listening material; touch it daily. Check yourself afterward with the transcript below.")}</p></section>
      <section class="exam-sec"><h2>✅ ${T("解答・脚本・答题纸","Answers · transcript · answer sheet")}</h2><div class="of-grid">${lk(OFFICIAL.doc)}</div></section>
      <p class="exam-note">© ${T("国際交流基金・日本国際教育支援協会。以上是官方公开样题的链接（新窗口打开），本站不复制其内容。","The Japan Foundation & JEES. Links to the official public samples (open in a new tab); this site does not copy their content.")}</p>
      <button class="exam-back" id="exam-back2">← ${T("返回考试中心","Back to Exam Center")}</button>
    </div>`;
  }

  /* ---------- AI 出题: expand the mock toward full written length (~74 Q, real structure) ---------- */
  const AI_KEY="jpn-mock-ai";
  const MOCK_TARGET={ "語彙":40, "文法":30, "読解":25 };   // ≈95 — full real-exam-length written mock (listening practiced separately)
  function aiOn(){ return !!(window.Assistant&&window.Assistant.hasKey&&window.Assistant.hasKey()); }
  function aiCache(){ try{ return JSON.parse(localStorage.getItem(AI_KEY)||"null")||{items:[]}; }catch(e){ return {items:[]}; } }
  function aiCount(){ return (aiCache().items||[]).length; }
  function authoredByCat(){ const m={}; tests().forEach(t=>{
      const en=(window.EN_TESTS&&window.EN_TESTS[t.id]&&window.EN_TESTS[t.id].q)||[];
      (t.questions||[]).forEach((q,idx)=>{ const qq=Object.assign({}, q, {_explainEn:(en[idx]||{}).explainEn||""}); (m[qq.cat]=m[qq.cat]||[]).push(qq); });
    }); return m; }
  // fill the gap toward MOCK_TARGET across multiple batched Claude calls (one click → ~full mock)
  async function generateAI(onProgress){
    if(!aiOn()) return 0;
    const have=authoredByCat(), cached=aiCache().items||[]; const cc={};
    cached.forEach(q=>cc[q.cat]=(cc[q.cat]||0)+1);
    const gap=cat=>Math.max(0,(MOCK_TARGET[cat]||0)-((have[cat]||[]).length)-(cc[cat]||0));
    const RULE=`重要：選択肢はちょうど4つ、正解は<必ず一つだけ>になるよう、誤答は明確に不正解にする。日本語は自然でN2相当。answerは正解の番号(0-3)。`;
    const specs={
      "語彙":{ sys:`あなたは JLPT N2 の作問者。中国語母語の学習者向けに文字・語彙の問題を作る。漢字には必ず「漢字[かな]」でふりがな。${RULE}`,
        usr:n=>`N2 の文字・語彙問題を ${n} 問。漢字読み／文脈規定／言い換え類義 を混ぜる。${RULE} JSON配列だけ出力（前後に説明やコードブロックを書かない）: [{"q":"問題文（ふりがな付き、空所は ＿＿）","options":["..","..","..",".."],"answer":0,"point":"短い解説(中国語可)"}]`},
      "読解":{ sys:`あなたは JLPT N2 の作問者。短文読解（100〜200字の本文＋設問）を作る。漢字には「漢字[かな]」でふりがな。${RULE}`,
        usr:n=>`N2 の短文読解を ${n} 問。各問は本文と設問を q にまとめる（本文の後に改行 \\n を入れて「問：…」）。${RULE} JSON配列だけ: [{"q":"本文…\\n問：…","options":["..","..","..",".."],"answer":0,"point":"読解"}]`}
    };
    const BATCH=10, MAXCALLS=10; let calls=0; const out=[];
    for(const cat of ["語彙","読解"]){
      let need=gap(cat); const sp=specs[cat];
      while(need>0 && calls<MAXCALLS){
        const n=Math.min(BATCH,need); calls++;
        if(onProgress) onProgress(cat+" +"+n);
        let got=0;
        try{
          const txt=await window.Assistant.complete({system:sp.sys, messages:[{role:"user",content:sp.usr(n)}], max_tokens:3400});
          const m=String(txt).match(/\[[\s\S]*\]/);
          if(m) JSON.parse(m[0]).forEach(q=>{
            if(q && typeof q.q==="string" && Array.isArray(q.options) && q.options.length===4 && typeof q.answer==="number" && q.answer>=0 && q.answer<4){
              out.push({q:q.q, options:q.options, answer:q.answer, cat, point:q.point||cat, day:0, explain:q.point||"", _ai:true}); got++;
            }
          });
        }catch(e){ break; }
        need-=n; if(got===0) break;          // model gave nothing parseable → stop this category
      }
    }
    if(out.length){ const prev=aiCache().items||[]; try{ localStorage.setItem(AI_KEY, JSON.stringify({items:prev.concat(out)})); }catch(e){} }
    return out.length;
  }
  // mock builder: authored + cached-AI, in real section order, capped to the target counts
  function buildFullMock(){
    const have=authoredByCat(), ai=aiCache().items||[]; const aiByCat={};
    ai.forEach(q=>{ (aiByCat[q.cat]=aiByCat[q.cat]||[]).push(q); });
    const qs=[];
    ["語彙","文法","読解"].forEach(cat=>{ const pool=(have[cat]||[]).concat(aiByCat[cat]||[]); const t=MOCK_TARGET[cat]||pool.length; pool.slice(0,t).forEach(q=>qs.push(q)); });
    const aiN=qs.filter(q=>q._ai).length;
    return { id:"mock", isMock:true, full:true, timeMin:105, aiCount:aiN,
      title:T(`🎯 模拟考 · ${qs.length}题`,`🎯 Mock · ${qs.length} Q`),
      questions:qs };
  }

  /* ---------- 🎧 听力练习 (in-app, VOICEVOX; plays line-by-line) ---------- */
  const LTYPE={ "課題理解":["課題理解","Task"], "ポイント理解":["要点理解","Point"], "概要理解":["概要理解","Gist"], "即時応答":["即时应答","Quick response"] };
  function renderListening(c){
    const items=(window.LISTENING||[]);
    if(!items.length){ c.innerHTML=`<div class="exam-guide"><button class="exam-back" id="exam-back">← ${T("返回考试中心","Back to Exam Center")}</button><p class="hc-empty">${T("听力内容尚未加载。","Listening content not loaded.")}</p></div>`;
      c.querySelectorAll("#exam-back").forEach(b=>b.onclick=()=>window.renderTestHome&&renderTestHome()); return; }
    let h=`<div class="exam-guide"><button class="exam-back" id="exam-back">← ${T("返回考试中心","Back to Exam Center")}</button>
      <h1>🎧 ${T("听力练习","Listening Practice")}</h1>
      <p class="exam-lead">${T("点 ▶ 听一段日语（真人 VOICEVOX 配音），再选答案；听不懂可重听，最后看脚本核对。想练真考听力，请用「官方样题」里的真实音频。","Tap ▶ to hear a clip (VOICEVOX voices), then answer; replay as needed, then check the transcript. For real-exam audio, use the Official Samples.")}</p>`;
    items.forEach((it,qi)=>{
      const tg=LTYPE[it.type]||[it.type,it.type];
      h+=`<div class="ls-item" data-q="${qi}">
        <div class="ls-head"><span class="ls-tag">${esc(T(tg[0],tg[1]))}</span><button class="ls-play" data-q="${qi}">▶ ${T("播放","Play")}</button></div>
        <div class="ls-q">${ruby(it.q)}${(()=>{ const sum=window.LANG==="zh"?it.zh:(it.qEn||""); return sum?`<span class="ls-zh">${esc(sum)}</span>`:""; })()}</div>
        <div class="ls-opts">${it.options.map((o,j)=>`<button class="ls-opt" data-q="${qi}" data-j="${j}">${"ABCD"[j]}. ${ruby(o)}</button>`).join("")}</div>
        <div class="ls-fb" id="ls-fb-${qi}"></div></div>`;
    });
    h+=`<button class="exam-back" id="exam-back2">← ${T("返回考试中心","Back to Exam Center")}</button></div>`;
    c.innerHTML=h;
    c.querySelectorAll("#exam-back,#exam-back2").forEach(b=>b.onclick=()=>window.renderTestHome&&renderTestHome());
    c.querySelectorAll(".ls-play").forEach(b=>b.onclick=()=>{ const it=items[+b.dataset.q]; if(!it||!window.speakSequence) return;
      window.speakSequence(it.lines.map((ln,i)=>({text:ln.jp, node:null, audioKey:`listen_${it.id}_${i}`}))); });
    c.querySelectorAll(".ls-opt").forEach(b=>b.onclick=()=>{
      const qi=+b.dataset.q, j=+b.dataset.j, it=items[qi], wrap=c.querySelector(`.ls-item[data-q="${qi}"]`);
      if(wrap.dataset.done) return; wrap.dataset.done="1";
      wrap.querySelectorAll(".ls-opt").forEach(o=>{ const oj=+o.dataset.j; if(oj===it.answer) o.classList.add("correct"); else if(oj===j) o.classList.add("wrong"); });
      const script=it.lines.map(ln=>`<div class="ls-line"><b>${ln.sp==="f"?"A":"B"}</b> ${ruby(ln.jp)}</div>`).join("");
      document.getElementById("ls-fb-"+qi).innerHTML=
        `<div class="${j===it.answer?'ok':'no'}">${j===it.answer?"⭕ "+T("正解！","Correct!"):"✗ "+T("正解は","Answer:")+" "+"ABCD"[it.answer]}</div>`+
        `${(()=>{ const ex=window.LANG==="zh"?it.explain:(it.explainEn||""); return ex?`<div class="ls-exp">${esc(ex)}</div>`:""; })()}`+
        `<div class="ls-script"><b>${T("脚本","Transcript")}：</b>${script}</div>`;
      try{ if(window.Pet) Pet.onStudy(); }catch(e){}
    });
    window.scrollTo({top:0,behavior:"smooth"});
  }

  window.Exam={ guideHTML, officialHTML, buildMock, buildFullMock, scoreMock, resultHTML, generateAI, aiCount, renderListening };
})();
