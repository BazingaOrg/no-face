'use client';

import { useCallback, useState } from 'react';
import { m } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { Upload } from '@/components/icons';

// NASA public-domain Expedition 61 crew portrait (images.nasa.gov, nasa_id
// jsc2019e022584_alt) — three clear frontal faces, ~190KB. Used as a
// zero-friction "try it" sample before the user uploads their own photo.
const SAMPLE_IMAGE_URL = '/sample-faces.jpg';

interface ImageUploaderProps {
  onImageLoad: (image: HTMLImageElement, fileSize?: number) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

export default function ImageUploader({ onImageLoad, onError, disabled }: ImageUploaderProps) {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        onError?.(t.toasts.unsupportedFileType);
        return;
      }

      // Validate file size (max 20MB)
      const maxSize = 20 * 1024 * 1024;
      if (file.size > maxSize) {
        onError?.(t.toasts.fileTooLarge);
        return;
      }

      // Object URL avoids the ~1.3x base64 memory overhead of data URLs;
      // revoke once the image is decoded — the bitmap stays usable.
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        onImageLoad(img, file.size);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        onError?.(t.toasts.imageLoadFailed);
      };
      img.src = url;
    },
    [onImageLoad, onError, t]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled, handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleSampleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;

      const img = new Image();
      img.onload = () => {
        onImageLoad(img);
      };
      img.onerror = () => {
        onError?.(t.toasts.sampleLoadFailed);
      };
      img.src = SAMPLE_IMAGE_URL;
    },
    [disabled, onImageLoad, onError, t]
  );

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative bg-white dark:bg-slate-800 rounded-2xl p-8 text-center
          transition-all duration-200 cursor-pointer
          shadow-lg border-4 border-dashed
          ${isDragging ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 scale-105 shadow-xl' : 'border-gray-300 dark:border-slate-600 hover:shadow-xl'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          type="file"
          accept="image/*"
          onChange={handleFileInput}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />

        <div className="flex flex-col items-center gap-3">
          {/* Upload icon */}
          <div className="text-gray-400 dark:text-gray-500">
            <Upload className="w-12 h-12 md:w-14 md:h-14" size={56} />
          </div>

          {/* Text */}
          <div>
            <p className="text-2xl md:text-3xl font-black text-gray-800 dark:text-gray-100 mb-1">
              {isDragging ? t.uploader.titleDragging : t.uploader.title}
            </p>
            <p className="text-base md:text-lg font-bold text-gray-600 dark:text-gray-300 mt-1">
              {t.uploader.subtitle}
            </p>
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium">
              {t.uploader.formats}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-medium">
              {t.uploader.mobileHint}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={handleSampleClick}
          disabled={disabled}
          className="relative z-10 text-sm px-3 py-1.5 btn-duo btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.uploader.sampleButton}
        </button>
      </div>
    </m.div>
  );
}
