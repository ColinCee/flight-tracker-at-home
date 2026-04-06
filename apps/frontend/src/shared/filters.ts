import type { AircraftState } from '@/api/generated';

export type AircraftFilter = 'airborne' | 'inbound-london' | 'climbing' | 'descending' | null;

export function matchesFilter(ac: AircraftState, filter: AircraftFilter): boolean {
  switch (filter) {
    case null:
      return true;
    case 'airborne':
      return !ac.onGround;
    case 'inbound-london':
      return ac.destination != null;
    case 'climbing':
      return ac.isClimbing;
    case 'descending':
      return ac.isDescending;
  }
}
