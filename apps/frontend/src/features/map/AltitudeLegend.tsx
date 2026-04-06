export function AltitudeLegend() {
  return (
    <div className="absolute bottom-6 left-6 z-10 flex flex-col rounded-lg border border-zinc-700/60 bg-zinc-900/80 p-3 shadow-xl backdrop-blur-md">
      <span className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
        Altitude
      </span>
      <div className="flex h-32 items-stretch gap-3">
        {/* The Gradient Bar */}
        <div
          className="w-3 rounded-full shadow-inner"
          style={{
            background:
              'linear-gradient(to top, rgb(0, 255, 255) 0%, rgb(0, 100, 255) 50%, rgb(200, 0, 255) 100%)',
          }}
        />
        {/* The Labels */}
        <div className="flex flex-col justify-between py-0.5 font-mono text-[10px] font-medium text-zinc-300">
          <span>40,000+ ft</span>
          <span>20,000 ft</span>
          <span>Surface</span>
        </div>
      </div>
    </div>
  );
}
