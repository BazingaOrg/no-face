/**
 * face-api.js initialization and utility functions
 * IMPORTANT: This module must only run in browser environment
 */

import type * as FaceApiType from '@vladmandic/face-api';
import { DetectedFace, DetectionSettings, ModelLoadingProgressCallback } from '@/types';

// Lazy import face-api only in browser
let faceapi: typeof FaceApiType | null = null;

async function getFaceApi() {
  if (typeof window === 'undefined') {
    throw new Error('face-api.js can only be used in browser environment');
  }
  if (!faceapi) {
    faceapi = await import('@vladmandic/face-api');
  }
  return faceapi;
}

// Progress callback reference
let progressCallback: ModelLoadingProgressCallback | null = null;

export function setModelLoadingProgressCallback(callback: ModelLoadingProgressCallback | null) {
  progressCallback = callback;
}

// Model CDN URL - using multiple fallbacks
const MODEL_URLS = [
  '/models', // Local models (preferred)
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/', // Fallback 1
  'https://justadudewhohacks.github.io/face-api.js/models', // Fallback 2 (original repo)
];

const MODEL_URL = MODEL_URLS[0]; // Use local models

// Track individual model loading states
const loadedModels = {
  ssdMobilenetv1: false,
  tinyFaceDetector: false,
};

/**
 * Load a specific model
 */
async function loadSpecificModel(modelName: 'ssdMobilenetv1' | 'tinyFaceDetector'): Promise<void> {
  if (loadedModels[modelName]) return;

  const api = await getFaceApi();

  try {
    switch (modelName) {
      case 'ssdMobilenetv1':
        await api.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        loadedModels.ssdMobilenetv1 = true;
        break;
      case 'tinyFaceDetector':
        await api.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        loadedModels.tinyFaceDetector = true;
        break;
    }
  } catch (error) {
    console.error(`Failed to load ${modelName}:`, error);
    throw new Error(`Failed to load ${modelName}`);
  }
}

/**
 * Load SSD MobileNet V1 model (primary detector)
 */
export async function loadSSDModel(): Promise<void> {
  if (progressCallback) {
    progressCallback({ model: 'ssdMobilenetv1', loaded: 0, total: 1 });
  }
  await loadSpecificModel('ssdMobilenetv1');
  if (progressCallback) {
    progressCallback({ model: 'ssdMobilenetv1', loaded: 1, total: 1 });
  }
}

/**
 * Load Tiny Face Detector model
 */
export async function loadTinyModel(silent = false): Promise<void> {
  if (silent) {
    // Silent mode: load without progress updates
    await loadSpecificModel('tinyFaceDetector');
  } else {
    if (progressCallback) {
      progressCallback({ model: 'tinyFaceDetector', loaded: 0, total: 1 });
    }
    await loadSpecificModel('tinyFaceDetector');
    if (progressCallback) {
      progressCallback({ model: 'tinyFaceDetector', loaded: 1, total: 1 });
    }
  }
}

/**
 * Check if a specific model is loaded
 */
export function isModelLoaded(modelName: 'ssdMobilenetv1' | 'tinyFaceDetector'): boolean {
  return loadedModels[modelName];
}

/**
 * Detect faces in the given input using the configured detector.
 */
export async function detectFaces(
  input: HTMLImageElement | HTMLCanvasElement,
  settings: DetectionSettings
): Promise<DetectedFace[]> {
  const api = await getFaceApi();

  try {
    let detections;

    // Select detector based on settings and ensure model is loaded
    if (settings.detector === 'tiny_face_detector') {
      // Ensure Tiny Face Detector is loaded
      if (!loadedModels.tinyFaceDetector) {
        await loadTinyModel(true); // Silent load
      }

      const options = new api.TinyFaceDetectorOptions({
        inputSize: settings.inputSize || 416,
        scoreThreshold: settings.scoreThreshold || 0.5,
      });

      detections = await api.detectAllFaces(input, options);
    } else {
      // Default: SSD MobileNet V1
      if (!loadedModels.ssdMobilenetv1) {
        await loadSSDModel();
      }

      const options = new api.SsdMobilenetv1Options({
        minConfidence: settings.minConfidence || 0.5,
      });

      detections = await api.detectAllFaces(input, options);
    }

    // Convert to our DetectedFace format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return detections.map((detection: any, index: number) => ({
      id: `face-${Date.now()}-${index}`,
      box: {
        x: detection.box.x,
        y: detection.box.y,
        width: detection.box.width,
        height: detection.box.height,
      },
      detection: {
        score: detection.score,
        classScore: detection.classScore,
      },
    }));
  } catch (error) {
    console.error('Face detection error:', error);
    throw new Error('Face detection failed');
  }
}
