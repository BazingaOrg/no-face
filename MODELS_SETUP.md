# 模型/运行时资产设置指南

## 当前状态

人脸检测基于 `@mediapipe/tasks-vision`（`FaceDetector`），在专用 Web Worker 中运行（`workers/faceDetection.worker.ts`）。**两类资产都自托管在 `public/`，运行时零 CDN 请求**，与项目的隐私承诺一致。

- `public/models/blaze_face_full_range.task` — full-range BlazeFace 检测模型（~1.03MB，`float16` 精度，官方唯一发布精度，无 int8 变体）
- `public/mediapipe/wasm/` — WASM 运行时，随 `@mediapipe/tasks-vision` npm 包分发，非从 CDN 下载：
  - `vision_wasm_internal.js` / `.wasm`（SIMD，现代浏览器默认使用，~11MB）
  - `vision_wasm_nosimd_internal.js` / `.wasm`（无 SIMD 回退，供不支持 SIMD 的旧浏览器，~10.5MB）
  - `FilesetResolver.forVisionTasks('/mediapipe/wasm')` 按浏览器能力自动选择，不需要手动区分

已移除：`@vladmandic/face-api`、`public/models/` 下的 SSD MobileNet V1 / Tiny Face Detector 权重文件（2026-07-18 迁移，详见 `docs/plans/2026-07-18-mediapipe-worker-migration.md`）。Face Landmarks 68 更早之前已移除（全库无调用点）。

---

## 如何重新获取这些资产（例如升级版本、重装依赖后重新落地）

### 1. 安装 npm 包

```bash
npm install @mediapipe/tasks-vision@0.10.35
```

### 2. 下载检测模型（来自 Google 官方存储桶，非第三方镜像）

```bash
curl -L -o public/models/blaze_face_full_range.task \
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/latest/blaze_face_full_range.tflite"
```

> 注意：文件后缀虽然从 `.tflite` 下载，但按 MediaPipe Tasks 的约定重命名/落位为 `.task`（Task 文件本质是打包了模型 + 元数据的容器格式，`modelAssetPath` 直接指向它即可，无需转换）。

full-range 而非 short-range 的选择理由：本产品以合照/远景/多人场景为主，full-range 训练覆盖到约 5m 距离、密集多脸，召回优于为自拍场景优化的 short-range。

### 3. 复制 WASM 运行时（随 npm 包分发，不是从 CDN 下载）

```bash
cp node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js public/mediapipe/wasm/
cp node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm public/mediapipe/wasm/
cp node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.js public/mediapipe/wasm/
cp node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.wasm public/mediapipe/wasm/
```

---

## 验证安装

```
public/models/
└── blaze_face_full_range.task

public/mediapipe/wasm/
├── vision_wasm_internal.js
├── vision_wasm_internal.wasm
├── vision_wasm_nosimd_internal.js
└── vision_wasm_nosimd_internal.wasm
```

1. `npm run dev`，上传一张含人脸的图片
2. 首次加载会短暂显示"正在加载检测引擎"弹窗（下载运行时 / 加载检测模型两个阶段文案，不显示假进度百分比）
3. 检测成功后弹窗消失，人脸框正常显示
4. 打开浏览器 DevTools → Network，确认 `/mediapipe/` 与 `/models/` 下的请求都是同源 200（无第三方 CDN 请求）

---

## 故障排除

### 弹窗一直转圈 / 检测失败？

- 确认 `public/models/blaze_face_full_range.task` 和 `public/mediapipe/wasm/` 下 4 个文件都存在且未损坏（比对文件大小，`.task` 约 1MB，simd wasm 约 11MB，nosimd wasm 约 10.5MB）
- 打开控制台，`workers/faceDetection.worker.ts` 内 GPU delegate 失败会打印一条 `console.warn` 并自动回退 CPU，属正常路径，不是错误
- 确认 CSP 的 `script-src` 含 `'wasm-unsafe-eval'`（`next.config.ts`），否则 WASM 编译会被浏览器拦截

### 离线（Service Worker）二次加载失败？

- 确认 `public/sw.js` 的 `CACHE_VERSION` 已升级（v3 起包含 `/mediapipe/` 缓存路由），旧版本 SW 缓存不会自动包含新路径，需要等待 `activate` 事件清理旧缓存后刷新一次

---

## 性能与体积参考

| 项 | 说明 |
|---|---|
| 检测权重 | `blaze_face_full_range.task` ~1.03MB，单次下载后由 Service Worker 缓存 |
| WASM 运行时 | ~11MB（simd）/ ~10.5MB（nosimd），首次使用下载一次，不计入页面 First Load JS（按需由 Worker 加载，非页面主 bundle） |
| npm 包体（进主 bundle 的部分） | `@mediapipe/tasks-vision` 仅浏览器胶水代码，wasm/model 不打进 JS bundle |
| 检测运行位置 | 专用 Web Worker，全程不阻塞主线程/UI |

---

## 未来方向（暂未使用）

- 实时摄像头模式：Worker 的 `runningMode` 参数化已是前置基础，届时把 `init` 的 `runningMode` 切到 `'VIDEO'`，`detect` 换成 `detectForVideo(bitmap, timestamp)`，协议与生命周期可直接复用，见 `docs/plans/2026-07-18-mediapipe-worker-migration.md` §6.6。
