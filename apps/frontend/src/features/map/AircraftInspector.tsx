import {
  AlertTriangle,
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

const EMERGENCY_SQUAWKS: Record<string, string> = {
  '7700': 'Emergency',
  '7600': 'Radio Failure',
  '7500': 'Hijack',
};

function formatVerticalRate(fpm: number | null): string {
  if (fpm == null) return '—';
  return `${fpm > 0 ? '+' : ''}${fpm.toLocaleString()} fpm`;
}

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
        {aircraft.squawk && EMERGENCY_SQUAWKS[aircraft.squawk] && (
          <Badge
            variant="outline"
            className="gap-1 border-red-500/50 bg-red-500/15 text-[10px] font-semibold text-red-400"
          >
            <AlertTriangle className="h-3 w-3" />
            {EMERGENCY_SQUAWKS[aircraft.squawk]}
          </Badge>
        )}
        {aircraft.isApproachingLhr && (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-400"
          >
            <PlaneLanding className="h-3 w-3" />
            Inbound LHR
          </Badge>
        )}
        {aircraft.onGround && (
          <Badge
            variant="outline"
            className="border-zinc-600 bg-zinc-700/30 text-[10px] text-zinc-400"
          >
            On Ground
          </Badge>
        )}
        {aircraft.isClimbing && (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-400"
          >
            <ArrowUp className="h-3 w-3" />
            Climbing
          </Badge>
        )}
        {aircraft.isDescending && (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-400"
          >
            <ArrowDown className="h-3 w-3" />
            Descending
          </Badge>
        )}
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-1.5 pt-1">
        <Field
          icon={Mountain}
          label="Alt"
          value={
            aircraft.baroAltitudeFt != null ? `${Math.round(aircraft.baroAltitudeFt)} ft` : '—'
          }
        />
        <Field
          icon={Gauge}
          label="Speed"
          value={
            aircraft.groundSpeedKts != null ? `${Math.round(aircraft.groundSpeedKts)} kts` : '—'
          }
        />
        <Field
          icon={aircraft.isClimbing ? ArrowUp : ArrowDown}
          label="V/S"
          value={formatVerticalRate(aircraft.verticalRateFpm)}
          accent={
            aircraft.isClimbing
              ? 'text-emerald-400'
              : aircraft.isDescending
                ? 'text-amber-400'
                : undefined
          }
        />
        <Field
          icon={Compass}
          label="Hdg"
          value={aircraft.trueTrack != null ? `${Math.round(aircraft.trueTrack)}°` : '—'}
        />
        <Field icon={Plane} label="Type" value={aircraft.aircraftType ?? '—'} />
        <Field icon={Globe} label="Reg" value={aircraft.registration ?? '—'} />
        {aircraft.squawk && (
          <Field icon={Radio} label="Squawk" value={aircraft.squawk} accent="text-zinc-400" />
        )}
      </div>
    </div>
  );
}
