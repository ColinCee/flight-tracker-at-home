const LOADING_HEALTH = { color: 'bg-zinc-400 animate-pulse', label: 'Connecting' } as const;
const FALLBACK_HEALTH = { color: 'bg-red-500', label: 'Offline' } as const;

const HEALTH_LABELS: Record<string, { color: string; label: string }> = {
  live: { color: 'bg-emerald-500', label: 'Live' },
  stale: { color: 'bg-amber-500', label: 'Stale' },
  offline: FALLBACK_HEALTH,
};

export type HealthLabel = { color: string; label: string };

export function resolveHealthLabel(apiHealth: string | undefined): HealthLabel {
  if (!apiHealth) return LOADING_HEALTH;
  return HEALTH_LABELS[apiHealth] ?? FALLBACK_HEALTH;
}

export function computeSecondsLeft(
  dataUpdatedAt: number,
  pollIntervalMs: number,
  now: number,
): number | null {
  if (dataUpdatedAt === 0) return null;
  const remaining = Math.ceil((dataUpdatedAt + pollIntervalMs - now) / 1000);
  return Math.max(0, remaining);
}

export function formatCountdown(secondsLeft: number | null): string | null {
  if (secondsLeft == null) return null;
  return secondsLeft > 0 ? `next ${secondsLeft}s` : 'updating…';
}
