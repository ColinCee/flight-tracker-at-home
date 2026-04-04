import type { KPIs } from '@/api/generated';
import { Badge } from '@/components/ui/badge';

const HEALTH_COLORS: Record<string, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};

interface KpiStripProps {
  kpis: KPIs | null;
}

function KpiItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4">
      <span className="font-mono text-base font-semibold text-foreground">{value}</span>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

export function KpiStrip({ kpis }: KpiStripProps) {
  if (!kpis) return null;

  const healthColor = HEALTH_COLORS[kpis.apiHealth] ?? HEALTH_COLORS.red;

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-zinc-600 bg-background/95 px-4 py-2.5 shadow-lg">
      <KpiItem label="Tracked" value={kpis.trackedAircraft} />
      <Separator />
      <KpiItem label="Inbound LHR" value={kpis.inboundLhr} />
      <Separator />
      <KpiItem label="Throughput/hr" value={kpis.throughputLast60Min} />
      <Separator />
      <KpiItem label="Freshness" value={`${kpis.dataFreshnessSeconds}s`} />
      <Separator />
      <div className="flex items-center gap-1.5 px-4">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${healthColor}`} />
        <Badge variant="outline" className="text-[11px] uppercase">
          {kpis.apiHealth}
        </Badge>
      </div>
    </div>
  );
}

function Separator() {
  return <div className="h-6 w-px bg-zinc-600" />;
}
