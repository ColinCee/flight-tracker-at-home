import { describe, expect, it } from 'vitest';
import type { AircraftState } from '@/api/generated';
import { matchesFilter } from './filters';

function makeAircraft(overrides: Partial<AircraftState> = {}): AircraftState {
  return {
    icao24: 'abc123',
    callsign: 'TEST01',
    registration: null,
    aircraftType: 'A320',
    category: 'Large',
    latitude: 51.5,
    longitude: -0.1,
    baroAltitudeFt: 10000,
    geoAltitudeFt: 10000,
    groundSpeedKts: 200,
    trueTrack: 90,
    verticalRateFpm: 0,
    onGround: false,
    squawk: null,
    lastContact: 1700000000,
    positionSource: 'ADS-B',
    isClimbing: false,
    isDescending: false,
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

  it('climbing filter uses backend-computed isClimbing boolean', () => {
    expect(matchesFilter(makeAircraft({ isClimbing: true }), 'climbing')).toBe(true);
    expect(matchesFilter(makeAircraft({ isClimbing: false }), 'climbing')).toBe(false);
  });

  it('descending filter uses backend-computed isDescending boolean', () => {
    expect(matchesFilter(makeAircraft({ isDescending: true }), 'descending')).toBe(true);
    expect(matchesFilter(makeAircraft({ isDescending: false }), 'descending')).toBe(false);
  });

  it('non-climbing non-descending aircraft does not match either filter', () => {
    expect(
      matchesFilter(makeAircraft({ isClimbing: false, isDescending: false }), 'climbing'),
    ).toBe(false);
    expect(
      matchesFilter(makeAircraft({ isClimbing: false, isDescending: false }), 'descending'),
    ).toBe(false);
  });
});
