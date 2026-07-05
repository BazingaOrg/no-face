/**
 * Twemoji utility functions
 */

import { loadEmojiImage } from '@/lib/emojiImageCache';

// Twemoji CDN base URL.
// twitter/twemoji is unmaintained and its `latest` tag is frozen at 14.0.2;
// jdecked/twemoji is the maintained fork with newer Unicode coverage.
const TWEMOJI_CDN = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/';

/**
 * Get twemoji image URL for a given emoji character
 * Always returns SVG format for best quality
 * @param emoji - Emoji character
 */
export function getTwemojiUrl(emoji: string): string {
  // Convert emoji to unicode codepoint
  const codepoint = getEmojiCodepoint(emoji);

  // Always use SVG format for best quality
  return `${TWEMOJI_CDN}svg/${codepoint}.svg`;
}

/**
 * Convert emoji character to unicode codepoint hex string
 * Example: "😀" -> "1f600"
 *
 * Twemoji filename convention: variation selectors (U+FE0F/U+FE0E) are
 * stripped, EXCEPT in ZWJ (U+200D) sequences where they must be kept —
 * e.g. ❤️‍🔥 is "2764-fe0f-200d-1f525.svg", while ☹️ is just "2639.svg".
 */
function getEmojiCodepoint(emoji: string): string {
  const codepoints: string[] = [];

  for (const char of emoji) {
    const codepoint = char.codePointAt(0);
    if (codepoint !== undefined) {
      codepoints.push(codepoint.toString(16));
    }
  }

  const hasZwj = codepoints.includes('200d');
  const filtered = hasZwj
    ? codepoints
    : codepoints.filter((hex) => hex !== 'fe0f' && hex !== 'fe0e');

  return filtered.join('-');
}

/**
 * Preload emoji image to ensure it's ready for rendering.
 * Backed by the shared emoji image cache, so subsequent canvas draws are synchronous.
 */
export function preloadEmoji(url: string): Promise<HTMLImageElement> {
  return loadEmojiImage(url);
}

/**
 * Preload emoji with fallback to native rendering
 * Returns the image URL if successful, or an empty URL to use native emoji
 */
export async function preloadEmojiWithFallback(
  emoji: string
): Promise<{ url: string; useNative: boolean }> {
  const url = getTwemojiUrl(emoji);

  try {
    await preloadEmoji(url);
    return { url, useNative: false };
  } catch {
    // Fallback to native emoji rendering
    return { url: '', useNative: true };
  }
}
