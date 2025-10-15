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
  faceLandmark68Net: false,
};

// Legacy flags for backwards compatibility
let isModelsLoaded = false;
let areLandmarksLoaded = false;

/**
 * Load a specific model
 */
async function loadSpecificModel(modelName: 'ssdMobilenetv1' | 'tinyFaceDetector' | 'faceLandmark68Net'): Promise<void> {
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
      case 'faceLandmark68Net':
        await api.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        loadedModels.faceLandmark68Net = true;
        areLandmarksLoaded = true;
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

  isModelsLoaded = true; // Mark as loaded for legacy compatibility
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
    console.log('✅ Tiny Face Detector 已在后台加载完成');
  }
}

/**
 * Load Face Landmarks 68 model
 */
export async function loadLandmarksModel(silent = false): Promise<void> {
  if (silent) {
    // Silent mode: load without progress updates
    try {
      await loadSpecificModel('faceLandmark68Net');
    } catch {
      console.warn('⚠️ Face Landmarks 68 模型未找到，自动旋转功能将不可用');
    }
  } else {
    // With progress simulation
    try {
      await simulateProgressiveLoading(
        'faceLandmark68Net',
        0,
        100,
        loadSpecificModel('faceLandmark68Net')
      );
      console.log('✅ Face Landmarks 68 模型加载成功');
    } catch {
      console.warn('⚠️ Face Landmarks 68 模型未找到，自动旋转功能将不可用');
      // Still report 100% to close the loading modal
      if (progressCallback) {
        progressCallback({
          model: 'faceLandmark68Net',
          loaded: 1,
          total: 1,
          percentage: 100,
        });
      }
    }
  }
}

/**
 * Check if a specific model is loaded
 */
export function isModelLoaded(modelName: 'ssdMobilenetv1' | 'tinyFaceDetector' | 'faceLandmark68Net'): boolean {
  return loadedModels[modelName];
}

/**
 * Load face detection models with progress tracking (legacy - loads all models)
 * @deprecated Use loadSSDModel, loadTinyModel, loadLandmarksModel instead for progressive loading
 */
export async function loadModels(): Promise<void> {
  if (isModelsLoaded) return;

  // Ensure face-api is loaded
  await getFaceApi();

  try {
    // Load SSD MobileNet V1 (primary detector) - 0% to 33%
    await simulateProgressiveLoading(
      'ssdMobilenetv1',
      0,
      33,
      loadSpecificModel('ssdMobilenetv1')
    );

    // Load Tiny Face Detector - 33% to 67%
    await simulateProgressiveLoading(
      'tinyFaceDetector',
      33,
      67,
      loadSpecificModel('tinyFaceDetector')
    );

    isModelsLoaded = true;

    // Try to load landmarks model (optional, for advanced features) - 67% to 100%
    try {
      await simulateProgressiveLoading(
        'faceLandmark68Net',
        67,
        100,
        loadSpecificModel('faceLandmark68Net')
      );
      console.log('✅ Face Landmarks 68 模型加载成功');
    } catch {
      console.warn('⚠️ Face Landmarks 68 模型未找到，自动旋转功能将不可用');
      // Still report 100% to close the loading modal
      if (progressCallback) {
        progressCallback({
          model: 'faceLandmark68Net',
          loaded: 3,
          total: 3,
          percentage: 100,
        });
      }
    }
  } catch (error) {
    console.error('模型加载失败:', error);
    throw new Error('Failed to load face detection models');
  }
}

/**
 * Detect faces in an image
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
    return detections.map((detection, index) => ({
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
  } catch {
    throw new Error('Face detection failed');
  }
}

/**
 * Check if models are loaded
 */
export function areModelsLoaded(): boolean {
  return isModelsLoaded;
}

/**
 * Check if landmarks model is loaded
 */
export function areLandmarksAvailable(): boolean {
  return areLandmarksLoaded;
}

/**
 * Detect faces with landmarks (if available)
 * Returns faces with landmarks for auto-rotation feature
 */
export async function detectFacesWithLandmarks(
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

      if (areLandmarksLoaded) {
        detections = await api.detectAllFaces(input, options).withFaceLandmarks();
      } else {
        detections = await api.detectAllFaces(input, options);
      }
    } else {
      // Default: SSD MobileNet V1
      if (!loadedModels.ssdMobilenetv1) {
        await loadSSDModel();
      }

      const options = new api.SsdMobilenetv1Options({
        minConfidence: settings.minConfidence || 0.5,
      });

      if (areLandmarksLoaded) {
        detections = await api.detectAllFaces(input, options).withFaceLandmarks();
      } else {
        detections = await api.detectAllFaces(input, options);
      }
    }

    // Convert to our DetectedFace format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return detections.map((detection: any, index: number) => {
      // Check if detection has landmarks (nested structure) or not (flat structure)
      const hasLandmarks = 'landmarks' in detection && detection.landmarks;
      const detectionBox = hasLandmarks ? detection.detection.box : detection.box;
      const detectionScore = hasLandmarks ? detection.detection : detection;

      const face: DetectedFace = {
        id: `face-${Date.now()}-${index}`,
        box: {
          x: detectionBox.x,
          y: detectionBox.y,
          width: detectionBox.width,
          height: detectionBox.height,
        },
        detection: {
          score: detectionScore.score,
          classScore: detectionScore.classScore,
        },
      };

      // Add landmarks if available
      if (hasLandmarks) {
        // Store landmarks for auto-rotation calculation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (face as any).landmarks = detection.landmarks;
      }

      return face;
    });
  } catch (error) {
    console.error('Face detection error:', error);
    throw new Error('Face detection failed');
  }
}
