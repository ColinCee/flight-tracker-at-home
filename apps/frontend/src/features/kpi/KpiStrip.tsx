import { useEffect, useState } from 'react';
import type { KPIs } from '@/api/generated';
import type { AircraftFilter } from '@/shared/filters';
import { Badge } from '@/shared/ui/badge';
import { computeSecondsLeft, formatCountdown, resolveHealthLabel } from './kpi-helpers';

interface KpiStripProps {
  kpis: KPIs | null;
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

function KpiItem({ label, value, isActive, onClick }: KpiItemProps) {
  const isClickable = onClick != null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 flex-col items-center gap-0.5 rounded-md px-3 py-1 transition-colors ${
        isClickable ? 'cursor-pointer hover:bg-zinc-700/50' : 'cursor-default'
      } ${isActive ? 'bg-zinc-700/70 ring-1 ring-zinc-500' : ''}`}
    >
      <span className="font-mono text-base font-semibold text-foreground">{value}</span>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </button>
  );
}

export function KpiStrip({
  kpis,
  activeFilter,
  onFilterChange,
  dataUpdatedAt,
  pollIntervalMs,
}: KpiStripProps) {
  const toggle = (id: AircraftFilter) => () => onFilterChange(activeFilter === id ? null : id);

  const health = resolveHealthLabel(kpis?.apiHealth);

  return (
    <div className="no-scrollbar pointer-events-auto absolute bottom-4 left-1/2 z-10 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-lg border border-zinc-600 bg-background/95 px-3 py-1.5 shadow-lg">
      <KpiItem
        label="Tracked"
        value={kpis?.trackedAircraft ?? '—'}
        isActive={activeFilter === null}
        onClick={() => onFilterChange(null)}
      />
      <Separator />
      <KpiItem
        label="Airborne"
        value={kpis?.airborneAircraft ?? '—'}
        isActive={activeFilter === 'airborne'}
        onClick={toggle('airborne')}
      />
      <Separator />
      <KpiItem
        label="Inbound London"
        value={kpis?.inboundLondonAircraft ?? '—'}
        isActive={activeFilter === 'inbound-london'}
        onClick={toggle('inbound-london')}
      />
      <Separator />
      <KpiItem
        label="Climbing"
        value={kpis?.climbingAircraft ?? '—'}
        isActive={activeFilter === 'climbing'}
        onClick={toggle('climbing')}
      />
      <Separator />
      <KpiItem
        label="Descending"
        value={kpis?.descendingAircraft ?? '—'}
        isActive={activeFilter === 'descending'}
        onClick={toggle('descending')}
      />
      <Separator />
      <KpiItem
        label="Avg Alt"
        value={kpis?.avgAltitudeFt != null ? `${kpis.avgAltitudeFt.toLocaleString()} ft` : '—'}
      />
      <Separator />
      <div className="flex shrink-0 flex-col items-center gap-0.5 px-3 py-1">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${health.color}`} />
          <Badge variant="outline" className="text-[11px] uppercase">
            {health.label}
          </Badge>
        </div>
        <PollCountdown dataUpdatedAt={dataUpdatedAt} pollIntervalMs={pollIntervalMs} />
      </div>
    </div>
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

  return <span className="text-[10px] tabular-nums text-muted-foreground">{text}</span>;
}

function Separator() {
  return <div className="h-6 w-px bg-zinc-600" />;
}
