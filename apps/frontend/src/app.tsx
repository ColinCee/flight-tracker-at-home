import { useCallback, useMemo, useState } from 'react';
import { Popup } from 'react-map-gl/maplibre';
import { getGetHeatmapQueryKey, type HeatmapHexagon, useGetHeatmap } from '@/api/generated';
import { useAircraftData } from '@/api/use-aircraft-data';
import { useWeatherData } from '@/api/use-weather-data';
import { KpiStrip } from '@/features/kpi/KpiStrip';
import { AircraftInspector } from '@/features/map/AircraftInspector';
import { AirportInspector } from '@/features/map/AirportInspector';
import { HexagonInspector } from '@/features/map/HexagonInspector';
import { MapView } from '@/features/map/MapView';
import { TopBar, type ViewMode } from '@/features/navigation/TopBar';
import type { AircraftFilter } from '@/shared/filters';

export function App() {
  const { aircraft, kpis, isError, dataUpdatedAt, pollIntervalMs } = useAircraftData();
  const { airports } = useWeatherData();
  const [selectedIcao24, setSelectedIcao24] = useState<string | null>(null);
  const [selectedAirportIcao, setSelectedAirportIcao] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<AircraftFilter>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('live');
  const [selectedHexagon, setSelectedHexagon] = useState<{
    data: HeatmapHexagon;
    lngLat: [number, number];
  } | null>(null);

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

  const handleHexagonClick = useCallback((data: HeatmapHexagon, lngLat: [number, number]) => {
    setSelectedHexagon({ data, lngLat });
  }, []);

  const handleCloseInspector = useCallback(() => {
    setSelectedIcao24(null);
    setSelectedAirportIcao(null);
    setSelectedHexagon(null);
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
        selectedIcao24={selectedAircraft?.icao24}
        airports={airports ?? []}
        selectedAirportIcao={selectedAirport?.icao}
        activeFilter={activeFilter}
        onAircraftClick={handleAircraftClick}
        onAirportClick={handleAirportClick}
        onHexagonClick={handleHexagonClick}
        onCloseInspector={handleCloseInspector}
      >
        {selectedAircraft && (
          <Popup
            longitude={selectedAircraft.longitude}
            latitude={selectedAircraft.latitude}
            closeButton={false}
            closeOnClick={false}
            className="map-popup"
            offset={20}
            maxWidth="none"
          >
            <AircraftInspector aircraft={selectedAircraft} onClose={handleCloseInspector} />
          </Popup>
        )}
        {selectedAirport && (
          <Popup
            longitude={selectedAirport.longitude}
            latitude={selectedAirport.latitude}
            closeButton={false}
            closeOnClick={false}
            className="map-popup"
            offset={20}
            maxWidth="none"
          >
            <AirportInspector airport={selectedAirport} onClose={handleCloseInspector} />
          </Popup>
        )}
        {viewMode === 'heatmap' && selectedHexagon && (
          <Popup
            longitude={selectedHexagon.lngLat[0]}
            latitude={selectedHexagon.lngLat[1]}
            closeButton={false}
            closeOnClick={false}
            className="map-popup"
            offset={10}
            maxWidth="none"
          >
            <HexagonInspector hexagon={selectedHexagon} onClose={() => setSelectedHexagon(null)} />
          </Popup>
        )}
      </MapView>

      {viewMode === 'live' && (
        <KpiStrip
          kpis={kpis}
          isError={isError}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          dataUpdatedAt={dataUpdatedAt}
          pollIntervalMs={pollIntervalMs}
        />
      )}
    </main>
  );
}
