import type { AircraftState } from '@/api/generated';
import { METRES_TO_FEET } from '@/shared/units';

export interface DerivedStats {
  airborne: number;
  onGround: number;
  climbing: number;
  descending: number;
  avgAltitudeFt: number | null;
}

const VERTICAL_RATE_THRESHOLD = 1; // m/s

export function computeDerivedStats(aircraft: AircraftState[]): DerivedStats {
  let airborne = 0;
  let onGround = 0;
  let climbing = 0;
  let descending = 0;
  let altitudeSum = 0;
  let altitudeCount = 0;

  for (const ac of aircraft) {
    if (ac.onGround) {
      onGround++;
    } else {
      airborne++;
    }

    const vr = ac.verticalRate ?? 0;
    if (vr > VERTICAL_RATE_THRESHOLD) climbing++;
    else if (vr < -VERTICAL_RATE_THRESHOLD) descending++;

    if (ac.baroAltitude != null && !ac.onGround) {
      altitudeSum += ac.baroAltitude;
      altitudeCount++;
    }
  }

  const avgAltitudeFt =
    altitudeCount > 0
      ? Math.round(((altitudeSum / altitudeCount) * METRES_TO_FEET) / 100) * 100
      : null;

  return { airborne, onGround, climbing, descending, avgAltitudeFt };
}
