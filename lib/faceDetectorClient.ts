/**
 * Main-thread client for the face detection Worker (workers/faceDetection.worker.ts).
 *
 * Owns the Worker's lifecycle (lazy start, `init`, `dispose`), turns the
 * bitmap-transfer + id-tagged message protocol into a Promise-based
 * `detect()` call, and converts the worker's raw detections into this app's
 * `DetectedFace` shape.
 */
import { DetectedFace } from '@/types';

export type FaceDetectorProgressPhase = 'wasm' | 'model';
export type FaceDetectorProgressCallback = (phase: FaceDetectorProgressPhase) => void;

interface WorkerDetection {
  box: { x: number; y: number; width: number; height: number };
  score: number;
}

type WorkerToMainMessage =
  | { type: 'ready' }
  | { type: 'progress'; phase: FaceDetectorProgressPhase }
  | { type: 'result'; id: number; detections: WorkerDetection[] }
  | { type: 'error'; id?: number; code: string; message: string };

let worker: Worker | null = null;
let readyPromise: Promise<void> | null = null;
let resolveReady: (() => void) | null = null;
let rejectReady: ((error: Error) => void) | null = null;
let nextRequestId = 0;

const pendingDetections = new Map<
  number,
  { resolve: (faces: DetectedFace[]) => void; reject: (error: Error) => void }
>();

let progressCallback: FaceDetectorProgressCallback | null = null;

export function setFaceDetectorProgressCallback(callback: FaceDetectorProgressCallback | null) {
  progressCallback = callback;
}

function toDetectedFaces(detections: WorkerDetection[]): DetectedFace[] {
  return detections.map((detection, index) => ({
    id: `face-${Date.now()}-${index}`,
    box: detection.box,
    // MediaPipe only exposes one confidence value; classScore has no
    // equivalent so it's filled with the same score to keep DetectedFace's
    // shape unchanged for downstream consumers.
    detection: { score: detection.score, classScore: detection.score },
  }));
}

function handleWorkerMessage(event: MessageEvent<WorkerToMainMessage>) {
  const message = event.data;

  switch (message.type) {
    case 'ready':
      resolveReady?.();
      break;
    case 'progress':
      progressCallback?.(message.phase);
      break;
    case 'result': {
      const pending = pendingDetections.get(message.id);
      if (pending) {
        pendingDetections.delete(message.id);
        pending.resolve(toDetectedFaces(message.detections));
      }
      break;
    }
    case 'error': {
      const error = new Error(`[${message.code}] ${message.message}`);
      if (message.id !== undefined) {
        const pending = pendingDetections.get(message.id);
        if (pending) {
          pendingDetections.delete(message.id);
          pending.reject(error);
        }
      } else {
        // init failure: reject the shared ready promise
        rejectReady?.(error);
      }
      break;
    }
  }
}

function getWorker(): Worker {
  if (typeof window === 'undefined') {
    throw new Error('Face detector client can only run in the browser');
  }
  if (!worker) {
    worker = new Worker(new URL('../workers/faceDetection.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener('message', handleWorkerMessage);
    worker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'Face detection worker crashed');
      rejectReady?.(error);
      pendingDetections.forEach(({ reject }) => reject(error));
      pendingDetections.clear();
    });
  }
  return worker;
}

/**
 * Starts the worker (if needed) and waits for the detector to be ready
 * (WASM runtime + model loaded, GPU delegate attempted with CPU fallback).
 * Safe to call multiple times — subsequent calls reuse the same promise.
 */
export function initFaceDetector(): Promise<void> {
  if (!readyPromise) {
    readyPromise = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    getWorker().postMessage({ type: 'init' });
  }
  return readyPromise;
}

/**
 * Detects faces in the given input. `init()` must have resolved first (or
 * this awaits it internally, but callers should call `initFaceDetector()`
 * up front so the loading UI can reflect it).
 */
export async function detectFacesWithWorker(
  input: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
  minConfidence: number
): Promise<DetectedFace[]> {
  await initFaceDetector();

  const bitmap = await createImageBitmap(input);
  const id = nextRequestId++;

  return new Promise<DetectedFace[]>((resolve, reject) => {
    pendingDetections.set(id, { resolve, reject });
    getWorker().postMessage({ type: 'detect', id, bitmap, minConfidence }, [bitmap]);
  });
}

/** Tears down the worker and its detector, releasing WASM/GPU resources. */
export function disposeFaceDetector(): void {
  worker?.postMessage({ type: 'dispose' });
  worker?.terminate();
  worker = null;
  readyPromise = null;
  resolveReady = null;
  rejectReady = null;
  pendingDetections.clear();
}
