import type { PickingInfo } from '@deck.gl/core';
import { IconLayer, ScatterplotLayer } from '@deck.gl/layers';
import { useMemo } from 'react';
import type { AircraftState } from '@/api/generated';
import { EMERGENCY_SQUAWKS, phaseOf } from '@/features/flights/flights';
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

function iconFor(category: string) {
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

type RGBA = [number, number, number, number];

// Aircraft are the only colour on the map: amber landing, teal taking off,
// pale grey everything else, blue for the one you picked.
const COLOUR = {
  landing: [255, 179, 71, 245],
  departing: [79, 214, 196, 240],
  other: [228, 230, 233, 225],
  selected: [90, 169, 255, 255],
  emergency: [255, 92, 92, 255],
  hidden: [140, 143, 148, 60],
  ground: [140, 143, 148, 90],
} satisfies Record<string, RGBA>;

interface AircraftLayerProps {
  aircraft: AircraftState[];
  /** Aircraft the chip and search leave visible; the rest fade. */
  isShown: (a: AircraftState) => boolean;
  selectedId: string | null;
  onPick: (icao24: string) => void;
}

export function AircraftLayer({ aircraft, isShown, selectedId, onPick }: AircraftLayerProps) {
  const layers = useMemo(() => {
    const selected = aircraft.find((a) => a.icao24 === selectedId);
    return [
      new ScatterplotLayer<AircraftState>({
        id: 'aircraft-selected-ring',
        data: selected ? [selected] : [],
        getPosition: (d) => [d.longitude, d.latitude],
        getRadius: 26,
        radiusUnits: 'pixels',
        stroked: true,
        getFillColor: [90, 169, 255, 40],
        getLineColor: [90, 169, 255, 230],
        lineWidthUnits: 'pixels',
        getLineWidth: 2,
      }),
      new IconLayer<AircraftState>({
        id: 'aircraft-icons',
        data: aircraft,
        getIcon: (d) => iconFor(d.category),
        getPosition: (d) => [d.longitude, d.latitude],
        getSize: (d) => (d.icao24 === selectedId ? 30 : 22),
        // Lie flat on the map so the heading stays true.
        billboard: false,
        getAngle: (d) => -(d.trueTrack ?? 0),
        getColor: (d): RGBA => {
          if (d.icao24 === selectedId) return COLOUR.selected;
          if (d.squawk && d.squawk in EMERGENCY_SQUAWKS) return COLOUR.emergency;
          if (d.onGround) return COLOUR.ground;
          if (!isShown(d)) return COLOUR.hidden;
          return COLOUR[phaseOf(d)];
        },
        sizeUnits: 'pixels',
        pickable: true,
        onClick: (info: PickingInfo<AircraftState>) => {
          if (info.object) onPick(info.object.icao24);
        },
        updateTriggers: {
          getSize: [selectedId],
          getColor: [selectedId, isShown],
        },
      }),
    ];
  }, [aircraft, isShown, selectedId, onPick]);

  useDeckLayers('aircraft', layers);
  return null;
}
