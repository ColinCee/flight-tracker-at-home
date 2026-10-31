import 'maplibre-gl/dist/maplibre-gl.css';

import { type MapStyleDataEvent, setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AttributionControl, Map as MapGL } from 'react-map-gl/maplibre';
import type { AircraftState, HeatmapHexagon } from '@/api/generated';
import type { EnrichedAirportWeather } from '@/api/use-weather-data';
import type { ViewMode } from '@/features/navigation/TopBar';
import type { AircraftFilter } from '@/shared/filters';
import { AircraftLayer } from './AircraftLayer';
import { AirportLayer } from './AirportLayer';
import { AltitudeLegend } from './AltitudeLegend';
import { HeatmapLayer } from './HeatmapLayer';

// maplibre v6 finds its worker next to its own module, but Vite bundles that
// module and never emits the worker, so the map stays blank. Ship it as an asset.
setWorkerUrl(maplibreWorkerUrl);

const INITIAL_VIEW_STATE = {
  longitude: -0.12,
  latitude: 51.49,
  zoom: 10,
};

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';

interface MapViewProps {
  viewMode: ViewMode;
  heatmapData?: HeatmapHexagon[];
  aircraft: AircraftState[];
  selectedIcao24?: string | null;
  airports: EnrichedAirportWeather[];
  selectedAirportIcao?: string | null;
  activeFilter?: AircraftFilter;
  onAircraftClick?: (icao24: string) => void;
  onAirportClick?: (icao: string) => void;
  onHexagonClick?: (data: HeatmapHexagon, lngLat: [number, number]) => void;
  onCloseInspector: () => void;
  /** Inspectors; rendered inside the map so they can use react-map-gl's Popup. */
  children?: ReactNode;
}

export function MapView({
  viewMode,
  heatmapData,
  aircraft,
  selectedIcao24,
  airports,
  selectedAirportIcao,
  activeFilter,
  onAircraftClick,
  onAirportClick,
  onHexagonClick,
  onCloseInspector,
  children,
}: MapViewProps) {
  const [isHoveringAircraft, setIsHoveringAircraft] = useState(false);
  const [isHoveringAirport, setIsHoveringAirport] = useState(false);
  const deckClickedRef = useRef(false);

  useEffect(() => {
    // Reset selection and hover states when switching views
    setIsHoveringAircraft(false);
    setIsHoveringAirport(false);
    onCloseInspector();
  }, [viewMode, onCloseInspector]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseInspector();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCloseInspector]);

  // OpenFreeMap dark style references a "wood-pattern" sprite that's missing
  // from their sprite sheet. Remove the broken layer once the style loads.
  const handleStyleData = useCallback((e: MapStyleDataEvent) => {
    const map = e.target;
    if (map.getLayer('landcover_wood')) {
      map.removeLayer('landcover_wood');
    }
  }, []);

  // Deck.gl click fires before MapGL click in the same event cycle.
  // The ref prevents the map handler from dismissing a just-selected aircraft.
  const handleAircraftClick = useCallback(
    (icao24: string) => {
      deckClickedRef.current = true;
      onAircraftClick?.(icao24);
    },
    [onAircraftClick],
  );

  const handleAirportClick = useCallback(
    (icao: string) => {
      deckClickedRef.current = true;
      onAirportClick?.(icao);
    },
    [onAirportClick],
  );

  const handleMapClick = useCallback(() => {
    if (deckClickedRef.current) {
      deckClickedRef.current = false;
      return;
    }
    onCloseInspector();
  }, [onCloseInspector]);

  const handleHexagonClick = useCallback(
    (data: HeatmapHexagon, lngLat: [number, number]) => {
      deckClickedRef.current = true; // Tell the map not to dismiss this click
      onHexagonClick?.(data, lngLat);
    },
    [onHexagonClick],
  );

  return (
    <MapGL
      initialViewState={INITIAL_VIEW_STATE}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLE}
      cursor={isHoveringAircraft || isHoveringAirport ? 'pointer' : 'grab'}
      onClick={handleMapClick}
      onStyleData={handleStyleData}
      attributionControl={false}
    >
      <AttributionControl compact position="top-left" />
      <AltitudeLegend />

      {/*Swap the layers based on the View Mode! */}
      {viewMode === 'live' ? (
        <AircraftLayer
          aircraft={aircraft}
          selectedIcao24={selectedIcao24}
          activeFilter={activeFilter}
          onAircraftClick={handleAircraftClick}
          onHoverChange={setIsHoveringAircraft}
        />
      ) : (
        <HeatmapLayer data={heatmapData} onHexagonClick={handleHexagonClick} />
      )}
      <AirportLayer
        airports={airports}
        selectedIcao={selectedAirportIcao}
        onAirportClick={handleAirportClick}
        onHoverChange={setIsHoveringAirport}
      />
      {children}
    </MapGL>
  );
}
