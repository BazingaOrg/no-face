# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**No Face** is a privacy-focused web application that replaces faces in images with emojis. All processing happens client-side in the browser - no data is uploaded to servers.

**Tech Stack**: Next.js 15 (App Router), TypeScript, Tailwind CSS v4, face-api.js, emoji-picker-react, Framer Motion

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

Face detection models are currently loaded from CDN (jsDelivr). To use local models:

1. Download models from: https://github.com/justadudewhohacks/face-api.js/tree/master/weights
2. Place in `public/models/` directory:
   - `ssd_mobilenetv1_model-weights_manifest.json`
   - `ssd_mobilenetv1_model-shard1`
   - `ssd_mobilenetv1_model-shard2`
3. Update `lib/faceApi.ts:15` from `MODEL_URLS[1]` to `MODEL_URLS[0]`

See `MODELS_DOWNLOAD.md` for detailed instructions.

## Architecture

### Core Workflow

1. **Image Upload** (`components/ImageUploader.tsx`) - Drag & drop, click, or mobile camera
2. **Face Detection** (`lib/faceApi.ts`) - Uses face-api.js with SSD MobileNet V1 or Tiny Face Detector
3. **Emoji Selection** (`components/EmojiSelector.tsx`) - Emoji picker with search (supports Chinese keywords)
4. **Canvas Display** (`components/FaceCanvas.tsx`) - Interactive preview with click-to-replace
5. **Export** (`app/page.tsx:handleExport`) - Original quality PNG with emojis rendered

### State Management

All state is managed in `app/page.tsx` using React `useState`:

- `image`: Uploaded HTMLImageElement
- `faces`: Array of `DetectedFace` objects with bounding boxes
- `replacements`: Array of `EmojiReplacement` objects mapping faces to emojis
- `selectedEmoji`: Currently selected emoji character
- `detectionSettings`: Face detection configuration (detector type, confidence threshold)
- `emojiSettings`: Emoji rendering options (format, size, scale, opacity, offsets)

### Key Data Flow

```plaintext
1. User uploads image
   → handleImageLoad()
   → detectFaces(image, detectionSettings)
   → setFaces(detectedFaces)

2. User selects emoji
   → handleEmojiSelect(emoji)
   → setSelectedEmoji(emoji)

3. User clicks face on canvas
   → handleFaceClick(faceId)
   → getTwemojiUrl(emoji, emojiSettings)
   → preloadEmoji(url)
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
├── components/FaceCanvas.tsx       # Canvas with face boxes + emoji overlays
├── components/EmojiSelector.tsx    # Emoji picker integration
└── components/SettingsPanel.tsx    # Detection & emoji settings controls
```

### Utility Libraries

- `lib/faceApi.ts`: face-api.js wrapper for model loading and face detection
- `lib/twemoji.ts`: Twemoji CDN utilities for emoji URL generation and preloading
- `lib/emojiSearch.ts`: Chinese keyword search for emojis
- `lib/emojiRenderUtils.ts`: Emoji size calculation and positioning utilities

## Important Notes

### Face Detection Models

**Current**: Models loaded from local `/models` directory (fallback to CDN if not available)

**Setup**: See `MODELS_DOWNLOAD.md` for detailed setup instructions

**Configuration**: `lib/faceApi.ts` line 29 - switches between local and CDN models

### Emoji Loading

- Emojis loaded from Twemoji CDN (`https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/`)
- SVG format preferred for vector quality
- CORS enabled (`crossOrigin = 'anonymous'`) for canvas export

### Canvas Export

Export happens at **original image resolution** (not display resolution) to maintain quality:

1. Create offscreen canvas at `image.naturalWidth × image.naturalHeight`
2. Draw original image
3. Load and draw all emoji replacements at scaled positions
4. Export as PNG blob via `canvas.toBlob()`

### Settings Behavior

Settings changes trigger **automatic re-application** of emojis to existing replacements (see `app/page.tsx:39-55`). This allows real-time preview of scale, opacity, and offset adjustments without re-clicking faces.

### Known Issues

See `ROADMAP.md` for detailed technical debt and known issues:

- Large images (>10MB) may cause performance issues - consider Web Worker implementation
- Safari compatibility needs testing
- emoji-picker-react loads ~3600 emojis (consider virtualization/lazy loading)

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

- Face detection logic: `lib/faceApi.ts`
- Emoji utilities: `lib/twemoji.ts`
- Emoji Chinese search: `lib/emojiSearch.ts`
- Emoji rendering: `lib/emojiRenderUtils.ts`
- Type definitions: `types/index.ts`
- Main application: `app/page.tsx`
- Components: `components/*.tsx`
- Models: `public/models/` (self-hosted, optional)
- Roadmap: `ROADMAP.md`
- Model setup guide: `MODELS_DOWNLOAD.md`
