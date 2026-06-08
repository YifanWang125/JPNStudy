# BUILD-TASKS R6 — 交接（R5 已交付，本文件只列"仍未做"）

> R5 已交给 builder 并完成了一大批。Review 已逐条复核 R5 现状；**本文件＝仍未做的项**（R5 残留 + 本轮考试中心新发现）。复核方式：grep/实跑，非转述。

## ✅ R5 已验证完成（勿重做）
G 课文讲解 ja（语法精讲/词义/扩展/拆解/参考表均改为 `LANG!=="zh"`；produce promptZh、pet trv 同步）；H1 XSS（新增 `escAttr()`，用于 notes data-newtitle/标题、名字输入等）；H3 产出喂宠物（progressXP 计入 `jpn-produce-log`）；H4 测试计时器（离开 test 未交卷即 clearInterval）；H5b 宠物只升不降（stage 仅在更高时赋值）；H8 五十音「を」接受 `o`；H9 漫游覆盖全部页面；H7 的状态机（pending 双就绪才落一条）已在但见 R6-3。0 console 报错。

---

## 🟡 R6 待办

### R6-1【HIGH·i18n 大债】en/ja 模式下仍硬编码中文的 surface（H2 未做）
切到 English / 日本語 时这些仍显示中文：
- **整个设置弹窗** `app.js`（`👤你的名字`/`🎤发音评估引擎`/`💾进度备份`/`🎙️声音模型`/`🔊真人音频` 各 `<h3>`+说明+按钮+placeholder）+ 全部状态/alert/confirm（`已保存✓`/`已切换✓`/`试听中…`/`已导出✓`/`导入将覆盖…确定继续？`/`导入成功！`/`导入失败：`、Azure 连接测试串、发音错误串、评分行 `正确 N 字`）。
- **整个 AI 助手设置面板 + 其状态/错误/alert** `assistant.js:208–330`（模型名「Sonnet 4.6（推荐·均衡）」…、`📘怎么获取API Key` 指南、`🔌测试连接`全部反馈、greetingNeedsKey、"此浏览器不支持语音输入" alert）。
- **词典/语法索引** `app.js`：glossary 标题 + grammar-index 标题硬编码；且 **`GLOSSARY[].def` 只有中文、无 en/ja 数据** → en+ja 都显中文（需补 `defEn`/`defJa` 并按语言取）。
- **planned-day 占位页**（全 30 天已写，低）；**continue-cta 的 session 标签** `app.js:1055`（仍 `LANG==="en"?…:SESSION_LABEL`，ja 落中文，G 漏的一处）；零散：FAB 标签(提问/速记/工具)、热力图 title/图例、地图开关(回到今天/30天地图)、每日一句朗读 title、`notes.js:236`(速记 前缀)、`notes.js:27`(满存 alert)。
- 修：统一走 `T()/zhen()`（属性里用 `escAttr`）；glossary 补 en/ja 数据。**验收**：切 en、切 ja，逐页（尤其设置弹窗、AI 面板、基础页词典）无中文残留。

### R6-2【MED·音频】备选音色缺最新音频（H6 未做）
6 个备选音色相比默认仍各缺：kana 104 vs **146**、ex 611 vs **663**、vocab 440 vs **521**（默认在五十音扩充/参考例句后增长，备选未重生成）→ 选非默认音色时这些新内容**回退默认音色**（音色不一致）。修：`python3 tools/gen_audio.py --voice-dir <id>`（6 个都重跑）补齐到当前覆盖。

### R6-3【MED·bug】发音成绩可能存到错句（H7 未做）
`tryFinalize`（app.js ~560）用 `const key=pronKey()` 在**finalize 时**取 key，而 `pronKey()` 读的是**当前** `PRON.idx`。录完某句后在异步评分回来前切到下一句 → 成绩/录音落到**新句**。修：录音开始时 `PRON.pending.key=pronKey()`，finalize 用 `p.key`（pushScoreLog 的 k 同理）。

### R6-4【MED·内容/诚信】考试中心「完整模拟考 / Full Mock」名不副实（I1，本轮新）
模拟考＝现有 40 题重排：**文法 34 + 語彙 2 + 読解 4，无文字(漢字読み)、无听力**。
- `scoreMock`：lang 桶(36 题，~94% 文法，0 文字/2 語彙) 标作「言語知識（文字・語彙・文法）」→ "言語知識 ✓" 给**假信心**；doku 桶**仅 4 题**(每题 15 分)→ 实测错 2 题=30/60、错 3 题=15/60 不合格，**分项判断不可靠**。
- 结果框已诚实标"估算/未含听力"，但没提题库小且偏语法；问题在"完整/Full"这命名。
- 修（建议组合）：① 改名为诚实的（如「综合模拟 / Mini-Mock」）+ 加一句"以语法为主、读解样本少、未含听力，仅供粗估"；② 某桶题数过少(读解 n<~8)时不给自信的 /60 ✗（显示样本量/"样本不足"）；③ 长远：扩充题库（补 文字・語彙・更多读解，乃至听力）。

### R6-5【MED·i18n】模拟考逐题解析在 en/ja 下显示中文（I2，本轮新）
`finishTest` 用 `ENT("mock").q[i].explainEn` 取英文解析，但 `window.EN["mock"]` 不存在（mock 把各题打平丢了原 test-id+下标）→ 回退 `q.explain`（中文）。修：`buildMock` 时把每题英文解析带上（`window.EN[t.id].q[idx].explainEn` → `q._explainEn`），`finishTest` 对 mock 优先用 `q._explainEn`。

### 🟢 R6-6 小项
- **I3** 考试中心 mock 卡写「上次/last X/Y」，实存的是**最佳** → 文案改「最佳/best」或真存上次。
- **I4** mock 卡副标题「各科 /60 ≥19；总分 ≥90」暗示三项全测，但 mock 只覆盖两个笔试项（结果框已澄清，卡片可补一句"不含听力"）。
- **H5a** 练习/产出 XP 仍是累加和（重复刷同一套会涨；H5b 降级已修，单调性未修）→ 可改 best/按天去重。
- **H11** 导入是"增量覆盖"（本地有、文件没有的 `jpn-*` 不清），confirm 文案"覆盖当前进度"略过；导入后未重应用 LANG/theme。
- **H12** 每天 `source`/出典行无 `sourceEn` → en+ja 都中文。

---

> 优先级：R6-1（i18n 大债，机构切日/英最扎眼）≈ R6-4/R6-5（考试中心，内容/翻译）→ R6-2/R6-3（音色补齐 / 发音存错句）→ 小项。
> 内容准确性结论：考前指导 N2 事实全部正确；课文/测试题此前已多轮核对无误；本轮唯一"内容"问题是 R6-4（"完整模拟考"覆盖被夸大）。