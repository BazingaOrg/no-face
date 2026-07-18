import { useEffect, useRef, useState } from 'react';

// Whole-window drag & drop: dropping a file anywhere on the window invokes
// onFile (guarded by `enabled`, e.g. so it's a no-op while already processing).
export function useWindowFileDrop(
  enabled: boolean,
  onFile: (file: File) => void
): { isDraggingOver: boolean } {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const windowDragDepthRef = useRef(0);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      windowDragDepthRef.current += 1;
      setIsDraggingOver(true);
    };

    const handleDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
    };

    const handleDragLeave = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      windowDragDepthRef.current = Math.max(0, windowDragDepthRef.current - 1);
      if (windowDragDepthRef.current === 0) {
        setIsDraggingOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      windowDragDepthRef.current = 0;
      setIsDraggingOver(false);

      if (!enabled) return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        onFile(files[0]);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [enabled, onFile]);

  return { isDraggingOver };
}
