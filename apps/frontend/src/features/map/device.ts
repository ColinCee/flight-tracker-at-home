// Rendering choices that depend on the device, kept pure so they can be tested.

/**
 * Pixels drawn per CSS pixel. Phones report 2.5-3.5, which multiplies GPU work
 * by up to 12x for little visible gain on a map; cap it lower on phones, judged
 * by the screen's shorter side so rotating the phone does not change it.
 */
export function pickPixelRatio(devicePixelRatio: number, shortSide: number): number {
  const cap = shortSide < 768 ? 1.5 : 2;
  return Math.max(1, Math.min(devicePixelRatio, cap));
}

/** Tap tolerance around aircraft: a fingertip covers far more than 5 px. */
export function pickPickingRadius(coarsePointer: boolean): number {
  return coarsePointer ? 16 : 5;
}

export function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
}
