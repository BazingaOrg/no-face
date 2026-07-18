import { useCallback } from 'react';
import { DetectedFace } from '@/types';

// Fixed estimate of a badge's rendered size — good enough to keep it inside
// the canvas bounds without measuring every badge via ResizeObserver.
const BADGE_SIZE = {
  width: 120,
  height: 38,
};

interface UseFaceBadgeLayoutParams {
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
}

interface BadgePosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Simple label/dot layout: centers each badge above its face (or below, if
// that would clip off the top), clamped to stay within the canvas.
export function useFaceBadgeLayout({ canvasWidth, canvasHeight, scale }: UseFaceBadgeLayoutParams) {
  const getBadgePosition = useCallback(
    (face: DetectedFace): BadgePosition => {
      const padding = 8;
      const faceCenterX = (face.box.x + face.box.width / 2) * scale;
      const faceTop = face.box.y * scale;
      const faceBottom = (face.box.y + face.box.height) * scale;

      let left = faceCenterX - BADGE_SIZE.width / 2;
      let top = faceTop - BADGE_SIZE.height - 12;

      if (top < padding) {
        top = Math.min(faceBottom + 12, canvasHeight - BADGE_SIZE.height - padding);
      }

      left = Math.max(padding, Math.min(left, canvasWidth - BADGE_SIZE.width - padding));
      top = Math.max(padding, Math.min(top, canvasHeight - BADGE_SIZE.height - padding));

      return {
        top,
        left,
        width: BADGE_SIZE.width,
        height: BADGE_SIZE.height,
      };
    },
    [canvasHeight, canvasWidth, scale]
  );

  return {
    getBadgePosition,
  };
}
