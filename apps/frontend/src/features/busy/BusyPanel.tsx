import type { KeyboardEvent } from 'react';
import { type ClockHour, extremes, hasEnoughData, hourRange, verdictFor } from './busy';

interface BusyPanelProps {
  day: ClockHour[];
  hour: number;
  onHour: (h: number) => void;
  /** Still loading, so do not say there is no data yet. */
  isLoading: boolean;
}

export function BusyPanel({ day, hour, onHour, isLoading }: BusyPanelProps) {
  if (!hasEnoughData(day)) {
    return (
      <div className="panel-head">
        <p className="headline">
          {isLoading ? 'Loading busy times…' : 'Busy times will appear soon'}
        </p>
        {!isLoading && (
          <p className="explain">
            This view needs a few hours of recorded traffic. Check back later today.
          </p>
        )}
      </div>
    );
  }

  const max = Math.max(...day.map((h) => h.aircraft ?? 0));
  const ends = extremes(day);
  const onKey = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (hour + step + 24) % 24;
    onHour(next);
    (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
  };

  return (
    <>
      <div className="panel-head">
        <p className="busy-hour">{hourRange(hour)}</p>
        <p className="busy-verdict">{verdictFor(day, hour)}</p>
      </div>
      <div className="busy-body" data-sheet-scroll>
        <p className="explain">
          Brighter areas had more aircraft overhead in that hour. Pick an hour below.
        </p>
        <fieldset className="bars" aria-label="Hour of day" onKeyDown={onKey}>
          {day.map((h) => (
            <button
              type="button"
              key={h.hour}
              aria-pressed={h.hour === hour}
              aria-label={`${hourRange(h.hour)}${h.aircraft == null ? ', no data' : ''}`}
              tabIndex={h.hour === hour ? 0 : -1}
              onClick={() => onHour(h.hour)}
              style={{
                height: `${h.aircraft == null ? 3 : Math.max(5, (h.aircraft / max) * 100)}%`,
              }}
              data-empty={h.aircraft == null || undefined}
            />
          ))}
        </fieldset>
        <div className="bars-axis" aria-hidden>
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>
        {ends && (
          <p className="busy-meta">
            Busiest {hourRange(ends.busiest)}, quietest {hourRange(ends.quietest)}. From the last 24
            hours, London time.
          </p>
        )}
      </div>
    </>
  );
}
