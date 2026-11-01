import { TextLayer } from '@deck.gl/layers';
import { useEffect, useMemo, useState } from 'react';
import { FONT_FAMILY } from '@/shared/font';
import { AIRPORTS } from './airports';
import { useDeckLayers } from './deck-overlay';

type Airport = (typeof AIRPORTS)[number];

/** Airport names on the map, so "Landing at Heathrow" has somewhere to point. */
export function AirportLayer() {
  // deck.gl draws text from a glyph atlas built once; build it after the font
  // arrives or the labels stay in the fallback face.
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    let live = true;
    document.fonts
      .load(`600 13px "${FONT_FAMILY}"`)
      .catch(() => undefined)
      .finally(() => live && setFontReady(true));
    return () => {
      live = false;
    };
  }, []);

  const layers = useMemo(
    () =>
      fontReady
        ? [
            new TextLayer<Airport>({
              id: 'airport-labels',
              data: AIRPORTS,
              getPosition: (d) => [d.lon, d.lat],
              getText: (d) => d.name,
              getSize: 13,
              getColor: [232, 233, 235, 235],
              fontFamily: FONT_FAMILY,
              fontWeight: 600,
              fontSettings: { sdf: true },
              outlineWidth: 3,
              outlineColor: [17, 18, 20, 255],
            }),
          ]
        : [],
    [fontReady],
  );

  useDeckLayers('airports', layers);
  return null;
}
