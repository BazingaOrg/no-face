# 图标重设计 + 三档主题切换

## 背景与范围

1. **图标**:现 logo/favicon 用的是吉卜力电影截图 `kaonashi.jpg`(版权素材),需要一个原创的、符合项目气质的图标,并生成全套 favicon(16/32/apple-touch/192/512)。
2. **背景**:评估现有 `slate→blue→indigo` 渐变是否需要跟新图标色彩呼应;倾向微调而非重做。
3. **主题切换**:双态(亮/暗)→ 三档(系统/白天/黑夜),切换带丝滑动画。

## 设计方向

### 图标(原创 SVG)

- **意象**:白色椭圆面具 + 两道柔和的淡紫色眼影斜纹(对无脸男的抽象致敬,但为原创绘制,不复制电影造型细节)+ 面具"脸部"位置叠一个小的圆形 emoji 笑脸遮挡——直接表达"用 emoji 遮脸"的产品功能。
- **风格**:大圆角 squircle 底(呼应 UI 的 `rounded-2xl/3xl`),底色用深板岩蓝渐变(`#1e293b → #334155`,与 `themeColor: #1e293b` 一致),暗底白面具对比强,16px 下依然可辨。
- **产物**:`public/icon.svg`(源文件)→ 用 `sharp` 一次性脚本(放 `scripts/`,参照现有 `download-twemoji` 脚本惯例)导出 `favicon-16x16.png`、`favicon-32x32.png`、`apple-touch-icon.png`(180)、`android-chrome-192/512`,覆盖 `app/favicon.ico`。
- **Header logo**:`AppHeader` 里的 `kaonashi.jpg` 一并换成新 SVG(保留摇摆入场动画);`kaonashi.jpg` 从 public 移除。

### 背景

- 保留现有渐变结构(它和玻璃拟态层配合得好),仅微调:亮色端从 `indigo-100` 收敛为 `blue-100`,避免与图标的板岩蓝语言冲突;暗色端不动。
- 不加纹理/图案——编辑器场景要保证画布可读性,背景保持安静。
- 若微调后视觉上区别不明显,就保持原样(在实现时对比截图后定,方案允许"不改")。

### 三档主题切换

- **控件**:头部圆形按钮换成紧凑三段控件,复用现有 `SegmentedControl` 的交互模式但做一个图标版变体(Monitor / Sun / Moon 三个图标,无文字,保持 header 高度),选中滑块沿用 `layoutId` 弹簧动画(stiffness 500 / damping 35,与现有一致)。
- **`lib/theme.tsx`**:已支持 `system` 偏好与 OS 联动,只需删掉 `toggleTheme`、由 UI 直接用 `setTheme`;localStorage/init 脚本逻辑不变。
- **切换动画**:View Transitions API 圆形揭示——从切换按钮位置以 `clip-path: circle()` 扩散出新主题(`document.startViewTransition` + 动画 `::view-transition-new(root)`),时长 ~450ms、ease-out。
  - 不支持的浏览器(Firefox stable)降级:`:root` 加临时 class,对 `background-color/color/border-color/fill` 做 ~300ms CSS 过渡。
  - `prefers-reduced-motion: reduce`:跳过全部动画,瞬时切换。
  - 系统档下 OS 自动变化触发的切换**不做**揭示动画(无手势起点,直接瞬时/短过渡)。

## 实施步骤

1. **`public/icon.svg`** — 我直接绘制(设计工作不委派)→ 验证:浏览器打开目检,16px 缩略可辨
2. **`scripts/generate-icons.mjs`** + 运行 — fast-worker → 验证:产物尺寸正确、favicon.ico 替换成功
3. **`layout.tsx` icons 配置 + `AppHeader` logo 替换 + 删除 `kaonashi.jpg`** — fast-worker → 验证:typecheck、无残留引用(grep kaonashi)
4. **`lib/theme.tsx` 移除 toggle、新增 `ThemeSegmentedControl`(图标版三段控件)接入 `AppHeader`** — fast-worker → 验证:三档持久化正确(system 档清 localStorage)、刷新无闪烁
5. **View Transitions 圆形揭示 + CSS 降级 + reduced-motion** — fast-worker,动画调优我审 → 验证:Chrome 揭示动画、Firefox 降级、reduced-motion 瞬时
6. **背景微调对比** — 我截图对比后定夺,改动仅 `page.tsx:856` 一行
7. **i18n 文案**(三档 aria/label)→ fast-worker
8. **整体验证** — qa-runner:lint、build、全量单测;手动:三档切换 × 明暗 × 刷新持久化

## 风险

- View Transitions 会截屏整页做过渡,若与 Framer Motion 动画同时进行可能有一帧不同步——切换瞬间无高频动画在跑(shimmer 是背景动画,影响可忽略),风险低;审阅时重点看。
- favicon.ico 需多尺寸打包,`sharp` 不直接出 ico——用 `png-to-ico` 或脚本内拼装;devDependencies 新增仅限脚本用途。
- 更换 header logo 会改变品牌观感,先出图确认再动 AppHeader。

## Implementation Notes

实际实现:

- 原创图标 `public/icon.svg`(深板岩蓝 squircle + 白面具 + 淡紫眉痕 + 黄色 emoji 笑脸盖脸),16px 下可辨。`scripts/generate-icons.mjs` 用 sharp 生成全套 PNG,并手写 ICO 容器(PNG-embedded)生成 `app/favicon.ico`,未新增依赖。
- `layout.tsx` icons 增加 SVG 条目;`sw.js` 缓存版本 v4→v5,预缓存含 `/kaonashi.jpg` 与 `/icon.svg`。
- 用户决定:`AppHeader` logo 保留无脸男原图 `kaonashi.jpg`(灵感来源);随后进一步决定 favicon/PWA 图标也改用 `kaonashi.jpg`(裁剪 `--crop 200,20,480` 完整框住面具后重新生成全套),`layout.tsx` 移除 SVG icon 条目、`sw.js` 预缓存仅含 `kaonashi.jpg`。原创图标 `public/icon.svg` 保留在仓库中未被引用,可随时用 `node scripts/generate-icons.mjs` 切回。生成脚本增加了 `[source] [--crop left,top,size]` 参数。
- 三档主题:`lib/theme.tsx` 移除 `toggleTheme`;新增 `components/ThemeSwitch.tsx`(Monitor/Sun/Moon 图标三段控件,radiogroup a11y,layoutId 弹簧滑块与 SegmentedControl 参数一致);`icons.tsx` 新增 Monitor。
- 切换动画:支持时用 `document.startViewTransition` + `flushSync` 内同步翻转 dark class,`::view-transition-new(root)` 上做 450ms 圆形揭示(起点为所点按钮中心);不支持时降级为 `.theme-transition` 全局 300ms 颜色过渡;`prefers-reduced-motion` 与 resolved 主题不变(如 OS 亮色时 light→system)时不播动画;system 档下 OS 自动变化不播动画。
- i18n `themeToggle` 扩展为 `{ aria, system, light, dark }`(en/zh)。
- **背景保持不变**(计划步骤 6 的"允许不改"分支):图标淡紫眉痕与背景 `indigo-100` 同族呼应,无需调整。
- 验证:tsc 与触达文件 lint 均通过;完整手动验证由用户执行。
