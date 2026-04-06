import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox';
import { useMemo } from 'react';
import { useControl } from 'react-map-gl/maplibre';

function DeckGLOverlay(props: MapboxOverlayProps) {
  const overlay = useControl(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

interface HexagonData {
  hex_id: string;
  total_volume: number;
  avg_altitude: number;
}

interface HeatmapLayerProps {
  data?: HexagonData[];
  onHexagonClick?: (data: HexagonData, lngLat: [number, number]) => void;
}

export function HeatmapLayer({ data = [], onHexagonClick }: HeatmapLayerProps) {
  const layers = useMemo(() => {
    return [
      new H3HexagonLayer({
        id: 'h3-heatmap',
        data: data,
        getHexagon: (d) => d.hex_id,
        extruded: true,

        // The Hybrid Piecewise Curve (Scaled up for visibility)
        getElevation: (d) => {
          const v = d.total_volume;

          // 1. Linear growth for small numbers (1 to 10).
          // 1 aircraft = 200 height. 5 aircraft = 1000. 10 aircraft = 2000.
          // This guarantees small traffic volumes are highly visible.
          if (v <= 10) {
            return v * 200;
          }

          // 2. Square root curve for large numbers (11+).
          // We anchor it at 2000 so the transition is perfectly smooth.
          // v=20 -> ~3200 height. v=50 -> ~4500 height. v=100 -> ~5800 height.
          return 2000 + Math.sqrt(v - 10) * 400;
        },

        // Lock the scale to 1 so our math above dictates the exact rendering height
        elevationScale: 1,

        getFillColor: (d) => {
          const alt = d.avg_altitude;
          if (alt < 20000) {
            const t = alt / 20000;
            return [0, Math.round(255 - t * 155), 255, 230];
          } else {
            const t = (alt - 20000) / 20000;
            return [Math.round(t * 200), Math.round(100 - t * 100), 255, 230];
          }
        },

        pickable: true,
        autoHighlight: true,
        onClick: (info) => {
          if (info.object && info.coordinate) {
            onHexagonClick?.(info.object, info.coordinate as [number, number]);
          }
        },
      }),
    ];
  }, [data, onHexagonClick]);

  return <DeckGLOverlay layers={layers} />;
}
