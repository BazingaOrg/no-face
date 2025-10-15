/**
 * Image optimization utilities for better performance
 */

export interface OptimizedImage {
  optimizedCanvas: HTMLCanvasElement;
  scale: number; // Scale factor for coordinate mapping
  originalImage: HTMLImageElement;
  originalWidth: number;
  originalHeight: number;
  optimizedWidth: number;
  optimizedHeight: number;
}

/**
 * Optimize image for face detection by resizing to max width
 * Maintains aspect ratio and returns scale factor for coordinate mapping
 */
export async function optimizeImageForDetection(
  img: HTMLImageElement,
  maxWidth = 1920
): Promise<OptimizedImage> {
  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;
  
  // Calculate scale factor
  const scale = Math.min(1, maxWidth / originalWidth);
  const optimizedWidth = Math.round(originalWidth * scale);
  const optimizedHeight = Math.round(originalHeight * scale);
  
  // Create canvas for optimized image
  const canvas = document.createElement('canvas');
  canvas.width = optimizedWidth;
  canvas.height = optimizedHeight;
  
  const ctx = canvas.getContext('2d', { 
    willReadFrequently: true,
    alpha: false // Disable alpha for better performance
  });
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // Use high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Draw optimized image
  ctx.drawImage(img, 0, 0, optimizedWidth, optimizedHeight);
  
  return {
    optimizedCanvas: canvas,
    scale,
    originalImage: img,
    originalWidth,
    originalHeight,
    optimizedWidth,
    optimizedHeight,
  };
}

/**
 * Map face coordinates from optimized image to original image
 */
export function mapCoordinatesToOriginal(
  box: { x: number; y: number; width: number; height: number },
  scale: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: box.x / scale,
    y: box.y / scale,
    width: box.width / scale,
    height: box.height / scale,
  };
}

/**
 * Calculate file size category for UI hints
 */
export function getImageSizeCategory(fileSize: number): 'small' | 'medium' | 'large' {
  const MB = 1024 * 1024;
  if (fileSize < 2 * MB) return 'small';
  if (fileSize < 10 * MB) return 'medium';
  return 'large';
}

/**
 * Get user-friendly file size string
 */
export function formatFileSize(bytes: number): string {
  const MB = 1024 * 1024;
  const KB = 1024;
  
  if (bytes >= MB) {
    return `${(bytes / MB).toFixed(1)} MB`;
  } else if (bytes >= KB) {
    return `${(bytes / KB).toFixed(0)} KB`;
  }
  return `${bytes} B`;
}

