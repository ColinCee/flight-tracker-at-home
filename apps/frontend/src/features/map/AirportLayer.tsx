import type { PickingInfo } from '@deck.gl/core';
import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { useCallback, useMemo } from 'react';
import type { EnrichedAirportWeather } from '@/api/use-weather-data';
import { useDeckLayers } from './deck-overlay';

interface AirportLayerProps {
  airports: EnrichedAirportWeather[];
  selectedIcao?: string | null;
  onAirportClick?: (icao: string) => void;
}

export function AirportLayer({ airports, selectedIcao, onAirportClick }: AirportLayerProps) {
  const handleClick = useCallback(
    (info: PickingInfo<EnrichedAirportWeather>) => {
      if (info.object) {
        onAirportClick?.(info.object.icao);
      }
    },
    [onAirportClick],
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
        getRadius: (d) => (d.icao === selectedIcao ? 12 : 8),
        radiusUnits: 'pixels',
        lineWidthUnits: 'pixels',
        getLineWidth: 2,
        pickable: true,
        autoHighlight: true,
        onClick: handleClick,
        updateTriggers: {
          getFillColor: [selectedIcao],
          getRadius: [selectedIcao],
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
    [airports, selectedIcao, handleClick],
  );

  useDeckLayers('airports', layers);
  return null;
}
