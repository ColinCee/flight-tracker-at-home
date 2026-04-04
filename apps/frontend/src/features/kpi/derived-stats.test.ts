import { describe, expect, it } from 'vitest';
import type { AircraftState } from '@/api/generated';
import { computeDerivedStats } from './derived-stats';

function makeAircraft(overrides: Partial<AircraftState> = {}): AircraftState {
  return {
    icao24: 'abc123',
    callsign: 'TEST01',
    originCountry: 'United Kingdom',
    latitude: 51.5,
    longitude: -0.1,
    baroAltitude: 10000,
    geoAltitude: 10000,
    velocity: 200,
    trueTrack: 90,
    verticalRate: 0,
    onGround: false,
    squawk: null,
    lastContact: 1700000000,
    isApproachingLhr: false,
    ...overrides,
  };
}

describe('computeDerivedStats', () => {
  it('counts airborne and on-ground aircraft', () => {
    const aircraft = [
      makeAircraft({ onGround: false }),
      makeAircraft({ onGround: false }),
      makeAircraft({ onGround: true }),
    ];
    const stats = computeDerivedStats(aircraft);
    expect(stats.airborne).toBe(2);
    expect(stats.onGround).toBe(1);
  });

  it('counts climbing and descending aircraft', () => {
    const aircraft = [
      makeAircraft({ verticalRate: 5 }),
      makeAircraft({ verticalRate: 3 }),
      makeAircraft({ verticalRate: -4 }),
      makeAircraft({ verticalRate: 0 }),
      makeAircraft({ verticalRate: 0.5 }),
    ];
    const stats = computeDerivedStats(aircraft);
    expect(stats.climbing).toBe(2);
    expect(stats.descending).toBe(1);
  });

  it('computes average altitude in feet rounded to nearest 100', () => {
    const aircraft = [
      makeAircraft({ baroAltitude: 10000, onGround: false }),
      makeAircraft({ baroAltitude: 12000, onGround: false }),
    ];
    const stats = computeDerivedStats(aircraft);
    // avg = 11000m * 3.28084 = 36089 ft → rounded to 36100
    expect(stats.avgAltitudeFt).toBe(36100);
  });

  it('excludes on-ground aircraft from average altitude', () => {
    const aircraft = [
      makeAircraft({ baroAltitude: 10000, onGround: false }),
      makeAircraft({ baroAltitude: 0, onGround: true }),
    ];
    const stats = computeDerivedStats(aircraft);
    // only airborne: 10000m * 3.28084 = 32808 → 32800
    expect(stats.avgAltitudeFt).toBe(32800);
  });

  it('returns null average altitude when no airborne aircraft', () => {
    const aircraft = [makeAircraft({ onGround: true, baroAltitude: null })];
    const stats = computeDerivedStats(aircraft);
    expect(stats.avgAltitudeFt).toBeNull();
  });

  it('handles empty array', () => {
    const stats = computeDerivedStats([]);
    expect(stats.airborne).toBe(0);
    expect(stats.onGround).toBe(0);
    expect(stats.climbing).toBe(0);
    expect(stats.descending).toBe(0);
    expect(stats.avgAltitudeFt).toBeNull();
  });
});
