import { describe, expect, it } from 'vitest';
import { settle, snapHeights } from './sheet-snap';

const h = snapHeights(800); // peek 156, half 384, full 724

describe('settle', () => {
  it('goes to the nearest height on a slow release', () => {
    expect(settle(h, 'half', 300, 0)).toBe('half');
    expect(settle(h, 'half', 200, 0.1)).toBe('peek');
    expect(settle(h, 'half', 600, -0.1)).toBe('full');
  });
  it('moves one step on a flick, even after a short drag', () => {
    expect(settle(h, 'half', 400, 1)).toBe('full');
    expect(settle(h, 'half', 370, -1)).toBe('peek');
    expect(settle(h, 'peek', 170, 1)).toBe('half');
  });
  it('stays put at the ends', () => {
    expect(settle(h, 'full', 724, 2)).toBe('full');
    expect(settle(h, 'peek', 140, -2)).toBe('peek');
  });
  it('never settles behind the finger on a long flick', () => {
    expect(settle(h, 'peek', 700, 1)).toBe('full');
  });
});
