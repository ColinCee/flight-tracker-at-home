import { describe, expect, it } from 'vitest';
import { computeSecondsLeft, formatCountdown, resolveHealthLabel } from './kpi-helpers';

describe('resolveHealthLabel', () => {
  it('returns "Live" for live status', () => {
    const result = resolveHealthLabel('live');
    expect(result.label).toBe('Live');
    expect(result.color).toContain('emerald');
  });

  it('returns "Stale" for stale status', () => {
    const result = resolveHealthLabel('stale');
    expect(result.label).toBe('Stale');
    expect(result.color).toContain('amber');
  });

  it('returns "Offline" for offline status', () => {
    const result = resolveHealthLabel('offline');
    expect(result.label).toBe('Offline');
    expect(result.color).toContain('red');
  });

  it('returns "Connecting" when apiHealth is undefined (loading)', () => {
    const result = resolveHealthLabel(undefined);
    expect(result.label).toBe('Connecting');
    expect(result.color).toContain('animate-pulse');
  });

  it('falls back to "Offline" for unknown status values', () => {
    const result = resolveHealthLabel('something-unexpected');
    expect(result.label).toBe('Offline');
    expect(result.color).toContain('red');
  });
});

describe('computeSecondsLeft', () => {
  it('returns null when dataUpdatedAt is 0 (no data yet)', () => {
    expect(computeSecondsLeft(0, 10_000, Date.now())).toBeNull();
  });

  it('returns full interval right after data arrives', () => {
    const now = 1_000_000;
    const result = computeSecondsLeft(now, 10_000, now);
    expect(result).toBe(10);
  });

  it('counts down as time passes', () => {
    const updatedAt = 1_000_000;
    const pollInterval = 10_000;
    const now = updatedAt + 3_000; // 3 seconds later
    expect(computeSecondsLeft(updatedAt, pollInterval, now)).toBe(7);
  });

  it('returns 0 when poll time has passed', () => {
    const updatedAt = 1_000_000;
    const pollInterval = 10_000;
    const now = updatedAt + 12_000; // 2 seconds past due
    expect(computeSecondsLeft(updatedAt, pollInterval, now)).toBe(0);
  });

  it('never returns negative values', () => {
    const updatedAt = 1_000_000;
    const pollInterval = 10_000;
    const now = updatedAt + 999_999; // way past due
    expect(computeSecondsLeft(updatedAt, pollInterval, now)).toBe(0);
  });

  it('rounds up partial seconds', () => {
    const updatedAt = 1_000_000;
    const pollInterval = 10_000;
    const now = updatedAt + 3_100; // 3.1s elapsed → 6.9s left → ceil to 7
    expect(computeSecondsLeft(updatedAt, pollInterval, now)).toBe(7);
  });

  it('works with different poll intervals', () => {
    const updatedAt = 1_000_000;
    const now = updatedAt + 5_000;
    expect(computeSecondsLeft(updatedAt, 15_000, now)).toBe(10);
    expect(computeSecondsLeft(updatedAt, 5_000, now)).toBe(0);
  });
});

describe('formatCountdown', () => {
  it('returns null when secondsLeft is null', () => {
    expect(formatCountdown(null)).toBeNull();
  });

  it('shows "updating…" when countdown reaches 0', () => {
    expect(formatCountdown(0)).toBe('updating…');
  });

  it('shows remaining seconds when counting down', () => {
    expect(formatCountdown(7)).toBe('next 7s');
    expect(formatCountdown(1)).toBe('next 1s');
  });
});
