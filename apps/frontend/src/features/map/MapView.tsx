import 'maplibre-gl/dist/maplibre-gl.css';

import type { MapStyleDataEvent } from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AttributionControl, Map as MapGL, Popup } from 'react-map-gl/maplibre';
import type { AircraftState } from '@/api/generated';
import type { EnrichedAirportWeather } from '@/api/use-weather-data';
import type { ViewMode } from '@/features/navigation/TopBar';
import type { AircraftFilter } from '@/shared/filters';
import { AircraftInspector } from './AircraftInspector';
import { AircraftLayer } from './AircraftLayer';
import { AirportInspector } from './AirportInspector';
import { AirportLayer } from './AirportLayer';
import { AltitudeLegend } from './AltitudeLegend';
import { HeatmapLayer } from './HeatmapLayer';

interface HexagonData {
  hex_id: string;
  total_volume: number;
  avg_altitude: number;
}

const INITIAL_VIEW_STATE = {
  longitude: -0.12,
  latitude: 51.49,
  zoom: 10,
};

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';

interface MapViewProps {
  viewMode: ViewMode;
  heatmapData?: HexagonData[];
  aircraft: AircraftState[];
  selectedAircraft?: AircraftState | null;
  airports: EnrichedAirportWeather[];
  selectedAirport?: EnrichedAirportWeather | null;
  activeFilter?: AircraftFilter;
  onAircraftClick?: (icao24: string) => void;
  onAirportClick?: (icao: string) => void;
  onCloseInspector: () => void;
}

export function MapView({
  viewMode,
  heatmapData,
  aircraft,
  selectedAircraft,
  airports,
  selectedAirport,
  activeFilter,
  onAircraftClick,
  onAirportClick,
  onCloseInspector,
}: MapViewProps) {
  const [isHoveringAircraft, setIsHoveringAircraft] = useState(false);
  const [isHoveringAirport, setIsHoveringAirport] = useState(false);
  const deckClickedRef = useRef(false);
  const [selectedHexagon, setSelectedHexagon] = useState<{
    data: HexagonData;
    lngLat: [number, number];
  } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseInspector();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCloseInspector]);

  // OpenFreeMap dark style references a "wood-pattern" sprite that's missing
  // from their sprite sheet. Remove the broken layer once the style loads.
  const handleStyleData = useCallback((e: MapStyleDataEvent) => {
    const map = e.target;
    if (map.getLayer('landcover_wood')) {
      map.removeLayer('landcover_wood');
    }
  }, []);

  // Deck.gl click fires before MapGL click in the same event cycle.
  // The ref prevents the map handler from dismissing a just-selected aircraft.
  const handleAircraftClick = useCallback(
    (icao24: string) => {
      deckClickedRef.current = true;
      onAircraftClick?.(icao24);
    },
    [onAircraftClick],
  );

  const handleAirportClick = useCallback(
    (icao: string) => {
      deckClickedRef.current = true;
      onAirportClick?.(icao);
    },
    [onAirportClick],
  );

  const handleMapClick = useCallback(() => {
    if (deckClickedRef.current) {
      deckClickedRef.current = false;
      return;
    }
    setSelectedHexagon(null); // Clear the hexagon popup on background click
    onCloseInspector();
  }, [onCloseInspector]);

  const handleHexagonClick = useCallback((data: HexagonData, lngLat: [number, number]) => {
    deckClickedRef.current = true; // Tell the map not to dismiss this click
    setSelectedHexagon({ data, lngLat });
  }, []);

  return (
    <MapGL
      initialViewState={INITIAL_VIEW_STATE}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLE}
      cursor={isHoveringAircraft || isHoveringAirport ? 'pointer' : 'grab'}
      onClick={handleMapClick}
      onStyleData={handleStyleData}
      attributionControl={false}
    >
      <AttributionControl compact position="top-left" />
      <AltitudeLegend />

      {/*Swap the layers based on the View Mode! */}
      {viewMode === 'live' ? (
        <AircraftLayer
          aircraft={aircraft}
          selectedIcao24={selectedAircraft?.icao24}
          activeFilter={activeFilter}
          onAircraftClick={handleAircraftClick}
          onHoverChange={setIsHoveringAircraft}
        />
      ) : (
        <HeatmapLayer data={heatmapData} onHexagonClick={handleHexagonClick} />
      )}
      <AirportLayer
        airports={airports}
        selectedIcao={selectedAirport?.icao}
        onAirportClick={handleAirportClick}
        onHoverChange={setIsHoveringAirport}
      />
      {selectedAircraft && (
        <Popup
          longitude={selectedAircraft.longitude}
          latitude={selectedAircraft.latitude}
          closeButton={false}
          closeOnClick={false}
          className="aircraft-popup"
          offset={20}
          maxWidth="none"
        >
          <AircraftInspector aircraft={selectedAircraft} onClose={onCloseInspector} />
        </Popup>
      )}
      {selectedAirport && (
        <Popup
          longitude={selectedAirport.longitude}
          latitude={selectedAirport.latitude}
          closeButton={false}
          closeOnClick={false}
          className="airport-popup"
          offset={20}
          maxWidth="none"
        >
          <AirportInspector airport={selectedAirport} onClose={onCloseInspector} />
        </Popup>
      )}
      {viewMode === 'heatmap' && selectedHexagon && (
        <Popup
          longitude={selectedHexagon.lngLat[0]}
          latitude={selectedHexagon.lngLat[1]}
          closeButton={false}
          closeOnClick={false}
          className="aircraft-popup" // Steal the aircraft CSS
          offset={10}
          maxWidth="none"
        >
          {/* Main Container mirroring AircraftInspector */}
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
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold leading-none text-zinc-100">
                    {Math.abs(selectedHexagon.lngLat[1]).toFixed(3)}°
                    {selectedHexagon.lngLat[1] >= 0 ? 'N' : 'S'},{' '}
                    {Math.abs(selectedHexagon.lngLat[0]).toFixed(3)}°
                    {selectedHexagon.lngLat[0] >= 0 ? 'E' : 'W'}
                  </span>
                  <span className="mt-1 font-mono text-[10px] text-zinc-500 uppercase">
                    Sector {selectedHexagon.data.hex_id.slice(-6)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHexagon(null)}
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
                  {selectedHexagon.data.total_volume}{' '}
                  <span className="text-xs text-zinc-500">acft</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Avg Altitude</span>
                <span className="font-mono font-medium text-zinc-100">
                  {Math.round(selectedHexagon.data.avg_altitude).toLocaleString()}{' '}
                  <span className="text-xs text-zinc-500">ft</span>
                </span>
              </div>
            </div>
          </div>
        </Popup>
      )}
    </MapGL>
  );
}
