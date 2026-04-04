import 'maplibre-gl/dist/maplibre-gl.css';

import type { MapStyleDataEvent } from 'maplibre-gl';
import { useCallback } from 'react';
import { Map as MapGL } from 'react-map-gl/maplibre';
import type { AircraftState } from '@/api/generated';
import { AircraftLayer } from './AircraftLayer';

const INITIAL_VIEW_STATE = {
  longitude: -0.12,
  latitude: 51.49,
  zoom: 10,
};

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';

interface MapViewProps {
  aircraft: AircraftState[];
  selectedIcao24?: string | null;
  onAircraftClick?: (aircraft: AircraftState | null) => void;
}

export function MapView({ aircraft, selectedIcao24, onAircraftClick }: MapViewProps) {
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
        selectedIcao24={selectedIcao24}
        onAircraftClick={onAircraftClick}
      />
    </MapGL>
  );
}
