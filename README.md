# 日本語 N4 → N2 · 30日の道

一个为你（中文母语 · 备考 JLPT N2）量身定制的每日学习网站。
重点解决你的痛点：**汉字会意思，但不会读音（假名/发音）**；以及**学会写结构完整的句子**。

A daily Japanese study site built around your three-session rhythm and your real weak spot:
*you know what the kanji mean, but not how to read them.*

## 🌐 在线访问 · Live site

**👉 https://yifanwang125.github.io/JPNStudy/**

任何电脑、任何浏览器，**点开就能用**——不用安装、不用命令行。课文、翻译、抄写、测试、考试中心、错题本全都正常。
*Open it on any computer, any browser — nothing to install.* Reading, writing, tests, the Exam Center and Mistakes notebook all work online.

> ⚠️ 网址**区分大小写**：必须是 `JPNStudy`（大写 J P N S），写成 `jpnstudy` 会 404。
> The URL is **case-sensitive** — it must be `JPNStudy`, not `jpnstudy`.
>
> 只有两项功能需要本地服务器（见下）：🎤 **录音发音评估**（浏览器只在 `localhost`/`https` 给麦克风权限）和 **VOICEVOX 真人音频**。线上版这两项会自动回退到系统语音。
> Only two features need the local server below: 🎤 mic-based pronunciation scoring, and VOICEVOX real-voice audio. Online, both fall back to the system voice.

---

## 怎么本地运行 · How to run locally

> 想要**录音发音评估 + 真人音频**，或在本地改代码，就用本地服务器。否则直接用上面的在线版即可。

### ✅ 推荐：本地服务器

在项目目录运行，然后打开 **http://127.0.0.1:4173** ：

```
python3 -m http.server 4173
```

> 🎤 发音评估要用麦克风，而浏览器**只在安全上下文**（`https://` 或 `localhost`）才允许麦克风。
> VOICEVOX 真人音频也需要通过 http 加载。所以要用这两项功能时请用本地服务器打开。
> Mic (pronunciation check) only works over a secure context — i.e. `http://localhost`. Use the local server for that.

### 快速预览：双击 `index.html`（file://）

不需要录音时，直接双击也能用：课文、翻译、抄写、测试照常。
但 **file:// 下发音评估会提示“请改用本地服务器”**（浏览器禁麦克风），且真人音频不加载（回退系统 TTS）。

> 朗读发音：若安装/生成了 VOICEVOX 真人音频则用真人音；否则用浏览器内置日语语音（Speech Synthesis）。
> macOS 若没声音：系统设置 → 辅助功能 → 朗读内容 → 下载日语语音（如 Kyoko）。

> 注：Claude Code 的「Launch 预览面板」用的是 `/tmp/jpn-site` 的一份**副本**（沙箱无法读 `~/Documents`），仅用于调试。

---

## 每天怎么用 · Your daily 3-session loop

| 时段 | 标签 | 做什么 |
|------|------|--------|
| 🌅 早 | 朝の朗読 Morning | 只「读」。先听标准发音 → 调慢速度跟读 3 遍。**默认隐藏译文**，先不求懂。点任意一句可单独播放。 |
| ☀️ 午 | 昼の理解 Noon | 弄「懂」。对照中文译文、记单词、吃透语法点，看它们在日常对话里怎么用。 |
| 🌙 夜 | 夜の反思 Night | 「写」+ 反思。两种模式切换：**⌨️ 输入核对**（打字 → 高亮你和原文的差异，顺便练日语输入）/ **🙈 遮挡默写**（盖住原文，纸笔默写或背诵，再揭晓）。 |

完成每节点一下「标记完成」，进度自动存在本机浏览器，顶部进度条与「🗺️ 30天地图」会更新。

---

## 功能 · Features

- **全文振假名（ふりがな）**：每个汉字头上标读音；右上角可一键开/关——**关掉就是考自己读音**，正好练你的弱项。
- **跟读音频**：整段播放 / 单句播放 / 0.5–1.1 倍速滑块（早晨影子跟读用）。
- **中英双语解析**：核心讲解用中文，语法术语附英文（方便对照其他 JLPT 资料）。
- **抄写双模式**：输入核对（含逐字 diff）+ 遮挡默写。
- **30 天线性路径**：N4 巩固 → N3 核心 → N3→N2 桥梁（乔布斯演讲）→ N2 语法（村上春树）→ 冲刺产出。

---

## 课程进度 · Curriculum

- **Day 1–30 全部已完整写好** ✅（每天都含：课文＋全文振假名＋音频＋词汇表＋语法精讲＋对话例句＋扩展＋抄写双模式＋反思）。
  共 370 个词条、124 个语法点，已通过脚本校验（假名括号配平、可正常渲染）。
- 五周路径：第1周 N4 → 第2周 N3 → 第3周 N3→N2（乔布斯斯坦福演讲三段）→ 第4周 N2 语法（村上春树《高墙与鸡蛋》）→ 第5周 产出（写你自己的演讲）＋回顾与 N2 当日攻略。

### 来源原则 · Sourcing
- 前期（N4/N3）用**按语法点校准的原创短文**——这样课文用词正好覆盖当天该学的语法，可控且准确。
- 第 3–4 周引入**真实演讲**：史蒂夫·乔布斯 斯坦福演讲（三段故事）、村上春树《高墙与鸡蛋》——结构像文章、语气却口语化，正合你「把书面学到的用到口语」的目标。

---

## 页面 · Pages（顶部切换）

- **🏠 主页** — 个人面板：言霊宠物、继续学习、连续天数(streak)、30 天热力图、每日一句、今日任务、测试最佳分。
- **📖 每日** — 30 天课程（早/午/夜三段 + 抄写 + 🎤发音评估）。
- **📚 基础** — 五十音図、动词分组与变位、形容词、助词、助数词与特殊读音、日期读法、敬语速查、**全语法索引**（点击跳到对应天）、关西弁(大阪)入门。
- **🗺️ 场景** — 情景日语（医院/便利店/餐厅/健身房·钱汤/酒店/夜生活），真人配音对话 + 关键词 + 礼仪文化提示。
- **📝 测试 → N2 考试中心** — 考前指导、**模拟考**（真实结构 + JLPT 计分）、🎧听力练习、官方样题外链、**📕错题本**（自动收集错题 + 针对性复习）；下方还有 5 套限时周测。
- **🗣️ 产出** — 输出训练：造句阶梯、写段落、开口说（语音识别），Claude 批改（需 Key，离线有兜底）。
- **📓 笔记** — 智能笔记：Markdown、`[[wikilink]]`、关联课程、AI 问答存为笔记、随手速记本。
- 右下 **🤖 AI 助手** — 结合当前课文的 Claude 问答（BYOK）。右上 **⚙️ 设置** — 发音引擎(Azure key) / 声音模型 / 进度导出导入 / VOICEVOX / AI Key。多语言：中文 / English / 日本語。

## 🎤 发音评估 · Pronunciation check（每日「朝の朗読」内）

跟读一句 → 浏览器语音识别(ja-JP)对比你读出的内容 → 高亮哪里清晰、哪里可能不准 + 一致度评分。
**需要 Chrome**（用到 Web Speech Recognition），首次会请求麦克风权限。这是“识别准确度”的近似评估，不是音素级专业打分；要更深的评估可后续接入云端 AI（需 API key）。大阪方言见「基础总览 → 関西弁」。

## 🔊 真人音频 · Real-voice audio（VOICEVOX，可选）

默认系统 TTS（机械音）。换成**真人声优**音频（音高更准，直接服务“开口说”）：

```
# 1. 启动 VOICEVOX 引擎（默认 localhost:50021）  2. 安装 ffmpeg
python3 tools/gen_audio.py                  # 生成 audio/*.mp3 + manifest（课文/单词/例句/会话/五十音/参考例句/言霊开场白）
python3 tools/gen_audio.py --list-speakers  # 看可用声音 id
python3 tools/gen_audio.py --verify         # ★ 校验读音：手写振假名 vs UniDic，标出不一致
```

脚本**幂等**（已存在则跳过）。生成后用本地服务器打开，网页自动优先播放 MP3、缺文件回退 TTS；速度滑块对真人音频同样有效。**名句想用真人原声**：把同名 MP3（如 `audio/d17_s7.mp3`）放进 `audio/` 即可覆盖（key→路径不变，无需改 manifest）。

**读音校验**：`--verify` 用形态素分析器（fugashi + unidic-lite，`pip3 install --user fugashi unidic-lite`）独立检查每条振假名，结果写 `tools/verify_report.txt`。多数不一致是 UniDic 的书面默认音（私=わたくし、日本=にっぽん…）属正常，重点看真错。

### 多声音模型 · Voice picker（⚙ 设置 → 声音）
换不同声音朗读（标准 / 播音 / 性感 …）。每个声音生成到自己的文件夹，网页按路径前缀切换、缺文件回退标准音——**无需额外 manifest**。一次 `--voice-dir` 即生成该音色的**全套**（课文/单词/例句/五十音），所以**切换音色后整站发音都会变**（场景对话按角色固定配音，不跟随）：

```
python3 tools/gen_audio.py --voice-dir no7-anno   --speaker 30   # 播音风格
python3 tools/gen_audio.py --voice-dir metan-sexy --speaker 4    # 性感风格
# 想要更自然的声音：装 AivisSpeech（同款 API，端口 10101），同样生成即可：
VOICEVOX_URL=http://localhost:10101 python3 tools/gen_audio.py --voice-dir aivis --speaker <id>
```

生成后在 `audio/voices.js` 注册（含 `name / tag / desc / prefix`），刷新即可在 ⚙ 里选择。每个备选音色现含完整 `kana/` 与 `ex/`（约数百~千个 MP3）。

> **关于音频文件入库**：本项目部署在 **GitHub Pages**，而 Pages **不支持 Git LFS**（会把 LFS 指针文件原样返回 → 音频 404）。所以这些 MP3 **必须**放在普通 git 里（仓库会偏大，这是 Pages 部署的必要代价；不要迁到 LFS，否则线上音频会坏）。若日后改用支持 LFS 的托管或单独的静态资源 CDN，再考虑迁移。

### 🥚 言霊 宠物 / AI 助手与 API 额度
主页的 **言霊 宠物**（坚持学习它会成长）与右下角的 **AI 学习助手** 都用你自己的 Claude API Key（BYOK，仅存本机）。宠物的**日记 / 对话 / 学习后的一句话**各会发起一次便宜的 Claude(haiku) 调用；**练習(作文/场景)的 AI 出题与批改**也用同一个 Key。不填 Key 时全部回退到离线模板（仍可用，只是不那么丰富）。会消耗少量 API 额度，建议在 Anthropic 控制台设月度上限。

## 💾 进度备份 · Backup（⚙ 设置）

进度只存本机浏览器（清缓存会丢）。**导出进度 JSON** 备份；换机/清缓存后**导入**即可恢复（含每日完成、测试最佳分、连续天数）。

## ⚙️ 进阶发音评估 · Azure（可选）

⚙设置里填 Azure **Speech** 资源的 **Key + Region**（如 `japaneast`），即可获得**逐音素 + 流畅度 + 语调**评分（免费层每月 5 小时）。不填则用浏览器识别近似评估，二者无缝回退。SDK 默认 CDN 加载（需联网），离线可 vendored 到 `js/vendor/` 后改 `loadAzureSDK()` 路径。

## 文件结构

```
JPN/
├── index.html             # 入口；按 ?v=... 缓存版本加载所有 js/css
├── css/styles.css
├── js/
│   ├── lessons.js         # 30 天课程内容（课文/词汇/语法/对话/抄写…）
│   ├── reference.js       # 「基础」参考内容（9 个板块）
│   ├── gojuon.js          # 五十音図 + 练习
│   ├── scenarios.js / scenarios-adult.js   # 场景对话
│   ├── tests.js           # 5 套周测 + 题库（供模拟考抽题）
│   ├── listening.js       # 🎧 听力练习题（14 条，真人 VOICEVOX）
│   ├── exam.js            # N2 考试中心：指导 / 模拟考 / AI 出题 / 听力
│   ├── daily.js           # 每日一句
│   ├── produce.js         # 🗣️ 产出（造句/段落/说出来）
│   ├── notes.js           # 📓 智能笔记 + 速记本
│   ├── assistant.js       # 🤖 AI 学习助手（BYOK Claude）
│   ├── pet.js             # 🥚 言霊 学习宠物 + 言霊开场白
│   ├── i18n-en.js         # 全站英文内容（EN / EN_REF / EN_TESTS / EN_DAILY）
│   ├── i18n-ja.js         # 日文 UI 词条
│   └── app.js             # 主程序：渲染/音频/抄写/测试/发音评估/进度/设置/错题本/i18n
├── tools/gen_audio.py     # VOICEVOX 音频预生成 + 读音校验(--verify)
├── audio/                 # MP3 + manifest.js（脚本生成）；voices/ 为备选音色
├── docs/                  # API-KEY 指南、分析笔记
└── BUILD-TASKS*.md        # Review→Build 规格（历轮）
```

> 数据存哪：进度只在**本机浏览器 localStorage**（`jpn-*` 键），可在 ⚙ 导出/导入备份。错题本存 `jpn-wrong`，已并入备份。

想加内容？复制 `lessons.js` 里 Day 1 的对象结构，照着填即可。
汉字读音写法：`漢字[かんじ]`，假名（送り仮名）写在括号外，例如 `食[た]べる`。
**改了 js/css 后**：记得把 `index.html` 里的 `?v=YYYYMMDDzN` 版本号 +1（缓存刷新；线上同理）。
