# PC 实时摄像头(一期:实时预览 + 拍照导出)

## 背景与范围

`docs/real-time-camera.md` 的规范一直未实现。本期收缩范围为 **PC-only、实时预览 + 拍照**:

- ✅ 实时视频预览 + emoji 实时叠加(检测跑在现有 MediaPipe worker 中)
- ✅ 拍照:冻结当前帧,进入**现有静态图片编辑流程**(编辑、撤销、导出全部复用)
- ✅ 无摄像头 / 权限拒绝 / 设备被占用的错误处理;多摄像头时提供设备选择
- ❌ 不做:视频录制、移动端适配(入口在 `md` 以下断点隐藏)、前后摄切换(`facingMode`)、暂停/恢复

## 关键决策

1. **拍照即退出实时模式**:快照帧转成 `HTMLImageElement` 后走现有 `handleImageUpload` 同一条管线(重新检测、编辑、导出),不为实时模式单独做编辑态。这是复用最大化的核心决策。
2. **实时叠加是"预览质量",快照后才是"编辑质量"**:实时阶段只画 emoji 跟脸,不支持点选/逐脸调整;拍照后用户在熟悉的编辑器里精修。
3. **检测节流 + 平滑**:检测循环目标 ~10 次/秒(worker 往返 + 推理在 PC 上约 30–60ms,留余量),渲染循环 rAF 全速跑,emoji 框位置用指数平滑(EMA,α≈0.35)插值,消除抖动。
4. **worker 复用**:`detectFacesWithWorker` 目前收 `HTMLImageElement | HTMLCanvasElement`;`createImageBitmap` 原生支持 `HTMLVideoElement`,只需放宽入参类型,worker 协议零改动。
5. **入口显隐**:`navigator.mediaDevices?.enumerateDevices()` 查到 `videoinput` 才显示"实时模式"按钮(此调用不触发权限弹窗);同时要求 `isSecureContext`。桌面断点(`md+`)才渲染。

## 实施步骤

1. **`lib/cameraStream.ts`** — 媒体访问层 → 验证:单元测试(错误码映射)
   - `startCameraStream(deviceId?)`:`getUserMedia({ video: { deviceId, width: {ideal:1280}, height: {ideal:720} } })`,返回 `{ stream, stop() }`
   - `listVideoInputs()`:过滤 `enumerateDevices`
   - 错误映射:`NotFoundError` / `NotAllowedError` / `NotReadableError` → 语义化错误码,供 UI 提示
2. **`lib/faceDetectorClient.ts`** — 放宽 `detect` 入参为 `| HTMLVideoElement` → 验证:typecheck
3. **`hooks/useLiveDetection.ts`** — 检测 + 平滑循环 → 验证:平滑函数单元测试
   - 节流检测循环(上一次 resolve 后再发下一帧,自然背压,不设固定 interval)
   - 按 IoU 匹配前后帧人脸,box 做 EMA 平滑;连续 N 次(≈3)丢失才移除,避免闪烁
   - 组件卸载时停止循环
4. **`components/LiveCameraView.tsx`** — 实时视图 → 验证:手动冒烟
   - `<video>`(镜像显示 `scaleX(-1)`)+ 叠加 `<canvas>` 画 emoji(复用 `drawEmojiReplacement`,默认 emoji 可选)
   - 底部:拍照按钮、设备选择下拉(>1 个摄像头时)、退出按钮
   - 状态机:`requesting → streaming → error`,error 态给重试 + 返回上传模式
   - 拍照:把视频帧画到 canvas(**不镜像**,导出真实方向)→ `canvas.toBlob` → `HTMLImageElement` → 调 `page.tsx` 现有上传处理
5. **`app/page.tsx` + `components/ImageUploader.tsx`** — 入口与模式切换 → 验证:手动冒烟
   - 上传面板加"实时模式"按钮(`md+` 且检测到摄像头且 secure context)
   - `page.tsx` 增加 `mode: 'upload' | 'live' | 'edit'` 级别的视图切换;进入实时模式时预热 `initFaceDetector()`
6. **i18n** — `lib/i18n/en.ts` / 中文对应文件补文案(按钮、三种错误提示)→ 验证:typecheck
7. **整体验证** — lint / typecheck / 全量单测 + 手动:授权、拒绝、无摄像头(可用 Chrome DevTools 传感器模拟)、被占用、多设备切换、拍照进编辑器、导出

## 委派

- 步骤 1–3(库与 hook,含测试):fast-worker
- 步骤 4–5(UI 集成,需贴合现有布局/动效风格):fast-worker,完成后我审
- 步骤 7:qa-runner
- 平滑/跟踪算法若实现中遇到抖动难调:deep-reasoner

## 风险

- **worker 忙时帧堆积**:用"上一次检测返回后才发下一帧"的自然背压,不会堆积。
- **首次进入模型加载 2–3s**:进入实时模式立即 `initFaceDetector()` 并复用现有 LoadingOverlay 文案。
- **镜像一致性**:预览镜像、导出不镜像是主流相机应用惯例,但 emoji 叠加坐标要在镜像坐标系下画,注意换算,这是最容易出 bug 的点。
- **隐私定位不变**:全程本地处理,无任何上传;README 隐私声明无需改动,但可补一句实时模式说明。

## Implementation Notes

实际实现：

- 新增 `lib/cameraStream.ts`、`hooks/useLiveDetection.ts`、`components/LiveCameraView.tsx`；并新增对应的 `lib/cameraStream.test.ts` 与 `hooks/useLiveDetection.test.ts`。
- `app/page.tsx` 以 `upload | live | edit` 管理视图；仅在安全上下文、浏览器支持媒体设备且无权限预检的 `enumerateDevices()` 发现 `videoinput` 时，显示 `md+` 实时模式入口。实时模式禁用窗口拖放。
- 拍照由 `LiveCameraView` 将未镜像的原始视频帧转为 `HTMLImageElement`，直接复用现有 `handleImageLoad` 进入静态图片编辑、撤销和导出管线。计划原文中的 `handleImageUpload` 为笔误。
- 实时检测使用约 100ms 的最小间隔和“上一帧完成后才调度下一帧”的自然背压；渲染保持 `requestAnimationFrame` 全速，跟踪框由 hook 做 EMA 平滑。
- 视频预览使用 CSS 镜像；覆盖层不整体镜像，单个检测框按 `videoWidth - box.x - box.width` 转换到镜像坐标后绘制 emoji。快照和导出保持原始方向。
- 相机视图包含授权后的设备重新枚举、多设备下拉、重试/返回上传、流/track/`srcObject` 清理，以及请求 generation 防止旧设备请求覆盖新请求。
- 实现期间的局部测试、TypeScript 检查和 lint 仅作为实现反馈；最终完整摄像头场景验证由用户执行。

本期未实现视频录制、移动端支持、前后摄切换或暂停/恢复。

## Review Notes

- 主审发现实时入口直接调用 detector 初始化会遗漏现有 LoadingOverlay 的完成状态；已改为复用 `ensureFaceDetectorReady()`，并用进入请求 token 防止用户退出后的过期回调改变模式。
- 主审发现初始默认相机流可能与设备下拉的第一项不一致；已在成功建流后从 active video track 的 `getSettings().deviceId` 同步（显式选择时保留显式 id）。
- 主审发现切换设备时 `getUserMedia` 早期失败会将仍在运行的旧预览 source 清空；已在发起请求前保存旧 `srcObject`，失败时恢复并尝试继续播放，保留旧流和预览。
- 主审确认 `cameraStream` 对原生 `TypeError` 映射为 `unsupported`，供 UI 展示可理解的错误提示。
- 最终 lint 仅由 qa-runner 运行 `npm run lint`：首次发现 hook 的 1 个 error 与 1 个 warning，均已修复；复跑退出码为 1、共 483 个问题（10 errors / 473 warnings），但本次新增或修改文件为 0 error / 0 warning。10 个 errors 全来自 `public/mediapipe/wasm` 下两个生成文件；既有源码另有 `EmojiToolbar` 与 `download-twemoji` 各 1 个 warning。未运行用户保留的完整摄像头验证。
- 用户后续授权后，qa-runner 执行 `npm test`，退出码为 0（7 files、36 tests）；`npm run build` 退出码为 0（编译、Next 类型检查、静态页面 5/5 均成功）。项目没有独立 typecheck 脚本；build 仅报告既有 `components/EmojiToolbar.tsx:129:19` 的 `no-img-element` warning。真实摄像头的手动场景仍未执行。
