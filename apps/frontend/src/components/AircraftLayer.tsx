import { IconLayer } from '@deck.gl/layers';
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox';
import { useMemo } from 'react';
import { useControl } from 'react-map-gl/maplibre';
import type { AircraftState } from '@/api/generated';
import aircraftIconUrl from '@/assets/aircraft.svg';

const AIRCRAFT_ICON = {
  url: aircraftIconUrl,
  width: 64,
  height: 64,
  mask: true,
};

const COLOR_DEFAULT: [number, number, number, number] = [255, 255, 255, 200];
const COLOR_APPROACHING: [number, number, number, number] = [255, 170, 0, 230];

function DeckGLOverlay(props: MapboxOverlayProps) {
  const overlay = useControl(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

interface AircraftLayerProps {
  aircraft: AircraftState[];
}

export function AircraftLayer({ aircraft }: AircraftLayerProps) {
  const layers = useMemo(
    () => [
      new IconLayer<AircraftState>({
        id: 'aircraft-icons',
        data: aircraft,
        getIcon: () => AIRCRAFT_ICON,
        getPosition: (d) => [d.longitude, d.latitude],
        getSize: 24,
        getAngle: (d) => -(d.trueTrack ?? 0),
        getColor: (d) => (d.isApproachingLhr ? COLOR_APPROACHING : COLOR_DEFAULT),
        sizeScale: 1,
        sizeUnits: 'pixels',
        pickable: true,
      }),
    ],
    [aircraft],
  );

  return <DeckGLOverlay layers={layers} />;
}
