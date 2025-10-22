import { useCallback, useEffect, useRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => void;

/**
 * Batches rapid invocations of a callback into a single execution per animation frame.
 * Falls back to macrotask scheduling on the server or non-browser environments.
 */
export function useFrameDebouncedCallback<T extends AnyFunction>(callback: T): T {
  const callbackRef = useRef(callback);
  const frameRef = useRef<number | null>(null);
  const lastArgsRef = useRef<Parameters<T> | undefined>(undefined);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        if (typeof window !== 'undefined') {
          window.cancelAnimationFrame(frameRef.current);
        } else {
          clearTimeout(frameRef.current);
        }
      }
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    lastArgsRef.current = args;

    if (frameRef.current !== null) {
      return;
    }

    const run = () => {
      frameRef.current = null;
      if (!lastArgsRef.current) return;
      callbackRef.current(...lastArgsRef.current);
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      frameRef.current = window.requestAnimationFrame(run);
    } else {
      frameRef.current = setTimeout(run, 16) as unknown as number;
    }
  }, []) as unknown as T;
}
