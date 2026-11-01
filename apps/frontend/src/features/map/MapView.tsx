import 'maplibre-gl/dist/maplibre-gl.css';

import type { MapStyleDataEvent } from 'maplibre-gl';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AttributionControl, Map as MapGL, type MapRef } from 'react-map-gl/maplibre';
import { DeckOverlay } from './deck-overlay';
import { isCoarsePointer, pickPickingRadius, pickPixelRatio } from './device';

// maplibre v6 finds its worker next to its own module, but Vite bundles that
// module and never emits the worker, so the map stays blank. Ship it as an asset.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';

export interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Focus {
  lon: number;
  lat: number;
  zoom: 'in' | 'out';
}

interface MapViewProps {
  /** Room taken by the panels, so the map's centre stays in the visible part. */
  padding: Padding;
  /** Pan here when it changes: in to a flight picked from the list, out for busy times. */
  focus: Focus | null;
  wide: boolean;
  onEmptyClick: () => void;
  /** deck.gl layer components. */
  children: ReactNode;
}

// OpenFreeMap's dark style references a "wood-pattern" sprite missing from its
// sprite sheet. Remove the broken layer once the style loads.
function dropBrokenLayer(e: MapStyleDataEvent) {
  if (e.target.getLayer('landcover_wood')) e.target.removeLayer('landcover_wood');
}

function onMapLoad({ target: map }: { target: maplibregl.Map }) {
  // A flat map: two-finger twists zoom but never rotate.
  map.touchZoomRotate.disableRotation();
  // MapLibre opens the compact attribution on load; start it folded to its (i) button.
  map
    .getContainer()
    .querySelector('.maplibregl-compact-show')
    ?.classList.remove('maplibregl-compact-show');
}

export function MapView({ padding, focus, wide, onEmptyClick, children }: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
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
  const [initialView] = useState(() => ({
    longitude: -0.2,
    latitude: 51.5,
    zoom: wide ? 9.4 : 8.8,
    padding,
  }));

  const { top, bottom, left, right } = padding;
  useEffect(() => {
    mapRef.current?.easeTo({ padding: { top, bottom, left, right }, duration: 250 });
  }, [top, bottom, left, right]);

  useEffect(() => {
    const map = mapRef.current;
    if (!focus || !map) return;
    const zoom = map.getZoom();
    map.easeTo({
      center: [focus.lon, focus.lat],
      // Close enough to see one flight; far enough to see the whole area.
      zoom: focus.zoom === 'in' ? Math.max(zoom, 10) : Math.min(zoom, wide ? 9 : 8.3),
      duration: 500,
    });
  }, [focus, wide]);

  return (
    <MapGL
      ref={mapRef}
      mapLib={maplibregl}
      initialViewState={initialView}
      style={{ position: 'absolute', inset: 0 }}
      mapStyle={MAP_STYLE}
      pixelRatio={device.pixelRatio}
      fadeDuration={0}
      // Flat map: no tilt or rotation, and none of the extra tiles a tilt loads.
      maxPitch={0}
      dragRotate={false}
      touchPitch={false}
      onStyleData={dropBrokenLayer}
      onLoad={onMapLoad}
      attributionControl={false}
    >
      <AttributionControl compact position={wide ? 'bottom-right' : 'top-right'} />
      <DeckOverlay
        pickingRadius={device.pickingRadius}
        pixelRatio={device.pixelRatio}
        hover={!device.coarse}
        onEmptyClick={onEmptyClick}
      >
        {children}
      </DeckOverlay>
    </MapGL>
  );
}
