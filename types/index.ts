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
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scale?: number;
  opacity?: number;
  offsetX?: number;
  offsetY?: number;
  flipX?: boolean;
  flipY?: boolean;
}

// Face detection settings
export interface DetectionSettings {
  detector: 'ssd_mobilenetv1' | 'tiny_face_detector' | 'mtcnn';
  minConfidence: number; // 0-1
  inputSize?: number; // for tiny_face_detector
  scoreThreshold?: number; // for tiny_face_detector
}

// Emoji settings
export interface EmojiSettings {
  size: '36x36' | '72x72';
  scale: number; // 0.5-2.0, relative to face size
  opacity: number; // 0.5-1.0, emoji transparency
  offsetX: number; // -20 to 20, horizontal offset in pixels
  offsetY: number; // -20 to 20, vertical offset in pixels
  flipX: boolean; // horizontal flip
  flipY: boolean; // vertical flip
}

// Application state
export interface AppState {
  image: HTMLImageElement | null;
  detectedFaces: DetectedFace[];
  replacements: EmojiReplacement[];
  selectedEmoji: string | null;
  settings: {
    detection: DetectionSettings;
    emoji: EmojiSettings;
  };
  isProcessing: boolean;
  error: string | null;
}

// Canvas dimensions
export interface CanvasDimensions {
  width: number;
  height: number;
  scale: number; // display scale vs original
}
