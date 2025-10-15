/**
 * Emoji rendering utilities
 * Handles adaptive sizing to prevent emoji distortion
 */

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

/**
 * Apply user offset adjustments to calculated offsets
 * Note: User offset feature has been removed, this function is kept for backwards compatibility
 * @deprecated This function is no longer used and may be removed in future versions
 */
export function applyUserOffsets(
  calculatedOffsetX: number,
  calculatedOffsetY: number,
  userOffsetX: number = 0,
  userOffsetY: number = 0
): { offsetX: number; offsetY: number } {
  return {
    offsetX: calculatedOffsetX + userOffsetX,
    offsetY: calculatedOffsetY + userOffsetY,
  };
}
