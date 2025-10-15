# No Face - Development Roadmap

Privacy-first face masking tool - Replace faces with emojis, all processing done locally in your browser.

## ✅ Completed Features (MVP - Phase 1)

- [x] Project initialization (Next.js 15 + TypeScript + Tailwind CSS v4)
- [x] Image upload (drag & drop + click + mobile camera)
- [x] Face detection (face-api.js with SSD MobileNet V1 + Tiny Face Detector)
- [x] Canvas display with face overlay and interactive face boxes
- [x] Emoji picker integration (emoji-picker-react) with Chinese keyword search
- [x] Click-to-replace workflow
- [x] Export original quality image (PNG format)
- [x] Mobile responsive design (Duolingo-inspired UI)
- [x] Advanced settings panel
  - [x] Detection sensitivity slider
  - [x] Detector type selection (SSD vs Tiny)
  - [x] Performance mode for Tiny Face Detector (极速/平衡/精准)
  - [x] Emoji size/scale adjustment
  - [x] Emoji opacity control
  - [x] Position offset controls (X/Y)
  - [x] Flip controls (horizontal/vertical)
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

### High Priority

- [x] **Model files hosting**: Models can be self-hosted or loaded from CDN
  - **Status**: Using local `/models` with CDN fallback
  - **Setup guide**: See `MODELS_DOWNLOAD.md` for instructions
  - **Configuration**: `lib/faceApi.ts` line 29 switches between local/CDN
  - **Note**: Face Landmarks 68 model downloaded but not currently in use (prepared for future features)

- [ ] **Model loading progress indicator**: Show loading state for better UX
  - **Impact**: Model files are ~5-10MB, initial load can take 2-5 seconds
  - **TODO**: Add progress bar or spinner during model initialization
  - **TODO**: Show which model is currently loading

- [ ] **Large image optimization**: Images > 10MB may cause performance issues
  - **Consider**: Web Worker for face detection (non-blocking UI)
  - **Consider**: Progressive loading indicator
  - **Consider**: Auto-compress input to max 1920px width for processing
  - **Status**: Currently processing on main thread, may block UI for large images

### Medium Priority

- [ ] **Emoji loading optimization**: emoji-picker-react loads ~3600 emojis
  - **Consider**: Virtual scrolling implementation
  - **Consider**: Lazy loading by category
  - **Consider**: Preload popular emojis only

- [ ] **Browser compatibility testing**
  - [ ] Safari (especially iOS Safari)
  - [ ] Chrome/Edge (Chromium-based)
  - [ ] Firefox
  - [ ] Mobile browsers

### Low Priority

- [ ] **Performance monitoring**: Add metrics for face detection time
- [ ] **Error boundary**: Graceful error handling for unsupported browsers
- [ ] **Accessibility**: Keyboard navigation, ARIA labels, screen reader support
- [x] **Console cleanup**: Remove debug console statements from production code

## 🔮 Future Features (Phase 2+)

### Phase 2: Enhanced Editing

- [ ] Individual face editing
  - [x] Click to apply emoji to specific face
  - [x] Flip emoji (horizontal/vertical)
  - [ ] Drag to reposition emoji per face
  - [ ] Pinch/scroll to scale emoji per face
  - [ ] **Emoji rotation** ⚠️ *Previously implemented but removed due to poor UX*
    - [ ] Redesign interaction model (slider-based rotation works but lacks intuitiveness)
    - [ ] Improve canvas-based rotation (mouse drag + two-finger touch needs better visual feedback)
    - [ ] Auto-rotation based on Face Landmarks 68 (model downloaded but feature disabled)
    - [ ] Consider rotation handle UI similar to professional image editors
- [ ] Undo/Redo functionality
  - [ ] History stack implementation
  - [ ] Keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z)
- [x] Batch operations
  - [x] "Apply to All" button (one-click replace all faces)
  - [x] "Clear All/Reset" button (remove all emoji replacements)
- [ ] Multiple emoji styles
  - [ ] Apple emoji style
  - [ ] Google emoji style
  - [x] Twitter emoji style (Twemoji, current default)

### Phase 3: Advanced Features

- [ ] Real-time camera mode
  - [ ] Access device camera (getUserMedia API)
  - [ ] Live face detection and replacement
  - [ ] Capture photo with applied emojis
- [ ] Preset styles/packs
  - [ ] Funny Pack (🤪😜🤡)
  - [ ] Cute Pack (🥰😊😸)
  - [ ] Professional Pack (😎🤓👔)
  - [x] Random mode (random emoji button)
- [ ] Face recognition (experimental)
  - [ ] Remember emoji choice per person across uploads
  - [ ] Local storage persistence
- [ ] GIF/Video support
  - [ ] Frame-by-frame processing
  - [ ] Export as animated GIF

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

- [ ] Handle edge cases
  - [x] No faces detected (show helpful message)
  - [ ] Too many faces (>50) performance warning
  - [ ] Very small faces (<50px) detection threshold
- [x] Emoji CDN fallback (fallback to native emoji rendering)
- [ ] Safari compatibility issues (if any)
- [ ] Touch event conflicts on mobile canvas
- [ ] Memory leaks in face detection loop

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
  - [x] Chinese emoji search (partial implementation)
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

## 📅 Timeline

- **Week 1**: MVP implementation ✅ (Completed)
- **Week 2**: Code cleanup, documentation, testing ✅ (Completed)
  - Added flip controls, performance mode optimization
  - Simplified emoji format (default to SVG)
  - Attempted rotation feature (removed due to poor UX, needs redesign)
- **Week 3**: Performance optimization, model loading improvements (Current)
  - Focus: Web Worker integration, loading progress indicator
  - Focus: Batch processing and caching strategies
- **Week 4+**: Phase 2 features based on user feedback
  - Redesign rotation interaction
  - Drag-to-reposition functionality
  - Enhanced mobile gesture support

## 🤝 Contributing

This project welcomes contributions! See GitHub issues for open tasks.

---

**Last Updated**: 2025-10-15
**Current Phase**: Phase 1 Refinement → Phase 2 Planning
**Version**: 1.1.0
**Recent Updates**: Enhanced UX with smart state management, expanded emoji collection to 140+ curated emojis
