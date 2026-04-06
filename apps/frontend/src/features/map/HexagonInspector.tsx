import type { HeatmapHexagon } from '@/api/generated';

interface HexagonInspectorProps {
  hexagon: {
    data: HeatmapHexagon;
    lngLat: [number, number];
  };
  onClose: () => void;
}

export function HexagonInspector({ hexagon, onClose }: HexagonInspectorProps) {
  return (
    <div className="flex w-64 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur-md">
      {/* Header Section */}
      <div className="flex items-start justify-between border-b border-zinc-800 bg-zinc-900/50 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800/80">
            {/* Using a simple SVG hexagon icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-zinc-400"
              aria-label="Hexagon icon"
            >
              <title>Hexagon sector</title>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-none text-zinc-100">
              {Math.abs(hexagon.lngLat[1]).toFixed(3)}°{hexagon.lngLat[1] >= 0 ? 'N' : 'S'},{' '}
              {Math.abs(hexagon.lngLat[0]).toFixed(3)}°{hexagon.lngLat[0] >= 0 ? 'E' : 'W'}
            </span>
            <span className="mt-1 font-mono text-[10px] text-zinc-500 uppercase">
              Sector {hexagon.data.hexId.slice(-6)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-label="Close"
          >
            <title>Close</title>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      {/* Data Rows Section */}
      <div className="flex flex-col gap-3 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Traffic Volume</span>
          <span className="font-mono font-medium text-zinc-100">
            {hexagon.data.totalVolume} <span className="text-xs text-zinc-500">acft</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Avg Altitude</span>
          <span className="font-mono font-medium text-zinc-100">
            {Math.round(hexagon.data.avgAltitude).toLocaleString()}{' '}
            <span className="text-xs text-zinc-500">ft</span>
          </span>
        </div>
      </div>
    </div>
  );
}
