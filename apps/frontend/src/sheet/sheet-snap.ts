export const SNAPS = ['peek', 'half', 'full'] as const;
export type Snap = (typeof SNAPS)[number];

/** Resting heights in px for a viewport of this height. */
export function snapHeights(viewportHeight: number): Record<Snap, number> {
  return {
    peek: 156,
    half: Math.round(viewportHeight * 0.48),
    // Leave the search bar showing above the sheet.
    full: viewportHeight - 76,
  };
}

/** px/ms; a release faster than this is a flick. */
const FLICK_SPEED = 0.5;

/**
 * Where the sheet settles when released at `height`, moving at `velocity`
 * px/ms (positive = growing). A flick goes one step its way from the
 * snap it started at; a slow release goes to the nearest.
 */
export function settle(
  heights: Record<Snap, number>,
  from: Snap,
  height: number,
  velocity: number,
): Snap {
  if (Math.abs(velocity) >= FLICK_SPEED) {
    const i = SNAPS.indexOf(from) + Math.sign(velocity);
    // A long fast drag may already be past the next snap; never settle behind the finger.
    const step = SNAPS[Math.max(0, Math.min(SNAPS.length - 1, i))] as Snap;
    const nearest = nearestSnap(heights, height);
    const further =
      velocity > 0 ? heights[nearest] > heights[step] : heights[nearest] < heights[step];
    return further ? nearest : step;
  }
  return nearestSnap(heights, height);
}

function nearestSnap(heights: Record<Snap, number>, height: number): Snap {
  return SNAPS.reduce((a, b) =>
    Math.abs(heights[b] - height) < Math.abs(heights[a] - height) ? b : a,
  );
}
