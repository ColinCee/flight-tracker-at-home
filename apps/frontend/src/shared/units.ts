// Metres → feet, m/s → knots conversions for display

export const METRES_TO_FEET = 3.28084;
const MS_TO_KNOTS = 1.94384;

/** Convert metres to feet, rounded to nearest 100 */
export function metresToFeet(metres: number | null): string {
  if (metres == null) return '—';
  return `${Math.round((metres * METRES_TO_FEET) / 100) * 100}`;
}

/** Convert m/s to knots, rounded to nearest integer */
export function msToKnots(ms: number | null): string {
  if (ms == null) return '—';
  return `${Math.round(ms * MS_TO_KNOTS)}`;
}

/** Format heading in degrees with ° suffix */
export function formatHeading(degrees: number | null): string {
  if (degrees == null) return '—';
  return `${Math.round(degrees)}°`;
}
