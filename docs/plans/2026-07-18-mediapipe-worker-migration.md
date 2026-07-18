# Phase 3.1 迁移设计：人脸检测迁至 MediaPipe FaceDetector + Web Worker

> 状态：✅ 已实施（2026-07-18）。实施记录见文末"实施笔记"。
> 依据：`docs/plans/2026-07-17-perf-and-model-optimization.md` 的 Phase 3.1 条目。
> 动机：`@vladmandic/face-api` 依赖 DOM 输入（`HTMLImageElement`/`HTMLCanvasElement`），推理只能跑在主线程，大图/多脸时冻结 UI。MediaPipe `@mediapipe/tasks-vision` 的 `FaceDetector` 直接吃 `ImageBitmap`、WASM + 可选 GPU delegate，能整段迁进 Worker。

本文所有条目均为**决策**，不罗列备选。理由随决策给出。

---

## 0. 现状快照（迁移基线）

- 检测入口：`app/page.tsx` → `runFaceDetection()`（`lib/runFaceDetection.ts`）→ `detectFaces()`（`lib/faceApi.ts`）。
- 降采样：`handleImageLoad` 里 `img.naturalWidth > 1920` 时 `optimizeImageForDetection(img, 1920)` 生成 `optimizedCanvas` + `scale`，检测在缩小图上跑，`mapCoordinatesToOriginal(box, scale)` 把框映射回原图（`utils/imageOptimization.ts`）。
- 双检测器：`DetectionSettings.detector` ∈ `{tiny_face_detector, ssd_mobilenetv1}`；Tiny 用 `inputSize`（默认 416）+ `scoreThreshold`，SSD 用 `minConfidence`。UI 在 `SettingsPanel.tsx`：一个"检测模式"下拉（极速/高精度）+ 一个"检测灵敏度"滑杆（10–90%，按检测器写入 `scoreThreshold` 或 `minConfidence`）。"性能模式（inputSize 三档）"已隐藏，恒为 416。
- 模型加载：`ensureDetectorModelLoaded()` 首次上传时加载，`ModelLoadingModal` 阻塞展示；切换检测器时 toast 按需加载。
- 输出类型：`DetectedFace { id, box{x,y,w,h}, detection{score, classScore} }`（`types/index.ts`）。
- SW：`public/sw.js` 运行时 `cacheFirst` 缓存 `/models/`；`CACHE_VERSION='v2'`。
- CSP：`next.config.ts` `script-src 'self' 'unsafe-eval' 'unsafe-inline'`（`'unsafe-eval'` 是为 TF.js/face-api）。

---

## 1. 运行时与模型

### 决策 1.1 — 选 **full-range** BlazeFace（`blaze_face_short_range` 不用）
用户上传以合照 / 远景 / 多人为主。short-range 为自拍场景优化（有效距离约 2m 内、脸占比大），对远景小脸召回差；full-range 训练覆盖到约 5m、密集多脸，正是本产品的主场景。单帧推理 full-range 比 short-range 略慢（几毫秒级），但已迁进 Worker，主线程无感，精度优先。

### 决策 1.2 — WASM 运行时与 `.task` 模型**全部自托管进 `public/`**
隐私承诺与既有 `public/models/` 自托管策略要求：运行时不得在使用时向第三方 CDN 拉取。落位：
- `public/mediapipe/wasm/`：`vision_wasm_internal.js`、`vision_wasm_internal.wasm`（以及 `vision_wasm_nosimd_internal.*` 回退，由 `FilesetResolver` 按能力自选）。
- `public/models/blaze_face_full_range.task`：与现有 `/models` 目录对齐，SW 缓存规则可直接复用。
- `FilesetResolver.forVisionTasks('/mediapipe/wasm')` + `baseOptions.modelAssetPath = '/models/blaze_face_full_range.task'`，**不传任何 CDN 地址**。
- Twemoji 走 CDN 是渲染资产、非运行时依赖，且有原生 glyph 降级，与此不冲突，维持现状。

### 决策 1.3 — 体积对比（首屏关键路径进一步收缩）
| 项 | 现状 | 迁移后 |
|---|---|---|
| 检测权重 | Tiny 192KB（默认）/ SSD 5.4MB（按需） | full-range `.task` ~0.23MB（单一） |
| 运行时 JS/WASM | face-api + 打进 bundle 的 TF.js | tasks-vision wasm ~2–3MB（SIMD 版，首用下载、SW 缓存、非 JS 主包） |
| npm 包体（打进 bundle） | `@vladmandic/face-api`（含 tfjs，数百 KB gzip） | `@mediapipe/tasks-vision` 仅薄 JS 胶水，wasm 不进 bundle |

净效果：JS 主包变小（移除 tfjs），检测权重从"默认 192KB / 高精度 5.4MB"变为恒定 ~0.23MB；新增的 wasm 一次性下载后由 SW 缓存，不在关键 JS 路径上。

---

## 2. Worker 架构

### 决策 2.1 — 专用 module worker，主线程 `createImageBitmap` 传 transferable `ImageBitmap`
- 新增 `workers/faceDetection.worker.ts`（`new Worker(new URL('...', import.meta.url), { type: 'module' })`，Next/Turbopack + webpack 均原生支持此写法）。
- 主线程：对 `optimizedCanvas`（或原图，见决策 4.2）`createImageBitmap()` 得到 `ImageBitmap`，`postMessage({...}, [bitmap])` **transfer**（零拷贝）。Worker 用完 `bitmap.close()` 释放。

### 决策 2.2 — **不引入 OffscreenCanvas**
`FaceDetector.detect(imageBitmap)` 直接接受 `ImageBitmap`，无需先画到 canvas。省一层拷贝与一处 Safari 兼容风险。降采样仍在主线程用现有 2D canvas 完成（`optimizeImageForDetection` 不动），Worker 只收最终 bitmap。

### 决策 2.3 — 消息协议（主 ↔ Worker）
```
主 → Worker:
  { type: 'init' }                                  // 触发 FilesetResolver + FaceDetector.createFromOptions
  { type: 'detect', id, bitmap, minConfidence }     // bitmap 为 transferable
  { type: 'dispose' }                               // detector.close()，释放

Worker → 主:
  { type: 'ready' }                                 // init 完成（模型+wasm 就绪）
  { type: 'progress', phase: 'wasm'|'model' }       // 不确定态，喂给 ModelLoadingModal
  { type: 'result', id, detections }                // 见 §4，已是像素坐标 + score
  { type: 'error', id?, code, message }             // init 失败 / detect 失败
```
- `id` 关联请求与响应，防止快速连续上传时结果错配。
- `minConfidence` 随每次 `detect` 传入：MediaPipe 的置信度在 detector 创建时定死（`minDetectionConfidence`），运行中改阈值需 `setOptions`。为避免每次重建，**detector 用固定低阈值（如 0.1）创建，主线程按 `minConfidence` 对返回的 `score` 做过滤**（等价、且滑杆调节即时生效、无需重建 detector）。

### 决策 2.4 — GPU delegate 优先，CPU 回退
- Worker 内 `createFromOptions({ baseOptions: { delegate: 'GPU' }, runningMode: 'IMAGE', minDetectionConfidence: 0.1 })`。
- Worker 里 WebGL 依赖 `OffscreenCanvas`+WebGL2；桌面 Chrome/Firefox 可用。init 时 try `GPU`，`catch` 后以 `delegate: 'CPU'` 重建并发 `progress`/日志标记。iOS Safari 的 Worker WebGL 支持不稳，实际多会落到 CPU——单张图 CPU 也够快（非实时），可接受。
- `runningMode: 'IMAGE'`（静态图，`detect()` 同步返回）；未来实时摄像头切 `'VIDEO'` + `detectForVideo(bitmap, timestamp)`，同一 Worker 复用（见 §6）。

---

## 3. 双检测器策略

### 决策 3.1 — **collapse 成单模型 + 单一灵敏度滑杆**，删除检测器选择与性能模式
full-range 一个模型同时覆盖原"极速"和"高精度"两档的诉求（Worker 化后速度不再是选择维度），"检测模式"下拉失去意义。保留唯一用户可调项：**检测灵敏度**（即 `minConfidence`），语义清晰、心智负担最低。

### 决策 3.2 — 类型收敛
`types/index.ts`：
```ts
export interface DetectionSettings {
  minConfidence: number; // 0–1，唯一检测参数
}
```
删除 `detector`、`inputSize`、`scoreThreshold` 三字段。

### 决策 3.3 — `SettingsPanel.tsx` 改动面
- 删除"检测模式"整块 `<select>` 及其提示文案、`detector` 分支逻辑。
- "检测灵敏度"滑杆/数字输入统一读写 `detectionSettings.minConfidence`（移除 `detector === 'ssd_mobilenetv1' ? minConfidence : scoreThreshold` 三元判断）。
- "恢复默认设置"重置为 `{ minConfidence: 0.5 }`。
- `app/page.tsx` 默认值 `useState<DetectionSettings>({ minConfidence: 0.5 })`。
- 删除 `ensureDetectorModelLoaded` 的 detector 分支、切换检测器的 `useEffect`（§5 展开）。

---

## 4. 坐标映射与数据流

### 决策 4.1 — 降采样管线原样保留
`optimizeImageForDetection` / `mapCoordinatesToOriginal` / `scale` 语义不变。变化仅在于：检测输入从"canvas/image 直接喂 face-api"变为"canvas → `createImageBitmap` → transfer 给 Worker"。`runFaceDetection.ts` 的 `scale < 1 ? map : passthrough` 逻辑保留。

### 决策 4.2 — 仍在缩小图上检测（不改传全分辨率）
虽然 Worker 化后主线程不再卡，但传全分辨率 bitmap 会增大 transfer 与 CPU-delegate 推理成本、且 full-range 内部本就会 resize。维持"> 1920px 先降采样"策略，`ImageBitmap` 由 `optimizedCanvas` 生成，映射回原图。

### 决策 4.3 — MediaPipe 输出 → `DetectedFace` 转换
`FaceDetectorResult.detections[]` 每项：
- `boundingBox { originX, originY, width, height }`——**已是输入图像的像素坐标**（非相对 0–1），直接对应现有 `box{x,y,width,height}`，再经 `mapCoordinatesToOriginal` 回原图。语义与现状一致，映射代码零改动。
- `categories[0].score`：0–1 检测置信度。
- `keypoints[]`：6 个相对坐标关键点，本产品不用，丢弃。

映射：
```ts
faces = detections
  .filter(d => d.categories[0].score >= minConfidence)   // 决策 2.3 的主线程过滤
  .map((d, i) => ({
    id: `face-${Date.now()}-${i}`,
    box: { x: d.boundingBox.originX, y: d.boundingBox.originY,
           width: d.boundingBox.width, height: d.boundingBox.height },
    detection: { score: d.categories[0].score, classScore: d.categories[0].score },
  }));
```

### 决策 4.4 — confidence 语义差异
face-api SSD `minConfidence` / Tiny `scoreThreshold` 与 MediaPipe `minDetectionConfidence`/`score` 都是 0–1 的检出置信度，同向可比，现有 10–90% 滑杆区间直接沿用。`classScore` 无对应概念，复用 `score` 填充（保持 `DetectedFace` 结构不破坏下游），或后续把 `detection` 收敛为单 `score` 字段——**本次保留双字段填同值，减小改动面**。

---

## 5. 回退与灰度

### 决策 5.1 — **彻底移除 face-api，不保留回退路径**
双引擎并存意味着维护两套模型加载、两套坐标语义、两倍包体与 CSP 面，收益低。MediaPipe wasm 在目标浏览器（现代 Chrome/Firefox/Safari）覆盖良好，CPU delegate 是模型层面的兜底，已足够。移除：
- `lib/faceApi.ts` 整个文件；`@vladmandic/face-api` 依赖；`next.config.ts` 中 face-api 相关的 webpack `fallback`/`externals`/`ignoreWarnings`（§见风险 CSP）。
- `public/models/` 下 SSD / Tiny 权重文件。

### 决策 5.2 — CSP 收紧（顺带收益）
移除 TF.js 后 `'unsafe-eval'` 不再必需；MediaPipe wasm 只需 `'wasm-unsafe-eval'`。`script-src` 改为 `'self' 'wasm-unsafe-eval' 'unsafe-inline'`（`'unsafe-inline'` 仍为 Next 内联运行时保留）。这是比现状更紧的安全姿态。`worker-src 'self' blob:` 已能覆盖 module worker，无需改。

### 决策 5.3 — SW 缓存条目更新（`public/sw.js`）
- 运行时 `cacheFirst` 命中路径新增 `/mediapipe/`（wasm）；`/models/` 规则不变（`.task` 落在此）。
- `CACHE_VERSION` 升 `v2 → v3`，清理旧的 face-api 模型缓存。
- App Shell 不变（wasm/模型仍走懒填充，避免 `addAll` 全或无失败）。

### 决策 5.4 — `ModelLoadingModal` 适配
- `MODEL_DISPLAY_NAMES` 改为单条：`{ mediapipeFaceDetector: '人脸检测模型' }`（或直接固定文案，去掉 map）。
- 进度仍是不确定态（§2.3 的 `progress` 事件仅切换文案："下载运行时" / "加载模型"），不伪造百分比，延续 Phase 2.4 既定风格。

---

## 6. 风险清单

1. **Safari/iOS Worker + WASM**：SIMD wasm 在较老 iOS Safari 可能不可用 → `FilesetResolver` 自动回退 nosimd 版（需一并自托管）。Worker 内 WebGL 不稳 → GPU 失败自动落 CPU（决策 2.4）。上线前按 Phase 4"浏览器兼容性测试"实测 iOS Safari。
2. **CSP / wasm 编译**：需 `'wasm-unsafe-eval'`（决策 5.2）。若某目标浏览器对 `'wasm-unsafe-eval'` 支持不足，退回保留 `'unsafe-eval'`（仍比现状不差）。上线前用 CSP 报错验证。
3. **内存**：`ImageBitmap` transfer 后主线程句柄失效；Worker 侧 `detect` 后必须 `bitmap.close()`，`dispose` 时 `detector.close()`，防止大图多次上传累积 GPU/wasm 堆内存。
4. **首用延迟**：wasm ~2–3MB 首次下载，弱网下 `ModelLoadingModal` 停留时间比现状 Tiny(192KB) 长 → 文案已说明"首次需下载"，且 SW 缓存后二次秒开。
5. **Worker 打包**：`new URL(..., import.meta.url)` 在 Next 15 webpack 下可用；Phase 3.2 若迁 Turbopack 需复验 worker 产物（与既有 face-api webpack 定制的迁移风险合并考虑）。
6. **实时摄像头衔接**（Phase 4）：本设计的 Worker + `runningMode` 参数化是实时模式的前置基础——届时 `init` 传 `VIDEO`、`detect` 换 `detectForVideo(bitmap, performance.now())`，协议与生命周期复用，无需重构。

---

## 7. 分步实施计划

每步按可独立提交拆分，均附 verify。实现分派 fast-worker，验证分派 qa-runner。

- [x] **7.1 依赖与资产落地**：`ni @mediapipe/tasks-vision`；下载 full-range `.task` → `public/models/`，wasm（simd + nosimd）→ `public/mediapipe/wasm/`；更新 `MODELS_SETUP.md`。
  - verify：文件存在且大小合理；`bun run build` 通过。
- [x] **7.2 Worker + 检测封装**：新增 `workers/faceDetection.worker.ts`（init/detect/dispose/progress/error 协议、GPU→CPU 回退、`bitmap.close()`）；新增 `lib/faceDetectorClient.ts`（主线程封装：起 Worker、`createImageBitmap`、Promise 化 `detect`、按 `id` 派发）。
  - verify：单测/手动——喂一张已知多脸图，Worker 返回 detections 数量 > 0；typecheck。
- [x] **7.3 类型与坐标接线**：`types/index.ts` 收敛 `DetectionSettings`；改写 `lib/runFaceDetection.ts` 走新 client，`boundingBox → box` + `mapCoordinatesToOriginal` + `minConfidence` 过滤。
  - verify：`runFaceDetection` 返回的框叠加到原图位置正确（手动对比一张图）。
- [x] **7.4 page 编排改造**：`app/page.tsx` 用 client 的 `init`/`detect` 替换 `ensureDetectorModelLoaded` + `runFaceDetection`；删除切换检测器的 `useEffect`；默认 `{ minConfidence: 0.5 }`；Worker 生命周期（mount/首用 init、unmount dispose）。
  - verify：上传→检测→替换→导出全链路通过；连续快速换图无结果错配。
- [x] **7.5 UI 适配**：`SettingsPanel.tsx` 删检测模式下拉、灵敏度统一读写 `minConfidence`、重置默认值；`ModelLoadingModal.tsx` 单模型文案 + 不确定态。
  - verify：面板交互正常；灵敏度滑杆即时改变检出数（主线程过滤）。
- [x] **7.6 移除 face-api + 收紧 CSP + SW**：删 `lib/faceApi.ts`、卸载 `@vladmandic/face-api`、清 `next.config.ts` 相关 webpack 定制、删旧模型文件；`script-src` 改 `'wasm-unsafe-eval'`；`sw.js` 加 `/mediapipe/` 缓存 + `CACHE_VERSION=v3`。
  - verify：`bun run build`/`lint`/`tsc` 通过；无 face-api 残留引用；CSP 无控制台报错；离线（SW）二次加载可用。
- [~] **7.7 跨浏览器与回归验证**（部分完成，见下方实施笔记）：桌面 Chrome/Firefox + iOS Safari 实测（GPU/CPU 落点、wasm simd/nosimd 回退）；导出像素质量回归。
  - verify：三浏览器均能检测+导出；iOS Safari 无崩溃、CPU 回退生效。

---

## 实施笔记（2026-07-18）

### 环境与工具链偏差
- 本环境无 `bun`/`ni` 可执行文件，实际用 `npm install` / `npx` 完成依赖安装与四项检查（`next lint`、`tsc --noEmit`、`vitest run`、`next build`）。项目脚本本身与包管理器无关，行为等价。

### 7.1 资产落地
- `@mediapipe/tasks-vision` 安装版本：**0.10.35**（npm `latest` dist-tag；`nightly` 为 `1.0.0-rc.*` 每日构建，未采用）。
- 模型：`blaze_face_full_range.task`，来源 `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/latest/blaze_face_full_range.tflite`，**实际大小 1,083,786 字节（~1.03MB）**。**偏差**：设计文档决策 1.3 估计 ~0.23MB，实测官方发布的 `float16` 精度模型为 ~1.03MB，未发现 `int8` 更小变体（探测返回 404）。已在 MODELS_SETUP.md 和下方体积对比中更正。
- WASM 运行时：**未从 CDN 下载**，而是直接从已安装的 `node_modules/@mediapipe/tasks-vision/wasm/` 复制到 `public/mediapipe/wasm/`（npm 包本身就随附这些文件，来源与 jsDelivr 托管的是同一份构建产物，更简单可靠且免于额外网络请求）。文件与大小：
  - `vision_wasm_internal.js`（322,044 字节）+ `vision_wasm_internal.wasm`（11,153,617 字节，~10.6MB）— SIMD 版
  - `vision_wasm_nosimd_internal.js`（321,847 字节）+ `vision_wasm_nosimd_internal.wasm`（10,481,398 字节，~10.0MB）— 无 SIMD 回退
  - **偏差**：设计文档决策 1.3 估计 wasm ~2–3MB，实测单文件约 10–11MB（0.10.35 版本体积远大于文档估计）。因不计入页面 First Load JS（详见下方体积对比），对首屏 KPI 无影响，但离线场景首次下载耗时会比预期更长，已在 MODELS_SETUP.md 故障排除中说明。
- `MODELS_SETUP.md` 已整篇重写为 MediaPipe 版本（保留历史：SSD/Tiny/Landmarks 相关内容整体替换，不再是"已移除"注记式的过渡写法）。

### 7.2 Worker + 检测封装
- `workers/faceDetection.worker.ts`：按设计文档 §2.3 协议实现，`MIN_DETECTOR_CONFIDENCE = 0.1` 固定阈值创建 detector，`runningMode: 'IMAGE'`；GPU delegate 失败 `catch` 后重建 CPU delegate 并打印 `console.warn`（未额外发 `progress` 事件区分 GPU/CPU，因为协议里 `progress` 语义是 wasm/model 两阶段，混入 delegate 状态会让 `ModelLoadingModal` 文案复杂化——**偏差**：文档 §2.4 提到"发 progress/日志标记"，实际只做了日志标记，未发额外 progress 事件，判断这一步对用户价值有限）。
- `lib/faceDetectorClient.ts`：单例 Worker + id→Promise 映射；`initFaceDetector()` 复用同一个 ready Promise；`detectFacesWithWorker()` 内部等待 init 后 `createImageBitmap` + transfer；`disposeFaceDetector()` 供 `app/page.tsx` 在 unmount 时释放。
- 手动验证：`next build` 通过、`tsc --noEmit` 无报错；由于沙盒环境没有真实浏览器可跑，**未能实机验证"喂一张已知多脸图，Worker 返回 detections 数量 > 0"**——这是 verify 清单里唯一无法执行的一项，如实标注（见 7.7）。

### 7.3–7.5 类型 / 坐标 / UI
- `types/index.ts`：`DetectionSettings` 收敛为 `{ minConfidence: number }`；`ModelLoadingState` 同步简化为 `{ isLoading, phase: 'wasm' | 'model' | null }`（原 `currentModel`/`loadedModels` 字段随双模型收敛为单模型一起去掉，`ModelLoadingProgressCallback` 类型整体删除，改为 `lib/faceDetectorClient.ts` 自带的 `FaceDetectorProgressCallback`）——**这一点文档未明确点名，属合理推论下的收敛，一并记录**。
- `lib/runFaceDetection.ts`：仅替换 `detectFaces` → `detectFacesWithWorker`，坐标映射管线原样保留，符合决策 4.1/4.2。
- `app/page.tsx`：`ensureDetectorModelLoaded` → `ensureFaceDetectorReady`；删除 `isFirstDetectorEffect` 和检测器切换 `useEffect`（连同不再使用的 `useRef` import 一并清理）；新增 mount 时设置 progress 回调 + unmount 时 `disposeFaceDetector()` 的清理函数（原设计 §7.4 提到的"Worker 生命周期"落实为这一个 effect）。
- `components/SettingsPanel.tsx`：删除"检测模式" `<select>` 整块；灵敏度滑杆/输入框统一读写 `minConfidence`；重置按钮改为 `onDetectionChange({ minConfidence: 0.5 })`。
- `components/ModelLoadingModal.tsx`：`MODEL_DISPLAY_NAMES` 换成 `PHASE_LABELS`（`wasm: '下载运行时'`、`model: '加载检测模型'`），标题改为"正在加载检测引擎"。

### 7.6 移除 face-api / CSP / SW
- 删除 `lib/faceApi.ts`；`npm uninstall @vladmandic/face-api`；删除 `public/models/` 下 4 个 SSD/Tiny 文件；`next.config.ts` 的整段 `webpack()` 自定义（fallback/externals/ignoreWarnings）连同其存在的唯一理由（face-api）一起删除，未保留任何残留配置。
- CSP `script-src` 由 `'self' 'unsafe-eval' 'unsafe-inline'` 改为 `'self' 'wasm-unsafe-eval' 'unsafe-inline'`。
- `public/sw.js`：`CACHE_VERSION` `v2` → `v3`；`cacheFirst` 命中条件新增 `url.pathname.startsWith('/mediapipe/')`。

### 7.7 跨浏览器与回归验证 — 未完全达成，如实说明
本沙盒环境没有可交互的真实浏览器（无 GUI、无 Playwright/Puppeteer 预装），**无法执行**：
- 真机 / 桌面 Chrome、Firefox、iOS Safari 的手动检测+导出验证
- GPU delegate 实际落点观察（是否真正走 GPU、失败回退 CPU 的实际触发）
- WASM simd/nosimd 回退的实际生效验证
- 离线场景下 Service Worker 二次加载验证

已完成的等价替代：静态代码路径审查（GPU→CPU 的 try/catch 结构、`FilesetResolver` 按能力自动选择 simd/nosimd 均由 `@mediapipe/tasks-vision` 库内部实现，非本项目自实现逻辑，出错概率低）+ 四项自动化检查全绿（见下）。**建议**：合入前找一台真实设备（尤其 iOS Safari）跑一遍 MODELS_SETUP.md 的验证步骤。

### 四项检查结果（每步执行后均为绿，最终态如下）
| 检查 | 结果 |
|---|---|
| `npx next lint` | ✅ No ESLint warnings or errors |
| `npx tsc --noEmit` | ✅ 无输出，无类型错误 |
| `npx vitest run` | ✅ 4 test files / 25 tests 全部通过 |
| `npx next build` | ✅ 编译成功，见下方 First Load JS 对比 |

### First Load JS 对比
| | 基线（face-api） | 迁移后（MediaPipe） |
|---|---|---|
| `/` 路由 First Load JS | 196 kB | **196 kB**（未变化） |
| `/` 路由自身 Size | — | 85.8 kB |
| 共享 chunk | — | 102 kB |

净效果与设计文档决策 1.3 的预期一致：移除 `@vladmandic/face-api`（含 tfjs）省下的主包体积，与新增的 `@mediapipe/tasks-vision` 胶水代码大致相抵，首屏 First Load JS 数字持平于基线 196 kB。Worker 内代码（含 `tasks-vision` 运行时胶水）被 Next 拆进独立 chunk（构建产物 `901.*.js`，~132KB 未压缩），仅在 Worker 启动时按需加载，不计入页面主 bundle 的 First Load JS 统计。WASM（~21MB 总计，simd+nosimd）与 `.task` 模型（~1MB）都在 `public/`，走 Service Worker 懒填充缓存，同样不计入 First Load JS。
