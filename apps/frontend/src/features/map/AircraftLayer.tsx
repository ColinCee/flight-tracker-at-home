import type { PickingInfo } from '@deck.gl/core';
import { IconLayer } from '@deck.gl/layers';
import { useCallback, useMemo } from 'react';
import type { AircraftState } from '@/api/generated';
import { type AircraftFilter, matchesFilter } from '@/shared/filters';
import { useDeckLayers } from './deck-overlay';
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

const COLOR_APPROACHING: [number, number, number, number] = [255, 170, 0, 230];
const COLOR_SELECTED: [number, number, number, number] = [100, 200, 255, 255];
const COLOR_DIMMED: [number, number, number, number] = [255, 255, 255, 40];
const COLOR_EMERGENCY: [number, number, number, number] = [255, 60, 60, 255];
const COLOR_ROTORCRAFT: [number, number, number, number] = [80, 220, 120, 210];

interface AircraftLayerProps {
  aircraft: AircraftState[];
  selectedIcao24?: string | null;
  activeFilter?: AircraftFilter;
  onAircraftClick?: (icao24: string) => void;
}

function getAltitudeColor(alt: number | null | undefined): [number, number, number, number] {
  // Change fallback from 200 (bright white) to 40 (barely visible)
  if (alt == null) return [255, 255, 255, 40];

  const clampedAlt = Math.max(0, Math.min(alt, 40000));

  if (clampedAlt < 20000) {
    const t = clampedAlt / 20000;
    return [0, Math.round(255 - t * 155), 255, 230];
  } else {
    const t = (clampedAlt - 20000) / 20000;
    return [Math.round(t * 200), Math.round(100 - t * 100), 255, 230];
  }
}

export function AircraftLayer({
  aircraft,
  selectedIcao24,
  activeFilter,
  onAircraftClick,
}: AircraftLayerProps) {
  const handleClick = useCallback(
    (info: PickingInfo<AircraftState>) => {
      if (info.object) {
        onAircraftClick?.(info.object.icao24);
      }
    },
    [onAircraftClick],
  );

  const layers = useMemo(
    () => [
      new IconLayer<AircraftState>({
        id: 'aircraft-icons',
        data: aircraft,
        getIcon: (d) => getIconForCategory(d.category),
        getPosition: (d) => [d.longitude, d.latitude],
        getSize: (d) => (d.icao24 === selectedIcao24 ? 30 : 24),
        // Lie flat on the map so the heading stays true when the map is
        // rotated or pitched (a billboard rotates relative to the screen).
        billboard: false,
        getAngle: (d) => -(d.trueTrack ?? 0),
        getColor: (d) => {
          if (d.icao24 === selectedIcao24) return COLOR_SELECTED;
          if (d.squawk && EMERGENCY_SQUAWKS.has(d.squawk)) return COLOR_EMERGENCY;
          // 1. If the user selects a specific filter (like "Airborne") and it doesn't match
          if (activeFilter && !matchesFilter(d, activeFilter)) return COLOR_DIMMED;

          // 2. EXPLICIT GROUND CHECK: Force planes on the tarmac to be barely visible
          // so they never clutter the airport markers, even if no filters are active.
          if (d.onGround) return COLOR_DIMMED;
          if (d.destination != null) return COLOR_APPROACHING;
          if (d.category === 'Rotorcraft') return COLOR_ROTORCRAFT;
          return getAltitudeColor(d.baroAltitudeFt);
        },
        sizeScale: 1,
        sizeUnits: 'pixels',
        pickable: true,
        autoHighlight: true,
        onClick: handleClick,
        updateTriggers: {
          getSize: [selectedIcao24],
          getColor: [selectedIcao24, activeFilter],
        },
      }),
    ],
    [aircraft, selectedIcao24, activeFilter, handleClick],
  );

  useDeckLayers('aircraft', layers);
  return null;
}
