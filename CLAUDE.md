# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**No Face** is a privacy-focused web application that replaces faces in images with emojis. All processing happens client-side in the browser - no data is uploaded to servers.

**Tech Stack**: Next.js 15 (App Router), TypeScript, Tailwind CSS v4, @vladmandic/face-api, emoji-picker-react, Framer Motion

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

Face detection models are self-hosted in `public/models/` (SSD MobileNet V1, Tiny Face Detector, and the optional Face Landmarks 68). The `MODEL_URLS` constant in `lib/faceApi.ts` lists the local path first with CDN fallbacks.

See `MODELS_SETUP.md` for detailed instructions.

## Architecture

### Core Workflow

1. **Image Upload** (`components/ImageUploader.tsx`) - Drag & drop, click, or mobile camera (object URL based)
2. **Face Detection** (`lib/runFaceDetection.ts` → `lib/faceApi.ts`) - @vladmandic/face-api with SSD MobileNet V1 or Tiny Face Detector; large images are downscaled first via `utils/imageOptimization.ts`
3. **Emoji Selection** (`components/EmojiSelector.tsx`) - emoji-picker-react with search, plus a random button
4. **Canvas Display** (`components/FaceCanvas.tsx`) - Interactive preview with click-to-replace, per-face badges, devicePixelRatio rendering
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
- `undoSnapshotRef`: Snapshot of faces + replacements taken before destructive actions (reset / re-detect), restored via the toast's undo button

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
- `EmojiReplacement`: Emoji-to-face mapping (faceId, emoji character, URL, position, transforms)
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

- `lib/faceApi.ts`: @vladmandic/face-api wrapper for model loading and face detection
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

**Configuration**: the `MODEL_URLS` constant in `lib/faceApi.ts` - local path first, CDN fallbacks after

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

### Advanced Settings Panel

The settings panel uses a **unified card-style design** (v0.2.0):
- Button and content are wrapped in a single card container
- Button acts as the card header with conditional border
- Content expands/collapses smoothly with Framer Motion
- Matches Duolingo-inspired design language

### Emoji Selector

- The full emoji-picker-react panel renders only when the user expands it (collapsed by default)
- A curated list of ~140 popular emojis backs the random button (`POPULAR_EMOJIS` in `components/EmojiSelector.tsx`)

### Known Issues

See `ROADMAP.md` for detailed technical debt and known issues:

- ✅ Large images (>10MB) - **Solved**: Auto-compression to 1920px with coordinate mapping
- ⚠️ Safari compatibility needs testing
- ⚠️ emoji-picker-react loads ~3600 emojis when the panel is opened - virtualization planned

## Development Guidelines

### When Adding Features

1. **Check ROADMAP.md first** - Planned features and technical debt are tracked there
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

- Face detection logic: `lib/faceApi.ts`, `lib/runFaceDetection.ts`
- Emoji utilities: `lib/twemoji.ts`, `lib/emojiImageCache.ts`
- Emoji rendering: `lib/emojiRenderUtils.ts`
- Image optimization: `utils/imageOptimization.ts`
- Type definitions: `types/index.ts`
- Main application: `app/page.tsx`
- Components: `components/*.tsx`
- Hooks: `hooks/*.ts`
- Models: `public/models/` (self-hosted)
- Roadmap: `ROADMAP.md`
- Model setup guide: `MODELS_SETUP.md`
- Design specs & improvement plans: `docs/`
