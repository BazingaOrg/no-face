export type CameraErrorCode =
  | 'no-device'
  | 'permission-denied'
  | 'device-in-use'
  | 'unsupported'
  | 'unknown';

export class CameraStreamError extends Error {
  constructor(
    public readonly code: CameraErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'CameraStreamError';
  }
}

export interface CameraStream {
  stream: MediaStream;
  stop: () => void;
}

export function mapCameraError(error: unknown): CameraStreamError {
  if (error instanceof CameraStreamError) return error;

  const name = error instanceof Error ? error.name : '';
  switch (name) {
    case 'NotFoundError':
    case 'OverconstrainedError':
      return new CameraStreamError('no-device', 'No usable camera was found.', error);
    case 'NotAllowedError':
    case 'SecurityError':
      return new CameraStreamError('permission-denied', 'Camera permission was denied.', error);
    case 'NotReadableError':
    case 'AbortError':
      return new CameraStreamError('device-in-use', 'The camera is unavailable or in use.', error);
    case 'TypeError':
      return new CameraStreamError('unsupported', 'Camera access is not supported.', error);
    default:
      return new CameraStreamError('unknown', 'Unable to start the camera.', error);
  }
}

function getMediaDevices(): MediaDevices {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    throw new CameraStreamError('unsupported', 'Camera access is not supported.');
  }
  return navigator.mediaDevices;
}

/** Returns the video inputs currently exposed by the browser. */
export async function listVideoInputs(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await getMediaDevices().enumerateDevices();
    return devices.filter((device) => device.kind === 'videoinput');
  } catch (error) {
    throw mapCameraError(error);
  }
}

/** Starts a camera stream. Calling stop repeatedly is safe. */
export async function startCameraStream(deviceId?: string): Promise<CameraStream> {
  let stream: MediaStream;
  try {
    stream = await getMediaDevices().getUserMedia({
      video: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
  } catch (error) {
    throw mapCameraError(error);
  }

  let stopped = false;
  return {
    stream,
    stop() {
      if (stopped) return;
      stopped = true;
      stream.getTracks().forEach((track) => track.stop());
    },
  };
}
