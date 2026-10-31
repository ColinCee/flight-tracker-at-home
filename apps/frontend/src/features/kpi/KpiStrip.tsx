import { useEffect, useState } from 'react';
import type { KPIs } from '@/api/generated';
import type { AircraftFilter } from '@/shared/filters';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/utils';
import { computeSecondsLeft, formatCountdown, resolveHealthLabel } from './kpi-helpers';

interface KpiStripProps {
  kpis: KPIs | null;
  isError: boolean;
  activeFilter: AircraftFilter;
  onFilterChange: (filter: AircraftFilter) => void;
  dataUpdatedAt: number;
  pollIntervalMs: number;
}

interface KpiItemProps {
  label: string;
  value: string | number;
  isActive?: boolean;
  onClick?: () => void;
}

const CELL =
  'flex min-h-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 sm:min-h-0 sm:rounded-md sm:px-3';

function KpiValue({ label, value }: { label: string; value: string | number }) {
  return (
    <>
      <span className="font-mono text-base font-semibold text-foreground tabular-nums">
        {value}
      </span>
      <span className="text-center text-[10px] leading-tight tracking-wide text-zinc-400 uppercase sm:text-[11px] sm:tracking-wider">
        {label}
      </span>
    </>
  );
}

/** A count that doubles as a map filter. */
function KpiFilter({ label, value, isActive, onClick }: KpiItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        CELL,
        'cursor-pointer bg-zinc-900 transition-colors hover:bg-zinc-800 active:bg-zinc-700 sm:bg-transparent sm:hover:bg-zinc-700/50',
        isActive && 'bg-zinc-700/70 ring-1 ring-zinc-500 sm:bg-zinc-700/70',
      )}
    >
      <KpiValue label={label} value={value} />
    </button>
  );
}

export function KpiStrip({
  kpis,
  isError,
  activeFilter,
  onFilterChange,
  dataUpdatedAt,
  pollIntervalMs,
}: KpiStripProps) {
  const toggle = (id: AircraftFilter) => () => onFilterChange(activeFilter === id ? null : id);

  const health = resolveHealthLabel(kpis?.apiHealth, isError);

  return (
    // Phones: a full-width dock, status row above a 3x2 grid, all visible at once.
    // sm and up: one centred row, as before.
    <section
      aria-label="Airspace summary"
      className="pointer-events-auto absolute inset-x-3 bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-10 flex flex-col gap-1 rounded-xl border border-zinc-700 bg-zinc-950 p-1.5 shadow-lg sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:w-max sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:flex-row sm:items-center sm:gap-0 sm:rounded-lg sm:border-zinc-600 sm:bg-background/95 sm:px-3"
    >
      <div className="no-scrollbar grid grid-cols-3 gap-1 sm:flex sm:items-center sm:overflow-x-auto">
        <KpiFilter
          label="Tracked"
          value={kpis?.trackedAircraft ?? '—'}
          isActive={activeFilter === null}
          onClick={() => onFilterChange(null)}
        />
        <Separator />
        <KpiFilter
          label="Airborne"
          value={kpis?.airborneAircraft ?? '—'}
          isActive={activeFilter === 'airborne'}
          onClick={toggle('airborne')}
        />
        <Separator />
        <KpiFilter
          label="Inbound London"
          value={kpis?.inboundLondonAircraft ?? '—'}
          isActive={activeFilter === 'inbound-london'}
          onClick={toggle('inbound-london')}
        />
        <Separator />
        <KpiFilter
          label="Climbing"
          value={kpis?.climbingAircraft ?? '—'}
          isActive={activeFilter === 'climbing'}
          onClick={toggle('climbing')}
        />
        <Separator />
        <KpiFilter
          label="Descending"
          value={kpis?.descendingAircraft ?? '—'}
          isActive={activeFilter === 'descending'}
          onClick={toggle('descending')}
        />
        <Separator />
        <div className={CELL}>
          <KpiValue
            label="Avg Alt"
            value={kpis?.avgAltitudeFt != null ? `${kpis.avgAltitudeFt.toLocaleString()} ft` : '—'}
          />
        </div>
      </div>
      <div className="order-first flex items-center gap-2 px-1.5 pt-0.5 sm:order-last sm:ml-1 sm:shrink-0 sm:flex-col sm:gap-0.5 sm:border-l sm:border-zinc-600 sm:py-1 sm:pr-0 sm:pl-4">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block size-2.5 rounded-full ${health.color}`} />
          <Badge variant="outline" className="text-[11px] uppercase">
            {health.label}
          </Badge>
        </div>
        <PollCountdown dataUpdatedAt={dataUpdatedAt} pollIntervalMs={pollIntervalMs} />
        <span className="ml-auto text-[11px] text-zinc-400 sm:hidden">Tap a count to filter</span>
      </div>
    </section>
  );
}

function PollCountdown({
  dataUpdatedAt,
  pollIntervalMs,
}: {
  dataUpdatedAt: number;
  pollIntervalMs: number;
}) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (dataUpdatedAt === 0) {
      setSecondsLeft(null);
      return;
    }

    function tick() {
      setSecondsLeft(computeSecondsLeft(dataUpdatedAt, pollIntervalMs, Date.now()));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [dataUpdatedAt, pollIntervalMs]);

  const text = formatCountdown(secondsLeft);
  if (!text) return null;

  return <span className="text-[11px] text-zinc-400 tabular-nums sm:text-[10px]">{text}</span>;
}

function Separator() {
  return <div className="hidden h-6 w-px shrink-0 bg-zinc-600 sm:block" />;
}
