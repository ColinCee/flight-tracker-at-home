import { describe, expect, it } from 'vitest';
import type { HourlyHeatmap } from '@/api/generated';
import { extremes, hasEnoughData, latestHour, toClockDay, verdictFor } from './busy';

/** 24 hours ending 10:00 UTC on a winter day (London = UTC), from given averages. */
function hourly(aircraft: (number | null)[]): HourlyHeatmap {
  const first = Date.UTC(2026, 10, 1, 10) - 24 * 3600_000;
  return {
    resolution: 7,
    hours: aircraft.map((a, i) => ({
      start: new Date(first + i * 3600_000).toISOString(),
      aircraft: a ?? 0,
      snapshots: a == null ? 0 : 60,
    })),
    cells: [],
  };
}

describe('toClockDay', () => {
  it('puts each rolling hour at its London clock hour', () => {
    const data = hourly(Array.from({ length: 24 }, (_, i) => i));
    const day = toClockDay(data);
    // The first hour starts at 10:00 the day before.
    expect(day[10]).toEqual({ hour: 10, aircraft: 0, index: 0 });
    expect(day[9]).toEqual({ hour: 9, aircraft: 23, index: 23 });
    expect(latestHour(data, day)).toBe(9);
  });

  it('shows British Summer Time an hour ahead of UTC', () => {
    const data: HourlyHeatmap = {
      resolution: 7,
      hours: [{ start: '2026-07-01T07:00:00Z', aircraft: 5, snapshots: 60 }],
      cells: [],
    };
    expect(toClockDay(data)[8]?.aircraft).toBe(5);
  });

  it('marks hours without snapshots as unknown, not quiet', () => {
    const day = toClockDay(hourly([...Array(23).fill(null), 4]));
    expect(day.filter((h) => h.aircraft != null)).toHaveLength(1);
    expect(hasEnoughData(day)).toBe(false);
    expect(hasEnoughData(toClockDay(undefined))).toBe(false);
  });
});

describe('verdictFor', () => {
  const day = toClockDay(hourly([10, 20, 30, 40, 50, null, ...Array(18).fill(null)]));
  // Index 0 is 10:00 London.
  it('ranks an hour against the others with data', () => {
    expect(verdictFor(day, 14)).toBe('The busiest hour of the day');
    expect(verdictFor(day, 10)).toBe('The quietest hour of the day');
    expect(verdictFor(day, 13)).toBe('Busier than 75% of the day');
    expect(verdictFor(day, 11)).toBe('Quieter than 75% of the day');
    expect(verdictFor(day, 3)).toBe('No data for this hour');
  });
  it('names the busiest and quietest hours', () => {
    expect(extremes(day)).toEqual({ busiest: 14, quietest: 10 });
  });
});
