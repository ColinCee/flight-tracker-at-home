import type { AircraftState } from '@/api/generated';

export type AircraftFilter = 'airborne' | 'inbound-lhr' | 'climbing' | 'descending' | null;

// 1 m/s is approximately 3.28 feet per second
const VERTICAL_RATE_THRESHOLD_FPS = 3.28;

export function matchesFilter(ac: AircraftState, filter: AircraftFilter): boolean {
  switch (filter) {
    case null:
      return true;
    case 'airborne':
      return !ac.onGround;
    case 'inbound-lhr':
      return ac.isApproachingLhr;
    case 'climbing':
      return (ac.verticalSpeedFps ?? 0) > VERTICAL_RATE_THRESHOLD_FPS;
    case 'descending':
      return (ac.verticalSpeedFps ?? 0) < -VERTICAL_RATE_THRESHOLD_FPS;
  }
}
