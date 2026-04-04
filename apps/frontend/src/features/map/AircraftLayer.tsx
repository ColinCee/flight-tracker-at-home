import type { PickingInfo } from '@deck.gl/core';
import { IconLayer } from '@deck.gl/layers';
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox';
import { useCallback, useMemo } from 'react';
import { useControl } from 'react-map-gl/maplibre';
import type { AircraftState } from '@/api/generated';
import { type AircraftFilter, matchesFilter } from '@/shared/filters';
import aircraftIconUrl from './aircraft.svg';

const AIRCRAFT_ICON = {
  url: aircraftIconUrl,
  width: 64,
  height: 64,
  mask: true,
};

const COLOR_DEFAULT: [number, number, number, number] = [255, 255, 255, 200];
const COLOR_APPROACHING: [number, number, number, number] = [255, 170, 0, 230];
const COLOR_SELECTED: [number, number, number, number] = [100, 200, 255, 255];
const COLOR_DIMMED: [number, number, number, number] = [255, 255, 255, 40];

function DeckGLOverlay(props: MapboxOverlayProps) {
  const overlay = useControl(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

interface AircraftLayerProps {
  aircraft: AircraftState[];
  selectedIcao24?: string | null;
  activeFilter?: AircraftFilter;
  onAircraftClick?: (icao24: string | null) => void;
}

export function AircraftLayer({
  aircraft,
  selectedIcao24,
  activeFilter,
  onAircraftClick,
}: AircraftLayerProps) {
  const handleClick = useCallback(
    (info: PickingInfo<AircraftState>) => {
      onAircraftClick?.(info.object?.icao24 ?? null);
    },
    [onAircraftClick],
  );

  const layers = useMemo(
    () => [
      new IconLayer<AircraftState>({
        id: 'aircraft-icons',
        data: aircraft,
        getIcon: () => AIRCRAFT_ICON,
        getPosition: (d) => [d.longitude, d.latitude],
        getSize: (d) => (d.icao24 === selectedIcao24 ? 30 : 24),
        getAngle: (d) => -(d.trueTrack ?? 0),
        getColor: (d) => {
          if (d.icao24 === selectedIcao24) return COLOR_SELECTED;
          if (activeFilter && !matchesFilter(d, activeFilter)) return COLOR_DIMMED;
          return d.isApproachingLhr ? COLOR_APPROACHING : COLOR_DEFAULT;
        },
        sizeScale: 1,
        sizeUnits: 'pixels',
        pickable: true,
        onClick: handleClick,
        updateTriggers: {
          getSize: selectedIcao24,
          getColor: [selectedIcao24, activeFilter],
        },
      }),
    ],
    [aircraft, selectedIcao24, activeFilter, handleClick],
  );

  return <DeckGLOverlay layers={layers} />;
}
