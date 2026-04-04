import { useCallback, useMemo, useState } from 'react';
import { KpiStrip } from '@/components/KpiStrip';
import { MapView } from '@/components/MapView';
import { useAircraftData } from '@/hooks/useAircraftData';

export function App() {
  const { aircraft, kpis } = useAircraftData();
  const [selectedIcao24, setSelectedIcao24] = useState<string | null>(null);

  // Derive selected aircraft from latest data so position stays current
  // and popup auto-dismisses when aircraft leaves radar
  const selectedAircraft = useMemo(
    () => aircraft.find((a) => a.icao24 === selectedIcao24) ?? null,
    [aircraft, selectedIcao24],
  );

  const handleAircraftClick = useCallback((icao24: string | null) => {
    setSelectedIcao24((prev) => (prev === icao24 ? null : icao24));
  }, []);

  const handleCloseInspector = useCallback(() => setSelectedIcao24(null), []);

  return (
    <div className="relative h-screen w-screen bg-background text-foreground">
      <MapView
        aircraft={aircraft}
        selectedAircraft={selectedAircraft}
        onAircraftClick={handleAircraftClick}
        onCloseInspector={handleCloseInspector}
      />
      <KpiStrip kpis={kpis} />
    </div>
  );
}

export default App;
