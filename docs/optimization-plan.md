# No Face 项目优化方案（Step by Step）

> 基于 2026-07 对全部源码（app/、components/、hooks/、lib/、utils/、types/）及文档（README、CLAUDE.md、ROADMAP、AGENTS.md）的逐文件审查。
> 按「问题 → 原因 → 修复方式 → 验证方法」组织，分 6 个阶段执行，每个阶段可独立提交。
> 优先级：**P0** = 影响正确性的 bug；**P1** = 明显的性能/体验问题；**P2** = 代码质量与文档对齐；**P3** = 增量功能。
>
> **实施状态（2026-07-05，commits 1a8b9bf…91dfbb9）**：
> ✅ Phase 1 全部完成 — 1.1（设置变更不再重写 emojiUrl，CDN 失败降级原生渲染且导出同样兜底）、1.2（共享图片缓存 lib/emojiImageCache.ts + 过期回调丢弃）、1.3（ZWJ 序列保留 FE0F，CDN 切换 jdecked/twemoji@15.1.0）、1.4（object URL 上传）、1.5（百分比显示）、1.6（换一张清理残留状态、误导日志删除）。
> ✅ Phase 2 完成 2.1–2.4 — devicePixelRatio 渲染、ResizeObserver 自适应、全部替换批量化、导出复用缓存 + Map 查找；2.5 按计划维持现状。
> ✅ Phase 3 完成（3.7 页面瘦身按"可选"跳过）— 3.1 依赖清理、3.2/3.3 死代码与类型清理、3.4 绘制逻辑统一、3.5 共用检测流程、3.6 合并重复 JSX、3.8 上传错误走 Toast。
> ✅ Phase 4 完成 — README/CLAUDE.md/ROADMAP 与代码对齐，版本统一 0.2.0。
> ✅ Phase 5 完成 — vitest 单测（14 例，含 ZWJ 回归）、GitHub Actions CI（lint/typecheck/test/build）、CSP 与安全响应头（已在预览中验证无违规）。
> ⬜ 待做 — 仅剩 Phase 6 功能项（PWA、拖拽重定位、撤销重做扩展为完整历史栈、中文搜索恢复、实时相机）与 3.7 可选瘦身。
> 已通过蒙娜丽莎图端到端验证（含 CSP 开启后回归）：上传 → 检测 → 引导 → 替换（Twemoji 新 CDN）→ 重置 → 撤销恢复。

---

## 总览

| 阶段 | 主题 | 优先级 | 预估工作量 |
|------|------|--------|-----------|
| Phase 1 | 潜在 Bug 修复（6 项） | P0 | ~1 天 |
| Phase 2 | 性能与渲染质量优化（5 项） | P1 | ~1 天 |
| Phase 3 | Clean Code / 死代码清理（8 项） | P2 | ~0.5 天 |
| Phase 4 | 文档与文案对齐（4 项） | P2 | ~0.5 天 |
| Phase 5 | 工程化基础（3 项） | P2 | ~0.5 天 |
| Phase 6 | 功能补充建议（Roadmap 对齐） | P3 | 按需排期 |

---

## Phase 1：潜在 Bug 修复（P0）

### 1.1 设置变更会「弄丢」原生回退的 emoji ⚠️ 最高优先级

- **位置**：[app/page.tsx:247-271](../app/page.tsx)（emojiSettings 自动应用的 useEffect）+ [components/FaceCanvas.tsx:173-211](../components/FaceCanvas.tsx)
- **问题**：当 Twemoji CDN 加载失败时，替换项会回退为原生渲染（`emojiUrl: ''`）。但用户随后调整任意 emoji 设置（缩放/透明度/翻转）时，该 effect 会无条件执行 `emojiUrl: getTwemojiUrl(replacement.emoji)`，把空 URL 重新指回 CDN。而 `FaceCanvas` 里的 `emojiImg` **没有 `onerror` 处理**——图片加载失败后 emoji 直接从画布上消失（导出路径的 `onerror` 也只是静默 resolve，导出图上同样缺失）。
- **修复**：
  1. 该 effect 中去掉 `emojiUrl` 的重写（emoji 字符没变，URL 本来就不需要重算）；
  2. `FaceCanvas` 的 `emojiImg.onerror` 中回退绘制原生 emoji 文本（复用现有原生渲染分支）；导出路径同样处理。
- **验证**：DevTools Network 面板 block 掉 `cdn.jsdelivr.net`，替换一张脸（应显示原生 emoji），再拖动缩放滑杆，emoji 不应消失；导出图上 emoji 存在。

### 1.2 FaceCanvas 异步绘制竞态：拖滑杆时出现残影/闪烁

- **位置**：[components/FaceCanvas.tsx:75-223](../components/FaceCanvas.tsx)
- **问题**：每次重绘 effect 都 `new Image()` 并在 `onload` 里异步落笔。快速连续重绘（微调面板拖滑杆、多次 setState）时：
  - 旧 effect 的 `onload` 可能在**新一帧清屏之后**才执行 → 用旧尺寸/透明度画出残影；
  - 清屏后 emoji 要等 `onload` 才出现 → 每帧闪烁一次。
- **修复**：
  1. 建立模块级缓存 `Map<url, HTMLImageElement>`（新建 `lib/emojiImageCache.ts` 或放在 twemoji.ts）：已缓存的图片**同步**绘制，未缓存的加载完成后触发一次重绘；
  2. effect 内维护「绘制令牌」（`let cancelled = false` + cleanup 置 true），`onload` 回调先检查令牌再落笔，丢弃过期回调。
- **验证**：替换多张脸后打开微调面板快速来回拖动缩放滑杆，画布无残影、无闪烁。

### 1.3 Twemoji codepoint 转换破坏 ZWJ 组合 emoji

- **位置**：[lib/twemoji.ts:31-49](../lib/twemoji.ts)（`getEmojiCodepoint`）
- **问题**：当前实现无条件剔除 `FE0F` 变体选择符。但 Twemoji 的文件名规则是：**仅当序列不含 ZWJ（U+200D）时才剔除 FE0F**。例如 ❤️‍🔥 的正确文件是 `2764-fe0f-200d-1f525.svg`，剔除后 URL 404，只能走原生回退（在无彩色 emoji 字体的系统上进一步劣化）。
- **修复**：先检测序列是否含 `200d`，含则保留 `fe0f`；不含才剔除。
- **附带建议**：`twemoji@latest` 在 jsDelivr 上固定指向 14.0.2，且 twitter/twemoji 仓库已停止维护。建议切换到社区维护的 **jdecked/twemoji**（15.x，覆盖 Unicode 15.1 新 emoji）：`https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/`。
- **验证**：从完整选择器中选 ❤️‍🔥、🧑‍🚀、🏳️‍🌈 等 ZWJ emoji，均能以 Twemoji 图片渲染而非原生回退。

### 1.4 上传大图用 dataURL，内存翻倍常驻

- **位置**：[components/ImageUploader.tsx:29-41](../components/ImageUploader.tsx)
- **问题**：`FileReader.readAsDataURL` 会把 20MB 图片编码成 ~27MB 的 base64 字符串，且 `img.src` 一直引用它，整个会话期间无法回收。
- **修复**：改用 `URL.createObjectURL(file)`，`img.onload` 后（图片解码完成）`URL.revokeObjectURL()`。
- **验证**：上传 15MB+ 图片，Chrome Memory 面板对比堆快照中的字符串占用。

### 1.5 灵敏度/透明度数值单位错标「%」

- **位置**：[components/SettingsPanel.tsx:175](../components/SettingsPanel.tsx)、[components/EmojiInspector.tsx:179](../components/EmojiInspector.tsx)
- **问题**：输入框显示的是 `0.50` 这类 0–1 小数，单位却标着 `%`，语义矛盾（0.5% ≠ 50%）。
- **修复**：二选一——(a) 显示层转换为 `50` 并保留 `%`（推荐，更符合直觉）；(b) 去掉 `%` 后缀。注意同步调整 min/max/step 与 blur/Enter 的解析逻辑。
- **验证**：手动输入、滑杆拖动、Enter 提交三种路径数值一致。

### 1.6 「新图」按钮未清理 optimizedImage + 日志文案错误

- **位置**：[app/page.tsx:831-837](../app/page.tsx)、[lib/faceApi.ts:150-164](../lib/faceApi.ts)
- **问题**：
  - 「📤 新图」的 onClick 重置了 image/faces/replacements 等，但没清 `optimizedImage`（压缩画布）和 `activeReplacementId`，旧画布在下次上传前一直占内存；
  - `loadTinyModel(silent=false)`（前台加载路径）却打印「已在**后台**加载完成」，文案与事实相反。
- **修复**：新图按钮补 `setOptimizedImage(null)`、`setActiveReplacementId(null)`（建议提取一个 `resetSession()`）；修正/删除该 console.log（ROADMAP 已声称完成 console cleanup，见 Phase 4）。

---

## Phase 2：性能与渲染质量优化（P1）

### 2.1 Retina 屏画布模糊

- **位置**：[components/FaceCanvas.tsx:52-72](../components/FaceCanvas.tsx)
- **问题**：canvas 的像素尺寸 = CSS 尺寸，未乘 `devicePixelRatio`，在 2x/3x 屏上预览是模糊的（导出不受影响，但预览是用户 90% 的时间所见）。
- **修复**：`canvas.width = cssWidth * dpr`，CSS 尺寸保持不变，绘制前 `ctx.scale(dpr, dpr)`。点击命中检测逻辑无需改（基于 CSS 坐标）。
- **验证**：Mac Retina 屏上预览图与 `<img>` 原图对比清晰度。

### 2.2 画布不响应窗口 resize

- **位置**：[components/FaceCanvas.tsx:52-72](../components/FaceCanvas.tsx)
- **问题**：尺寸计算只在 `image` 变化时执行。旋转屏幕/调整窗口后画布与容器错位。
- **修复**：用 `ResizeObserver` 监听 `containerRef`，尺寸变化时重算 scale 与 canvasSize。
- **验证**：桌面拖拽窗口宽度、移动端旋转屏幕，画布跟随缩放，badge 位置正确（`useFaceBadgeLayout` 依赖 canvasSize，会自动联动）。

### 2.3 「全部替换」串行预加载同一个 emoji N 次

- **位置**：[app/page.tsx:407-413](../app/page.tsx)（`handleApplyToAll`）
- **问题**：循环 `await handleFaceClick(face.id)`，同一 emoji 被串行 preload N 次（50 张脸 = 50 次等待），且触发 N 次独立 setState。
- **修复**：preload 一次 → 一次性 `setReplacements` 构建全部替换项。
- **验证**：50+ 张脸的合影图上点「全部替换」，应即时完成。

### 2.4 导出复用图片缓存 + O(n²) 查找

- **位置**：[app/page.tsx:488-632](../app/page.tsx)（`handleExport`）
- **问题**：导出时对每个替换项重新 `new Image()` 从 CDN 加载（离线/CDN 抖动时导出的 emoji 会缺失）；`faces.find` 在 replacements.map 内是 O(n²)。
- **修复**：复用 2.2 的图片缓存（预览时已加载过，导出必然命中）；`faces` 先建 `Map<id, face>`。此项与 3.4（绘制逻辑合并）一起做最省力。

### 2.5 模型加载进度改为真实进度（可选，低收益）

- **位置**：[lib/faceApi.ts:83-131](../lib/faceApi.ts)（`simulateProgressiveLoading`）
- **现状**：进度条是定时器模拟的。可改为 `fetch` + `ReadableStream` 按字节统计真实进度，但模型已本地托管（~6MB，通常 <2s），**建议维持现状**，仅在此记录取舍理由。

---

## Phase 3：Clean Code / 死代码清理（P2）

> 以下删除均先 `grep -rn` 确认零引用后执行，一次一个语义化 commit。

### 3.1 移除 4 个未使用的依赖

`package.json` 中以下包全仓库零引用，直接移除并重新 lockfile：

- `html2canvas`（1.4MB+，导出走的是原生 canvas API）
- `@radix-ui/react-dialog`
- `@radix-ui/react-select`
- `@radix-ui/react-slider`

**验证**：`npm run build` 通过。

### 3.2 清理 lib 层死代码

- [lib/faceApi.ts](../lib/faceApi.ts)：`detectFaces`（页面统一走 `runFaceDetection → detectFacesWithLandmarks`）、`loadModels`（已标 @deprecated 且无调用方）、`areModelsLoaded` 及 `isModelsLoaded` legacy flag；
- [lib/twemoji.ts](../lib/twemoji.ts)：`preloadEmojis` 无调用方；
- [lib/emojiRenderUtils.ts](../lib/emojiRenderUtils.ts)：`applyUserOffsets` 已标 @deprecated（offsetX/offsetY 功能 v0.2.0 移除），但 page.tsx 与 FaceCanvas 仍在传 0 调用——移除函数及调用点、连同 `EmojiReplacement.offsetX/offsetY` 类型字段一起删。

### 3.3 清理 types/index.ts

- `EmojiSettings.size`（'36x36' | '72x72'）：Twemoji 现在固定 SVG，该字段无任何消费方（SettingsPanel 重置时还在写死 '72x72'）→ 删除；
- `DetectionSettings.detector` 的 `'mtcnn'` 联合成员：从未支持 → 删除；
- `AppState`、`CanvasDimensions`：零引用 → 删除；
- `ModelLoadingState` 在 [components/ModelLoadingModal.tsx](../components/ModelLoadingModal.tsx) 重复定义了一份 → 统一从 `@/types` 导入。

### 3.4 合并四处重复的 emoji 绘制逻辑

FaceCanvas（图片分支 + 原生分支）与 handleExport（图片分支 + 原生分支）共 4 段几乎相同的 canvas 绘制代码（~150 行）。提取为：

```ts
// lib/emojiRenderUtils.ts
export function drawEmojiReplacement(
  ctx: CanvasRenderingContext2D,
  face: DetectedFace,
  replacement: EmojiReplacement,
  options: { scale?: number; image?: HTMLImageElement } // image 缺省走原生文本
): void
```

预览与导出共用同一套几何/翻转/透明度计算，保证「所见即所得」，也让 1.1、2.4 的修复只需改一处。

### 3.5 提取重复的检测流程

`handleImageLoad` 与 `handleRedetect`（[app/page.tsx:274-344, 441-484](../app/page.tsx)）有 ~40 行相同的「设消息 → 延时 → runFaceDetection → 空结果/超 50 提示 → setFaces」逻辑 → 提取 `detectAndSetFaces(input, scale)`。

### 3.6 合并两段相同的 SettingsPanel 渲染

[app/page.tsx:716-748](../app/page.tsx) 两个 JSX 块除动画 delay 外完全一致 → 合并为一个条件 `(!image || faces.length > 0) && !isProcessing`。

### 3.7 page.tsx 瘦身（可选）

主页面 1000+ 行。建议把 `handleExport` 抽到 `lib/exportImage.ts`，Header/Footer 抽为组件。控制在纯搬运，不改逻辑。

### 3.8 统一错误提示通道

[components/ImageUploader.tsx](../components/ImageUploader.tsx) 用 `alert()` 报「文件过大/类型错误」，与全站 Toast 风格割裂 → 增加 `onError?: (message: string) => void` prop，由 page 接到 Toast。

---

## Phase 4：文档与文案对齐（P2）

### 4.1 README.md 修正

- ❌ 引用不存在的 `lib/emojiSearch.ts`（已删除）与 `MODELS_DOWNLOAD.md`（实际文件是 `MODELS_SETUP.md`）；
- ❌ 「3600+ emojis with **Chinese keyword search**」——中文搜索随 emojiSearch.ts 一起没了，需删改或列入 roadmap；
- ❌ clone URL 是 `yourusername/no-face` 占位符 → `BazingaOrg/no-face`；
- ❌ 配置段仍写「position offset」可定制（v0.2.0 已移除）；
- ❌ 中文版项目结构缺 `hooks/`、`utils/`、`docs/` 与 EmojiInspector 等组件（英文版有、中文版漏）；
- 补充：已实现的实时相机规范文档链接（docs/real-time-camera.md）。

### 4.2 CLAUDE.md 修正（给 AI 协作者的事实源，错误成本最高）

- 模型加载描述自相矛盾（开头说「currently loaded from CDN」，Important Notes 又说「local /models with CDN fallback」——后者正确）；
- `lib/faceApi.ts:15` / `line 29` 行号已失效 → 改为描述 `MODEL_URLS` 常量而非行号；
- 引用 `lib/emojiSearch.ts`、`MODELS_DOWNLOAD.md` 同 4.1；
- 组件结构漏 EmojiInspector / ModelLoadingModal / ProcessingOverlay / Toast，且完全没提 `hooks/`、`utils/`、`lib/runFaceDetection.ts`；
- 技术栈写 `face-api.js`，实际是 `@vladmandic/face-api`（fork，TFJS 版本不同，行为有差异）。

### 4.3 ROADMAP.md 修正

- 「Console cleanup ✅ 已完成」与事实不符（faceApi.ts / page.tsx 仍有 console.log，Phase 1.6 清完后再勾）；
- 版本号「1.2.0 → 0.2.0」与 package.json 的 `0.1.0` 三者不一致 → 统一为 0.2.0（package.json bump）；
- 「Chinese emoji search (partial implementation) ✅」→ 改为未实现/待恢复。

### 4.4 文案与元数据

- [app/layout.tsx](../app/layout.tsx)：`<html lang="en">` 但 UI 全中文 → `lang="zh-CN"`（影响读屏与搜索引擎判定）；metadata 可补充 OpenGraph 标签；
- [components/Toast.tsx](../components/Toast.tsx)：固定旋转 ⚙️ 图标，对「✅ 完成」「❌ 失败」类消息观感奇怪 → 图标随消息类型切换或直接去掉旋转。

---

## Phase 5：工程化基础（P2）

### 5.1 纯函数单元测试（性价比最高的测试投入）

引入 vitest，只测无 DOM 依赖的纯函数：

- `getEmojiCodepoint`（含 1.3 的 ZWJ 回归用例：❤️‍🔥、🏳️‍🌈、😀、☹️）；
- `calculateEmojiSize`（方脸/宽脸/长脸三分支）;
- `mapCoordinatesToOriginal`、`getImageSizeCategory`、`formatFileSize`。

### 5.2 CI

GitHub Actions：push/PR 时跑 `lint + tsc --noEmit + vitest + next build`。仓库已有 PR 流程（见 CVE 修复 PR），补 CI 能拦住文档/代码漂移。

### 5.3 安全响应头（ROADMAP 既有条目）

`next.config.ts` 增加 `headers()`：CSP 限定 `img-src 'self' data: blob: https://cdn.jsdelivr.net`、`connect-src 'self' https://cdn.jsdelivr.net` 等，与「本地处理、不外传」的隐私卖点互为背书。注意先在开发环境验证 emoji-picker-react 的资源域名。

---

## Phase 6：功能补充建议（P3，按 ROADMAP 优先级排期）

按「用户价值 / 实现成本」排序的建议顺序：

1. **PWA 离线支持** ⭐ 推荐提前——模型已本地托管，只差 service worker 缓存模型 + Twemoji 资源。完成后应用可完全离线运行，是「隐私优先」定位的最强证明，成本约 1 天（next-pwa 或手写 SW）；
2. **拖拽重定位 emoji**（ROADMAP 标记的用户最高需求）——注意 v0.2.0 删掉的 offsetX/offsetY 字段需要重新引入，建议与 Phase 3.2 的删除决策对齐：如果 1 个月内会做拖拽，保留字段只删 UI；
3. **撤销/重做**——replacements 是纯数据数组，快照式历史栈实现简单（Ctrl+Z / Ctrl+Shift+Z）；
4. **恢复中文 emoji 搜索**——重建 emojiSearch.ts 或给 emoji-picker-react 注入自定义搜索索引；
5. **实时相机模式**——规范已完成（docs/real-time-camera.md），按其状态机分阶段实施；
6. Web Worker 检测：ROADMAP 曾以「face-api 依赖 DOM」推迟。@vladmandic/face-api 实际可在 Worker + OffscreenCanvas 下运行（Chromium 系），但 Safari 兼容性差、收益被 1920px 压缩策略稀释，**建议继续推迟**。

---

## 执行顺序与提交规划

```
Phase 1（P0 bug）
  fix(twemoji): keep FE0F in ZWJ sequences and switch to maintained CDN   ← 1.3
  fix(face-canvas): cache emoji images and cancel stale async draws       ← 1.2 + 2.1 可同 PR
  fix(page): stop rewriting emojiUrl on settings change; native fallback on draw error ← 1.1
  fix(image-uploader): use object URL instead of data URL                 ← 1.4
  fix(ui): correct percent labels & stale state cleanup                   ← 1.5 + 1.6
Phase 2（P1 性能）
  perf(face-canvas): render at devicePixelRatio and observe resize        ← 2.1 + 2.2
  perf(page): batch apply-to-all replacements                             ← 2.3
  perf(export): reuse emoji cache and face map                            ← 2.4（依赖 3.4）
Phase 3（P2 清理）
  chore(deps): remove unused html2canvas and radix-ui packages            ← 3.1
  refactor(lib): remove dead code and stale types                         ← 3.2 + 3.3
  refactor(emoji-render): unify draw logic for preview and export         ← 3.4
  refactor(page): extract shared detection flow, merge duplicate JSX      ← 3.5 + 3.6 + 3.8
Phase 4（P2 文档）
  docs: align README/CLAUDE/ROADMAP with actual codebase                  ← 4.1-4.3
  fix(layout): set lang=zh-CN and polish toast icon                       ← 4.4
Phase 5（P2 工程化）
  test: add vitest unit tests for pure utilities                          ← 5.1
  ci: add lint/typecheck/test/build workflow                              ← 5.2
  feat(security): add CSP headers                                         ← 5.3
Phase 6 按需单独立项
```

**每步验证基线**：`npm run lint && npx tsc --noEmit && npm run build` + 手动走通核心链路（上传 → 检测 → 替换 → 微调 → 导出），Phase 1 各项另有上文列出的针对性验证步骤。

---

*生成时间：2026-07-05 · 审查范围：main @ 3124ebd*
