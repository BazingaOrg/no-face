'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { m } from 'framer-motion';
import { startCameraStream, listVideoInputs, mapCameraError, type CameraStreamError } from '@/lib/cameraStream';
import { useLiveDetection } from '@/hooks/useLiveDetection';
import { drawEmojiReplacement } from '@/lib/emojiRenderUtils';
import { getLoadedEmojiImage, loadEmojiImage } from '@/lib/emojiImageCache';
import { getTwemojiUrl } from '@/lib/twemoji';
import { POPULAR_EMOJIS } from '@/lib/emojiSearch';
import { getMinConfidence } from '@/lib/detectionMode';
import type { DetectionMode } from '@/types';
import { useI18n } from '@/lib/i18n';

interface LiveCameraViewProps {
  selectedEmoji: string | null;
  emojiSize: number;
  detectionMode: DetectionMode;
  onCapture: (image: HTMLImageElement, fileSize: number) => void;
  onExit: () => void;
}

const DEFAULT_LIVE_EMOJI = POPULAR_EMOJIS[0] ?? '😎';

function waitForPlayableVideo(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onReady = () => cleanup(resolve);
    const onError = () => cleanup(() => reject(new Error('Video preview could not start.')));
    const cleanup = (done: () => void) => {
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('error', onError);
      done();
    };
    video.addEventListener('loadeddata', onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

export default function LiveCameraView({
  selectedEmoji,
  emojiSize,
  detectionMode,
  onCapture,
  onExit,
}: LiveCameraViewProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamStopRef = useRef<(() => void) | null>(null);
  const requestGenerationRef = useRef(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [requesting, setRequesting] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<CameraStreamError | null>(null);
  const [videoSize, setVideoSize] = useState({ width: 16, height: 9 });
  const [emojiLoadTick, setEmojiLoadTick] = useState(0);

  const faces = useLiveDetection({
    videoRef,
    enabled: streaming,
    minConfidence: getMinConfidence(detectionMode),
  });
  const emoji = selectedEmoji ?? DEFAULT_LIVE_EMOJI;
  const emojiUrl = getTwemojiUrl(emoji);

  const refreshDevices = useCallback(async () => {
    try {
      const nextDevices = await listVideoInputs();
      setDevices(nextDevices);
      setSelectedDeviceId((current) => current || nextDevices[0]?.deviceId || '');
    } catch {
      // The entry was already capability-checked; a late enumeration failure
      // only means the optional device picker cannot be populated.
    }
  }, []);

  const stopCurrentStream = useCallback(() => {
    streamStopRef.current?.();
    streamStopRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setStreaming(false);
  }, []);

  const startStream = useCallback(async (deviceId?: string) => {
    const generation = ++requestGenerationRef.current;
    let nextStop: (() => void) | null = null;
    // Keep the old preview intact if getUserMedia fails before a new source
    // has ever been attached (for example, when another app grabs a device).
    const previousSource: MediaProvider | null = videoRef.current?.srcObject ?? null;
    setError(null);
    if (streamStopRef.current) setSwitching(true);
    else setRequesting(true);

    try {
      const camera = await startCameraStream(deviceId);
      nextStop = camera.stop;
      const video = videoRef.current;
      if (!video || generation !== requestGenerationRef.current) {
        camera.stop();
        return;
      }

      const previousStop = streamStopRef.current;
      video.srcObject = camera.stream;
      await video.play();
      await waitForPlayableVideo(video);
      if (generation !== requestGenerationRef.current) {
        camera.stop();
        return;
      }

      previousStop?.();
      streamStopRef.current = camera.stop;
      const activeDeviceId = camera.stream.getVideoTracks()[0]?.getSettings().deviceId;
      setSelectedDeviceId(deviceId ?? activeDeviceId ?? '');
      setVideoSize({ width: video.videoWidth, height: video.videoHeight });
      setStreaming(true);
      void refreshDevices();
    } catch (cause) {
      nextStop?.();
      if (generation === requestGenerationRef.current) {
        const video = videoRef.current;
        if (video) {
          video.srcObject = previousSource;
          void video.play().catch(() => {});
        }
        setError(mapCameraError(cause));
      }
    } finally {
      if (generation === requestGenerationRef.current) {
        setRequesting(false);
        setSwitching(false);
      }
    }
  }, [refreshDevices]);

  useEffect(() => {
    void refreshDevices();
    void startStream();
    return () => {
      requestGenerationRef.current += 1;
      stopCurrentStream();
    };
  }, [refreshDevices, startStream, stopCurrentStream]);

  useEffect(() => {
    if (!streaming) return;
    const image = getLoadedEmojiImage(emojiUrl);
    if (!image) {
      void loadEmojiImage(emojiUrl).then(() => setEmojiLoadTick((tick) => tick + 1)).catch(() => {});
    }
  }, [emojiUrl, streaming]);

  useEffect(() => {
    if (!streaming) return;
    let frameId = 0;
    const render = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.videoWidth && video.videoHeight) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          setVideoSize({ width: video.videoWidth, height: video.videoHeight });
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const image = getLoadedEmojiImage(emojiUrl);
          for (const face of faces) {
            drawEmojiReplacement(
              ctx,
              { ...face.box, x: video.videoWidth - face.box.x - face.box.width },
              { x: 0, y: 0 },
              { emoji },
              emojiSize,
              image
            );
          }
        }
      }
      frameId = requestAnimationFrame(render);
    };
    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [emoji, emojiLoadTick, emojiSize, faces, streaming, emojiUrl]);

  const handleDeviceChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = event.target.value;
    setSelectedDeviceId(deviceId);
    void startStream(deviceId);
  }, [startStream]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const snapshot = document.createElement('canvas');
    snapshot.width = video.videoWidth;
    snapshot.height = video.videoHeight;
    snapshot.getContext('2d')?.drawImage(video, 0, 0, snapshot.width, snapshot.height);
    requestGenerationRef.current += 1;
    stopCurrentStream();
    snapshot.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        onCapture(image, blob.size);
      };
      image.onerror = () => URL.revokeObjectURL(url);
      image.src = url;
    }, 'image/png');
  }, [onCapture, stopCurrentStream]);

  const errorMessage = error ? t.camera.errors[error.code] : null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-slate-950 shadow-xl" style={{ aspectRatio: `${videoSize.width} / ${videoSize.height}` }}>
        <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-contain -scale-x-100" />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-contain pointer-events-none" />
        {(requesting || switching) && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-white font-bold">
            {t.camera.connecting}
          </div>
        )}
        {errorMessage && (
          <div role="alert" className="absolute inset-0 flex items-center justify-center p-6 bg-slate-950/80 text-center text-white">
            <div className="space-y-3">
              <p className="font-bold">{errorMessage}</p>
              <div className="flex justify-center gap-2">
                <button type="button" onClick={() => void startStream(selectedDeviceId || undefined)} className="btn-duo btn-primary px-4 py-2 text-sm">{t.camera.retry}</button>
                <button type="button" onClick={onExit} className="btn-duo btn-ghost px-4 py-2 text-sm">{t.camera.backToUpload}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {devices.length > 1 && (
          <select value={selectedDeviceId} onChange={handleDeviceChange} disabled={!streaming || switching} className="max-w-64 rounded-xl border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold text-gray-800 dark:text-gray-100">
            {devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `${t.camera.device} ${index + 1}`}</option>)}
          </select>
        )}
        <m.button type="button" onClick={handleCapture} disabled={!streaming || switching} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} className="btn-duo btn-primary px-5 py-2.5 disabled:opacity-50">
          {t.camera.capture}
        </m.button>
        <button type="button" onClick={onExit} className="btn-duo btn-ghost px-4 py-2.5">{t.camera.backToUpload}</button>
      </div>
      <p className="text-center text-sm font-medium text-gray-500 dark:text-gray-400">{t.camera.defaultEmoji(emoji)}</p>
    </div>
  );
}
