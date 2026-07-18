/**
 * Core type definitions for No Face application
 */

// Face detection result from face-api.js
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
  scale?: number;
  opacity?: number;
  flipX?: boolean;
  flipY?: boolean;
  // User-dragged position adjustment, in original-image pixels, relative to
  // the emoji's auto-centered position. Callers scale this for display.
  offsetX?: number;
  offsetY?: number;
  isCustom?: boolean;
}

// Face detection settings
export interface DetectionSettings {
  detector: 'ssd_mobilenetv1' | 'tiny_face_detector';
  minConfidence: number; // 0-1
  inputSize?: number; // for tiny_face_detector
  scoreThreshold?: number; // for tiny_face_detector
}

// Emoji settings
export interface EmojiSettings {
  scale: number; // 0.5-2.0, relative to face size
  opacity: number; // 0.5-1.0, emoji transparency
  flipX: boolean; // horizontal flip
  flipY: boolean; // vertical flip
}

// Model loading progress callback (indeterminate: no fabricated percentage)
export type ModelLoadingProgressCallback = (progress: {
  model: string;
  loaded: number;
  total: number;
}) => void;

// Model loading state
export interface ModelLoadingState {
  isLoading: boolean;
  currentModel: string;
  loadedModels: string[];
}
