<h1 align="center">🫣 No Face / カオナシ</h1>

<p align="center">Privacy-first face masking — replace faces with emoji, entirely in your browser.</p>

<p align="center">English | <a href="./README.zh-CN.md">简体中文</a></p>

<p align="center"><img src="public/sample-faces.jpg" alt="Before" width="42%" /> <img src="public/sample-result.png" alt="After — faces replaced with emoji" width="42%" /></p>

<p align="center"><i>One click, every face becomes an emoji — right in your browser.</i></p>

## Features

- Upload via drag & drop, click to select, or camera on mobile
- On-device face detection (MediaPipe FaceDetector in a Web Worker) at 0.5 confidence, automatically retrying once at 0.3 before reporting "no face detected"
- 110 curated emojis with Chinese keyword search and a random-pick (dice) button
- Click a face to apply the selected emoji, or "Replace All" to mask every detected face at once
- Drag to fine-tune an individual emoji's position
- Global emoji size slider (0.8–1.6x) affecting all placed emojis, including export
- Undo/Redo with full history and keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z)
- Light/dark theme, bilingual UI (English/Chinese), and original-resolution PNG export

## Quick Start

Prerequisites: Node.js 18+ or Bun.

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

Visit http://localhost:3000

## Tech Stack

[Next.js 15](https://nextjs.org/) (App Router), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS v4](https://tailwindcss.com/), [@mediapipe/tasks-vision](https://github.com/google-ai-edge/mediapipe) (FaceDetector, in a Web Worker), [Twemoji](https://github.com/twitter/twemoji), [Framer Motion](https://www.framer.com/motion/)

## Privacy

All processing happens entirely client-side in your browser. The face detection model and MediaPipe WASM runtime are self-hosted assets shipped with the app (`public/models/`, `public/mediapipe/wasm/`), so no image or face data is ever sent to any server — your photo stays here, only here.

## License

MIT — free for personal and commercial use.
