/**
 * Shared emoji image cache.
 * Canvas preview and export both draw emoji bitmaps; caching them avoids
 * repeated CDN fetches and lets redraws happen synchronously (no flicker).
 */

const loaded = new Map<string, HTMLImageElement>();
const failed = new Set<string>();
const pending = new Map<string, Promise<HTMLImageElement>>();

/** Synchronously get an already-loaded image, or null if not cached yet. */
export function getLoadedEmojiImage(url: string): HTMLImageElement | null {
  return loaded.get(url) ?? null;
}

/** Whether a previous load attempt for this URL failed (caller should fall back to native rendering). */
export function hasEmojiImageFailed(url: string): boolean {
  return failed.has(url);
}

/**
 * Load an emoji image with caching and request deduplication.
 * Rejects on load failure and remembers the failure so callers can fall back.
 */
export function loadEmojiImage(url: string): Promise<HTMLImageElement> {
  const cached = loaded.get(url);
  if (cached) return Promise.resolve(cached);

  const inFlight = pending.get(url);
  if (inFlight) return inFlight;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Enable CORS for canvas export

    img.onload = () => {
      loaded.set(url, img);
      failed.delete(url);
      pending.delete(url);
      resolve(img);
    };

    img.onerror = () => {
      failed.add(url);
      pending.delete(url);
      reject(new Error(`Failed to load emoji: ${url}`));
    };

    img.src = url;
  });

  pending.set(url, promise);
  return promise;
}
