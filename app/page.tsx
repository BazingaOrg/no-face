'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  detectFacesWithLandmarks, 
  areLandmarksAvailable,
  loadSSDModel,
  loadTinyModel,
  isModelLoaded,
  setModelLoadingProgressCallback
} from '@/lib/faceApi';
import { getTwemojiUrl, preloadEmojiWithFallback } from '@/lib/twemoji';
import { calculateEmojiSize, applyUserOffsets } from '@/lib/emojiRenderUtils';
import { 
  optimizeImageForDetection, 
  mapCoordinatesToOriginal,
  getImageSizeCategory,
  type OptimizedImage
} from '@/utils/imageOptimization';

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

  // Settings (now mutable)
  const [detectionSettings, setDetectionSettings] = useState<DetectionSettings>({
    detector: 'ssd_mobilenetv1',
    minConfidence: 0.5,
  });

  const [emojiSettings, setEmojiSettings] = useState<EmojiSettings>({
    size: '72x72',
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
        setError('模型加载失败，请刷新页面重试');
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
        setToastMessage('⏳ 正在唤醒 Tiny 模型');
        setIsToastVisible(true);
        
        try {
          await loadTinyModel(false); // Load with progress
          setToastMessage('✅ 检测器上线啦');
          setIsToastVisible(true);
        } catch (error) {
          console.error('检测器加载失败:', error);
          setToastMessage('❌ 模型加载没成功');
          setIsToastVisible(true);
        }
      }
    };

    handleDetectorChange();
  }, [detectionSettings.detector]);

  // Auto-apply emoji settings when they change
  // Only update styles (scale, opacity, flip), not the emoji itself
  useEffect(() => {
    if (replacements.length === 0) return;

    setReplacements((prev) =>
      prev.map((replacement) => {
        const withUrl = {
          ...replacement,
          emojiUrl: getTwemojiUrl(replacement.emoji),
        };

        if (replacement.isCustom) {
          return withUrl;
        }

        return {
          ...withUrl,
          scale: emojiSettings.scale,
          opacity: emojiSettings.opacity,
          flipX: emojiSettings.flipX,
          flipY: emojiSettings.flipY,
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emojiSettings]);

  // Handle image upload
  const handleImageLoad = useCallback(
    async (img: HTMLImageElement, fileSize?: number) => {
      setImage(img);
      setFaces([]);
      setReplacements([]);
      setActiveReplacementId(null);
      setError(null);
      setIsProcessing(true);

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
        
        // Add small delay to let UI update
        await new Promise(resolve => setTimeout(resolve, 50));

        // Detect faces with landmarks if available
        const detectedFaces = await detectFacesWithLandmarks(imageToDetect, detectionSettings);
        
        // Map coordinates back to original image if scaled
        const mappedFaces = scale < 1
          ? detectedFaces.map(face => ({
              ...face,
              box: mapCoordinatesToOriginal(face.box, scale),
            }))
          : detectedFaces;

        // Check if landmarks are available
        const landmarksAvailable = areLandmarksAvailable();
        setHasLandmarks(landmarksAvailable);

        if (mappedFaces.length === 0) {
          setError('🙈 没找到人脸，试试降低灵敏度');
        } else {
          // Performance warning for too many faces
          if (mappedFaces.length > 50) {
            setToastMessage(`🤯 发现 ${mappedFaces.length} 张脸，稍等我慢慢处理`);
            setIsToastVisible(true);
          }
          setFaces(mappedFaces);
        }
      } catch (error) {
        console.error('人脸检测失败:', error);
        setError('😵 检测没成功，重试看看？');
      } finally {
        setIsProcessing(false);
        setProcessingMessage('');
      }
    },
    [detectionSettings]
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
      if (!selectedEmoji) return;

      const face = faces.find((f) => f.id === faceId);
      if (!face) return;

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
                position: face.box,
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
    [selectedEmoji, faces, emojiSettings]
  );

  // Apply to all faces
  const handleApplyToAll = useCallback(async () => {
    if (!selectedEmoji) return;

    for (const face of faces) {
      await handleFaceClick(face.id);
    }
  }, [selectedEmoji, faces, handleFaceClick]);

  // Reset all replacements
  const handleReset = useCallback(() => {
    setReplacements([]);
    setActiveReplacementId(null);
  }, []);

  const handleInspectFace = useCallback((faceId: string) => {
    const target = replacements.find((replacement) => replacement.faceId === faceId);
    if (!target) {
      setToastMessage('😶 先替换表情再微调吧');
      setIsToastVisible(true);
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
  }, [replacements]);

  // Re-detect faces with new settings
  const handleRedetect = useCallback(async () => {
    if (!image) return;

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

      // Add small delay to let UI update
      await new Promise(resolve => setTimeout(resolve, 50));

      const detectedFaces = await detectFacesWithLandmarks(imageToDetect, detectionSettings);
      
      // Map coordinates back to original image if scaled
      const mappedFaces = scale < 1
        ? detectedFaces.map(face => ({
            ...face,
            box: mapCoordinatesToOriginal(face.box, scale),
          }))
        : detectedFaces;
      
      // Check if landmarks are available
      const landmarksAvailable = areLandmarksAvailable();
      setHasLandmarks(landmarksAvailable);

      if (mappedFaces.length === 0) {
        setError('🙈 没找到人脸，试试降低灵敏度');
      } else {
        // Performance warning for too many faces
        if (mappedFaces.length > 50) {
          setToastMessage(`🤯 发现 ${mappedFaces.length} 张脸，稍等我慢慢处理`);
          setIsToastVisible(true);
        }
        setFaces(mappedFaces);
      }
    } catch (error) {
      console.error('重新检测失败:', error);
      setError('😵 检测没成功，重试看看？');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  }, [image, optimizedImage, detectionSettings]);

  const handleInspectorUpdate = useCallback(
    (patch: Partial<EmojiReplacement>) => {
      if (!activeReplacement) return;
      applyReplacementPatch(activeReplacement.faceId, patch);
    },
    [activeReplacement, applyReplacementPatch]
  );

  const handleInspectorReset = useCallback(() => {
    if (!activeReplacement) return;

    applyReplacementPatch(
      activeReplacement.faceId,
      {
        scale: emojiSettings.scale,
        opacity: emojiSettings.opacity,
        flipX: emojiSettings.flipX,
        flipY: emojiSettings.flipY,
      },
      { customState: false }
    );

    setToastMessage('🌟 样式回到默认啦');
    setIsToastVisible(true);
  }, [activeReplacement, emojiSettings, applyReplacementPatch]);

  const handleInspectorAdopt = useCallback(() => {
    if (!activeReplacement) return;

    const nextDefaults: EmojiSettings = {
      ...emojiSettings,
      scale: activeReplacement.scale ?? emojiSettings.scale,
      opacity: activeReplacement.opacity ?? emojiSettings.opacity,
      flipX: activeReplacement.flipX ?? emojiSettings.flipX,
      flipY: activeReplacement.flipY ?? emojiSettings.flipY,
    };

    setEmojiSettings(nextDefaults);

    applyReplacementPatch(
      activeReplacement.faceId,
      {
        scale: nextDefaults.scale,
        opacity: nextDefaults.opacity,
        flipX: nextDefaults.flipX,
        flipY: nextDefaults.flipY,
      },
      { customState: false }
    );

    setToastMessage('✅ 默认样式已更新');
    setIsToastVisible(true);
  }, [activeReplacement, emojiSettings, applyReplacementPatch]);

  const handleInspectorApplyToAll = useCallback(() => {
    if (!activeReplacement) return;

    const nextScale = activeReplacement.scale ?? emojiSettings.scale;
    const nextOpacity = activeReplacement.opacity ?? emojiSettings.opacity;
    const nextFlipX = activeReplacement.flipX ?? emojiSettings.flipX;
    const nextFlipY = activeReplacement.flipY ?? emojiSettings.flipY;

    setReplacements((prev) =>
      prev.map((replacement) => ({
        ...replacement,
        scale: nextScale,
        opacity: nextOpacity,
        flipX: nextFlipX,
        flipY: nextFlipY,
        isCustom: true,
      }))
    );

    setToastMessage('🚀 全部表情同步完成');
    setIsToastVisible(true);
  }, [activeReplacement, emojiSettings, setReplacements, setToastMessage, setIsToastVisible]);

  const handleInspectorClose = useCallback(() => {
    setActiveReplacementId(null);
  }, []);


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

    // Load and draw all emojis
    const loadPromises = replacements.map((replacement) => {
      return new Promise<void>((resolve) => {
        const face = faces.find((f) => f.id === replacement.faceId);
        if (!face) {
          resolve();
          return;
        }

        // If emojiUrl is empty, use native emoji rendering
        if (!replacement.emojiUrl) {
          // Calculate adaptive emoji size
          const emojiSize = calculateEmojiSize(
            face.box.width,
            face.box.height,
            replacement.scale || 1
          );

          // Apply user-defined offsets
          const offsets = applyUserOffsets(
            emojiSize.offsetX,
            emojiSize.offsetY,
            replacement.offsetX || 0,
            replacement.offsetY || 0
          );

          // Calculate center position
          const centerX = face.box.x + offsets.offsetX + emojiSize.width / 2;
          const centerY = face.box.y + offsets.offsetY + emojiSize.height / 2;

          // Apply opacity and rotation
          const previousAlpha = ctx.globalAlpha;
          ctx.globalAlpha = replacement.opacity || 1.0;

          ctx.save();
          ctx.translate(centerX, centerY);
          
          // Apply flip transformations
          const scaleX = replacement.flipX ? -1 : 1;
          const scaleY = replacement.flipY ? -1 : 1;
          ctx.scale(scaleX, scaleY);

          // Draw native emoji text (centered)
          const fontSize = emojiSize.width * 0.8;
          ctx.font = `${fontSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(replacement.emoji, 0, 0);

          ctx.restore();
          ctx.globalAlpha = previousAlpha;
          resolve();
          return;
        }

        // Load and draw emoji image from Twemoji CDN
        const emojiImg = new Image();
        emojiImg.crossOrigin = 'anonymous';
        emojiImg.onload = () => {
          // Calculate adaptive emoji size
          const emojiSize = calculateEmojiSize(
            face.box.width,
            face.box.height,
            replacement.scale || 1
          );

          // Apply user-defined offsets
          const offsets = applyUserOffsets(
            emojiSize.offsetX,
            emojiSize.offsetY,
            replacement.offsetX || 0,
            replacement.offsetY || 0
          );

          // Calculate center position
          const centerX = face.box.x + offsets.offsetX + emojiSize.width / 2;
          const centerY = face.box.y + offsets.offsetY + emojiSize.height / 2;

          // Apply opacity and rotation
          const previousAlpha = ctx.globalAlpha;
          ctx.globalAlpha = replacement.opacity || 1.0;

          ctx.save();
          ctx.translate(centerX, centerY);
          
          // Apply flip transformations
          const scaleX = replacement.flipX ? -1 : 1;
          const scaleY = replacement.flipY ? -1 : 1;
          ctx.scale(scaleX, scaleY);

          // Draw emoji image centered at origin
          ctx.drawImage(
            emojiImg,
            -emojiSize.width / 2,
            -emojiSize.height / 2,
            emojiSize.width,
            emojiSize.height
          );

          ctx.restore();
          ctx.globalAlpha = previousAlpha;
          resolve();
        };
        emojiImg.onerror = () => resolve();
        emojiImg.src = replacement.emojiUrl;
      });
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
      }, 'image/png');
    });
  }, [image, faces, replacements]);

  return (
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

          {/* Title with Privacy Badge */}
          <div className="relative inline-block">
            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-black text-gray-800 dark:text-gray-100 drop-shadow-lg tracking-tight shimmer-text">
              カオナシ
            </h1>

            {/* Privacy Badge - Absolute positioned at top right */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="absolute -top-0 -right-20 -translate-y-1/2 inline-flex items-center justify-center gap-1 px-3 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full shadow-sm"
            >
              <span className="text-xs">🔒</span>
              <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                本地处理
              </span>
            </motion.div>
          </div>
        </motion.div>

        {/* Main content */}
        <div className="space-y-4">
          {/* Image uploader */}
          {!image && (
            <ImageUploader onImageLoad={handleImageLoad} disabled={isProcessing} />
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
                selectedEmoji={selectedEmoji}
                onFaceClick={handleFaceClick}
                onInspectFace={handleInspectFace}
                activeReplacementId={activeReplacementId}
              />
            </motion.div>
          )}

          {/* Status message - Error */}
          {image && error && (
            <motion.div
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
                <span className="text-lg font-bold text-gray-800 dark:text-gray-100 numeric-display block">
                  ✓ 检测到 {faces.length} 张人脸
                </span>
                
                {/* Replacement progress */}
                {replacements.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-sm font-bold numeric-display"
                  >
                    {replacements.length === faces.length ? (
                      <span className="text-green-600 dark:text-green-400">
                        🎉 已全部替换 ({replacements.length}/{faces.length})
                      </span>
                    ) : (
                      <span className="text-blue-600 dark:text-blue-400">
                        ⏳ 已替换 {replacements.length}/{faces.length}
                      </span>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Secondary action buttons */}
              <div className="flex gap-2 justify-center mt-3">
                <motion.button
                  onClick={handleRedetect}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="text-sm px-3 py-1.5 bg-gradient-to-r from-blue-300 to-blue-400 hover:from-blue-400 hover:to-blue-500 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 text-white rounded-xl font-bold shadow-sm transition-all border-b-2 border-blue-500 dark:border-blue-900 active:border-b-0 active:mt-0.5"
                >
                  🔄 重检
                </motion.button>
                <motion.button
                  onClick={() => {
                    setImage(null);
                    setFaces([]);
                    setReplacements([]);
                    setSelectedEmoji(null);
                    setError(null);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="text-sm px-3 py-1.5 bg-gradient-to-r from-indigo-300 to-indigo-400 hover:from-indigo-400 hover:to-indigo-500 dark:from-indigo-600 dark:to-indigo-700 dark:hover:from-indigo-700 dark:hover:to-indigo-800 text-white rounded-xl font-bold shadow-sm transition-all border-b-2 border-indigo-500 dark:border-indigo-900 active:border-b-0 active:mt-0.5"
                >
                  📤 新图
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
                className={`px-4 py-2 md:px-6 md:py-3 rounded-2xl font-black text-sm md:text-base shadow-lg transition-all flex items-center gap-2 numeric-display ${
                  selectedEmoji
                    ? 'bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white border-b-4 border-green-600 active:border-b-0 active:mt-1 cursor-pointer'
                    : 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-500 border-b-4 border-gray-400 cursor-not-allowed opacity-60'
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
                className={`px-4 py-2 md:px-6 md:py-3 rounded-2xl font-black text-sm md:text-base shadow-lg transition-all flex items-center gap-2 numeric-display ${
                  replacements.length > 0
                    ? 'bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white border-b-4 border-gray-600 active:border-b-0 active:mt-1 cursor-pointer'
                    : 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-500 border-b-4 border-gray-400 cursor-not-allowed opacity-60'
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
                className={`px-4 py-2 md:px-6 md:py-3 rounded-2xl font-black text-sm md:text-base shadow-lg transition-all flex items-center gap-2 numeric-display ${
                  replacements.length > 0
                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white border-b-4 border-yellow-600 active:border-b-0 active:mt-1 cursor-pointer'
                    : 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-500 border-b-4 border-gray-400 cursor-not-allowed opacity-60'
                }`}
                title={replacements.length === 0 ? '请先替换表情' : ''}
              >
                <span className="text-lg md:text-xl">📥</span>
                下载图片
              </motion.button>
            </motion.div>
          )}

          {/* Settings Panel - Show after image upload when faces detected */}
          {image && faces.length > 0 && !isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <SettingsPanel
                detectionSettings={detectionSettings}
                onDetectionChange={setDetectionSettings}
                isOpen={isSettingsPanelOpen}
                onToggle={() => setIsSettingsPanelOpen(!isSettingsPanelOpen)}
                hasReplacements={replacements.length > 0}
                hasImage={!!image}
              />
            </motion.div>
          )}

          {/* Settings Panel - Show before image upload */}
          {!image && !isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <SettingsPanel
                detectionSettings={detectionSettings}
                onDetectionChange={setDetectionSettings}
                isOpen={isSettingsPanelOpen}
                onToggle={() => setIsSettingsPanelOpen(!isSettingsPanelOpen)}
                hasReplacements={false}
                hasImage={false}
              />
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
            <div className="pointer-events-auto mx-auto w-full max-w-3xl px-4 pb-5">
              <motion.div
                layout
                className="mb-2 mx-auto h-1.5 w-12 rounded-full bg-white/70 dark:bg-slate-500"
              />
              <div className="overflow-hidden rounded-[26px] border border-white/40 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl shadow-[0_20px_45px_-20px_rgba(15,23,42,0.45)]">
                <EmojiInspector
                  replacement={activeReplacement}
                  defaultSettings={emojiSettings}
                  label={activeFaceIndex >= 0 ? `Face ${activeFaceIndex + 1}` : 'Face'}
                  onUpdate={handleInspectorUpdate}
                  onResetToDefault={handleInspectorReset}
                  onAdoptAsDefault={handleInspectorAdopt}
                  onApplyToAll={handleInspectorApplyToAll}
                  onClose={handleInspectorClose}
                  className="bg-transparent border-none shadow-none p-5 md:p-6 space-y-5"
                />
              </div>
            </div>
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
          © 2025 All rights reserved.
        </p>
      </motion.footer>
    </div>
  );
}
