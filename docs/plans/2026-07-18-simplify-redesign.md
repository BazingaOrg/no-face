# 2026-07-18 功能减法 + 布局改版方案

## 背景与目标

产品定位：本地运行、隐私安全的「emoji 遮脸」工具。核心链路 4 步：上传 → 自动检测 → 选 emoji → 下载。
现状约 4900 行源码中核心路径不足 1/3，复杂度集中在单脸精修（Inspector 簇约 800 行）。
目标：砍掉长尾配置、缩短用户路径、重排布局、统一动效，保住「简单、快、有趣、隐私」的初衷。

## 决策（已确认方向）

1. 删整个 EmojiInspector 抽屉；单脸只保留「点脸换 emoji」+「拖动微调位置」；emoji 大小改为全局滑块。
2. 删 SettingsPanel；检测不到脸时自动降阈值重试一次，用户无感。
3. 删 emoji-picker-react（3600+ 全库）；保留 110 精选 + 中文搜索 + 随机骰子。

## 执行步骤

### Phase 1 — 功能减法（fast-worker 实施，qa-runner 验证）

- [x] 1.1 删除 `EmojiInspector.tsx`、`useInspectorActions.ts`，及 `page.tsx` 中抽屉渲染、测高（ResizeObserver padding）、拖拽关闭逻辑
      → 验证：build 通过，无残留引用
- [x] 1.2 `FaceCanvas.tsx` 删除滚轮缩放、双指捏合逻辑；保留单指/鼠标拖动 emoji 微调位置（拖动结束 push 一次历史）
      → 验证：拖动仍可用，wheel/pinch 代码清除
- [x] 1.3 类型与状态清理：`replacements` 去掉 opacity/flipX/flipY/isCustom 等字段，保留 emoji、offsetX/offsetY；导出、渲染同步简化
      → 验证：vitest 通过（同步更新相关测试）
- [x] 1.4 新增全局「emoji 大小」滑块（0.8–1.6，默认 1.2），置于 EmojiSelector 区域内，改动实时作用于所有已替换脸（含导出）
      → 验证：调整后画布与导出结果一致
- [x] 1.5 删除 `SettingsPanel.tsx`；检测逻辑改为：默认阈值 0.5 检测到 0 张脸时，自动以 0.3 重试一次再报「未检测到」
      → 验证：低清多人图可检出；无脸图仍正确报错
- [x] 1.6 删除 emoji-picker-react 依赖与 EmojiSelector 中"完整表情库"折叠区；清理相关 i18n 文案
      → 验证：package.json 无该依赖，build 体积下降
- [x] 1.7 徽章简化：`useFaceBadgeLayout` 拥挤避让降级为简单标签/圆点（点击行为不变：点徽章=点脸）
      → 验证：多人脸图无重叠遮挡异常
- [x] 1.8 撤销/重做保留；push 点收敛为：点脸应用、全部替换、重置、重新检测、拖动结束、全局大小调整（防抖后）
      → 验证：Ctrl+Z 链路完整

### Phase 2 — 文案与提示（fast-worker）

- [x] 2.1 全部 Toast 缩短至单行（重点：带「撤销」按钮的 redetectCleared/resetCleared，及英文 modelLoadFailed/fileTooLarge/sampleLoadFailed）；zh/en 同步
- [x] 2.2 删除已移除功能的 i18n 键（inspector、settings、完整表情库、manyFaces 等）；清理引导文案，保持 4 态提示但更短
      → 验证：`tsc` 通过（en 类型对齐 zh shape）

### Phase 3 — 布局改版（deep-reasoner 出结构稿 → fast-worker 实施）

- [x] 3.1 状态驱动的单焦点布局：
      - 未上传：居中大上传卡（含示例图入口），header 精简
      - 处理中：画布骨架 + 处理遮罩
      - 编辑态：画布为主视觉；下方一条工具栏（emoji 精选行 + 大小滑块 + 搜索）；主操作收敛为「全部替换 ⚡」「下载 📥」两个主按钮，撤销/重做/重新检测/换一张降为图标按钮
- [x] 3.2 宽屏适配：编辑态取消 `max-w-3xl` 限制，画布可用高度放宽（如 `min(78vh, 900px)`）；≥1024px 时工具栏与画布左右分栏或底部吸附，iPad 横屏受益
- [x] 3.3 移动端：工具栏底部吸附（safe-area），按钮不换行堆叠；360px 宽验证
- [x] 3.4 动效统一：framer-motion spring 统一进出场/状态切换；保留标题 shimmer 与 logo 摇摆作为品牌记忆点；respect `prefers-reduced-motion`

### Phase 4 — 验证与收尾（qa-runner）

- [x] 4.1 `npm run lint` / `tsc` / `npm test` 全绿
- [x] 4.2 手动链路：上传→检测→点脸→全部替换→拖动微调→调大小→撤销→下载，PC/手机视口各一遍
- [x] 4.3 更新 README 功能描述

## 风险

- 删字段涉及导出重绘路径，需重点回归导出结果（分辨率、位置、大小）。
- 降阈值自动重试可能带来误检（把非脸识别为脸）；重试仅在 0 结果时触发，风险可控。
- 布局改版是最大不确定项，Phase 3 前先出结构稿确认。

## 实施记录（Implementation Notes）

*完成后补充。*

### 2026-07-18 Phase 1 + Phase 2 实施记录

**已删除文件**：`components/EmojiInspector.tsx`、`hooks/useInspectorActions.ts`、`components/SettingsPanel.tsx`；卸载 `emoji-picker-react` 依赖（`npm uninstall`，同步更新 `package.json`/`package-lock.json`）。

**核心改动**：
- `types/index.ts`：`EmojiReplacement` 精简为 `{ faceId, emoji, emojiUrl, offsetX?, offsetY? }`；移除 `EmojiSettings` 类型（全局大小改用普通 `number` 状态）。
- `lib/emojiRenderUtils.ts`：`drawEmojiReplacement` 签名改为接收独立的 `globalScale: number` 参数，不再读取 replacement 上的 scale/opacity/flipX/flipY；透明度与翻转的 canvas 变换代码一并移除。
- `components/FaceCanvas.tsx`：整体删除 wheel 缩放、双指捏合（pinch）逻辑及相关 ref/effect；保留单指拖拽微调位置，`onBeginDragReposition` 仍只在拖拽越过阈值时触发一次。新增 `emojiScale` prop 驱动渲染与命中测试。
- `hooks/useFaceBadgeLayout.ts`：移除 ResizeObserver 动态测量与徽章注册表，改为基于固定尺寸估算的简单定位函数；`getBadgeRefCallback` 一并删除。
- `components/EmojiSelector.tsx`：移除 `emoji-picker-react` 及"展开完整表情库"折叠区；新增全局 emoji 大小滑块（0.8–1.6，默认 1.2）。
- `app/page.tsx`：
  - 删除抽屉渲染、ResizeObserver 测高 padding、拖拽关闭逻辑、`handleInspectFace`；徽章点击（原齿轮入口）现在与点脸共用同一个 `handleFaceClick`。
  - 点脸即设为 `activeReplacementId`（原来仅微调面板打开时才设置），使"点脸换 emoji"与"拖动微调位置"在没有抽屉的情况下仍能衔接：点脸后画布上的 emoji 立即可拖拽调整。
  - 检测逻辑改为固定阈值 0.5，0 结果时自动以 0.3 重试一次；不再有可调的检测灵敏度状态。
  - 全局 emoji 大小滑块变化通过 400ms 防抖 push 一次历史（`handleEmojiSizeChange`）。
  - 历史 push 点收敛为：点脸应用、全部替换、重置、重新检测（有替换时）、拖动开始（悬空一次，等效于变更前快照）、全局大小防抖后。
- `lib/i18n/zh.ts` / `en.ts`：删除 `inspector`、`settings` 两个整块键，及 `emojiSelector.expandFull/collapseFull/fullPickerSearchPlaceholder`；新增 `emojiSelector.sizeLabel`；缩短全部 toast 文案（含 `resetCleared`/`redetectCleared`/`modelLoadFailed`/`fileTooLarge`/`sampleLoadFailed`/`detectionFailed`/`noFacesFound`），保留原有 emoji 前缀的轻松语气。`manyFaces` 仍在用（>50 张脸的性能提示），未删除。

**与计划的偏差及原因**：
1. 计划要求"拖动结束时 push 一次历史"，实际保留了代码库原有的"拖动开始时（越过阈值）push 一次"写法（`onBeginDragReposition`）。两者对 undo 语义等价（撤销回到变更前的快照），且是本仓库既有的 push-before-mutate 约定，未改动以保持风格一致。
2. `handleInspectFace` 未保留为独立函数，而是让徽章点击直接复用 `handleFaceClick`（同时应用/更新 emoji 并设置 `activeReplacementId`），避免出现两条分叉路径，符合 1.1 的要求。
3. `useFaceBadgeLayout` 未完全内联进 `FaceCanvas`，仍保留为独立 hook（但已从"ResizeObserver 动态测量 + 拥挤避让"简化为"固定尺寸估算定位"），因为 `FaceCanvas` 已经很长，保留 hook 边界更清晰。

**验证结果**：`npm run lint`、`npx tsc --noEmit`、`npm test` 均通过（lint 仅剩 vendor `public/mediapipe/wasm/*.js` 中的既有告警/错误，与本次改动无关，改动前后数量一致：10 errors / 471 warnings）。

### 2026-07-18 Phase 3 实施记录

**新增文件**：
- `lib/motion.ts`：集中管理 4 个 spring token（`stateTransitionSpring`/`canvasEntranceSpring`/`mobileToolbarSpring`/`desktopColumnSpring`），供 `page.tsx`/`AppHeader`/`EmojiToolbar` 引用。
- `components/AppHeader.tsx`：两态 header（`compact` 分支）。非编辑态渲染原有大 logo + shimmer 标题 + 隐私徽章；编辑态折叠为 `h-14` 吸顶行（小 logo、`text-lg` 标题、桌面显示 🔒 图标 + title tooltip、语言切换内联）。用 `AnimatePresence mode="wait"` + `layout` 过渡两态切换。Logo 摇摆动画仍绑定在"未编辑态"分支的挂载时机（图片被清空返回空态时才会重新挂载并再摇一次），满足"仅在挂载/换图时触发一次"。
- `components/EmojiToolbar.tsx`：取代 `EmojiSelector.tsx`（已删除）。移除展开/收起 toggle 和"当前表情"展示卡；搜索框 + 骰子始终常驻；精选表情本身响应式切换布局——`<md` 时是 `overflow-x-auto snap-x` 横向滚动行（44px tile），`md+` 切回 `grid-cols-10` 网格；命中项加 `ring-2 ring-blue-400` 高亮。三处使用（移动端底部吸附栏、md 悬浮卡、桌面右栏）复用同一个组件实例，仅外层容器 class 不同。
- `components/IconButton.tsx`：40×40 图标按钮，强制 `aria-label`，`disabled:opacity-40`。
- `components/AppFooter.tsx`：编辑态且 `<md` 时 `hidden`（让位给底部吸附工具栏），其余情况渲染单行 `text-xs` 版权信息。

**page.tsx 改动**：
- 引入派生状态 `isEmpty = !image`、`isEditing = !!image && !isProcessing`（未新增 state，`isProcessing` 直接复用）驱动三态渲染，替换原先一连串 `{image && ...}` 条件堆叠。
- 提炼 `handleNewPhoto`（原先内联在按钮 `onClick` 里的一段重置逻辑），供 header 图标按钮和右栏图标按钮共用。
- 提炼 `iconButtons`/`progressText`/`primaryButtonsRow`/`primaryButtonsStack` 四个局部 JSX 常量，在移动端吸附栏、md 悬浮卡、桌面右栏之间复用，避免三处黏贴同一段按钮标记。
- 删除 `isEmojiPickerOpen` 状态及其全部读写点（不再需要抽屉展开/收起，`EmojiToolbar` 始终常驻）。
- 根容器 `min-h-screen` → `min-h-dvh`，去掉外层 `max-w-3xl` 和 `py-6 px-4`；宽度约束下放到各状态自己的容器（空态 `max-w-xl`、处理中/编辑态 `md:max-w-2xl`/`lg:max-w-6xl`）。
- `FaceCanvas` 的可用高度常量从 `min(70vh, 800px)` 调整为 `min(80vh, 900px)`（仅改常量，未动检测/渲染逻辑），配合处理态骨架块 `min(70vh, 820px)` 的高度预留，减少 CLS。

**与计划的偏差及原因**：
1. 计划称"仅工具栏与画布左右分栏或底部吸附"，实际按 medium 断点（768–1023px）额外做了第三种呈现——画布下方的流式卡片（`hidden md:flex lg:hidden`）。这是产品说明书 "## Breakpoints" 一节明确要求的第三态（"toolbar is a flowing card below canvas"），比 Phase 3.2 检查项本身写得更细，故据说明书实现，checklist 摘要未逐字复述。
2. 移动端图标按钮（撤销/重做/重新检测/清空/换一张）被放进了 `AppHeader` 的 `actions` prop，通过 `className="... lg:hidden"` 在 `<lg` 宽度渲染，桌面右栏另有一份 `hidden lg:flex` 的图标按钮。两处共享同一个 `iconButtons` JSX 常量（在 `page.tsx` 里定义一次），不是重复代码，只是各自套了一层可见性 class。
3. 桌面右栏的两个主按钮与移动/md 版本视觉不同（桌面下载按钮为 `w-full` 满宽 stack，移动/md 为并排 `flex-1`），因此拆成 `primaryButtonsRow`/`primaryButtonsStack` 两个常量而非强行合一，避免为了复用引入不必要的 `layout` prop 分支。
4. `hide-scrollbar` 是本次新增的一个小工具类（`app/globals.css` 的 `@layer utilities`），移动端精选表情横向滚动行需要隐藏滚动条，仓库里原先没有等价类。
5. `useFaceBadgeLayout`/`FaceCanvas` 内部拖拽与命中测试逻辑未触碰，仅改了一处可用高度的数值常量（`0.7×800` → `0.8×900`），因为说明书明确要求编辑态画布高度放宽到 `min(80vh, 900px)`。

**验证结果**：`npx tsc --noEmit`、`npx eslint` 对本次改动涉及的文件、`npm test`（4 files / 25 tests）均通过。未运行浏览器手动链路验证（留给 Phase 4 qa-runner）。

### 审查后清理

- `components/AppFooter.tsx`：接入 `useI18n`，"Made with ❤️ by" / "View Source" 改用既有的 `t.footer.madeBy` / `t.footer.viewSource`（字典文案与原硬编码文本一致，未改动字典内容）。
- `lib/i18n/zh.ts` / `en.ts`：删除未再被引用的废弃键 `emojiSelector.hintPickFirst/hintClickFace/hintDoneAdjust/hintContinue` 与 `actions.undo/redo/resetTitleDisabled`（均经 grep 确认无实际使用）。
- `utils/imageOptimization.ts`：删除未使用的 `formatFileSize` 导出函数，并同步移除 `imageOptimization.test.ts` 中对应的测试用例。
- `lib/twemoji.ts`：`preloadEmoji` 仅在本文件内部被 `preloadEmojiWithFallback` 调用，移除其 `export`，改为模块私有函数。
- `lib/emojiSearch.ts`：重写文件头注释，去掉对已移除的 `emoji-picker-react` 库的过时说明，改为解释本文件维护中文关键词表的原因。

## B档清理

- `app/page.tsx`：抽取窗口级拖拽上传逻辑到新文件 `hooks/useWindowFileDrop.ts`（纯搬迁，行为不变），page.tsx 内改为调用 `useWindowFileDrop(!isProcessing, handleWindowDroppedFile)`。合并 `primaryButtonsRow`/`primaryButtonsStack` 两个 JSX 常量为单个 `renderPrimaryButtons(layout: 'row' | 'stack')` 渲染函数，三处调用点分别传入对应 layout，onClick/disabled/label 逻辑不再重复。
- `components/FaceCanvas.tsx`：合并 `onFaceClick`/`onInspectFace` 两个 prop 为单一 `onFaceSelect`；徽章层渲染条件从依赖 `onInspectFace` 是否传入改为依赖 `faces.length > 0`。`app/page.tsx` 的 `FaceCanvas` 调用点同步改为只传 `onFaceSelect={handleFaceClick}`。
- `utils/imageOptimization.ts`：`OptimizedImage` 类型经 grep 核实后删除仅在构造处赋值、外部从未读取的字段 `originalImage`/`originalWidth`/`originalHeight`/`optimizedWidth`/`optimizedHeight`，只保留确实被外部读取的 `optimizedCanvas`/`scale`（与既有审查结论一致）。`optimizeImageForDetection` 构造处同步去掉这几个字段的赋值；未发现测试文件引用这些字段，无需改动测试。
- `lib/i18n/zh.ts` / `en.ts` / `components/EmojiToolbar.tsx`：i18n 命名空间 `emojiSelector` 重命名为 `emojiToolbar`，全仓库 grep 确认无其他引用点遗漏。

**验证结果**：`npm run lint`（0 个属于本次改动文件的 error/warning，481 个 problem 均在 `public/mediapipe/*`第三方文件内）、`npx tsc --noEmit`（无输出，通过）、`npm test`（4 files / 24 tests 全部通过）。

## UI 反馈修复（2026-07-18）

用户实测反馈 5 个问题，逐项修复：

1. **emoji 选中框被裁切**：`components/EmojiToolbar.tsx` 选中态 class 由 `ring-2 ring-blue-400` 改为 `ring-2 ring-inset ring-blue-400`。根因是 `ring-2` 默认在元素边框盒外侧描边，被横滑行 `overflow-x-auto` 和网格滚动容器在四边裁掉；`ring-inset` 把描边画在元素自身盒内，不受父容器 overflow 影响，无需改容器 padding。
2. **header 高度切换抖动**：`components/AppHeader.tsx` 去掉 `<AnimatePresence mode="wait">` 的 `mode="wait"`。根因是 `mode="wait"` 会先把旧态完全卸载（高度塌成 0）再挂载新态，导致外层 `m.div layout` 没有连续高度可插值，出现"塌陷再弹出"的两次跳变；去掉后两态交叉淡入淡出，`layout` 能平滑地在两个真实高度间做 spring 过渡。
3. **图标按钮辨识度差**：`components/IconButton.tsx` 新增可选 `label` prop（有则图标+`text-xs`短文案，尺寸随内容；无则保持原 40×40 纯图标）；`lib/i18n/zh.ts`/`en.ts` 的 `actions` 新增 `undoLabel/redoLabel/redetectLabel/resetLabel/newPhotoLabel`（zh: 撤销/重做/重新检测/清空/换一张，en: Undo/Redo/Redetect/Clear/New photo）；`app/page.tsx` 原先共用的 `iconButtons` 拆成 `iconButtonsCompact`（纯图标，供 `AppHeader` 的 `<lg` 行）与 `iconButtonsLabeled`（图标+文字，供桌面右栏），onClick/disabled 逻辑不变。
4. **随机骰子结果不可见**：`components/EmojiToolbar.tsx` 新增 `buttonRefs`（emoji→按钮元素的 Map ref）与按钮 `ref` 回调，配合一个以 `selectedEmoji` 为依赖的 `useEffect`，任何程序性选中变化（含骰子）都会把命中按钮 `scrollIntoView({block:'nearest', inline:'nearest', behavior})`，`prefers-reduced-motion` 时 `behavior` 用 `auto`，否则 `smooth`。
5. **重置动画闪烁**：排查 `handleReset` 只改 `replacements`/`activeReplacementId`，不影响 `image`/`isProcessing`/`faces`，因此 `isEditing`/`isEmpty`/`faces.length > 0` 系列条件在 reset 前后均不翻转；核对 `FaceCanvas.tsx` 徽章渲染 key 绑定的是稳定的 `face.id`（来自 `faces`，不随 `replacements` 变化），未发现任何因 `replacements` 归零而触发的 remount 或 key 翻转。结论：未发现独立于第 2 项之外的额外闪烁根因——第 2 项修复后，reset 不应再引起 header/布局的可见抖动（`progressText` 消失属于内容正常变化，非 bug）。

**验证结果**：`npm run lint`（0 个属于本次改动文件的 error/warning，vendor `public/mediapipe/*` 噪音照旧忽略）、`npx tsc --noEmit`（通过）、`npm test`（4 files / 24 tests 全部通过）。桌面视口（1440×900）浏览器实测：试选中网格首行/末行/左右边界共 3 个位置，选中框完整无裁切；连续点击骰子 7+ 次，每次随机结果都自动滚入可视区；应用 2 个替换后点击"清空"，header 与整体布局无抖动、无位移，控制台无 React key 警告；header 全态↔精简态切换观感为平滑高度过渡而非跳变；桌面右栏图标按钮确认显示"图标+短文字"（撤销/重做/重新检测/清空/换一张）。

## 两个 UI Bug 修复（2026-07-18）

### Bug 1：桌面右栏图标按钮换行/局促

**根因**：`components/IconButton.tsx` 有 `label` 时用 `flex-col gap-0.5 px-2 h-auto min-h-10 w-auto`——图标与文字纵向堆叠在一个窄盒子里，5 个按钮挤在一起导致换行/挤压。

**修改**：`components/IconButton.tsx` 第 38-45 行，`label` 分支改为横向 pill：`inline-flex items-center gap-1.5 px-3 h-10 whitespace-nowrap rounded-xl text-sm btn-duo btn-ghost disabled:opacity-40 disabled:cursor-not-allowed`；label 的 `<span>` 从纵向堆叠改为 `text-xs leading-none whitespace-nowrap`（父容器已是横向 flex，无需再纵向排列）。icon-only 分支未改动。容器 `app/page.tsx` 第 862 行 `flex flex-wrap gap-2` 保持不变，实测已足够宽松，未做调整。

### Bug 2：示例图/换图/重新检测时的闪烁与高度跳变

**根因**：
1. `app/page.tsx` 原先 `isEmpty`/`isProcessing`/`isEditing` 三态互斥，处理中态用固定 `min(70vh, 820px)` 骨架块占位，与真实画布高度不一致，切换时页面高度跳变。
2. `isEditing` 原为 `!!image && !isProcessing`——重新检测时 `image` 一直存在但 `isProcessing` 会短暂为 true，导致 `isEditing` 变 false 再变 true，整个编辑态 JSX（含 `FaceCanvas`）连带 `AppHeader` 的 `compact` 状态被卸载重挂载，产生画布闪烁 + header 精简↔完整来回跳。

**修改**（`app/page.tsx`）：
- 第 591-592 行：`isEditing` 改为只依赖 `!!image`（不再依赖 `!isProcessing`），使 header compact 状态和编辑态 JSX 在重新检测/换图过程中保持挂载不变，`FaceCanvas` 全程不卸载，只有全局 `ProcessingOverlay`（第 745-756 行，逻辑未改）盖在上面。
- 删除原本独立的"处理中骨架块"区块（原第 777-789 行，固定高度 `min(70vh,820px)` 的 `animate-pulse` 占位 div），改为编辑态区块（原 `isEditing &&`）统一渲染——已确认 `components/FaceCanvas.tsx` 在 `faces=[]` 时能正常渲染原图、无崩溃（第 439-441 行 `if (!image) return null`，`faces.length > 0` 才渲染徽章层），因此首次上传时也直接显示真实图片而非骨架块，天然贴合真实宽高比，无需额外计算 aspect-ratio。
- 未改动 `handleImageLoad`/`handleRedetect`/`handleNewPhoto` 等业务逻辑，也未新增 spring 常量（仍复用 `lib/motion.ts` 里已有的 `canvasEntranceSpring` 等）。

### 验证结果

- `npx tsc --noEmit`：无输出，通过。
- `npm run lint`：0 个属于本次改动文件（`components/IconButton.tsx`、`app/page.tsx`）的 error/warning；共 481 个 problem（10 errors / 471 warnings）均在 vendor `public/mediapipe/wasm/*.js` 内，与改动前一致，非本次引入。
- `npm test`：4 files / 24 tests 全部通过。
- 浏览器实测（Chrome，1440×900 桌面视口，`npm run dev` 本地端口 3001）：
  - a. 点击"试试示例图"：空态→编辑态一次性过渡，画布直接以真实图片展示（无骨架块），检测完成后显示"检测到 3 张人脸"及 3 个标注框，无闪烁、无高度跳变。**通过**。
  - b. 编辑态下点击"重新检测"：画布图片全程停留原位不消失、不重绘闪烁，header 保持精简态不切换，检测完成后重新出现 3 个标注框及右栏工具面板。**通过**（未单独测试"换一张"，但代码路径与 redetect 共用同一套 `showEditingLayout`/`isEditing` 判断，逻辑一致）。
  - c. 桌面右栏图标按钮（撤销/重做/重新检测/清空/换一张）：截图确认 5 个按钮均为单行图标+文字 pill，无换行、间距舒适。**通过**。
- 开发服务器已停止（`pkill -f "next dev"`，确认 3001 端口无残留 next 进程）。

**补充验证（换一张→再次上传示例图，即 编辑态→空态→编辑态 路径）**：此前只验证了空态→编辑态、以及编辑态内 redetect 原地刷新，未验证「点换一张回到空态，再重新进入编辑态」这条会真正经过 `isEmpty` 的路径。重启 dev server（端口 3000）后实测：编辑态点击"换一张"→干净回到空态上传卡（无卡顿）→再点击"试试示例图"→干净重新进入编辑态，画布立即显示图片，header 保持 compact，检测完成后 3 个人脸框正常出现，全程无闪烁/无高度跳变/无内容真空。**通过**。开发服务器已再次停止。

## 重新检测弹窗闪现修复 + header/footer 单态化（2026-07-18 第二次改版）

### Bug：重新检测时弹窗一闪而过 —— 根因排查

用临时 debug（`app/page.tsx` 里加一行渲染期 `console.log(modelLoadingState, isProcessing, processingMessage)`，验证完已移除）+ 浏览器 MutationObserver 监听 `fixed inset-0` 节点的挂载/卸载时间戳，实测确认：

- `handleRedetect`（`app/page.tsx`）**完全不调用** `ensureFaceDetectorReady()`/`initFaceDetector()`，且 `lib/faceDetectorClient.ts` 的 `initFaceDetector()` 用 `readyPromise` 做单例缓存、`workers/faceDetection.worker.ts` 的 `ensureInit()` 同样用 `initPromise` 缓存——worker 一旦首次初始化完成，之后不会再发送 `progress` 消息。因此整个重新检测过程中 `modelLoadingState.isLoading` 全程为 `false`，**`ModelLoadingModal` 从未在重新检测时显示过**，最初"模型加载弹窗残留判断"的假设被证伪。
- 真正在闪的是 `components/ProcessingOverlay.tsx`：`handleRedetect` 会 `setIsProcessing(true)` + `setProcessingMessage(t.processing.redetecting)`，触发 `AnimatePresence` 挂载这张白色卡片（图标+文案+扫描条），但重新检测在 worker/模型都已热身好的情况下经常在 100~150ms 内跑完——远小于它自己的入场 spring 动画时长，卡片来不及完整弹出/停留就被卸载，观感上就是用户描述的"弹窗一闪而过"。

### 修复

按用户给的允许范围（"遮罩本身淡入淡出可以接受，但不允许弹窗出现"）实施：新增 `hooks/useDelayedVisibility.ts`，把 `ProcessingOverlay` 的显示改成"延迟显示 + 最短可见时长"的门控：
- `active` 变 true 后要等 150ms 仍是 true 才真正显示（`handleRedetect` 这类经常在 150ms 内跑完的操作因此根本不会挂载这张卡片，从源头消除"弹窗闪现"）；
- 一旦真的显示了，至少保持 350ms 可见（避免卡在 150~350ms 区间的操作出现"跳出来又立刻消失"的另一种闪烁）。

`app/page.tsx` 改动：新增 `showProcessingOverlay = useDelayedVisibility(isProcessing && !!processingMessage)`，`AnimatePresence` 里原来的 `isProcessing && processingMessage` 条件改用这个门控值；`isProcessing`/`processingMessage` 本身的语义（禁用按钮等）不变。`ModelLoadingModal` 未做任何改动——排查已确认它不是这个 bug 的成因，不需要额外加"模型已就绪就不再显示"的守卫（`isLoading` 状态机本身已经保证了这一点）。

### header/footer 双态改单态

- `components/AppHeader.tsx`：整体重写，删除 `compact`/`actions` prop 和两态 `AnimatePresence`/`layout` 高度过渡逻辑；改为固定单行 `header`（`h-14`，logo 摇摆 + shimmer 标题 + 语言切换常驻），隐私徽章与 tagline 合并成一行 `text-[11px]` 小字（`sm:` 以上显示），在所有状态（空态/编辑态/处理中）下完全不变。
- `components/AppFooter.tsx`：删除 `hiddenOnMobile` prop，任何状态下都渲染，不再对移动端编辑态做 `hidden md:block`；保持原有单行极简样式（`mt-6 mb-4 text-center text-xs`），非 fixed，随文档流自然排在 `main` 之后（移动端编辑态若被底部吸附工具栏盖住，按用户要求不特殊处理）。
- `app/page.tsx`：`<AppHeader compact={isEditing} actions={...} />` → `<AppHeader />`；`<AppFooter hiddenOnMobile={isEditing} />` → `<AppFooter />`。因为 header 不再承载 `iconButtonsCompact`（原来通过 `actions` prop 塞进 `<lg` 宽度的 header 行），撤销/重做/重新检测/清空/换一张这组图标按钮改为直接放进：
  - md 断点（768–1023px）画布下方的悬浮卡（`hidden md:flex lg:hidden`）：新增一行 `iconButtonsCompact`，跟在主按钮下面，用 `border-t` 分隔；
  - 移动端（<768px）底部吸附工具栏：同样追加一行 `iconButtonsCompact`。
  桌面（≥1024px）右栏的 `iconButtonsLabeled` 未改动。这是本次为了不丢功能而做的必要功能性调整（不是纯视觉改动），因为原设计里这组按钮的唯一落脚点就是即将删除的 header 两态逻辑。
- `lib/motion.ts`：删除不再被引用的 `stateTransitionSpring`（原来只有旧版 `AppHeader` 用它做两态高度过渡）。
- 未删除任何 i18n 键：`header`/`footer`/`languageToggle` 命名空间下的键（title/privacyBadge/tagline/madeBy/viewSource/switchToLabel/aria 等）在新单态实现里全部仍被引用，zh/en 无需同步删除。
- 整体结构本就是 `min-h-dvh flex flex-col`（根容器）+ `<AppHeader/>` 置顶 + `<main className="flex-1 ...">` + `<AppFooter/>` 置底，符合要求，未改动。

### 验证结果

- `npx tsc --noEmit`：无输出，通过。
- `npx eslint app components hooks lib`：无输出，通过。
- `npm test`：4 files / 24 tests 全部通过。
- 浏览器实测（Chrome，`npm run dev`，端口 3001，用 MutationObserver 监听 `fixed` 节点 + 每 100ms 采样 `header` 的 `getBoundingClientRect()`）：
  - 试试示例图（空态→编辑态）：全程只采到 1 种 header rect（`{x:0,y:0,width:1512,height:56,...}`），无变化；`ModelLoadingModal`（`bg-black/50`）只在首次模型初始化时短暂出现一次（属预期首装载提示，非本次要修的 bug），`ProcessingOverlay`（`bg-black/30`）随检测耗时正常显示/消失。
  - 点击"重新检测"（两次，含 worker/模型已热身状态）：全程未出现 `bg-black/50`（`ModelLoadingModal`）节点，即① 的验收标准（无任何弹窗闪现）成立；`ProcessingOverlay` 在本机检测耗时较长（约 1~8 秒，实测环境无 GPU 加速、非用户生产机器）的情况下正常显示，`useDelayedVisibility` 的"150ms 不显示/最短 350ms"门控逻辑经代码走查确认对更快的场景生效（用户生产环境里典型的 100ms 级重新检测会被完全吞掉，不再挂载卡片）。
  - 点击"换一张"（触发文件选择）：header rect 同样全程只有 1 种取值，无位移。
  - 三条路径中 header 高度/位置全程保持 `{width:1512, height:56, top:0, left:0}` 不变，footer 全程可见于页面底部（"Made with ❤️ by @Bazinga · View Source · カオナシ · © 2026"）。
- 开发服务器已停止（`pkill -f "next dev"` + 释放 3001 端口）。

## 四项 UI 改进：右列去闪烁 / empty 态双向居中 / 主题切换 / SVG 图标体系（2026-07-18 第三次改版）

### 1. 重新检测右列刷新感 —— 根因与修复

**根因**：`app/page.tsx` 桌面右列、md 悬浮卡、移动端吸附栏三处容器都用 `{faces.length > 0 && <m.div initial={...}>}`（或 `AnimatePresence` 内同条件）控制挂载。`handleRedetect` 先 `setFaces([])` 再异步重新填充，中间这段 `faces.length` 为 0，导致三个容器被卸载再重新挂载，`initial` 入场动画（`opacity:0,x:16` 等）跟着重放，观感即"刷新/闪烁"。

**修复**：新增 `hasShownFaces` state（`app/page.tsx`），一旦 `faces.length > 0` 就置 `true`，只在 `handleImageLoad`（新图）和 `handleNewPhoto`（换一张回空态）里重置为 `false`。三处容器的挂载条件从 `faces.length > 0` 改为 `hasShownFaces`，使其只在真正的会话边界（新上传/换图）卸载重挂载，`handleRedetect` 期间 `faces` 归零→重新填充的过程不再触发容器级别的卸载/重挂载，入场动画不再重放；`progressText`、`EmojiToolbar` 的 props 更新仍正常反映最新数据。画布本身（`canvasEntranceSpring`）挂载条件是 `isEditing`（`!!image`），本就不随 `faces` 变化卸载，未改动。

### 2. empty 态双向居中

`app/page.tsx` 空态外层从 `flex-1 flex flex-col justify-center max-w-xl mx-auto px-4 w-full py-6 md:py-10`（`justify-center` 在 `flex-col` 里只管垂直，水平居中全靠 `mx-auto` 撑满宽度反而让"居中"名不副实）改为 `flex-1 flex items-center justify-center px-4`，内部再包一层 `max-w-xl w-full` 承载原有宽度限制，上传卡在 header/footer 之间实现真正的水平+垂直双向居中。编辑态布局核对后确认本就是"水平居中 + 顶部对齐"（`mx-auto` + 无 `items-center`），符合要求，未改动。

### 3. 主题切换（class 策略 + localStorage + 无闪烁）

- `app/globals.css`：新增 `@custom-variant dark (&:where(.dark, .dark *));`，让全仓库既有的 `dark:` utility 从跟随 `prefers-color-scheme` 改为响应 `<html>` 上的 `.dark` class；`--background`/`--foreground`、`.shimmer-text` 的深色取值改用 `:root.dark` 选择器驱动，同时保留原 `@media (prefers-color-scheme: dark)` 块作为无 JS 环境的兜底。
- 新增 `lib/theme.tsx`：`ThemeProvider`/`useTheme()`，显式选择存入 `localStorage`（key `no-face-theme`，值 `light`/`dark`）；未显式选择时跟随系统偏好并监听 `prefers-color-scheme` 变化实时更新；应用时 `document.documentElement.classList.toggle('dark', isDark)`。
- `app/layout.tsx`：`<head>` 内联同步脚本在 hydration/首次绘制前读取 localStorage/系统偏好并设置 `.dark` class，避免首屏闪烁；`<html>` 加 `suppressHydrationWarning`——因为这个 class 是内联脚本在 React 接管前写入 DOM 的，服务端渲染的 `<html>` 天然没有这个 class，此差异是预期行为而非 bug，React 默认会把它当"hydration mismatch"报错，需要显式抑制这一条警告（其余属性仍会正常校验）。
- `components/AppHeader.tsx`：右侧新增主题切换按钮（Sun/Moon 图标 + 切换时的小旋转过渡），置于语言切换按钮之前，两者视觉尺寸/风格统一（`w-9 h-9` 圆形）。

### 4. SVG 图标体系 + 按钮去 emoji 化

新增 `components/icons.tsx`：`Undo`/`Redo`/`Redetect`/`Clear`/`NewPhoto`/`Download`/`ApplyAll`/`Dice`/`Search`/`Sun`/`Moon`/`Upload` 12 个手写内联 SVG（stroke 风格、`round` linecap/linejoin、`currentColor`、默认 20px，均可传 `size`/`className`），未引入第三方图标库。替换点：
- `app/page.tsx`：`iconButtonsCompact`/`iconButtonsLabeled` 里的 ↩️↪️🔄♻️📤 → 对应 SVG；主按钮 `<span>⚡</span>`/`<span>📥</span>` → `<ApplyAll/>`/`<Download/>`。
- `components/EmojiToolbar.tsx`：骰子按钮 🎲 → `<Dice/>`（保留原 `whileHover rotate:180`）；搜索框新增前置 `<Search/>` 图标。
- `components/ImageUploader.tsx`：上传卡 📸 → `<Upload/>`（`text-gray-400 dark:text-gray-500`，与周围文案同色系，不抢视觉）。
- `lib/i18n/zh.ts`/`en.ts`：移除按钮类文案里嵌的 emoji 前缀——除首轮实施覆盖的 `redetect`/`newPhoto` 相关 label 外，复查发现 `uploader.sampleButton`（"🖼️ 试试示例图"/"🖼️ Try a sample photo"，是个真实可点击按钮）遗漏，本次一并补删，zh/en 同步。`toasts.*` 下的语气 emoji（如 `resetCleared: '♻️ 已清空'`、`redetectCleared`、`unsupportedFileType`）确认是 toast 文案而非按钮，按要求保留不动；`windowDrag.dropHint` 卡片里的 🖼️（`app/page.tsx` 第 761 行，纯展示用的拖拽提示图标，非按钮）也保留不动。
- 遮脸内容 emoji（Twemoji 渲染管线：`lib/twemoji.ts`/`lib/emojiImageCache.ts`/`lib/emojiRenderUtils.ts`）与 `EmojiToolbar` 精选表情网格本身（emoji 即产品内容，不是按钮装饰）未触碰。

### 验证结果

- `npx tsc --noEmit`：无输出，通过。
- `npm run lint`：0 个属于本次改动文件的 error/warning；481 个既有 problem 全部在 vendor `public/mediapipe/wasm/*.js`，与本次改动无关。
- `npm test`：未见新增/回归失败（未改动检测/替换/导出逻辑相关测试文件）。
- 浏览器实测（Chrome MCP，`npm run dev`，端口自动降级到 3001）：
  - **①明暗切换**：点击 header 太阳/月亮按钮，页面背景、header、上传卡、按钮等全部 `dark:` 样式即时切换（截图对比见下），刷新页面后主题保持（localStorage 生效），首帧未见明显白屏闪烁（内联脚本先于 hydration 设置好 class）。**通过**。
  - **②empty 态双向居中**：截图确认上传卡在 header 下方到 footer 上方的空间里水平、垂直均居中。**通过**。
  - **③按钮 SVG 图标**：截图确认上传卡图标、header 主题切换图标均为线性 SVG，非 emoji；grep 全仓库确认 `iconButtonsCompact/Labeled`、主按钮、骰子按钮、`sampleButton` 文案均无残留 emoji 字符。**通过**。
  - **④右列刷新感（redetect）**：补测通过 `public/sample-group.jpg`（页面"试试示例图"按钮，3 张真实人脸的样例图）——加载后检测到 3 张人脸，连续点击"重新检测"2 次，逐次截图对比：右列容器（进度文本、搜索/骰子、表情网格、大小滑块、主按钮、图标按钮行）位置与内容在检测前后像素级一致，未观察到卸载/重挂载或入场动画重放，控制台无报错。**通过**。
  - 排查中发现一处独立于本次 4 项任务、由自动化浏览器环境触发的现象：首次进入页面时 `ImageUploader` 的入场动画（`initial={{opacity:0,y:20}}`）偶尔长时间停留在半透明状态未过渡到 `opacity:1`（补测中交互几次后即恢复正常不透明度），怀疑与自动化 Chrome 报告 `prefers-reduced-motion` 或首帧渲染时序有关；该动画代码本次未改动（仅替换了内部 emoji 图标），不在 4 项任务范围内，供后续排查参考，未确认是否影响真实用户浏览器。
- `npm test`：补跑确认 4 files / 24 tests 全部通过，无因本次 i18n 键改动导致的用例失败。
- 开发服务器已停止（`kill` 释放 3001 端口）。

### 遗留的非本次任务改动

`git status` 显示仓库里还存在一批与本次 4 项任务无关、在本次会话开始前就已在工作区的未提交改动（如 `README.md`、`next.config.ts`、`package.json`、`types/index.ts`、已删除的 `components/EmojiInspector.tsx`/`EmojiSelector.tsx`/`SettingsPanel.tsx`、`hooks/useInspectorActions.ts` 等），推测是更早会话的未提交 WIP。本次未触碰、未清理这些文件，仅在其基础上按 diff 增量修改了本次任务涉及的文件。

## 复测 3 项修复（2026-07-18 第四次改版）

### 1. 骰子按钮图标未居中 —— 根因与修复

**根因**：`components/EmojiToolbar.tsx` 的骰子按钮和全仓库所有 `.btn-duo`/`gradient-action`（`app/globals.css`）按钮共用同一套"3D 押下"效果：`border-b-4 ... active:border-b-0 active:mt-1`。在 `box-sizing: border-box` 下，只加粗底边框会把 flex 内容区往上挤——44px 高的盒子里，`border-bottom` 单独吃掉 4px，内容居中基准点相对盒子视觉中心整体上移 2px。骰子按钮是纯图标、无文字打底的正方形按钮，这 2px 偏移在视觉上最明显（其余 `btn-duo` 按钮多数带文字，基线对齐掩盖了同样的偏移，未被单独反馈）。

**修复**：仅改动骰子按钮（`components/EmojiToolbar.tsx` 第 76 行），把布局意义上的 `border-b-4`/`active:mt-1` 换成不参与盒模型的 `box-shadow` + `transform`：`shadow-[0_4px_0_0_#e11d48] active:shadow-none active:translate-y-1`。阴影/位移都发生在合成层，不占用盒子空间，flex 内容区高度恢复对称，图标真正居中；按下时的"位移"效果通过 `translate-y-1`（transform）保留，视觉上与原来的 `active:mt-1`（margin，影响布局）几乎一致，但不再触发重排。未改动 `app/globals.css` 里 `.btn-duo`/`gradient-action` 共享类——它们用于图标+文字组合按钮，同样的 2px 偏移在这类按钮上不构成可感知问题，属于"只动被明确反馈的那个按钮，不做未被要求的大范围重构"的克制选择；已用浏览器 zoom 截图核对 40×40 的 `IconButton`（撤销/重做等）图标视觉居中可接受，未发现需要一并处理的连带问题。

### 2. 重新检测右列仍刷新/抖动 —— 复测发现的真实根因（区别于上一轮的 hasShownFaces 修复）

上一轮已经把右列三个容器的挂载条件从 `faces.length > 0` 改成 `hasShownFaces`，解决了"容器整体卸载重挂载、入场动画重放"的问题。但复测发现容器不再卸载之后，**容器内部的 `progressText` 本身仍然会消失一瞬**：`app/page.tsx` 里 `progressText` 变量的判断条件当时仍是 `faces.length > 0 && (...)`（对，这行没有跟着上一轮的修复一起改）。`handleRedetect` 会先 `setFaces([])` 再异步重新检测，这段时间里 `faces.length` 为 0，导致 `progressText` 从"检测到 N 张人脸"整块变成 `false`（不渲染任何 DOM），容器高度瞬间收缩，下方的 `EmojiToolbar`/滑块/主按钮/图标按钮行跟着整体上移，检测完成后 `progressText` 重新出现、下方内容再弹回原位——这一"消失再出现"就是复测反馈的"刷新/抖动"。

**修复**（`app/page.tsx`）：
- 新增 `lastFaceCountRef`（`useRef(0)`），配合一个依赖 `faces` 的 `useEffect`：只要 `faces.length > 0` 就把当前值记入 ref，这样 redetect 期间 `faces` 归零时 ref 仍保留上一次的有效计数。
- `progressText` 的挂载条件从 `faces.length > 0 &&` 改为 `hasShownFaces &&`（与右列容器本身的挂载条件一致，语义对齐：整个进度信息块只在"这个编辑会话已经展示过人脸"的前提下常驻）；文案里原来直接读 `faces.length` 的地方改读 `displayedFaceCount = faces.length > 0 ? faces.length : lastFaceCountRef.current`，redetect 期间画面上的数字保持上一次的检出数不跳动，检测完成后无缝更新为新结果（结果不同才会看到数字变化，属于允许的"数据文本更新"，不是"位移/闪烁"）。
- `lastFaceCountRef.current` 在 `handleImageLoad`（新图上传）和 `handleNewPhoto`（换一张回空态）里显式重置为 0，避免下一张图片检测出来之前，短暂显示上一张图的残留计数。
- `replacements.length > 0 && (...)` 那一行（"已全部替换"/"已替换 x/y"）未改动：它在 redetect 完成后会真实归零（redetect 本身清空 replacements），这是"一次性、单方向"的内容消失，不是反复横跳的闪烁，符合"数据文本更新允许"的范围，不属于本次要修的抖动。

未改动检测/替换/导出逻辑，未改动 `disabled` 态样式（复查 `app/globals.css` 的 `disabled:opacity-40`/`disabled:cursor-not-allowed`，只改透明度和光标，不改任何影响布局的尺寸/内外边距属性，确认不构成抖动来源）。

### 3. 首次「试试示例图」两个弹窗接力闪现 —— 合并为统一 LoadingOverlay

**根因**：`app/page.tsx` 原来同时挂载 `ModelLoadingModal`（模型加载中显示，`bg-black/50`）和 `ProcessingOverlay`（人脸检测中显示，`bg-black/30`，已有 `useDelayedVisibility` 门控）两个独立组件。首次冷启动时序是：模型开始加载→`ModelLoadingModal` 挂载→模型加载完成→`ModelLoadingModal` 卸载→紧接着检测开始→`ProcessingOverlay`（门控后）挂载。本地缓存热（WASM/模型走了浏览器缓存）时，模型加载阶段可能只有几百毫秒，"卸载一个模态、挂载另一个模态"这两次独立的 `AnimatePresence` 进出场动画来不及让用户看清内容就分别播完，观感是"两个弹窗接力闪一下"。`ModelLoadingModal` 本身也没有 `useDelayedVisibility` 门控（只有 `ProcessingOverlay` 有），这是两者观感不一致的另一个诱因。

**修复**：
- 新增 `components/LoadingOverlay.tsx`，替代 `ModelLoadingModal.tsx` + `ProcessingOverlay.tsx`（两个旧文件已删除）。视觉结构沿用 `ProcessingOverlay` 的卡片（图标 + 标题 + 提示行 + 底部扫描条），标题/提示/图标改为 props 传入，且都以内容值本身做 `key`，值变化时走小幅 crossfade（`opacity`+`y` 过渡），不是整卡片重新挂载。
- `app/page.tsx` 新增 `overlayActive = modelLoadingState.isLoading || (isProcessing && !!processingMessage)`，用同一个 `useDelayedVisibility(overlayActive, 150, 500)` 统一门控——模型加载和检测两个阶段现在共享一次"进"与一次"出"，阶段切换时 `overlayActive` 全程为 `true`（模型阶段结束、检测阶段开始之间没有 false 的间隙），因此只走一次挂载，中途只是 `LoadingOverlay` 的图标/文案 key 切换做 crossfade，不会重新触发整卡片的入场动画，也不存在"卸载再挂载"。
- 内容判断：`modelLoadingState.isLoading` 为真时显示 🧠 + `t.modelLoading.title` + 当前阶段（`phaseWasm`/`phaseModel`，无阶段信息时退回 `t.modelLoading.subtitle`）+ `t.modelLoading.tip`；否则显示 🔍 + `processingMessage` + 对应 `hint`（沿用原 `ProcessingOverlay` 的 hint 选择逻辑）。冷启动时两阶段的文案信息量与之前完全一致（阶段提示、tip 都还在），只是不再是两个独立弹窗。
- `useDelayedVisibility` 的 150ms 显示延迟 + 500ms 最短可见时长（比原先 `ProcessingOverlay` 单独使用的 350ms 略微调大，遵循任务里"最短停留 500ms"的要求）现在同时覆盖模型加载和检测两个阶段：热缓存下模型加载全程可能就十几毫秒，加上检测本身也常在 150ms 内完成，合并后的总耗时如果仍低于 150ms，则整个 overlay 完全不出现（不是"两个弹窗都不出现"而是"合并后的一次判断"，避免了之前"检测阶段单独判断出$"要不要显示"，模型阶段完全没有判断"的不一致）；冷启动模型真实下载耗时数秒，会正常触发显示，并在整个下载+检测期间保持挂载、只做阶段文案的 crossfade。
- 清理：`lib/faceDetectorClient.ts` 通过 `setFaceDetectorProgressCallback` 驱动 `modelLoadingState` 的机制未改动；grep 确认 `modelLoading.*`/`processing.*` 系列 i18n 键（zh/en）在新实现里全部仍被引用，没有产生废弃键，无需删除。

### 验证结果

- `npx tsc --noEmit`：无输出，通过。
- `npx next lint`：`✔ No ESLint warnings or errors`（vendor `public/mediapipe` 已被忽略配置排除，未见告警）。
- 浏览器实测（Chrome MCP，`npm run dev`，端口自动降级到 3001，样例图 `public/sample-group.jpg`，本机 WASM/模型走了浏览器缓存，属热路径）：
  - **①骰子图标居中**：`zoom` 截图核对骰子按钮，图标视觉居中，无上/左偏移。**通过**。
  - **②重新检测右列静止**：应用 3 个 emoji 替换后（右列出现"已全部替换 (3/3)"行），点击"重新检测"，前后两次全屏截图对比：搜索框/骰子/表情网格/大小滑块/主按钮/图标按钮行像素级同位置；顶部"检测到 3 张人脸"文案全程未消失（数字不变，因为重新检测结果仍是 3 张脸）；"已全部替换"行按预期一次性消失（replacements 被清空，非闪烁）。**通过**。
  - **③冷/热路径加载表现**：本机环境模型/WASM 已被浏览器缓存，实测路径等效于"热路径"——点击"试试示例图"后，直接一次性显示"检测到 3 张人脸"结果，两次连续截图之间未捕捉到任何独立的模型加载弹窗或检测遮罩，说明合并后的 `useDelayedVisibility(150ms/500ms)` 在热路径下正确地把整个加载表现完全吞掉，没有出现"弹窗一闪而过"。冷路径（真实下载模型，耗时数秒）依赖真实无缓存的浏览器环境未能在本次会话复现，但代码逻辑走查确认：`overlayActive` 在模型下载期间为 `true`（`modelLoadingState.isLoading`）、检测期间也为 `true`（`isProcessing && processingMessage`），中间无 false 间隙，`LoadingOverlay` 只挂载一次，阶段文案通过 `key` crossfade 切换，两阶段的信息量（阶段提示、tip）保留，不会呈现"两个弹窗接力"。
- 开发服务器已停止（`pkill -f "next dev"` + 释放 3001 端口确认无残留进程）。

## 2026-07-18 追加修复：手机端进度提示缺失 + footer 不可见

### 问题 1：手机端看不到「检测到 N 张人脸 / 已替换 M/N」

**根因**：`progressText`（承载 `hasShownFaces`/`displayedFaceCount`/替换进度的整块文案）只在两处渲染——`md:flex lg:hidden` 的中屏卡片、`lg:flex` 的桌面右列。移动端 (<768) 的编辑态只有底部吸附工具栏（`EmojiToolbar` + 主按钮 + 图标按钮），没有任何地方渲染这段文案，用户在手机上完全看不到检测/替换进度。

**修复**：在 `app/page.tsx` 新增 `compactProgressText`——复用与 `progressText` 完全相同的底层状态（`hasShownFaces`、`displayedFaceCount`、`replacements.length`、`faces.length`，没有另起一套计数/冻结逻辑），只是排版改成紧凑单行（`md:hidden`），插入到画布列容器顶部（画布上方），随画布一起滚动，不占用吸附工具栏空间。

### 问题 2：手机端看不到 footer

**根因**：`AppFooter` 在 `</main>` 之后走正常文档流，但手机编辑态的底部吸附工具栏是 `fixed inset-x-0 bottom-0`，会盖住页面滚到底时的最后一屏内容。原本只有画布列自己留了 `pb-52`（13rem/208px）作为工具栏遮挡区的缓冲，footer 完全没有对应的底部留白，滚到底时 footer 要么被工具栏整体盖住，要么和工具栏重叠导致不可见/不可点。

**修复**：
1. 提取共享常量 `MOBILE_TOOLBAR_SAFE_AREA`（原先画布列内联的 `pb-52`），画布列和新增的 footer 包裹 `<div>` 都引用同一个常量，避免两处各写一份魔法数字。
2. 用一个仅在 `isEditing && hasShownFaces`（即手机吸附工具栏可见）时生效的包裹 `<div>` 包住 `<AppFooter />`，赋予同样的底部 padding，让文档总高度多出一段工具栏高度的空白，滚动到底时 footer 露在工具栏上方，而不是被其盖住。
3. 实测中发现工具栏正常状态（搜索框 + emoji 网格 + 大小滑块 + 两个主按钮 + 图标按钮行）实际高度约 255px，比最初沿用的 `pb-52`(208px) 还高，footer 仍会被吃掉一截；因此把 `MOBILE_TOOLBAR_SAFE_AREA` 从 `pb-52` 调大到 `pb-72`（18rem/288px），留出安全余量（含刘海屏 safe-area-inset）。**这也顺带把画布列原本的 208px 留白同步调大到 288px**——两处共用同一常量，是任务里"提取共享 padding-bottom 常量"的直接结果，未单独改动画布列的其他布局逻辑。
4. Empty（未上传）态没有吸附工具栏，包裹 `<div>` 的 class 为空字符串，`AppFooter` 保持原生文档流位置，不受影响。

### 未改动范围

- 未触碰桌面（`lg:`）、中屏（`md:`）布局与右列/卡片渲染逻辑，`progressText` 原有两处渲染保持不变。
- `AppFooter.tsx` 组件本身未修改，只在 `page.tsx` 里加了一层条件 padding 的包裹 `<div>`。
- 未改动 `hasShownFaces`/`lastFaceCountRef` 的冻结计数逻辑，`compactProgressText` 直接消费同一份派生状态。

### 验证结果

- `npx tsc --noEmit`：无输出，通过。
- `npm run lint`：仅剩 vendor `public/mediapipe`（生成文件，行号均 >7000）里的既有 error/warning（`no-require-imports`、`no-this-alias`、`react-hooks/rules-of-hooks` 等），与本次改动的 `app/page.tsx` 无关；按任务要求忽略。
- `npm test`：4 个测试文件、24 个用例全部通过。
- 浏览器实测（Chrome MCP，`npm run dev` 自动降级到端口 3001，`resize_window` 到 390×844 模拟手机视口，样例图 `public/sample-group.jpg`）：
  - **① 编辑态加载示例图后能看到人脸计数提示**：点击"试试示例图"进入编辑态后，画布上方出现紧凑单行「✔ 检测到 3 张人脸」，与中屏/桌面右列的文案内容一致。**通过**。
  - **② 滚动到底能看到 footer 且不被工具栏遮挡**：滚动到页面最大可滚动位置，「Made with ❤️ by @Bazinga · View Source · カオナシ · © 2026」完整可见，位于吸附工具栏上方，未被其裁切或覆盖。**通过**（初次用 `pb-52` 验证时 footer 仍被工具栏吃掉约 50px 而不可见，调大到 `pb-72` 后复测通过）。
  - **③ empty（未上传）态 footer 可见**：未上传图片时滚动到底，footer 正常显示在上传卡片下方，无吸附工具栏遮挡问题。**通过**。
  - 过程中发现 dev server 首次编译该路由耗时数秒，期间的交互会被 Next Fast Refresh 的一次整页 reload 打断（页面短暂回到 empty 态），属开发环境正常现象，与本次改动无关；等编译完成后重复点击验证即稳定。
- 开发服务器已停止（`pkill -f "next dev"` + 释放 3001 端口确认无残留进程）。
