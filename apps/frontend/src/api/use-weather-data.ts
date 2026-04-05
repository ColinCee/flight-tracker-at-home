import { useMemo } from 'react';
import type { AirportWeather } from '@/api/generated';
import { getGetWeatherQueryKey, useGetWeather } from '@/api/generated';

const WEATHER_POLL_INTERVAL_MS = 60_000; // Poll every 1 minute since backend caches for 30m

export const LONDON_AIRPORTS_COORDS: Record<string, { lat: number; lon: number }> = {
  EGLL: { lat: 51.47, lon: -0.4543 },
  EGLC: { lat: 51.5053, lon: 0.0553 },
  EGKK: { lat: 51.1481, lon: -0.1903 },
  EGGW: { lat: 51.8747, lon: -0.3683 },
  EGSS: { lat: 51.885, lon: 0.235 },
};

export interface EnrichedAirportWeather extends AirportWeather {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface WeatherData {
  airports: EnrichedAirportWeather[];
  isLoading: boolean;
  isError: boolean;
}

export function useWeatherData(): WeatherData {
  const { data, isLoading, isError } = useGetWeather({
    query: {
      queryKey: getGetWeatherQueryKey(),
      refetchInterval: WEATHER_POLL_INTERVAL_MS,
    },
  });

  const response = data?.data;

  const airports = useMemo(() => {
    if (!response?.weather) return [];

    return response.weather
      .map((w) => {
        const coords = LONDON_AIRPORTS_COORDS[w.icao];
        if (!coords) return null;
        return {
          ...w,
          latitude: coords.lat,
          longitude: coords.lon,
          timestamp: response.timestamp,
        };
      })
      .filter((w): w is EnrichedAirportWeather => w !== null);
  }, [response]);

  return {
    airports,
    isLoading,
    isError,
  };
}
