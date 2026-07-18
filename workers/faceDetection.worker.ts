/**
 * Face detection Worker.
 *
 * Runs MediaPipe's FaceDetector (full-range BlazeFace) entirely off the main
 * thread. WASM runtime and the .task model are both self-hosted (see
 * MODELS_SETUP.md) — no CDN access at runtime, matching the app's privacy
 * guarantee.
 *
 * Message protocol (see docs/plans/2026-07-18-mediapipe-worker-migration.md §2.3):
 *   main -> worker: { type: 'init' }
 *                   { type: 'detect', id, bitmap, minConfidence }
 *                   { type: 'dispose' }
 *   worker -> main: { type: 'ready' }
 *                   { type: 'progress', phase: 'wasm' | 'model' }
 *                   { type: 'result', id, detections }
 *                   { type: 'error', id?, code, message }
 *
 * The detector is created once with a fixed low confidence threshold
 * (MIN_DETECTOR_CONFIDENCE) so the caller can filter by score per-request
 * without ever needing to rebuild the detector.
 */
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

export interface WorkerDetection {
  box: { x: number; y: number; width: number; height: number };
  score: number;
}

type MainToWorkerMessage =
  | { type: 'init' }
  | { type: 'detect'; id: number; bitmap: ImageBitmap; minConfidence: number }
  | { type: 'dispose' };

type WorkerToMainMessage =
  | { type: 'ready' }
  | { type: 'progress'; phase: 'wasm' | 'model' }
  | { type: 'result'; id: number; detections: WorkerDetection[] }
  | { type: 'error'; id?: number; code: string; message: string };

// Fixed low threshold at detector-creation time; real filtering happens on
// the main thread against the user-adjustable sensitivity slider.
const MIN_DETECTOR_CONFIDENCE = 0.1;

const WASM_BASE_PATH = '/mediapipe/wasm';
const MODEL_ASSET_PATH = '/models/blaze_face_full_range.task';

let detector: FaceDetector | null = null;
let initPromise: Promise<void> | null = null;

function post(message: WorkerToMainMessage, transfer: Transferable[] = []) {
  (self as unknown as Worker).postMessage(message, transfer);
}

async function createDetector(delegate: 'GPU' | 'CPU'): Promise<FaceDetector> {
  post({ type: 'progress', phase: 'wasm' });
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);

  post({ type: 'progress', phase: 'model' });
  return FaceDetector.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: MODEL_ASSET_PATH,
      delegate,
    },
    runningMode: 'IMAGE',
    minDetectionConfidence: MIN_DETECTOR_CONFIDENCE,
  });
}

async function initDetector(): Promise<void> {
  try {
    detector = await createDetector('GPU');
  } catch (gpuError) {
    console.warn('[faceDetection.worker] GPU delegate failed, falling back to CPU:', gpuError);
    detector = await createDetector('CPU');
  }
  post({ type: 'ready' });
}

function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = initDetector();
  }
  return initPromise;
}

async function handleDetect(id: number, bitmap: ImageBitmap, minConfidence: number) {
  try {
    await ensureInit();
    if (!detector) throw new Error('Detector not initialised');

    const result = detector.detect(bitmap);

    const detections: WorkerDetection[] = result.detections
      .filter((detection) => (detection.categories[0]?.score ?? 0) >= minConfidence)
      .map((detection) => ({
        box: {
          x: detection.boundingBox?.originX ?? 0,
          y: detection.boundingBox?.originY ?? 0,
          width: detection.boundingBox?.width ?? 0,
          height: detection.boundingBox?.height ?? 0,
        },
        score: detection.categories[0]?.score ?? 0,
      }));

    post({ type: 'result', id, detections });
  } catch (error) {
    post({
      type: 'error',
      id,
      code: 'detect_failed',
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    bitmap.close();
  }
}

self.addEventListener('message', (event: MessageEvent<MainToWorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case 'init':
      ensureInit().catch((error) => {
        post({
          type: 'error',
          code: 'init_failed',
          message: error instanceof Error ? error.message : String(error),
        });
      });
      break;
    case 'detect':
      handleDetect(message.id, message.bitmap, message.minConfidence);
      break;
    case 'dispose':
      detector?.close();
      detector = null;
      initPromise = null;
      break;
  }
});
