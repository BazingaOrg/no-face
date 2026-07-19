import { describe, expect, it } from 'vitest';
import { mapCameraError } from './cameraStream';

describe('mapCameraError', () => {
  it.each([
    ['NotFoundError', 'no-device'],
    ['OverconstrainedError', 'no-device'],
    ['NotAllowedError', 'permission-denied'],
    ['SecurityError', 'permission-denied'],
    ['NotReadableError', 'device-in-use'],
    ['AbortError', 'device-in-use'],
  ] as const)('maps %s to %s', (name, code) => {
    expect(mapCameraError(new DOMException('camera error', name)).code).toBe(code);
  });

  it('maps unsupported and unexpected failures', () => {
    expect(mapCameraError(new TypeError('camera error')).code).toBe('unsupported');
    expect(mapCameraError(new Error('camera error')).code).toBe('unknown');
  });
});
