# 手机编辑态全屏化 + PC 端两处布局微调

> 2026-07-19。用户反馈：① PC 端 emoji 可见区收到三行、画布图片相对右列水平垂直居中；② 手机端"fixed 工具栏 + 页面可滚动 + footer 被埋"的混搭感。方案讨论后选定：手机端走**编辑态全屏化**（方案 C）。

## 方案

### PC（lg ≥1024）

1. **emoji 网格三行**：`EmojiToolbar` md+ 网格 `max-h` 收到恰好三行（按单元格实测高度含 gap 计算），内部滚动不变。
2. **画布垂直居中**：编辑态画布列在 lg 下加最小高度（视口 − 头部 − 上下 padding）并 `justify-center`；图片水平居中。右列 sticky 不动。

### 手机（<768，编辑态）

3. **编辑态改为不滚动的 App 式固定布局**：外层容器高度 `100dvh` 弹性列——头部 / 计数行 / 画布区（flex-1，图片 object-contain 居中，内部不产生页面滚动）/ 底部工具栏（不再 fixed，改为弹性列的最后一行）。
4. **删除补丁**：`MOBILE_TOOLBAR_SAFE_AREA`（pb-72）及 footer 的条件包裹 padding 整体删除。
5. **footer 只在落地态**：编辑态 <md 不渲染 AppFooter（md+ 不变）。落地态维持原网页式文档流。

### 不做

- 不做 bottom sheet 收纳（方案 A，另行排期可选）。
- md（768–1023）与 lg 布局除上述两点外不动。

## 执行步骤

1. EmojiToolbar 三行 max-h → verify: 桌面视口目测三行 + 内部滚动
2. lg 画布列居中 → verify: 矮图/高图两种情况居中且右列 sticky 正常
3. 手机编辑态 100dvh 固定布局改造 + 删 SAFE_AREA 补丁 + footer 条件渲染 → verify: 390×844 无页面滚动、工具栏不遮画布、落地态 footer 正常
4. tsc / vitest 通过；浏览器实测由用户完成

分派：实现 fast-worker → 验证 用户本人。

## 实现记录

- `components/EmojiToolbar.tsx`：md+ 网格 `md:max-h-56 lg:max-h-64` → `md:max-h-[8.75rem]`（按 text-2xl line-height 2rem + p-1.5 共 0.75rem ≈ 2.75rem/格 × 3 + gap-1(0.25rem) × 2 = 8.75rem 实测吻合，一次到位，未调整），并删除 lg 覆盖值。
- `app/page.tsx`：
  - 删除 `MOBILE_TOOLBAR_SAFE_AREA` 常量及全部用法（画布列 padding-bottom、footer 包裹 padding）。
  - 外层容器：`isEditing` 时 `h-dvh overflow-hidden`，否则 `min-h-dvh`；`md:` 断点强制恢复 `min-h-dvh md:h-auto md:overflow-visible`，确保 md/lg 不受影响。
  - `main` 加 `min-h-0`（flex 子项收缩必需，未设置约束高度时是 no-op，对落地态/md/lg 无副作用）。
  - 编辑态外层网格容器新增 `flex flex-col min-h-0`，并在 `md:` 恢复 `md:block md:min-h-0`（该断点下父级不再是 flex 容器，画布列上的 `flex-1`/`min-h-0` 因此在 md 自动失效，无需额外覆盖）。
  - 画布列：新增 `flex-1 min-h-0`（<md 下参与 flex 分配剩余高度）+ `lg:min-h-[calc(100dvh-5.5rem)] lg:justify-center`（lg 下相对头部 3.5rem + 容器 py-4 共 2rem = 5.5rem 做垂直居中；水平居中沿用 FaceCanvas 自带的 `w-full flex justify-center`，未改动 FaceCanvas.tsx）。
  - 画布/错误卡片外新增一层包裹 div：`flex-1 min-h-0 flex items-center justify-center overflow-hidden md:contents` —— `md:contents` 让该包裹在 md+ 从盒模型中消失，子元素（原有的两个 framer-motion `m.div`）在 md+ 下与改造前的 DOM 结构完全一致，避免破坏其入场动画（`display:contents` 曾一度错误加到 `m.div` 本身，会导致 opacity/scale 动画在 md+ 失效，已改为只加在外层纯 div 上）。
  - 移动端 docked 工具栏：移除 `fixed inset-x-0 bottom-0 z-30`，改为弹性列末行；新增 `max-h-[45vh] overflow-y-auto` 防止内容在矮视口下把工具栏撑爆导致其自身溢出（安全区 padding 之前已存在，未新增）。
  - Footer 包裹：`isEditing ? 'hidden md:block' : ''`，编辑态 <md 完全不渲染（而非只留 padding）。

### FaceCanvas 缩放决策

未修改 `components/FaceCanvas.tsx`。它的尺寸拟合逻辑（`fitToContainer`）以 `containerRef.current.clientWidth` 为宽度约束，但高度上限固定用 `window.innerHeight * 0.8`（与容器实际高度无关）。手机全屏编辑态的画布区可用高度通常小于这个值（头部 + 计数行 + 工具栏占用空间），因此改为在外部包一层 `flex-1 min-h-0 ... overflow-hidden` 容器：
- 宽度仍会被 FaceCanvas 正确测到（约束生效）；
- 极端情况下（超高长图 + 极矮视口）计算出的高度可能超出该容器的实际可用高度，此时 `overflow-hidden` 会裁切画布底部，而不是让页面产生滚动 —— 符合任务里"不产生页面滚动"优先于"完美贴合"的要求。
- 未通过修改 FaceCanvas 传入显式高度，因为那需要改动其对外的测量/API 语义，超出本次"外科手术式"改动范围；已在此记录为已知取舍，若后续要做到零裁切需再改 FaceCanvas 的 `maxHeight` 计算逻辑。

### 验证

- `npx tsc --noEmit`：通过。
- `npx vitest run`：27/27 通过。
- `npx next lint`：无警告无错误。
- `npm run dev` 起了一次确认能正常编译/响应 200，随后 `pkill -f "next dev"` 并确认 3000 端口已释放。浏览器实测（390×844 等视口下的真实滚动/裁切表现）留给用户本人验证。

---

## 三次迭代（2026-07-19，用户反馈：全断点无滚动 App 式布局)

上一版只有手机编辑态全屏化，PC/md 仍是文档流滚动，且手机端工具栏内容显示不全靠内部滚动、footer 不可见——体验不达标。新目标：

1. **所有断点**编辑态整页无纵向滚动条：`h-dvh` 弹性列 = AppHeader / 内容区 flex-1 min-h-0 / AppFooter（常驻可见，单行紧凑化如需要）。
2. 内容区：md+ 左右布局（画布区 flex-1 居中 + 右侧面板固定宽、自身 overflow-y-auto）；<md 上下布局（画布 flex-1 + 工具面板，面板 overflow-y-auto 兜底但目标是常规内容完整可见）。右列不再 sticky（页面不滚，sticky 无意义）。
3. 工具面板不再 fixed / 不再吸附，与画布同容器。
4. **FaceCanvas 修正**：高度上限从 `window.innerHeight * 0.8` 改为测量父容器实际可用高度（ResizeObserver 或既有 fitToContainer 改读容器 clientHeight），保证画布在任何断点 contain 缩放、不裁切不溢出。
5. 落地态维持文档流（本来就一屏内）。emoji 三行上限保留；若手机高度紧张可降为横滚单行（现状 <md 就是横滚行，保留即可）。

### 三次迭代实现记录

分派：实现 fast-worker → 验证 qa-runner。

- `app/page.tsx`：
  - 外层容器：删除 `md:min-h-dvh md:h-auto md:overflow-visible` 覆盖，编辑态在所有断点统一 `h-dvh overflow-hidden`（落地态不变，仍 `min-h-dvh` 文档流）。
  - 编辑态内容区从 `lg:grid` + `md:block` 的断点分叉结构，改为单一 `flex flex-col md:flex-row` 容器：<md 时画布列在上、面板在下；md+ 时画布列在左、面板固定宽在右。画布列 `flex-1 min-h-0`，居中包裹层 `flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden` 在所有断点生效（不再靠 `md:contents` 在 md+ 移出布局）。
  - md 与 lg 的工具面板合并为一份 JSX（`hidden md:flex md:flex-col md:w-[clamp(320px,28vw,380px)] ... overflow-y-auto min-h-0`），不再有单独的「md 卡片」与「lg sticky 列」两份渲染；`lg:sticky lg:top-20` 整体删除（页面不再滚动，sticky 无意义）。统一使用 `renderPrimaryButtons('stack')` + `iconButtonsLabeled`（原 lg 的样式），md 断点不再用 `row`/compact 变体。
  - <md 工具面板从「page-level `fixed inset-x-0 bottom-0` + `AnimatePresence`」改为内容区 flex 列的最后一行（`md:hidden shrink-0 ... max-h-[45vh] overflow-y-auto`），随内容自然定位，不再需要 `MOBILE_TOOLBAR_SAFE_AREA`（已删除，连同 footer 包裹 padding 一并移除）。
  - `AppFooter` 从条件渲染（`hidden md:block` when editing）改为无条件渲染，传 `compact={isEditing}`。
  - 上一版遗留的 `lg:min-h-[calc(100dvh-5.5rem)] lg:justify-center` 与 `md:contents` 包裹层已删除，由统一结构取代。
- `components/FaceCanvas.tsx`：
  - `fitToContainer` 高度上限从 `window.innerHeight * 0.8` 改为 `container.clientHeight`（`Math.min(container.clientHeight || 600, 900)`），解决"父容器实际可用高度"未被感知的问题。
  - 关键配套改动：FaceCanvas 根 `m.div`（即 `containerRef` 所指向的元素）className 加上 `h-full`（`w-full flex justify-center` → `w-full h-full flex items-center justify-center`）。这是避免"循环测量"的必要一步——该元素此前没有显式高度，`clientHeight` 量的其实是画布自身内容的高度而非父级可用空间；加 `h-full` 后它继承 `app/page.tsx` 中 `flex-1 min-h-0 overflow-hidden` 包裹层的确定高度，测量才有意义。已有的 `ResizeObserver` 继续监听同一个 `container`，视口/断点变化时自动重新计算，无需额外的 window resize 监听。
  - 导出逻辑（`handleExport`）完全未动，仍使用 `image.naturalWidth/naturalHeight` 原图分辨率，与显示缩放解耦的现状未被破坏。
- `components/AppFooter.tsx`：新增可选 `compact` 属性，`compact` 时用 `shrink-0 py-1.5 text-[11px]` 紧凑单行样式，内容/链接不变；非 compact 保留原 `mt-6 mb-4 text-xs` 样式给落地态。
- `components/EmojiToolbar.tsx`：<md 断点收紧三处间距（`space-y-3` → `space-y-2 md:space-y-3`；两处 `gap-3` → `gap-2 md:gap-3`，尺寸行与灵敏度分段控件行），md+ 不变，未砍任何功能。emoji 网格三行上限（`md:max-h-[8.75rem]`）与 <md 横滚行保持上一版实现不变。

### 妥协 / 已知取舍

- FaceCanvas 极端情况（超高长图 + 极矮视口）算出的高度仍可能被外层 `overflow-hidden` 裁切——但由于高度上限现在直接来自容器实际可用空间（而非独立于容器的 80vh 估算值），出现裁切所需的极端程度比上一版更高（此前 80vh 常年独立于实际可用空间，现在两者天然一致）。仍然是"不产生页面滚动"优先于"零裁切"的既定取舍。
- md（768–1023）断口的按钮行/图标行统一为 lg 的 `stack` + labeled 样式（而非之前 md 独有的 `row` + compact 样式），因为面板宽度现在与 lg 一致（`clamp(320px,28vw,380px)`），row 布局在这个宽度下不如 stack 好用；这是本次"md 与 lg 同构"要求的直接结果，功能未变。

### 验证

- `npx tsc --noEmit`：通过。
- `npx vitest run`：27/27 通过。
- `npx next lint`：无警告无错误（vendor `public/mediapipe` 既有告警不在本次改动范围内）。
- 浏览器实测：qa-runner 起了 `npm run dev` 并在 1440×900 下确认——`document.documentElement.scrollHeight === clientHeight`（无纵向滚动）、footer 可见、右侧面板（emoji 选择器/尺寸控件/按钮）完整可见、画布完整无裁切。**768×1024 与 390×844 未能通过浏览器实测**：当前环境里 `claude-in-chrome` 的 `resize_window` 工具未能真正改变视口尺寸（窗口仍报告 1512px 宽），qa-runner 转而做了代码走查确认 CSS 结构（`flex-1 min-h-0` 链、md+ 侧栏 `overflow-y-auto`、<md 面板 `max-h-[45vh] overflow-y-auto`）在这两个断点下逻辑自洽，但这不能替代真实渲染验证。**建议用户本人在真实浏览器（或 DevTools 设备工具栏）里过一遍 768 与 390 两档**，重点看：面板内容是否完整可见/内部可滚、画布是否被裁切、footer 是否可见。
