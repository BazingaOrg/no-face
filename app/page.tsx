'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { motion, AnimatePresence, MotionConfig, useDragControls } from 'framer-motion';
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
  loadSSDModel,
  loadTinyModel,
  isModelLoaded,
  setModelLoadingProgressCallback
} from '@/lib/faceApi';
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

interface HistorySnapshot {
  faces: DetectedFace[];
  replacements: EmojiReplacement[];
}

const MAX_HISTORY = 50;

export default function Home() {
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
  const [, setHasLandmarks] = useState(false); // Landmarks state for future features
  const [activeReplacementId, setActiveReplacementId] = useState<string | null>(null);
  
  // Model loading state
  const [modelLoadingState, setModelLoadingState] = useState<ModelLoadingState>({
    isLoading: true,
    progress: 0,
    currentModel: '',
    loadedModels: [],
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
    detector: 'ssd_mobilenetv1',
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
  const inspectorPadding = isInspectorOpen ? '18rem' : undefined;

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

  // Load models progressively on mount
  useEffect(() => {
    const initModels = async () => {
      try {
        // Set up progress callback
        setModelLoadingProgressCallback((progress) => {
          setModelLoadingState({
            isLoading: true,
            progress: progress.percentage,
            currentModel: progress.model,
            loadedModels: progress.loaded > 0 ? ['ssdMobilenetv1'] : [],
          });
        });

        // Stage 1: Load default detector (SSD) - blocking with progress UI
        await loadSSDModel();

        // Mark first stage complete
        setModelLoadingState({
          isLoading: false,
          progress: 100,
          currentModel: '',
          loadedModels: ['ssdMobilenetv1'],
        });

        // Stage 2: Load Tiny Face Detector in background (silent, non-blocking)
        // This ensures smooth switching without wait time
        setTimeout(async () => {
          try {
            await loadTinyModel(true); // Silent load
            console.log('✅ Tiny Face Detector 已在后台加载完成');
          } catch (error) {
            console.warn('⚠️ Tiny Face Detector 后台加载失败:', error);
          }
        }, 500); // Small delay to let UI settle

        // Stage 3: Face Landmarks 68 will be loaded on-demand when needed (Phase 2 feature)
      } catch (error) {
        console.error('模型加载失败:', error);
        setModelLoadingState((prev) => ({
          ...prev,
          isLoading: false,
        }));
        setError('模型加载失败，请刷新页面或检查网络后重试');
      }
    };

    initModels();
  }, []);

  // Handle detector change - load model if needed
  useEffect(() => {
    const handleDetectorChange = async () => {
      const detector = detectionSettings.detector;
      
      // Check if model is loaded
      if (detector === 'tiny_face_detector' && !isModelLoaded('tinyFaceDetector')) {
        // Show toast notification
        showToast('⏳ 正在加载极速模式');

        try {
          await loadTinyModel(false); // Load with progress
          showToast('✅ 极速模式就绪');
        } catch (error) {
          console.error('检测器加载失败:', error);
          showToast('❌ 极速模式加载失败，请检查网络后重试');
        }
      }
    };

    handleDetectorChange();
  }, [detectionSettings.detector, showToast]);

  // Auto-apply emoji settings when they change
  // Only update styles (scale, opacity, flip). Never touch emojiUrl here:
  // an empty URL means the replacement fell back to native rendering and
  // must stay that way.
  useEffect(() => {
    if (replacements.length === 0) return;

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

      setHasLandmarks(detectionResult.hasLandmarks);

      if (detectionResult.isEmpty) {
        setError('🙈 没找到人脸，试试降低灵敏度');
        return;
      }

      // Performance warning for too many faces
      if (detectionResult.faceCount > 50) {
        showToast(`🤯 发现 ${detectionResult.faceCount} 张脸，稍等我慢慢处理`);
      }
      setFaces(detectionResult.faces);
    },
    [detectionSettings, showToast]
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
        // Determine processing message based on file size
        const sizeCategory = fileSize ? getImageSizeCategory(fileSize) : 'small';
        if (sizeCategory === 'large') {
          setProcessingMessage('⚙️ 正在瘦身图片');
        } else if (sizeCategory === 'medium') {
          setProcessingMessage('🌀 图片处理中');
        } else {
          setProcessingMessage('🔍 正在找脸');
        }

        // Optimize image for detection if needed
        let imageToDetect: HTMLImageElement | HTMLCanvasElement = img;
        let scale = 1;

        if (img.naturalWidth > 1920) {
          setProcessingMessage('⚙️ 正在瘦身图片');
          
          // Add small delay to let UI update
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const optimized = await optimizeImageForDetection(img, 1920);
          setOptimizedImage(optimized);
          imageToDetect = optimized.optimizedCanvas;
          scale = optimized.scale;
        } else {
          setOptimizedImage(null);
        }

        setProcessingMessage('🔍 正在找脸');
        await detectAndSetFaces(imageToDetect, scale);
      } catch (error) {
        console.error('人脸检测失败:', error);
        setError('😵 检测出错了，点「重新检测」再试一次');
      } finally {
        setIsProcessing(false);
        setProcessingMessage('');
      }
    },
    [detectAndSetFaces, clearHistory]
  );

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
        showToast('👇 先选一个表情，再点人脸');
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
    [selectedEmoji, faces, replacements, emojiSettings, showToast, pushHistory]
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
    showToast('♻️ 已清空全部替换', { label: '撤销', handler: handleUndo });
  }, [replacements, pushHistory, showToast, handleUndo]);

  const handleInspectFace = useCallback((faceId: string) => {
    const target = replacements.find((replacement) => replacement.faceId === faceId);
    if (!target) {
      showToast('😶 先替换表情再微调吧');
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
  }, [replacements, showToast]);

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
    setProcessingMessage('🔁 正在重新找脸');

    try {
      // Use optimized image if available
      const imageToDetect = optimizedImage?.optimizedCanvas || image;
      const scale = optimizedImage?.scale || 1;

      await detectAndSetFaces(imageToDetect, scale);
    } catch (error) {
      console.error('重新检测失败:', error);
      setError('😵 检测出错了，点「重新检测」再试一次');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');

      if (hadReplacements) {
        showToast('🔄 已重新检测，之前的替换被清空', {
          label: '撤销',
          handler: handleUndo,
        });
      }
    }
  }, [image, optimizedImage, replacements, pushHistory, detectAndSetFaces, showToast, handleUndo]);


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

        showToast('✅ 图片已保存到下载');
      }, 'image/png');
    });
  }, [image, faces, replacements, showToast]);

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-6 px-4 flex flex-col">
      {/* Model Loading Modal */}
      <ModelLoadingModal state={modelLoadingState} />

      {/* Processing Overlay */}
      <AnimatePresence>
        {isProcessing && processingMessage && (
          <ProcessingOverlay
            message={processingMessage}
            hint={
              processingMessage.includes('瘦身')
                ? '图片瘦身中，导出依旧高清'
                : '稍等片刻，正在分析图片...'
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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6 flex flex-col items-center justify-center"
        >
          {/* Logo */}
          <motion.div
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
          </motion.div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-black text-gray-800 dark:text-gray-100 drop-shadow-lg tracking-tight shimmer-text bg-clip-text">
            カオナシ
          </h1>

          {/* Subtitle with privacy promise */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-2 flex flex-wrap items-center justify-center gap-2 px-4"
          >
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full shadow-sm text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
              🔒 本地处理
            </span>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              用 Emoji 隐藏照片里的脸，图片不会离开你的浏览器
            </p>
          </motion.div>
        </motion.div>

        {/* Main content */}
        <div className="space-y-4">
          {/* Settings Panel - before upload, and again once faces are detected */}
          {(!image || faces.length > 0) && !isProcessing && (
            <motion.div
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
            </motion.div>
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
            <motion.div
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
            </motion.div>
          )}

          {/* Status message - Error */}
          {image && error && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 text-center border-4 border-orange-400 dark:border-orange-500"
            >
              <div className="text-4xl mb-2">⚠️</div>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">提示</p>
              <p className="text-gray-600 dark:text-gray-300">{error}</p>
            </motion.div>
          )}

          {/* Status message - Success with progress and secondary actions */}
          {image && faces.length > 0 && !isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-sm p-3 text-center border-2 border-gray-300 dark:border-slate-600"
            >
              <div className="space-y-2">
                {/* Detection result */}
                <span className="text-2xl font-black text-gray-900 dark:text-gray-100 block">
                  ✓ 检测到 {faces.length} 张人脸
                </span>
                
                {/* Replacement progress */}
                {replacements.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-sm font-bold"
                  >
                    {replacements.length === faces.length ? (
                      <span className="text-green-600 dark:text-green-400">
                        🎉 已全部替换 <span className="text-gray-500 dark:text-gray-500 text-xs">({replacements.length}/{faces.length})</span>
                      </span>
                    ) : (
                      <span className="text-blue-600 dark:text-blue-400">
                        ⏳ 已替换 <span className="text-gray-500 dark:text-gray-500 text-xs">({replacements.length}/{faces.length})</span>
                      </span>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Secondary action buttons */}
              <div className="flex flex-wrap gap-2 justify-center mt-3">
                <motion.button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  whileHover={canUndo ? { scale: 1.02 } : {}}
                  whileTap={canUndo ? { scale: 0.98 } : {}}
                  className={`text-sm px-3 py-1.5 btn-duo ${canUndo ? 'btn-ghost' : 'btn-disabled'}`}
                  title="撤销 (Ctrl/Cmd+Z)"
                >
                  ↩️ 撤销
                </motion.button>
                <motion.button
                  onClick={handleRedo}
                  disabled={!canRedo}
                  whileHover={canRedo ? { scale: 1.02 } : {}}
                  whileTap={canRedo ? { scale: 0.98 } : {}}
                  className={`text-sm px-3 py-1.5 btn-duo ${canRedo ? 'btn-ghost' : 'btn-disabled'}`}
                  title="重做 (Ctrl/Cmd+Shift+Z)"
                >
                  ↪️ 重做
                </motion.button>
                <motion.button
                  onClick={handleRedetect}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="text-sm px-3 py-1.5 btn-duo btn-secondary"
                >
                  🔄 重新检测
                </motion.button>
                <motion.button
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
                  📤 换一张
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Emoji selector */}
          {image && faces.length > 0 && !isProcessing && (
            <motion.div
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
            </motion.div>
          )}

          {/* Action buttons - Duolingo Style */}
          {image && faces.length > 0 && !isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-2 md:gap-3 justify-center"
            >
              <motion.button
                onClick={handleApplyToAll}
                whileHover={selectedEmoji ? { scale: 1.05 } : {}}
                whileTap={selectedEmoji ? { scale: 0.95 } : {}}
                disabled={!selectedEmoji}
                className={`px-4 py-2 md:px-6 md:py-3 text-sm md:text-base btn-duo ${
                  selectedEmoji ? 'btn-secondary' : 'btn-disabled'
                }`}
                title={!selectedEmoji ? '请先选择表情' : ''}
              >
                <span className="text-lg md:text-xl">⚡</span>
                全部替换
                {replacements.length > 0 && <span className="sr-only"> 已替换 {replacements.length} 项</span>}
              </motion.button>
              <motion.button
                onClick={handleReset}
                whileHover={replacements.length > 0 ? { scale: 1.05 } : {}}
                whileTap={replacements.length > 0 ? { scale: 0.95 } : {}}
                disabled={replacements.length === 0}
                className={`px-4 py-2 md:px-6 md:py-3 text-sm md:text-base btn-duo ${
                  replacements.length > 0 ? 'btn-ghost' : 'btn-disabled'
                }`}
                title={replacements.length === 0 ? '暂无可重置的内容' : ''}
              >
                <span className="text-lg md:text-xl">♻️</span>
                重置
              </motion.button>
              <motion.button
                onClick={handleExport}
                whileHover={replacements.length > 0 ? { scale: 1.05 } : {}}
                whileTap={replacements.length > 0 ? { scale: 0.95 } : {}}
                disabled={replacements.length === 0}
                className={`px-4 py-2 md:px-6 md:py-3 text-sm md:text-base btn-duo ${
                  replacements.length > 0 ? 'btn-primary' : 'btn-disabled'
                }`}
                title={replacements.length === 0 ? '请先替换表情' : ''}
              >
                <span className="text-lg md:text-xl">📥</span>
                下载图片
              </motion.button>
            </motion.div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {activeReplacement && !isProcessing && (
          <motion.div
            key={activeReplacement.faceId}
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
            <motion.div
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
              <motion.button
                type="button"
                layout
                onPointerDown={handleInspectorHandlePointerDown}
                whileTap={{ scaleX: 1.05 }}
                className="mb-2 mx-auto block h-1.5 w-12 rounded-full bg-white/70 dark:bg-slate-500 cursor-grab active:cursor-grabbing"
                aria-label="拖动关闭微调面板"
              />
              <div className="overflow-hidden rounded-[26px] border border-white/40 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl shadow-[0_20px_45px_-20px_rgba(15,23,42,0.45)]">
                <EmojiInspector
                  replacement={activeReplacement}
                  defaultSettings={emojiSettings}
                  label={activeFaceIndex >= 0 ? `第 ${activeFaceIndex + 1} 张脸` : '人脸'}
                  onUpdate={handleInspectorUpdate}
                  onBeginEdit={pushHistory}
                  onResetToDefault={handleInspectorReset}
                  onAdoptAsDefault={handleInspectorAdopt}
                  onApplyToAll={handleInspectorApplyToAll}
                  onClose={handleInspectorClose}
                  className="bg-transparent border-none shadow-none p-5 md:p-6 space-y-5"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer - Duolingo Style */}
      <motion.footer
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
      </motion.footer>
    </div>
    </MotionConfig>
  );
}
