import { describe, expect, it } from 'vitest';
import { formatHeading, metresToFeet, msToKnots } from './units';

describe('metresToFeet', () => {
  it('converts metres to feet rounded to nearest 100', () => {
    expect(metresToFeet(10000)).toBe('32800');
    expect(metresToFeet(610)).toBe('2000');
  });

  it('returns em dash for null', () => {
    expect(metresToFeet(null)).toBe('—');
  });

  it('handles zero', () => {
    expect(metresToFeet(0)).toBe('0');
  });
});

describe('msToKnots', () => {
  it('converts m/s to knots rounded to integer', () => {
    expect(msToKnots(72)).toBe('140');
    expect(msToKnots(240)).toBe('467');
  });

  it('returns em dash for null', () => {
    expect(msToKnots(null)).toBe('—');
  });
});

describe('formatHeading', () => {
  it('formats degrees with ° suffix', () => {
    expect(formatHeading(270)).toBe('270°');
    expect(formatHeading(90.4)).toBe('90°');
  });

  it('returns em dash for null', () => {
    expect(formatHeading(null)).toBe('—');
  });
});
