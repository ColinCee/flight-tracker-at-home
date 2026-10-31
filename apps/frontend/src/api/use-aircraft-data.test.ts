import { describe, expect, it } from 'vitest';
import type { AircraftResponse } from './generated';
import { pollIntervalFor } from './use-aircraft-data';

function response(refreshIntervalMs: number): AircraftResponse {
  return {
    timestamp: 0,
    cacheAgeSeconds: 0,
    refreshIntervalMs,
    aircraft: [],
    kpis: {} as AircraftResponse['kpis'],
  };
}

describe('pollIntervalFor', () => {
  it('polls every 10 s before the backend has answered', () => {
    expect(pollIntervalFor(undefined)).toBe(10_000);
  });

  it('uses the interval from the latest response', () => {
    expect(pollIntervalFor(response(30_000))).toBe(30_000);
  });

  it('ignores a zero interval', () => {
    expect(pollIntervalFor(response(0))).toBe(10_000);
  });
});
