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
 * Simulate progressive loading with smooth progress updates
 * Creates a more natural loading experience
 */
async function simulateProgressiveLoading(
  modelName: string,
  startProgress: number,
  targetProgress: number,
  actualLoadPromise: Promise<void>
): Promise<void> {
  let currentProgress = startProgress;
  const progressIncrement = 2; // Increment by 2% each step
  const updateInterval = 100; // Update every 100ms

  // Start progress simulation
  const progressInterval = setInterval(() => {
    if (currentProgress < targetProgress - 5) {
      // Slow down as we approach target (simulate real download curve)
      const remaining = targetProgress - currentProgress;
      const increment = Math.max(0.5, progressIncrement * (remaining / 30));
      currentProgress = Math.min(currentProgress + increment, targetProgress - 5);

      if (progressCallback) {
        progressCallback({
          model: modelName,
          loaded: 0,
          total: 1,
          percentage: Math.round(currentProgress),
        });
      }
    }
  }, updateInterval);

  try {
    // Wait for actual model loading
    await actualLoadPromise;

    // Clear interval and jump to 100%
    clearInterval(progressInterval);

    if (progressCallback) {
      progressCallback({
        model: modelName,
        loaded: 1,
        total: 1,
        percentage: targetProgress,
      });
    }
  } catch (error) {
    clearInterval(progressInterval);
    throw error;
  }
}

/**
 * Load SSD MobileNet V1 model (primary detector)
 */
export async function loadSSDModel(): Promise<void> {
  await simulateProgressiveLoading(
    'ssdMobilenetv1',
    0,
    100,
    loadSpecificModel('ssdMobilenetv1')
  );
}

/**
 * Load Tiny Face Detector model
 */
export async function loadTinyModel(silent = false): Promise<void> {
  if (silent) {
    // Silent mode: load without progress updates
    await loadSpecificModel('tinyFaceDetector');
  } else {
    // With progress simulation
    await simulateProgressiveLoading(
      'tinyFaceDetector',
      0,
      100,
      loadSpecificModel('tinyFaceDetector')
    );
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
