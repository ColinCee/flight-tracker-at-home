import { Clock, Cloud, MapPin, Navigation, Thermometer, Wind, X } from 'lucide-react';
import type { EnrichedAirportWeather } from '@/api/use-weather-data';

interface AirportInspectorProps {
  airport: EnrichedAirportWeather;
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

export function AirportInspector({ airport, onClose }: AirportInspectorProps) {
  return (
    <div className="w-60">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-zinc-700/60 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-700/60">
            <MapPin className="h-4 w-4 text-zinc-300" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm leading-tight font-semibold text-zinc-100">
              {airport.name}
            </span>
            <span className="font-mono text-[10px] leading-tight text-zinc-500">
              {airport.icao}
            </span>
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

      {/* Fields */}
      <div className="flex flex-col gap-1.5 pt-3 pb-1">
        <Field icon={Cloud} label="Condition" value={airport.condition || '—'} />
        <Field
          icon={Thermometer}
          label="Temp"
          value={airport.temperatureC != null ? `${airport.temperatureC}°C` : '—'}
        />
        <Field
          icon={Wind}
          label="Wind Spd"
          value={airport.windSpeedKts != null ? `${Math.round(airport.windSpeedKts)} kts` : '—'}
        />
        <Field
          icon={Navigation}
          label="Wind Dir"
          value={airport.windDirectionDeg != null ? `${airport.windDirectionDeg}°` : '—'}
        />
        <Field
          icon={Clock}
          label="Updated"
          value={
            airport.timestamp
              ? new Date(airport.timestamp * 1000).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'
          }
        />
      </div>
    </div>
  );
}
