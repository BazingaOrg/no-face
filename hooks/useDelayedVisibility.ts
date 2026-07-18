import { useEffect, useRef, useState } from 'react';

/**
 * Gates a busy overlay's visibility so fast operations never flash it.
 *
 * `active` flipping true doesn't show anything until it has stayed true for
 * `delayMs` (a redetect that resolves in ~100ms never shows the overlay at
 * all). Once shown, it stays up for at least `minVisibleMs` even if `active`
 * goes false in the meantime, so a borderline-length operation doesn't pop
 * the overlay in and immediately back out.
 */
export function useDelayedVisibility(active: boolean, delayMs = 150, minVisibleMs = 350): boolean {
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active) {
      if (hideTimerRef.current !== null) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      showTimerRef.current = setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, delayMs);
    } else {
      if (showTimerRef.current !== null) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      setVisible((wasVisible) => {
        if (!wasVisible) return false;
        const elapsed = shownAtRef.current !== null ? Date.now() - shownAtRef.current : minVisibleMs;
        const remaining = Math.max(0, minVisibleMs - elapsed);
        if (remaining > 0) {
          hideTimerRef.current = setTimeout(() => setVisible(false), remaining);
          return wasVisible;
        }
        return false;
      });
    }

    return () => {
      if (showTimerRef.current !== null) clearTimeout(showTimerRef.current);
    };
  }, [active, delayMs, minVisibleMs]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return visible;
}
