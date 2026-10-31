import { Hand, Info, Map as MapIcon, MousePointer2, Radar, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/shared/utils';

export type ViewMode = 'live' | 'heatmap';

const SEEN_3D_TIP_KEY = 'hasSeen3DTip';

// Storage throws when blocked (Safari private mode, some in-app browsers); then the tip shows each visit.
function hasSeenTip(): boolean {
  try {
    return localStorage.getItem(SEEN_3D_TIP_KEY) != null;
  } catch {
    return false;
  }
}

function markTipSeen() {
  try {
    localStorage.setItem(SEEN_3D_TIP_KEY, 'true');
  } catch {
    // Not remembered; harmless.
  }
}

interface TopBarProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

const TAB =
  'flex h-11 items-center gap-2 rounded-full px-4 text-xs font-semibold tracking-wider whitespace-nowrap uppercase transition-colors sm:h-8';

export function TopBar({ activeView, onViewChange }: TopBarProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Show the tip automatically the first time they open the heatmap.
  useEffect(() => {
    setShowTooltip(activeView === 'heatmap' && !hasSeenTip());
  }, [activeView]);

  const handleDismiss = () => {
    setShowTooltip(false);
    markTipSeen();
  };

  return (
    <div className="pointer-events-none absolute top-[max(env(safe-area-inset-top),0.75rem)] left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-3 sm:top-6">
      <nav
        aria-label="View"
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-900 p-1 shadow-lg sm:bg-zinc-900/80 sm:backdrop-blur-md"
      >
        <button
          type="button"
          onClick={() => onViewChange('live')}
          aria-pressed={activeView === 'live'}
          className={cn(
            TAB,
            activeView === 'live'
              ? 'bg-zinc-700 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 active:bg-zinc-800',
          )}
        >
          <Radar className="size-3.5" />
          Live Radar
        </button>

        <button
          type="button"
          onClick={() => onViewChange('heatmap')}
          aria-pressed={activeView === 'heatmap'}
          className={cn(
            TAB,
            activeView === 'heatmap'
              ? 'bg-zinc-700 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 active:bg-zinc-800',
          )}
        >
          <MapIcon className="size-3.5" />
          Heatmap
        </button>

        {activeView === 'heatmap' && (
          <button
            type="button"
            onClick={() => setShowTooltip(!showTooltip)}
            aria-label="3D controls help"
            aria-expanded={showTooltip}
            className={cn(
              'grid size-11 place-items-center rounded-full transition-colors sm:size-8',
              showTooltip
                ? 'bg-zinc-600 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 active:bg-zinc-800',
            )}
          >
            <Info className="size-4" />
          </button>
        )}
      </nav>

      {showTooltip && (
        <div
          role="note"
          className="pointer-events-auto flex w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-sky-500/30 bg-zinc-950 shadow-2xl tip-in"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 bg-sky-500/10 py-1 pr-1 pl-3">
            <span className="text-sm font-bold tracking-widest text-sky-300 uppercase">
              3D Map Controls
            </span>
            <button
              type="button"
              onClick={handleDismiss}
              className="grid size-11 place-items-center rounded-lg text-zinc-400 transition-colors hover:text-zinc-200 sm:size-8"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3 p-4 text-sm leading-relaxed text-zinc-300">
            <p>Column height is traffic volume. Tilt the map to see it in 3D.</p>
            <p className="flex gap-2.5">
              <Hand className="mt-0.5 size-4 shrink-0 text-sky-300" />
              <span>
                <span className="font-semibold text-zinc-100">Touch:</span> drag two fingers up or
                down to tilt, pinch to zoom, twist to rotate.
              </span>
            </p>
            <p className="flex gap-2.5">
              <MousePointer2 className="mt-0.5 size-4 shrink-0 text-sky-300" />
              <span>
                <span className="font-semibold text-zinc-100">Mouse:</span> right-drag, or hold{' '}
                <kbd className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-xs text-zinc-200">
                  Ctrl
                </kbd>{' '}
                and drag, to tilt and rotate.
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
