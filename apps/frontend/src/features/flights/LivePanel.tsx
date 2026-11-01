import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { AircraftState, KPIs } from '@/api/generated';
import { airlineOf } from './airlines';
import { type Chip, chipCounts, formatNumber, nameOf, phaseOf, statusOf } from './flights';

/** Rows drawn at once; the rest are further from London than anyone scrolls. */
const MAX_ROWS = 40;

interface LivePanelProps {
  aircraft: AircraftState[];
  flights: AircraftState[];
  kpis: KPIs | null;
  isError: boolean;
  query: string;
  chip: Chip;
  onChip: (c: Chip) => void;
  onPick: (icao24: string) => void;
}

const CHIPS: { id: Chip; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'landing', label: 'Landing' },
  { id: 'departing', label: 'Taking off' },
  { id: 'low', label: 'Low' },
];

export function LivePanel({
  aircraft,
  flights,
  kpis,
  isError,
  query,
  chip,
  onChip,
  onPick,
}: LivePanelProps) {
  const counts = chipCounts(aircraft);
  return (
    <>
      <div className="panel-head">
        <Headline kpis={kpis} isError={isError} />
        <fieldset className="chips" aria-label="Show only">
          {CHIPS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className="chip"
              aria-pressed={chip === id}
              onClick={() => onChip(id)}
            >
              {label}
              {id !== 'all' && <span className="chip-n">{counts[id]}</span>}
            </button>
          ))}
        </fieldset>
      </div>
      <ul className="flights" aria-label="Nearest flights" data-sheet-scroll>
        {flights.slice(0, MAX_ROWS).map((a) => (
          <li key={a.icao24}>
            <button type="button" onClick={() => onPick(a.icao24)}>
              <span className="flight-name">{nameOf(a)}</span>
              <span className="flight-sub">
                {[airlineOf(a.callsign), statusOf(a)].filter(Boolean).join(' · ')}
              </span>
              <span className="flight-alt">
                <Trend a={a} />
                {a.baroAltitudeFt == null ? '—' : `${formatNumber(a.baroAltitudeFt)} ft`}
              </span>
            </button>
          </li>
        ))}
        {kpis && flights.length === 0 && (
          <li className="flights-empty">
            {query
              ? `No flight matches “${query.trim()}” right now.`
              : 'Nothing in this group right now.'}
          </li>
        )}
      </ul>
    </>
  );
}

function Headline({ kpis, isError }: { kpis: KPIs | null; isError: boolean }) {
  if (!kpis) {
    return (
      <p className="headline">
        {isError ? 'Can’t reach the flight feed. Retrying…' : 'Finding flights over London…'}
      </p>
    );
  }
  const health = isError ? 'offline' : kpis.apiHealth;
  return (
    <p className="headline">
      <strong>{formatNumber(kpis.airborneAircraft)}</strong>{' '}
      {kpis.airborneAircraft === 1 ? 'flight' : 'flights'} in the sky over London
      <span className="live" data-health={health}>
        <i aria-hidden />
        {health === 'live' ? 'live' : health === 'stale' ? 'delayed' : 'offline'}
      </span>
    </p>
  );
}

function Trend({ a }: { a: AircraftState }) {
  if (a.isClimbing)
    return <ArrowUp className="trend" data-phase={phaseOf(a)} aria-label="climbing" />;
  if (a.isDescending)
    return <ArrowDown className="trend" data-phase={phaseOf(a)} aria-label="descending" />;
  return <Minus className="trend" aria-label="level" />;
}
