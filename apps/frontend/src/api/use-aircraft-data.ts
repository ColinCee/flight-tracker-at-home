import type { AircraftState, KPIs } from '@/api/generated';
import { getGetAircraftQueryKey, useGetAircraft } from '@/api/generated';

const POLL_INTERVAL_MS = 10_000;

interface AircraftData {
  aircraft: AircraftState[];
  kpis: KPIs | null;
  isLoading: boolean;
  isError: boolean;
}

export function useAircraftData(): AircraftData {
  const { data, isLoading, isError } = useGetAircraft({
    query: {
      queryKey: getGetAircraftQueryKey(),
      refetchInterval: POLL_INTERVAL_MS,
    },
  });

  const response = data?.data;

  return {
    aircraft: response?.aircraft ?? [],
    kpis: response?.kpis ?? null,
    isLoading,
    isError,
  };
}
