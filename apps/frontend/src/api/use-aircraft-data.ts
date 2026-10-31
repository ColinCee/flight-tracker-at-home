import type { AircraftResponse, AircraftState, KPIs } from '@/api/generated';
import { getGetAircraftQueryKey, useGetAircraft } from '@/api/generated';

const DEFAULT_POLL_INTERVAL_MS = 10_000;

/** The backend says how often to poll; fall back until it has answered. */
export function pollIntervalFor(response: AircraftResponse | undefined): number {
  return response?.refreshIntervalMs || DEFAULT_POLL_INTERVAL_MS;
}

interface AircraftData {
  aircraft: AircraftState[];
  kpis: KPIs | null;
  isLoading: boolean;
  isError: boolean;
  dataUpdatedAt: number;
  pollIntervalMs: number;
}

export function useAircraftData(): AircraftData {
  const { data, isLoading, isError, dataUpdatedAt } = useGetAircraft({
    query: {
      queryKey: getGetAircraftQueryKey(),
      // Read from the latest response, so a new interval applies to the very next poll.
      refetchInterval: (query) => pollIntervalFor(query.state.data?.data),
    },
  });

  const response = data?.data;

  return {
    aircraft: response?.aircraft ?? [],
    kpis: response?.kpis ?? null,
    isLoading,
    isError,
    dataUpdatedAt,
    pollIntervalMs: pollIntervalFor(response),
  };
}
