import { type ReactNode, type Ref, useRef, useState } from 'react';

const DISMISS_DISTANCE_PX = 80;
const DISMISS_VELOCITY_PX_PER_MS = 0.5;

interface BottomSheetProps {
  label: string;
  onClose: () => void;
  children: ReactNode;
  ref?: Ref<HTMLElement>;
}

/**
 * Non-modal sheet pinned to the bottom of the screen, for phones. Drag it down
 * or tap the handle to close; the map behind stays usable.
 */
export function BottomSheet({ label, onClose, children, ref }: BottomSheetProps) {
  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ startY: number; startT: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, startT: e.timeStamp };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.clientY - drag.current.startY);
    // Capture only once it is clearly a drag, so taps still reach buttons.
    if (dy > 6 && !e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDragY(dy);
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.clientY - drag.current.startY);
    const velocity = dy / Math.max(1, e.timeStamp - drag.current.startT);
    drag.current = null;
    setDragY(0);
    if (dy > DISMISS_DISTANCE_PX || (dy > 20 && velocity > DISMISS_VELOCITY_PX_PER_MS)) onClose();
  };

  return (
    <section
      ref={ref}
      role="dialog"
      aria-label={label}
      data-testid="inspector-sheet"
      className="sheet-in transition-transform duration-200 ease-out fixed inset-x-0 bottom-0 z-40 touch-none rounded-t-2xl border-t border-zinc-700/70 bg-zinc-950 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-8px_24px_rgb(0_0_0/0.45)] select-none"
      style={{
        // Follow the finger exactly while dragging; ease back when released.
        transform: dragY ? `translateY(${dragY}px)` : undefined,
        transition: dragY ? 'none' : undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss details"
        className="-mx-4 flex h-7 w-[calc(100%+2rem)] items-center justify-center"
      >
        <span className="h-1 w-10 rounded-full bg-zinc-600" />
      </button>
      {children}
    </section>
  );
}
