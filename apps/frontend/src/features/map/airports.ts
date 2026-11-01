import type { AircraftState } from '@/api/generated';

type Code = NonNullable<AircraftState['destination']>;

/** The five airports the backend's approach heuristic knows about. */
export const AIRPORTS: { code: Code; name: string; lon: number; lat: number }[] = [
  { code: 'LHR', name: 'Heathrow', lon: -0.4543, lat: 51.47 },
  { code: 'LGW', name: 'Gatwick', lon: -0.1903, lat: 51.1481 },
  { code: 'STN', name: 'Stansted', lon: 0.235, lat: 51.885 },
  { code: 'LTN', name: 'Luton', lon: -0.3683, lat: 51.8747 },
  { code: 'LCY', name: 'City', lon: 0.0553, lat: 51.5053 },
];

export const AIRPORT_NAMES = Object.fromEntries(AIRPORTS.map((a) => [a.code, a.name])) as Record<
  Code,
  string
>;
