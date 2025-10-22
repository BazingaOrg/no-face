# 🎥 Real-time Camera & Recording Specification / 实时摄像头与录制规范

## Overview / 概述

Provide a privacy-preserving live camera mode that mirrors the existing image workflow while unlocking real-time emoji masking and optional recording. 所有处理继续在浏览器本地执行，遵循当前隐私定位。

## Feature Goals / 功能目标

- Deliver a front-facing and rear-facing camera experience with instant emoji overlays powered by `@vladmandic/face-api`.
- Preserve existing emoji editing semantics: per-face adjustments、全局设置和默认表情应保持一致的交互与视觉语言。
- Offer one-tap snapshot export 复用现有 PNG 导出流程，并在后续阶段支持视频录制。
- Keep latency < 150 ms on 主流桌面与移动设备，确保 UI 流畅可用。

## Architecture / 架构设计

### Media Access Layer / 媒体访问层

- Use `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })` 请求前置摄像头；在失败或用户切换时 fallback 到 `{ facingMode: { exact: 'environment' } }`。
- 暴露 Promise 风格 API，返回 `MediaStream`、当前模式（前置/后置）以及 revoke 方法，便于状态机管理。
- 所有权限申请需在用户手势触发的回调中执行；在 HTTP 环境下阻止进入实时模式并提示升级到 HTTPS 或 localhost。

### Rendering Pipeline / 渲染管线

- 在实时模式入口中挂载 `HTMLVideoElement`，使用隐藏 Canvas 同步绘制视频帧。
- 将现有 emoji 叠加逻辑抽象为可注入的渲染层，保证 Canvas 导出的图像与用户可见画面一致。
- Detection loop 通过 `requestAnimationFrame` 或固定时间片执行，结合指数平滑/卡尔曼滤波减少抖动；在低端设备上允许降至 24 fps。
- 组件卸载或模式切换时必须调用 `MediaStreamTrack.stop()`，并销毁检测循环以释放资源。

### State Machine / 状态机

- `idle → requesting-permission → initializing → streaming → paused → error`。
- 每个状态对应 UI 提示与操作按钮（例如在 `error` 状态提供重试与回退到图片模式）。
- 在 `streaming` 状态支持 `pause`（冻结检测但保留最后一帧）与 `resume` 行为。

## UX & UI Guidelines / 交互与界面指引

- 在首页或上传面板中提供“实时模式”按钮，视觉权重与“上传图片”相当。
- 实时模式布局：顶部视频区域 + emoji 叠加层；底部保持 emoji 选择器与 inspector，桌面端可移至侧栏。
- 权限申请失败、摄像头缺失、Safari 手势限制等场景需弹出内联提示，并引导回静态图片模式。
- 添加明显的“拍照”按钮，点击后冻结当前帧并进入导出对话框；同时提供“继续实时”入口。
- UI 中提供性能指示（如轻量级 FPS 或“性能优先/质量优先”开关）。

## Video Recording Extension / 视频录制扩展

- 录制前在实时模式中对 Canvas 进行合成；调用 `canvas.captureStream(targetFps)` 获取视频轨道。
- 使用 `MediaRecorder` 录制 WebM（默认）或 MP4（Safari ≥ 14.5），在不支持目标 MIME 时回退到提示。
- 可选音频轨道：若用户同意麦克风权限，将 `MediaStream` 合并；否则提供静音提示并仅录制画面。
- 为低端设备暴露分辨率/帧率设置（1080p、720p、480p），并记录默认策略（根据硬件能力或手动选择）。
- 录制 UI：切换按钮（开始/停止）、计时器显示、录制状态指示（Framer Motion 动画）。
- 导出策略：生成 Blob 后触发下载，命名包含时间戳；在 Safari 上提示用户使用 Files 应用保存。

## Compatibility Matrix / 兼容性矩阵

- ✅ Chromium 桌面 (Chrome 109+ / Edge 109+): 支持前后摄像、WebM 录制。
- ✅ Firefox 108+: 支持摄像头与 WebM 录制，需测试长期录制稳定性。
- ✅ Safari macOS 14+ / iOS 15.2+: 支持 H.264/HEVC 录制，必须在 HTTPS 与用户手势触发下工作。
- ⚠️ Android 低端设备：建议默认启用 Tiny Face Detector 与 720p@24fps 以降低功耗。
- ❌ Internet Explorer / 旧版浏览器：不支持 `getUserMedia`，保持静态上传模式。

## Risks & Mitigations / 风险与缓解

- 首次加载模型可能存在 2-3 秒延迟：进入实时模式前预加载或提示用户等待。
- 低光环境检测率下降：建议加入提示或指导用户增加光线，并在文档中记录最佳实践。
- 多设备兼容差异：新增 Cypress 或 Playwright 冒烟脚本时需覆盖权限流程，当前阶段至少手动验证。
- 长时间录制导致内存占用上升：分段保存 Blob 或提示用户限制录制时长。

## Open Questions / 待确认事项

- 是否需要为实时模式提供后台运行限制（切换标签页时自动暂停）。
- Web Worker + OffscreenCanvas 提前投入的优先级。
- 录制文件大小上限与自动清理策略。
