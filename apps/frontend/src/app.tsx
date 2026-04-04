import { useCallback, useMemo, useState } from 'react';
import { useAircraftData } from '@/api/use-aircraft-data';
import { computeDerivedStats } from '@/features/kpi/derived-stats';
import { KpiStrip } from '@/features/kpi/KpiStrip';
import { MapView } from '@/features/map/MapView';
import type { AircraftFilter } from '@/shared/filters';

export function App() {
  const { aircraft, kpis } = useAircraftData();
  const [selectedIcao24, setSelectedIcao24] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<AircraftFilter>(null);

  const selectedAircraft = useMemo(
    () => aircraft.find((a) => a.icao24 === selectedIcao24) ?? null,
    [aircraft, selectedIcao24],
  );

  const derived = useMemo(() => computeDerivedStats(aircraft), [aircraft]);

  const handleAircraftClick = useCallback((icao24: string | null) => {
    setSelectedIcao24((prev) => (prev === icao24 ? null : icao24));
  }, []);

  const handleCloseInspector = useCallback(() => setSelectedIcao24(null), []);

  return (
    <div className="relative h-screen w-screen bg-background text-foreground">
      <MapView
        aircraft={aircraft}
        selectedAircraft={selectedAircraft}
        activeFilter={activeFilter}
        onAircraftClick={handleAircraftClick}
        onCloseInspector={handleCloseInspector}
      />
      <KpiStrip
        kpis={kpis}
        derived={derived}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />
    </div>
  );
}
