import { describe, expect, it } from 'vitest';
import {
  mapCoordinatesToOriginal,
  getImageSizeCategory,
} from './imageOptimization';

describe('mapCoordinatesToOriginal', () => {
  it('scales a detection box back to original image coordinates', () => {
    const box = { x: 100, y: 50, width: 200, height: 150 };
    expect(mapCoordinatesToOriginal(box, 0.5)).toEqual({
      x: 200,
      y: 100,
      width: 400,
      height: 300,
    });
  });

  it('is an identity mapping when scale is 1', () => {
    const box = { x: 10, y: 20, width: 30, height: 40 };
    expect(mapCoordinatesToOriginal(box, 1)).toEqual(box);
  });
});

describe('getImageSizeCategory', () => {
  const MB = 1024 * 1024;

  it('categorizes by file size thresholds', () => {
    expect(getImageSizeCategory(1 * MB)).toBe('small');
    expect(getImageSizeCategory(2 * MB)).toBe('medium');
    expect(getImageSizeCategory(9 * MB)).toBe('medium');
    expect(getImageSizeCategory(10 * MB)).toBe('large');
    expect(getImageSizeCategory(20 * MB)).toBe('large');
  });
});

