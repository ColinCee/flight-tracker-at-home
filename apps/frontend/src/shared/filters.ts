import type { AircraftState } from '@/api/generated';

export type AircraftFilter = 'airborne' | 'inbound-lhr' | 'climbing' | 'descending' | null;

export function matchesFilter(ac: AircraftState, filter: AircraftFilter): boolean {
  switch (filter) {
    case null:
      return true;
    case 'airborne':
      return !ac.onGround;
    case 'inbound-lhr':
      return ac.isApproachingLhr;
    case 'climbing':
      return ac.isClimbing;
    case 'descending':
      return ac.isDescending;
  }
}
