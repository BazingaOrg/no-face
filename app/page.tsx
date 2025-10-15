'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import NextImage from 'next/image';
import ImageUploader from '@/components/ImageUploader';
import FaceCanvas from '@/components/FaceCanvas';
import EmojiSelector from '@/components/EmojiSelector';
import SettingsPanel from '@/components/SettingsPanel';
import { DetectedFace, EmojiReplacement, DetectionSettings, EmojiSettings } from '@/types';
import { detectFaces, detectFacesWithLandmarks, areLandmarksAvailable } from '@/lib/faceApi';
import { getTwemojiUrl, preloadEmojiWithFallback } from '@/lib/twemoji';
import { calculateEmojiSize, applyUserOffsets } from '@/lib/emojiRenderUtils';

export default function Home() {
  // State management
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [faces, setFaces] = useState<DetectedFace[]>([]);
  const [replacements, setReplacements] = useState<EmojiReplacement[]>([]);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLandmarks, setHasLandmarks] = useState(false);

  // Settings (now mutable)
  const [detectionSettings, setDetectionSettings] = useState<DetectionSettings>({
    detector: 'ssd_mobilenetv1',
    minConfidence: 0.5,
  });

  const [emojiSettings, setEmojiSettings] = useState<EmojiSettings>({
    size: '72x72',
    scale: 1.2,
    opacity: 1.0,
    offsetX: 0,
    offsetY: 0,
    flipX: false,
    flipY: false,
  });

  // Auto-apply emoji settings when they change
  // Only update styles (scale, opacity, offset), not the emoji itself
  useEffect(() => {
    if (replacements.length === 0) return;

    setReplacements((prev) =>
      prev.map((r) => ({
        ...r,
        // Use each replacement's own emoji to generate URL (always SVG)
        emojiUrl: getTwemojiUrl(r.emoji, emojiSettings),
        scale: emojiSettings.scale,
        opacity: emojiSettings.opacity,
        offsetX: emojiSettings.offsetX,
        offsetY: emojiSettings.offsetY,
        flipX: emojiSettings.flipX,
        flipY: emojiSettings.flipY,
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emojiSettings]); // Only trigger on emojiSettings change, not replacements

  // Handle image upload
  const handleImageLoad = useCallback(
    async (img: HTMLImageElement) => {
      setImage(img);
      setFaces([]);
      setReplacements([]);
      setError(null);
      setIsProcessing(true);

      try {
        // Detect faces with landmarks if available
        const detectedFaces = await detectFacesWithLandmarks(img, detectionSettings);
        
        // Check if landmarks are available
        const landmarksAvailable = areLandmarksAvailable();
        setHasLandmarks(landmarksAvailable);

        if (detectedFaces.length === 0) {
          setError('未检测到人脸，请尝试更换图片');
        } else {
          setFaces(detectedFaces);
        }
      } catch {
        setError('检测失败，请重试或检查网络连接');
      } finally {
        setIsProcessing(false);
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
        const result = await preloadEmojiWithFallback(selectedEmoji, emojiSettings);

        // Add or update replacement
        setReplacements((prev) => {
          const existing = prev.find((r) => r.faceId === faceId);
          if (existing) {
            // Update existing replacement
            return prev.map((r) =>
              r.faceId === faceId
                ? { ...r, emoji: selectedEmoji, emojiUrl: result.url }
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
                offsetX: emojiSettings.offsetX,
                offsetY: emojiSettings.offsetY,
                flipX: emojiSettings.flipX,
                flipY: emojiSettings.flipY,
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
  }, []);

  // Re-detect faces with new settings
  const handleRedetect = useCallback(async () => {
    if (!image) return;

    setFaces([]);
    setReplacements([]);
    setError(null);
    setIsProcessing(true);

    try {
      const detectedFaces = await detectFacesWithLandmarks(image, detectionSettings);
      
      // Check if landmarks are available
      const landmarksAvailable = areLandmarksAvailable();
      setHasLandmarks(landmarksAvailable);

      if (detectedFaces.length === 0) {
        setError('未检测到人脸，尝试调整灵敏度？');
      } else {
        setFaces(detectedFaces);
      }
    } catch {
      setError('检测失败，请重试或检查网络连接');
    } finally {
      setIsProcessing(false);
    }
  }, [image, detectionSettings]);


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
      <div className="max-w-3xl mx-auto flex-1 w-full">
        {/* Header - Duolingo Style */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-5"
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-block mb-2"
          >
            <NextImage
              src="/kaonashi.jpg"
              alt="カオナシ"
              width={80}
              height={80}
              className="w-16 h-16 md:w-20 md:h-20 object-contain rounded-xl"
            />
          </motion.div>
          <h1 className="text-3xl md:text-4xl font-black text-gray-800 dark:text-gray-100 mb-2 drop-shadow-lg tracking-tight">
            カオナシ
          </h1>
        </motion.div>

        {/* Privacy Badge - Below header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center mb-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 border-2 border-green-500 dark:border-green-600 rounded-full shadow-sm">
            <span className="text-lg">🔒</span>
            <span className="text-sm font-bold text-green-700 dark:text-green-300">
              <span className="numeric-display">100%</span> 本地处理 · 零数据上传
            </span>
          </div>
        </motion.div>

        {/* Main content */}
        <div className="space-y-4">
          {/* Image uploader */}
          {!image && (
            <ImageUploader onImageLoad={handleImageLoad} disabled={isProcessing} />
          )}

          {/* Status message - Processing */}
          {image && isProcessing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 text-center"
            >
              <div className="inline-block animate-bounce text-4xl mb-2">🔍</div>
              <p className="text-xl font-black text-gray-800 dark:text-gray-100">正在检测人脸...</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">请稍候</p>
            </motion.div>
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
              className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-sm p-3 text-center border-2 border-green-400 dark:border-green-500"
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
                className={`px-4 py-2 md:px-6 md:py-3 rounded-2xl font-black text-sm md:text-base shadow-lg transition-all numeric-display ${
                  selectedEmoji
                    ? 'bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white border-b-4 border-green-600 active:border-b-0 active:mt-1 cursor-pointer'
                    : 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-500 border-b-4 border-gray-400 cursor-not-allowed opacity-60'
                }`}
                title={!selectedEmoji ? '请先选择表情' : ''}
              >
                全部替换 ({faces.length})
              </motion.button>
              <motion.button
                onClick={handleReset}
                whileHover={replacements.length > 0 ? { scale: 1.05 } : {}}
                whileTap={replacements.length > 0 ? { scale: 0.95 } : {}}
                disabled={replacements.length === 0}
                className={`px-4 py-2 md:px-6 md:py-3 rounded-2xl font-black text-sm md:text-base shadow-lg transition-all numeric-display ${
                  replacements.length > 0
                    ? 'bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white border-b-4 border-gray-600 active:border-b-0 active:mt-1 cursor-pointer'
                    : 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-500 border-b-4 border-gray-400 cursor-not-allowed opacity-60'
                }`}
                title={replacements.length === 0 ? '暂无可重置的内容' : ''}
              >
                重置 {replacements.length > 0 && `(${replacements.length})`}
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
                下载 {replacements.length > 0 && `(含${replacements.length}个表情)`}
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
                emojiSettings={emojiSettings}
                onDetectionChange={setDetectionSettings}
                onEmojiChange={setEmojiSettings}
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
                emojiSettings={emojiSettings}
                onDetectionChange={setDetectionSettings}
                onEmojiChange={setEmojiSettings}
                isOpen={isSettingsPanelOpen}
                onToggle={() => setIsSettingsPanelOpen(!isSettingsPanelOpen)}
                hasReplacements={false}
                hasImage={false}
              />
            </motion.div>
          )}
        </div>
      </div>

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
