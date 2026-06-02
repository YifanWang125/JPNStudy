# BUILD-TASKS R2 — 第二轮复验发现（Review → Build）

> Review session 在 build 完成后做了第二轮复验。**第一轮的功能都已实现且验证通过**（见下"已确认 OK"）。
> 本文件只列**新发现的问题 + 优化项**，交给 build session 执行。仍是个人自用，合规/多用户等继续搁置。

## 已确认 OK（无需再动）
- 真人音频：manifest 加载 **608 条**（257 句 + 351 词），键名 `d{day}_s{idx}` / `v_<归一化读音>` 前后端一致；MP3 可正常加载播放（HTTP 200）。
- 第一轮 4 个 bug 全部修好：morning 中文译文开关不再被重置；词汇朗读经 `speechNorm` 去「〜」；页眉单行不折行；`quiz-bar` 用 `--header-h`。
- 主页看板（streak / 热力图 / 数据 / 每日一句 / 今日任务）、设置弹窗、导入导出、Azure 设置+无 key 回退——均渲染正常。
- 4 页导航、看板、设置、发音模块实测 **0 console 报错**。
- `reference.js` 助数词处已补「じゅっ／じっ」两读注。

---

## P1 — 发音评估的真实功能缺口（依赖 Azure 前必须修）

### R2-1 ｜Azure「整段」模式只会评到第一句
`scoreAzure()` 无论逐句/整段都用 `recognizeOnceAsync`，它在**第一个停顿处就结束**（单 utterance）。于是「整段」模式接 Azure 时，只会评估到第一句的发音，后面整段被丢弃（而浏览器回退用 `continuous=true` 是对的）。
- **改法**：整段模式下走 `startContinuousRecognitionAsync` + 在 `recognized` 事件里累计各句的 PronunciationAssessmentResult（或对整段用连续识别后聚合分数）；停止时 `stopContinuousRecognitionAsync`。若实现成本高，至少：Azure 开启时把「整段」按钮置灰并提示"整段精评需要连续识别，逐句模式可用 AI 精评"。
- **验收**：填入有效 key，整段模式录一段多句话 → 四项分数与逐字覆盖**整段**而非只有第一句。

### R2-2 ｜Azure + 手动「停止」会产生多余/重复的历史记录
`stopRec()` 的 azure 分支里有一行自赋值死代码 `PRON._pending=PRON._pending;`，随后 stop 掉 MediaRecorder → `onstop` → `finalizeAttempt(L, null, url)` 先落一条 **score=0 的 noscore 记录**；之后 Azure 的异步结果再 `gotScore` → 落**第二条**真实记录。50ms 的 `_done` 去重窗口隔不住秒级后到的 Azure 回调。
- **改法**：录音停止只负责"取到可回听的 blob"，**不要在分数未回来前 finalize**；让分数回调（gotScore）来 finalize 并把已存的 url 一起带上。删掉自赋值死代码，理顺 `_pending/_scored/_done` 状态机（建议合并为单一 `pendingAttempt = {url?, score?}`，两路都齐了再 finalize 一次）。
- **验收**：Azure 模式下，一次录音**只产生一条**历史记录，且既有分数又能回听。

### R2-3 ｜确认 Azure 逐字上色真的有数据（核心卖点）
`azureScoreObj()` 取 `pa.detailResult.Words` / `pa.words` 给每词上色，取不到就回退成无色的 `text`。这条路径**没在真实 key 下验证过**，若 SDK 字段名对不上，"逐音素/逐字上色"会静默变成"只显示识别文字、无颜色"。
- **改法/验收**：用真实 key 跑一次确认逐字有红/黄/绿；若 `wordsHtml` 为空，改用 `result.properties.getProperty(SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult)` 解析 `NBest[0].Words[].PronunciationAssessment.AccuracyScore` 来上色。

---

## P2 — 健壮性 / 体验

### R2-4 ｜Azure 开启时同时开了两路麦克风
`startRec` 用 `getUserMedia` 开一路给 MediaRecorder（为了"听我的录音"），Azure SDK 又 `AudioConfig.fromDefaultMicrophoneInput()` 开第二路。多数机器能同时开两路，但浪费、个别设备会"占用/回声"。
- **改法**：优先用同一条 stream——`AudioConfig.fromStreamInput(...)` 复用 getUserMedia 的流；或 Azure 开启时不再单独录 MediaRecorder（取舍：那样就没有"听我的录音"，建议尽量复用流保留回听）。

### R2-5 ｜发音历史的录音 objectURL 泄漏 + 标记完成会清空
每次 morning 重渲染（如点「标记完成」→ render → `appendPron` 重置 `PRON={history:{}}`）都会丢弃旧的 `history`，里面的 `URL.createObjectURL` 录音**没被 revoke**（内存泄漏），且用户"最近 3 次录音"被清空。
- **改法**：替换 PRON 前先 revoke 旧 history 里所有 url；或把录音历史从"重渲染就重置"里解耦（标记完成不该清掉本次练习录音）。

---

## P3 — 文档 / 清理（很小）

- **R2-6 footer 文案过时**：`index.html` 页脚仍写"音频由系统日语语音朗读（建议用 Chrome / Safari）"。现已是 VOICEVOX 真人音频——改为如"真人音频(VOICEVOX)，缺失时回退系统语音；录音/发音评估请用本地服务器打开"。
- **R2-7 gen_audio.py 覆盖说明**：头部注释说覆盖名句要"add it to manifest.json"，但站点实际加载 `manifest.js`（全局），只改 json 在 file:// 下不生效、且会被脚本覆盖。改为：**直接用清单里已有的同名文件覆盖**（最简单，无需改清单）；或改完重跑脚本（它会同步 json+js）。
- **R2-8 死/重复 CSS**：`.pron-engine` 定义了两次（约 L426、L464），`.pron-engine.azure`（L465）已无人用（代码用 `.on`）。清掉即可。
- **R2-9（可忽略）**：从 30天地图卡片 / 热力图格子进入某天时没有把 `STATE.showZh` 复位为 false（其他入口都复位了）。一致性问题，无实际危害。

---

## 仍按计划不做（§7）
听力专项、SRS 间隔复习、OJAD 音高联动——价值高，留待后续单独一轮。

> 建议交付顺序：R2-2 → R2-1 → R2-3（发音核心正确性）→ R2-5 → R2-4 → P3 杂项。
