import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { AircraftState } from '@/api/generated';
import { getGetHourlyHeatmapQueryKey, useGetHourlyHeatmap } from '@/api/generated';
import { useAircraftData } from '@/api/use-aircraft-data';
import { BusyPanel } from '@/features/busy/BusyPanel';
import { latestHour, toClockDay } from '@/features/busy/busy';
import { TopControls, type View } from '@/features/controls/TopControls';
import { FlightCard } from '@/features/flights/FlightCard';
import { type Chip, matchesChip, matchesQuery, nearestFlights } from '@/features/flights/flights';
import { LivePanel } from '@/features/flights/LivePanel';
import { AircraftLayer } from '@/features/map/AircraftLayer';
import { AirportLayer } from '@/features/map/AirportLayer';
import { type Focus, MapView, type Padding } from '@/features/map/MapView';
import { Sheet } from '@/shared/ui/Sheet';
import { type Snap, snapHeights } from '@/shared/ui/sheet-snap';
import { useMediaQuery, WIDE_QUERY } from '@/shared/use-media-query';

// The busy-times layer pulls in @deck.gl/geo-layers and h3-js; live never needs them.
const BusyLayer = lazy(() => import('@/features/busy/BusyLayer'));

/** Desktop panel width plus its margins. */
const PANEL_SPACE = 440;

export function App() {
  const { aircraft, kpis, isError } = useAircraftData();
  const wide = useMediaQuery(WIDE_QUERY);
  const [view, setView] = useState<View>('live');
  const [chip, setChip] = useState<Chip>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [snap, setSnap] = useState<Snap>('half');
  const [pickedHour, setPickedHour] = useState<number | null>(null);

  const selected = aircraft.find((a) => a.icao24 === selectedId) ?? null;
  const flights = useMemo(() => nearestFlights(aircraft, chip, query), [aircraft, chip, query]);
  const isShown = useCallback(
    (a: AircraftState) => matchesChip(a, chip) && matchesQuery(a, query),
    [chip, query],
  );

  // A busy-times answer is fixed for the hour; the backend may not have the
  // endpoint yet (it deploys on its own schedule), so a 404 must not retry.
  const hourly = useGetHourlyHeatmap({
    query: {
      queryKey: getGetHourlyHeatmapQueryKey(),
      enabled: view === 'busy',
      retry: false,
      staleTime: 5 * 60_000,
    },
  });
  const hourlyData = hourly.data?.data;
  const day = useMemo(() => toClockDay(hourlyData), [hourlyData]);
  const hour = pickedHour ?? latestHour(hourlyData, day);

  // A peeking sheet has no room for a flight card or the hour chart.
  const lift = useCallback(() => setSnap((s) => (s === 'peek' ? 'half' : s)), []);

  const pick = useCallback(
    (icao24: string) => {
      setSelectedId(icao24);
      lift();
    },
    [lift],
  );
  const pickFromList = (icao24: string) => {
    const a = aircraft.find((x) => x.icao24 === icao24);
    if (a) setFocus({ lon: a.longitude, lat: a.latitude, zoom: 'in' });
    pick(icao24);
  };
  const close = useCallback(() => setSelectedId(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onQuery = (q: string) => {
    setQuery(q);
    setSelectedId(null);
    if (q) {
      setView('live');
      lift();
    }
  };
  const onView = (v: View) => {
    setView(v);
    setSelectedId(null);
    if (v === 'busy') {
      lift();
      // Heathrow's corridors sit west of centre; show them and the rest of London.
      setFocus({ lon: -0.25, lat: 51.48, zoom: 'out' });
    }
  };

  const padding: Padding = wide
    ? { top: 20, bottom: 20, left: PANEL_SPACE, right: 20 }
    : { top: 72, bottom: snapHeights(window.innerHeight)[snap], left: 0, right: 0 };

  return (
    <main className="app">
      <MapView padding={padding} focus={focus} wide={wide} onEmptyClick={close}>
        {view === 'live' ? (
          <AircraftLayer
            aircraft={aircraft}
            isShown={isShown}
            selectedId={selectedId}
            onPick={pick}
          />
        ) : (
          hourlyData && (
            <Suspense fallback={null}>
              <BusyLayer data={hourlyData} index={day[hour]?.index ?? -1} />
            </Suspense>
          )
        )}
        <AirportLayer />
      </MapView>

      <TopControls query={query} onQuery={onQuery} view={view} onView={onView} />

      <Sheet
        label={view === 'busy' ? 'Busy times' : selected ? 'Flight details' : 'Flights'}
        snap={snap}
        onSnap={setSnap}
        wide={wide}
      >
        {view === 'busy' ? (
          <BusyPanel day={day} hour={hour} onHour={setPickedHour} isLoading={hourly.isLoading} />
        ) : selected ? (
          <FlightCard a={selected} onClose={close} />
        ) : (
          <LivePanel
            aircraft={aircraft}
            flights={flights}
            kpis={kpis}
            isError={isError}
            query={query}
            chip={chip}
            onChip={setChip}
            onPick={pickFromList}
          />
        )}
      </Sheet>
    </main>
  );
}
