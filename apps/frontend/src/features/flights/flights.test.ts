import { describe, expect, it } from 'vitest';
import type { AircraftState } from '@/api/generated';
import { airlineOf } from './airlines';
import { chipCounts, matchesQuery, nearestFlights, statusOf, subtitleOf } from './flights';

function plane(over: Partial<AircraftState>): AircraftState {
  return {
    icao24: 'abc123',
    callsign: 'BAW123',
    registration: 'G-ABCD',
    aircraftType: 'A320',
    category: 'Large',
    latitude: 51.5,
    longitude: -0.12,
    baroAltitudeFt: 12_000,
    geoAltitudeFt: 12_100,
    groundSpeedKts: 300,
    trueTrack: 90,
    verticalRateFpm: 0,
    onGround: false,
    squawk: '1234',
    lastContact: 0,
    positionSource: 'ADS-B',
    isClimbing: false,
    isDescending: false,
    destination: null,
    ...over,
  };
}

describe('airlineOf', () => {
  it('reads the ICAO prefix', () => {
    expect(airlineOf('BAW12XK')).toBe('British Airways');
    expect(airlineOf('EZY75PD ')).toBe('easyJet');
    expect(airlineOf('DHK72')).toBe('DHL Air UK');
  });
  it('reads a few IATA-style callsigns', () => {
    expect(airlineOf('BA1')).toBe('British Airways');
  });
  it('knows nothing about private registrations or unknown prefixes', () => {
    expect(airlineOf('GBCDE')).toBeNull();
    expect(airlineOf('SQB12')).toBeNull();
    expect(airlineOf(null)).toBeNull();
  });
});

describe('statusOf', () => {
  it('claims a landing only when the backend found the approach', () => {
    expect(statusOf(plane({ destination: 'LHR', isDescending: true }))).toBe('Landing at Heathrow');
    expect(statusOf(plane({ isDescending: true }))).toBe('Descending');
  });
  it('tells a departure from a cruise climb', () => {
    expect(statusOf(plane({ isClimbing: true, baroAltitudeFt: 4000 }))).toBe(
      'Climbing out of London',
    );
    expect(statusOf(plane({ isClimbing: true, baroAltitudeFt: 30_000 }))).toBe('Climbing');
  });
  it('falls back on height', () => {
    expect(statusOf(plane({ baroAltitudeFt: 1500 }))).toBe('Flying low');
    expect(statusOf(plane({ baroAltitudeFt: 36_000 }))).toBe('Passing over at cruise height');
    expect(statusOf(plane({ onGround: true }))).toBe('On the ground');
  });
});

describe('subtitleOf', () => {
  it('leaves out what is unknown', () => {
    expect(subtitleOf(plane({}))).toBe('British Airways · A320');
    expect(subtitleOf(plane({ callsign: 'GBCDE', aircraftType: null }))).toBe('');
  });
});

describe('matchesQuery', () => {
  const a = plane({});
  it.each(['baw1', 'g-abcd', 'british', 'a320', ''])('finds "%s"', (q) => {
    expect(matchesQuery(a, q)).toBe(true);
  });
  it('misses other flights', () => {
    expect(matchesQuery(a, 'ryanair')).toBe(false);
  });
});

describe('lists and counts', () => {
  const near = plane({ icao24: 'near', latitude: 51.51, longitude: -0.13 });
  const far = plane({ icao24: 'far', latitude: 51.9, longitude: 0.3, baroAltitudeFt: 2000 });
  const landing = plane({ icao24: 'land', latitude: 51.47, longitude: -0.3, destination: 'LHR' });
  const ground = plane({ icao24: 'gnd', onGround: true, baroAltitudeFt: null });

  it('lists airborne flights nearest central London first', () => {
    expect(nearestFlights([far, ground, landing, near], 'all', '').map((a) => a.icao24)).toEqual([
      'near',
      'land',
      'far',
    ]);
  });
  it('counts each chip without aircraft on the ground', () => {
    expect(chipCounts([near, far, landing, ground])).toEqual({ landing: 1, departing: 0, low: 1 });
  });
});
