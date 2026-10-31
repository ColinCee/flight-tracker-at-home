"""Weather extraction and caching using the MET Norway Locationforecast API."""

import asyncio
import logging
import time
from typing import Any

import httpx
from src.models import AirportWeather, WeatherResponse

logger = logging.getLogger(__name__)

# MET Norway requires coordinates, not ICAO codes.
LONDON_AIRPORTS = [
    {"icao": "EGLL", "name": "Heathrow", "lat": 51.4700, "lon": -0.4543},
    {"icao": "EGLC", "name": "London City", "lat": 51.5053, "lon": 0.0553},
    {"icao": "EGKK", "name": "Gatwick", "lat": 51.1481, "lon": -0.1903},
    {"icao": "EGGW", "name": "Luton", "lat": 51.8747, "lon": -0.3683},
    {"icao": "EGSS", "name": "Stansted", "lat": 51.8850, "lon": 0.2350},
]

MET_NORWAY_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
WEATHER_CACHE_TTL = 1800.0  # 30-minute cache
# After a fetch where every airport failed, wait this long before trying again.
WEATHER_RETRY_S = 60.0

# STRICT REQUIREMENT: MET Norway will block generic User-Agents (like "python-httpx")
HEADERS = {
    "User-Agent": "FlightTrackerAtHome/1.0 (github.com/ColinCee/flight-tracker-at-home)"
}


class WeatherCache:
    """Singleton cache for airport weather to respect strict upstream rate limits."""

    def __init__(self):
        self.cached_response: WeatherResponse | None = None
        self.last_update: float = 0.0
        self.retry_at: float = 0.0
        self.fetched_at: dict[str, float] = {}
        self._lock = asyncio.Lock()

    async def get_weather(self) -> WeatherResponse:
        # One refresh at a time; requests that waited get its result.
        async with self._lock:
            return await self._get_weather()

    async def _get_weather(self) -> WeatherResponse:
        now = time.time()
        cache_age = now - self.last_update

        # 1. The "Lazy" Check: Return cached data if still fresh
        if self.cached_response and cache_age < WEATHER_CACHE_TTL:
            self.cached_response.cache_age_seconds = round(cache_age, 1)
            return self.cached_response
        if now < self.retry_at:
            return self._fallback_or_empty(now, cache_age)

        # 2. Fetch fresh data concurrently
        try:
            async with httpx.AsyncClient(headers=HEADERS) as client:
                # Create a list of concurrent async tasks
                tasks = [
                    self._fetch_and_parse_airport(client, airport)
                    for airport in LONDON_AIRPORTS
                ]
                # Wait for all 5 HTTP requests to finish in parallel
                parsed_weather = await asyncio.gather(*tasks)

                # Filter out any airports that failed to fetch (returned None)
                valid_weather = [w for w in parsed_weather if w is not None]
                if not valid_weather:
                    # Keep the last good answer rather than caching an empty one.
                    self.retry_at = now + WEATHER_RETRY_S
                    return self._fallback_or_empty(now, cache_age)

                # An airport that failed this time keeps its last good reading,
                # for up to two refreshes, so it never shows day-old weather.
                for w in valid_weather:
                    self.fetched_at[w.icao] = now
                fetched = {w.icao for w in valid_weather}
                if self.cached_response:
                    valid_weather += [
                        w
                        for w in self.cached_response.weather
                        if w.icao not in fetched
                        and now - self.fetched_at.get(w.icao, 0) < 2 * WEATHER_CACHE_TTL
                    ]

                self.cached_response = WeatherResponse(
                    timestamp=int(now),
                    cache_age_seconds=0.0,
                    weather=valid_weather,
                )
                self.last_update = now
                return self.cached_response

        except Exception as e:
            logger.warning("Failed to orchestrate weather fetch: %r", e)
            self.retry_at = now + WEATHER_RETRY_S
            return self._fallback_or_empty(now, cache_age)

    async def _fetch_and_parse_airport(
        self, client: httpx.AsyncClient, airport: dict[str, Any]
    ) -> AirportWeather | None:
        """Fetches and transforms MET Norway data for a single airport."""
        params = {"lat": airport["lat"], "lon": airport["lon"]}

        try:
            response = await client.get(MET_NORWAY_URL, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()

            # MET Norway provides an array of timeseries forecasts. Index 0 is "now".
            current_timeseries = data["properties"]["timeseries"][0]
            details = current_timeseries["data"]["instant"]["details"]

            # The next 1 hour summary provides a readable string like "partlycloudy_day"
            condition = (
                current_timeseries["data"]
                .get("next_1_hours", {})
                .get("summary", {})
                .get("symbol_code", "unknown")
            )

            # Math conversion: MET Norway provides wind in m/s. Multiply by 1.94384 for knots.
            wind_ms = details.get("wind_speed", 0)
            wind_kts = round(wind_ms * 1.94384, 1)

            return AirportWeather(
                icao=airport["icao"],
                name=airport["name"],
                condition=condition,
                temperature_c=details.get("air_temperature"),
                wind_speed_kts=wind_kts,
                wind_direction_deg=details.get("wind_from_direction"),
            )
        except Exception as e:
            logger.warning(f"Failed to fetch/parse weather for {airport['icao']}: {e}")
            return None

    def _fallback_or_empty(self, now: float, cache_age: float) -> WeatherResponse:
        """Returns stale data if available, otherwise an empty array."""
        if self.cached_response:
            self.cached_response.cache_age_seconds = round(cache_age, 1)
            return self.cached_response

        return WeatherResponse(timestamp=int(now), cache_age_seconds=0.0, weather=[])


# Instantiate singleton
weather_cache = WeatherCache()
