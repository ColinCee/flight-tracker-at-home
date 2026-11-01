import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { useMemo } from 'react';
import type { HourlyHeatmap, HourlyHeatmapCell } from '@/api/generated';
import { useDeckLayers } from '@/features/map/deck-overlay';
import { heatColour } from './busy';

interface BusyLayerProps {
  data: HourlyHeatmap;
  /** Index into `data.hours`; -1 draws nothing. */
  index: number;
}

/** Flat hexagons, brighter where more aircraft were overhead in the chosen hour. */
export default function BusyLayer({ data, index }: BusyLayerProps) {
  // Aircraft-minutes per full hour, so an hour with missed snapshots is not dimmer.
  const perHour = useMemo(
    () => data.hours.map((h) => (h.snapshots ? 60 / h.snapshots : 0)),
    [data],
  );
  // One scale for the whole day, so a quiet hour looks quiet.
  const max = useMemo(() => {
    let m = 1;
    for (const c of data.cells) {
      c.counts.forEach((n, i) => {
        m = Math.max(m, n * (perHour[i] ?? 0));
      });
    }
    return m;
  }, [data, perHour]);

  const layers = useMemo(() => {
    const scale = perHour[index] ?? 0;
    const cells = index < 0 ? [] : data.cells.filter((c) => (c.counts[index] ?? 0) > 0);
    return [
      new H3HexagonLayer<HourlyHeatmapCell>({
        id: 'busy-hexagons',
        data: cells,
        getHexagon: (d) => d.hexId,
        extruded: false,
        stroked: false,
        getFillColor: (d) => heatColour(Math.sqrt(((d.counts[index] ?? 0) * scale) / max)),
        updateTriggers: { getFillColor: [index, max] },
      }),
    ];
  }, [data, index, max, perHour]);

  useDeckLayers('heatmap', layers);
  return null;
}
