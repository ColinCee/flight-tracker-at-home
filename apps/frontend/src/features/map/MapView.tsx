import 'maplibre-gl/dist/maplibre-gl.css';

import type { MapStyleDataEvent } from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AttributionControl, Map as MapGL, Popup } from 'react-map-gl/maplibre';
import type { AircraftState } from '@/api/generated';
import type { EnrichedAirportWeather } from '@/api/use-weather-data';
import type { AircraftFilter } from '@/shared/filters';
import { AircraftInspector } from './AircraftInspector';
import { AircraftLayer } from './AircraftLayer';
import { AirportInspector } from './AirportInspector';
import { AirportLayer } from './AirportLayer';

const INITIAL_VIEW_STATE = {
  longitude: -0.12,
  latitude: 51.49,
  zoom: 10,
};

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';

interface MapViewProps {
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
      <AircraftLayer
        aircraft={aircraft}
        selectedIcao24={selectedAircraft?.icao24}
        activeFilter={activeFilter}
        onAircraftClick={handleAircraftClick}
        onHoverChange={setIsHoveringAircraft}
      />
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
          className="aircraft-popup"
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
          className="airport-popup"
          offset={20}
          maxWidth="none"
        >
          <AirportInspector airport={selectedAirport} onClose={onCloseInspector} />
        </Popup>
      )}
    </MapGL>
  );
}
