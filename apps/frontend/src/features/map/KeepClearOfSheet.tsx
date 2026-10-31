import { type RefObject, useEffect } from 'react';
import { useMap } from 'react-map-gl/maplibre';

/** Space kept clear at the top for the view switcher. */
const TOP_CLEARANCE_PX = 72;
const MARGIN_PX = 32;

interface KeepClearOfSheetProps {
  /** Changes when the selection changes; the map pans once per selection, never to follow. */
  selectionKey: string | null;
  lngLat: [number, number] | null;
  sheetRef: RefObject<HTMLElement | null>;
}

/**
 * Render inside the map. When a selection opens the phone bottom sheet over the
 * selected point, pan the map so the point sits in the visible area above it.
 */
export function KeepClearOfSheet({ selectionKey, lngLat, sheetRef }: KeepClearOfSheetProps) {
  const { current: map } = useMap();

  // lngLat is left out of the deps on purpose: pan once per selection, not on every position update.
  useEffect(() => {
    if (!map || !selectionKey || !lngLat) return;
    const frame = requestAnimationFrame(() => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      // offsetHeight ignores the slide-in transform, so this is the settled height.
      const sheetTop = window.innerHeight - sheet.offsetHeight;
      const { y } = map.project(lngLat);
      if (y < sheetTop - MARGIN_PX && y > TOP_CLEARANCE_PX) return;
      const targetY = TOP_CLEARANCE_PX + (sheetTop - TOP_CLEARANCE_PX) / 2;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      map.panBy([0, y - targetY], { duration: reduceMotion ? 0 : 400 });
    });
    return () => cancelAnimationFrame(frame);
  }, [map, selectionKey]);

  return null;
}
