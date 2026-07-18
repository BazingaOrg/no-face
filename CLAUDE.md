# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**No Face** is a privacy-focused web application that replaces faces in images with emojis. All processing happens client-side in the browser - no data is uploaded to servers.

**Tech Stack**: Next.js 15 (App Router), TypeScript, Tailwind CSS v4, @mediapipe/tasks-vision (in a Web Worker), emoji-picker-react, Framer Motion

## Common Commands

### Development

```bash
# Install dependencies
ni

# Start development server (uses Turbopack)
bun run dev

# Build for production
bun run build

# Start production server
bun run start

# Run linter
bun run lint
```

**Dev server**: http://localhost:3000

### Model Files Setup

Face detection runs via MediaPipe's `FaceDetector` (full-range BlazeFace) in a dedicated Web Worker (`workers/faceDetection.worker.ts`). Both the `.task` model (`public/models/blaze_face_full_range.task`) and the WASM runtime (`public/mediapipe/wasm/`) are self-hosted — no CDN access at runtime. GPU delegate is tried first, falling back to CPU on failure.

See `MODELS_SETUP.md` for detailed instructions.

## Architecture

### Core Workflow

1. **Image Upload** (`components/ImageUploader.tsx`) - Drag & drop, click, or mobile camera (object URL based)
2. **Face Detection** (`lib/runFaceDetection.ts` → `lib/faceDetectorClient.ts` → `workers/faceDetection.worker.ts`) - MediaPipe FaceDetector running off the main thread; large images are downscaled first via `utils/imageOptimization.ts`, then transferred to the Worker as an `ImageBitmap`
3. **Emoji Selection** (`components/EmojiSelector.tsx`) - Chinese-searchable curated grid by default, full emoji-picker-react panel on demand, plus a random button
4. **Canvas Display** (`components/FaceCanvas.tsx`) - Interactive preview with click-to-replace, per-face badges, devicePixelRatio rendering, drag-to-reposition on the inspected face
5. **Per-face Tuning** (`components/EmojiInspector.tsx`) - Bottom sheet for scale/opacity/flip on a single face
6. **Export** (`app/page.tsx:handleExport`) - Original quality PNG drawn with the same routine as the preview (`drawEmojiReplacement`)

### State Management

All state is managed in `app/page.tsx` using React `useState`:

- `image`: Uploaded HTMLImageElement
- `faces`: Array of `DetectedFace` objects with bounding boxes
- `replacements`: Array of `EmojiReplacement` objects mapping faces to emojis
- `selectedEmoji`: Currently selected emoji character
- `detectionSettings`: Face detection configuration (detector type, confidence threshold)
- `emojiSettings`: Global emoji rendering defaults (scale, opacity, flip)
- `useHistoryStack` (`hooks/useHistoryStack.ts`): Undo/redo history of `{ faces, replacements }` snapshots (capped at 50). `pushHistory()` must be called BEFORE any mutation that should be undoable; the hook reads the current value through a per-render-updated ref, so push/undo/redo keep stable identities (safe to store in a toast's action button, which outlives the render that created it)

### Key Data Flow

```plaintext
1. User uploads image
   → handleImageLoad()
   → optimizeImageForDetection() (if > 1920px wide)
   → detectAndSetFaces() → runFaceDetection()
   → setFaces(detectedFaces)

2. User selects emoji
   → handleEmojiSelect(emoji)
   → setSelectedEmoji(emoji)

3. User clicks face on canvas
   → handleFaceClick(faceId)
   → preloadEmojiWithFallback(emoji)  # empty URL = native-glyph fallback
   → setReplacements([...prev, newReplacement])

4. User exports image
   → handleExport()
   → Create canvas at original resolution
   → Draw image + all emoji replacements
   → Export as PNG blob
```

### Type System

Core types defined in `types/index.ts`:

- `DetectedFace`: Face detection results (id, box coordinates, confidence scores)
- `EmojiReplacement`: Emoji-to-face mapping (faceId, emoji character, URL, scale/opacity/flip, and `offsetX/offsetY` — a user-dragged position offset in original-image pixels, applied on top of the auto-centered position)
- `DetectionSettings`: Face detection configuration
- `EmojiSettings`: Emoji rendering configuration

### Component Structure

```
app/page.tsx                 # Main page with state management and orchestration
├── components/ImageUploader.tsx    # Image upload UI (drag & drop + camera)
├── components/FaceCanvas.tsx       # Canvas with face boxes + emoji overlays + badges
├── components/EmojiSelector.tsx    # Emoji picker integration + random button
├── components/EmojiInspector.tsx   # Per-face tuning bottom sheet
├── components/SettingsPanel.tsx    # Detection settings controls
├── components/ModelLoadingModal.tsx # Model loading progress modal
├── components/ProcessingOverlay.tsx # Detection progress overlay
└── components/Toast.tsx            # Toast notifications (optional undo action)
```

### Utility Libraries

- `lib/faceDetectorClient.ts`: main-thread Worker client (starts the Worker, `init`/`detect`/`dispose`, `createImageBitmap` + transfer, Promise-per-request via an id)
- `workers/faceDetection.worker.ts`: MediaPipe FaceDetector running in a module Worker (GPU delegate with CPU fallback, fixed low confidence threshold — the main thread filters by `minConfidence`)
- `lib/runFaceDetection.ts`: Normalised detection pipeline (coordinate mapping back to original size)
- `lib/twemoji.ts`: Twemoji CDN utilities for emoji URL generation and preloading
- `lib/emojiImageCache.ts`: Shared emoji bitmap cache (dedupes CDN fetches, enables synchronous redraws)
- `lib/emojiRenderUtils.ts`: Emoji size calculation and the shared `drawEmojiReplacement` routine
- `utils/imageOptimization.ts`: Large-image downscaling and coordinate mapping
- `hooks/`: `useFaceBadgeLayout`, `useFrameDebouncedCallback`, `useInspectorActions`

## Important Notes

### Face Detection Models

**Current**: Models loaded from local `/models` directory (fallback to CDN if not available)

**Setup**: See `MODELS_SETUP.md` for detailed setup instructions

**Configuration**: `workers/faceDetection.worker.ts` points `FilesetResolver.forVisionTasks` at `/mediapipe/wasm` and `modelAssetPath` at `/models/blaze_face_full_range.task` - both self-hosted, no CDN fallback

### Emoji Loading

- Emojis loaded from the maintained Twemoji fork (`https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/`)
- SVG format for vector quality; FE0F variation selectors are kept only in ZWJ sequences (Twemoji filename convention)
- CORS enabled (`crossOrigin = 'anonymous'`) for canvas export
- Bitmaps go through `lib/emojiImageCache.ts`; a failed CDN load falls back to drawing the native emoji glyph in both preview and export

### Canvas Export

Export happens at **original image resolution** (not display resolution) to maintain quality:

1. Create offscreen canvas at `image.naturalWidth × image.naturalHeight`
2. Draw original image
3. Load and draw all emoji replacements at scaled positions
4. Export as PNG blob via `canvas.toBlob()`

### Settings Behavior

Settings changes trigger **automatic re-application** of styles (scale, opacity, flip) to existing non-custom replacements (the `emojiSettings` effect in `app/page.tsx`). Replacements customised via the inspector (`isCustom`) are left untouched, and `emojiUrl` is never rewritten (an empty URL means native-glyph fallback and must stay that way).

### Drag to Reposition

Dragging is scoped to whichever face is currently open in the inspector (`activeReplacementId`) — `FaceCanvas` hit-tests pointer-down against that face's emoji rect (`getEmojiScreenRect`) and only starts a drag there, so other faces keep their plain click-to-replace behavior. A 4px movement threshold distinguishes a drag from a tap: below it, pointerup falls through to the normal click handler (still replaces the emoji); above it, the click that follows is suppressed (`justDraggedRef`) so a drag doesn't also re-apply the emoji. Position updates go through `useFrameDebouncedCallback` (one update per animation frame) via `onRepositionActiveEmoji` — wired directly to the inspector's `handleInspectorUpdate`, so dragging and the inspector's own patches share one code path and both mark `isCustom: true`. "恢复默认值" resets `offsetX`/`offsetY` to 0 along with scale/opacity/flip.

### Undo/Redo

A single linear history of `{ faces, replacements }` snapshots, implemented by the generic `useHistoryStack` hook (`hooks/useHistoryStack.ts`, capped at 50 entries). The hook reads the current value through a ref updated every render, so `push`/`undo`/`redo` keep stable identities while always snapshotting the latest state at invocation time — this is what makes them safe to store in the toast's action button (a per-render closure stored in state would go stale before the user clicks it, corrupting the redo stack). Every mutation site calls `pushHistory()` right before it changes `faces`/`replacements`; both arrays restore together because `handleRedetect` generates brand-new face IDs, so old replacements only make sense paired with the old `faces`. A new action after an undo clears the redo stack, matching standard editor semantics. `handleFaceClick` skips the push (and the whole update) when the clicked face already has the selected emoji, so repeat clicks don't burn no-op undo steps.

**Coalescing continuous gestures**: `pushHistory` fires once per discrete action (a face click, "全部替换", "重置", the inspector's buttons) but must NOT fire on every tick of a slider drag or canvas drag — that would make Ctrl+Z step back one pixel at a time. Continuous inputs instead call a separate `onBeginEdit`/`onBeginDragReposition` callback exactly once, at gesture start:
- `EmojiInspector`: slider `onPointerDown` and number-input `onFocus` (both scale and opacity), plus the flip buttons' `onClick` (a single push right before `onUpdate`)
- `FaceCanvas`: the moment a drag crosses `DRAG_THRESHOLD_PX` (before the first `scheduleReposition` call for that gesture)

Keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z) are handled by a `window` `keydown` listener in `app/page.tsx`; it's skipped when `event.target` is an `INPUT`/`TEXTAREA`/`contenteditable` element so native text-field undo still works. `handleImageLoad` and "换一张" both call `clearHistory()` — history from a previous photo doesn't carry over.

### Advanced Settings Panel

The settings panel uses a **unified card-style design** (v0.2.0):
- Button and content are wrapped in a single card container
- Button acts as the card header with conditional border
- Content expands/collapses smoothly with Framer Motion
- Matches Duolingo-inspired design language

### Emoji Selector

- Opening "🎨 选择表情" shows a Chinese-searchable grid over the curated pool first (`lib/emojiSearch.ts`'s `searchCuratedEmojis`, matched against hand-written keywords in `EMOJI_KEYWORDS_ZH`) — `emoji-picker-react` has no API to add aliases to its bundled Unicode dataset, so Chinese search only covers this curated set, not the full picker
- The full emoji-picker-react panel (~3600 emojis, English search only) stays lazy-loaded behind a separate "展开完整表情库" toggle, unmounted until explicitly opened
- `POPULAR_EMOJIS` in `components/EmojiSelector.tsx` also backs the 🎲 random button (kept with intentional duplicates so common expressions are weighted higher); `CURATED_EMOJI_POOL` is the deduped version used for the search grid
- Search query and the full-picker toggle both reset when the panel closes

### Known Issues

See `docs/plans/2026-07-17-perf-and-model-optimization.md` for the current plan and remaining debt:

- ✅ Large images (>10MB) - **Solved**: Auto-compression to 1920px with coordinate mapping
- ⚠️ Safari compatibility needs testing
- ⚠️ emoji-picker-react loads ~3600 emojis when the panel is opened - virtualization planned

## Development Guidelines

### When Adding Features

1. **Check `docs/plans/` first** - The latest plan doc is the source of truth for planned features and technical debt
2. **Update types/** if adding new data structures
3. **Settings should be configurable** - Add to `DetectionSettings` or `EmojiSettings` interfaces
4. **Maintain privacy guarantee** - All processing must remain client-side

### When Modifying Face Detection

- Test with various image sizes and face counts
- Verify detection confidence thresholds work across different lighting conditions
- Consider performance impact (detection can be CPU-intensive)

### When Modifying Export

- Always test at original resolution (not just display size)
- Verify CORS headers for emoji loading
- Test with multiple emoji replacements
- Check PNG quality and file size

## File Locations

- Face detection logic: `workers/faceDetection.worker.ts`, `lib/faceDetectorClient.ts`, `lib/runFaceDetection.ts`
- Emoji utilities: `lib/twemoji.ts`, `lib/emojiImageCache.ts`, `lib/emojiSearch.ts` (Chinese keyword search)
- Emoji rendering: `lib/emojiRenderUtils.ts`
- Image optimization: `utils/imageOptimization.ts`
- Type definitions: `types/index.ts`
- Main application: `app/page.tsx`
- Components: `components/*.tsx`
- Hooks: `hooks/*.ts`
- Models: `public/models/` (self-hosted)
- Plans (source of truth for TODOs): `docs/plans/`
- Model setup guide: `MODELS_SETUP.md`
- Design specs & improvement plans: `docs/`
