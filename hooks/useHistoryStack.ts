import { useCallback, useRef, useState } from 'react';

/**
 * Generic undo/redo history stack.
 *
 * `current` is read through a ref updated on every render, so `push`/`undo`/
 * `redo` keep stable identities across renders (their useCallback deps never
 * change) while still always snapshotting/restoring the latest value at the
 * moment they're actually invoked. This matters when the trigger is stored
 * somewhere that outlives a render — e.g. a toast's action button — where a
 * closure recreated per-render would go stale before the user clicks it.
 */
export function useHistoryStack<T>(
  current: T,
  restore: (snapshot: T) => void,
  maxEntries = 50
) {
  const currentRef = useRef(current);
  currentRef.current = current;

  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const refreshFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  // Call before any mutation that should be undoable, capturing the current
  // (pre-mutation) value. Clears the redo branch, matching editor semantics.
  const push = useCallback(() => {
    pastRef.current.push(currentRef.current);
    if (pastRef.current.length > maxEntries) pastRef.current.shift();
    futureRef.current = [];
    refreshFlags();
  }, [maxEntries, refreshFlags]);

  const clear = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    refreshFlags();
  }, [refreshFlags]);

  const move = useCallback(
    (source: React.MutableRefObject<T[]>, dest: React.MutableRefObject<T[]>) => {
      const entry = source.current.pop();
      if (!entry) return;
      dest.current.push(currentRef.current);
      restore(entry);
      refreshFlags();
    },
    [restore, refreshFlags]
  );

  const undo = useCallback(() => move(pastRef, futureRef), [move]);
  const redo = useCallback(() => move(futureRef, pastRef), [move]);

  return { push, clear, undo, redo, canUndo, canRedo };
}
