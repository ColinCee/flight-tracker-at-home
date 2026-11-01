import { type ReactNode, useRef, useState, useSyncExternalStore } from 'react';
import { SNAPS, type Snap, settle, snapHeights } from './sheet-snap';

const subscribeResize = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
};
const useViewportHeight = () => useSyncExternalStore(subscribeResize, () => window.innerHeight);

/** Movement before a press becomes a drag, so taps on chips and rows still click. */
const DRAG_SLOP = 6;

interface SheetProps {
  label: string;
  snap: Snap;
  onSnap: (snap: Snap) => void;
  /** Wide screens: a floating panel with no drag. */
  wide: boolean;
  children: ReactNode;
}

/**
 * The one panel the app has. On phones a bottom sheet with three resting
 * heights, dragged from anywhere outside its scrolling list; a flick moves
 * one step. Children mark their scrolling part with `data-sheet-scroll`.
 */
export function Sheet({ label, snap, onSnap, wide, children }: SheetProps) {
  const heights = snapHeights(useViewportHeight());
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const press = useRef<{
    id: number;
    y: number;
    h: number;
    dragging: boolean;
    last: { y: number; t: number };
    velocity: number;
  } | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    suppressClick.current = false;
    if (wide || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-sheet-scroll], input')) return;
    press.current = {
      id: e.pointerId,
      y: e.clientY,
      h: heights[snap],
      dragging: false,
      last: { y: e.clientY, t: e.timeStamp },
      velocity: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const dy = p.y - e.clientY;
    if (!p.dragging) {
      if (Math.abs(dy) < DRAG_SLOP) return;
      p.dragging = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const dt = e.timeStamp - p.last.t;
    if (dt > 0) p.velocity = (p.last.y - e.clientY) / dt;
    p.last = { y: e.clientY, t: e.timeStamp };
    setDragHeight(Math.max(heights.peek - 40, Math.min(heights.full, p.h + dy)));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const p = press.current;
    press.current = null;
    if (!p?.dragging || dragHeight == null) return;
    // A finger that stopped before lifting is not flicking.
    const velocity = e.timeStamp - p.last.t > 80 ? 0 : p.velocity;
    onSnap(settle(heights, snap, dragHeight, velocity));
    setDragHeight(null);
    suppressClick.current = true;
  };

  const cycle = () => onSnap(SNAPS[(SNAPS.indexOf(snap) + 1) % SNAPS.length] as Snap);

  return (
    <section
      className="sheet"
      aria-label={label}
      data-snap={wide ? undefined : snap}
      data-dragging={dragHeight != null || undefined}
      style={wide ? undefined : { height: dragHeight ?? heights[snap] }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.stopPropagation();
        }
      }}
    >
      {!wide && (
        <button type="button" className="sheet-grip" aria-label="Resize panel" onClick={cycle}>
          <i />
        </button>
      )}
      {children}
    </section>
  );
}
