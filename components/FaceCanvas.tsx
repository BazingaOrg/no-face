'use client';

import { useEffect, useRef, useState } from 'react';
import { DetectedFace, EmojiReplacement } from '@/types';
import { motion } from 'framer-motion';
import { calculateEmojiSize, applyUserOffsets } from '@/lib/emojiRenderUtils';

interface FaceCanvasProps {
  image: HTMLImageElement | null;
  faces: DetectedFace[];
  replacements: EmojiReplacement[];
  selectedEmoji: string | null;
  onFaceClick: (faceId: string) => void;
  onInspectFace?: (faceId: string) => void;
  activeReplacementId?: string | null;
}

export default function FaceCanvas({
  image,
  faces,
  replacements,
  selectedEmoji,
  onFaceClick,
  onInspectFace,
  activeReplacementId,
}: FaceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Calculate canvas dimensions and scale
  useEffect(() => {
    if (!image || !containerRef.current) return;

    const container = containerRef.current;
    const maxWidth = container.clientWidth || 800; // Fallback to 800px if container not ready
    const maxHeight = Math.min(window.innerHeight * 0.7, 800); // Max 70vh or 800px

    // Calculate scale to fit container
    const scaleX = maxWidth / image.naturalWidth;
    const scaleY = maxHeight / image.naturalHeight;
    const fitScale = Math.min(scaleX, scaleY, 1); // Don't scale up

    const calculatedWidth = image.naturalWidth * fitScale;
    const calculatedHeight = image.naturalHeight * fitScale;

    setScale(fitScale);
    setCanvasSize({
      width: calculatedWidth,
      height: calculatedHeight,
    });
  }, [image]);

  // Draw image, face boxes, and emojis
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    // Wait for canvas size to be set
    if (canvasSize.width === 0 || canvasSize.height === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw original image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // 2. Draw face boxes
    faces.forEach((face) => {
      const isReplaced = replacements.some((r) => r.faceId === face.id);
      const isActive = activeReplacementId === face.id;

      // Scale coordinates
      const x = face.box.x * scale;
      const y = face.box.y * scale;
      const width = face.box.width * scale;
      const height = face.box.height * scale;

      // Draw box
      if (isActive) {
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = isReplaced ? '#10b981' : '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash(isReplaced ? [] : [5, 5]);
      }
      ctx.strokeRect(x, y, width, height);

      // Draw checkmark if replaced
      if (isReplaced) {
        ctx.fillStyle = '#10b981';
        ctx.font = '16px sans-serif';
        ctx.fillText('✓', x + width - 20, y + 20);
      }
    });

    // 3. Draw emoji replacements
    replacements.forEach((replacement) => {
      const face = faces.find((f) => f.id === replacement.faceId);
      if (!face) return;

      // If emojiUrl is empty, use native emoji rendering
      if (!replacement.emojiUrl) {
        // Calculate adaptive emoji size
        const emojiSize = calculateEmojiSize(
          face.box.width * scale,
          face.box.height * scale,
          replacement.scale || 1
        );

        // Apply user-defined offsets
        const offsets = applyUserOffsets(
          emojiSize.offsetX,
          emojiSize.offsetY,
          (replacement.offsetX || 0) * scale,
          (replacement.offsetY || 0) * scale
        );

        // Calculate center position
        const centerX = face.box.x * scale + offsets.offsetX + emojiSize.width / 2;
        const centerY = face.box.y * scale + offsets.offsetY + emojiSize.height / 2;

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
        return;
      }

      // Load and draw emoji image from Twemoji CDN
      const emojiImg = new Image();
      emojiImg.crossOrigin = 'anonymous';
      emojiImg.onload = () => {
        // Calculate adaptive emoji size
        const emojiSize = calculateEmojiSize(
          face.box.width * scale,
          face.box.height * scale,
          replacement.scale || 1
        );

        // Calculate center position with adaptive offsets
        const centerX = face.box.x * scale + emojiSize.offsetX + emojiSize.width / 2;
        const centerY = face.box.y * scale + emojiSize.offsetY + emojiSize.height / 2;

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
      };
      emojiImg.src = replacement.emojiUrl;
    });
  }, [image, faces, replacements, scale, canvasSize, activeReplacementId]);

  // Handle canvas click to select face
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedEmoji) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find clicked face
    for (const face of faces) {
      const faceX = face.box.x * scale;
      const faceY = face.box.y * scale;
      const faceWidth = face.box.width * scale;
      const faceHeight = face.box.height * scale;

      if (
        x >= faceX &&
        x <= faceX + faceWidth &&
        y >= faceY &&
        y <= faceY + faceHeight
      ) {
        onFaceClick(face.id);
        break;
      }
    }
  };

  if (!image) {
    return null;
  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full flex justify-center"
    >
      <div
        className="relative"
        style={{
          width: canvasSize.width || '100%',
          height: canvasSize.height || 'auto',
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onClick={handleCanvasClick}
          className="border-2 border-gray-300 dark:border-slate-600 rounded-2xl shadow-md cursor-pointer"
          style={{
            width: canvasSize.width || '100%',
            height: canvasSize.height || 'auto',
            display: 'block',
          }}
        />

        {onInspectFace && canvasSize.width > 0 && canvasSize.height > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {faces.map((face, index) => {
              const top = Math.max(face.box.y * scale - 32, 8);
              const left = Math.max(face.box.x * scale - 8, 8);
              const hasReplacement = replacements.some((r) => r.faceId === face.id);
              const isActive = activeReplacementId === face.id;

              return (
                <button
                  key={face.id}
                  type="button"
                  data-face-badge={face.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onInspectFace(face.id);
                  }}
                  className={`pointer-events-auto absolute inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isActive
                      ? 'bg-gradient-to-r from-orange-400 to-orange-500 text-white'
                      : hasReplacement
                        ? 'bg-white/95 dark:bg-slate-900/85 text-gray-700 dark:text-gray-100 border border-blue-400/70 dark:border-slate-600 hover:scale-105'
                        : 'bg-white/80 dark:bg-slate-900/70 text-gray-500 dark:text-gray-400 border border-dashed border-blue-300/60 dark:border-slate-600/60'
                  }`}
                  style={{
                    top,
                    left,
                  }}
                  title={hasReplacement ? '微调当前表情' : '先替换后再微调'}
                >
                  <span>Face {index + 1}</span>
                  {hasReplacement && <span aria-hidden>⚙️</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
