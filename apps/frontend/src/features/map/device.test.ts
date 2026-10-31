import { describe, expect, it } from 'vitest';
import { pickPickingRadius, pickPixelRatio } from './device';

describe('pickPixelRatio', () => {
  it('caps phones at 1.5', () => {
    expect(pickPixelRatio(2.625, 412)).toBe(1.5);
    expect(pickPixelRatio(3, 375)).toBe(1.5);
  });

  it('caps larger screens at 2', () => {
    expect(pickPixelRatio(3, 1440)).toBe(2);
  });

  it('keeps low ratios as they are, never below 1', () => {
    expect(pickPixelRatio(1.25, 1440)).toBe(1.25);
    expect(pickPixelRatio(0.5, 1440)).toBe(1);
  });
});

describe('pickPickingRadius', () => {
  it('is larger for fingers than for a mouse', () => {
    expect(pickPickingRadius(true)).toBeGreaterThan(pickPickingRadius(false));
  });
});
