import { describe, expect, it } from 'vitest';
import type { AircraftState } from '@/api/generated';
import { matchesFilter } from './filters';

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

describe('matchesFilter', () => {
  it('null filter matches everything', () => {
    expect(matchesFilter(makeAircraft(), null)).toBe(true);
    expect(matchesFilter(makeAircraft({ onGround: true }), null)).toBe(true);
  });

  it('airborne filter matches aircraft not on ground', () => {
    expect(matchesFilter(makeAircraft({ onGround: false }), 'airborne')).toBe(true);
    expect(matchesFilter(makeAircraft({ onGround: true }), 'airborne')).toBe(false);
  });

  it('inbound-lhr filter matches approaching aircraft', () => {
    expect(matchesFilter(makeAircraft({ isApproachingLhr: true }), 'inbound-lhr')).toBe(true);
    expect(matchesFilter(makeAircraft({ isApproachingLhr: false }), 'inbound-lhr')).toBe(false);
  });

  it('climbing filter matches positive vertical rate above threshold', () => {
    expect(matchesFilter(makeAircraft({ verticalRate: 5 }), 'climbing')).toBe(true);
    expect(matchesFilter(makeAircraft({ verticalRate: 0.5 }), 'climbing')).toBe(false);
    expect(matchesFilter(makeAircraft({ verticalRate: -3 }), 'climbing')).toBe(false);
  });

  it('descending filter matches negative vertical rate below threshold', () => {
    expect(matchesFilter(makeAircraft({ verticalRate: -5 }), 'descending')).toBe(true);
    expect(matchesFilter(makeAircraft({ verticalRate: -0.5 }), 'descending')).toBe(false);
    expect(matchesFilter(makeAircraft({ verticalRate: 3 }), 'descending')).toBe(false);
  });

  it('handles null verticalRate as zero', () => {
    expect(matchesFilter(makeAircraft({ verticalRate: null }), 'climbing')).toBe(false);
    expect(matchesFilter(makeAircraft({ verticalRate: null }), 'descending')).toBe(false);
  });
});
