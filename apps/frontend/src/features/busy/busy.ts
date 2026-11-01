import type { HourlyHeatmap } from '@/api/generated';

/** One bar of the day chart, indexed by London clock hour (0-23). */
export interface ClockHour {
  hour: number;
  /** Average aircraft over the area; null when no snapshots were taken. */
  aircraft: number | null;
  /** Index into the API's `hours` (and each cell's `counts`), or -1. */
  index: number;
}

const londonHour = new Intl.DateTimeFormat('en-GB', {
  hour: 'numeric',
  hourCycle: 'h23',
  timeZone: 'Europe/London',
});

/** The API's rolling 24 hours, rearranged into a 00:00-23:00 London day. */
export function toClockDay(data: HourlyHeatmap | undefined): ClockHour[] {
  const day: ClockHour[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    aircraft: null,
    index: -1,
  }));
  data?.hours.forEach((h, index) => {
    const hour = Number(londonHour.format(new Date(h.start)));
    // On the day the clocks go back an hour repeats; the later one wins.
    if (h.snapshots > 0) day[hour] = { hour, aircraft: h.aircraft, index };
  });
  return day;
}

export const hourRange = (hour: number) =>
  `${String(hour).padStart(2, '0')}:00–${String((hour + 1) % 24).padStart(2, '0')}:00`;

/** Fewer hours than this with data and comparisons mean little. */
const MIN_HOURS = 3;

export function hasEnoughData(day: ClockHour[]): boolean {
  return day.filter((h) => h.aircraft != null).length >= MIN_HOURS;
}

/** How this hour compares with the other hours that have data. */
export function verdictFor(day: ClockHour[], hour: number): string {
  const known = day.filter((h) => h.aircraft != null) as (ClockHour & { aircraft: number })[];
  const own = day[hour]?.aircraft;
  if (own == null) return 'No data for this hour';
  const others = known.filter((h) => h.hour !== hour);
  if (others.every((h) => h.aircraft < own)) return 'The busiest hour of the day';
  if (others.every((h) => h.aircraft > own)) return 'The quietest hour of the day';
  const beats = Math.round((others.filter((h) => h.aircraft < own).length / others.length) * 100);
  return beats >= 50
    ? `Busier than ${beats}% of the day`
    : `Quieter than ${100 - beats}% of the day`;
}

export function extremes(day: ClockHour[]): { busiest: number; quietest: number } | null {
  const known = day.filter((h) => h.aircraft != null) as (ClockHour & { aircraft: number })[];
  if (known.length === 0) return null;
  const by = (cmp: (a: number, b: number) => boolean) =>
    known.reduce((best, h) => (cmp(h.aircraft, best.aircraft) ? h : best)).hour;
  return { busiest: by((a, b) => a > b), quietest: by((a, b) => a < b) };
}

/** The most recent hour with data: what someone opening the view most likely wants. */
export function latestHour(data: HourlyHeatmap | undefined, day: ClockHour[]): number {
  const last = data?.hours.findLastIndex((h) => h.snapshots > 0) ?? -1;
  return day.find((h) => h.index === last && last >= 0)?.hour ?? 0;
}

type RGB = [number, number, number];

// One violet hue, lightness only: it stays apart from the amber and teal aircraft and the grey map.
const RAMP: RGB[] = [
  [44, 31, 92],
  [75, 51, 163],
  [122, 90, 224],
  [185, 163, 255],
  [239, 232, 255],
];

/** Fill for a share (0-1) of the busiest cell-hour; dim cells also fade out. */
export function heatColour(t: number): [number, number, number, number] {
  const x = Math.max(0, Math.min(1, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x));
  const f = x - i;
  const [lo, hi] = [RAMP[i] as RGB, RAMP[i + 1] as RGB];
  const rgb = lo.map((c, k) => Math.round(c + ((hi[k] as number) - c) * f)) as RGB;
  return [...rgb, Math.round(t < 0.2 ? 60 + t * 500 : 160 + t * 95)];
}
