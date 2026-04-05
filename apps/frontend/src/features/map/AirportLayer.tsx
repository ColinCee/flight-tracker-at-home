import type { PickingInfo } from '@deck.gl/core';
import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox';
import { useCallback, useMemo, useState } from 'react';
import { useControl } from 'react-map-gl/maplibre';
import type { EnrichedAirportWeather } from '@/api/use-weather-data';

function DeckGLOverlay(props: MapboxOverlayProps & { pickingRadius?: number }) {
  const overlay = useControl(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

interface AirportLayerProps {
  airports: EnrichedAirportWeather[];
  selectedIcao?: string | null;
  onAirportClick?: (icao: string) => void;
  onHoverChange?: (isHovering: boolean) => void;
}

export function AirportLayer({
  airports,
  selectedIcao,
  onAirportClick,
  onHoverChange,
}: AirportLayerProps) {
  const [hoveredIcao, setHoveredIcao] = useState<string | null>(null);

  const handleClick = useCallback(
    (info: PickingInfo<EnrichedAirportWeather>) => {
      if (info.object) {
        onAirportClick?.(info.object.icao);
      }
    },
    [onAirportClick],
  );

  const handleHover = useCallback(
    (info: PickingInfo<EnrichedAirportWeather>) => {
      const icao = info.object?.icao ?? null;
      setHoveredIcao(icao);
      onHoverChange?.(icao != null);
    },
    [onHoverChange],
  );

  const layers = useMemo(
    () => [
      new ScatterplotLayer<EnrichedAirportWeather>({
        id: 'airport-dots',
        data: airports,
        getPosition: (d) => [d.longitude, d.latitude],
        getFillColor: (d) =>
          d.icao === selectedIcao ? [100, 200, 255, 255] : [255, 255, 255, 180],
        getLineColor: [0, 0, 0, 255],
        getRadius: (d) => (d.icao === selectedIcao || d.icao === hoveredIcao ? 12 : 8),
        radiusUnits: 'pixels',
        lineWidthUnits: 'pixels',
        getLineWidth: 2,
        pickable: true,
        autoHighlight: true,
        onClick: handleClick,
        onHover: handleHover,
        updateTriggers: {
          getFillColor: [selectedIcao],
          getRadius: [selectedIcao, hoveredIcao],
        },
      }),
      new TextLayer<EnrichedAirportWeather>({
        id: 'airport-labels',
        data: airports,
        getPosition: (d) => [d.longitude, d.latitude],
        getText: (d) => d.icao,
        getSize: 12,
        getColor: [255, 255, 255, 255],
        getAlignmentBaseline: 'bottom',
        getPixelOffset: [0, -15],
        fontFamily: 'monospace',
      }),
    ],
    [airports, selectedIcao, hoveredIcao, handleClick, handleHover],
  );

  return <DeckGLOverlay layers={layers} pickingRadius={5} />;
}
