'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DetectedFace, EmojiReplacement } from '@/types';
import { m } from 'framer-motion';
import { drawEmojiReplacement, getEmojiScreenRect } from '@/lib/emojiRenderUtils';
import {
  getLoadedEmojiImage,
  hasEmojiImageFailed,
  loadEmojiImage,
} from '@/lib/emojiImageCache';

import { useFaceBadgeLayout } from '@/hooks/useFaceBadgeLayout';
import { useFrameDebouncedCallback } from '@/hooks/useFrameDebouncedCallback';

interface FaceCanvasProps {
  image: HTMLImageElement | null;
  faces: DetectedFace[];
  replacements: EmojiReplacement[];
  onFaceClick: (faceId: string) => void;
  onInspectFace?: (faceId: string) => void;
  activeReplacementId?: string | null;
  // Called while the active (inspected) face's emoji is being dragged on
  // the canvas; only that face can be repositioned this way.
  onRepositionActiveEmoji?: (patch: Partial<EmojiReplacement>) => void;
  // Called once, right when a drag first crosses the threshold — lets the
  // caller snapshot undo history before the first reposition patch lands.
  // Also reused as the gesture-start hook for wheel/pinch zoom (see below):
  // any of these continuous gestures must push history exactly once per
  // gesture, not once per frame.
  onBeginDragReposition?: () => void;
}

// CSS-pixel movement threshold before a pointer-down on the active emoji
// counts as a drag rather than a tap (which still applies the selected emoji)
const DRAG_THRESHOLD_PX = 4;

// Scale bounds, matching the inspector's slider (components/EmojiInspector.tsx)
const MIN_EMOJI_SCALE = 0.5;
const MAX_EMOJI_SCALE = 2.0;
// Multiplicative step per wheel notch (~5%)
const WHEEL_SCALE_STEP = 0.05;
// A wheel "gesture" is a burst of notches; a gap longer than this starts a
// new gesture, so pushHistory fires once per burst rather than per notch.
const WHEEL_GESTURE_GAP_MS = 400;

function clampEmojiScale(scale: number): number {
  return Math.min(Math.max(scale, MIN_EMOJI_SCALE), MAX_EMOJI_SCALE);
}

interface DragState {
  pointerId: number;
  faceId: string;
  startClientX: number;
  startClientY: number;
  baseOffsetX: number;
  baseOffsetY: number;
  isDragging: boolean;
}

// Original-image → display-canvas (CSS px) coordinate conversion, shared by
// the draw effect and drag hit-testing so the two can never disagree
function toDisplaySpace(face: DetectedFace, replacement: EmojiReplacement, scale: number) {
  return {
    box: {
      x: face.box.x * scale,
      y: face.box.y * scale,
      width: face.box.width * scale,
      height: face.box.height * scale,
    },
    offset: {
      x: (replacement.offsetX ?? 0) * scale,
      y: (replacement.offsetY ?? 0) * scale,
    },
  };
}

export default function FaceCanvas({
  image,
  faces,
  replacements,
  onFaceClick,
  onInspectFace,
  activeReplacementId,
  onRepositionActiveEmoji,
  onBeginDragReposition,
}: FaceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Offscreen canvas holding the pre-rendered base image; rebuilt only when
  // image/size/dpr change, not on every drag/slider frame.
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenKeyRef = useRef<string | null>(null);
  const [scale, setScale] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  // Bumped when an emoji image finishes loading so the draw effect re-runs
  const [emojiLoadTick, setEmojiLoadTick] = useState(0);
  const { getBadgeRefCallback, getBadgePosition } = useFaceBadgeLayout({
    canvasWidth: canvasSize.width,
    canvasHeight: canvasSize.height,
    scale,
  });

  const replacementMap = useMemo(() => {
    const map = new Map<string, EmojiReplacement>();
    replacements.forEach((replacement) => map.set(replacement.faceId, replacement));
    return map;
  }, [replacements]);

  const faceMap = useMemo(() => {
    const map = new Map<string, DetectedFace>();
    faces.forEach((face) => map.set(face.id, face));
    return map;
  }, [faces]);

  // Calculate canvas dimensions and scale; re-fit on container resize
  useEffect(() => {
    if (!image || !containerRef.current) return;

    const container = containerRef.current;

    const fitToContainer = () => {
      const maxWidth = container.clientWidth || 800; // Fallback to 800px if container not ready
      const maxHeight = Math.min(window.innerHeight * 0.7, 800) || 600; // Max 70vh or 800px, floor for degenerate viewports

      // Calculate scale to fit container
      const scaleX = maxWidth / image.naturalWidth;
      const scaleY = maxHeight / image.naturalHeight;
      const fitScale = Math.min(scaleX, scaleY, 1); // Don't scale up

      setScale(fitScale);
      setCanvasSize({
        width: image.naturalWidth * fitScale,
        height: image.naturalHeight * fitScale,
      });
    };

    fitToContainer();

    const observer = new ResizeObserver(fitToContainer);
    observer.observe(container);
    return () => observer.disconnect();
  }, [image]);

  // Draw image, face boxes, and emojis
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    // Wait for canvas size to be set
    if (canvasSize.width === 0 || canvasSize.height === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Render at devicePixelRatio for crisp output on HiDPI screens;
    // all drawing below stays in CSS-pixel coordinates.
    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.round(canvasSize.width * dpr);
    const targetHeight = Math.round(canvasSize.height * dpr);
    // Reassigning canvas.width/height resets the entire backing store even
    // when the value is unchanged — skip it on replacement-only redraws
    // (this effect runs once per animation frame during drags/slider pulls)
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // 1. Draw the base image via a pre-rendered offscreen canvas. The
    // offscreen canvas is sized to targetWidth x targetHeight physical
    // (DPR-scaled) pixels and drawn with the same setTransform(dpr,...) +
    // drawImage(image, 0, 0, canvasSize.width, canvasSize.height) that used
    // to run inline here — so its pixel content is identical to what this
    // effect drew directly before. Blitting it into the main ctx (also
    // DPR-transformed) at the same CSS-pixel destination size reproduces
    // that content 1:1: both sides apply the same dpr scale, so the net
    // transform cancels out. This decouples the expensive image resample
    // from per-frame drag/slider redraws — it's only rebuilt when
    // image/size/dpr actually change (tracked via offscreenKeyRef).
    const offscreenKey = `${image.src}|${targetWidth}x${targetHeight}`;
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    const offscreen = offscreenCanvasRef.current;
    if (offscreenKeyRef.current !== offscreenKey || offscreen.width !== targetWidth || offscreen.height !== targetHeight) {
      offscreen.width = targetWidth;
      offscreen.height = targetHeight;
      const offscreenCtx = offscreen.getContext('2d');
      if (offscreenCtx) {
        offscreenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        offscreenCtx.drawImage(image, 0, 0, canvasSize.width, canvasSize.height);
      }
      offscreenKeyRef.current = offscreenKey;
    }
    ctx.drawImage(offscreen, 0, 0, canvasSize.width, canvasSize.height);

    // 2. Draw face boxes
    faces.forEach((face) => {
      const isReplaced = replacementMap.has(face.id);
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

    // 3. Draw emoji replacements synchronously from the shared cache.
    // Cache misses trigger a load and a full redraw once settled — async
    // callbacks never draw directly, so a superseded frame can't leave
    // ghosts on a newer one.
    let cancelled = false;

    replacements.forEach((replacement) => {
      const face = faceMap.get(replacement.faceId);
      if (!face) return;

      const { box, offset } = toDisplaySpace(face, replacement, scale);

      const url = replacement.emojiUrl;

      // Empty URL or a known-failed CDN load → native emoji glyph
      if (!url || hasEmojiImageFailed(url)) {
        drawEmojiReplacement(ctx, box, offset, replacement, null);
        return;
      }

      const cachedImage = getLoadedEmojiImage(url);
      if (cachedImage) {
        drawEmojiReplacement(ctx, box, offset, replacement, cachedImage);
        return;
      }

      loadEmojiImage(url)
        .catch(() => null)
        .then(() => {
          if (!cancelled) setEmojiLoadTick((tick) => tick + 1);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [
    image,
    faces,
    replacements,
    scale,
    canvasSize.width,
    canvasSize.height,
    activeReplacementId,
    faceMap,
    replacementMap,
    emojiLoadTick,
  ]);

  const scheduleReposition = useFrameDebouncedCallback(
    useCallback(
      (patch: Partial<EmojiReplacement>) => onRepositionActiveEmoji?.(patch),
      [onRepositionActiveEmoji]
    )
  );

  // Screen-space (CSS px) rect of the active face's emoji, used for drag hit-testing
  const getActiveEmojiRect = useCallback(() => {
    if (!activeReplacementId) return null;
    const face = faceMap.get(activeReplacementId);
    const replacement = replacementMap.get(activeReplacementId);
    if (!face || !replacement) return null;

    const { box, offset } = toDisplaySpace(face, replacement, scale);
    return getEmojiScreenRect(box, offset, replacement.scale ?? 1);
  }, [activeReplacementId, faceMap, replacementMap, scale]);

  const dragStateRef = useRef<DragState | null>(null);
  // Set once a drag crosses the threshold, so the click that follows
  // pointerup is suppressed (a drag shouldn't also re-apply the emoji)
  const justDraggedRef = useRef(false);

  // Active pointers on the canvas, keyed by pointerId — used to detect a
  // second finger landing (pinch) while a drag is in progress.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = useRef<{ startDistance: number; baseScale: number } | null>(null);
  // Timestamp of the last wheel notch, so a burst of notches counts as one
  // gesture (one pushHistory) rather than one per notch.
  const lastWheelTimeRef = useRef(0);

  const getActiveReplacementScale = useCallback(() => {
    if (!activeReplacementId) return 1;
    return replacementMap.get(activeReplacementId)?.scale ?? 1;
  }, [activeReplacementId, replacementMap]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onRepositionActiveEmoji || !activeReplacementId) return;

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // A second finger landing while one is already down starts a pinch —
    // cancel any in-progress drag reposition and switch modes.
    if (pointersRef.current.size === 2) {
      const points = Array.from(pointersRef.current.values());
      const startDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (startDistance > 0) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore — pinch will just not track this pointer's capture
        }
        if (dragStateRef.current) {
          if (e.currentTarget.hasPointerCapture(dragStateRef.current.pointerId)) {
            e.currentTarget.releasePointerCapture(dragStateRef.current.pointerId);
          }
          dragStateRef.current = null;
        }
        onBeginDragReposition?.();
        pinchStateRef.current = {
          startDistance,
          baseScale: getActiveReplacementScale(),
        };
      }
      return;
    }

    if (pointersRef.current.size > 2) return;

    const rect = getActiveEmojiRect();
    if (!rect) return;

    const canvasRect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;

    if (x < rect.x || x > rect.x + rect.width || y < rect.y || y > rect.y + rect.height) {
      return;
    }

    const activeReplacement = replacementMap.get(activeReplacementId);
    try {
      // Some browsers (notably older iOS Safari) can reject capture for a
      // pointerId that isn't tracked internally; degrade to "no drag" rather
      // than letting the exception abort the rest of this handler.
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      return;
    }
    dragStateRef.current = {
      pointerId: e.pointerId,
      faceId: activeReplacementId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      baseOffsetX: activeReplacement?.offsetX ?? 0,
      baseOffsetY: activeReplacement?.offsetY ?? 0,
      isDragging: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pinchStateRef.current && pointersRef.current.size >= 2) {
      const points = Array.from(pointersRef.current.values()).slice(0, 2);
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const { startDistance, baseScale } = pinchStateRef.current;
      const nextScale = clampEmojiScale(baseScale * (distance / startDistance));
      scheduleReposition({ scale: nextScale });
      return;
    }

    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) {
      // Not dragging: show a grab cursor when hovering the draggable emoji
      if (onRepositionActiveEmoji && activeReplacementId) {
        const rect = getActiveEmojiRect();
        const canvasRect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - canvasRect.left;
        const y = e.clientY - canvasRect.top;
        const hovering =
          !!rect &&
          x >= rect.x &&
          x <= rect.x + rect.width &&
          y >= rect.y &&
          y <= rect.y + rect.height;
        e.currentTarget.style.cursor = hovering ? 'grab' : 'pointer';
      }
      return;
    }

    const deltaX = (e.clientX - drag.startClientX) / scale;
    const deltaY = (e.clientY - drag.startClientY) / scale;

    if (!drag.isDragging) {
      const distance = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY);
      if (distance < DRAG_THRESHOLD_PX) return;
      drag.isDragging = true;
      e.currentTarget.style.cursor = 'grabbing';
      onBeginDragReposition?.();
    }

    scheduleReposition({
      offsetX: drag.baseOffsetX + deltaX,
      offsetY: drag.baseOffsetY + deltaY,
    });
  };

  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);

    if (pinchStateRef.current && pointersRef.current.size < 2) {
      pinchStateRef.current = null;
    }

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    if (drag.isDragging) {
      justDraggedRef.current = true;
      e.currentTarget.style.cursor = 'grab';
    }
    dragStateRef.current = null;
  };

  // Wheel-to-zoom the active emoji. Attached as a native, non-passive
  // listener (rather than the `onWheel` JSX prop) because React registers
  // synthetic wheel handlers as passive by default — preventDefault() there
  // is silently ignored, and page scroll wouldn't actually be blocked.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onCanvasWheel = (e: WheelEvent) => {
      if (!onRepositionActiveEmoji || !activeReplacementId) return;

      const rect = getActiveEmojiRect();
      if (!rect) return;

      const canvasRect = canvas.getBoundingClientRect();
      const x = e.clientX - canvasRect.left;
      const y = e.clientY - canvasRect.top;
      if (x < rect.x || x > rect.x + rect.width || y < rect.y || y > rect.y + rect.height) {
        return;
      }

      e.preventDefault();

      const now = performance.now();
      if (now - lastWheelTimeRef.current > WHEEL_GESTURE_GAP_MS) {
        onBeginDragReposition?.();
      }
      lastWheelTimeRef.current = now;

      const direction = e.deltaY > 0 ? -1 : 1;
      const nextScale = clampEmojiScale(
        getActiveReplacementScale() * (1 + direction * WHEEL_SCALE_STEP)
      );
      scheduleReposition({ scale: nextScale });
    };

    canvas.addEventListener('wheel', onCanvasWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onCanvasWheel);
  }, [
    onRepositionActiveEmoji,
    activeReplacementId,
    getActiveEmojiRect,
    onBeginDragReposition,
    getActiveReplacementScale,
    scheduleReposition,
  ]);

  // Handle canvas click to select face
  // No selected-emoji guard: the parent decides how to respond (e.g. prompt to pick one)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }

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
    <m.div
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
          onClick={handleCanvasClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="glass-panel cursor-pointer transition-shadow touch-none"
          style={{
            width: canvasSize.width || '100%',
            height: canvasSize.height || 'auto',
            display: 'block',
          }}
        />

        {onInspectFace && canvasSize.width > 0 && canvasSize.height > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {faces.map((face, index) => {
              const hasReplacement = replacementMap.has(face.id);
              const isActive = activeReplacementId === face.id;
              const position = getBadgePosition(face);

              const badgeBaseClass =
                'pointer-events-auto absolute inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-sm transition-all backdrop-blur-md border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70';
              const badgeVisualClass = isActive
                ? 'bg-gradient-to-r from-orange-400 to-orange-500 text-white border-transparent shadow-[0_12px_24px_-14px_rgba(249,115,22,0.9)]'
                : hasReplacement
                  ? 'bg-white/90 dark:bg-slate-900/85 text-gray-700 dark:text-gray-100 border-white/60 dark:border-slate-700/60 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.45)] hover:scale-105'
                  : 'bg-white/70 dark:bg-slate-900/70 text-gray-500 dark:text-gray-400 border-dashed border-blue-300/60 dark:border-slate-600/60';

              return (
                <button
                  key={face.id}
                  type="button"
                  ref={getBadgeRefCallback(face.id)}
                  data-face-badge={face.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onInspectFace(face.id);
                  }}
                  className={`${badgeBaseClass} ${badgeVisualClass}`}
                  style={{
                    top: position.top,
                    left: position.left,
                  }}
                  title={hasReplacement ? '微调当前表情' : '先替换后再微调'}
                >
                  <span>第 {index + 1} 张脸</span>
                  {hasReplacement && <span aria-hidden>⚙️</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </m.div>
  );
}
