import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox';
import { useMemo } from 'react';
import { useControl } from 'react-map-gl/maplibre';
import type { HeatmapHexagon } from '@/api/generated';

function DeckGLOverlay(props: MapboxOverlayProps) {
  const overlay = useControl(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

// Magic constants for the hybrid piecewise curve and color ramp
const ELEVATION_SCALE_SMALL = 200;
const ELEVATION_BASE_LARGE = 2000;
const ELEVATION_GROWTH_LARGE = 400;
const SMALL_VOLUME_THRESHOLD = 10;
const ALTITUDE_TRANSITION_THRESHOLD = 20000;
const COLOR_BLUE_TO_PURPLE_MAX = 155;
const COLOR_PURPLE_TO_RED_MAX = 200;
const COLOR_PURPLE_TO_RED_MIN = 100;
const COLOR_ALPHA = 230;

interface HeatmapLayerProps {
  data?: HeatmapHexagon[];
  onHexagonClick?: (data: HeatmapHexagon, lngLat: [number, number]) => void;
}

export function HeatmapLayer({ data = [], onHexagonClick }: HeatmapLayerProps) {
  const layers = useMemo(() => {
    return [
      new H3HexagonLayer({
        id: 'h3-heatmap',
        data: data,
        getHexagon: (d: HeatmapHexagon) => d.hexId,
        extruded: true,

        // The Hybrid Piecewise Curve (Scaled up for visibility)
        getElevation: (d: HeatmapHexagon) => {
          const v = d.totalVolume;

          // 1. Linear growth for small numbers.
          if (v <= SMALL_VOLUME_THRESHOLD) {
            return v * ELEVATION_SCALE_SMALL;
          }

          // 2. Square root curve for large numbers.
          return (
            ELEVATION_BASE_LARGE + Math.sqrt(v - SMALL_VOLUME_THRESHOLD) * ELEVATION_GROWTH_LARGE
          );
        },

        // Lock the scale to 1 so our math above dictates the exact rendering height
        elevationScale: 1,

        getFillColor: (d: HeatmapHexagon) => {
          const alt = d.avgAltitude;
          if (alt < ALTITUDE_TRANSITION_THRESHOLD) {
            const t = Math.max(0, alt / ALTITUDE_TRANSITION_THRESHOLD);
            return [0, Math.round(255 - t * COLOR_BLUE_TO_PURPLE_MAX), 255, COLOR_ALPHA];
          } else {
            const t = Math.min(
              1,
              (alt - ALTITUDE_TRANSITION_THRESHOLD) / ALTITUDE_TRANSITION_THRESHOLD,
            );
            return [
              Math.round(t * COLOR_PURPLE_TO_RED_MAX),
              Math.round(COLOR_PURPLE_TO_RED_MIN - t * COLOR_PURPLE_TO_RED_MIN),
              255,
              COLOR_ALPHA,
            ];
          }
        },

        pickable: true,
        autoHighlight: true,
        onClick: (info) => {
          if (info.object && info.coordinate) {
            onHexagonClick?.(info.object as HeatmapHexagon, info.coordinate as [number, number]);
          }
        },
      }),
    ];
  }, [data, onHexagonClick]);

  return <DeckGLOverlay layers={layers} />;
}
