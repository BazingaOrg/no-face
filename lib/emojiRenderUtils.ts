/**
 * Emoji rendering utilities
 * Handles adaptive sizing to prevent emoji distortion, and provides the
 * single draw routine shared by the canvas preview and the export pipeline
 * so both stay pixel-identical.
 */

import type { EmojiReplacement } from '@/types';

export interface EmojiRenderSize {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Calculate adaptive emoji size to prevent distortion
 * Strategy:
 * - If face box is nearly square (ratio 0.9-1.1): use max dimension
 * - If face box is too wide (ratio >1.1): use height as size
 * - If face box is too tall (ratio <0.9): use width as size
 *
 * This ensures emojis remain square and undistorted
 */
export function calculateEmojiSize(
  faceBoxWidth: number,
  faceBoxHeight: number,
  scale: number = 1.0
): EmojiRenderSize {
  const aspectRatio = faceBoxWidth / faceBoxHeight;

  let emojiSize: number;

  // Nearly square face - use larger dimension to ensure full coverage
  if (aspectRatio >= 0.9 && aspectRatio <= 1.1) {
    emojiSize = Math.max(faceBoxWidth, faceBoxHeight) * scale;
  }
  // Wide face - use height as size (emoji will be centered horizontally)
  else if (aspectRatio > 1.1) {
    emojiSize = faceBoxHeight * scale;
  }
  // Tall face - use width as size (emoji will be centered vertically)
  else {
    emojiSize = faceBoxWidth * scale;
  }

  // Calculate centering offsets
  const offsetX = (faceBoxWidth - emojiSize) / 2;
  const offsetY = (faceBoxHeight - emojiSize) / 2;

  return {
    width: emojiSize,
    height: emojiSize,
    offsetX,
    offsetY,
  };
}

export interface EmojiScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute the emoji's drawn rectangle for a face box, given an optional
 * user-dragged position offset. `box` and `offset` must already be in the
 * same coordinate space (callers pre-scale both for display canvases).
 * Shared by drawing and drag hit-testing so they never disagree.
 */
export function getEmojiScreenRect(
  box: { x: number; y: number; width: number; height: number },
  offset: { x: number; y: number },
  scale: number = 1
): EmojiScreenRect {
  const emojiSize = calculateEmojiSize(box.width, box.height, scale);
  return {
    x: box.x + emojiSize.offsetX + offset.x,
    y: box.y + emojiSize.offsetY + offset.y,
    width: emojiSize.width,
    height: emojiSize.height,
  };
}

/**
 * Draw a single emoji replacement onto a canvas context.
 *
 * @param ctx - Target 2D context
 * @param box - Face bounding box in the target canvas coordinate space
 *              (callers pre-scale it for display canvases)
 * @param offset - User-dragged position offset, in the same coordinate
 *                 space as `box` (callers pre-scale this too)
 * @param replacement - Replacement carrying the emoji character
 * @param globalScale - Global emoji size multiplier (shared by every face)
 * @param image - Preloaded Twemoji bitmap; pass null to render the native
 *                emoji glyph instead (CDN failure fallback)
 */
export function drawEmojiReplacement(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  offset: { x: number; y: number },
  replacement: Pick<EmojiReplacement, 'emoji'>,
  globalScale: number,
  image: HTMLImageElement | null
): void {
  const rect = getEmojiScreenRect(box, offset, globalScale);
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  ctx.save();
  ctx.translate(centerX, centerY);

  if (image) {
    ctx.drawImage(
      image,
      -rect.width / 2,
      -rect.height / 2,
      rect.width,
      rect.height
    );
  } else {
    // Native emoji glyph fallback
    const fontSize = rect.width * 0.8;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(replacement.emoji, 0, 0);
  }

  ctx.restore();
}
