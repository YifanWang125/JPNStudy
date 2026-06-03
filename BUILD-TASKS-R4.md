# BUILD-TASKS R4 — Azure 实测结论 + 浅色/欢快主题

> Review 用作者提供的真实 Azure key（region: japanwest）做了**服务端真跑**，并接到新需求：加 light / 更 cheerful 的主题。

---

## A. ✅ Azure 发音评估 —— 已端到端实测通过，无需改代码
用一条课文 MP3（Day1「今、日本語を勉強しています。」）转 16k WAV，打 Azure 发音评估 REST（japanwest），两组对照：

| 参考文本 | 总分PronScore | 正確さ | 流暢さ | 完整さ | 抑揚Prosody | 逐词 |
|---|---|---|---|---|---|---|
| 正确 | 92.7 | 96 | 90 | 100 | **88.8** | 全高分 / ErrorType=None |
| 故意给错 | 20.5 | 21 | 0 | 0 | 81.6 | 全部 Mispronunciation（0–39） |

结论：
- **key 有效**；ja-JP **逐音素 + prosody(抑揚) 都支持并返回真实分**（早前我一次看到“空”是我测试脚本解析位置写错，不是产品问题）。
- 评分**能清晰区分对错**（错读→完整/流畅 0 分、逐词标红），评估有意义。
- app `azureScoreObj`（app.js:549）对真实数据的扁平 `Words[].AccuracyScore` 形状**兼容**，逐字上色会正确填充。
- **唯一没法在 Review 端测的**：浏览器真实麦克风采集（需真人开口）。作者已在自测；自测时应看到与上表相近的分数区间即正常。
- ⚠️ 那把 key 已出现在协作记录里，**请去 Azure 门户轮换**。
- 可选优化（不阻断）：仍建议把 SDK 由 CDN 改为本地 vendored（离线/防墙），见 BUILD-TASKS §1。

---

## B. 【新需求·P1】浅色 / 更 cheerful 的主题（朋友反馈：只有暗色不够阳光）

**目标**：在保留现有暗色的基础上新增一套**明亮、温暖、愉悦**的浅色主题，可切换、记忆选择、无闪烁；保持品牌识别（朱色 hanko/torii 红）。这套站本就用 CSS 变量，改造成本可控。

### B1 主题机制
- [ ] 用 `document.documentElement` 的 `data-theme` 控制：`data-theme="light"` / 默认 dark。
- [ ] CSS 增加 `:root[data-theme="light"]{ … }` 覆盖块（重定义下面调色板变量），暗色保留在现有 `:root`。
- [ ] 切换入口：⚙设置里加「外观 / テーマ」一行（☀️浅色 / 🌙深色 / 🖥跟随系统），并在页眉放一个一键 ☀️/🌙 快捷钮。存 `localStorage` 键 `jpn-theme`（值 light/dark/auto）。
- [ ] **防闪烁(FOUC)**：在 `index.html` `<head>` 顶部放一段**内联**小脚本（在 CSS 之前执行）：读取 `jpn-theme`（auto 时用 `matchMedia('(prefers-color-scheme: light)')`）→ 立刻设 `document.documentElement.dataset.theme`。不要等 app.js DOMContentLoaded 再设，否则会先闪一下暗色。
- [ ] `auto` 模式监听 `prefers-color-scheme` 变化实时切换。

### B2 调色板（建议值，可微调；务必过对比度）
保留 `--accent:#e4572e`（朱）作为品牌色——它在浅底上同样精神、且很“和风”。浅色建议：
```
:root[data-theme="light"]{
  --bg:#fbf6ee;        /* 暖白和纸，不刺眼、cheerful */
  --panel:#ffffff;
  --panel-2:#f6efe3;
  --line:#e7ddcc;
  --ink:#2b2521;       /* 暖近黑正文 */
  --ink-dim:#6a5e53;
  --ink-faint:#9a8d7e;
  --accent:#e4572e;    /* 朱 · 不变 */
  --accent-2:#b45309;  /* 深一档的琥珀：浅底上做 furigana/链接才够清晰（关键！） */
  --jp:#7a3f1d;        /* 日文强调：浅底用深暖棕（原 #ffd7a8 在白底看不见） */
  --zh:#1f7a6b;        /* 中文译文：青绿（原薄荷在白底太浅） */
  --good:#2e9e5b; --bad:#d33a44;
  --morning:#e58e26; --noon:#2f86c8; --night:#7c5cd0;
  --header-bg:rgba(255,255,255,.9);
}
```
- ⚠️ **furigana 可读性是重中之重**（作者的核心诉求）：`rt{color:var(--accent-2)}` 在浅底必须对比足够——所以浅色的 `--accent-2` 用深琥珀 `#b45309` 而非原来的浅橙 `#f2a65a`。中文译文 `--zh` 同理改深。请对 furigana(rt)、译文(.zh)、faint 文本三处做 WCAG AA(≥4.5:1) 校验。

### B3 必须变量化/覆盖的硬编码色（否则浅色会破）
审计结果，绝大多数硬编码是“朱色按钮上的 `#fff` 文字”（浅色下仍成立，不用动）。需要处理的：
- [ ] 页眉 `header.top{ background:rgba(15,17,21,.92) }`（styles.css:41）→ 改 `var(--header-bg)`，并在两套主题各定义。
- [ ] 暗色阴影偏重：`box-shadow … rgba(0,0,0,.4–.5)`（FAB、抽屉、modal）在浅色下显脏 → 浅色调淡（如 `rgba(0,0,0,.12)`），可用一个 `--shadow` 变量。
- [ ] 复核“深色文字配在彩色小标签上”的几处（`color:#15121d/#0c1610/#1a1d24` 在 accent-2/good/night 徽标上，styles.css:47/77/241/252/271/278/386/470/591）——浅色主题里这些徽标若变亮，需确保文字仍可读（多数仍 OK，过一眼即可）。
- [ ] `#modal-overlay rgba(0,0,0,.6)` 浅色可保留或略减淡。

### B4 验收
- ⚙切换 ☀️/🌙 即时生效；刷新后保持；`auto` 跟随系统。
- 首屏**无暗→亮闪烁**（内联脚本生效）。
- 浅色下逐页检查：主页/每日(早午夜)/基础/测试/笔记/设置/发音模块/AI 面板/速记浮窗——无“白底白字/看不见的浅色文字”，furigana 与中文译文清晰。
- furigana(rt)、.zh、.ink-faint 在浅色下对比度 ≥ AA。
- 0 console 报错。

---

## C. 仍待办（沿用，未变）
- BUILD-TASKS-R3.md 的：R3-1 删干净 pitch 死代码/文件；R3-2 AI 面板 ctx 标签过期；R3-3 笔记 3 入口定位；R3-4 移动端 chrome 过重 / 两 FAB 遮挡；R3-6 双麦克风；R3-7 AI 历史上限；R3-8 备选音色入 git。

> 建议顺序：B（浅色主题，朋友在等）→ R3-1（删 pitch）→ R3-2 → R3-4。
