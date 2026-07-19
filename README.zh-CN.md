<h1 align="center">🫣 No Face / カオナシ</h1>

<p align="center">隐私优先的人脸遮罩工具——在浏览器本地用 Emoji 替换人脸。</p>

<p align="center"><a href="./README.md">English</a> | 简体中文</p>

<p align="center"><img src="public/sample-faces.jpg" alt="Before" width="42%" /> <img src="public/sample-result.png" alt="After — faces replaced with emoji" width="42%" /></p>

<p align="center"><i>一键将每一张人脸替换成表情，全程在你的浏览器中完成。</i></p>

## 功能特性

- 支持拖放上传、点击选择或移动端相机拍摄
- 本地人脸检测（MediaPipe FaceDetector，运行于 Web Worker），默认置信度 0.5，未检出人脸时自动以 0.3 重试一次，才提示"未检测到人脸"
- 110 个精选 Emoji，支持中文关键词搜索与随机选择（骰子按钮）
- 点击单张人脸应用所选表情，或使用"全部替换"一次性应用给所有检测到的人脸
- 拖拽可微调单个表情在人脸上的位置
- 全局表情大小滑块（0.8–1.6 倍），统一调整所有已放置的表情，导出时同步生效
- 撤销/重做，支持完整历史栈与键盘快捷键（Ctrl/Cmd+Z、Ctrl/Cmd+Shift+Z）
- 明暗主题、中英双语界面，以及原始分辨率 PNG 导出

## 快速开始

环境要求：Node.js 18+ 或 Bun。

```bash
git clone https://github.com/BazingaOrg/no-face.git
cd no-face
npm install
npm run dev
```

```bash
npm run build && npm start
npm test
```

访问 http://localhost:3000

## 技术栈

[Next.js 15](https://nextjs.org/)（App Router）、[TypeScript](https://www.typescriptlang.org/)、[Tailwind CSS v4](https://tailwindcss.com/)、[@mediapipe/tasks-vision](https://github.com/google-ai-edge/mediapipe)（FaceDetector，运行于 Web Worker）、[Twemoji](https://github.com/twitter/twemoji)、[Framer Motion](https://www.framer.com/motion/)

## 隐私

所有处理均在你的浏览器本地完成。人脸检测模型、MediaPipe WASM 运行时以及 Twemoji 表情图形都是随应用一起自托管的静态资源（`public/models/`、`public/mediapipe/wasm/`、`public/emoji/`），不会有任何图片或人脸数据被发送到服务器——你的照片只留在这里，仅此而已。

## 许可证

MIT 许可证——可免费用于个人及商业用途。
