import { RefObject, useEffect, useState } from 'react';
import { detectFacesWithWorker } from '@/lib/faceDetectorClient';
import { DetectedFace } from '@/types';

const MIN_DETECTION_INTERVAL_MS = 100;
const BOX_EMA_ALPHA = 0.35;
const TRACK_MATCH_IOU = 0.3;
const MAX_MISSED_DETECTIONS = 3;

interface TrackedFace extends DetectedFace {
  missedDetections: number;
}

export interface UseLiveDetectionOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  minConfidence: number;
}

export type LiveFaceTrack = DetectedFace;

export function getBoxIoU(a: DetectedFace['box'], b: DetectedFace['box']): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}

function blendBox(previous: DetectedFace['box'], next: DetectedFace['box']): DetectedFace['box'] {
  const blend = (from: number, to: number) => from + (to - from) * BOX_EMA_ALPHA;
  return {
    x: blend(previous.x, next.x),
    y: blend(previous.y, next.y),
    width: blend(previous.width, next.width),
    height: blend(previous.height, next.height),
  };
}

export function updateLiveFaceTracks(
  previous: TrackedFace[],
  detections: DetectedFace[],
  nextTrackId: number
): { tracks: TrackedFace[]; nextTrackId: number } {
  const remainingDetections = new Set(detections.map((_, index) => index));
  const tracks: TrackedFace[] = [];

  for (const track of previous) {
    let bestIndex = -1;
    let bestIoU = TRACK_MATCH_IOU;
    for (const index of remainingDetections) {
      const overlap = getBoxIoU(track.box, detections[index].box);
      if (overlap > bestIoU) {
        bestIoU = overlap;
        bestIndex = index;
      }
    }

    if (bestIndex >= 0) {
      const detection = detections[bestIndex];
      remainingDetections.delete(bestIndex);
      tracks.push({
        ...detection,
        id: track.id,
        box: blendBox(track.box, detection.box),
        missedDetections: 0,
      });
    } else if (track.missedDetections + 1 < MAX_MISSED_DETECTIONS) {
      tracks.push({ ...track, missedDetections: track.missedDetections + 1 });
    }
  }

  for (const index of remainingDetections) {
    tracks.push({ ...detections[index], id: `live-face-${nextTrackId++}`, missedDetections: 0 });
  }

  return { tracks, nextTrackId };
}

function toLiveFaceTrack({ id, box, detection }: TrackedFace): LiveFaceTrack {
  return { id, box, detection };
}

/**
 * Runs camera detection with natural backpressure: a subsequent request is
 * scheduled only after the previous worker result has settled.
 */
export function useLiveDetection({
  videoRef,
  enabled,
  minConfidence,
}: UseLiveDetectionOptions): LiveFaceTrack[] {
  const [faces, setFaces] = useState<LiveFaceTrack[]>([]);

  useEffect(() => {
    if (!enabled) {
      setFaces([]);
      return;
    }

    let cancelled = false;
    let generation = 0;
    let frameId: number | null = null;
    let inFlight = false;
    let lastDetectionAt = -Infinity;
    let nextTrackId = 0;
    let tracks: TrackedFace[] = [];
    const activeGeneration = ++generation;

    const schedule = () => {
      if (!cancelled) frameId = window.requestAnimationFrame(run);
    };

    const run = async (now: number) => {
      frameId = null;
      if (cancelled || inFlight) return;

      const video = videoRef.current;
      if (
        !video ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth === 0 ||
        video.videoHeight === 0 ||
        now - lastDetectionAt < MIN_DETECTION_INTERVAL_MS
      ) {
        schedule();
        return;
      }

      inFlight = true;
      lastDetectionAt = now;
      try {
        const detections = await detectFacesWithWorker(video, minConfidence);
        if (!cancelled && generation === activeGeneration) {
          const update = updateLiveFaceTracks(tracks, detections, nextTrackId);
          tracks = update.tracks;
          nextTrackId = update.nextTrackId;
          setFaces(tracks.map(toLiveFaceTrack));
        }
      } catch {
        // A transient worker failure should not keep an old request in flight.
      } finally {
        inFlight = false;
        if (!cancelled && generation === activeGeneration) schedule();
      }
    };

    schedule();
    return () => {
      cancelled = true;
      generation += 1;
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [enabled, minConfidence, videoRef]);

  return faces;
}
