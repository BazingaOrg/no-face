import { describe, expect, it } from 'vitest';
import { calculateEmojiSize, getEmojiScreenRect } from './emojiRenderUtils';

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

describe('getEmojiScreenRect', () => {
  it('centers the emoji within the box when offset is zero', () => {
    const rect = getEmojiScreenRect({ x: 10, y: 20, width: 100, height: 100 }, { x: 0, y: 0 }, 1);
    expect(rect).toEqual({ x: 10, y: 20, width: 100, height: 100 });
  });

  it('applies a drag offset on top of the centered position', () => {
    const rect = getEmojiScreenRect(
      { x: 10, y: 20, width: 100, height: 100 },
      { x: 15, y: -5 },
      1
    );
    expect(rect).toEqual({ x: 25, y: 15, width: 100, height: 100 });
  });

  it('combines auto-centering (for non-square faces) with the drag offset', () => {
    // wide face (200x100) auto-centers horizontally by +50 before the drag offset
    const rect = getEmojiScreenRect(
      { x: 0, y: 0, width: 200, height: 100 },
      { x: 10, y: 0 },
      1
    );
    expect(rect.x).toBe(60); // 50 (auto-center) + 10 (drag)
    expect(rect.width).toBe(100);
  });
});
