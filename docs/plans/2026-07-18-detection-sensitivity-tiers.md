# 检测灵敏度三档化（宽松 / 标准 / 严格）

> 来源：`docs/ui-ux-copy-review.md` 2.3 遗留项。原建议二选一（反转标度 / 三档化），采纳推荐方案 (b) 三档 segmented control。
> 前提已满足：浏览器兼容性测试已由用户完成（2026-07-18）。

## 现状（与评审文档记录的偏差）

评审时存在的"灵敏度滑杆"已在简化重构中删除。当前无任何用户可调项：
- `app/page.tsx:41-42`：`DEFAULT_MIN_CONFIDENCE = 0.5`、`FALLBACK_MIN_CONFIDENCE = 0.3`
- `detectAndSetFaces`（`app/page.tsx:249`）：先按 0.5 检测，空结果自动降 0.3 重试一次

因此本任务是**新增**一个三档控件，把隐藏策略显式化，而非改造滑杆。

## 方案

### 档位映射

| 档位 | minConfidence | 空结果自动降档重试 |
|---|---|---|
| 宽松 relaxed | 0.3 | 无（已是最低） |
| 标准 standard（默认） | 0.5 | 保留现有 0.3 重试 |
| 严格 strict | 0.7 | 无（用户明确要更少检出，回退会违背意图） |

### 交互与 UI

- `page.tsx` 新增状态 `detectionMode: 'relaxed' | 'standard' | 'strict'`，默认 `'standard'`。
- 三档 segmented control：与现有 Duolingo 风格统一——圆角胶囊容器（参考 `IconButton`/`btn-ghost` 的白底描边风格），选中项高亮（蓝色 secondary 色系，不用绿色——绿色只留给下载 CTA）。
- 位置：与图标按钮行（撤销/重做/重新检测等）同区渲染，桌面右列与手机吸附工具栏两处复用同一段 JSX（与 `iconButtonsCompact` 同模式）。
- 切换档位立即触发一次重新检测（复用 `handleRedetect` 流程，含撤销 Toast 逻辑）。
- i18n：`lib/i18n/zh.ts` / `en.ts` 新增档位标签与 aria-label。

### 不做

- 不加连续滑杆、不加设置面板。
- 不改 `noFacesFound` 错误文案（另行观察是否需要提示"试试宽松档"）。
- 不持久化到 localStorage（未被要求）。

## 执行步骤

1. 类型与常量：`detectionMode` 类型、三档阈值映射 → verify: tsc
2. `detectAndSetFaces` 接受 mode，按上表决定阈值与是否降档重试 → verify: 单测（阈值映射逻辑）
3. Segmented control UI + 两处布局挂载 + 切换即重检 → verify: 浏览器实测
4. i18n 中英文案 → verify: 两语言下渲染
5. qa-runner 全量验证：tsc / lint / vitest + Chrome 移动视口实测三档切换

分派：实现 fast-worker → 验证 qa-runner。

---

## 实施说明（Implementation Notes，2026-07-18）

按计划完成，偏差与关键决定：

- 阈值/重试逻辑抽为纯函数模块 `lib/detectionMode.ts`（`getMinConfidence` / `shouldRetryOnEmpty` / `RETRY_MIN_CONFIDENCE`），配套 `lib/detectionMode.test.ts`；原 `DEFAULT_MIN_CONFIDENCE`/`FALLBACK_MIN_CONFIDENCE` 常量删除。
- 闭包问题解法：`handleRedetect` 增加可选参数 `modeOverride`，控件 onChange 里 `setDetectionMode(mode)` 后同 tick 调 `handleRedetect(mode)` 显式传新档位；图标按钮无参调用回退到 state。
- 控件实际挂载三处（比计划多一处）：中屏卡片、桌面右列、手机吸附工具栏。
- a11y：`role="radiogroup"` + `role="radio"` / `aria-checked`。

验证（qa-runner）：tsc / lint / vitest（5 文件 27 用例）全过；Chrome 实测三档切换即时重检（示例图 标准/宽松 8 脸、严格 7 脸）、暗色模式正常。**遗留**：手机视口实测时窗口只缩到 1223px 宽（未达 <768px 断点），吸附工具栏内控件的真实手机布局未被覆盖，建议真机或下次窄视口复核。

---

## 二次迭代（2026-07-18，用户反馈）

用户要求：① 灵敏度控件移到表情大小旁（上/下一行）；② 样式重设计，带动画；③ 表情大小也改三档。

方案：
- 新共享组件 `components/SegmentedControl.tsx`：胶囊轨道 + framer-motion `layoutId` 弹簧滑块（滑动动效），蓝色选中态，radiogroup a11y，暗色齐全。
- EmojiToolbar 内：表情大小行改为三档（小 0.9 / 标准 1.2 / 大 1.5，标准=原默认），下一行放检测灵敏度三档；原 range slider 与三处图标区的灵敏度控件全部移除。
- `MIN_EMOJI_SIZE`/`MAX_EMOJI_SIZE`/step 常量随 slider 删除；emojiSize 状态与历史 debounce 逻辑保留（换挡即一次离散变更，debounce 逻辑不受影响即可）。
- i18n 增加 小/标准/大 文案。

分派：实现 fast-worker → 验证 qa-runner（本次必须缩到 390×844 真手机断点复测吸附工具栏）。

### 二次迭代实施说明

- 新增 `components/SegmentedControl.tsx`：泛型受控分段控件，选中滑块为 `m.div` + `useId()` 派生的唯一 `layoutId`（弹簧 stiffness 500 / damping 35），radiogroup a11y，暗色齐全。
- `EmojiToolbar`：range slider 与 MIN/MAX_EMOJI_SIZE 删除，表情大小改三档（小 0.9 / 标准 1.2 / 大 1.5）；非档位的 emojiSize 值按最近档位高亮。下一行新增检测灵敏度三档，经新 props（detectionMode/onDetectionModeChange）由 page.tsx 传入。
- `page.tsx`：`detectionModeControl` 及三处挂载删除，改由两处 EmojiToolbar 实例承载；换挡仍走 `handleRedetect(mode)`。
- i18n：新增 小/标准/大（Small/Standard/Large）。
- 静态验证：tsc、vitest（27 用例）通过。**浏览器实测（含 390px 手机断点、动画效果、暗色）由用户自行完成**——通过前不视为 done。
