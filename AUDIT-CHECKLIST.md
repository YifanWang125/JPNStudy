# AUDIT-CHECKLIST — 发版前整站核查清单

> 用途：每次发版/给机构看之前，**照此跑一遍**，避免再出现"整体 review 却漏掉 ja bug"这种情况。
> 方法：四个维度可并行交给子 agent，最后 Review 自己跑一遍运行时 + 逐条复核 agent 的发现（**别只转述，要 grep/实跑确认**）。
> 教训：站点有 zh/en/ja 三语 + 6 备选音色 + 多模块（app/pet/notes/assistant/exercises/produce/gojuon/scenarios），**任何"加了新语言/新音色/新功能"都要回头检查老分支有没有同步**。

---

## 维度 1 · i18n 三语完整性（最易漏，优先）
对 **zh / en / ja 三种**都要实测，不能只测一种。
- [ ] grep 全 js：`LANG==="en"`、`window.LANG==="en"` —— 凡用于**用户可见文案**的，都应是 `LANG!=="zh"` 或走 `T()/zhen()`（否则 ja 落中文）。
- [ ] grep 各模块本地 `const T=` 定义：必须有 **ja 分支**（`if(L==="ja")…`）。
- [ ] grep 模板串里的**硬编码中文（CJK）**：是否都过了 `T()/zhen()`？重点查**设置弹窗、各设置/状态/alert/confirm、AI 助手面板、词典/索引、planned-day、FAB/标签/title**。
- [ ] 数据层：每个被渲染的字段是否有对应 En/JA 数据（`window.EN[day].*`、`JA_UI[…]`、`GLOSSARY.defEn`、`source/sourceEn`…）。缺数据=永远显示中文。
- [ ] **逐页实测**：home/daily(朝昼夜+練習)/general(五十音+参考表)/scenarios/test/produce/notes/设置/AI 面板/宠物——分别切 en 和 ja，肉眼扫一遍**有没有中文残留**（尤其表格、讲解、按钮、提示）。

## 维度 2 · 音频（跟随音色 + 不静音）
- [ ] grep 所有 `speakSequence(`/`speak(`/`playOne`/`audioKey`。每个：带 `audioKey` 且在 `manifest.json` 里 → 跟随音色 ✓；无 key → 走 `fallbackSpeak`，而 **TTS 默认关 → 静音**（动态文本应在 TTS 关时隐藏🔊，静态内容应预生成+加 key）。
- [ ] manifest 覆盖：代码构造的 key（`d#_s#`/`v_`/`x_`/`kana_`/`scn_`）是否都在 manifest？
- [ ] **备选音色齐不齐**：`audio/voices/<id>/` 的 paragraph/vocab/ex/kana 数量是否与默认一致（新增内容后常漏生成 → 回退默认音色，音色不一致）。
- [ ] 设计豁免：scenarios(`scn_/scna_`) 与宠物 intro(`intro_all`) 是**固定音色**，不跟随全局——确认仍如此。

## 维度 3 · 各模块逻辑 / 状态 / 安全(XSS)
- [ ] **XSS**：任何 AI/用户/导入文本进 `innerHTML`——文本上下文用 `esc()` OK；**属性上下文**（`x="${…}"`）必须用 escAttr（esc 不转义引号！）。重点：notes 标题/正文/wikilink、名字、AI `data-t`、导入数据。
- [ ] 状态机：定时器/interval 在离开页/退出时清掉了吗（测试计时器！）；BUSY/锁在 try/catch/finally 都复位；object URL 有 revoke；re-render 不重复绑事件/不丢状态。
- [ ] 异步竞态：发音/AI/录音的回调在用户切换上下文后，是否还写回**正确**的目标（key 应在开始时固定）。
- [ ] 宠物：成长 XP 是否真**单调不可刷**；阶段**只升不降**；离线衰减有上限；死亡需持续疏忽而非偶发。
- [ ] 数据流闭环：新练习/新得分是否真的喂进它该喂的地方（如 produce → pet XP）。
- [ ] 测试引擎：选项乱序与答案索引对应；最佳分仅在更高时覆盖；交卷/退出/超时都清场。
- [ ] 导入/导出：校验、确认、覆盖语义是否与文案一致。

## 维度 4 · 内容准确性（日/中/英）
- [ ] 新增/改动的内容（新课、新场景、produce/每日一句、五十音例词）：振假名读音、语法讲解、中文、英文逐条核对（读音是作者弱项，错误危害最大）。
- [ ] 例词要体现该假名/该语法点（如 五十音「ら」例词须含 ら）。
- [ ] 词性(pos)/拆解(parts) 标注正确（自他动词等）。
- [ ] 既有 30 天已多轮核过；本项主要针对**本次新增/改动**，老内容抽查即可。

## 维度 5 · 运行时 / 跨端（Review 自己跑）
- [ ] 预览实跑：所有页 × zh/en/ja，**0 console 报错**。
- [ ] 关键交互：测试整套流程、导出后清缓存再导入、主题切换、音色切换（确认 kana/例句也变）、宠物养成、发音模块、produce 三drill、notes 增删。
- [ ] 响应式：桌面 1280×800 与手机 375×812——首屏「继续学习」可见、无遮挡、不溢出。
- [ ] file:// 与 localhost 两种打开方式（发音/麦克风需 localhost）。

---

## 输出规范
- 每条发现：**file:line + 问题 + 影响 + 修法**；只报真问题（保守），并列出"已复核正确"项给信心。
- 汇总进 `BUILD-TASKS-R*.md` 交 build；标注**给机构演示的"必修最小集"**。
- Review **必须自己 grep/实跑复核** agent 的每条 headline，不能只转述。
