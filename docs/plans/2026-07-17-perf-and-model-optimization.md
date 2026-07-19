# 性能与模型选型优化方案（取代 ROADMAP.md）

> 状态：✅ Phase 1–3 及 Phase 4 代码项（含 i18n）已完成（2026-07-18）；剩余：真机兼容性测试、实时摄像头
> 本文档取代 `ROADMAP.md`，是项目待办事项的唯一来源。
> 依据：2026-07-17 工程审计（模型选型 / 代码性能 / 加载与缓存三方面）。

## 审计结论摘要

- **模型选型**：`@vladmandic/face-api` 仍在活跃维护，不需要迁移。问题在配置：默认检测器是 5.4 MB 的 SSD MobileNet V1，且页面 mount 时阻塞式预加载；`face_landmark_68` 模型（360 KB）全库无调用点，是死资产，却仍被 SW 预缓存。
- **代码性能**：内存管理（object URL / tensor / bitmap）干净无泄漏。最大的债是检测推理跑在主线程，大图/多脸时冻结 UI（face-api 依赖 DOM 输入，无法直接进 Worker）。
- **加载与缓存**：SW `install` 用 `cache.addAll` 预缓 6 MB 模型，任一资源 404 会导致整个 SW 安装失败；framer-motion 未做 LazyMotion 拆分；Twemoji 首次离线不可用（已有原生 glyph 降级）。CSP、SW 分层策略、系统字体栈是做得对的部分。

---

## Phase 1：高回报低成本项（当天可完成）

- [x] **1.1 默认检测器改为 Tiny Face Detector，SSD 降级为按需的"高精度模式"**
  - 位置：`app/page.tsx:150`（`detectionSettings` 默认值）、`components/SettingsPanel.tsx` 文案
  - 首屏模型体积 5.4 MB → 192 KB；用户切到 SSD 时才加载其权重
  - 分派：fast-worker → verify: qa-runner（typecheck + lint + 手动检测冒烟）
- [x] **1.2 模型加载延迟到首次上传**
  - 位置：`app/page.tsx:249-296`（`initModels` 在 `useEffect([])` 中 `await loadSSDModel()`）
  - 改为首次 `handleImageLoad` 时触发加载；ModelLoadingModal 时机随之调整
  - 分派：fast-worker → verify: qa-runner
- [x] **1.3 删除 face_landmark_68 死资产**
  - 删除：`public/models/face_landmark_68_model.*`、`lib/faceApi.ts:164 loadLandmarksModel` 及 `withFaceLandmarks` 分支（`faceApi.ts:237/252`）、`lib/runFaceDetection.ts:38 hasLandmarks`、`app/page.tsx:59,359 setHasLandmarks`、`public/sw.js:20-21` 预缓存条目
  - 同步更新 `MODELS_SETUP.md`、`CLAUDE.md` 相关描述
  - 分派：fast-worker → verify: qa-runner
- [x] **1.4 SW install 不再强制预缓模型**
  - 位置：`public/sw.js:24,28-35`
  - install 只预缓 App Shell（HTML/manifest/图标）；模型文件由既有的运行时 cacheFirst（`sw.js:92`）自然填充；消除 `addAll` 全或无失败
  - 分派：fast-worker → verify: qa-runner（离线模式手动验证）

**Phase 1 整体效果**：首屏关键路径约 6.5 MB → <1.5 MB。

## Phase 2：中成本渲染与包体优化

- [x] **2.1 底图预渲染到离屏 canvas**
  - 位置：`components/FaceCanvas.tsx:126-233`（draw effect，`:153` 每帧整图 `drawImage`）
  - 拖拽/滑杆帧只 `drawImage(offscreen)` + 重绘 emoji 层
  - 分派：fast-worker → verify: qa-runner（拖拽流畅度 + 导出像素一致性）
- [x] **2.2 framer-motion 改 `LazyMotion` + `domAnimation`，或次要动画降级 CSS transition**
  - 位置：`app/page.tsx` 及各组件的 `motion.*` 用法
  - 分派：fast-worker → verify: qa-runner（`bun run build` 对比首包体积）
- [x] **2.3 `emojiSettings` effect 先判断有无非 custom 项再 setState**
  - 位置：`app/page.tsx:325-344`；省一次无谓的全局重绘
  - 分派：fast-worker
- [x] **2.4 移除 `simulateProgressiveLoading` 伪进度条**
  - 位置：`lib/faceApi.ts:81-129`；ModelLoadingModal 改为不确定态进度
  - 分派：fast-worker
- [x] **2.5（可选）预缓 `POPULAR_EMOJIS` 的 Twemoji SVG，常用表情离线可用**
  - 位置：`public/sw.js`、`components/EmojiSelector.tsx` 的 POPULAR_EMOJIS 列表
  - 分派：fast-worker

## Phase 3：结构性改造（需排期）

- [x] **3.1 检测迁出主线程：MediaPipe FaceDetection + Web Worker/OffscreenCanvas**（2026-07-18 已完成，设计与实施记录见 `docs/plans/2026-07-18-mediapipe-worker-migration.md`）
  - 动机：face-api 依赖 DOM 输入无法进 Worker；MediaPipe 原生支持 WASM + GPU delegate，接受 ImageBitmap
  - 实施摘要：新增 `workers/faceDetection.worker.ts` + `lib/faceDetectorClient.ts`；`DetectionSettings` 收敛为单一 `minConfidence`（双检测器/性能模式全部删除，非"保留策略"）；`.task` 模型（full-range BlazeFace，实际 ~1.03MB float16，非最初估计的 ~0.23MB）与 WASM 运行时全部自托管（`public/models/`、`public/mediapipe/wasm/`）；彻底移除 `@vladmandic/face-api` 与相关权重文件，不保留回退路径；CSP `script-src` 从 `'unsafe-eval'` 收紧为 `'wasm-unsafe-eval'`；`public/sw.js` CACHE_VERSION v2→v3，新增 `/mediapipe/` 缓存路由
  - 未覆盖：iOS Safari / 真机 GPU delegate 回退未做真机验证（沙盒环境无法执行），留给 Phase 4"浏览器兼容性测试"
  - 若未来需要密集小脸/侧脸检测，再评估 ONNX Runtime Web + SCRFD（后处理成本高，当前不做）
  - 分派：设计 deep-reasoner → 实现 fast-worker → verify: qa-runner
- [x] **3.2 Next 16 升级预案**：原顾虑的 `next.config.ts` webpack 定制（face-api fallback/externals）已随 3.1 整体删除（非迁移到 Turbopack），因此该项风险已消解；`next.config.ts` 目前仅剩 CSP/安全头配置，无 webpack 自定义

## Phase 4：保留的功能项（原 ROADMAP 精选）

仅保留仍有明确价值的条目，其余（预设样式包、人脸识别实验、社交分享、协作模式、商业化等）已裁撤：

- [x] **浏览器兼容性测试**：iOS Safari 重点，其次 Firefox、Android Chrome（2026-07-18 用户已完成真机验证）
- [x] **捏合/滚动缩放**：对当前 inspected face 独立缩放（touch pinch + wheel）
- [ ] **实时摄像头模式**：规范见 `docs/real-time-camera.md`；Phase 3.1 已完成，前提性能基础（Worker 化检测）已就绪，可排期
- [x] **i18n 完整翻译**：UI 文案抽离 + 英文版（2026-07-18 完成，见下方实施说明）

另有 UI/UX 评审遗留小项见 `docs/ui-ux-copy-review.md` 头部待做清单，随手修复即可，不单独排期。

---

## 实施说明（Implementation Notes）

Phase 1（1.1-1.4）已完成：

- **1.1**：`app/page.tsx` 的 `detectionSettings` 默认值改为 `{ detector: 'tiny_face_detector', minConfidence: 0.5, inputSize: 416 }`；`SettingsPanel.tsx` 下拉选项顺序调整为极速模式在前（标注"默认"）、SSD 在后（标注"高精度模式"），提示文案同步更新，"恢复默认设置"按钮的重置值也改回 tiny。README 的中英文"默认检测器"描述同步更新。
- **1.2**：原先 mount 时 `useEffect` 里 `await loadSSDModel()` 的阻塞式加载被移除，改为：mount 时只注册 progress 回调（`modelLoadingState` 初始 `isLoading: false`）；新增 `ensureDetectorModelLoaded(detector)`（`useCallback`，无依赖）在 `handleImageLoad` 检测前调用，加载失败时设置原有的错误文案并提前 return（跳过检测，`finally` 仍会清理 `isProcessing`）。检测器切换的 `useEffect` 保留原有 toast 加载逻辑，改为同时处理 tiny 和 ssd 两种检测器（原来只处理 tiny，因为 ssd 曾在 mount 时预加载），并用 `isFirstDetectorEffect` ref 跳过挂载时的首次触发，避免与 `ensureDetectorModelLoaded` 的首次上传加载重复触发。
- **1.3**：确认 grep 结果与计划描述一致，未发现额外调用点。删除了 `lib/faceApi.ts` 中的 `faceLandmark68Net` loadedModels 字段、`areLandmarksLoaded`、`loadSpecificModel` 的 `faceLandmark68Net` 分支与联合类型成员、`loadLandmarksModel`、`areLandmarksAvailable`；`detectFacesWithLandmarks` 重命名为 `detectFaces` 并移除所有 landmarks 分支，只保留扁平检测路径。`lib/runFaceDetection.ts` 同步移除 `hasLandmarks` 字段/逻辑，导入改为 `detectFaces`。`app/page.tsx` 移除 `setHasLandmarks` 死状态与相关注释。`ModelLoadingModal.tsx` 移除 `faceLandmark68Net` 显示名条目。物理删除 `public/models/face_landmark_68_model-weights_manifest.json` 与 `.bin`。`types/index.ts` 中未发现 landmark 相关字段，无需改动。`MODELS_SETUP.md` 的 Face Landmarks 68 小节标注为"已移除"，其余下载步骤保留作历史记录。
- **1.4**：`public/sw.js` 的 `APP_SHELL` 移除全部 `/models/` 预缓存条目（含 1.3 中已删除的 landmark 条目），仅保留 `/`、`/site.webmanifest`、`/kaonashi.jpg`。确认运行时 `fetch` 处理器（`/models/` 与 `/_next/static/` 走 `cacheFirst`）逻辑未改动，仍会在首次请求时把模型文件填入缓存。`CACHE_VERSION` 从 `v1` 升到 `v2`，触发旧缓存清理。

无实质性偏离计划的地方；`inputSize: 416` 是跟随现有 SettingsPanel 里"切到 Tiny 时自动设 416（均衡模式）"的既有约定，为保持默认状态与用户手动切换后的状态一致而在默认值里一并写上。

### Phase 2

Phase 2（2.1-2.5）已完成：

- **2.1**：`components/FaceCanvas.tsx` 新增 `offscreenCanvasRef`（一个持久复用的 detached `<canvas>`）和 `offscreenKeyRef`（记录上次构建时的 `image.src + 物理像素尺寸`）。draw effect 里原来每次都跑的 `ctx.drawImage(image, 0, 0, canvasSize.width, canvasSize.height)` 拆成两步：先判断 offscreen key 是否变化（图片或 DPR 尺寸变了才重建），只有变化时才重新在 offscreen canvas 上以同样的 `setTransform(dpr,...) + drawImage` 画一次；主 canvas 则永远走 `ctx.drawImage(offscreen, 0, 0, canvasSize.width, canvasSize.height)`。选择把 offscreen canvas 也建成 DPR 物理像素尺寸（而不是纯 CSS 像素、无变换）的原因：两边都套用同一个 dpr 缩放，净变换相互抵消，数学上与原先直接画等价，且不需要额外维护一套"CSS px offscreen"的缩放逻辑，改动面最小。人脸框、勾选标记、emoji 层仍在同一个 effect 里每次全量重绘（它们依赖 faces/replacements/scale/activeReplacementId，这些确实逐帧变化）；backing-store 尺寸判断、`cancelled` 异步取消、ResizeObserver 逻辑均未改动。
- **2.2**：`app/layout.tsx` 根节点用 `<LazyMotion features={domMax} strict>` 包裹 `{children}`（`domMax` 而非 `domAnimation`，因为 `app/page.tsx` 用到了 `layout` prop 和 `useDragControls`/drag，这两个特性只在 `domMax` 里）；因此本次 code-splitting 收益小于纯 `domAnimation` 方案，但仍比未拆分的 framer-motion 全量体积小。`strict` 模式要求全树 `motion.*` 换成 `m.*`，已对 9 个使用文件（`app/page.tsx`、`components/{FaceCanvas,ProcessingOverlay,ImageUploader,EmojiInspector,SettingsPanel,Toast,ModelLoadingModal,EmojiSelector}.tsx`）做了导入和 JSX 用法的全量替换，`AnimatePresence`/`MotionConfig`/`useDragControls`/`PanInfo` 保持原样（不受 LazyMotion 门控）。`layout.tsx` 未加 `'use client'`——`LazyMotion` 本身是 framer-motion 内部的客户端组件，作为 Server Component 的子边界可以直接用，构建验证通过无需改动。
- **2.3**：`app/page.tsx` 的 `emojiSettings` effect 在原有 `replacements.length === 0` 早退之后，新增 `if (!replacements.some((r) => !r.isCustom)) return;`，全部替换项都是自定义时直接跳过 `setReplacements`，避免无谓的全局重绘。
- **2.4**：`lib/faceApi.ts` 删除了 `simulateProgressiveLoading` 整个函数（含 `setInterval` 伪造进度曲线的逻辑）。`loadSSDModel()` 和 `loadTinyModel(false)` 分支改为直接 `await loadSpecificModel(...)`，在调用前后各给 `progressCallback` 发一次通知（`loaded: 0/total: 1` 开始态、`loaded: 1/total: 1` 完成态），不再携带虚构的百分比。`types/index.ts` 的 `ModelLoadingProgressCallback` 去掉 `percentage` 字段，`ModelLoadingState` 去掉 `progress` 字段——影响面只有 `app/page.tsx`（初始 state、progress 回调 setter、`ensureDetectorModelLoaded` 里两处 `setModelLoadingState`）和 `ModelLoadingModal.tsx`，改动量小，选择了干净移除而不是保留死字段。`ModelLoadingModal.tsx` 删除了"加载进度 / N%"文字行和进度条 `<m.div>`，保留旋转图标、模型名展示、标题文案和提示语，呈现为不确定态加载。detector 切换的 toast 提示流程、`isModelLoaded` 判断等原有状态机未改动。

- **2.5**：`components/ServiceWorkerRegistration.tsx` 在 `navigator.serviceWorker.register('/sw.js')` 成功后新增 `prefetchPopularEmojis()`，用 `requestIdleCallback`（无该 API 时降级 `setTimeout(…, 2000)`）对 `lib/emojiSearch.ts` 的 `CURATED_EMOJI_POOL`（`POPULAR_EMOJIS` 去重后的版本，避免重复请求同一 URL）逐个 `fetch(getTwemojiUrl(emoji))`，`.catch(() => {})` 静默吞掉失败。未改动 `public/sw.js` 的 `install`：确认其 `fetch` 处理器已经对 `TWEMOJI_ORIGIN`（`cdn.jsdelivr.net`）走 `cacheFirst`（3.1 迁移时就已加好，见 `sw.js:80-83`），所以这批预热请求会被现有运行时缓存自然收下，不需要新增专门的 CDN 路由或 bump `CACHE_VERSION`。这个预热请求发生在页面加载路径之外（`register().then()` 之后、idle 时机），不阻塞任何用户可感知的操作；若该次页面还未被 SW 接管（例如首次激活），fetch 会走普通网络请求而不进 CacheStorage，下次访问时该 SW 已激活并控制页面，重新触发的预热才会真正落盘——这是刻意接受的最简方案，代价是"离线可用"要等到第二次访问后才完全生效。

### Phase 4（部分）

- **捏合/滚动缩放**：`components/FaceCanvas.tsx` 新增两条独立的连续缩放输入，都复用现有 `onRepositionActiveEmoji`/`scheduleReposition`（帧防抖）与 `onBeginDragReposition` 回调，因此和拖拽重定位共享同一套 `isCustom: true` 语义与 inspector 滑杆实时联动；`onBeginDragReposition` 的 prop 注释同步更新为"也被 wheel/pinch 手势复用"，未新增 prop（未做到"每种手势一个专属 onBeginXxx"，判断没必要——三种手势要做的事完全一样：手势开始时推一次历史）。
  - **wheel（桌面）**：命中测试复用已有的 `getActiveEmojiRect()` + 屏幕矩形判断（与 `handlePointerMove` 里悬停判断同一套逻辑）；每档 `WHEEL_SCALE_STEP = 0.05`（5%），`clampEmojiScale` 收敛到 `[0.5, 2.0]`，与 `EmojiInspector.tsx` 滑杆的 min/max 完全一致。**实现上有一处踩坑记录**：最初直接用 JSX 的 `onWheel` prop 调用 `e.preventDefault()`——React 17+ 为了对齐浏览器默认滚动性能，会把合成 `onWheel`/`onTouchMove` 监听器注册为 passive，导致 `preventDefault()` 被静默忽略、页面仍会跟着滚动。改为在 `useEffect` 里对 `canvasRef.current` 用原生 `addEventListener('wheel', handler, { passive: false })` 手动挂载/卸载，`e.preventDefault()` 才真正生效。手势 coalescing 用 `lastWheelTimeRef` 记录上次滚轮时间戳，间隔超过 `WHEEL_GESTURE_GAP_MS = 400ms` 才视为新手势并调用一次 `onBeginDragReposition`。
  - **touch pinch（移动端）**：新增 `pointersRef`（`Map<pointerId, {x,y}>` 追踪当前落下的所有指针）和 `pinchStateRef`（`{ startDistance, baseScale }`）。`handlePointerDown` 里，当第二根手指落下（`pointersRef.size === 2`）时：若已有单指拖拽在进行（`dragStateRef.current` 非空），先释放其 pointer capture 并清空 `dragStateRef`（拖拽让位给捏合，不做"捏合结束后恢复拖拽"），再 `onBeginDragReposition?.()` 一次并记录 `pinchStateRef`（初始双指距离 + 当前 scale 作为基准）。`handlePointerMove` 里若 `pinchStateRef.current` 存在，按当前双指距离与初始距离的比例 `baseScale * (distance/startDistance)` 算出新 scale，`clampEmojiScale` 后走 `scheduleReposition`；单指拖拽的分支逻辑不变（仍走原有阈值判定）。`endDrag`（`onPointerUp`/`onPointerCancel`）改为先从 `pointersRef` 里移除该指针、指针数低于 2 时清空 `pinchStateRef`，再按原逻辑处理 `dragStateRef`（单指拖拽收尾）。
  - 未做额外设置项（比如缩放灵敏度可配置），按计划要求最小化改动面。

**首包体积对比**（`next build`，`/` 路由）：Phase 1 完成时基线 First Load JS 226 kB → Phase 2 完成后 196 kB（shared-by-all 102 kB）；本次 2.5 + 捏合/滚动缩放实施后 `next build` 仍为 196 kB（无新增依赖，纯逻辑扩展）。

### i18n（Phase 4）

- 新建 `lib/i18n/`：`zh.ts`（约 90 个叶子键的嵌套字典，含若干 `(n) => string` / `(n, total) => string` 插值函数字段）、`en.ts`（`typeof zh` 约束，键完全对齐）、`index.tsx`（`LanguageProvider` + `useI18n()`）。不引入第三方 i18n 库，按需求文档的架构原样落地。
- 初始语言判定：`localStorage['no-face-lang']` 优先，否则按 `navigator.language` 是否以 `zh` 开头选择；`LanguageProvider` 为避免 SSR/首次客户端渲染的 hydration mismatch，state 初始值固定为 `'zh'`，真正的探测在 `useEffect` 里异步纠正——这意味着非中文浏览器会有一帧中文闪烁，评估为可接受（避免了 hydration warning 这个更明显的问题）。切换时把选择写回 localStorage 并同步 `document.documentElement.lang`（`zh-CN` / `en`）。
- 语言切换入口：`app/page.tsx` 头部新增一个绝对定位的小圆角按钮（`t.languageToggle.switchToLabel`，显示"要切换到的目标语言"），风格与现有卡片按钮一致，不单独起新的视觉系统。
- 组件改造范围：`app/page.tsx`、`components/{ImageUploader,FaceCanvas,EmojiSelector,EmojiInspector,SettingsPanel,ModelLoadingModal}.tsx`、`hooks/useInspectorActions.ts` 全部改为 `const { t } = useI18n()` 后属性访问；`ProcessingOverlay.tsx`/`Toast.tsx`/`ServiceWorkerRegistration.tsx` 本身不含硬编码文案（文案通过 props 传入），未改动。
- `app/layout.tsx` 用 `LanguageProvider` 包裹 `body` 内容（`LazyMotion` 和 `ServiceWorkerRegistration` 都在其内），`<html lang="zh-CN">` 与 `metadata`（SEO 标题/描述/OG）保持原样不动——按需求，站点主语言不随内部切换器改变。
- 保留中文、未纳入字典的位置：
  - `lib/emojiSearch.ts` 的 `EMOJI_KEYWORDS_ZH`（及其数据/注释）：按需求明确排除，两种语言下都保留中文关键词搜索能力；`EmojiSelector.tsx` 的主搜索框 placeholder 在英文模式下改为提示"展开完整表情库可用英文搜索"。
  - `app/layout.tsx` 的 `metadata`（title/description/OG）：SEO 主语言不变，按需求保留。
  - `app/page.tsx` 里的品牌字符“カオナシ”（logo alt、footer 品牌角标）：片假名，不在中文 `[一-龥]` grep 范围内，也不属于"UI 文案"，视为品牌标识不做翻译；`header.title` 键本身已做了本地化（zh: `カオナシ`，en: `No Face`，用于页面主标题 `<h1>`）。
  - `console.error(...)` 的首个字符串参数（如原来的"模型加载失败:"）：这是开发者可见的调试日志，不是用户可见文案，本次顺手改成了英文字面量，不进字典。
- 检查结果：`npx next lint` 无警告、`npx tsc --noEmit` 无错误、`npx vitest run` 25/25 通过、`npx next build` 成功（First Load JS 200 kB，较 i18n 前的 196 kB 增加约 4 kB，即两份字典 + Context 的体积）；`grep -rn '[一-龥]' app/ components/ hooks/ lib/i18n` 仅命中上述已说明的保留项（`app/layout.tsx` 的 metadata 与 `lib/i18n/en.ts` 里"切换到中文"按钮的 `中` 字面量）。
- 分派：本轮按用户要求由执行者直接实现（未委派 fast-worker/qa-runner）。

## 评审记录

- 2026-07-18 qa-runner 独立验证 UI 评审小项 + i18n：lint / tsc / vitest 25/25 / build（First Load JS 200 kB，i18n 字典 +4 kB）全绿；A 批（ProcessingOverlay 精简、示例图、全窗口拖拽、Inspector ResizeObserver padding、badge 密集态）5/5 通过；B 批（字典类型约束、语言初始化/持久化/documentElement.lang 同步、无硬编码中文残留、10 键翻译抽查无直译腔、新增文案全走 i18n）通过。qa-runner 标记 zh 字典标题为日文 `カオナシ`——判定为非问题：这是产品品牌名（迁移前中文界面主标题即如此），有意保留，仅英文版用 "No Face"。
- 2026-07-18 qa-runner 独立验证 2.5 + 捏合/滚动缩放：lint / tsc / vitest 25/25 / build（First Load JS 196 kB）全绿；静态核对（预热走 requestIdleCallback + 静默失败 + SW 对 jsdelivr 的 cacheFirst 在位；wheel 用非 passive 原生监听且有清理、缩放 clamp 0.5–2.0 与 inspector 一致、历史 coalescing 正确——wheel 按 400ms 分段、捏合在第二指落下时各推一次、拖拽/捏合状态互不污染、均只作用于 activeReplacementId）全部通过，CLAUDE.md 描述与实现一致。
- 2026-07-18 qa-runner 独立验证 Phase 3.1（MediaPipe 迁移）：lint ✅、tsc ✅、vitest 25/25 ✅、`next build` 成功（First Load JS 196 kB 持平——移除 face-api+tfjs 与新增 tasks-vision glue 大致相抵，Worker 代码在独立按需 chunk）；静态核对（face-api 零残留、新资产完整：.task 1.08MB + wasm 4 文件约 21MB、GPU→CPU 回退与 close() 释放在位、DetectionSettings 仅剩 minConfidence、CSP 收紧为 wasm-unsafe-eval、SW v3 含 /mediapipe/ 路由、三份文档已更新）全部通过。一处与设计文档的语义差异：minConfidence 过滤实际放在 Worker 侧（设计写的是主线程侧），结果等价且"滑杆免重建 detector 即时生效"的目标同样达成，接受该偏差。真机（尤其 iOS Safari）未验证，归入 Phase 4 兼容性测试。
- 2026-07-18 qa-runner 独立验证 Phase 2：lint ✅、tsc ✅、vitest 25/25 ✅、`next build` 成功（First Load JS 196 kB，shared 102 kB）；静态核对（10 处 framer-motion 导入串完好、无 `motion.*` 残留、layout 的 LazyMotion+domMax+strict 就位、FaceCanvas 主绘制路径只 blit 离屏 canvas、伪进度与 percentage 字段无残留、emojiSettings 判空早退在位）全部通过。实施插曲：fast-worker 的一次正则替换曾把 import 串损坏为 `'framer-m'`，当场修复，验证确认无残留。
- 2026-07-17 qa-runner 独立验证 Phase 1：lint ✅、tsc ✅、vitest 25/25 ✅、`next build` 成功（First Load JS 226 kB）、静态核对（landmark 无残留引用、SW APP_SHELL 无模型条目且 CACHE_VERSION=v2、默认检测器 tiny、模型按需加载）全部通过。
- 实施插曲：fast-worker 曾误删 AGENTS.md/CLAUDE.md/ROADMAP.md 并用 `git checkout HEAD` 恢复，导致已被有意删除的 ROADMAP.md 复活；编排层已重新删除并同步更新了 CLAUDE.md/AGENTS.md/README.md 中的 ROADMAP 引用（指向本文档）。
