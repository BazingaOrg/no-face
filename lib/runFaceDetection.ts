import { areLandmarksAvailable, detectFacesWithLandmarks } from '@/lib/faceApi';
import { DetectionSettings, DetectedFace } from '@/types';
import { mapCoordinatesToOriginal } from '@/utils/imageOptimization';

export interface RunFaceDetectionOptions {
  input: HTMLImageElement | HTMLCanvasElement;
  settings: DetectionSettings;
  scale?: number;
}

export interface RunFaceDetectionResult {
  faces: DetectedFace[];
  hasLandmarks: boolean;
  faceCount: number;
  isEmpty: boolean;
}

/**
 * Runs face detection against the provided input and normalises the result.
 * Automatically maps bounding boxes back to their original dimensions when a scale factor is supplied.
 */
export async function runFaceDetection({
  input,
  settings,
  scale = 1,
}: RunFaceDetectionOptions): Promise<RunFaceDetectionResult> {
  const detectedFaces = await detectFacesWithLandmarks(input, settings);

  const faces =
    scale < 1
      ? detectedFaces.map((face) => ({
          ...face,
          box: mapCoordinatesToOriginal(face.box, scale),
        }))
      : detectedFaces;

  const faceCount = faces.length;
  const hasLandmarks = areLandmarksAvailable();

  return {
    faces,
    hasLandmarks,
    faceCount,
    isEmpty: faceCount === 0,
  };
}
