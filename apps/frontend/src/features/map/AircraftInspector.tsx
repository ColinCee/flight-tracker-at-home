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
} from 'lucide-react';
import type { AircraftState } from '@/api/generated';
import { Badge } from '@/shared/ui/badge';
import { Field, FieldGrid, InspectorHeader } from './InspectorParts';

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

export function AircraftInspector({ aircraft, onClose }: AircraftInspectorProps) {
  const callsign = aircraft.callsign?.trim() || null;
  const icao24 = aircraft.icao24.toUpperCase();

  return (
    <div>
      <InspectorHeader
        icon={PlaneIcon}
        title={callsign ?? icao24}
        subtitle={callsign ? icao24 : null}
        onClose={onClose}
      />

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 pt-2 empty:hidden">
        {aircraft.squawk && EMERGENCY_SQUAWKS[aircraft.squawk] && (
          <Badge
            variant="outline"
            className="gap-1 border-red-500/50 bg-red-500/15 text-[10px] font-semibold text-red-400"
          >
            <AlertTriangle className="h-3 w-3" />
            {EMERGENCY_SQUAWKS[aircraft.squawk]}
          </Badge>
        )}
        {aircraft.destination != null && (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-400"
          >
            <PlaneLanding className="h-3 w-3" />
            Inbound {aircraft.destination}
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

      <FieldGrid>
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
      </FieldGrid>
    </div>
  );
}

function PlaneIcon({ className }: { className?: string }) {
  return <Plane className={`-rotate-45 ${className ?? ''}`} />;
}
