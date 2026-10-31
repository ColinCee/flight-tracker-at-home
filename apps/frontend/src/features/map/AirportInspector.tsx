import { Clock, Cloud, MapPin, Navigation, Thermometer, Wind } from 'lucide-react';
import type { EnrichedAirportWeather } from '@/api/use-weather-data';
import { Field, FieldGrid, InspectorHeader } from './InspectorParts';

interface AirportInspectorProps {
  airport: EnrichedAirportWeather;
  onClose: () => void;
}

/** MET Norway symbol codes ("partlycloudy_night") to plain words ("Partly cloudy"). */
export function formatCondition(code: string | null | undefined): string {
  if (!code) return '—';
  const words = code
    .replace(/_(day|night|polartwilight)$/, '')
    .replace(/(light|heavy|partly|clear|and)(?=[a-z])/g, '$1 ')
    .replace(/(rain|sleet|snow)(?=showers|and)/g, '$1 ')
    .replace(/showers(?=and)/g, 'showers ')
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function AirportInspector({ airport, onClose }: AirportInspectorProps) {
  return (
    <div>
      <InspectorHeader
        icon={MapPin}
        title={airport.name}
        subtitle={airport.icao}
        onClose={onClose}
      />

      <FieldGrid>
        <Field icon={Cloud} label="Condition" value={formatCondition(airport.condition)} />
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
      </FieldGrid>
    </div>
  );
}
