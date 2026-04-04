import 'maplibre-gl/dist/maplibre-gl.css';

import { useEffect, useState } from 'react';
import type { StyleSpecification } from 'react-map-gl/maplibre';
import { Map as MapGL } from 'react-map-gl/maplibre';
import type { AircraftState } from '@/api/generated';
import { AircraftLayer } from './AircraftLayer';

const INITIAL_VIEW_STATE = {
  longitude: -0.12,
  latitude: 51.49,
  zoom: 10,
};

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

interface MapViewProps {
  aircraft: AircraftState[];
}

// OpenFreeMap dark style references a "wood-pattern" fill-pattern sprite
// that doesn't exist in their sprite sheet. Strip the broken layer.
async function fetchCleanStyle(): Promise<StyleSpecification> {
  const res = await fetch(STYLE_URL);
  const style: StyleSpecification = await res.json();
  style.layers = style.layers.filter(
    (l) => !('paint' in l && l.paint && 'fill-pattern' in l.paint),
  );
  return style;
}

export function MapView({ aircraft }: MapViewProps) {
  const [mapStyle, setMapStyle] = useState<StyleSpecification | null>(null);

  useEffect(() => {
    fetchCleanStyle().then(setMapStyle);
  }, []);

  if (!mapStyle) return null;

  return (
    <MapGL
      initialViewState={INITIAL_VIEW_STATE}
      style={{ width: '100%', height: '100%' }}
      mapStyle={mapStyle}
    >
      <AircraftLayer aircraft={aircraft} />
    </MapGL>
  );
}
