import 'maplibre-gl/dist/maplibre-gl.css';

import type { MapStyleDataEvent } from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AttributionControl, Map as MapGL, Popup } from 'react-map-gl/maplibre';
import type { AircraftState, HeatmapHexagon } from '@/api/generated';
import type { EnrichedAirportWeather } from '@/api/use-weather-data';
import type { ViewMode } from '@/features/navigation/TopBar';
import type { AircraftFilter } from '@/shared/filters';
import { AircraftInspector } from './AircraftInspector';
import { AircraftLayer } from './AircraftLayer';
import { AirportInspector } from './AirportInspector';
import { AirportLayer } from './AirportLayer';
import { AltitudeLegend } from './AltitudeLegend';
import { HeatmapLayer } from './HeatmapLayer';
import { HexagonInspector } from './HexagonInspector';

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
  selectedAircraft?: AircraftState | null;
  airports: EnrichedAirportWeather[];
  selectedAirport?: EnrichedAirportWeather | null;
  activeFilter?: AircraftFilter;
  onAircraftClick?: (icao24: string) => void;
  onAirportClick?: (icao: string) => void;
  onCloseInspector: () => void;
}

export function MapView({
  viewMode,
  heatmapData,
  aircraft,
  selectedAircraft,
  airports,
  selectedAirport,
  activeFilter,
  onAircraftClick,
  onAirportClick,
  onCloseInspector,
}: MapViewProps) {
  const [isHoveringAircraft, setIsHoveringAircraft] = useState(false);
  const [isHoveringAirport, setIsHoveringAirport] = useState(false);
  const deckClickedRef = useRef(false);
  const [selectedHexagon, setSelectedHexagon] = useState<{
    data: HeatmapHexagon;
    lngLat: [number, number];
  } | null>(null);

  useEffect(() => {
    // Reset selection and hover states when switching views
    setIsHoveringAircraft(false);
    setIsHoveringAirport(false);
    setSelectedHexagon(null);
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
    setSelectedHexagon(null); // Clear the hexagon popup on background click
    onCloseInspector();
  }, [onCloseInspector]);

  const handleHexagonClick = useCallback((data: HeatmapHexagon, lngLat: [number, number]) => {
    deckClickedRef.current = true; // Tell the map not to dismiss this click
    setSelectedHexagon({ data, lngLat });
  }, []);

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
          selectedIcao24={selectedAircraft?.icao24}
          activeFilter={activeFilter}
          onAircraftClick={handleAircraftClick}
          onHoverChange={setIsHoveringAircraft}
        />
      ) : (
        <HeatmapLayer data={heatmapData} onHexagonClick={handleHexagonClick} />
      )}
      <AirportLayer
        airports={airports}
        selectedIcao={selectedAirport?.icao}
        onAirportClick={handleAirportClick}
        onHoverChange={setIsHoveringAirport}
      />
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
          <AircraftInspector aircraft={selectedAircraft} onClose={onCloseInspector} />
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
          <AirportInspector airport={selectedAirport} onClose={onCloseInspector} />
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
    </MapGL>
  );
}
