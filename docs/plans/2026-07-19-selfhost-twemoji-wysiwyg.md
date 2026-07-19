# Twemoji 自托管 + 工具栏所见即所得

> 2026-07-19。背景：用户发现工具栏（系统字形）与画布贴图（Twemoji）长相不一致；同时 Twemoji 走 jsdelivr CDN，是全站唯一的运行时外部资源依赖，与"本地处理"定位不符。两个问题一并解决。

## 方案

1. **自托管资产**：脚本一次性下载 `CURATED_EMOJI_POOL`（lib/emojiSearch.ts）全部 emoji 对应的 Twemoji 15.1.0 SVG 到 `public/emoji/`（文件名沿用 codepoint 规则，与 lib/twemoji.ts 的 URL 生成逻辑一致）。
2. **lib/twemoji.ts**：CDN base 改为 `/emoji/`；保留加载失败回退系统字形的逻辑。
3. **工具栏 WYSIWYG**：EmojiToolbar 按钮（精选网格 + 搜索结果）从渲染字符改为渲染 Twemoji `<img loading="lazy">`，`onError` 回退为原生字符；骰子按钮、Inspector 等其他显示 emoji 的 UI 位一并排查统一。
4. **SW 缓存**：public/sw.js 新增 `/emoji/` 缓存路由，CACHE_VERSION 递增。
5. 下载脚本放 `scripts/`（一次性工具，Node 无依赖），README 隐私章节补一句 emoji 资产也自托管。

## 验收

- 断网（DevTools offline）后工具栏与画布 emoji 均正常显示（SW 缓存生效后）。
- 工具栏与画布图案一致；导出图不变（仍 Twemoji 原图）。
- tsc / lint / vitest 通过；浏览器实测由用户完成。

分派：实现 fast-worker → 浏览器验收 用户本人。
