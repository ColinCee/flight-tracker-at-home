import { useCallback, useState } from 'react';
import type { AircraftState } from '@/api/generated';
import { AircraftInspector } from '@/components/AircraftInspector';
import { KpiStrip } from '@/components/KpiStrip';
import { MapView } from '@/components/MapView';
import { useAircraftData } from '@/hooks/useAircraftData';

export function App() {
  const { aircraft, kpis } = useAircraftData();
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftState | null>(null);

  const handleAircraftClick = useCallback((ac: AircraftState | null) => {
    setSelectedAircraft((prev) => (prev?.icao24 === ac?.icao24 ? null : ac));
  }, []);

  const handleCloseInspector = useCallback(() => setSelectedAircraft(null), []);

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <KpiStrip kpis={kpis} />
      <main className="relative flex-1">
        <MapView
          aircraft={aircraft}
          selectedIcao24={selectedAircraft?.icao24}
          onAircraftClick={handleAircraftClick}
        />
        {selectedAircraft && (
          <AircraftInspector aircraft={selectedAircraft} onClose={handleCloseInspector} />
        )}
      </main>
    </div>
  );
}

export default App;
