/**
 * Twemoji utility functions
 */

import { EmojiSettings } from '@/types';

// Twemoji CDN base URL
const TWEMOJI_CDN = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/';

/**
 * Get twemoji image URL for a given emoji character
 */
export function getTwemojiUrl(emoji: string, settings: EmojiSettings): string {
  // Convert emoji to unicode codepoint
  const codepoint = getEmojiCodepoint(emoji);

  // Construct URL based on format
  const folder = settings.format === 'svg' ? 'svg' : settings.size;
  const ext = settings.format === 'svg' ? '.svg' : '.png';

  return `${TWEMOJI_CDN}${folder}/${codepoint}${ext}`;
}

/**
 * Convert emoji character to unicode codepoint hex string
 * Example: "😀" -> "1f600"
 *
 * Handles:
 * - Multi-codepoint emojis (skin tones, flags, etc.)
 * - Variation selectors (U+FE0F, U+FE0E)
 * - Zero-width joiners (U+200D)
 */
function getEmojiCodepoint(emoji: string): string {
  const codepoints: string[] = [];

  // Convert string to array of codepoints
  for (const char of emoji) {
    const codepoint = char.codePointAt(0);
    if (codepoint !== undefined) {
      const hex = codepoint.toString(16);

      // Filter out variation selectors (FE0F, FE0E) for Twemoji compatibility
      // Twemoji uses the base emoji without variation selectors in URLs
      if (hex !== 'fe0f' && hex !== 'fe0e') {
        codepoints.push(hex);
      }
    }
  }

  return codepoints.join('-');
}

/**
 * Preload emoji image to ensure it's ready for rendering
 * Returns the loaded image or null if loading fails
 */
export function preloadEmoji(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Enable CORS for canvas export

    img.onload = () => resolve(img);

    img.onerror = () => {
      reject(new Error(`Failed to load emoji: ${url}`));
    };

    img.src = url;
  });
}

/**
 * Preload emoji with fallback to native rendering
 * Returns the image URL if successful, or null to use native emoji
 */
export async function preloadEmojiWithFallback(
  emoji: string,
  settings: EmojiSettings
): Promise<{ url: string; useNative: boolean }> {
  const url = getTwemojiUrl(emoji, settings);

  try {
    await preloadEmoji(url);
    return { url, useNative: false };
  } catch {
    // Fallback to native emoji rendering
    return { url: '', useNative: true };
  }
}

/**
 * Load multiple emojis in parallel
 */
export async function preloadEmojis(urls: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(urls.map(preloadEmoji));
}
