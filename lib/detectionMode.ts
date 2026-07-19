import { DetectionMode } from '@/types';

// Confidence threshold per sensitivity tier. 'standard' matches the
// previous hardcoded default; 'relaxed' matches the previous automatic
// fallback threshold used when standard found nothing.
const MIN_CONFIDENCE_BY_MODE: Record<DetectionMode, number> = {
  relaxed: 0.3,
  standard: 0.5,
  strict: 0.7,
};

export function getMinConfidence(mode: DetectionMode): number {
  return MIN_CONFIDENCE_BY_MODE[mode];
}

// Only 'standard' retries at a lower threshold on an empty result — it's the
// only tier where 0.3 is a step *down* from the tier's own intent. 'relaxed'
// is already the lowest threshold, and 'strict' means the user explicitly
// wants fewer detections, so silently falling back would defeat that intent.
export function shouldRetryOnEmpty(mode: DetectionMode): boolean {
  return mode === 'standard';
}

export const RETRY_MIN_CONFIDENCE = MIN_CONFIDENCE_BY_MODE.relaxed;
