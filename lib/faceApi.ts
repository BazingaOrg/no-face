/**
 * face-api.js initialization and utility functions
 * IMPORTANT: This module must only run in browser environment
 */

import type * as FaceApiType from '@vladmandic/face-api';
import { DetectedFace, DetectionSettings } from '@/types';

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

// Model CDN URL - using multiple fallbacks
const MODEL_URLS = [
  '/models', // Local models (preferred)
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/', // Fallback 1
  'https://justadudewhohacks.github.io/face-api.js/models', // Fallback 2 (original repo)
];

const MODEL_URL = MODEL_URLS[0]; // Use local models

let isModelsLoaded = false;
let areLandmarksLoaded = false;

/**
 * Load face detection models
 */
export async function loadModels(): Promise<void> {
  if (isModelsLoaded) return;

  const api = await getFaceApi();

  try {
    // Load core detection models (required)
    await Promise.all([
      api.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      api.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    ]);

    isModelsLoaded = true;

    // Try to load landmarks model (optional, for advanced features)
    try {
      await api.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      areLandmarksLoaded = true;
      console.log('✅ Face Landmarks 68 模型加载成功');
    } catch (error) {
      console.warn('⚠️ Face Landmarks 68 模型未找到，自动旋转功能将不可用');
      areLandmarksLoaded = false;
    }
  } catch {
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
  if (!isModelsLoaded) {
    await loadModels();
  }

  const api = await getFaceApi();

  try {
    let detections;

    // Select detector based on settings
    if (settings.detector === 'tiny_face_detector') {
      const options = new api.TinyFaceDetectorOptions({
        inputSize: settings.inputSize || 416,
        scoreThreshold: settings.scoreThreshold || 0.5,
      });
      detections = await api.detectAllFaces(input, options);
    } else {
      // Default: SSD MobileNet V1
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
  if (!isModelsLoaded) {
    await loadModels();
  }

  const api = await getFaceApi();

  try {
    let detections;

    // Select detector based on settings
    if (settings.detector === 'tiny_face_detector') {
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
