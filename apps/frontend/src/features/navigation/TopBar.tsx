import { Info, Map as MapIcon, MousePointer2, Radar, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/shared/utils';

export type ViewMode = 'live' | 'heatmap';

interface TopBarProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function TopBar({ activeView, onViewChange }: TopBarProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Automatically show the tooltip the first time they switch to the Heatmap
  useEffect(() => {
    if (activeView === 'heatmap') {
      const hasSeenTip = localStorage.getItem('hasSeen3DTip');
      if (!hasSeenTip) {
        setShowTooltip(true);
      }
    } else {
      // Hide it if they switch back to the live radar
      setShowTooltip(false);
    }
  }, [activeView]);

  const handleDismiss = () => {
    setShowTooltip(false);
    localStorage.setItem('hasSeen3DTip', 'true');
  };

  return (
    // We changed this wrapper to a flex-col so the tooltip drops down neatly below the bar
    <div className="absolute left-1/2 top-6 z-50 flex -translate-x-1/2 flex-col items-center gap-3">
      {/* 1. The Main Navigation Bar */}
      <div className="flex items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-900/80 p-1 opacity-60 backdrop-blur-md transition-all duration-300 hover:shadow-xl sm:opacity-40 sm:hover:opacity-100">
        <button
          type="button"
          onClick={() => onViewChange('live')}
          className={cn(
            'flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all',
            activeView === 'live'
              ? 'bg-zinc-700 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200',
          )}
        >
          <Radar className="h-3.5 w-3.5" />
          Live Radar
        </button>

        <div className="flex items-center">
          <button
            type="button"
            onClick={() => onViewChange('heatmap')}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all',
              activeView === 'heatmap'
                ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200',
            )}
          >
            <MapIcon className="h-3.5 w-3.5" />
            Heatmap
          </button>

          {/* Persistent Info Button (Only visible in Heatmap mode) */}
          {activeView === 'heatmap' && (
            <button
              type="button"
              onClick={() => setShowTooltip(!showTooltip)}
              className={cn(
                'ml-1 rounded-full p-1.5 transition-colors',
                showTooltip
                  ? 'bg-zinc-600 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
              )}
              title="3D Controls Info"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. The 3D Onboarding Tooltip */}
      {showTooltip && (
        <div className="flex animate-in slide-in-from-top-2 fade-in duration-300 w-72 flex-col overflow-hidden rounded-xl border border-blue-500/30 bg-zinc-950/95 shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between border-b border-zinc-800 bg-blue-500/10 p-3">
            <div className="flex items-center gap-2 text-blue-400">
              <MousePointer2 className="h-4 w-4" />
              <span className="text-sm font-bold uppercase tracking-widest">3D Map Controls</span>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-zinc-500 transition-colors hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 text-sm text-zinc-300 leading-relaxed">
            This heatmap is fully rendered in 3D space.
            <br />
            <br />
            For PC users, hold down{' '}
            <kbd className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-xs text-zinc-200">
              Right-Click
            </kbd>{' '}
            +{' '}
            <kbd className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-xs text-zinc-200">
              Ctrl
            </kbd>{' '}
            and drag your mouse to pitch the camera and explore the cityscape of flight volumes.
          </div>
        </div>
      )}
    </div>
  );
}
