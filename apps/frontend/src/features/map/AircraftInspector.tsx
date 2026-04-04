import {
  ArrowDown,
  ArrowUp,
  Compass,
  Gauge,
  Globe,
  Mountain,
  Plane,
  PlaneLanding,
  Radio,
  X,
} from 'lucide-react';
import type { AircraftState } from '@/api/generated';
import { Badge } from '@/shared/ui/badge';
import { formatHeading, metresToFeet, msToKnots } from '@/shared/units';

interface AircraftInspectorProps {
  aircraft: AircraftState;
  onClose: () => void;
}

function Field({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${accent ?? 'text-zinc-500'}`} />
      <span className="text-[11px] text-zinc-400">{label}</span>
      <span className="ml-auto font-mono text-xs text-zinc-200">{value}</span>
    </div>
  );
}

function VerticalRateIndicator({ rate }: { rate: number | null }) {
  if (rate == null || Math.abs(rate) < 0.5) return null;

  const isClimbing = rate > 0;
  const fpm = Math.round(rate * 196.85); // m/s → ft/min
  const Icon = isClimbing ? ArrowUp : ArrowDown;
  const color = isClimbing ? 'text-emerald-400' : 'text-amber-400';

  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(fpm).toLocaleString()} ft/min
    </span>
  );
}

export function AircraftInspector({ aircraft, onClose }: AircraftInspectorProps) {
  const callsign = aircraft.callsign?.trim() || null;
  const icao24 = aircraft.icao24.toUpperCase();

  return (
    <div className="w-60">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-zinc-700/60 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-700/60">
            <Plane className="h-4 w-4 -rotate-45 text-zinc-300" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm leading-tight font-semibold text-zinc-100">
              {callsign ?? icao24}
            </span>
            {callsign && (
              <span className="font-mono text-[10px] leading-tight text-zinc-500">{icao24}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 -mt-0.5 rounded p-0.5 text-zinc-500 transition-colors hover:bg-zinc-700/50 hover:text-zinc-300"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 pt-2 pb-1.5">
        {aircraft.isApproachingLhr && (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-400"
          >
            <PlaneLanding className="h-3 w-3" />
            Inbound LHR
          </Badge>
        )}
        {aircraft.onGround ? (
          <Badge
            variant="outline"
            className="border-zinc-600 bg-zinc-700/30 text-[10px] text-zinc-400"
          >
            On Ground
          </Badge>
        ) : (
          <VerticalRateIndicator rate={aircraft.verticalRate} />
        )}
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-1.5 pt-1">
        <Field
          icon={Mountain}
          label="Alt"
          value={aircraft.baroAltitude != null ? `${metresToFeet(aircraft.baroAltitude)} ft` : '—'}
        />
        <Field
          icon={Gauge}
          label="Speed"
          value={aircraft.velocity != null ? `${msToKnots(aircraft.velocity)} kts` : '—'}
        />
        <Field
          icon={Compass}
          label="Hdg"
          value={aircraft.trueTrack != null ? formatHeading(aircraft.trueTrack) : '—'}
        />
        <Field icon={Globe} label="Origin" value={aircraft.originCountry} />
        {aircraft.squawk && (
          <Field icon={Radio} label="Squawk" value={aircraft.squawk} accent="text-zinc-400" />
        )}
      </div>
    </div>
  );
}
