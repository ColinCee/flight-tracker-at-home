import { useCallback, useMemo, useState } from 'react';
import { getGetHeatmapQueryKey, useGetHeatmap } from '@/api/generated';
import { useAircraftData } from '@/api/use-aircraft-data';
import { useWeatherData } from '@/api/use-weather-data';
import { KpiStrip } from '@/features/kpi/KpiStrip';
import { MapView } from '@/features/map/MapView';
import { TopBar, type ViewMode } from '@/features/navigation/TopBar';
import type { AircraftFilter } from '@/shared/filters';

export function App() {
  const { aircraft, kpis } = useAircraftData();
  const { airports } = useWeatherData();
  const [selectedIcao24, setSelectedIcao24] = useState<string | null>(null);
  const [selectedAirportIcao, setSelectedAirportIcao] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<AircraftFilter>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('live');

  const selectedAircraft = useMemo(
    () => aircraft?.find((a) => a.icao24 === selectedIcao24) ?? null,
    [aircraft, selectedIcao24],
  );

  const selectedAirport = useMemo(
    () => airports?.find((a) => a.icao === selectedAirportIcao) ?? null,
    [airports, selectedAirportIcao],
  );

  const handleAircraftClick = useCallback((icao24: string) => {
    setSelectedIcao24((prev) => (prev === icao24 ? null : icao24));
    setSelectedAirportIcao(null);
  }, []);

  const handleAirportClick = useCallback((icao: string) => {
    setSelectedAirportIcao((prev) => (prev === icao ? null : icao));
    setSelectedIcao24(null);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setSelectedIcao24(null);
    setSelectedAirportIcao(null);
  }, []);

  const { data: heatmapData } = useGetHeatmap({
    query: {
      queryKey: getGetHeatmapQueryKey(),
      enabled: viewMode === 'heatmap',
    },
  });

  return (
    <main className="relative h-screen w-screen bg-background text-foreground">
      <TopBar activeView={viewMode} onViewChange={setViewMode} />

      {/* Render a single MapView and let it handle the ViewMode switching inside */}
      <MapView
        viewMode={viewMode}
        heatmapData={heatmapData?.data ?? []}
        aircraft={aircraft ?? []}
        selectedAircraft={selectedAircraft}
        airports={airports ?? []}
        selectedAirport={selectedAirport}
        activeFilter={activeFilter}
        onAircraftClick={handleAircraftClick}
        onAirportClick={handleAirportClick}
        onCloseInspector={handleCloseInspector}
      />

      {/* Only render the KPI strip if kpis actually exist */}
      {viewMode === 'live' && kpis && (
        <KpiStrip kpis={kpis} activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      )}
    </main>
  );
}
