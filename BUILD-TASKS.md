# BUILD-TASKS — JPN 学习站改进规格（Review → Build 交接）

> ## ✅ BUILD STATUS（2026-06-02，build session 完成）
> 全部任务已实现。交给 Review session 按各任务“验收”复验。
> - **任务0 运行方式**：README 已把本地服务器升为推荐；`app.js` 检测 `file://` 并在发音模块显示“改用本地服务器”提示（localhost 下无提示）。✓
> - **任务5 Bug**：(a) morning「中文译文」开关不再被 re-render 重置（只在切到 morning / 换天时复位）；(b) 词汇朗读经 `speechNorm()` 去掉「〜」及首尾标点；(c) 页眉改为单行不折行（nowrap + 断点收纳标签，已在 1024/768 验证 58px 单行）；(d) `quiz-bar` 改用 `top:calc(var(--header-h)+8px)`，JS 动态测量页眉高度。✓
> - **任务2 真人音频**：`tools/gen_audio.py`（VOICEVOX，幂等，已 py_compile + 解析 30 天/257 句通过）；`app.js` 播放层改为优先 `audio/manifest.json` 的 MP3、`<audio>.playbackRate` 保留 0.5–1.1 滑块、缺文件回退 Web Speech。名句可放同名 MP3 覆盖。**注：本环境无 VOICEVOX 引擎，未生成真实音频；当前回退 TTS（已验证回退无报错）。**✓(code)
> - **任务1 Azure 发音评估**：⚙设置面板存 `jpn-azure-cfg`（key+region）；有 key 走 `PronunciationAssessmentConfig`（Phoneme + prosody）逐音素/语调上色，无 key/失败自动回退现有 ASR 近似。SDK 经 `loadAzureSDK()` 动态加载（CDN，注释说明可 vendored）。**注：本环境无 Azure key，未跑通真实评分；已验证回退路径不报错。**✓(code)
> - **任务3 进度看板**：📊 进度页 = streak + 30 天热力图(lv0–3) + 已学词条/语法点 + 分周完成度 + 测试最佳分。✓
> - **任务4 导入导出**：⚙设置里导出全部 `jpn-*` 为带日期 JSON；导入校验+确认+回写+重渲染。✓
> - **任务6（可选）**：`reference.js` 助数词处补注「じゅっ／じっ」两读。✓
> - 校验：全 JS 经 JavaScriptCore 解析通过、新函数齐全、REFERENCE/TESTS 数据完好；浏览器实测 4 页导航/看板/设置/发音模块均正常，**0 console 报错**。
> - 运行说明已写入 README：`python3 -m http.server 4173`（推荐）、`python3 tools/gen_audio.py`（VOICEVOX 音频）、⚙设置填 Azure Key+Region。
> - 暂未做（仍按 §7）：听力专项、SRS、OJAD。


> 本文件由 **Review session** 编写，交给 **Build session** 执行。
> 作者立场：精通日语 + 日语教育 + 技术的审核人。每个任务都给了**实现要点**和**验收标准**（Review session 之后按验收标准逐条复验）。
>
> **使用场景**：主要给作者本人用（中文母语、备考 N2、目标是开口说流利日语）。
> **本轮明确不做**（用户已拍板搁置）：合规/隐私/版权处理、多用户/账号、机构(SIFA)化、讲解多语言 i18n、测试答案后端化。这些先不碰。

---

## 0. 运行方式的前置变更（影响后续所有任务）

新发音/音频功能需要麦克风与本地资源加载，`file://` 下浏览器会拒绝麦克风。**因此本地服务器成为主推运行方式。**

- [ ] 更新 `README.md`：把"双击 index.html (file://)"从"主路径"降级为"快速预览（无录音/无真人音频时可用）"；把 `python3 -m http.server 4173` 提升为**推荐**运行方式，并说明发音评估、麦克风、真人音频均需通过 `http://127.0.0.1:4173` 打开。
- [ ] 在 `app.js` 启动时检测：若 `location.protocol==='file:'`，在发音模块和（缺音频文件时的）音频区域显示一条温和提示，引导改用本地服务器。

**验收**：file:// 打开时课文/测试照常可用，但发音模块显示"请用本地服务器打开以启用录音"提示；localhost 打开时无此提示。

---

## 1. 【P0】发音评估 v2 — 接入 Azure 发音评估（云端 AI，免费额度）

**目标**：从"识别到没识别到词"升级为"**逐音素/逐词的发音质量 + 流畅度 + 韵律评分**"，正对作者"读音弱、想说流利"的核心需求。

### 引擎选型
- **主引擎：Azure Speech — Pronunciation Assessment**（`microsoft-cognitiveservices-speech-sdk`，浏览器 UMD 版，可 CDN 或本地 vendored）。
  - 免费层 F0：每月 5 小时音频，足够个人每日练习。
  - 语言 `ja-JP`；返回 `AccuracyScore / FluencyScore / CompletenessScore / ProsodyScore` 及**逐词、逐音素**得分。
- **降级备用：现有 `webkitSpeechRecognition` 近似评估**（无 Azure key 或调用失败时自动回退，保留现有逻辑）。

### 实现要点
- [ ] 新建**设置面板**（齿轮图标，入口放页眉或发音模块内）：输入 Azure `key` + `region`，存 `localStorage`（键名如 `jpn-azure-cfg`）。不填则用降级方案。
- [ ] 发音模块逻辑改造（`app.js` 的 `appendPron/renderPron/toggleRecog/evalPron`）：
  - 有 key → 用 `SpeechSDK.PronunciationAssessmentConfig`（reference text = 当前句去振假名 `toPlain`，granularity = Phoneme，启用 prosody）+ `recognizer.recognizeOnceAsync` 拿麦克风评估。
  - 渲染：**逐词/逐字按得分上色**（高=绿、中=黄、低=红下划线，沿用现有 `.ok/.miss` 配色体系）；总览四项分数（正確さ/流暢さ/完整さ/抑揚=韻律）+ 一个总分；保留 🔊 听示范、上一句/下一句、逐句练习。
  - 韵律/抑揚分数低时给一句中文提示（例如"注意整句的高低起伏，跟读示范的语调"），呼应作者的口语目标。
  - 无 key/失败 → 回退现有 ASR 近似评分，并提示"接入 Azure key 可获得逐音素+语调评分"。
- [ ] SDK 依赖：优先**本地 vendored**到 `js/vendor/`（离线可用、不被墙影响），CDN 作注释备选。

### 验收
- 填入有效 Azure key 后，对一句课文录音 → 看到四项分数 + 逐字上色 + 示范播放；故意读错某字 → 该字标红。
- 不填 key → 自动回退 ASR 近似，不报错。
- 控制台无未捕获异常。

---

## 2. 【P0】真人级音频 — VOICEVOX 预生成（替换系统 TTS）

**目标**：用**真人声优**音频替换机械系统 TTS；离线可用；音高(pitch accent)更准——直接服务"开口说"。

### 方案
- **VOICEVOX**（免费、开源、声音来自真人声优、可个人/商用）做**离线批量预生成**课文音频为音频文件随站打包。播放时不依赖任何服务、不依赖系统语音。
- 备选（写进注释，不默认启用）：Azure Neural TTS（Nanami/Keita）作为云端高质量替代。

### 实现要点
- [ ] 新建生成脚本 `tools/gen_audio.py`：
  - 读取 `js/lessons.js`，对每天的 `paragraph[].jp` 用 `toPlain` 逻辑去掉振假名括号，得到纯日文。
  - 调 VOICEVOX 引擎本地 API（`http://localhost:50021`：`POST /audio_query` → `POST /synthesis`），选一个**标准语、清晰**的女声为主（如「四国めたん ノーマル」或「春日部つむぎ」），用 `ffmpeg` 转 MP3 以省体积。
  - 输出到 `audio/`，命名稳定可复现：段落句 `audio/d{day}_s{idx}.mp3`；词汇读音 `audio/vocab/{读音hash}.mp3`。
  - 生成 `audio/manifest.json`：`{ "d15_s3": "audio/d15_s3.mp3", ... }`，供前端判断某句是否已有预生成文件。
  - 脚本要**幂等**（已存在则跳过）、并在末尾打印生成/跳过数量。
- [ ] 至少预生成：**全部 30 天的 paragraph 句子**（影子跟读核心）+ **vocab 读音**。examples/conversation 可暂留 Web Speech 即时合成（本轮可选）。
- [ ] `app.js` 播放层改造：
  - 新增播放函数：若 `manifest` 中存在该句 → 用 `<audio>` 元素播放 MP3，`audio.playbackRate = STATE.rate`（**保留 0.5–1.1 倍速滑块**用于影子跟读）；否则回退现有 `speak()`（Web Speech）。
  - `speakSequence` 的逐句高亮改为兼容 `<audio>` 的 `onended` 串播；`stopSpeak` 要能停掉 `<audio>` 和 Web Speech 两者。
- [ ] 少数"名句"想用真实声优原声：支持把同名 MP3 放进 `audio/` 直接覆盖（无需改代码）。在 README 注明此约定。

### 验收
- 跑 `tools/gen_audio.py`（VOICEVOX 引擎开启时）能生成 MP3 + manifest；再次跑为全跳过。
- 网页 Day1/Day15「全文を聴く」播放的是 MP3（真人音），逐句高亮正常；拖动速度滑块到 0.6×，播放变慢且不串音。
- 关闭/未生成音频时，自动回退系统 TTS，不报错。

---

## 3. 【P1】进度看板 + 自我激励

**目标**：强化进度可视化（用户明确说"激励作用很重要"）。

### 实现要点
- [ ] 新增"📊 进度"视图（页眉加入口，或放进 30天地图页顶部）：
  - **连续学习天数 streak**（基于每天是否有 session 完成；存最近完成日期）。
  - **日历热图**：30 天网格，按当天完成 session 数（0–3）深浅着色。
  - **总览数字**：已完成 session 数 / 总数、已学词条数、已学语法点数、4 套测试的最佳分。
  - 分周完成度条（沿用现有 `WEEK_LABELS`）。
- [ ] 顶部既有进度条保留；看板与之数据一致。

### 验收
- 完成几节后，进度视图显示正确的 streak、热图着色、计数与测试最佳分；切换天数/刷新后数据持久。

---

## 4. 【P1】进度导出 / 导入（备份）

**目标**：localStorage 易丢，考前止损。

### 实现要点
- [ ] 在设置面板加"导出进度"：把全部相关 localStorage（`jpn-n2-progress`、`jpn-test-best`、`jpn-last-day`、`jpn-page`、错题本若有、Azure 配置可选不导出）打包成 JSON 下载（文件名带日期）。
- [ ] "导入进度"：选 JSON 文件 → 校验结构 → 写回 localStorage → 重新渲染；导入前确认弹窗（避免误覆盖）。

### 验收
- 导出得到 JSON；清掉 localStorage 后导入该 JSON → 进度、测试最佳分完整恢复。

---

## 5. 【P1】既有 Bug 修复（审核人判定该修）

- [ ] **早晨「中文译文」开关被重置**：`app.js:150` `renderMorning` 每次把 `STATE.showZh=false`。改为：仅在"切换到 morning 这一节"时默认隐藏，而在同一节内 re-render（如点"标记完成"）保留用户的开关状态。
- [ ] **词汇朗读把「〜」读出来**：`app.js:313` 播放 `v.r` 前，先 strip 掉 `〜` 和首尾标点（也用于 TTS/音频文件查找的归一化）。
- [ ] **页眉控件拥挤换行**：中等/窄屏下「Day N」徽标与「30天地图」等被挤换行。优化页眉响应式（缩间距/次要控件收纳），保证常见宽度不折行。
- [ ] **quiz-bar `sticky top:64px` 写死**（`styles.css:342`）：改为不依赖固定页眉高度（如用 CSS 变量或 `top` 适配），避免页眉变高时与题卡重叠。

### 验收
- morning 开"中文译文"后点"标记完成"，译文仍显示。
- 词汇 🔊 不再出现"波浪音"。
- 在 1024px/768px 宽度页眉不折行；测试页滚动时顶部 bar 不遮挡题目。

---

## 6. 内容准确性（本轮无需改）

通读 30 天未发现读音错误，括号配平、渲染、测试评分均正确。仅一条**可选**优化：`reference.js` 助数词/岁数处用了现代「じゅっ〜」读法，可补注"传统/书面亦读 じっ〜"。优先级最低，可不做。

---

## 7. 暂不做 / 留待下一轮（仅记录，本次别动）

- 听力专项模块（盲听→听写/选择）——N2 聴解占比大，价值高，但本轮不做。
- SRS 间隔复习队列（基于错题 + 抄写正确率）。
- OJAD 音高词典联动。
- 上述合规/版权/多用户/机构化/i18n 全部搁置。

---

## 交付顺序建议（给 build session）
1. 任务 0（运行方式 + 提示）——其他功能的前提。
2. 任务 5（Bug 修复）——快、稳基础。
3. 任务 2（VOICEVOX 音频）——对学习目标收益最大。
4. 任务 1（Azure 发音评估）——核心升级。
5. 任务 3、4（进度看板 + 导入导出）。

> Build 完成后请保留：`tools/gen_audio.py` 的运行说明、Azure key 的填写位置说明，方便 Review session 复验。
