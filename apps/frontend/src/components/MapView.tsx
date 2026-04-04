import 'maplibre-gl/dist/maplibre-gl.css';

import type { MapStyleDataEvent } from 'maplibre-gl';
import { useCallback } from 'react';
import { Map as MapGL, Popup } from 'react-map-gl/maplibre';
import type { AircraftState } from '@/api/generated';
import type { AircraftFilter } from '@/lib/filters';
import { AircraftInspector } from './AircraftInspector';
import { AircraftLayer } from './AircraftLayer';

const INITIAL_VIEW_STATE = {
  longitude: -0.12,
  latitude: 51.49,
  zoom: 10,
};

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';

interface MapViewProps {
  aircraft: AircraftState[];
  selectedAircraft?: AircraftState | null;
  activeFilter?: AircraftFilter;
  onAircraftClick?: (icao24: string | null) => void;
  onCloseInspector: () => void;
}

export function MapView({
  aircraft,
  selectedAircraft,
  activeFilter,
  onAircraftClick,
  onCloseInspector,
}: MapViewProps) {
  // OpenFreeMap dark style references a "wood-pattern" sprite that's missing
  // from their sprite sheet. Remove the broken layer once the style loads.
  const handleStyleData = useCallback((e: MapStyleDataEvent) => {
    const map = e.target;
    if (map.getLayer('landcover_wood')) {
      map.removeLayer('landcover_wood');
    }
  }, []);

  return (
    <MapGL
      initialViewState={INITIAL_VIEW_STATE}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLE}
      onStyleData={handleStyleData}
    >
      <AircraftLayer
        aircraft={aircraft}
        selectedIcao24={selectedAircraft?.icao24}
        activeFilter={activeFilter}
        onAircraftClick={onAircraftClick}
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
    </MapGL>
  );
}
