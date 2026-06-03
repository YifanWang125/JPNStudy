# 如何获取并配置 Claude API Key（AI 学习助手）

AI 学习助手用的是你**自己的** Anthropic (Claude) API Key。Key 只保存在你这台电脑的浏览器里，直接发往 Anthropic，不经过任何中间服务器。下面 5 步搞定。

> 费用：按用量付费，问答很便宜（一次问答通常不到 1 美分）。建议给 Key 设个每月上限（见第 4 步），用着安心。

---

## 步骤

### 1. 注册 / 登录
打开 **https://console.anthropic.com/** ，用邮箱或 Google 账号注册并登录。

### 2. 充值一点额度（首次）
- 左侧菜单进入 **Billing（账单）** → **Add credits / 充值**。
- 最低约 **$5** 即可。这是预付额度，按实际用量扣，问答几乎用不完。
- （如果看到要先验证手机号或绑卡，照做即可。）

### 3. 创建 API Key
- 左侧进入 **API Keys**（或 **Settings → API Keys**）。
- 点 **Create Key**，起个名字，比如 `jpn-study`。
- 创建后点 **Copy** 复制。Key 形如 `sk-ant-api03-xxxxxxxx...`
- ⚠️ **这串 Key 只完整显示这一次**，复制好再关窗口。如果忘了，删掉重建一个即可。

### 4. （强烈建议）设个消费上限
- 在 **Billing → Usage limits / Limits** 里，设一个 **Monthly spend limit（每月上限）**，比如 **$5**。
- 这样即使误操作也不会超支。

### 5. 填进学习网站
- 打开学习网站，点右上角 **⚙️ 设置**。
- 找到 **🤖 AI 学习助手（Claude）** 一节。
- 把 Key 粘进 **API Key** 输入框。
- **模型**默认用 `Sonnet 4.6`（性价比最高，适合做老师）。也可选更快更省的 `Haiku 4.5` 或最强的 `Opus 4.8`。
- 点 **保存**。

完成！回到任意页面，点右下角的 **🤖**（可拖动）就能开始提问了。

---

## 常见问题

**Q：安全吗？Key 会泄露吗？**
A：Key 只存在你本机浏览器的 localStorage，请求直接发给 Anthropic 官方接口。只要不把电脑/浏览器借给别人、不导出分享，就只有你能用。设了消费上限更稳妥。

**Q：提示「model not found / 模型不存在」？**
A：模型名可能更新了。去 https://platform.claude.com/docs/en/docs/about-claude/models/overview 查最新模型 ID，在 ⚙ 里把模型名改对即可（当前：`claude-opus-4-8` / `claude-sonnet-4-6` / `claude-haiku-4-5`）。

**Q：提示 401 / authentication error？**
A：Key 复制错了或被删了，重新创建一个再粘贴。

**Q：提示 429 / rate limit 或 credit balance？**
A：额度用完或触发频率限制，去 Billing 充值 / 查看用量。

**Q：换电脑后助手不能用了？**
A：Key 不随进度导出。换机后在新电脑的 ⚙ 里重新填一次即可。

---

## 助手能做什么
- 结合你**当前所在那一课**的课文、单词、语法来回答；
- 跨课对比你学过的语法点，并标注它**最早出现在第几天**（点 `Day N` 可跳回原文）；
- 支持打字或语音提问、朗读答案里的日语；
- 一键把问答**存为笔记**，自动关联到当前课程。

范围限定在「日语学习」。无关问题它会礼貌地把你带回学习。
