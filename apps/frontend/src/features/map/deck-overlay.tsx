import type { Layer } from '@deck.gl/core';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { createContext, type ReactNode, useContext, useEffect, useRef } from 'react';
import { useControl } from 'react-map-gl/maplibre';

// One deck.gl overlay for the whole map. Each layer component registers its
// layers under a slot; slots draw in this order (later ones on top).
const SLOTS = ['heatmap', 'aircraft', 'airports'] as const;
type Slot = (typeof SLOTS)[number];

type SetLayers = (slot: Slot, layers: Layer[]) => void;
const DeckLayersContext = createContext<SetLayers | null>(null);

interface DeckOverlayProps {
  /**
   * The map's style has arrived. deck reads the style on every setProps, and
   * maplibre v6 has no style object until then, so layers wait for it.
   */
  styleReady: boolean;
  pickingRadius: number;
  /** Same cap as the map's pixel ratio, so phones do not draw at 3x. */
  pixelRatio: number;
  /** Touch screens have no hover, so skip hover picking and cursor changes. */
  hover: boolean;
  /** Clicks that hit no deck.gl object (empty map). */
  onEmptyClick: () => void;
  children: ReactNode;
}

export function DeckOverlay({
  styleReady,
  pickingRadius,
  pixelRatio,
  hover,
  onEmptyClick,
  children,
}: DeckOverlayProps) {
  const emptyClickRef = useRef(onEmptyClick);
  emptyClickRef.current = onEmptyClick;

  // Not interleaved: deck 9.2's interleaved mode reads map.transform, which
  // maplibre v6 no longer has. One overlay still means one extra canvas, not three.
  const overlay = useControl(
    ({ map }) =>
      new MapboxOverlay({
        useDevicePixels: pixelRatio,
        pickingRadius,
        onClick: (info) => {
          if (!info.picked) emptyClickRef.current();
        },
        // Set the cursor directly so hovering never re-renders React.
        onHover: hover
          ? (info) => {
              map.getCanvas().style.cursor = info.picked ? 'pointer' : '';
            }
          : undefined,
      }),
  );

  useEffect(() => {
    if (styleReady) overlay.setProps({ pickingRadius });
  }, [overlay, pickingRadius, styleReady]);

  const slotsRef = useRef(new Map<Slot, Layer[]>());
  const setLayersRef = useRef<SetLayers>((slot, layers) => {
    slotsRef.current.set(slot, layers);
    overlay.setProps({ layers: SLOTS.flatMap((s) => slotsRef.current.get(s) ?? []) });
  });

  return (
    <DeckLayersContext.Provider value={setLayersRef.current}>
      {styleReady && children}
    </DeckLayersContext.Provider>
  );
}

/** Show `layers` in `slot` of the map's deck.gl overlay while mounted. */
export function useDeckLayers(slot: Slot, layers: Layer[]) {
  const setLayers = useContext(DeckLayersContext);
  if (!setLayers) throw new Error('useDeckLayers must be used inside <DeckOverlay>');

  useEffect(() => {
    setLayers(slot, layers);
  }, [setLayers, slot, layers]);

  useEffect(() => () => setLayers(slot, []), [setLayers, slot]);
}
