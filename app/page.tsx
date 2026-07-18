'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { m, AnimatePresence, MotionConfig } from 'framer-motion';
import ImageUploader from '@/components/ImageUploader';
import FaceCanvas from '@/components/FaceCanvas';
import EmojiToolbar from '@/components/EmojiToolbar';
import IconButton from '@/components/IconButton';
import AppHeader from '@/components/AppHeader';
import AppFooter from '@/components/AppFooter';
import { Undo, Redo, Redetect, Clear, NewPhoto, ApplyAll, Download } from '@/components/icons';
import LoadingOverlay from '@/components/LoadingOverlay';
import Toast from '@/components/Toast';
import {
  DetectedFace,
  EmojiReplacement,
  ModelLoadingState
} from '@/types';
import {
  initFaceDetector,
  disposeFaceDetector,
  setFaceDetectorProgressCallback
} from '@/lib/faceDetectorClient';
import { preloadEmojiWithFallback } from '@/lib/twemoji';
import { drawEmojiReplacement } from '@/lib/emojiRenderUtils';
import { loadEmojiImage } from '@/lib/emojiImageCache';
import {
  optimizeImageForDetection,
  getImageSizeCategory,
  type OptimizedImage
} from '@/utils/imageOptimization';
import { runFaceDetection } from '@/lib/runFaceDetection';
import { useHistoryStack } from '@/hooks/useHistoryStack';
import { useWindowFileDrop } from '@/hooks/useWindowFileDrop';
import { useDelayedVisibility } from '@/hooks/useDelayedVisibility';
import { useI18n } from '@/lib/i18n';
import { canvasEntranceSpring, mobileToolbarSpring, desktopColumnSpring } from '@/lib/motion';

// Detection runs at this confidence threshold by default; if it finds no
// faces, it retries once at a lower threshold before reporting an error.
const DEFAULT_MIN_CONFIDENCE = 0.5;
const FALLBACK_MIN_CONFIDENCE = 0.3;

// Reserves scroll space at the bottom of mobile (<768) editing-state content
// so it isn't hidden behind the fixed docked toolbar — used both on the
// canvas column and (via a wrapper) on AppFooter, so scrolling all the way
// down reveals the footer above the toolbar instead of the toolbar covering it.
// 18rem comfortably clears the toolbar's tallest normal state (search bar +
// emoji row + size slider + two buttons + icon row, ~255px) with margin for
// the safe-area inset on notched devices.
const MOBILE_TOOLBAR_SAFE_AREA = 'pb-72';

const DEFAULT_EMOJI_SIZE = 1.2;
// How long to wait after the last size-slider change before pushing undo
// history — a drag produces many onChange events, but should cost one entry.
const EMOJI_SIZE_HISTORY_DEBOUNCE_MS = 400;

interface HistorySnapshot {
  faces: DetectedFace[];
  replacements: EmojiReplacement[];
}

const MAX_HISTORY = 50;

export default function Home() {
  const { t } = useI18n();

  // State management
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [optimizedImage, setOptimizedImage] = useState<OptimizedImage | null>(null);
  const [faces, setFaces] = useState<DetectedFace[]>([]);
  const [replacements, setReplacements] = useState<EmojiReplacement[]>([]);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeReplacementId, setActiveReplacementId] = useState<string | null>(null);
  const [emojiSize, setEmojiSize] = useState(DEFAULT_EMOJI_SIZE);
  // Tracks whether the toolbar column has ever been shown during this
  // editing session, so a redetect's brief faces=[] gap doesn't unmount and
  // remount it (which would replay its entrance animation as a flicker).
  // Only resets on a genuinely new session (new photo / new image upload).
  const [hasShownFaces, setHasShownFaces] = useState(false);
  // Freezes the displayed face count across a redetect's brief faces=[] gap
  // (see progressText below) so the right column's layout doesn't jump.
  const lastFaceCountRef = useRef(0);

  // Model loading state (loading is deferred to first upload, so this starts
  // idle instead of isLoading: true)
  const [modelLoadingState, setModelLoadingState] = useState<ModelLoadingState>({
    isLoading: false,
    phase: null,
  });

  // Processing message for large images
  const [processingMessage, setProcessingMessage] = useState<string>('');

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string>('');
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [toastAction, setToastAction] = useState<{ label: string; handler: () => void } | null>(
    null
  );

  const showToast = useCallback(
    (message: string, action?: { label: string; handler: () => void }) => {
      setToastMessage(message);
      setToastAction(action ?? null);
      setIsToastVisible(true);
    },
    []
  );

  // Undo/redo history: a stack of { faces, replacements } snapshots.
  // Callers must call history.push() BEFORE mutating faces/replacements —
  // it snapshots the latest values via a ref, so push/undo/redo stay stable
  // across renders (safe to stash in a toast's action button, which outlives
  // the render that created it).
  const restoreHistorySnapshot = useCallback((snapshot: HistorySnapshot) => {
    setFaces(snapshot.faces);
    setReplacements(snapshot.replacements);
    setError(null);
  }, []);

  const history = useHistoryStack<HistorySnapshot>(
    { faces, replacements },
    restoreHistorySnapshot,
    MAX_HISTORY
  );
  const pushHistory = history.push;
  const clearHistory = history.clear;
  const canUndo = history.canUndo;
  const canRedo = history.canRedo;

  // Depend on history.undo/history.redo directly (not the `history` object
  // itself, which is a fresh literal every render) so these stay stable too.
  const { undo, redo } = history;
  const handleUndo = useCallback(() => {
    if (isProcessing) return;
    undo();
  }, [isProcessing, undo]);

  const handleRedo = useCallback(() => {
    if (isProcessing) return;
    redo();
  }, [isProcessing, redo]);

  // Keyboard shortcuts: Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z to redo.
  // Skipped while an editable field has focus so native text-undo still works.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isUndoRedoKey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z';
      if (!isUndoRedoKey) return;

      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isEditableTarget) return;

      event.preventDefault();
      if (event.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  useEffect(() => {
    if (faces.length > 0) {
      setHasShownFaces(true);
    }
  }, [faces]);

  useEffect(() => {
    if (!activeReplacementId) return;

    const exists = replacements.some((replacement) => replacement.faceId === activeReplacementId);
    if (!exists) {
      setActiveReplacementId(null);
    }
  }, [activeReplacementId, replacements]);

  // Set up the detector's progress callback once on mount, and dispose the
  // Worker on unmount to release its WASM/GPU resources. Actual init is
  // deferred until it's needed — see ensureFaceDetectorReady below.
  useEffect(() => {
    setFaceDetectorProgressCallback((phase) => {
      setModelLoadingState({ isLoading: true, phase });
    });

    return () => {
      disposeFaceDetector();
    };
  }, []);

  // Starts the Worker + MediaPipe detector if it isn't already ready,
  // showing the blocking LoadingOverlay (isLoading: true) while it does.
  // Used for the very first load triggered by an image upload; subsequent
  // calls resolve immediately since initFaceDetector() reuses one promise.
  const ensureFaceDetectorReady = useCallback(async () => {
    try {
      await initFaceDetector();
      setModelLoadingState({ isLoading: false, phase: null });
    } catch (error) {
      console.error('Model load failed:', error);
      setModelLoadingState({ isLoading: false, phase: null });
      setError(t.error.modelLoadFailed);
      throw error;
    }
  }, [t]);

  // Debounce history pushes for the global emoji-size slider: many onChange
  // events fire per drag, but undo should treat the whole drag as one step.
  const emojiSizeHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleEmojiSizeChange = useCallback(
    (size: number) => {
      if (emojiSizeHistoryTimerRef.current === null) {
        pushHistory();
      } else {
        clearTimeout(emojiSizeHistoryTimerRef.current);
      }
      emojiSizeHistoryTimerRef.current = setTimeout(() => {
        emojiSizeHistoryTimerRef.current = null;
      }, EMOJI_SIZE_HISTORY_DEBOUNCE_MS);

      setEmojiSize(size);
    },
    [pushHistory]
  );

  useEffect(() => {
    return () => {
      if (emojiSizeHistoryTimerRef.current !== null) {
        clearTimeout(emojiSizeHistoryTimerRef.current);
      }
    };
  }, []);

  // Shared detection tail: run detection and surface the result (used by
  // both the initial upload flow and re-detection). Detection runs at 0.5
  // confidence; if that finds zero faces, it retries once at 0.3 before
  // surfacing the "no faces" error, so low-confidence/small faces still
  // stand a chance without the user having to fiddle with a settings panel.
  const detectAndSetFaces = useCallback(
    async (input: HTMLImageElement | HTMLCanvasElement, scale: number) => {
      // Small delay so the processing overlay can paint first
      await new Promise((resolve) => setTimeout(resolve, 50));

      let detectionResult = await runFaceDetection({
        input,
        settings: { minConfidence: DEFAULT_MIN_CONFIDENCE },
        scale,
      });

      if (detectionResult.isEmpty) {
        detectionResult = await runFaceDetection({
          input,
          settings: { minConfidence: FALLBACK_MIN_CONFIDENCE },
          scale,
        });
      }

      if (detectionResult.isEmpty) {
        setError(t.error.noFacesFound);
        return;
      }

      // Performance warning for too many faces
      if (detectionResult.faceCount > 50) {
        showToast(t.toasts.manyFaces(detectionResult.faceCount));
      }
      setFaces(detectionResult.faces);
    },
    [showToast, t]
  );

  // Handle image upload
  const handleImageLoad = useCallback(
    async (img: HTMLImageElement, fileSize?: number) => {
      setImage(img);
      setFaces([]);
      setReplacements([]);
      setActiveReplacementId(null);
      setError(null);
      setIsProcessing(true);
      setHasShownFaces(false);
      lastFaceCountRef.current = 0;
      // History from the previous image no longer applies
      clearHistory();

      try {
        // Start the detector Worker if this is the first time it's needed
        // (deferred from mount so the app doesn't block on a WASM/model
        // download before the user has even uploaded anything).
        try {
          await ensureFaceDetectorReady();
        } catch {
          // ensureFaceDetectorReady already set the error message; stop here.
          return;
        }

        // Determine processing message based on file size
        const sizeCategory = fileSize ? getImageSizeCategory(fileSize) : 'small';
        if (sizeCategory === 'large') {
          setProcessingMessage(t.processing.shrinking);
        } else if (sizeCategory === 'medium') {
          setProcessingMessage(t.processing.analyzing);
        } else {
          setProcessingMessage(t.processing.detecting);
        }

        // Optimize image for detection if needed
        let imageToDetect: HTMLImageElement | HTMLCanvasElement = img;
        let scale = 1;

        if (img.naturalWidth > 1920) {
          setProcessingMessage(t.processing.shrinking);

          // Add small delay to let UI update
          await new Promise(resolve => setTimeout(resolve, 100));

          const optimized = await optimizeImageForDetection(img, 1920);
          setOptimizedImage(optimized);
          imageToDetect = optimized.optimizedCanvas;
          scale = optimized.scale;
        } else {
          setOptimizedImage(null);
        }

        setProcessingMessage(t.processing.detecting);
        await detectAndSetFaces(imageToDetect, scale);
      } catch (error) {
        console.error('Face detection failed:', error);
        setError(t.error.detectionFailed);
      } finally {
        setIsProcessing(false);
        setProcessingMessage('');
      }
    },
    [detectAndSetFaces, clearHistory, ensureFaceDetectorReady, t]
  );

  // Whole-window drag & drop: dropping a new image anywhere replaces the
  // current one via the same handleImageLoad path (reset + redetect).
  const handleWindowDroppedFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        showToast(t.toasts.unsupportedFileType);
        return;
      }

      const maxSize = 20 * 1024 * 1024;
      if (file.size > maxSize) {
        showToast(t.toasts.fileTooLarge);
        return;
      }

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        handleImageLoad(img, file.size);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        showToast(t.toasts.imageLoadFailed);
      };
      img.src = url;
    },
    [showToast, handleImageLoad, t]
  );

  const { isDraggingOver: isWindowDragging } = useWindowFileDrop(
    !isProcessing,
    handleWindowDroppedFile
  );

  // Model load (first-ever use, can take seconds) and face detection
  // (usually well under a second) share one overlay so a cold load's
  // "loading model" phase crossfades straight into "detecting faces"
  // instead of one modal unmounting and another mounting. Fast operations
  // (e.g. redetect on an already-optimized image) can finish in well under
  // 150ms — showing the overlay for that long reads as a flash/glitch, so
  // it's gated behind a show-delay and a minimum-visible-duration once it
  // does appear.
  const overlayActive = modelLoadingState.isLoading || (isProcessing && !!processingMessage);
  const showLoadingOverlay = useDelayedVisibility(overlayActive, 150, 500);
  const loadingOverlayContent = modelLoadingState.isLoading
    ? {
        icon: '🧠',
        title: t.modelLoading.title,
        hint: modelLoadingState.phase
          ? (modelLoadingState.phase === 'wasm' ? t.modelLoading.phaseWasm : t.modelLoading.phaseModel)
          : t.modelLoading.subtitle,
        tip: t.modelLoading.tip,
      }
    : {
        icon: '🔍',
        title: processingMessage,
        hint: processingMessage === t.processing.shrinking ? t.processing.hintShrinking : t.processing.hintDefault,
      };

  // Repositions the active face's emoji while it's being dragged on the canvas
  const handleRepositionActiveEmoji = useCallback(
    (patch: Partial<EmojiReplacement>) => {
      setReplacements((prev) =>
        prev.map((replacement) =>
          replacement.faceId === activeReplacementId ? { ...replacement, ...patch } : replacement
        )
      );
    },
    [activeReplacementId]
  );

  // Handle emoji selection
  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      setSelectedEmoji(emoji);
    },
    []
  );

  // Handle face click to apply emoji
  const handleFaceClick = useCallback(
    async (faceId: string) => {
      if (!selectedEmoji) {
        // Guide the user to pick an emoji first instead of failing silently
        showToast(t.toasts.pickEmojiFirst);
        return;
      }

      const face = faces.find((f) => f.id === faceId);
      if (!face) return;

      // Clicking a face makes it the "active" one, so its emoji can be
      // dragged into position on the canvas right away.
      setActiveReplacementId(faceId);

      // Re-clicking a face that already has this exact emoji is a no-op —
      // skip it so it doesn't waste an undo step or a CDN preload.
      const existingReplacement = replacements.find((r) => r.faceId === faceId);
      if (existingReplacement?.emoji === selectedEmoji) return;

      // Snapshot before the async preload, not after — an undo should return
      // to the state right before this click, regardless of preload timing.
      pushHistory();

      try {
        // Preload emoji with fallback to native rendering
        const result = await preloadEmojiWithFallback(selectedEmoji);

        // Add or update replacement
        setReplacements((prev) => {
          const existing = prev.find((r) => r.faceId === faceId);
          if (existing) {
            // Update existing replacement
            return prev.map((r) =>
              r.faceId === faceId
                ? {
                    ...r,
                    emoji: selectedEmoji,
                    emojiUrl: result.url,
                  }
                : r
            );
          } else {
            // Add new replacement
            return [
              ...prev,
              {
                faceId,
                emoji: selectedEmoji,
                emojiUrl: result.url,
              },
            ];
          }
        });
      } catch {
        // Fallback will handle it gracefully
      }
    },
    [selectedEmoji, faces, replacements, showToast, pushHistory, t]
  );

  // Apply to all faces: preload the emoji once, then build all replacements
  // in a single state update (the previous per-face loop preloaded the same
  // emoji N times sequentially)
  const handleApplyToAll = useCallback(async () => {
    if (!selectedEmoji) return;

    pushHistory();

    const result = await preloadEmojiWithFallback(selectedEmoji);

    setReplacements((prev) => {
      const previousByFaceId = new Map(prev.map((r) => [r.faceId, r]));

      return faces.map((face) => {
        const existing = previousByFaceId.get(face.id);
        if (existing) {
          return { ...existing, emoji: selectedEmoji, emojiUrl: result.url };
        }
        return {
          faceId: face.id,
          emoji: selectedEmoji,
          emojiUrl: result.url,
        };
      });
    });
  }, [selectedEmoji, faces, pushHistory]);

  // Reset all replacements (undoable via toast, or Ctrl/Cmd+Z)
  const handleReset = useCallback(() => {
    if (replacements.length === 0) return;

    pushHistory();
    setReplacements([]);
    setActiveReplacementId(null);
    showToast(t.toasts.resetCleared, { label: t.common.undo, handler: handleUndo });
  }, [replacements, pushHistory, showToast, handleUndo, t]);

  // Re-detect faces with new settings (clears replacements, undoable via toast)
  const handleRedetect = useCallback(async () => {
    if (!image) return;

    const hadReplacements = replacements.length > 0;
    if (hadReplacements) {
      pushHistory();
    }

    setFaces([]);
    setReplacements([]);
    setActiveReplacementId(null);
    setError(null);
    setIsProcessing(true);
    setProcessingMessage(t.processing.redetecting);

    try {
      // Use optimized image if available
      const imageToDetect = optimizedImage?.optimizedCanvas || image;
      const scale = optimizedImage?.scale || 1;

      await detectAndSetFaces(imageToDetect, scale);
    } catch (error) {
      console.error('Redetection failed:', error);
      setError(t.error.detectionFailed);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');

      if (hadReplacements) {
        showToast(t.toasts.redetectCleared, {
          label: t.common.undo,
          handler: handleUndo,
        });
      }
    }
  }, [image, optimizedImage, replacements, pushHistory, detectAndSetFaces, showToast, handleUndo, t]);


  // Export image
  const handleExport = useCallback(() => {
    if (!image) return;

    // Create canvas at original resolution
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw original image
    ctx.drawImage(image, 0, 0);

    // Draw all emojis with the same routine the preview uses.
    // Images come from the shared cache (already loaded during preview);
    // a failed CDN load falls back to the native emoji glyph instead of
    // silently dropping the emoji from the export.
    const faceById = new Map(faces.map((face) => [face.id, face]));

    const loadPromises = replacements.map(async (replacement) => {
      const face = faceById.get(replacement.faceId);
      if (!face) return;

      let emojiImage: HTMLImageElement | null = null;
      if (replacement.emojiUrl) {
        try {
          emojiImage = await loadEmojiImage(replacement.emojiUrl);
        } catch {
          emojiImage = null;
        }
      }

      const offset = { x: replacement.offsetX ?? 0, y: replacement.offsetY ?? 0 };
      drawEmojiReplacement(ctx, face.box, offset, replacement, emojiSize, emojiImage);
    });

    // Export after all emojis are drawn
    Promise.all(loadPromises).then(() => {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Generate timestamp in YYYY-MM-DD_HH-MM-SS format
        const now = new Date();
        const timestamp = now.getFullYear() +
          '-' + String(now.getMonth() + 1).padStart(2, '0') +
          '-' + String(now.getDate()).padStart(2, '0') +
          '_' + String(now.getHours()).padStart(2, '0') +
          '-' + String(now.getMinutes()).padStart(2, '0') +
          '-' + String(now.getSeconds()).padStart(2, '0');

        a.download = `no-face-${timestamp}.png`;
        a.click();
        URL.revokeObjectURL(url);

        showToast(t.toasts.exportSuccess);
      }, 'image/png');
    });
  }, [image, faces, replacements, emojiSize, showToast, t]);

  // Clear everything and go back to the empty (upload) state
  const handleNewPhoto = useCallback(() => {
    setImage(null);
    setOptimizedImage(null);
    setFaces([]);
    setReplacements([]);
    setSelectedEmoji(null);
    setActiveReplacementId(null);
    setError(null);
    setHasShownFaces(false);
    lastFaceCountRef.current = 0;
    clearHistory();
  }, [clearHistory]);

  // Derived, single-focus layout states
  const isEmpty = !image;
  // Once there's an image, stay in the editing layout shell even while
  // isProcessing (redetect/replace-image keep the canvas mounted, with the
  // global LoadingOverlay layered on top).
  const isEditing = !!image;

  const iconButtonsCompact = (
    <>
      <IconButton onClick={handleUndo} disabled={!canUndo} aria-label={t.actions.undoTitle} title={t.actions.undoTitle}>
        <Undo size={18} />
      </IconButton>
      <IconButton onClick={handleRedo} disabled={!canRedo} aria-label={t.actions.redoTitle} title={t.actions.redoTitle}>
        <Redo size={18} />
      </IconButton>
      <IconButton onClick={handleRedetect} aria-label={t.actions.redetect} title={t.actions.redetect}>
        <Redetect size={18} />
      </IconButton>
      <IconButton
        onClick={handleReset}
        disabled={replacements.length === 0}
        aria-label={t.actions.reset}
        title={t.actions.reset}
      >
        <Clear size={18} />
      </IconButton>
      <IconButton onClick={handleNewPhoto} aria-label={t.actions.newPhoto} title={t.actions.newPhoto}>
        <NewPhoto size={18} />
      </IconButton>
    </>
  );

  const iconButtonsLabeled = (
    <>
      <IconButton
        onClick={handleUndo}
        disabled={!canUndo}
        aria-label={t.actions.undoTitle}
        title={t.actions.undoTitle}
        label={t.actions.undoLabel}
      >
        <Undo size={18} />
      </IconButton>
      <IconButton
        onClick={handleRedo}
        disabled={!canRedo}
        aria-label={t.actions.redoTitle}
        title={t.actions.redoTitle}
        label={t.actions.redoLabel}
      >
        <Redo size={18} />
      </IconButton>
      <IconButton
        onClick={handleRedetect}
        aria-label={t.actions.redetect}
        title={t.actions.redetect}
        label={t.actions.redetectLabel}
      >
        <Redetect size={18} />
      </IconButton>
      <IconButton
        onClick={handleReset}
        disabled={replacements.length === 0}
        aria-label={t.actions.reset}
        title={t.actions.reset}
        label={t.actions.resetLabel}
      >
        <Clear size={18} />
      </IconButton>
      <IconButton
        onClick={handleNewPhoto}
        aria-label={t.actions.newPhoto}
        title={t.actions.newPhoto}
        label={t.actions.newPhotoLabel}
      >
        <NewPhoto size={18} />
      </IconButton>
    </>
  );

  // Redetect briefly sets faces to [] while a new detection is in flight.
  // Gating this block on hasShownFaces (not faces.length directly) and
  // freezing the displayed count during that gap keeps the right column's
  // layout height stable instead of collapsing/reappearing as a jitter.
  useEffect(() => {
    if (faces.length > 0) {
      lastFaceCountRef.current = faces.length;
    }
  }, [faces]);
  const displayedFaceCount = faces.length > 0 ? faces.length : lastFaceCountRef.current;

  const progressText = hasShownFaces && (
    <div className="text-center space-y-1">
      <span className="text-lg font-black text-gray-900 dark:text-gray-100 block">
        {t.status.facesDetected(displayedFaceCount)}
      </span>
      {replacements.length > 0 && (
        <span
          className={`text-sm font-bold block ${
            replacements.length === faces.length
              ? 'text-green-600 dark:text-green-400'
              : 'text-blue-600 dark:text-blue-400'
          }`}
        >
          {replacements.length === faces.length ? t.status.allReplacedLabel : t.status.replacedLabel}{' '}
          <span className="text-gray-500 dark:text-gray-500 text-xs">
            {t.status.progressCount(replacements.length, faces.length)}
          </span>
        </span>
      )}
    </div>
  );

  // Mobile (<768) compact single-line counterpart to progressText above —
  // same hasShownFaces/displayedFaceCount/replacements data, just laid out on
  // one line instead of the stacked block used for the wider layouts.
  const compactProgressText = hasShownFaces && (
    <div className="md:hidden text-center text-xs font-bold text-gray-700 dark:text-gray-300">
      {t.status.facesDetected(displayedFaceCount)}
      {replacements.length > 0 && (
        <span
          className={`ml-1 ${
            replacements.length === faces.length
              ? 'text-green-600 dark:text-green-400'
              : 'text-blue-600 dark:text-blue-400'
          }`}
        >
          · {replacements.length === faces.length ? t.status.allReplacedLabel : t.status.replacedLabel}{' '}
          <span className="text-gray-500 dark:text-gray-500">
            {t.status.progressCount(replacements.length, faces.length)}
          </span>
        </span>
      )}
    </div>
  );

  const renderPrimaryButtons = (layout: 'row' | 'stack') => (
    <div className={layout === 'row' ? 'flex gap-2' : 'flex flex-col gap-2'}>
      <m.button
        onClick={handleApplyToAll}
        whileHover={selectedEmoji ? { scale: 1.03 } : {}}
        whileTap={selectedEmoji ? { scale: 0.96 } : {}}
        disabled={!selectedEmoji}
        className={`${layout === 'row' ? 'flex-1 whitespace-nowrap' : ''} justify-center px-4 py-2.5 text-sm btn-duo ${
          selectedEmoji ? 'btn-secondary' : 'btn-disabled'
        }`}
        title={!selectedEmoji ? t.actions.applyAllTitleDisabled : ''}
      >
        <ApplyAll size={16} />
        {t.actions.applyAll}
        {replacements.length > 0 && <span className="sr-only"> {t.status.srReplacedCount(replacements.length)}</span>}
      </m.button>
      <m.button
        onClick={handleExport}
        whileHover={replacements.length > 0 ? { scale: 1.03 } : {}}
        whileTap={replacements.length > 0 ? { scale: 0.96 } : {}}
        disabled={replacements.length === 0}
        className={`${
          layout === 'row' ? 'flex-1 whitespace-nowrap px-4 py-2.5 text-sm' : 'w-full px-4 py-3 text-base'
        } justify-center btn-duo ${replacements.length > 0 ? 'btn-primary' : 'btn-disabled'}`}
        title={replacements.length === 0 ? t.actions.downloadTitleDisabled : ''}
      >
        <Download size={16} />
        {t.actions.download}
      </m.button>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex flex-col">
      {/* Whole-window drag overlay */}
      <AnimatePresence>
        {isWindowDragging && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-blue-500/20 backdrop-blur-sm pointer-events-none"
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl px-8 py-6 border-4 border-dashed border-blue-400 text-center">
              <div className="text-5xl mb-2">🖼️</div>
              <p className="text-xl font-black text-gray-800 dark:text-gray-100">{t.windowDrag.dropHint}</p>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay — model load + face detection, see overlayActive above */}
      <AnimatePresence>
        {showLoadingOverlay && <LoadingOverlay {...loadingOverlayContent} />}
      </AnimatePresence>

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
        actionLabel={toastAction?.label}
        onAction={toastAction?.handler}
      />

      <AppHeader />

      <main className="flex-1 flex flex-col w-full">
        {/* Empty state — centered upload card */}
        {isEmpty && (
          <div className="flex-1 flex items-center justify-center px-4 py-6 md:py-10">
            <div className="max-w-xl w-full">
              <ImageUploader onImageLoad={handleImageLoad} onError={showToast} disabled={isProcessing} />
            </div>
          </div>
        )}

        {/* Editing state — canvas is the main visual. Stays mounted during
            redetect/replace-image processing too (overlay rendered above). */}
        {isEditing && (
          <div className="flex-1 w-full lg:max-w-6xl mx-auto px-4 py-4 md:max-w-2xl lg:grid lg:grid-cols-[minmax(0,1fr)_clamp(320px,28vw,380px)] lg:gap-6">
            {/* Canvas column */}
            <div className={`flex flex-col gap-4 ${MOBILE_TOOLBAR_SAFE_AREA} md:pb-4`}>
              {compactProgressText}
              {error ? (
                <m.div
                  role="alert"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 text-center border-4 border-orange-400 dark:border-orange-500"
                >
                  <div className="text-4xl mb-2">⚠️</div>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">{t.error.title}</p>
                  <p className="text-gray-600 dark:text-gray-300">{error}</p>
                </m.div>
              ) : (
                <m.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={canvasEntranceSpring}
                >
                  <FaceCanvas
                    image={image}
                    faces={faces}
                    replacements={replacements}
                    emojiScale={emojiSize}
                    onFaceSelect={handleFaceClick}
                    activeReplacementId={activeReplacementId}
                    onRepositionActiveEmoji={handleRepositionActiveEmoji}
                    onBeginDragReposition={pushHistory}
                  />
                </m.div>
              )}

              {/* Medium breakpoint (768–1023): toolbar flows below the canvas as a card.
                  Gated on hasShownFaces (not faces.length directly) so a redetect's
                  brief faces=[] gap doesn't unmount/remount this and replay its
                  entrance animation — it only truly mounts/unmounts at session
                  boundaries (new photo / new image upload). */}
              {hasShownFaces && (
                <m.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={desktopColumnSpring}
                  className="hidden md:flex lg:hidden flex-col gap-3 glass-card p-4"
                >
                  {progressText}
                  <EmojiToolbar
                    onEmojiSelect={handleEmojiSelect}
                    selectedEmoji={selectedEmoji}
                    emojiSize={emojiSize}
                    onEmojiSizeChange={handleEmojiSizeChange}
                  />
                  {renderPrimaryButtons('row')}
                  <div className="flex flex-wrap gap-2 justify-center pt-2 border-t border-gray-200/60 dark:border-slate-700/60">
                    {iconButtonsCompact}
                  </div>
                </m.div>
              )}
            </div>

            {/* Desktop/iPad landscape (>=1024): sticky right column — see
                hasShownFaces note above the medium-breakpoint card. */}
            {hasShownFaces && (
              <m.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={desktopColumnSpring}
                className="hidden lg:flex lg:flex-col lg:sticky lg:top-20 lg:self-start gap-4"
              >
                {progressText}
                <EmojiToolbar
                  onEmojiSelect={handleEmojiSelect}
                  selectedEmoji={selectedEmoji}
                  emojiSize={emojiSize}
                  onEmojiSizeChange={handleEmojiSizeChange}
                />
                {renderPrimaryButtons('stack')}
                <div className="flex flex-wrap gap-2 justify-center pt-2 border-t border-gray-200/60 dark:border-slate-700/60">
                  {iconButtonsLabeled}
                </div>
              </m.div>
            )}
          </div>
        )}
      </main>

      {/* Mobile docked toolbar (<768), editing state only — see hasShownFaces
          note above the medium-breakpoint card. */}
      <AnimatePresence>
        {isEditing && hasShownFaces && (
          <m.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={mobileToolbarSpring}
            className="fixed inset-x-0 bottom-0 z-30 md:hidden bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-t border-gray-200/60 dark:border-slate-700/60 rounded-t-3xl px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] space-y-2"
          >
            <EmojiToolbar
              onEmojiSelect={handleEmojiSelect}
              selectedEmoji={selectedEmoji}
              emojiSize={emojiSize}
              onEmojiSizeChange={handleEmojiSizeChange}
            />
            {renderPrimaryButtons('row')}
            <div className="flex flex-wrap gap-2 justify-center pt-1">{iconButtonsCompact}</div>
          </m.div>
        )}
      </AnimatePresence>

      {/* On mobile editing state, the fixed docked toolbar overlays the
          bottom of the viewport, so reserve the same safe-area padding here
          as the canvas column — otherwise the footer scrolls to the bottom
          only to sit right behind the toolbar. */}
      <div className={isEditing && hasShownFaces ? `${MOBILE_TOOLBAR_SAFE_AREA} md:pb-0` : ''}>
        <AppFooter />
      </div>
    </div>
    </MotionConfig>
  );
}
