import 'maplibre-gl/dist/maplibre-gl.css';

import type { MapStyleDataEvent } from 'maplibre-gl';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { lazy, type ReactNode, Suspense, useCallback, useEffect, useState } from 'react';
import { AttributionControl, Map as MapGL } from 'react-map-gl/maplibre';
import type { AircraftState, HeatmapHexagon } from '@/api/generated';
import type { EnrichedAirportWeather } from '@/api/use-weather-data';
import type { ViewMode } from '@/features/navigation/TopBar';
import type { AircraftFilter } from '@/shared/filters';
import { AircraftLayer } from './AircraftLayer';
import { AirportLayer } from './AirportLayer';
import { AltitudeLegend } from './AltitudeLegend';
import { DeckOverlay } from './deck-overlay';
import { isCoarsePointer, pickPickingRadius, pickPixelRatio } from './device';

// The heatmap pulls in @deck.gl/geo-layers and h3-js; live radar never needs them.
const HeatmapLayer = lazy(() =>
  import('./HeatmapLayer').then((m) => ({ default: m.HeatmapLayer })),
);

// maplibre v6 finds its worker next to its own module, but Vite bundles that
// module and never emits the worker, so the map stays blank. Ship it as an asset.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

const INITIAL_VIEW_STATE = {
  longitude: -0.12,
  latitude: 51.49,
  zoom: 10,
};

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';

// A steep pitch shows the horizon and loads many more tiles; only the 3D
// heatmap needs it.
const MAX_PITCH: Record<ViewMode, number> = { live: 45, heatmap: 60 };

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
  // Read once: the device does not change while the page is open.
  const [device] = useState(() => {
    const coarse = isCoarsePointer();
    return {
      coarse,
      pixelRatio: pickPixelRatio(
        window.devicePixelRatio,
        Math.min(window.screen.width, window.screen.height),
      ),
      pickingRadius: pickPickingRadius(coarse),
    };
  });

  useEffect(() => {
    // Close any inspector when switching views
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

  return (
    <MapGL
      mapLib={maplibregl}
      initialViewState={INITIAL_VIEW_STATE}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLE}
      pixelRatio={device.pixelRatio}
      fadeDuration={0}
      maxPitch={MAX_PITCH[viewMode]}
      onStyleData={handleStyleData}
      attributionControl={false}
    >
      <AttributionControl compact position="top-left" />
      <AltitudeLegend />

      <DeckOverlay
        pickingRadius={device.pickingRadius}
        pixelRatio={device.pixelRatio}
        hover={!device.coarse}
        onEmptyClick={onCloseInspector}
      >
        {viewMode === 'live' ? (
          <AircraftLayer
            aircraft={aircraft}
            selectedIcao24={selectedIcao24}
            activeFilter={activeFilter}
            onAircraftClick={onAircraftClick}
          />
        ) : (
          <Suspense fallback={null}>
            <HeatmapLayer data={heatmapData} onHexagonClick={onHexagonClick} />
          </Suspense>
        )}
        <AirportLayer
          airports={airports}
          selectedIcao={selectedAirportIcao}
          onAirportClick={onAirportClick}
        />
      </DeckOverlay>
      {children}
    </MapGL>
  );
}
