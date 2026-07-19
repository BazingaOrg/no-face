import { describe, expect, it } from 'vitest';
import { getMinConfidence, shouldRetryOnEmpty, RETRY_MIN_CONFIDENCE } from './detectionMode';

describe('getMinConfidence', () => {
  it('returns the documented threshold for each mode', () => {
    expect(getMinConfidence('relaxed')).toBe(0.3);
    expect(getMinConfidence('standard')).toBe(0.5);
    expect(getMinConfidence('strict')).toBe(0.7);
  });
});

describe('shouldRetryOnEmpty', () => {
  it('is true only for standard', () => {
    expect(shouldRetryOnEmpty('relaxed')).toBe(false);
    expect(shouldRetryOnEmpty('standard')).toBe(true);
    expect(shouldRetryOnEmpty('strict')).toBe(false);
  });
});

describe('RETRY_MIN_CONFIDENCE', () => {
  it('matches the relaxed threshold', () => {
    expect(RETRY_MIN_CONFIDENCE).toBe(getMinConfidence('relaxed'));
  });
});
