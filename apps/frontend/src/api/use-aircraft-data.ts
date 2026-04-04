import { useRef } from 'react';
import type { AircraftState, KPIs } from '@/api/generated';
import { getGetAircraftQueryKey, useGetAircraft } from '@/api/generated';

const DEFAULT_POLL_INTERVAL_MS = 10_000;

interface AircraftData {
  aircraft: AircraftState[];
  kpis: KPIs | null;
  isLoading: boolean;
  isError: boolean;
}

export function useAircraftData(): AircraftData {
  const intervalRef = useRef(DEFAULT_POLL_INTERVAL_MS);

  const { data, isLoading, isError } = useGetAircraft({
    query: {
      queryKey: getGetAircraftQueryKey(),
      refetchInterval: intervalRef.current,
    },
  });

  const response = data?.data;

  // Sync poll rate with backend on each successful response
  if (response?.refreshIntervalMs) {
    intervalRef.current = response.refreshIntervalMs;
  }

  return {
    aircraft: response?.aircraft ?? [],
    kpis: response?.kpis ?? null,
    isLoading,
    isError,
  };
}
