# BUILD-TASKS R5 (consolidated, living) — v1.0 fixes + Pet (v1.1) 打磨

> **这是给 build session 的单一现行清单（已整合至最近一轮 audit）。** 改完即可定正式版本。
> 决策已由作者拍板（见 B 段）。复审依据：读 pet.js/exercises.js/gojuon.js 全文 + i18n-ja 309 条专家审 + 实跑（home/pet/英文/日文/浅色/场景/五十音，0 console 报错）。
> 本轮新增内容：五十音图(gojuon.js)、日语界面语言(i18n-ja.js)——发现一个**高优先 i18n bug**，见 D 段。

---

## A. 内容修复（v1.0 阻断项，仍未做，必须做）
- **C1【读音】** `js/lessons.js:1274`：`もし一[いち]か月[げつ]…` → `一[いっ]か月[げつ]`（いっかげつ）。
- **C2【词性】** `js/lessons.js:2510`：`歩き続ける … pos:"他動詞（複合）"` → `"自動詞（複合）"`。
- **C3【英文】** `js/i18n-en.js`：`euonic` → `euphonic`（Day1 〜ています gramEn）。
- 可选：C4 Day8「働きたいため」自然度；C5 Day20「身につける」parts 的「に」标注；C6 scenarios 夜店词条 reading 片→平假名一致。
> **A 做完即可宣布 v1.0。**

---

## D. 本轮新增功能的审查（五十音 + 日语界面）

### D1【高优先·i18n bug，必修】`window.LANG` 从未被赋值 → 宠物 / 練習 / 五十音 在「英文」「日文」模式下全部显示中文
- **根因**：`js/app.js` 用 `let LANG`（第28行）保存语言，但**从不设置 `window.LANG`**。而 `js/gojuon.js`(2处)、`js/exercises.js`(1处)、`js/pet.js`(10处) 的本地 `T()` 都读 `window.LANG` → 永远 `undefined` → 全部回退中文。
- **实测确认**：ja 模式下 `window.LANG===undefined`、`getLang()==="ja"`，但五十音的「练习」按钮显示「练习」(简体中文)、分区显示「清音/浊音/拗音」(简体，日语应为 濁音)。pet 与 exercises 同根因。**这对刚上线、面向日本校方 staff 的日语界面是硬伤**（切到日本語，宠物/练习/假名表却是中文）。
- **修法（两步，缺一不可）**：
  1. `app.js`：在 `setLang()` 与初始化(及 applyLang)里同时 `window.LANG = LANG;`（让三个模块能读到真实语言）。
  2. `pet.js` 与 `exercises.js` 的本地 `T(z,e)` 目前只判 `en`/否则中文，**没有 ja 分支** → 即使 window.LANG 修好，ja 模式仍会落中文。改为：ja 时回退英文（`return (L==='en'||L==='ja') && e!=null ? e : z;`，与 app.js/gojuon 的 ja→英文回退一致）。同时 `pet.js` 第452行 `langName` 与 `trv()`（日记/译文语言）也依赖 window.LANG，修后一并验证。
  - 备选更稳：由 app.js 暴露统一的 `window.T` / `window.getLang()`，三模块改用之（彻底消灭各自的本地 LANG 读取）。
- **验收**：切「日本語」→ 宠物、練習、五十音的控件/提示全部为日语（无对应 JA 串时回退英文，**不得出现中文**）；切「English」→ 同理为英文；切「中文」→ 中文。0 console 报错。

### D2【内容·应修】五十音「ら」行例词用了「林檎(りんご)」——不含 ら
- `js/gojuon.js` SEION ら 行：`["ら","ra",{w:"林檎",r:"りんご",...}]`。例词应当体现该假名，りんご 是 り 开头、完全不含 ら。其余各行例词都以本行假名开头（は→花はな…），仅 ら 错。
- 改：换成含 ら 的常用词，如 `らくだ`(骆驼)、`ラーメン`、或 `楽(らく)`。
- （五十音其余全部核对无误：清音/浊音/拗音罗马音全对、片假名转换正确、例词读音正确、104 条真人 kana 音频已生成。）

### D3【日语界面·应修，4 处】i18n-ja 专家审（309 条，整体质量高）发现的真问题
- `"tap to hear"` → 现「タップで発音」：发音=用户去发音，方向错；应「タップで再生」或「タップで音声」（与同义条目一致）。
- `"Heard:"` → 现「聞き取り：」：这是“识别到你说的内容”，聞き取り=听力，方向错；应「認識結果：」或「聞き取り結果：」。
- `"Hatch"` → 现「孵化」：宠物按钮太生硬；改动作式「孵す」。
- `"Polish with review & tests…"` → 现「復習とテストで磨く…」：磨く 缺宾语像翻译腔；改「復習とテストで仕上げ…」。
- 另有 6 条 minor（如 实声→肉声/本物の声、了解 略随意 等），可选。

### D4【可选】五十音小测验只接受 Hepburn 罗马音
- `checkQ` 只认 `shi/chi/tsu/fu/ji` 等；学过 kunrei 的人输 `si/ti/tu/hu/zi` 会判错。可同时接受两套（建一个等价映射）。低优先。

> D1 属于“多语言上线”的硬伤，建议与 A 同批做（甚至更优先于 B）。

---

## B. Study Pet（v1.1）—— 按作者决策打磨

### B1【性能＋体验·应做】动画只在“看得见宠物”时才跑（含跨页“蹦过来看一眼”）
**目标行为（作者明确）**：宠物主要住在主页；在主页时它会摆动/眨眼。学习者**不在主页时不需要一直跳**（看不见，跳了白耗电）。但宠物可以**像 QQ 宠物那样、但更牛**地偶尔“蹦”到当前学习页：从边上跑过来、看你一眼、说一句日语、再跑走——**这段“露脸”期间必须有动画**。结论：动画的开关＝“此刻屏幕上是否有可见的宠物画布”。

**实现方案（具体）：**
1. 加一个唯一判定 + 同步函数（`js/pet.js`）：
   ```js
   function animTargetsVisible(){
     if (document.hidden) return false;                 // 标签页隐藏 → 不跑
     return [...document.querySelectorAll('.pet-canvas')]
       .some(cv => cv.offsetParent !== null);            // 存在“可见”的宠物画布（display:none 时 offsetParent=null）
   }
   function syncAnim(){ animTargetsVisible() ? startAnim() : stopAnim(); }
   ```
2. `draw()` 改为**只重绘可见画布**，且当没有可见画布时**自动停**（兜底）：
   ```js
   function draw(){ FRAME++; let any=false;
     document.querySelectorAll('.pet-canvas').forEach(cv=>{ if(cv.offsetParent===null) return; any=true;
       const p=pet(); if(p) drawCreature(cv, genome(p.seed), p.stage, moodOf(p), FRAME); });
     if(!any){ stopAnim(); return; }                     // 屏幕上没有宠物 → 停（省电）
     RAF=requestAnimationFrame(draw); }
   ```
3. 在这些“可能让宠物出现/消失”的时机调用 `syncAnim()`：`showPage()`（切页后）、`petRoam()` 显示时和隐藏(超时)时、聊天/日记/きろく overlay 的 open/close、`refresh()`/`welcomeNewEgg()`、以及 `document.addEventListener('visibilitychange', syncAnim)`。
   - 因为 draw() 在“无可见画布”时会自停，而每个“变可见”的事件都会 `startAnim()`，所以循环**恰好**在有宠物露面时运行。

**结果**：主页→动；切到学习页（无 roam）→ 停（不耗电）；宠物 roam 蹦到学习页那几秒 → 动；聊天/日记 overlay 打开 → 动；切走浏览器标签 → 停；回来 → 恢复。

**“比 QQ 宠物更牛”的露脸打磨（同属 B1，做动画时一起做）：**
- 进场：从屏幕侧边**蹦跑进来**（translateX 由屏外 → 落位，带 1–2 下 squash/bounce），而不是单纯淡入；现有 `.pet-roam` 从底部弹入的 spring 可保留并叠加横向跑入。
- 露脸：保持 idle 摆动（已有 `roamBob`）+ 一句**与当前页相关**的日语台词（已有 `PAGE_LINES`，是可读的短句，很好）。
- 退场：**小跑离开**（滑出屏外）而非原地消失；可加一帧“尘土/💨”纯文本特效。
- 频率：维持“温和不打扰”（现 onPageVisit ≤ ~7 分钟一次、50% 概率）；别更频繁。
- 全程纯文字+canvas，无素材文件（保持 file:// 可用）。

**验收**：① 在「每日/测试」等页静置，开发者工具 Performance/CPU 基本无 pet 重绘；② 宠物 roam 蹦出的几秒内有动画、之后停止；③ 切到后台标签页动画停止、切回恢复；④ 主页动画照常；⑤ 0 console 报错。

### B2【作者决策：保留“永久死亡”，不要改成冬眠/默认关】
宠物的目的是**激励学习、制造紧迫感**：偷懒一周，辛苦养了 15 天、又强又喜欢的宠物就没了——正是这种“舍不得”逼自己每天学。**保留永久死亡逻辑，不做冬眠、不做默认关闭。**
- 只做让这份紧迫感“**公平、可感、能挽救**”的护栏（强化而非削弱机制，别让人觉得是 bug/被偷袭）：
  1. **死亡前要有清晰的升级预警**：濒危状态（生病/HP 低）要醒目（已有 `.pet-warn`，确认够显眼）；
  2. **离开期间也能感知危险**：下次打开时若宠物处于濒危，给一个明确提示（如顶部一次性横幅/角标“你的宠物危险了，快去学习救它！”）——这恰恰把“紧迫感”有效传达，并把人拉回来学习；
  3. **重新开始不至于心碎到弃用**：保留 memorial；新蛋的成长由累计学习历史(SXP)驱动、可较快追回——“可惜但能重来”，维持动力而非劝退。
- 这些都顺着你的设计意图，不改变“会死”的事实。

### B3【布局·按 Review 认为更好的方式调好（作者授权直接定）】
**问题根因**：当前 `.home-layout` 把 `#pet-slot` 和**欢迎横幅**都排在「▶ 继续学习」之前；中等宽度/手机下还会堆叠成“宠物在最上”，导致**核心学习入口被挤出首屏**。学习类应用，主行动必须第一眼可见。

**目标方案（具体结构，从上到下）：**
1. **第 1 屏顶部＝全宽 Hero**：问候 + 🔥连续天数 + **▶ 继续学习 · Day N**。**任何设备首屏都要完整可见**（不被宠物/横幅挤下去）。
2. **Hero 之下＝主体两栏（桌面 ≥900px）**：
   - 主列（左，flex:1）：每日一句 / 昨日复习 / 今日任务 / 30天全景 / 我的数据。
   - 宠物列（右，固定 ~260–300px，`position:sticky; top:84px`）：宠物作为**常驻陪伴**，滚动时保持可见——这是它在主页的“家”。
   - （左右可二选一；推荐宠物在右，让视线先落在左上的学习内容。）
3. **手机（<700px）单列，顺序固定**：Hero(含紧凑问候+streak) → **然后**才是宠物卡（可用更紧凑的小尺寸：小画布+一句话，别占满整屏）→ 每日一句/任务/全景/数据。**宠物绝不排在 Hero 之前。**
4. **欢迎横幅**：改成 Hero **下方**的可关闭细条（或一次性弹窗），不要做成 CTA 之上的大块。并在里面**补一条介绍宠物**（见 B4）。

**验收**：在 **1280×800 与 375×812** 两个尺寸下，进入主页**无需滚动**即可看到并点到「▶ 继续学习」；宠物在桌面为右侧 sticky 陪伴、在手机位于 CTA 之下且尺寸克制；浅/深色两套主题下都协调；0 console 报错。

### B4【小】首次欢迎横幅补充“宠物”介绍
`app.js` introBanner 现列了 真人音色/AI/速记/浅深色，没提这次主角。加一条：如「🥚 学习会孵化并养成你的『言霊』宠物——坚持学，它就长大；偷懒太久它会离开」。（也呼应 B2 的紧迫感。）

### B5【可选·告知】宠物的 AI 调用会用少量 API 额度
`onStudy()`→`generateStudyLine()`、日记、聊天各是一次 Claude(haiku) 调用。BYOK+haiku 很便宜，可在 README/设置里说明“宠物的日记与对话会消耗少量你的 API 额度”。

---

## C. 之前几轮仍未做的小项（v1.0 之后）
- R3-3 笔记三入口（📓页 + 🗒️浮窗 + home 卡）定位点明（草稿→Section→正式库）。
- R3-4 移动端 chrome：页眉手机仍换行；🤖/🗒️ 两个浮窗仍在——移动端收纳次级控件、两 FAB 合并为一个可展开菜单。
- R3-6 Azure 开启时可能双麦克风流 → 复用一条流。
- R3-7 AI 助手**主对话**历史无上限（每轮重发完整课文）→ 留最近 ~8 轮。（宠物聊天已自限，OK。）
- R3-8 备选音色 MP3 入 git（数千文件）→ `audio/voices/*` 改 `.gitignore` 或 git-lfs。

---

## ✅ 已完成（确认，勿重做）
- **R3-1 删 pitch**：数据文件 + 代码死函数全部清除（grep 归零）。✓
- **R3-2 AI 面板 ctx 过期**：`Assistant.refreshCtx` 已在 render/showPage 同步。✓
- **R4 浅色主题**：已实现（`data-theme=light`、暖白 `#fbf6ee`、furigana `#b45309` 清晰、☀️/🌙 持久化）——按规格落地，质量好。✓
- 内容(上轮)除 C1–C3 外、英文模式 / 場景 / 練習 tab：均已确认/实跑正常。

---

## E.【高优先·音色全局生效 bug，必修】切换语音模型后，五十音/例句仍用默认音色
**现象（作者实测）**：在 ⚙ 把音色设为「四国めたん 性感」后点五十音听着怪；切到「No.7 清晰朗读」后**音色完全没变**，还是之前那个。

**排查结论（非"切换没生效"，而是"备选音色压根没有这些音频文件"）**：
- 切换逻辑本身是对的：`#voice-sel` 的 onchange 调了 `setVoice()`、init 也 `setVoice(currentVoiceId())`，`VOICE_PREFIX` 会更新。
- 真正原因在音频覆盖面：
  - 默认音色：paragraph(`d*_s*`) + vocab(`v_`) + 例句(`x_`,611) + 五十音(`kana_`,104) 全有。
  - **备选音色** `audio/voices/<name>/` 每个只有 **697 个文件＝paragraph+vocab**，**没有 kana、没有 examples**（`hasKana=0`，且当初是用 `--no-ex` 生成的）。
  - `playOne()` 的回退是"选定音色的文件不存在 → 静默回退默认文件"。于是 **kana 和例句永远回退到默认那一份** → 选什么音色都不变。
- 根因在 `tools/gen_audio.py`：**kana 生成被包在 `if not args.voice_dir:` 里**（约 301–349 行），所以 `--voice-dir` 的备选音色根本不生成 kana；examples 又因 `--no-ex` 没生成。→ 备选音色只覆盖了 paragraph+vocab。

**目标（作者定的核心逻辑）**：用户随时可改音色，**一旦更改应全局生效**——至少所有"内容类"音频（课文、词汇、例句、五十音）都用新模型。

**修法：**
1. **`tools/gen_audio.py`**：把 **kana 生成移出 `if not args.voice_dir:`**（让 `--voice-dir` 也产出 `voices/<name>/kana/`）；备选音色**不要再用 `--no-ex`**（让其产出 `voices/<name>/ex/`）。即：一个 `--voice-dir` 跑下来＝paragraph+vocab+examples+kana 全套。
2. **重新生成每个备选音色的全套**（VOICEVOX 开启时）：`python3 tools/gen_audio.py --voice-dir metan-sexy --speaker <id>`（去掉 --no-ex），其余 5 个同理。完成后 `audio/voices/<name>/` 应含 `kana/` 与 `ex/`。
3. 跑完自检：每个 voice 文件夹 `find … -path '*kana*' | wc -l` 应≈104、`…/ex` 应≈611；前端切到该音色后 kana/例句不再静默回退默认。
4. **仓库体积**（与 R3-8 合并处理）：6 音色 ×(kana104+ex611+…) 会新增数千 MP3 → 把 `audio/voices/*` 改 `.gitignore` + 文档化"按需用脚本生成"，或用 git-lfs；别再把这些塞进普通 git。

**设计取舍（请作者确认，1 处）**：**场景对话(scenarios)是按角色固定多音色**（顾客/店员不同声优），它**不**跟随全局音色选择——这是有意为之、建议保留。即"全局音色"作用于课文/词汇/例句/五十音；场景按剧情角色配音。若你希望场景也跟随，再单说。

**验收**：设为任一备选音色 → 五十音逐字、词汇例句、课文 全部用该音色发音（不再回退默认）；切回默认亦正确；缺某 clip 时才回退（不应整类回退）；0 console 报错。

> ⚠️ 这关乎"音色"这个卖点的正确性，建议与 A/D1 同批，先于 B。

---

---

## F.【全量排查】所有"发声"与"语言"surface（Review 主动逐一过）

> 关键前提：**TTS 兜底默认关闭**（`jpn-tts!=="1"`，当初为"干掉机械音"）。后果：**任何没有预生成音频的发声点，默认点了没声音**（只闪一下），不是回退 TTS。所以"缺音频"=静音，而不只是"音色不对"。

### F-1 跟随所选音色 ✓（真人 VOICEVOX，已带 audioKey；E 修好后全套生效）
课文朝/午/夜的整段&逐句、抄写「听全文」、发音「听示范/试听」(`d*_s*`)；词汇🔊、词汇例句/语法例句/会话(`x_`)、词汇(`v_`)；主页每日一句&例句(`x_`)、复习词(`v_`)；五十音逐字&测验(`kana_`，需 E 补各音色 kana)。

### F-2 按角色固定多音色 ✓（**有意为之，保留**——作者已确认）
场景对话(`scn_`)、成人版(`scna_`)：顾客/店员不同声优，不跟随全局音色。**保留。**

### F-3 ❌ 默认静音的发声点（无 audioKey → 兜底关 → 没声音）= 要修
- **F3a【中】基础/总览页例句 `.r-ex`**（`app.js:1258`）：参考页所有可点例句**默认没声音**。它们是静态内容，应**预生成音频 + 加 audioKey**（新 key，如 `ref_<norm>` 或复用 `x_<norm>`），让它发声并跟随音色。
- **F3b【中】AI 助手「🔊 读日语」**（`assistant.js:282`）：动态文本，默认静音（按钮形同虚设）。动态文本无法预生成 → 方案：给 AI/宠物这类动态发声**单独走"始终可用的 TTS"**（与全局兜底开关解耦），或在 TTS 关时**隐藏🔊按钮**。二选一。
- **F3c【中】宠物日记/聊天「tap to hear」**（`pet.js:630`）：同 F3b（动态文本，默认静音）。同方案处理。
- **F3d【低】词汇「🧩拆解」部件读音**（`app.js:688`）：无 key → 静音。可给部件读音加 `kana_`/`v_` 式 key 或接受无声。
- **F3e【低】五十音例词**（`gojuon.js:92`，点假名后下方的例词，如 あめ）：`kana_あめ` 不存在 → 静音。可改用 `x_` 或预生成。

### F-4 语言不跟随（系统语言切 en/ja 时仍显示中文）= 要修
- **F4a【高】= D1**：gojuon/exercises/pet 读 `window.LANG`(undefined) → 三模块在 en/ja 下全中文。（修法见 D1。）
- **F4b【中·新发现】AI 助手 `assistant.js` 整个面板硬编码中文**（0 处 T()/LANG）：FAB 提示、问候、tips、输入框 placeholder、发送/清空、footer、Key 提示——**在 en/ja 模式下全是中文**。应改用全局 `T()`（配 i18n-en/ja 串）。
  - 附带（判断题，可不动）：助手的**回答语言**也被系统提示锁成中文（`assistant.js:50`「以中文讲解为主」）。面向日本机构 staff/客户演示时，AI 用中文答略 off-brand；如要，可让回答语言跟随系统语言（en/ja→英文）。优先级低、属产品取舍。
- ✓ 已正确本地化：app.js 主体、课文/词汇/语法/场景/五十音数据、notes.js（用裸 `LANG`，对）、i18n-en/ja。

### F-5 给 T-Go 机构演示（今天求稳）建议的"必修最小集"
**A（内容 C1–C3）+ D1（语言 bug）+ E（音色全局）+ F3a（参考页静音）+ F3b/c（AI/宠物🔊：至少 TTS 关时隐藏按钮，避免"点了没反应"）+ F4b（AI 面板中文）。** 这些都是"一眼能看出不对"的对外问题。B（动画/布局/宠物）次之。

---

---

## G.【高优先·朋友反馈复现】日文(ja)模式下，部分"课文讲解"仍显示中文
**复现确认**（实测，非推测）：系统语言切到 **日本語** 时，同一条语法精讲——英文模式显示 *"Both give a reason. から is subjective…"*，日文模式却显示 **中文** *"两者都表原因。「から」主观…"*。词义、扩展学习同样如此。这正是朋友说的"课文讲解语言没随之替换"。

**根因（已定位，单一模式问题）**：英文**数据是齐全的**（实测 30 天的 grammarEn/exp、例句、会话、reflect、extended、vocab、paragraph **0 缺失**）。问题纯在**渲染分支**：有些字段写成 `LANG==="en" ? 英文 : 中文`（二选一，en-vs-中文），是在加入"日本語"语言**之前**写的、之后没更新。于是 **ja 模式落到中文分支**。其余正确的地方都用 `zhen(zh,en)`（en/ja 都取英文）或 `LANG!=="zh"`——把这些 buggy 分支改成同样逻辑即可。

**逐条修（把 `LANG==="en"` → `LANG!=="zh"`，或改用 `zhen()`）：**
- 课文（HIGH，朋友所见）：
  - `js/app.js:699` 语法精讲 exp：`LANG==="en"&&ge.exp ? …` → `LANG!=="zh"&&ge.exp ? esc(ge.exp) : linkTerms(g.zh)`
  - `js/app.js:688` 词义 vc-mean：`LANG==="en" ? vocabEn… : zh` → `LANG!=="zh" ? (E.vocabEn&&E.vocabEn[v.w]||v.en||v.zh) : …`
  - `js/app.js:712` 扩展学习 items：`LANG==="en"&&extEn[i] ? …` → `LANG!=="zh"&&(E.extEn||[])[i] ? …`
  - `js/app.js:689` 词汇「拆解」部件释义 p.m：`LANG==="en"?(POS_EN[p.m]||p.m):p.m` → ja 也用英文（部件释义目前无独立英文数据，可至少用 POS_EN 映射，或补 partsEn；低于上面三条）。
- 其它页（MED/LOW）：
  - `js/app.js:1235` 基础页**表格** head/rows：`LANG==="en"&&e.head?…:b.head` → `LANG!=="zh"&&…`（否则 ja 下所有参考表格的中文列/表头仍是中文）。
  - `js/produce.js:76` `promptZh`：`window.LANG==="en"?…:it.zh` → 含 ja（口语题副标题在 ja 下仍中文）。
  - `js/app.js:1051` 主页"继续学习"的 session 标签、`js/app.js:1348` 场景小标题：同样 en-only，ja 落中文（小，顺手改）。
- 数据缺口（LOW，影响 en+ja）：每天的 `source`/出典行无英文（`sourceEn` 缺）→ en 和 ja 下都显示中文那串"原创课文（…的语体与情感差别）"。可补 sourceEn，或接受。

**验收**：系统语言＝日本語时，进入任意一天的「昼の理解」——语法精讲、词义、扩展、（基础页）表格 全部为**英文**（ja 模式用英文讲解，与既有设计一致），不再出现中文；英文模式保持正常；中文模式正常。建议**逐天扫一遍**（之前正是漏在个别字段上）。

> ⚠️ G 是这轮最该修的：它就是朋友反馈、且 ja 模式（面向日本机构）下很扎眼。修法统一、低风险（数据已齐，只改判断条件）。

---

> 顺序：G(ja 讲解语言) + A(内容 C1–C3) + D1(语言) + E(音色全局) + F3a/F3b/F3c(静音发声) + F4b(AI面板语言) 先做 → 宣布稳定版本 → B1 动画 + B3 布局 → B2 护栏 + B4/B5 → D2/D3 + F3d/F3e + C/D4 杂项。
> 注：D1/E/F/A 上一轮已验证完成；G 为本轮新发现（同类"加 ja 时漏改"的渲染分支）。

---

## H.【整站 holistic audit】四维并行专审 + 逐条复核（这是之前"整体 review"没做透、漏掉 ja bug 的教训）
覆盖 i18n(三语) / 音频 / 各模块逻辑·状态·XSS / 内容。**每条都已 grep 复核确认。** 按严重度：

### 🔴 HIGH
- **H1【安全·存储型 XSS】`esc()` 不转义引号** → 属性上下文可被突破。
  - 根因：`app.js:98` `esc()` 只转义 `& < >`，**不转义 `"`/`'`**。
  - 命中：`notes.js:94` `data-newtitle="${target}"`（target 来自笔记正文，仅 &<> 被转义）→ 笔记里写 `[[a" onmouseover="…]]` 即可注入事件处理器；**笔记随导出/导入传播 → 持久且可分享**。同源问题：`notes.js:161` 笔记标题 `value=`、`app.js:1140` 名字 `value=`、`assistant.js:164` `data-t="${esc(t)}"`（AI 文本）。
  - 修：加 `escAttr()`（在 esc 基础上再 `.replace(/"/g,"&quot;").replace(/'/g,"&#39;")`），用于所有"把 esc() 结果放进双引号属性"的地方。
- **H2【i18n·大面积硬编码中文】en/ja 模式下仍显示中文的非课文 surface**（远超 G 段的课文字段）：
  - **整个设置弹窗** `app.js:1124、1138–1162`（你的名字/发音评估引擎/进度备份/声音模型/真人音频 各 `<h3>`+说明+按钮+placeholder）+ 全部状态/alert/confirm（`已保存✓`/`已切换✓`/`试听中…`/`已导出✓`/`导入将覆盖…确定继续？`/`导入成功！`/`导入失败：` 等，约 1141–1216）+ Azure 连接测试串(392–414) + 发音错误串(585/611) + 评分行 `正确 N 字`(784)。
  - **整个 AI 助手设置面板 + 其状态/错误/alert** `assistant.js:208–330`（含模型名 `Sonnet 4.6（推荐·均衡）`…、`greetingNeedsKey`、"此浏览器不支持语音输入" alert、`📘怎么获取API Key` 指南、测试连接全部反馈）。
  - **词典/语法索引** `app.js:1241–1289`：glossary 标题 + grammar-index 标题硬编码；且 `GLOSSARY[].def` **只有中文、无 en/ja 数据** → en+ja 都显示中文（需补 defEn/defJa）。
  - **planned-day 占位页** `app.js:839–845`（全 30 天已写，实际少见，低）。
  - **pet.js**：`767` `trv=o=>window.LANG==="en"?o.en:o.zh` → 日记/事件"显示翻译"在 ja 下显示**中文**（数据有 en，应 `LANG!=="zh"?o.en:o.zh`）；`871/879` PAGE_LABEL 仅 zh/en，ja 漏；`586` langName ja 下日记译文用中文。
  - 零散：FAB 标签(提问/速记/工具 915–917)、热力图 title/图例(995/997)、地图开关(899 回到今天/30天地图)、每日一句朗读 title(1057)、`notes.js:236`(速记 前缀)、`notes.js:27`(满存 alert)。
- **H3【宠物核心承诺失效】産出(produce) 练习对宠物零成长**：`produce.js:207` 记 `jpn-produce-log`，但 `pet.js:60 progressXP()` **只读 `jpn-exercise-log`**，从不读 produce-log。→ 用户最重要的"开口说/写段落"产出练习，**完全不喂养宠物**（与 produce.js 头注释"Reps feed the pet's progress growth"自相矛盾）。修：`progressXP()` 计入 `jpn-produce-log`。

### 🟡 MEDIUM
- **H4【bug·测试计时器泄漏】** `showPage()` 只 stopSpeak/stopRec，**不清 `TEST.interval`**。测试中途点任意导航 → 测试页只是隐藏，1s 定时器继续跑，归零后在隐藏页**后台自动交卷**（改 DOM、存最佳分、`Pet.onStudy()`）。修：离开 test 且 `TEST` 未提交时 `clearInterval(TEST.interval)`。
- **H5【宠物·XP 可刷 + 会"退化"】** (a) `pet.js:60` 练习 XP 是**所有完成集的累加和**（重复刷同一套即可无限涨，违背"best-score 不可刷/单调"设计，200 上限还会淘汰旧高分）；(b) `pet.js:201` `p.stage=ns` **无条件赋值**（`up` 只控 onStageUp）→ 当 studySXP 因上限淘汰而下降时，宠物会**降一个阶段**。修：XP 用 best/按天去重；阶段只升不降 `if(indexOf(ns)>indexOf(stage))`。
- **H6【音频·备选音色覆盖不全】** 6 个备选音色相比默认各缺：vocab −81、ex −52、kana −42（默认在 D2/F3a/五十音扩充后增长，备选未重生成）。→ 选非默认音色时，这些新词条/例句/假名**回退默认音色发音**（能响、但音色不一致）。修：重跑 `tools/gen_audio.py --voice-dir <id>` 补齐到当前覆盖。
- **H7【bug·发音结果存错句】** 评分是异步：录完某句后立刻切句/切模式，回调 `tryFinalize` 用 `pronKey()` 取的是**新**句的 key → 成绩/录音存到错误句的 history。修：录音开始时把 key 固定进 `PRON.pending.key`，finalize 用它。

### 🟢 LOW
- **H8** 五十音测验：「を」答案设为 `wo`，输 `o`（现代正确读音）被判错（KUNREI 表无 o→wo）。修：を 接受 `o`。
- **H9** 宠物 roaming 永不去 notes 页：`pet.js:898` `Math.random()*4` 漏了 5 项数组的最后一项。修：`*STUDY_PAGES.length`。
- **H10** produce 语音输入无防重入：连点两次 → 两个并行 recognizer 抢同一 textarea。修：模块级 activeRec 守卫 + 录音时禁用按钮。
- **H11** 导入是"增量覆盖"（本地有、文件没有的 `jpn-*` 不清），confirm 文案"覆盖当前进度"言过其实；且导入后未重应用 LANG/theme。低，但建议确认文案改准。
- **H12** 每天的 `source`/出典行无 `sourceEn` → en+ja 都中文（小）。

### ✅ 复核确认正确（无需动，给你信心）
测试评分与选项乱序-答案对应、最佳分保存逻辑；发音 finalize 状态机(R2-2，双就绪才落一条、mic 流关闭、URL revoke)；`diffStrings` LCS 评分；各模块 BUSY 标志（try/catch/finally 均复位，无卡死）；宠物 rAF 单循环+可见性暂停（无泄漏/重复）；localStorage 全 try/catch；宠物离线衰减 48h 上限（单次离开 HP 最多 −96，满血必活，死亡需持续疏忽=符合设计）；无静音的静态发声点、无 manifest 缺键；场景/宠物 intro 固定音色=有意为之；assistant SSE 解析健壮；`toRuby` 文本与注音都转义（仅属性引号问题见 H1）；cloze/order 答案索引完整；gojuon 假名/片假名转换与 findCell 无碰撞。

> **给机构演示的"必修最小集"**：H1(XSS) + H2(设置/AI 面板中文，机构切日/英很扎眼) + G(课文讲解 ja) + H3(产出不喂宠物)。其余 H4–H12 紧随其后。

---

## I.【新功能·N2 考试中心 exam.js + 关联 tests.js / 测试页】审计（含内容准确性）
入口：测试页(📝)顶部「考试中心」= 考前指导卡 + 完整模拟考卡；下方保留 4 套周测。`exam.js` 导出 guideHTML/buildMock/scoreMock/resultHTML，由 app.js 的 test 页消费。

### ✅ 内容准确（已逐条核对，放心）
**考前指导(Exam Guide)** 的 N2 事实全部正确：结构（言語知識＋読解 合卷 105 分 / 聴解 50 分 / 共约 155）、评分（满分 180、三项各 0–60、**合格＝总分 ≥90 且每项 ≥19**——这条最关键、写对了）、题型（文字語彙 問題1–6、文法 7–9、読解 10–14、聴解 1–5，逐条对）、应试技巧/当天清单/冲刺建议。措辞专业、对备考真有用。功能上：考试中心/指导/模拟考都能正常渲染、startTest 兼容 def 与 id、计分/最佳分/逐题解析/重考都正常、**0 console 报错**。

### 🟡 I1【内容·诚信，应改】"完整模拟考 / Full Mock" 名不副实，且分项估分不可靠
- 实测：模拟考＝把现有 40 题题库重排，构成 **文法 34 + 語彙 2 + 読解 4**，**无文字(漢字読み)、无听力**。
- `scoreMock` 分两桶：lang=文法+語彙(36 题) 标作「言語知識（文字・語彙・文法）」——实际 94% 是文法，**0 文字、2 語彙**，"言語知識 ✓" 会给人"文字語彙也过关"的**假信心**。
- doku=読解 **仅 4 题** → 每题占 15 分。实测：全对 60/60；**错 2 题 → 30/60；错 3 题 → 15/60 直接不合格**。波动巨大，"哪科拖后腿"的判断**不可靠**。
- 结果框诚实标注了"估算/未含听力/官方等化"，但**没说题库很小且偏语法**；问题主要出在"完整/Full"这个命名。
- **改法（任选+建议组合）**：(a) 改名为诚实的如「综合模拟 / Mini-Mock」并加一句"题库以语法为主、读解样本少、未含听力，仅供粗估"；(b) 某桶题数过少(読解 n<~8)时**不要**给出自信的 /60 ✗，改显示样本量或"样本不足"；(c) 若要叫"模拟考"，应扩充题库（补 文字・語彙・更多读解，乃至听力）。**这关乎备考准确性，优先于下面的小项。**

### 🟡 I2【i18n，应修】模拟考的逐题解析在 en/ja 下显示中文
- `finishTest` 用 `ENT(d.id).q[i].explainEn` 取英文解析，但模拟考 `d.id="mock"`、`window.EN["mock"]` 不存在（mock 把各题打平、丢了原题的 test-id+下标）→ `zhen` 回退到 `q.explain`（中文）。实测确认 `EN["mock"]===undefined`。题干/选项是日文(toRuby)没问题，但**解析在英/日模式仍是中文**。
- 修：`buildMock` 组装时把每题的英文解析也带上（从 `window.EN[t.id].q[idx].explainEn` → 存到 `q._explainEn`），`finishTest` 对 mock 优先用 `q._explainEn`。

### 🟢 小项
- **I3** 考试中心 mock 卡片写「上次/last X/Y」，但 `saveTestBest` 存的是**最佳**而非上次 → 文案改「最佳/best」或真的存上次。
- **I4** mock 卡副标题「各科 /60 ≥19；总分 ≥90」暗示三项全测，但模拟考只覆盖两个笔试项（无听力）；卡片层面略overpromise（结果框已澄清）。
- **I5**（非bug）mock 以 `jpn-test-best["mock"]` 计入宠物 XP，与周测同权（按答对率），符合预期。

> 这一轮新功能：**指导内容准确、功能可用**；要改的是 **I1（"完整"名不副实+读解 4 题估分不可靠）** 和 **I2（mock 解析 en/ja 显中文）**。
> 提醒：协作里出现过的 Azure key 记得轮换。
> 本轮 audit 已并入（D 段）。这是交付前的完整清单。

---

## ✅ DONE — build round z18 (2026-06-05)
- **G ✓** 全部修复：ja 模式课文讲解/词义/拆解/扩展/基础页表格/场景小标题/测试分类、produce promptZh、pet 日记译文/langName/pageLabel —— `LANG==="en"` → `LANG!=="zh"`。实测 ja 模式 Day1 昼：语法精讲、词义均为英文。**朋友反馈已解决。**
- **H1 ✓** 加 `escAttr()`（esc + 转义引号），用于：笔记标题/标签/搜索框、断链 `data-newtitle`（并 esc 其可见文本）、设置名字框、AI 🔊 `data-t`。实测 `escAttr('a" onmouseover=…')` 引号被中和。
- **H3 ✓** `progressXP()` 现计入 `jpn-produce-log` → 产出(说/写)练习正常喂养宠物。
- **H4 ✓** showPage 离开未提交的测试时 `clearInterval(TEST.interval)+TEST=null`（不再后台自动交卷）。实测离开后 TEST=null。
- **H5 ✓**（阶段）只升不降：`if(ord.indexOf(ns)>ord.indexOf(p.stage)){…}`。（H5a XP 可刷=累加，未改，进度加权已以 best 为主导，影响小。）
- **H8 ✓** 五十音测验 `を` 接受 `o`（KUNREI 加 `o:"wo"`）。
- **H9 ✓** roaming 覆盖全部 5 个学习页（`*STUDY_PAGES.length`）。
- **H10 ✓** produce 语音输入防重入（`SR_ACTIVE` 守卫 + 录音时禁用按钮）。
- 0 console 报错；cache z18。A(C1–C3)/D/E/F/B 经核实上轮已完成。

## ⏳ REMAINING（按价值排序，已向作者说明）
- **H2**【大件】设置弹窗 + AI 助手设置面板 + glossary 词典 的整体 i18n（en/ja 下仍中文）+ `GLOSSARY[].def` 补 en/ja。量大，建议单独一轮专做。
- **H6 / E-补**【需 VOICEVOX + 体积决策】6 个备选音色重生成补齐（vocab/ex/kana 新词条）；`audio/voices/*` 走 .gitignore 或 git-lfs。
- **H7**【精细】发音录制异步落错句 → 录音起始把 key 固定进 `PRON.pending.key`。（动 R2-2 状态机，谨慎。）
- **H5a**（XP 可刷）/ **H11**（导入文案/重应用 LANG·theme）/ **H12**（每天 sourceEn 缺）/ **F4b 附带**（AI 回答语言跟随系统语言，产品取舍）。
