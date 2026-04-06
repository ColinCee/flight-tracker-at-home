import type { PickingInfo } from '@deck.gl/core';
import { IconLayer } from '@deck.gl/layers';
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox';
import { useCallback, useMemo, useState } from 'react';
import { useControl } from 'react-map-gl/maplibre';
import type { AircraftState } from '@/api/generated';
import { type AircraftFilter, matchesFilter } from '@/shared/filters';
import gliderUrl from './icons/glider.svg';
import helicopterUrl from './icons/helicopter.svg';
import jetUrl from './icons/jet.svg';
import propUrl from './icons/prop.svg';

const ICON_SIZE = { width: 64, height: 64, mask: true } as const;

const ICONS = {
  jet: { url: jetUrl, ...ICON_SIZE },
  prop: { url: propUrl, ...ICON_SIZE },
  helicopter: { url: helicopterUrl, ...ICON_SIZE },
  glider: { url: gliderUrl, ...ICON_SIZE },
};

function getIconForCategory(category: string) {
  switch (category) {
    case 'Rotorcraft':
      return ICONS.helicopter;
    case 'Light':
    case 'Ultralight':
      return ICONS.prop;
    case 'Glider':
    case 'Lighter-than-air':
      return ICONS.glider;
    default:
      return ICONS.jet;
  }
}

const EMERGENCY_SQUAWKS = new Set(['7500', '7600', '7700']);

const COLOR_DEFAULT: [number, number, number, number] = [255, 255, 255, 200];
const COLOR_APPROACHING: [number, number, number, number] = [255, 170, 0, 230];
const COLOR_SELECTED: [number, number, number, number] = [100, 200, 255, 255];
const COLOR_DIMMED: [number, number, number, number] = [255, 255, 255, 40];
const COLOR_EMERGENCY: [number, number, number, number] = [255, 60, 60, 255];
const COLOR_ROTORCRAFT: [number, number, number, number] = [80, 220, 120, 210];
const PICKING_RADIUS = 5;

function DeckGLOverlay(props: MapboxOverlayProps & { pickingRadius?: number }) {
  const overlay = useControl(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

interface AircraftLayerProps {
  aircraft: AircraftState[];
  selectedIcao24?: string | null;
  activeFilter?: AircraftFilter;
  onAircraftClick?: (icao24: string) => void;
  onHoverChange?: (isHovering: boolean) => void;
}

export function AircraftLayer({
  aircraft,
  selectedIcao24,
  activeFilter,
  onAircraftClick,
  onHoverChange,
}: AircraftLayerProps) {
  const [hoveredIcao24, setHoveredIcao24] = useState<string | null>(null);

  const handleClick = useCallback(
    (info: PickingInfo<AircraftState>) => {
      if (info.object) {
        onAircraftClick?.(info.object.icao24);
      }
    },
    [onAircraftClick],
  );

  const handleHover = useCallback(
    (info: PickingInfo<AircraftState>) => {
      const icao = info.object?.icao24 ?? null;
      setHoveredIcao24(icao);
      onHoverChange?.(icao != null);
    },
    [onHoverChange],
  );

  const layers = useMemo(
    () => [
      new IconLayer<AircraftState>({
        id: 'aircraft-icons',
        data: aircraft,
        getIcon: (d) => getIconForCategory(d.category),
        getPosition: (d) => [d.longitude, d.latitude],
        getSize: (d) => {
          if (d.icao24 === selectedIcao24) return 30;
          if (d.icao24 === hoveredIcao24) return 27;
          return 24;
        },
        getAngle: (d) => -(d.trueTrack ?? 0),
        getColor: (d) => {
          if (d.icao24 === selectedIcao24) return COLOR_SELECTED;
          if (d.squawk && EMERGENCY_SQUAWKS.has(d.squawk)) return COLOR_EMERGENCY;
          if (activeFilter && !matchesFilter(d, activeFilter)) return COLOR_DIMMED;
          if (d.destination != null) return COLOR_APPROACHING;
          if (d.category === 'Rotorcraft') return COLOR_ROTORCRAFT;
          return COLOR_DEFAULT;
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

  return <DeckGLOverlay layers={layers} pickingRadius={PICKING_RADIUS} />;
}
