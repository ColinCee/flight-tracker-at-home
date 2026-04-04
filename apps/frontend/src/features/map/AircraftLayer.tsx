import type { PickingInfo } from '@deck.gl/core';
import { IconLayer } from '@deck.gl/layers';
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox';
import { useCallback, useMemo, useState } from 'react';
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
const PICKING_RADIUS = 5;

function DeckGLOverlay(
  props: MapboxOverlayProps & {
    getCursor?: (state: { isDragging: boolean; isHovering: boolean }) => string;
    pickingRadius?: number;
  },
) {
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
  const [hoveredIcao24, setHoveredIcao24] = useState<string | null>(null);

  const handleClick = useCallback(
    (info: PickingInfo<AircraftState>) => {
      onAircraftClick?.(info.object?.icao24 ?? null);
    },
    [onAircraftClick],
  );

  const handleHover = useCallback((info: PickingInfo<AircraftState>) => {
    setHoveredIcao24(info.object?.icao24 ?? null);
  }, []);

  const getCursor = useCallback(
    ({ isDragging, isHovering }: { isDragging: boolean; isHovering: boolean }) => {
      if (isDragging) return 'grabbing';
      if (isHovering) return 'pointer';
      return 'grab';
    },
    [],
  );

  const layers = useMemo(
    () => [
      new IconLayer<AircraftState>({
        id: 'aircraft-icons',
        data: aircraft,
        getIcon: () => AIRCRAFT_ICON,
        getPosition: (d) => [d.longitude, d.latitude],
        getSize: (d) => {
          if (d.icao24 === selectedIcao24) return 30;
          if (d.icao24 === hoveredIcao24) return 27;
          return 24;
        },
        getAngle: (d) => -(d.trueTrack ?? 0),
        getColor: (d) => {
          if (d.icao24 === selectedIcao24) return COLOR_SELECTED;
          if (activeFilter && !matchesFilter(d, activeFilter)) return COLOR_DIMMED;
          return d.isApproachingLhr ? COLOR_APPROACHING : COLOR_DEFAULT;
        },
        sizeScale: 1,
        sizeUnits: 'pixels',
        pickable: true,
        autoHighlight: true,
        onClick: handleClick,
        onHover: handleHover,
        updateTriggers: {
          getSize: [selectedIcao24, hoveredIcao24],
          getColor: [selectedIcao24, activeFilter],
        },
      }),
    ],
    [aircraft, selectedIcao24, hoveredIcao24, activeFilter, handleClick, handleHover],
  );

  return <DeckGLOverlay layers={layers} getCursor={getCursor} pickingRadius={PICKING_RADIUS} />;
}
