import { describe, expect, it } from 'vitest';
import { formatCondition } from './AirportInspector';

describe('formatCondition', () => {
  it.each([
    ['partlycloudy_night', 'Partly cloudy'],
    ['clearsky_day', 'Clear sky'],
    ['fair_night', 'Fair'],
    ['lightrainshowers_day', 'Light rain showers'],
    ['heavyrainandthunder', 'Heavy rain and thunder'],
    ['cloudy', 'Cloudy'],
    [null, '—'],
  ])('%s -> %s', (code, words) => {
    expect(formatCondition(code)).toBe(words);
  });
});
