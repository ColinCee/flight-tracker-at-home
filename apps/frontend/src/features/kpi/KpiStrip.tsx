import type { KPIs } from '@/api/generated';
import type { AircraftFilter } from '@/shared/filters';
import { Badge } from '@/shared/ui/badge';

const FALLBACK_HEALTH = { color: 'bg-red-500', label: 'Offline' } as const;

const HEALTH_LABELS: Record<string, { color: string; label: string }> = {
  live: { color: 'bg-emerald-500', label: 'Live' },
  stale: { color: 'bg-amber-500', label: 'Stale' },
  offline: FALLBACK_HEALTH,
};

interface KpiStripProps {
  kpis: KPIs | null;
  activeFilter: AircraftFilter;
  onFilterChange: (filter: AircraftFilter) => void;
}

interface KpiItemProps {
  label: string;
  value: string | number;
  tooltip: string;
  isActive?: boolean;
  onClick?: () => void;
}

function KpiItem({ label, value, tooltip, isActive, onClick }: KpiItemProps) {
  const isClickable = onClick != null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col items-center gap-0.5 rounded-md px-3 py-1 transition-colors ${
        isClickable ? 'cursor-pointer hover:bg-zinc-700/50' : 'cursor-default'
      } ${isActive ? 'bg-zinc-700/70 ring-1 ring-zinc-500' : ''}`}
    >
      <span className="font-mono text-base font-semibold text-foreground">{value}</span>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="pointer-events-none absolute -top-9 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 shadow-lg group-hover:block">
        {tooltip}
      </span>
    </button>
  );
}

export function KpiStrip({ kpis, activeFilter, onFilterChange }: KpiStripProps) {
  if (!kpis) return null;

  const toggle = (id: AircraftFilter) => () => onFilterChange(activeFilter === id ? null : id);

  const health = HEALTH_LABELS[kpis.apiHealth] ?? FALLBACK_HEALTH;

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-zinc-600 bg-background/95 px-3 py-1.5 shadow-lg">
      <KpiItem
        label="Tracked"
        value={kpis.trackedAircraft}
        tooltip="Total aircraft tracked — click to show all"
        isActive={activeFilter === null}
        onClick={() => onFilterChange(null)}
      />
      <Separator />
      <KpiItem
        label="Airborne"
        value={kpis.airborneAircraft}
        tooltip="Aircraft currently in flight — click to highlight"
        isActive={activeFilter === 'airborne'}
        onClick={toggle('airborne')}
      />
      <Separator />
      <KpiItem
        label="Inbound LHR"
        value={kpis.inboundLhrAircraft}
        tooltip="Aircraft approaching Heathrow — click to highlight"
        isActive={activeFilter === 'inbound-lhr'}
        onClick={toggle('inbound-lhr')}
      />
      <Separator />
      <KpiItem
        label="Climbing"
        value={kpis.climbingAircraft}
        tooltip="Aircraft gaining altitude — click to highlight"
        isActive={activeFilter === 'climbing'}
        onClick={toggle('climbing')}
      />
      <Separator />
      <KpiItem
        label="Descending"
        value={kpis.descendingAircraft}
        tooltip="Aircraft losing altitude — click to highlight"
        isActive={activeFilter === 'descending'}
        onClick={toggle('descending')}
      />
      <Separator />
      <KpiItem
        label="Avg Alt"
        value={kpis.avgAltitudeFt != null ? `${kpis.avgAltitudeFt.toLocaleString()} ft` : '—'}
        tooltip="Average barometric altitude of airborne aircraft"
      />
      <Separator />
      <div className="group relative flex items-center gap-1.5 px-3">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${health.color}`} />
        <Badge variant="outline" className="text-[11px] uppercase">
          {health.label}
        </Badge>
        {kpis.apiCreditsRemaining != null && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {kpis.apiCreditsRemaining.toLocaleString()}
          </span>
        )}
        <span className="pointer-events-none absolute -top-9 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 shadow-lg group-hover:block">
          {kpis.apiCreditsRemaining != null
            ? `${kpis.apiCreditsRemaining.toLocaleString()} API credits remaining today`
            : 'Data source status'}
        </span>
      </div>
    </div>
  );
}

function Separator() {
  return <div className="h-6 w-px bg-zinc-600" />;
}
