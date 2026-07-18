# 性能与模型选型优化方案（取代 ROADMAP.md）

> 状态：📋 已确认，未开始执行
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
- [ ] **2.5（可选）预缓 `POPULAR_EMOJIS` 的 Twemoji SVG，常用表情离线可用**
  - 位置：`public/sw.js`、`components/EmojiSelector.tsx` 的 POPULAR_EMOJIS 列表
  - 分派：fast-worker

## Phase 3：结构性改造（需排期）

- [ ] **3.1 检测迁出主线程：MediaPipe FaceDetection + Web Worker/OffscreenCanvas**
  - 动机：face-api 依赖 DOM 输入无法进 Worker；MediaPipe（BlazeFace short ~230 KB）原生支持 WASM + GPU delegate，接受 ImageBitmap
  - 前置：由 deep-reasoner 出迁移设计文档（坐标系映射、双检测器策略保留与否、回退方案），确认后再实施
  - 若未来需要密集小脸/侧脸检测，再评估 ONNX Runtime Web + SCRFD（后处理成本高，当前不做）
  - 分派：设计 deep-reasoner → 实现 fast-worker → verify: qa-runner
- [ ] **3.2 Next 16 升级预案**：`next.config.ts:56` 的 webpack 定制（face-api fallback/externals）需迁移到 Turbopack 配置或显式 `--webpack`；当前锁定 next@15.5.9 无碍，升级时处理

## Phase 4：保留的功能项（原 ROADMAP 精选）

仅保留仍有明确价值的条目，其余（预设样式包、人脸识别实验、社交分享、协作模式、商业化等）已裁撤：

- [ ] **浏览器兼容性测试**：iOS Safari 重点，其次 Firefox、Android Chrome
- [ ] **捏合/滚动缩放**：对当前 inspected face 独立缩放（touch pinch + wheel）
- [ ] **实时摄像头模式**：规范见 `docs/real-time-camera.md`；依赖 Phase 3.1 完成后再做（Worker 化检测是实时模式的前提性能基础）
- [ ] **i18n 完整翻译**：UI 文案抽离 + 英文版

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

Phase 2（2.1-2.4）已完成（2.5 保留未做，仍是可选项）：

- **2.1**：`components/FaceCanvas.tsx` 新增 `offscreenCanvasRef`（一个持久复用的 detached `<canvas>`）和 `offscreenKeyRef`（记录上次构建时的 `image.src + 物理像素尺寸`）。draw effect 里原来每次都跑的 `ctx.drawImage(image, 0, 0, canvasSize.width, canvasSize.height)` 拆成两步：先判断 offscreen key 是否变化（图片或 DPR 尺寸变了才重建），只有变化时才重新在 offscreen canvas 上以同样的 `setTransform(dpr,...) + drawImage` 画一次；主 canvas 则永远走 `ctx.drawImage(offscreen, 0, 0, canvasSize.width, canvasSize.height)`。选择把 offscreen canvas 也建成 DPR 物理像素尺寸（而不是纯 CSS 像素、无变换）的原因：两边都套用同一个 dpr 缩放，净变换相互抵消，数学上与原先直接画等价，且不需要额外维护一套"CSS px offscreen"的缩放逻辑，改动面最小。人脸框、勾选标记、emoji 层仍在同一个 effect 里每次全量重绘（它们依赖 faces/replacements/scale/activeReplacementId，这些确实逐帧变化）；backing-store 尺寸判断、`cancelled` 异步取消、ResizeObserver 逻辑均未改动。
- **2.2**：`app/layout.tsx` 根节点用 `<LazyMotion features={domMax} strict>` 包裹 `{children}`（`domMax` 而非 `domAnimation`，因为 `app/page.tsx` 用到了 `layout` prop 和 `useDragControls`/drag，这两个特性只在 `domMax` 里）；因此本次 code-splitting 收益小于纯 `domAnimation` 方案，但仍比未拆分的 framer-motion 全量体积小。`strict` 模式要求全树 `motion.*` 换成 `m.*`，已对 9 个使用文件（`app/page.tsx`、`components/{FaceCanvas,ProcessingOverlay,ImageUploader,EmojiInspector,SettingsPanel,Toast,ModelLoadingModal,EmojiSelector}.tsx`）做了导入和 JSX 用法的全量替换，`AnimatePresence`/`MotionConfig`/`useDragControls`/`PanInfo` 保持原样（不受 LazyMotion 门控）。`layout.tsx` 未加 `'use client'`——`LazyMotion` 本身是 framer-motion 内部的客户端组件，作为 Server Component 的子边界可以直接用，构建验证通过无需改动。
- **2.3**：`app/page.tsx` 的 `emojiSettings` effect 在原有 `replacements.length === 0` 早退之后，新增 `if (!replacements.some((r) => !r.isCustom)) return;`，全部替换项都是自定义时直接跳过 `setReplacements`，避免无谓的全局重绘。
- **2.4**：`lib/faceApi.ts` 删除了 `simulateProgressiveLoading` 整个函数（含 `setInterval` 伪造进度曲线的逻辑）。`loadSSDModel()` 和 `loadTinyModel(false)` 分支改为直接 `await loadSpecificModel(...)`，在调用前后各给 `progressCallback` 发一次通知（`loaded: 0/total: 1` 开始态、`loaded: 1/total: 1` 完成态），不再携带虚构的百分比。`types/index.ts` 的 `ModelLoadingProgressCallback` 去掉 `percentage` 字段，`ModelLoadingState` 去掉 `progress` 字段——影响面只有 `app/page.tsx`（初始 state、progress 回调 setter、`ensureDetectorModelLoaded` 里两处 `setModelLoadingState`）和 `ModelLoadingModal.tsx`，改动量小，选择了干净移除而不是保留死字段。`ModelLoadingModal.tsx` 删除了"加载进度 / N%"文字行和进度条 `<m.div>`，保留旋转图标、模型名展示、标题文案和提示语，呈现为不确定态加载。detector 切换的 toast 提示流程、`isModelLoaded` 判断等原有状态机未改动。

**首包体积对比**（`next build`，`/` 路由）：Phase 1 完成时基线 First Load JS 226 kB → Phase 2 完成后 196 kB（shared-by-all 102 kB）。

## 评审记录

- 2026-07-18 qa-runner 独立验证 Phase 2：lint ✅、tsc ✅、vitest 25/25 ✅、`next build` 成功（First Load JS 196 kB，shared 102 kB）；静态核对（10 处 framer-motion 导入串完好、无 `motion.*` 残留、layout 的 LazyMotion+domMax+strict 就位、FaceCanvas 主绘制路径只 blit 离屏 canvas、伪进度与 percentage 字段无残留、emojiSettings 判空早退在位）全部通过。实施插曲：fast-worker 的一次正则替换曾把 import 串损坏为 `'framer-m'`，当场修复，验证确认无残留。
- 2026-07-17 qa-runner 独立验证 Phase 1：lint ✅、tsc ✅、vitest 25/25 ✅、`next build` 成功（First Load JS 226 kB）、静态核对（landmark 无残留引用、SW APP_SHELL 无模型条目且 CACHE_VERSION=v2、默认检测器 tiny、模型按需加载）全部通过。
- 实施插曲：fast-worker 曾误删 AGENTS.md/CLAUDE.md/ROADMAP.md 并用 `git checkout HEAD` 恢复，导致已被有意删除的 ROADMAP.md 复活；编排层已重新删除并同步更新了 CLAUDE.md/AGENTS.md/README.md 中的 ROADMAP 引用（指向本文档）。
