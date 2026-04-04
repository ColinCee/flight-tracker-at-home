import type { KPIs } from '@/api/generated';
import type { DerivedStats } from '@/features/kpi/derived-stats';
import type { AircraftFilter } from '@/shared/filters';
import { Badge } from '@/shared/ui/badge';

const HEALTH_COLORS: Record<string, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};

interface KpiStripProps {
  kpis: KPIs | null;
  derived: DerivedStats;
  activeFilter: AircraftFilter;
  onFilterChange: (filter: AircraftFilter) => void;
}

interface KpiItemProps {
  label: string;
  value: string | number;
  tooltip: string;
  filterId?: AircraftFilter;
  activeFilter?: AircraftFilter;
  onFilterChange?: (filter: AircraftFilter) => void;
}

function KpiItem({ label, value, tooltip, filterId, activeFilter, onFilterChange }: KpiItemProps) {
  const isClickable = filterId != null;
  const isActive = isClickable && activeFilter === filterId;

  return (
    <button
      type="button"
      onClick={isClickable ? () => onFilterChange?.(isActive ? null : filterId) : undefined}
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

export function KpiStrip({ kpis, derived, activeFilter, onFilterChange }: KpiStripProps) {
  if (!kpis) return null;

  const healthColor = HEALTH_COLORS[kpis.apiHealth] ?? HEALTH_COLORS.red;

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-zinc-600 bg-background/95 px-3 py-1.5 shadow-lg">
      <KpiItem
        label="Tracked"
        value={kpis.trackedAircraft}
        tooltip="Total aircraft tracked in the London area"
      />
      <Separator />
      <KpiItem
        label="Airborne"
        value={derived.airborne}
        tooltip="Aircraft currently in flight — click to highlight"
        filterId="airborne"
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
      />
      <Separator />
      <KpiItem
        label="Inbound LHR"
        value={kpis.inboundLhr}
        tooltip="Aircraft approaching London Heathrow — click to highlight"
        filterId="inbound-lhr"
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
      />
      <Separator />
      <KpiItem
        label="Climbing"
        value={`${derived.climbing}↑ ${derived.descending}↓`}
        tooltip="Aircraft gaining / losing altitude — click to highlight climbing"
        filterId="climbing"
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
      />
      <Separator />
      <KpiItem
        label="Avg Alt"
        value={derived.avgAltitudeFt != null ? `${derived.avgAltitudeFt.toLocaleString()} ft` : '—'}
        tooltip="Average barometric altitude of airborne aircraft"
      />
      <Separator />
      <div className="group relative flex items-center gap-1.5 px-3">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${healthColor}`} />
        <Badge variant="outline" className="text-[11px] uppercase">
          {kpis.apiHealth}
        </Badge>
        <span className="pointer-events-none absolute -top-9 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 shadow-lg group-hover:block">
          API connection: green = ok, amber = degraded, red = down
        </span>
      </div>
    </div>
  );
}

function Separator() {
  return <div className="h-6 w-px bg-zinc-600" />;
}
