'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { m, AnimatePresence, MotionConfig, useDragControls } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import NextImage from 'next/image';
import ImageUploader from '@/components/ImageUploader';
import FaceCanvas from '@/components/FaceCanvas';
import EmojiSelector from '@/components/EmojiSelector';
import SettingsPanel from '@/components/SettingsPanel';
import ModelLoadingModal from '@/components/ModelLoadingModal';
import ProcessingOverlay from '@/components/ProcessingOverlay';
import Toast from '@/components/Toast';
import EmojiInspector from '@/components/EmojiInspector';
import { 
  DetectedFace, 
  EmojiReplacement, 
  DetectionSettings, 
  EmojiSettings,
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
import { useInspectorActions } from '@/hooks/useInspectorActions';
import { useHistoryStack } from '@/hooks/useHistoryStack';
import { useI18n } from '@/lib/i18n';

interface HistorySnapshot {
  faces: DetectedFace[];
  replacements: EmojiReplacement[];
}

const MAX_HISTORY = 50;

export default function Home() {
  const { t, lang, setLang } = useI18n();

  // State management
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [optimizedImage, setOptimizedImage] = useState<OptimizedImage | null>(null);
  const [faces, setFaces] = useState<DetectedFace[]>([]);
  const [replacements, setReplacements] = useState<EmojiReplacement[]>([]);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeReplacementId, setActiveReplacementId] = useState<string | null>(null);

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

  // Settings (now mutable)
  const [detectionSettings, setDetectionSettings] = useState<DetectionSettings>({
    minConfidence: 0.5,
  });

  const [emojiSettings, setEmojiSettings] = useState<EmojiSettings>({
    scale: 1.2,
    opacity: 1.0,
    flipX: false,
    flipY: false,
  });

  const activeReplacement = useMemo(
    () => replacements.find((replacement) => replacement.faceId === activeReplacementId) || null,
    [replacements, activeReplacementId]
  );

  const activeFaceIndex = useMemo(
    () => faces.findIndex((face) => face.id === activeReplacementId),
    [faces, activeReplacementId]
  );

  const isInspectorOpen = Boolean(activeReplacement);

  // Measure the inspector panel's actual rendered height (it varies with
  // content/viewport) instead of a hardcoded padding guess, so small screens
  // don't have their bottom faces hidden behind the panel.
  const inspectorPanelRef = useRef<HTMLDivElement>(null);
  const [inspectorPanelHeight, setInspectorPanelHeight] = useState(0);

  useEffect(() => {
    const node = inspectorPanelRef.current;
    if (!isInspectorOpen || !node || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setInspectorPanelHeight(entry.contentRect.height);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [isInspectorOpen]);

  // Fallback to a generous estimate before the first measurement lands.
  const inspectorPadding = isInspectorOpen
    ? `calc(${inspectorPanelHeight > 0 ? `${inspectorPanelHeight}px` : '18rem'} + env(safe-area-inset-bottom) + 1.5rem)`
    : undefined;

  const applyReplacementPatch = useCallback(
    (
      faceId: string,
      patch: Partial<EmojiReplacement>,
      options: { customState?: boolean } = {}
    ) => {
      setReplacements((prev) =>
        prev.map((replacement) => {
          if (replacement.faceId !== faceId) return replacement;

          const next: EmojiReplacement = {
            ...replacement,
            ...patch,
          };

          if (options.customState !== undefined) {
            next.isCustom = options.customState;
          } else if (Object.keys(patch).length > 0) {
            next.isCustom = true;
          }

          return next;
        })
      );
    },
    []
  );

  const {
    handleUpdate: handleInspectorUpdate,
    handleResetToDefault: handleInspectorReset,
    handleAdoptAsDefault: handleInspectorAdopt,
    handleApplyToAll: handleInspectorApplyToAll,
    handleClose: handleInspectorClose,
  } = useInspectorActions({
    activeReplacement,
    emojiSettings,
    applyReplacementPatch,
    setEmojiSettings,
    setReplacements,
    showToast,
    setActiveReplacementId,
    pushHistory,
  });

  const inspectorDragControls = useDragControls();

  const handleInspectorDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.y > 120 || info.velocity.y > 600) {
        handleInspectorClose();
      }
    },
    [handleInspectorClose]
  );

  const handleInspectorHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      inspectorDragControls.start(event.nativeEvent);
    },
    [inspectorDragControls]
  );

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
  // showing the blocking ModelLoadingModal (isLoading: true) while it does.
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

  // Auto-apply emoji settings when they change
  // Only update styles (scale, opacity, flip). Never touch emojiUrl here:
  // an empty URL means the replacement fell back to native rendering and
  // must stay that way.
  useEffect(() => {
    if (replacements.length === 0) return;
    if (!replacements.some((r) => !r.isCustom)) return;

    setReplacements((prev) =>
      prev.map((replacement) => {
        if (replacement.isCustom) {
          return replacement;
        }

        return {
          ...replacement,
          scale: emojiSettings.scale,
          opacity: emojiSettings.opacity,
          flipX: emojiSettings.flipX,
          flipY: emojiSettings.flipY,
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emojiSettings]);

  // Shared detection tail: run detection and surface the result
  // (used by both the initial upload flow and re-detection)
  const detectAndSetFaces = useCallback(
    async (input: HTMLImageElement | HTMLCanvasElement, scale: number) => {
      // Small delay so the processing overlay can paint first
      await new Promise((resolve) => setTimeout(resolve, 50));

      const detectionResult = await runFaceDetection({
        input,
        settings: detectionSettings,
        scale,
      });

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
    [detectionSettings, showToast, t]
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
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const windowDragDepthRef = useRef(0);

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

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      windowDragDepthRef.current += 1;
      setIsWindowDragging(true);
    };

    const handleDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
    };

    const handleDragLeave = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      windowDragDepthRef.current = Math.max(0, windowDragDepthRef.current - 1);
      if (windowDragDepthRef.current === 0) {
        setIsWindowDragging(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      windowDragDepthRef.current = 0;
      setIsWindowDragging(false);

      if (isProcessing) return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleWindowDroppedFile(files[0]);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [isProcessing, handleWindowDroppedFile]);

  // Handle emoji selection
  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      setSelectedEmoji(emoji);
      setIsEmojiPickerOpen(false);
    },
    []
  );

  // Handle face click to apply emoji
  const handleFaceClick = useCallback(
    async (faceId: string) => {
      if (!selectedEmoji) {
        // Guide the user to pick an emoji first instead of failing silently
        showToast(t.toasts.pickEmojiFirst);
        setIsEmojiPickerOpen(true);
        return;
      }

      const face = faces.find((f) => f.id === faceId);
      if (!face) return;

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
                scale: emojiSettings.scale,
                opacity: emojiSettings.opacity,
                flipX: emojiSettings.flipX,
                flipY: emojiSettings.flipY,
                isCustom: false,
              },
            ];
          }
        });
      } catch {
        // Fallback will handle it gracefully
      }
    },
    [selectedEmoji, faces, replacements, emojiSettings, showToast, pushHistory, t]
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
          scale: emojiSettings.scale,
          opacity: emojiSettings.opacity,
          flipX: emojiSettings.flipX,
          flipY: emojiSettings.flipY,
          isCustom: false,
        };
      });
    });
  }, [selectedEmoji, faces, emojiSettings, pushHistory]);

  // Reset all replacements (undoable via toast, or Ctrl/Cmd+Z)
  const handleReset = useCallback(() => {
    if (replacements.length === 0) return;

    pushHistory();
    setReplacements([]);
    setActiveReplacementId(null);
    showToast(t.toasts.resetCleared, { label: t.common.undo, handler: handleUndo });
  }, [replacements, pushHistory, showToast, handleUndo, t]);

  const handleInspectFace = useCallback((faceId: string) => {
    const target = replacements.find((replacement) => replacement.faceId === faceId);
    if (!target) {
      showToast(t.toasts.replaceFirstToInspect);
      return;
    }

    setActiveReplacementId(faceId);
    setIsEmojiPickerOpen(false);

    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        const badge = document.querySelector<HTMLButtonElement>(`[data-face-badge="${faceId}"]`);
        badge?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [replacements, showToast, t]);

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
      drawEmojiReplacement(ctx, face.box, offset, replacement, emojiImage);
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
  }, [image, faces, replacements, showToast, t]);

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-6 px-4 flex flex-col">
      {/* Model Loading Modal */}
      <ModelLoadingModal state={modelLoadingState} />

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

      {/* Processing Overlay */}
      <AnimatePresence>
        {isProcessing && processingMessage && (
          <ProcessingOverlay
            message={processingMessage}
            hint={
              processingMessage === t.processing.shrinking
                ? t.processing.hintShrinking
                : t.processing.hintDefault
            }
          />
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
        actionLabel={toastAction?.label}
        onAction={toastAction?.handler}
      />

      <div
        className="max-w-3xl mx-auto flex-1 w-full"
        style={{
          paddingBottom: inspectorPadding,
          transition: 'padding-bottom 0.3s ease',
        }}
      >
        {/* Header - Duolingo Style with Privacy Badge */}
        <m.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative text-center mb-6 flex flex-col items-center justify-center"
        >
          {/* Language toggle */}
          <button
            type="button"
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            className="absolute right-0 top-0 text-xs font-bold px-2.5 py-1 rounded-full bg-white/80 dark:bg-slate-800/80 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 shadow-sm hover:bg-white dark:hover:bg-slate-800 transition-colors"
            aria-label={t.languageToggle.aria}
          >
            {t.languageToggle.switchToLabel}
          </button>

          {/* Logo */}
          <m.div
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ duration: 0.5, delay: 0.2 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="inline-block mb-2"
          >
            <div className="relative bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border-b-4 border-gray-200 dark:border-slate-700">
              <NextImage
                src="/kaonashi.jpg"
                alt="カオナシ"
                width={80}
                height={80}
                className="w-16 h-16 md:w-20 md:h-20 object-contain rounded-xl"
              />
            </div>
          </m.div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-black text-gray-800 dark:text-gray-100 drop-shadow-lg tracking-tight shimmer-text bg-clip-text">
            {t.header.title}
          </h1>

          {/* Subtitle with privacy promise */}
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-2 flex flex-wrap items-center justify-center gap-2 px-4"
          >
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full shadow-sm text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {t.header.privacyBadge}
            </span>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {t.header.tagline}
            </p>
          </m.div>
        </m.div>

        {/* Main content */}
        <div className="space-y-4">
          {/* Settings Panel - before upload, and again once faces are detected */}
          {(!image || faces.length > 0) && !isProcessing && (
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <SettingsPanel
                detectionSettings={detectionSettings}
                onEmojiChange={setEmojiSettings}
                onDetectionChange={setDetectionSettings}
                isOpen={isSettingsPanelOpen}
                onToggle={() => setIsSettingsPanelOpen(!isSettingsPanelOpen)}
              />
            </m.div>
          )}

          {/* Image uploader */}
          {!image && (
            <ImageUploader
              onImageLoad={handleImageLoad}
              onError={showToast}
              disabled={isProcessing}
            />
          )}

          {/* Canvas preview */}
          {image && !isProcessing && (
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <FaceCanvas
                image={image}
                faces={faces}
                replacements={replacements}
                onFaceClick={handleFaceClick}
                onInspectFace={handleInspectFace}
                activeReplacementId={activeReplacementId}
                onRepositionActiveEmoji={handleInspectorUpdate}
                onBeginDragReposition={pushHistory}
              />
            </m.div>
          )}

          {/* Status message - Error */}
          {image && error && (
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
          )}

          {/* Status message - Success with progress and secondary actions */}
          {image && faces.length > 0 && !isProcessing && (
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-sm p-3 text-center border-2 border-gray-300 dark:border-slate-600"
            >
              <div className="space-y-2">
                {/* Detection result */}
                <span className="text-2xl font-black text-gray-900 dark:text-gray-100 block">
                  {t.status.facesDetected(faces.length)}
                </span>

                {/* Replacement progress */}
                {replacements.length > 0 && (
                  <m.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-sm font-bold"
                  >
                    {replacements.length === faces.length ? (
                      <span className="text-green-600 dark:text-green-400">
                        {t.status.allReplacedLabel} <span className="text-gray-500 dark:text-gray-500 text-xs">{t.status.progressCount(replacements.length, faces.length)}</span>
                      </span>
                    ) : (
                      <span className="text-blue-600 dark:text-blue-400">
                        {t.status.replacedLabel} <span className="text-gray-500 dark:text-gray-500 text-xs">{t.status.progressCount(replacements.length, faces.length)}</span>
                      </span>
                    )}
                  </m.div>
                )}
              </div>

              {/* Secondary action buttons */}
              <div className="flex flex-wrap gap-2 justify-center mt-3">
                <m.button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  whileHover={canUndo ? { scale: 1.02 } : {}}
                  whileTap={canUndo ? { scale: 0.98 } : {}}
                  className={`text-sm px-3 py-1.5 btn-duo ${canUndo ? 'btn-ghost' : 'btn-disabled'}`}
                  title={t.actions.undoTitle}
                >
                  {t.actions.undo}
                </m.button>
                <m.button
                  onClick={handleRedo}
                  disabled={!canRedo}
                  whileHover={canRedo ? { scale: 1.02 } : {}}
                  whileTap={canRedo ? { scale: 0.98 } : {}}
                  className={`text-sm px-3 py-1.5 btn-duo ${canRedo ? 'btn-ghost' : 'btn-disabled'}`}
                  title={t.actions.redoTitle}
                >
                  {t.actions.redo}
                </m.button>
                <m.button
                  onClick={handleRedetect}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="text-sm px-3 py-1.5 btn-duo btn-secondary"
                >
                  {t.actions.redetect}
                </m.button>
                <m.button
                  onClick={() => {
                    setImage(null);
                    setOptimizedImage(null);
                    setFaces([]);
                    setReplacements([]);
                    setSelectedEmoji(null);
                    setActiveReplacementId(null);
                    setIsEmojiPickerOpen(false);
                    setError(null);
                    clearHistory();
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="text-sm px-3 py-1.5 btn-duo btn-ghost"
                >
                  {t.actions.newPhoto}
                </m.button>
              </div>
            </m.div>
          )}

          {/* Emoji selector */}
          {image && faces.length > 0 && !isProcessing && (
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <EmojiSelector
                onEmojiSelect={handleEmojiSelect}
                selectedEmoji={selectedEmoji}
                isOpen={isEmojiPickerOpen}
                onToggle={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                replacedCount={replacements.length}
                totalFaces={faces.length}
              />
            </m.div>
          )}

          {/* Action buttons - Duolingo Style */}
          {image && faces.length > 0 && !isProcessing && (
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-2 md:gap-3 justify-center"
            >
              <m.button
                onClick={handleApplyToAll}
                whileHover={selectedEmoji ? { scale: 1.05 } : {}}
                whileTap={selectedEmoji ? { scale: 0.95 } : {}}
                disabled={!selectedEmoji}
                className={`px-4 py-2 md:px-6 md:py-3 text-sm md:text-base btn-duo ${
                  selectedEmoji ? 'btn-secondary' : 'btn-disabled'
                }`}
                title={!selectedEmoji ? t.actions.applyAllTitleDisabled : ''}
              >
                <span className="text-lg md:text-xl">⚡</span>
                {t.actions.applyAll}
                {replacements.length > 0 && <span className="sr-only"> {t.status.srReplacedCount(replacements.length)}</span>}
              </m.button>
              <m.button
                onClick={handleReset}
                whileHover={replacements.length > 0 ? { scale: 1.05 } : {}}
                whileTap={replacements.length > 0 ? { scale: 0.95 } : {}}
                disabled={replacements.length === 0}
                className={`px-4 py-2 md:px-6 md:py-3 text-sm md:text-base btn-duo ${
                  replacements.length > 0 ? 'btn-ghost' : 'btn-disabled'
                }`}
                title={replacements.length === 0 ? t.actions.resetTitleDisabled : ''}
              >
                <span className="text-lg md:text-xl">♻️</span>
                {t.actions.reset}
              </m.button>
              <m.button
                onClick={handleExport}
                whileHover={replacements.length > 0 ? { scale: 1.05 } : {}}
                whileTap={replacements.length > 0 ? { scale: 0.95 } : {}}
                disabled={replacements.length === 0}
                className={`px-4 py-2 md:px-6 md:py-3 text-sm md:text-base btn-duo ${
                  replacements.length > 0 ? 'btn-primary' : 'btn-disabled'
                }`}
                title={replacements.length === 0 ? t.actions.downloadTitleDisabled : ''}
              >
                <span className="text-lg md:text-xl">📥</span>
                {t.actions.download}
              </m.button>
            </m.div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {activeReplacement && !isProcessing && (
          <m.div
            key={activeReplacement.faceId}
            ref={inspectorPanelRef}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 280,
              damping: 30,
            }}
            className="pointer-events-none fixed inset-x-0 bottom-0 z-40"
          >
            <m.div
              className="pointer-events-auto mx-auto w-full max-w-3xl px-4 pb-5"
              drag="y"
              dragControls={inspectorDragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 320 }}
              dragElastic={{ top: 0.15, bottom: 0.4 }}
              dragMomentum={false}
              dragSnapToOrigin
              onDragEnd={handleInspectorDragEnd}
              style={{ touchAction: 'none' }}
            >
              <m.button
                type="button"
                layout
                onPointerDown={handleInspectorHandlePointerDown}
                whileTap={{ scaleX: 1.05 }}
                className="mb-2 mx-auto block h-1.5 w-12 rounded-full bg-white/70 dark:bg-slate-500 cursor-grab active:cursor-grabbing"
                aria-label={t.inspector.dragHandleAria}
              />
              <div className="overflow-hidden rounded-[26px] border border-white/40 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl shadow-[0_20px_45px_-20px_rgba(15,23,42,0.45)]">
                <EmojiInspector
                  replacement={activeReplacement}
                  defaultSettings={emojiSettings}
                  label={activeFaceIndex >= 0 ? t.inspector.faceLabel(activeFaceIndex + 1) : t.inspector.faceFallback}
                  onUpdate={handleInspectorUpdate}
                  onBeginEdit={pushHistory}
                  onResetToDefault={handleInspectorReset}
                  onAdoptAsDefault={handleInspectorAdopt}
                  onApplyToAll={handleInspectorApplyToAll}
                  onClose={handleInspectorClose}
                  className="bg-transparent border-none shadow-none p-5 md:p-6 space-y-5"
                />
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Footer - Duolingo Style */}
      <m.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 mb-6 text-center space-y-2 w-full max-w-3xl mx-auto"
      >
        {/* Credits and Copyright */}
        <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">
          Made with ❤️ by{' '}
          <a
            href="https://github.com/BazingaOrg"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold transition-colors hover:underline"
          >
            @Bazinga
          </a>
        </p>
        <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">
          <a
            href="https://github.com/BazingaOrg/no-face"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold transition-colors hover:underline"
          >
            View Source
          </a>
          <span> · </span>
          <span className="font-black">カオナシ</span>
        </p>
        <p className="text-gray-500 dark:text-gray-500 text-xs">
          © {new Date().getFullYear()} All rights reserved.
        </p>
      </m.footer>
    </div>
    </MotionConfig>
  );
}
