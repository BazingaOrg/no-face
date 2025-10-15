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
let loadedModels = {
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
 * Load SSD MobileNet V1 model (primary detector)
 */
export async function loadSSDModel(): Promise<void> {
  if (progressCallback) {
    progressCallback({
      model: 'ssdMobilenetv1',
      loaded: 0,
      total: 1,
      percentage: 0,
    });
  }

  await loadSpecificModel('ssdMobilenetv1');
  isModelsLoaded = true; // Mark as loaded for legacy compatibility

  if (progressCallback) {
    progressCallback({
      model: 'ssdMobilenetv1',
      loaded: 1,
      total: 1,
      percentage: 100,
    });
  }
}

/**
 * Load Tiny Face Detector model
 */
export async function loadTinyModel(silent = false): Promise<void> {
  if (!silent && progressCallback) {
    progressCallback({
      model: 'tinyFaceDetector',
      loaded: 0,
      total: 1,
      percentage: 0,
    });
  }

  await loadSpecificModel('tinyFaceDetector');

  if (!silent && progressCallback) {
    progressCallback({
      model: 'tinyFaceDetector',
      loaded: 1,
      total: 1,
      percentage: 100,
    });
  }
}

/**
 * Load Face Landmarks 68 model
 */
export async function loadLandmarksModel(silent = false): Promise<void> {
  if (!silent && progressCallback) {
    progressCallback({
      model: 'faceLandmark68Net',
      loaded: 0,
      total: 1,
      percentage: 0,
    });
  }

  try {
    await loadSpecificModel('faceLandmark68Net');
    console.log('✅ Face Landmarks 68 模型加载成功');
  } catch (error) {
    console.warn('⚠️ Face Landmarks 68 模型未找到，自动旋转功能将不可用');
  }

  if (!silent && progressCallback) {
    progressCallback({
      model: 'faceLandmark68Net',
      loaded: 1,
      total: 1,
      percentage: 100,
    });
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

  const api = await getFaceApi();

  try {
    const modelsToLoad: string[] = [];
    let currentProgress = 0;
    const totalModels = 3; // ssd, tiny, landmarks
    
    // Helper to report progress
    const reportProgress = (modelName: string, percentage: number) => {
      if (progressCallback) {
        progressCallback({
          model: modelName,
          loaded: modelsToLoad.length,
          total: totalModels,
          percentage,
        });
      }
    };

    // Load SSD MobileNet V1 (primary detector)
    reportProgress('ssdMobilenetv1', 0);
    await loadSpecificModel('ssdMobilenetv1');
    modelsToLoad.push('ssdMobilenetv1');
    currentProgress = (modelsToLoad.length / totalModels) * 100;
    reportProgress('ssdMobilenetv1', currentProgress);

    // Load Tiny Face Detector
    reportProgress('tinyFaceDetector', currentProgress);
    await loadSpecificModel('tinyFaceDetector');
    modelsToLoad.push('tinyFaceDetector');
    currentProgress = (modelsToLoad.length / totalModels) * 100;
    reportProgress('tinyFaceDetector', currentProgress);

    isModelsLoaded = true;

    // Try to load landmarks model (optional, for advanced features)
    try {
      reportProgress('faceLandmark68Net', currentProgress);
      await loadSpecificModel('faceLandmark68Net');
      modelsToLoad.push('faceLandmark68Net');
      reportProgress('faceLandmark68Net', 100);
      console.log('✅ Face Landmarks 68 模型加载成功');
    } catch (error) {
      console.warn('⚠️ Face Landmarks 68 模型未找到，自动旋转功能将不可用');
      modelsToLoad.push('faceLandmark68Net'); // Mark as attempted
      reportProgress('faceLandmark68Net', 100);
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
    return detections.map((detection, index) => {
      const face: DetectedFace = {
        id: `face-${Date.now()}-${index}`,
        box: {
          x: detection.detection.box.x,
          y: detection.detection.box.y,
          width: detection.detection.box.width,
          height: detection.detection.box.height,
        },
        detection: {
          score: detection.detection.score,
          classScore: detection.detection.classScore,
        },
      };

      // Add landmarks if available
      if ('landmarks' in detection && detection.landmarks) {
        // Store landmarks for auto-rotation calculation
        (face as any).landmarks = detection.landmarks;
      }

      return face;
    });
  } catch {
    throw new Error('Face detection failed');
  }
}
