# UI / UX / 文案 评审建议

> 2026-07-05 · 与 [optimization-plan.md](./optimization-plan.md) 配套的界面与文案专项评审。
> 优先级：⭐⭐⭐ = 投入小、感知强，建议最先做；⭐⭐ = 值得排期；⭐ = 有余力再做。
>
> **实施状态（2026-07-18 更新）**：
> ✅ 已完成 — 1.1 字体、1.2 暗色标题、1.4 按钮三级体系（btn-primary/secondary/ghost，绿色只留给下载；随机按钮保留粉色作为刻意的趣味例外）、1.5 reduced-motion（MotionConfig + CSS）+ ProcessingOverlay 动画精简（只保留扫描光条，去掉旋转放大 emoji 与三跳点）、2.1 点脸引导、2.2 破坏性操作改为「撤销」Toast（重置/重新检测均可一键恢复）、2.3 的 % 单位部分（灵敏度/透明度改整数百分比显示）、2.4 导出成功提示 + 示例图按钮（`public/sample-group.jpg`，NASA 公有领域素材）、2.5 的 Toast 图标/aria-live/role=alert + 全窗口拖拽上传 + Inspector padding 改实测高度 + badge 密集态收缩、3.2 文案对照表全部、3.3 副标题与徽章流式布局（含 1.3）、3.4 lang/metadata。
> ⬜ 待做 — 2.3 灵敏度标度反转/三档化（等真机验证 MediaPipe 置信度手感后再调）。

---

## 一、UI 视觉

### 1.1 全局字体是衬线体，与产品气质冲突 ⭐⭐⭐

- **位置**：[app/globals.css](../app/globals.css)（`--font-sans` 与 `body` 均为 `ui-serif, Georgia, ...`）
- **问题**：中文回退到宋体。Duolingo 风格（圆角、渐变、emoji、font-black 粗体）配粗体宋体非常违和。`.numeric-display` 类本质是给这个决定打补丁——十几处手动强制数字用无衬线。
- **建议**：全局字体栈改为 `system-ui, -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif`，随后删除所有 `numeric-display` 补丁类（保留 `tabular-nums` 可并入全局或按需保留一个精简类）。

### 1.2 暗色模式下主标题几乎不可见（实际是 bug）⭐⭐⭐

- **位置**：[app/globals.css](../app/globals.css) `.dark .shimmer-text`
- **问题**：项目暗色模式基于 `prefers-color-scheme` 媒体查询，从未给 html 添加 `.dark` class，因此 `.dark .shimmer-text` 永远不生效。暗色模式下「カオナシ」标题以深灰渐变（#1f2937）压在深色背景上，近乎不可见。
- **建议**：将该规则改写为 `@media (prefers-color-scheme: dark) { .shimmer-text { ... } }`。

### 1.3 隐私徽章窄屏溢出 ⭐⭐

- **位置**：[app/page.tsx](../app/page.tsx)（`absolute -top-0 -right-20` 的「🔒 本地处理」徽章）
- **问题**：≤360px 视口下徽章顶出屏幕。
- **建议**：改为标题下方的流式元素，与 3.3（副标题）合并处理。

### 1.4 按钮体系收敛为三级 ⭐⭐

- **问题**：主操作区、状态卡（重检/新图）、Inspector 三组按钮各自配色，语义冲突——主操作区绿色=全部替换，Inspector 绿色=设为默认；最重要的「下载图片」反而是黄色。
- **建议**：基于现有 `gradient-action` 定义 primary / secondary / ghost 三级：
  - **绿色 primary 全站唯一，只给「下载图片」**（最终 CTA）；
  - 全部替换 → 蓝色 secondary；重置/恢复默认/完成 → ghost；
  - Inspector 四按钮同规则映射。

### 1.5 动画降噪 + prefers-reduced-motion ⭐⭐

- [components/ProcessingOverlay.tsx](../components/ProcessingOverlay.tsx) 同时存在旋转放大 emoji、扫描光条、三跳点三种 loading 隐喻 → 保留扫描条一种；
- 全站未处理 `prefers-reduced-motion`（16s 无限 shimmer、常转 ⚙️、各处 spring）→ 根节点包 `<MotionConfig reducedMotion="user">` 一行解决，CSS 动画补 `@media (prefers-reduced-motion: reduce)`。

---

## 二、UX 交互

### 2.1 未选表情时点人脸零反馈（最大交互盲区）⭐⭐⭐

- **位置**：[app/page.tsx](../app/page.tsx) `handleFaceClick` 首行 `if (!selectedEmoji) return;`
- **问题**：新用户最自然的第一动作是点脸，当前无任何响应。
- **建议**：最低限度 toast「👇 先在下方选个表情」；推荐方案：点脸直接展开 emoji 选择器，选中后自动应用到刚点的脸（两步并一步）。

### 2.2 重检 / 重置是破坏性操作，无确认无撤销 ⭐⭐⭐

- **问题**：「重新检测」会清空全部替换与逐脸微调；「重置」同理。用户长时间编辑成果可能一键蒸发。
- **建议**：撤销/重做（roadmap Phase 2）落地前，先给这两处加确认，或 toast 携带「撤销」按钮（保留上一份 replacements 快照即可）。

### 2.3 灵敏度滑杆语义反转 ⭐⭐

- **问题**：数值越大检出越少，label 却是「检测灵敏度」；空结果错误提示说「降低灵敏度」——名称、数值方向、%单位（见 optimization-plan 1.5）、提示文案四者互相矛盾。
- **建议**：二选一——(a) 反转标度，让「灵敏度高 = 检出多」；(b) 简化为「宽松 / 标准 / 严格」三档 segmented control（推荐，目标用户不需要 0.01 精度）。

### 2.4 关键节点缺反馈 ⭐⭐

- 导出成功无提示（大图 toBlob 有延迟，用户怀疑没点到）→ 加「✅ 已保存到下载」toast；
- 首屏（未上传时）第一个元素是对新用户无意义的高级设置面板 → 上传前隐藏/收起，替换为「🖼️ 试试示例图」按钮（roadmap 已有 example images 条目，这是零门槛体验最短路径）。

### 2.5 其他 ⭐

- 全窗口拖拽上传：目前仅上传框接受 drop；有图状态拖入新图应直接替换；
- Inspector 打开时 `paddingBottom: '18rem'` 硬编码，小屏上面板实际高度可能超出，遮挡画布底部人脸 → 用面板实测高度或 `env(safe-area-inset-bottom)` + max-height 方案；
- 人脸密集时 Face badge 相互重叠 → 默认缩为小圆点，hover/激活展开；
- Toast 图标固定为旋转 ⚙️，与「✅/❌」类消息不符 → 图标随消息类型切换（与 optimization-plan 4.4 同项）；
- 无障碍：Toast 加 `aria-live="polite"`，错误卡片加 `role="alert"`（canvas 键盘等价物由 badge 按钮部分覆盖，2.1 修复后闭环）。

---

## 三、文案

### 3.1 语气原则 ⭐⭐⭐

现状在「拟人卖萌」（正在瘦身图片 / 检测器上线啦）与「工程术语」（正在唤醒 Tiny 模型）之间摇摆。建议定死三条：

1. 状态提示可以萌；
2. **错误提示必须给下一步动作**；
3. 永远不对用户暴露模型名（Tiny / SSD / MobileNet）。

### 3.2 具体改法对照表

| 位置 | 现文案 | 问题 | 建议 |
|---|---|---|---|
| page.tsx toast | ⏳ 正在唤醒 Tiny 模型 | 暴露模型名 | ⏳ 正在加载极速模式 |
| page.tsx toast | ✅ 检测器上线啦 | 无上下文 | ✅ 极速模式就绪 |
| page.tsx error | 😵 检测没成功，重试看看？ | 无行动指引 | 😵 检测出错了，点「重新检测」再试一次 |
| page.tsx error | 模型加载失败，请刷新页面重试 | 缺原因 | 追加「或检查网络连接」 |
| 状态卡按钮 | 重检 / 新图 | 过度缩写 | 重新检测 / 换一张 |
| EmojiInspector | Face 1（label） | 中英混用 | 第 1 张脸 |
| Footer | © 2025 All rights reserved. | 年份写死已过期 | `new Date().getFullYear()` |

「🙈 没找到人脸，试试降低灵敏度」方向正确（有指引），但需等 2.3 理顺灵敏度语义后再定措辞。

### 3.3 价值主张缺位 ⭐⭐⭐

- **问题**：标题只有「カオナシ」四个假名（中文用户未必识别），页面没有一句话说明产品是什么；隐私这个最强卖点只靠一枚 10px 徽章传达。
- **建议**：标题下加副标题一句话——

  > **用 Emoji 隐藏照片里的脸 —— 图片不会离开你的浏览器**

  同时把隐私徽章改为可流式排布的说明元素（与 1.3 合并）。

### 3.4 语言一致性 ⭐⭐

UI 全中文，但 `<html lang="en">`、metadata 英文、Inspector 用「Face N」。短期统一为中文（`lang="zh-CN"`、metadata 中文描述 + OpenGraph）；完整 i18n 维持在 roadmap（与 optimization-plan 4.4 同项）。

---

## 建议执行顺序

1. **一批极小改动先落地**（半天内）：1.1 字体 + 1.2 暗色标题 + 3.3 副标题 + 3.2 文案对照表 + 3.4 lang——全部是低风险高感知；
2. 2.1 点脸反馈 + 2.4 导出反馈/示例图；
3. 1.4 按钮三级体系（涉及面广，单独一个 PR）；
4. 2.2 破坏性操作确认（若撤销/重做即将开发可跳过，直接做撤销）；
5. 2.3 灵敏度三档化（涉及交互模型变化，建议先出一版简单原型验证）。
