import type { AircraftState } from '@/api/generated';

export type AircraftFilter = 'airborne' | 'inbound-lhr' | 'climbing' | 'descending' | null;

const VERTICAL_RATE_THRESHOLD = 1; // m/s

export function matchesFilter(ac: AircraftState, filter: AircraftFilter): boolean {
  switch (filter) {
    case null:
      return true;
    case 'airborne':
      return !ac.onGround;
    case 'inbound-lhr':
      return ac.isApproachingLhr;
    case 'climbing':
      return (ac.verticalRate ?? 0) > VERTICAL_RATE_THRESHOLD;
    case 'descending':
      return (ac.verticalRate ?? 0) < -VERTICAL_RATE_THRESHOLD;
  }
}
