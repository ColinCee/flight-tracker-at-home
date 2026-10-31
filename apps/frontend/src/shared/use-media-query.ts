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

/** Phones in portrait: inspectors become a bottom sheet and the KPI strip a grid. Matches Tailwind's `max-sm`. */
export const PHONE_QUERY = '(width < 40rem)';
