/**
 * Core type definitions for No Face application
 */

// Face detection result from the MediaPipe FaceDetector Worker
export interface DetectedFace {
  id: string;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  detection: {
    score: number;
    classScore: number;
  };
}

// Emoji replacement data
export interface EmojiReplacement {
  faceId: string;
  emoji: string;
  emojiUrl: string;
  // User-dragged position adjustment, in original-image pixels, relative to
  // the emoji's auto-centered position. Callers scale this for display.
  offsetX?: number;
  offsetY?: number;
}

// Face detection settings
export interface DetectionSettings {
  minConfidence: number; // 0-1, the only user-adjustable detection parameter
}

// Model loading state (indeterminate: no fabricated percentage). `phase`
// reflects the Worker's 'wasm' | 'model' progress events and drives the
// loading modal's wording.
export interface ModelLoadingState {
  isLoading: boolean;
  phase: 'wasm' | 'model' | null;
}
