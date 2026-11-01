import { Flame, Radar, Search, X } from 'lucide-react';

export type View = 'live' | 'busy';

interface TopControlsProps {
  query: string;
  onQuery: (q: string) => void;
  view: View;
  onView: (v: View) => void;
}

const VIEWS = [
  { id: 'live', label: 'Live', Icon: Radar },
  { id: 'busy', label: 'Busy times', Icon: Flame },
] as const;

export function TopControls({ query, onQuery, view, onView }: TopControlsProps) {
  return (
    <header className="top">
      <search className="search">
        <Search className="search-icon" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Find a flight, airline or reg"
          aria-label="Find a flight, airline or registration"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {query && (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            onClick={() => onQuery('')}
          >
            <X aria-hidden />
          </button>
        )}
      </search>
      <div className="switch" role="tablist" aria-label="View">
        {VIEWS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => onView(id)}
          >
            <Icon aria-hidden />
            <span className="switch-label">{label}</span>
          </button>
        ))}
      </div>
    </header>
  );
}
