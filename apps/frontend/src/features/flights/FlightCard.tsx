import { X } from 'lucide-react';
import type { AircraftState } from '@/api/generated';
import { EMERGENCY_SQUAWKS, formatNumber, nameOf, phaseOf, statusOf, subtitleOf } from './flights';

const BAR_TOP_FT = 40_000;

export function FlightCard({ a, onClose }: { a: AircraftState; onClose: () => void }) {
  const alt = a.baroAltitudeFt;
  const vr = a.verticalRateFpm;
  const emergency = a.squawk ? EMERGENCY_SQUAWKS[a.squawk] : undefined;
  const meta = [
    a.registration && `Reg ${a.registration}`,
    a.squawk && `Squawk ${a.squawk}`,
    a.trueTrack != null && `Heading ${Math.round(a.trueTrack)}°`,
  ].filter(Boolean);

  return (
    <>
      <div className="panel-head card-head">
        <div>
          <h2>{nameOf(a)}</h2>
          {subtitleOf(a) && <p className="card-sub">{subtitleOf(a)}</p>}
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          <X aria-hidden />
        </button>
      </div>
      <div className="card" data-sheet-scroll>
        <p className="card-status" data-phase={phaseOf(a)}>
          {statusOf(a)}
        </p>
        {emergency && (
          <p className="card-emergency">
            {emergency} squawk ({a.squawk})
          </p>
        )}

        <dl className="readings">
          <div>
            <dt>Height</dt>
            <dd>
              {alt == null ? '—' : formatNumber(alt)}
              {alt != null && <small>ft</small>}
            </dd>
          </div>
          <div>
            <dt>Speed</dt>
            <dd>
              {a.groundSpeedKts == null ? '—' : formatNumber(a.groundSpeedKts)}
              {a.groundSpeedKts != null && <small>kt</small>}
            </dd>
          </div>
          <div>
            <dt>{a.isClimbing ? 'Climbing' : a.isDescending ? 'Descending' : 'Level'}</dt>
            <dd>
              {vr == null ? '—' : formatNumber(Math.abs(vr))}
              {vr != null && <small>ft/min</small>}
            </dd>
          </div>
        </dl>

        {/* The height reading above says it in words; this shows it at a glance. */}
        <div className="height-bar" aria-hidden>
          <div className="height-track">
            <span style={{ width: `${Math.min(100, ((alt ?? 0) / BAR_TOP_FT) * 100)}%` }} />
          </div>
          <div className="height-scale">
            <span>Ground</span>
            <span>20,000</span>
            <span>40,000 ft</span>
          </div>
        </div>

        {meta.length > 0 && <p className="card-meta">{meta.join(' · ')}</p>}
      </div>
    </>
  );
}
