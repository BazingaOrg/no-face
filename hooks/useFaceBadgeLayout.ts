import { useCallback, useEffect, useReducer, useRef } from 'react';
import { DetectedFace } from '@/types';

const DEFAULT_BADGE_SIZE = {
  width: 120,
  height: 38,
};

interface UseFaceBadgeLayoutParams {
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
}

interface BadgePosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function useFaceBadgeLayout({ canvasWidth, canvasHeight, scale }: UseFaceBadgeLayoutParams) {
  const badgeMeasurementsRef = useRef<Map<string, { width: number; height: number }>>(new Map());
  const badgeObserversRef = useRef<Map<string, ResizeObserver>>(new Map());
  const badgeRefCallbacksRef = useRef<Map<string, (node: HTMLButtonElement | null) => void>>(
    new Map()
  );
  const [, bumpMeasurementVersion] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    const observers = badgeObserversRef.current;
    const callbackMap = badgeRefCallbacksRef.current;

    return () => {
      observers.forEach((observer) => observer.disconnect());
      observers.clear();
      callbackMap.clear();
    };
  }, []);

  const registerBadgeNode = useCallback((faceId: string, node: HTMLButtonElement | null) => {
    const observers = badgeObserversRef.current;
    const measurements = badgeMeasurementsRef.current;

    const existingObserver = observers.get(faceId);
    if (existingObserver) {
      existingObserver.disconnect();
      observers.delete(faceId);
    }

    if (!node) {
      measurements.delete(faceId);
      badgeRefCallbacksRef.current.delete(faceId);
      return;
    }

    const updateMeasurement = (width: number, height: number) => {
      const previous = measurements.get(faceId);
      if (previous && previous.width === width && previous.height === height) {
        return;
      }

      measurements.set(faceId, { width, height });
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => bumpMeasurementVersion());
      } else {
        bumpMeasurementVersion();
      }
    };

    const rect = node.getBoundingClientRect();
    if (rect.width && rect.height) {
      updateMeasurement(rect.width, rect.height);
    }

    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const { width, height } = entry.contentRect;
        updateMeasurement(width, height);
      });
    });

    observer.observe(node);
    observers.set(faceId, observer);
  }, []);

  const getBadgeRefCallback = useCallback(
    (faceId: string) => {
      const callbacks = badgeRefCallbacksRef.current;
      if (!callbacks.has(faceId)) {
        callbacks.set(faceId, (node) => registerBadgeNode(faceId, node));
      }
      return callbacks.get(faceId)!;
    },
    [registerBadgeNode]
  );

  const getBadgePosition = useCallback(
    (face: DetectedFace): BadgePosition => {
      const padding = 8;
      const measurement = badgeMeasurementsRef.current.get(face.id) ?? DEFAULT_BADGE_SIZE;
      const faceCenterX = (face.box.x + face.box.width / 2) * scale;
      const faceTop = face.box.y * scale;
      const faceBottom = (face.box.y + face.box.height) * scale;

      let left = faceCenterX - measurement.width / 2;
      let top = faceTop - measurement.height - 12;

      if (top < padding) {
        const fallbackTop = faceBottom + 12;
        top = Math.min(
          Math.max(fallbackTop, padding),
          canvasHeight - measurement.height - padding
        );
      }

      left = Math.max(padding, Math.min(left, canvasWidth - measurement.width - padding));
      top = Math.max(padding, Math.min(top, canvasHeight - measurement.height - padding));

      return {
        top,
        left,
        width: measurement.width,
        height: measurement.height,
      };
    },
    [canvasHeight, canvasWidth, scale]
  );

  return {
    getBadgeRefCallback,
    getBadgePosition,
  };
}
