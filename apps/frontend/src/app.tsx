import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { Popup } from 'react-map-gl/maplibre';
import { getGetHeatmapQueryKey, type HeatmapHexagon, useGetHeatmap } from '@/api/generated';
import { useAircraftData } from '@/api/use-aircraft-data';
import { useWeatherData } from '@/api/use-weather-data';
import { KpiStrip } from '@/features/kpi/KpiStrip';
import { AircraftInspector } from '@/features/map/AircraftInspector';
import { AirportInspector } from '@/features/map/AirportInspector';
import { HexagonInspector } from '@/features/map/HexagonInspector';
import { KeepClearOfSheet } from '@/features/map/KeepClearOfSheet';
import { MapView } from '@/features/map/MapView';
import { TopBar, type ViewMode } from '@/features/navigation/TopBar';
import type { AircraftFilter } from '@/shared/filters';
import { BottomSheet } from '@/shared/ui/bottom-sheet';
import { PHONE_QUERY, useMediaQuery } from '@/shared/use-media-query';

interface Selection {
  key: string;
  label: string;
  lngLat: [number, number];
  popupOffset: number;
  inspector: ReactNode;
}

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

  // Phones get a bottom sheet fixed to the screen; larger screens a popup on the map.
  const isPhone = useMediaQuery(PHONE_QUERY);
  const sheetRef = useRef<HTMLElement>(null);

  let selection: Selection | null = null;
  if (selectedAircraft) {
    selection = {
      key: `aircraft:${selectedAircraft.icao24}`,
      label: 'Aircraft details',
      lngLat: [selectedAircraft.longitude, selectedAircraft.latitude],
      popupOffset: 20,
      inspector: <AircraftInspector aircraft={selectedAircraft} onClose={handleCloseInspector} />,
    };
  } else if (selectedAirport) {
    selection = {
      key: `airport:${selectedAirport.icao}`,
      label: 'Airport weather',
      lngLat: [selectedAirport.longitude, selectedAirport.latitude],
      popupOffset: 20,
      inspector: <AirportInspector airport={selectedAirport} onClose={handleCloseInspector} />,
    };
  } else if (viewMode === 'heatmap' && selectedHexagon) {
    selection = {
      key: `hexagon:${selectedHexagon.data.hexId}`,
      label: 'Sector traffic',
      lngLat: selectedHexagon.lngLat,
      popupOffset: 10,
      inspector: <HexagonInspector hexagon={selectedHexagon} onClose={handleCloseInspector} />,
    };
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background text-foreground">
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
        {isPhone ? (
          <KeepClearOfSheet
            selectionKey={selection?.key ?? null}
            lngLat={selection?.lngLat ?? null}
            sheetRef={sheetRef}
          />
        ) : (
          selection && (
            <Popup
              key={selection.key}
              longitude={selection.lngLat[0]}
              latitude={selection.lngLat[1]}
              closeButton={false}
              closeOnClick={false}
              className="map-popup"
              offset={selection.popupOffset}
              maxWidth="none"
            >
              {selection.inspector}
            </Popup>
          )
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

      {isPhone && selection && (
        <BottomSheet ref={sheetRef} label={selection.label} onClose={handleCloseInspector}>
          {selection.inspector}
        </BottomSheet>
      )}
    </main>
  );
}
