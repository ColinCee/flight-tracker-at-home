const STOPS = 'rgb(0, 255, 255) 0%, rgb(0, 100, 255) 50%, rgb(200, 0, 255) 100%';

/**
 * Phones and short landscape screens: a slim horizontal bar top-right, clear of the
 * bottom dock. Larger screens: the vertical scale bottom-left.
 */
export function AltitudeLegend() {
  return (
    <div className="legend-compact:top-[calc(max(env(safe-area-inset-top),0.75rem)+3.75rem)] legend-compact:right-[max(env(safe-area-inset-right),0.75rem)] legend-compact:bottom-auto legend-compact:left-auto legend-compact:gap-1.5 legend-compact:bg-zinc-950 legend-compact:px-2.5 legend-compact:py-2 legend-compact:backdrop-blur-none pointer-events-none absolute bottom-6 left-6 z-10 flex flex-col rounded-lg border border-zinc-700/60 bg-zinc-900/80 p-3 shadow-xl backdrop-blur-md">
      <span className="legend-compact:mb-0 mb-2 text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
        Altitude
      </span>
      <div className="legend-compact:hidden flex h-32 items-stretch gap-3">
        <div
          className="w-3 rounded-full shadow-inner"
          style={{ background: `linear-gradient(to top, ${STOPS})` }}
        />
        <div className="flex flex-col justify-between py-0.5 font-mono text-[10px] font-medium text-zinc-300">
          <span>40,000+ ft</span>
          <span>20,000 ft</span>
          <span>Surface</span>
        </div>
      </div>
      <div className="legend-compact:flex hidden w-28 flex-col gap-1">
        <div
          className="h-2 rounded-full"
          style={{ background: `linear-gradient(to right, ${STOPS})` }}
        />
        <div className="flex justify-between font-mono text-[10px] font-medium text-zinc-300">
          <span>0</span>
          <span>20k</span>
          <span>40k+ ft</span>
        </div>
      </div>
    </div>
  );
}
