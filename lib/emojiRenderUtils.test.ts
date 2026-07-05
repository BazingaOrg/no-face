import { describe, expect, it } from 'vitest';
import { calculateEmojiSize } from './emojiRenderUtils';

describe('calculateEmojiSize', () => {
  it('uses the larger dimension for a nearly square face', () => {
    const size = calculateEmojiSize(100, 95, 1);
    expect(size.width).toBe(100);
    expect(size.height).toBe(100);
    expect(size.offsetX).toBe(0);
    expect(size.offsetY).toBe((95 - 100) / 2);
  });

  it('uses the height for a wide face and centers horizontally', () => {
    const size = calculateEmojiSize(200, 100, 1);
    expect(size.width).toBe(100);
    expect(size.height).toBe(100);
    expect(size.offsetX).toBe(50);
    expect(size.offsetY).toBe(0);
  });

  it('uses the width for a tall face and centers vertically', () => {
    const size = calculateEmojiSize(100, 200, 1);
    expect(size.width).toBe(100);
    expect(size.height).toBe(100);
    expect(size.offsetX).toBe(0);
    expect(size.offsetY).toBe(50);
  });

  it('applies the scale factor and keeps the result centered', () => {
    const size = calculateEmojiSize(100, 100, 1.2);
    expect(size.width).toBeCloseTo(120);
    expect(size.offsetX).toBeCloseTo(-10);
    expect(size.offsetY).toBeCloseTo(-10);
  });

  it('always returns a square regardless of face aspect ratio', () => {
    for (const [w, h] of [
      [100, 100],
      [300, 100],
      [100, 300],
      [173, 191],
    ]) {
      const size = calculateEmojiSize(w, h, 1.5);
      expect(size.width).toBe(size.height);
    }
  });
});
