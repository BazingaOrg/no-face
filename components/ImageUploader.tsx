'use client';

import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';

interface ImageUploaderProps {
  onImageLoad: (image: HTMLImageElement, fileSize?: number) => void;
  disabled?: boolean;
}

export default function ImageUploader({ onImageLoad, disabled }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('请上传图片文件');
        return;
      }

      // Validate file size (max 20MB)
      const maxSize = 20 * 1024 * 1024;
      if (file.size > maxSize) {
        alert('图片文件过大，请选择小于 20MB 的图片');
        return;
      }

      // Load image
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          onImageLoad(img, file.size);
        };
        img.onerror = () => {
          alert('图片加载失败，请尝试其他图片');
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    },
    [onImageLoad]
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

  return (
    <motion.div
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
          ${isDragging ? 'border-green-400 bg-green-50 dark:bg-green-900/20 scale-105 shadow-xl' : 'border-gray-300 dark:border-slate-600 hover:shadow-xl'}
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
          {/* Upload icon - Duolingo style */}
          <div className="text-5xl md:text-6xl">
            📸
          </div>

          {/* Text */}
          <div>
            <p className="text-2xl md:text-3xl font-black text-gray-800 dark:text-gray-100 mb-1">
              {isDragging ? '松开上传' : '上传图片'}
            </p>
            <p className="text-base md:text-lg font-bold text-gray-600 dark:text-gray-300 mt-1">
              点击选择或拖拽图片到此处
            </p>
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium">
              支持 JPG、PNG、WEBP 格式（最大 20MB）
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-medium">
              📱 移动设备可直接调用相机或相册
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
