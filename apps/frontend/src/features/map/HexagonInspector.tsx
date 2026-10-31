import { Hexagon, Layers, Mountain } from 'lucide-react';
import type { HeatmapHexagon } from '@/api/generated';
import { Field, FieldGrid, InspectorHeader } from './InspectorParts';

interface HexagonInspectorProps {
  hexagon: {
    data: HeatmapHexagon;
    lngLat: [number, number];
  };
  onClose: () => void;
}

function formatLngLat([lng, lat]: [number, number]): string {
  return `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(3)}°${lng >= 0 ? 'E' : 'W'}`;
}

export function HexagonInspector({ hexagon, onClose }: HexagonInspectorProps) {
  return (
    <div>
      <InspectorHeader
        icon={Hexagon}
        title={formatLngLat(hexagon.lngLat)}
        subtitle={`SECTOR ${hexagon.data.hexId.slice(-6).toUpperCase()}`}
        onClose={onClose}
      />
      <FieldGrid>
        <Field icon={Layers} label="Traffic volume" value={`${hexagon.data.totalVolume} acft`} />
        <Field
          icon={Mountain}
          label="Avg altitude"
          value={`${Math.round(hexagon.data.avgAltitude).toLocaleString()} ft`}
        />
      </FieldGrid>
    </div>
  );
}
