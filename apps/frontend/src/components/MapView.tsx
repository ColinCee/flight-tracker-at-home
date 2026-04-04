import 'maplibre-gl/dist/maplibre-gl.css';

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
}

export function MapView({ aircraft }: MapViewProps) {
  return (
    <MapGL
      initialViewState={INITIAL_VIEW_STATE}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLE}
    >
      <AircraftLayer aircraft={aircraft} />
    </MapGL>
  );
}
