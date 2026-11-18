import { useCallback, useSyncExternalStore } from 'react';

/** True while the media query matches. Reads synchronously, so the first paint is already right. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/** Tablets and up: the sheet becomes a floating panel on the left. */
export const WIDE_QUERY = '(width >= 48rem)';
