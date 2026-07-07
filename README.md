# 🫣 No Face / カオナシ

[English](#english) | [中文](#中文)

---

<a name="english"></a>

## English

> Privacy-first face masking tool - Replace faces with emojis, all processing done locally.

### ✨ Features

- 📤 **Multiple upload methods** - Drag & drop, click to select, or use camera on mobile
- 🔍 **Automatic face detection** - Powered by face-api.js with dual detection modes
- 😀 **Rich emoji picker** - 3600+ emojis with keyword search, plus a random-pick button
- 🎯 **Flexible editing** - Click to replace individual faces, open the inspector, or apply changes to everyone at once
- 🧲 **Per-face inspector** - Bottom sheet with precise scale/opacity controls, quick default updates, and a drag handle to close
- ⚙️ **Advanced settings** - Adjust detection sensitivity and global defaults with instant visual feedback
- 💾 **High-quality export** - Download images in original resolution (PNG)
- 📱 **Responsive design** - Works seamlessly on desktop, tablet, and mobile
- 🔒 **Privacy-focused** - All processing happens in your browser, no server uploads
- ✨ **Smooth animations** - Duolingo-inspired interface with Framer Motion

### 🚀 Quick Start

#### Prerequisites

- Node.js 18+ or Bun
- npm, yarn, or bun package manager

#### Installation

```bash
# Clone the repository
git clone https://github.com/BazingaOrg/no-face.git
cd no-face

# Install dependencies
npm install
# or
bun install

# Run development server
npm run dev
# or
bun run dev

# Build for production
npm run build
npm start
```

Visit [http://localhost:3000](http://localhost:3000) to see the app.

### 🎮 How to Use

1. **Upload** - Select an image or use camera (mobile)
2. **Detect** - App automatically detects all faces
3. **Choose** - Pick an emoji from the picker or use random button
4. **Replace** - Click on face boxes to apply selected emoji
5. **Adjust** - Tap Face badges to open the inspector, fine-tune scale/opacity, or update defaults; drag the handle down to dismiss
6. **Export** - Download your creation in original quality

### 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Face Detection**: [@vladmandic/face-api](https://github.com/vladmandic/face-api)
- **Emoji**: [emoji-picker-react](https://github.com/ealush/emoji-picker-react) + [Twemoji](https://github.com/twitter/twemoji)
- **Animation**: [Framer Motion](https://www.framer.com/motion/)

### 📂 Project Structure

```plaintext
no-face/
├── app/
│   ├── page.tsx              # Main application page
│   └── layout.tsx            # Root layout
├── components/
│   ├── ImageUploader.tsx     # Drag & drop + camera
│   ├── FaceCanvas.tsx        # Interactive face detection canvas
│   ├── EmojiSelector.tsx     # Emoji picker with search
│   ├── EmojiInspector.tsx    # Per-face micro-tuning bottom sheet
│   ├── SettingsPanel.tsx     # Detection settings card
│   ├── ModelLoadingModal.tsx # Model loading progress modal
│   ├── ProcessingOverlay.tsx # Detection progress overlay
│   └── Toast.tsx             # Toast notifications (with undo action)
├── hooks/
│   ├── useFaceBadgeLayout.ts         # Badge measurement & positioning helper
│   ├── useFrameDebouncedCallback.ts  # Frame-synchronised debounce hook
│   └── useInspectorActions.ts        # Inspector action aggregation
├── lib/
│   ├── faceApi.ts            # @vladmandic/face-api wrapper
│   ├── runFaceDetection.ts   # Normalised detection pipeline
│   ├── twemoji.ts            # Twemoji CDN utilities
│   ├── emojiImageCache.ts    # Shared emoji bitmap cache
│   └── emojiRenderUtils.ts   # Emoji sizing & shared draw routine
├── utils/
│   └── imageOptimization.ts  # Large-image downscaling for detection
├── types/
│   └── index.ts              # TypeScript type definitions
├── public/models/            # Face detection models (self-hosted)
├── docs/                     # Design specs & improvement plans
├── ROADMAP.md                # Development roadmap
├── MODELS_SETUP.md           # Model setup guide
└── CLAUDE.md                 # Developer documentation
```

### ⚙️ Configuration

#### Face Detection

- **Default detector**: SSD MobileNet V1 (high accuracy)
- **Alternative**: Tiny Face Detector (faster, lower accuracy)
- **Models**: Self-hosted in `public/models/` (see [MODELS_SETUP.md](./MODELS_SETUP.md))

#### Emoji Settings

- **Format**: SVG (vector, via Twemoji)
- **Size**: Adaptive scaling based on face size
- **Customizable**: Scale (50-200%), opacity (50-100%), horizontal/vertical flip

### 📋 Roadmap

See [ROADMAP.md](./ROADMAP.md) for detailed development plans.

**MVP Completed** ✅
- Image upload, face detection, emoji replacement
- Advanced settings panel & per-face inspector
- Drag to reposition an emoji on the inspected face
- Mobile responsive design
- Full Undo/Redo history (buttons + Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z)
- Chinese keyword search over a curated emoji set
- PWA offline support

**Planned Features**
- Real-time camera mode (in design)
  - Live face tracking via `@vladmandic/face-api` on `HTMLVideoElement`
  - Streamlined UI entry alongside the existing uploader with a dedicated state machine
  - Real-time emoji overlay with smoothing, pause, and snapshot controls
- Video recording with emoji effects
  - Use `HTMLCanvasElement.captureStream` + `MediaRecorder` for WebM/MP4 output
  - Optional microphone track merge and adaptive FPS/resolution controls for low-end devices
  - Post-recording export flow aligned with current PNG workflow
- PWA support

### 🐛 Known Issues

- Large images are auto-downscaled to 1920px for detection (export keeps original quality)
- Browser compatibility testing in progress (Chrome/Edge/Firefox/Safari)
- Emoji picker loads 3600+ emojis when opened - virtualization planned
- Chinese keyword search covers the curated set of 118 common emojis; the full picker (once expanded) only supports English search (a limitation of emoji-picker-react)

### 🤝 Contributing

Contributions are welcome! Please check [ROADMAP.md](./ROADMAP.md) for open tasks.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### 📄 License

MIT License - free for personal and commercial use.

### 🙏 Acknowledgments

- [face-api.js](https://github.com/justadudewhohacks/face-api.js) by Vincent Mühler - Face detection models
- [Twemoji](https://github.com/twitter/twemoji) by Twitter - High-quality emoji graphics
- [face-mask-web](https://github.com/Innei/face-mask-web) by Innei - Inspiration for this project

---

<a name="中文"></a>

## 中文

> 隐私优先的人脸遮罩工具 - 用 Emoji 替换人脸，所有处理均在本地完成。

### ✨ 功能特性

- 📤 **多种上传方式** - 拖放上传、点击选择或移动端相机拍摄
- 🔍 **自动人脸检测** - 基于 face-api.js 的双模式检测
- 😀 **丰富表情库** - 3600+ Emoji，支持关键词搜索与随机选择
- 🎯 **灵活编辑** - 单击替换单张人脸、打开微调抽屉或一键应用给所有人
- 🧲 **微调抽屉** - 底部抽屉可精调大小/透明度、更新默认值，并支持拖拽手柄关闭
- ⚙️ **高级设置** - 即时调节检测灵敏度与全局默认表情配置
- 💾 **高质量导出** - 下载原始分辨率图片（PNG 格式）
- 📱 **响应式设计** - 完美适配桌面、平板和移动设备
- 🔒 **隐私保护** - 所有处理在浏览器本地完成，无服务器上传
- ✨ **流畅动画** - Duolingo 风格界面，基于 Framer Motion

### 🚀 快速开始

#### 环境要求

- Node.js 18+ 或 Bun
- npm、yarn 或 bun 包管理器

#### 安装步骤

```bash
# 克隆仓库
git clone https://github.com/BazingaOrg/no-face.git
cd no-face

# 安装依赖
npm install
# 或
bun install

# 启动开发服务器
npm run dev
# 或
bun run dev

# 构建生产版本
npm run build
npm start
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 🎮 使用方法

1. **上传图片** - 选择图片或使用相机（移动端）
2. **检测人脸** - 应用自动检测所有人脸
3. **选择表情** - 从表情选择器中挑选 Emoji 或使用随机按钮
4. **替换人脸** - 点击人脸框应用选中的 Emoji
5. **微调设置** - 点击 Face 标签打开微调抽屉，调节大小/透明度或更新默认值，向下拖动手柄即可关闭
6. **导出图片** - 下载原始质量的作品

### 🛠️ 技术栈

- **框架**: [Next.js 15](https://nextjs.org/) (App Router)
- **语言**: [TypeScript](https://www.typescriptlang.org/)
- **样式**: [Tailwind CSS v4](https://tailwindcss.com/)
- **人脸检测**: [@vladmandic/face-api](https://github.com/vladmandic/face-api)
- **表情包**: [emoji-picker-react](https://github.com/ealush/emoji-picker-react) + [Twemoji](https://github.com/twitter/twemoji)
- **动画**: [Framer Motion](https://www.framer.com/motion/)

### 📂 项目结构

```plaintext
no-face/
├── app/
│   ├── page.tsx              # 主应用页面
│   └── layout.tsx            # 根布局
├── components/
│   ├── ImageUploader.tsx     # 拖放上传 + 相机
│   ├── FaceCanvas.tsx        # 交互式人脸检测画布
│   ├── EmojiSelector.tsx     # 带搜索的 Emoji 选择器
│   ├── EmojiInspector.tsx    # 单脸微调底部抽屉
│   ├── SettingsPanel.tsx     # 检测设置卡片
│   ├── ModelLoadingModal.tsx # 模型加载进度弹窗
│   ├── ProcessingOverlay.tsx # 检测进度遮罩
│   └── Toast.tsx             # 提示条（支持撤销操作）
├── hooks/
│   ├── useFaceBadgeLayout.ts         # 人脸标签测量与定位
│   ├── useFrameDebouncedCallback.ts  # 帧同步防抖
│   └── useInspectorActions.ts        # 微调面板动作聚合
├── lib/
│   ├── faceApi.ts            # @vladmandic/face-api 封装
│   ├── runFaceDetection.ts   # 标准化检测管线
│   ├── twemoji.ts            # Twemoji CDN 工具
│   ├── emojiImageCache.ts    # Emoji 位图共享缓存
│   └── emojiRenderUtils.ts   # Emoji 尺寸与统一绘制
├── utils/
│   └── imageOptimization.ts  # 大图压缩与坐标映射
├── types/
│   └── index.ts              # TypeScript 类型定义
├── public/models/            # 人脸检测模型（本地托管）
├── docs/                     # 设计规范与改进方案
├── ROADMAP.md                # 开发路线图
├── MODELS_SETUP.md           # 模型配置指南
└── CLAUDE.md                 # 开发者文档
```

### ⚙️ 配置说明

#### 人脸检测

- **默认检测器**: SSD MobileNet V1（高精度）
- **备选检测器**: Tiny Face Detector（更快，精度较低）
- **模型加载**: 本地托管于 `public/models/`（详见 [MODELS_SETUP.md](./MODELS_SETUP.md)）

#### Emoji 设置

- **格式**: SVG（矢量，来自 Twemoji）
- **大小**: 根据人脸尺寸自适应缩放
- **可定制**: 缩放（50-200%）、透明度（50-100%）、水平/垂直翻转

### 📋 开发路线图

详见 [ROADMAP.md](./ROADMAP.md)。

**MVP 已完成** ✅
- 图片上传、人脸检测、Emoji 替换
- 高级设置面板与单脸微调抽屉
- 拖动调整微调中人脸的 Emoji 位置
- 移动端响应式设计
- 完整撤销/重做历史栈（按钮 + Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z）
- 精选表情的中文关键词搜索
- PWA 离线支持

**计划功能**
- 实时相机模式

### 🐛 已知问题

- 大图片会自动压缩到 1920px 用于检测（导出保持原始画质）
- 浏览器兼容性测试进行中（Chrome/Edge/Firefox/Safari）
- Emoji 选择器展开时加载 3600+ 表情 - 计划虚拟化优化
- 中文关键词搜索覆盖精选的 118 个常用表情；展开完整表情库后仅支持英文搜索（emoji-picker-react 的限制）

### 🤝 参与贡献

欢迎贡献代码！请查看 [ROADMAP.md](./ROADMAP.md) 了解待完成任务。

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 📄 许可证

MIT 许可证 - 可免费用于个人和商业用途。

### 🙏 致谢

- [face-api.js](https://github.com/justadudewhohacks/face-api.js) by Vincent Mühler - 人脸检测模型
- [Twemoji](https://github.com/twitter/twemoji) by Twitter - 高质量 Emoji 图形
- [face-mask-web](https://github.com/Innei/face-mask-web) by Innei - 项目灵感来源

---

**Privacy Note / 隐私声明**: All image processing happens in your browser. No data is uploaded to any server. / 所有图片处理均在浏览器本地完成，不会上传任何数据到服务器。
