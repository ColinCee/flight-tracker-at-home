import type { AircraftState } from '@/api/generated';
import { AIRPORT_NAMES } from '@/features/map/airports';
import { airlineOf } from './airlines';

export type Chip = 'all' | 'landing' | 'departing' | 'low';

/**
 * Below this a plane is "Low": loud, and its markings readable from the
 * ground. Measured on a day of real traffic it catches about 1 in 7
 * aircraft-minutes (5,000 ft would catch 1 in 4, too many to feel special).
 */
export const LOW_FT = 3000;

/** Climbing below this near London is a departure, not a cruise step-climb. */
const DEPARTING_BELOW_FT = 10_000;

/** What the map colours it by. Selection and emergencies are drawn on top of this. */
export type Phase = 'landing' | 'departing' | 'other';

export function phaseOf(a: AircraftState): Phase {
  if (a.destination) return 'landing';
  if (a.isClimbing && (a.baroAltitudeFt ?? Number.POSITIVE_INFINITY) < DEPARTING_BELOW_FT) {
    return 'departing';
  }
  return 'other';
}

export function matchesChip(a: AircraftState, chip: Chip): boolean {
  switch (chip) {
    case 'all':
      return true;
    case 'landing':
      return phaseOf(a) === 'landing';
    case 'departing':
      return phaseOf(a) === 'departing';
    case 'low':
      return a.baroAltitudeFt != null && a.baroAltitudeFt < LOW_FT;
  }
}

/** Plain-language state, claiming only what the backend's heuristics support. */
export function statusOf(a: AircraftState): string {
  if (a.onGround) return 'On the ground';
  if (a.destination) return `Landing at ${AIRPORT_NAMES[a.destination]}`;
  if (phaseOf(a) === 'departing') return 'Climbing out of London';
  if (a.isClimbing) return 'Climbing';
  if (a.isDescending) return 'Descending';
  const alt = a.baroAltitudeFt;
  if (alt != null && alt < LOW_FT) return 'Flying low';
  if (alt != null && alt >= 25_000) return 'Passing over at cruise height';
  return 'Passing over';
}

export const EMERGENCY_SQUAWKS: Record<string, string> = {
  '7500': 'Hijack',
  '7600': 'Radio failure',
  '7700': 'Emergency',
};

/** Callsign, else registration, else the transponder address. */
export function nameOf(a: AircraftState): string {
  return a.callsign?.trim() || a.registration || a.icao24.toUpperCase();
}

/** "Airline · TYPE", leaving out whatever is unknown. */
export function subtitleOf(a: AircraftState): string {
  return [airlineOf(a.callsign), a.aircraftType].filter(Boolean).join(' · ');
}

export function matchesQuery(a: AircraftState, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [a.callsign, a.registration, airlineOf(a.callsign), a.aircraftType].some((s) =>
    s?.toLowerCase().replace(/\s+/g, ' ').includes(q),
  );
}

const CENTRAL_LONDON = { lon: -0.1276, lat: 51.5072 };

/** Rough distance from central London; only used to sort, so flat-earth is fine. */
function distanceKey(a: AircraftState): number {
  const dx = (a.longitude - CENTRAL_LONDON.lon) * Math.cos((CENTRAL_LONDON.lat * Math.PI) / 180);
  const dy = a.latitude - CENTRAL_LONDON.lat;
  return dx * dx + dy * dy;
}

/** Airborne aircraft matching the chip and search, nearest central London first. */
export function nearestFlights(aircraft: AircraftState[], chip: Chip, query: string) {
  return aircraft
    .filter((a) => !a.onGround && matchesChip(a, chip) && matchesQuery(a, query))
    .sort((x, y) => distanceKey(x) - distanceKey(y));
}

export function chipCounts(aircraft: AircraftState[]): Record<Exclude<Chip, 'all'>, number> {
  const airborne = aircraft.filter((a) => !a.onGround);
  return {
    landing: airborne.filter((a) => matchesChip(a, 'landing')).length,
    departing: airborne.filter((a) => matchesChip(a, 'departing')).length,
    low: airborne.filter((a) => matchesChip(a, 'low')).length,
  };
}

export const formatNumber = (n: number) => Math.round(n).toLocaleString('en-GB');
