import { X } from 'lucide-react';
import type { AircraftState } from '@/api/generated';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatHeading, metresToFeet, msToKnots } from '@/lib/units';

interface AircraftInspectorProps {
  aircraft: AircraftState;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}

export function AircraftInspector({ aircraft, onClose }: AircraftInspectorProps) {
  const callsign = aircraft.callsign?.trim() || aircraft.icao24.toUpperCase();

  return (
    <Card className="absolute right-4 top-4 z-10 w-64 gap-0 border-border bg-background/90 py-0 backdrop-blur-sm">
      <CardHeader className="flex-row items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">{callsign}</CardTitle>
          {aircraft.isApproachingLhr && (
            <Badge variant="outline" className="border-amber-500/50 text-[10px] text-amber-400">
              LHR
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 px-4 pb-3">
        <Field label="Altitude" value={`${metresToFeet(aircraft.baroAltitude)} ft`} />
        <Field label="Speed" value={`${msToKnots(aircraft.velocity)} kts`} />
        <Field label="Heading" value={formatHeading(aircraft.trueTrack)} />
        <Field label="Origin" value={aircraft.originCountry} />
        {aircraft.squawk && <Field label="Squawk" value={aircraft.squawk} />}
        <Field label="On Ground" value={aircraft.onGround ? 'Yes' : 'No'} />
      </CardContent>
    </Card>
  );
}
