# No Face - Development Roadmap

Privacy-first face masking tool - Replace faces with emojis, all processing done locally in your browser.

## ✅ Completed Features (MVP - Phase 1)

- [x] Project initialization (Next.js 15 + TypeScript + Tailwind CSS v4)
- [x] Image upload (drag & drop + click + mobile camera)
- [x] Face detection (face-api.js with SSD MobileNet V1 + Tiny Face Detector)
- [x] Canvas display with face overlay and interactive face boxes
- [x] Emoji picker integration (emoji-picker-react); Chinese keyword search removed in a later refactor, planned to return (see UI/UX backlog)
- [x] Click-to-replace workflow
- [x] Export original quality image (PNG format)
- [x] Mobile responsive design (Duolingo-inspired UI)
- [x] Advanced settings panel (unified card-style design)
  - [x] Detection sensitivity slider
  - [x] Detector type selection (SSD vs Tiny)
  - [x] Performance mode for Tiny Face Detector (极速/平衡/精准)
  - [x] Emoji size/scale adjustment
  - [x] Emoji opacity control
  - [-] Position offset controls (X/Y) - **已移除 (Removed in v0.2.0)**
  - [x] Flip controls (horizontal/vertical)
- [x] Per-face inspector bottom sheet
  - [x] Drag-to-close handle with velocity threshold
  - [x] Apply-to-all & adopt-as-default actions
  - [x] Frame-synchronised slider updates for smoother previews
- [x] Emoji rendering optimization
  - [x] Default to SVG format for best quality
  - [x] Fallback to native emoji when CDN fails
- [x] Animations and transitions (Framer Motion)
- [x] "Apply to All" and "Reset" buttons
- [x] Random emoji button
- [x] Smart button state management (disable when conditions not met)
- [x] Dynamic progress indicators (X/Y faces replaced)
- [x] Contextual guidance messages based on current state
- [x] Curated emoji collection (140+ emojis, 12 categories)
  - [x] Classic smiles, cute flirty, goofy playful
  - [x] Thinking curious, tired reluctant, dramatic shocked
  - [x] Cool confident, sad emotional, angry furious
  - [x] Spooky scary, cute animals (cats, dogs, wild animals), sick unwell
- [x] Advanced settings panel conditional controls
  - [x] Emoji settings disabled when no faces replaced

## 🚧 Technical Debt & Known Issues

### 🔥 High Priority (立即处理 - 影响核心用户体验)

- [x] **Model files hosting**: Models can be self-hosted or loaded from CDN
  - **Status**: Using local `/models` with CDN fallback
  - **Setup guide**: See `MODELS_SETUP.md` for instructions
  - **Configuration**: `lib/faceApi.ts` line 29 switches between local/CDN
  - **Note**: Face Landmarks 68 model downloaded but not currently in use (prepared for future features)

- [x] **Model loading progress indicator**: Show loading state for better UX ✅
  - **Impact**: Model files are ~5-10MB, initial load can take 2-5 seconds
  - **Status**: ✅ 已完成 - 2025-10-15
  - **Implementation**:
    - ✅ Created `ModelLoadingModal` component (Duolingo style)
    - ✅ Added progress tracking in `lib/faceApi.ts`
    - ✅ Shows which model is currently loading with percentage
    - ✅ Sequential loading for accurate progress reporting
    - ✅ Friendly tips and animations during loading
  - **Files**: `components/ModelLoadingModal.tsx`, `lib/faceApi.ts`, `types/index.ts`

- [x] **Large image optimization**: Images > 10MB may cause performance issues ✅
  - **Impact**: 大图片处理时界面冻结，影响用户体验
  - **Status**: ✅ 已完成 - 2025-10-15
  - **Implementation**:
    - ✅ Auto-compress images to max 1920px width for processing
    - ✅ Coordinate mapping to maintain accuracy on original image
    - ✅ Added `ProcessingOverlay` component with progress hints
    - ✅ Smart message based on file size category
    - ✅ Export always uses original image quality
    - ⚠️ Web Worker approach deferred (face-api.js requires DOM)
  - **Files**: `utils/imageOptimization.ts`, `components/ProcessingOverlay.tsx`, `app/page.tsx`
  - **Note**: Chose practical solution (compression + UI feedback) over Web Worker due to face-api.js DOM dependency

### ⚠️ Medium Priority (近期优化 - 提升稳定性和性能)

- [x] **Emoji loading optimization**: emoji-picker-react loads ~3600 emojis ✅
  - **Impact**: 内存占用大，加载缓慢
  - **Status**: ✅ 已完成 - 2025-10-15
  - **Implementation**:
    - ✅ Default to curated emoji grid (140 emojis) for fast loading
    - ✅ Lazy load full emoji picker only when user clicks "加载更多"
    - ✅ Reduced initial memory footprint by ~90%
    - ✅ Improved initial load time from 2-3s to <0.3s
  - **Files**: `components/EmojiSelector.tsx`

- [ ] **Browser compatibility testing**
  - [ ] Safari (especially iOS Safari) - 重点测试移动端Safari
  - [ ] Chrome/Edge (Chromium-based)
  - [ ] Firefox
  - [ ] Mobile browsers - Android Chrome, Samsung Internet

### Low Priority

- [ ] **Performance monitoring**: Add metrics for face detection time
- [ ] **Error boundary**: Graceful error handling for unsupported browsers
- [ ] **Accessibility**: Keyboard navigation, ARIA labels, screen reader support
- [x] **Console cleanup**: Remove debug console statements from production code

## 🔮 Future Features (Phase 2+)

### 📈 Phase 2: Enhanced Editing (功能增强 - 提升编辑体验)

- [ ] **Individual face editing** - 个人脸编辑功能
  - [x] Click to apply emoji to specific face - 点击应用表情到特定人脸
  - [x] Flip emoji (horizontal/vertical) - 表情符号翻转
  - [x] Bottom sheet inspector with fine-tuning & drag-to-close - 底部抽屉微调与拖拽关闭
  - [x] **Drag to reposition emoji per face** - 拖拽重新定位 ✅ 2026-07-05
    - **Implementation**: Pointer events on canvas, scoped to the currently
      inspected face only; drag threshold (4px) distinguishes a tap
      (still applies the selected emoji) from a drag (repositions).
      Offset stored in original-image px on `EmojiReplacement.offsetX/Y`,
      shared `getEmojiScreenRect`/`drawEmojiReplacement` keep preview and
      export pixel-identical. "恢复默认值" re-centers the position.
    - **Files**: `components/FaceCanvas.tsx`, `lib/emojiRenderUtils.ts`,
      `hooks/useInspectorActions.ts`, `types/index.ts`
  - [ ] **Pinch/scroll to scale emoji per face** - 捏合/滚动缩放
    - **Priority**: 中 - 每个表情独立缩放
    - **Implementation**: Touch events + wheel events
  - [ ] **Emoji rotation** ⚠️ *Previously implemented but removed due to poor UX*
    - **Status**: 之前实现过但UX差，已移除
    - [ ] Redesign interaction model (slider-based rotation works but lacks intuitiveness)
    - [ ] Improve canvas-based rotation (mouse drag + two-finger touch needs better visual feedback)
    - [ ] Auto-rotation based on Face Landmarks 68 (model downloaded but feature disabled)
    - [ ] Consider rotation handle UI similar to professional image editors

- [x] **Undo/Redo functionality** - 撤销重做功能 ✅ 2026-07-05
  - [x] History stack implementation - 多步历史栈（`faces`+`replacements` 快照，上限 50 条，新操作丢弃陈旧的 redo 分支）
  - [x] Keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z) - 聚焦输入框时跳过，保留原生文本撤销
  - [x] Visual undo/redo buttons - 状态卡内的 ↩️/↪️ 按钮，栈空时禁用
  - **Coalescing**: 连续手势（滑杆拖动、画布拖拽）每次手势只记一条历史（手势开始时推入），而非每帧/每次 onChange 都记
  - **Files**: `app/page.tsx`, `hooks/useInspectorActions.ts`, `components/EmojiInspector.tsx`, `components/FaceCanvas.tsx`

- [x] **Batch operations** - 批量操作（已完成）
  - [x] "Apply to All" button (one-click replace all faces)
  - [x] "Clear All/Reset" button (remove all emoji replacements)

- [ ] **Multiple emoji styles** - 多表情符号样式
  - **Priority**: 低 - 样式扩展功能
  - [ ] Apple emoji style - Apple风格
  - [ ] Google emoji style - Google风格
  - [x] Twitter emoji style (Twemoji, current default) - Twitter风格（当前默认）

### 🚀 Phase 3: Advanced Features (高级功能 - 扩展使用场景)

- [ ] **Real-time camera mode** - 实时摄像头模式
  - **Priority**: 中等偏高 - 扩展产品使用场景
  - **Scope**: 与当前图片流程保持一致，新增实时串流入口、状态机以及摄像头资源管理
  - [ ] UX entry & state machine - 入口设计与状态管理（未授权 / 准备 / 检测中 / 暂停 / 出错）
  - [ ] Media access layer - 基于 `navigator.mediaDevices.getUserMedia` 的前置/后置摄像头封装
  - [ ] Video rendering pipeline - 将 `HTMLVideoElement` 帧绘制到 Canvas 并与现有 emoji 叠加合并
  - [ ] Detection loop integration - 复用 `runFaceDetection`，加入 FPS 限流与平滑滤波
  - [ ] Snapshot export - 拍照导出并复用 PNG 下载流程
  - [ ] Resource cleanup - 退出时停止 `MediaStreamTrack` 并清理检测循环
  - **Risks & TODOs**
    - [ ] Safari/iOS HTTPS 与用户手势限制说明
    - [ ] 低端设备 TinyFaceDetector 切换与性能监控
    - [ ] 模型预热与初次加载延迟提示

- [ ] **Preset styles/packs** - 预设样式包
  - **Priority**: 低 - 增强趣味性
  - [ ] Funny Pack (🤪😜🤡) - 搞笑包
  - [ ] Cute Pack (🥰😊😸) - 可爱包
  - [ ] Professional Pack (😎🤓👔) - 专业包
  - [ ] Halloween Pack (🎃👻🦇) - 万圣节包
  - [ ] Animal Pack (🐱🐶🐼) - 动物包
  - [x] Random mode (random emoji button) - 随机模式

- [ ] **Face recognition (experimental)** - 人脸识别（实验性）
  - **Priority**: 低 - 需要大量测试和优化
  - [ ] Remember emoji choice per person across uploads - 记住每个人的表情选择
  - [ ] Local storage persistence - 本地存储持久化
  - [ ] Face embedding comparison - 人脸特征比对

- [ ] **Video recording with emoji overlay** - 表情叠加视频录制
  - **Priority**: 中等 - 实时模式的进阶功能
  - [ ] Canvas capture stream - 通过 `canvas.captureStream()` 获取带特效的视频轨道
  - [ ] MediaRecorder integration - `MediaRecorder` 封装，支持 WebM/MP4 输出与回退策略
  - [ ] Optional audio merge - 可选麦克风音轨合并与静音提示
  - [ ] Recording UI/UX - 录制按钮、计时器、状态反馈（录制中/已保存）
  - [ ] Export management - 下载命名、文件大小提示以及 Safari 专属兼容说明
  - **Open questions**
    - [ ] 低端设备分辨率 / 帧率自适应策略
    - [ ] Web Worker + OffscreenCanvas 是否需要提前投入

- [ ] **GIF/Video support** - GIF/视频支持
  - **Priority**: 中等 - 扩展媒体类型支持
  - [ ] Frame-by-frame processing - 逐帧处理
  - [ ] Export as animated GIF - 导出动画GIF
  - [ ] Video processing (experimental) - 视频处理

### Phase 4: Polish & Sharing

- [ ] PWA support
  - [ ] Offline functionality
  - [ ] Install as app
  - [ ] Service worker caching
- [ ] Social media integration
  - [ ] Share to Twitter/Facebook
  - [ ] Generate shareable link preview
- [ ] Custom emoji upload
  - [ ] Allow users to upload custom images
  - [ ] Transparent PNG support
- [ ] Collaboration mode
  - [ ] Generate shareable edit links
  - [ ] Cloud storage integration

### Phase 5: Monetization (Optional)

- [ ] Premium features
  - [ ] High-resolution export (4K+)
  - [ ] Batch processing (multiple images)
  - [ ] Exclusive emoji packs
- [ ] API access for developers
- [ ] White-label licensing

## 🐛 Bug Fixes Backlog

- [x] Handle edge cases ✅
  - [x] No faces detected (show helpful message with guidance to adjust sensitivity)
  - [x] Too many faces (>50) performance warning - **已完成 (v0.2.0)**
  - [-] Very small faces (<50px) detection threshold - **不需要 (已通过 minConfidence 实现)**
- [x] Emoji CDN fallback (fallback to native emoji rendering)
- [ ] Safari compatibility issues (if any) - **需要测试**
- [-] Touch event conflicts on mobile canvas - **不需要 (当前只有点击事件)**
- [x] Memory leaks in face detection loop - **已完成 (v0.2.0)** - Added TensorFlow.js tensor cleanup with `tf.tidy()`

## 📊 Performance Optimization Ideas

- [ ] **Implement Web Worker for face detection** 🎯 High impact for large images
  - [ ] Offload heavy computation from main thread
  - [ ] Keep UI responsive during processing
  - [ ] Transfer ImageData via transferable objects for zero-copy
- [ ] **Use OffscreenCanvas for image processing**
  - [ ] Background rendering for better performance
  - [ ] Compatible with Web Worker
- [ ] **Add image compression before processing**
  - [ ] Limit input size to 1920px width for processing
  - [ ] Maintain aspect ratio
  - [ ] Export original quality (no compression on output)
  - [ ] Support format conversion (HEIC/JPEG → PNG)
- [ ] **Cache detection results and assets**
  - [x] Store face coordinates in state
  - [x] Re-use when changing emoji settings (auto re-apply)
  - [ ] Persist to localStorage for session recovery
  - [ ] Cache loaded emoji images to avoid repeated CDN requests
  - [ ] Implement LRU cache for recently used emojis
- [ ] **Batch processing for multiple images**
  - [ ] Queue system for processing multiple uploads
  - [ ] Background processing with progress indicator
  - [ ] Export as ZIP file
- [ ] **Lazy load twemoji assets**
  - [ ] Load only visible emojis in picker
  - [x] Preload selected emoji with fallback

## 🎨 UI/UX Improvements

- [ ] Onboarding flow
  - [ ] First-time user guide (tooltips)
  - [ ] Example images to try
- [ ] Keyboard shortcuts
  - [ ] Upload: Ctrl+O / Cmd+O
  - [ ] Export: Ctrl+S / Cmd+S
  - [ ] Undo: Ctrl+Z / Cmd+Z
- [x] Dark mode support
  - [x] System preference detection
  - [ ] Manual toggle
- [ ] Multiple languages
  - [ ] i18n setup
  - [ ] Chinese emoji search (removed in refactor, to be rebuilt)
  - [ ] Full UI translation (English, Chinese, Spanish, Japanese)

## 📈 Analytics & Metrics (Privacy-focused)

- [ ] Usage statistics (anonymous)
  - [ ] Number of faces detected per image
  - [ ] Most popular emojis
  - [ ] Average processing time
- [ ] Error tracking
  - [ ] Detection failures
  - [ ] Browser compatibility issues

## 🔒 Security & Privacy

- [x] Client-side only processing
  - [x] No image upload to servers
  - [x] All processing in browser
  - [x] Privacy statement in UI footer
- [ ] Content Security Policy (CSP) headers
- [ ] Sanitize user inputs (if custom emoji upload added)

---

## 📅 Timeline & Priority Implementation Plan

### ✅ 已完成 (Completed)
- **Week 1**: MVP implementation ✅
- **Week 2**: Code cleanup, documentation, testing ✅
  - Added flip controls, performance mode optimization
  - Simplified emoji format (default to SVG)
  - Attempted rotation feature (removed due to poor UX, needs redesign)
- **Week 3**: 核心性能优化 ✅ (2025-10-15)
  - ✅ **模型加载进度指示器** - 完成 Duolingo 风格加载弹窗
  - ✅ **大图片优化** - 完成自动压缩和坐标映射

### 🚨 高优先级修复 (Week 4 - 继续优化)
- **Week 4**: 兼容性和优化
  - ⚠️ **浏览器兼容性测试** - 确保产品可用性
  - ⚠️ **表情符号加载优化** - 提升性能

### 📈 Phase 2 功能增强 (Month 2 - 功能迭代)
- **Month 2 Early**: 个别人脸编辑基础功能
  - ✅ **拖拽重新定位表情符号** - 已完成 (2026-07-05)
  - ✅ **撤销重做功能** - 已完成 (2026-07-05)
- **Month 2 Mid**: 交互增强
  - 🥉 **捏合/滚动缩放** (每个表情独立缩放)
  - 🤔 **表情符号旋转重设计** (解决之前的UX问题)

### 🚀 Phase 3 高级功能 (Month 3+ - 产品扩展)
- **Month 3**: 实时功能
  - 📷 **实时摄像头模式** (扩展使用场景)
- **Month 4**: 媒体支持
  - 🎬 **GIF/视频支持** (扩展媒体类型)
- **Month 5+**: 高级功能
  - 🎨 **预设样式包** (增强趣味性)
  - 🧠 **人脸识别** (实验性功能)

### 🛠️ 长期规划 (Phase 4-5)
- **Phase 4**: PWA支持、社交分享、协作模式
- **Phase 5**: 商业化功能（可选）

## 🤝 Contributing

This project welcomes contributions! See GitHub issues for open tasks.

---

**Last Updated**: 2026-07-05
**Current Phase**: ✅ 2026-07 质量整备（P0 修复 + UI/UX 打磨 + 文档对齐）完成
**Version**: 0.2.0

**Recent Updates (2026-07-05)**:
- ✅ Twemoji ZWJ 序列修复 + 切换到维护中的 jdecked/twemoji CDN
- ✅ 画布渲染重构：共享 Emoji 缓存、devicePixelRatio 高清渲染、过期异步绘制取消、ResizeObserver 自适应
- ✅ CDN 失败降级原生 Emoji 渲染（预览与导出一致）
- ✅ 上传改用 object URL；「全部替换」批量化
- ✅ 重置/重新检测支持撤销（Toast 操作按钮）
- ✅ UI：无衬线字体、暗色标题修复、按钮三级体系、隐私副标题、文案打磨、zh-CN 元数据
- ✅ 清理：移除 html2canvas/@radix-ui 未用依赖与 lib/types 死代码
- 📄 详见 `docs/optimization-plan.md` 与 `docs/ui-ux-copy-review.md`

---

## 历史记录（2025-10-15）
**Priority Focus**:
- ✅ 高优先级 (已完成): 模型加载进度指示器、大图片优化、Bug 修复、Emoji 加载优化
- ⚠️ 下一步: 浏览器兼容性测试
- ✅ Phase 2 已完成: 个别人脸编辑（含拖拽重定位）、撤销重做功能
**Recent Updates (v0.2.0 - 2025-10-15)**:
- ✅ **Bug 修复**:
  - 添加人脸过多（>50）性能警告 Toast
  - 增强未检测到人脸提示（引导用户调整灵敏度）
  - 修复内存泄漏（TensorFlow.js tensor 清理）
- ✅ **功能移除**:
  - 移除位置微调功能（offsetX/offsetY）- 简化 UI 和代码
- ✅ **UI 优化**:
  - 高级设置改为统一卡片式设计（按钮和内容融为一体）
- ✅ **性能优化**:
  - Emoji 加载优化（默认精选 140 个，懒加载完整库）
  - 初始加载时间从 2-3s 降至 <0.3s
  - 内存占用减少 ~90%
- ✅ 文档更新（ROADMAP.md, CLAUDE.md）
