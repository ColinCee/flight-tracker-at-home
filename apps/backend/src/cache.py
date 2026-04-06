"""Cache for AircraftResponse — singleton that refreshes on a stable TTL.

Airplanes.live allows 1 request per second without authentication.
A 10-second default TTL gives stable real-time updates within the API's effective rate limit.
"""

import asyncio
import logging
import os
import time
from collections import deque

from src.airplanes_live import get_current_airspace_state
from src.models import AircraftResponse, KPIs

logger = logging.getLogger(__name__)

_MOCK_MODE = os.getenv("MOCK_DATA", "").lower() in ("true", "1", "yes")


def get_effective_ttl() -> float:
    """Return the cache TTL in seconds. Defaults to 10.0."""
    env_ttl = os.getenv("CACHE_TTL")
    if not env_ttl:
        return 10.0
    try:
        return float(env_ttl)
    except ValueError:
        logger.warning("Invalid CACHE_TTL value %r, falling back to 10.0", env_ttl)
        return 10.0


class AirspaceCache:
    def __init__(self):
        # The core state
        self.cached_response: AircraftResponse | None = None
        self.last_update: float = 0.0

        # Throughput tracking: deque of (timestamp, icao24) tuples
        self.arrival_times: deque[tuple[float, str]] = deque()
        self.seen_arrivals: set[str] = set()

        # Initialize as None! We will create the lock lazily
        self._lock: asyncio.Lock | None = None

    async def get_state(self) -> AircraftResponse:
        """The main entry point for the API route."""

        # Ensure the lock is created strictly inside the active Event Loop
        if self._lock is None:
            self._lock = asyncio.Lock()

        now = time.time()
        cache_age = now - self.last_update
        ttl = get_effective_ttl()

        # 1. The "Lazy" Check: If data is fresh, return it immediately
        if self.cached_response and cache_age < ttl:
            self.cached_response.cache_age_seconds = round(cache_age, 1)
            return self.cached_response

        # 2. Cache is stale: Acquire the lock to fetch safely
        async with self._lock:
            # Re-evaluate cache age inside the lock!
            # Another request might have updated it while we were waiting in line.
            now = time.time()
            cache_age = now - self.last_update
            if self.cached_response and cache_age < ttl:
                self.cached_response.cache_age_seconds = round(cache_age, 1)
                return self.cached_response

            try:
                if _MOCK_MODE:
                    from src.mock_data import get_mock_aircraft

                    aircraft_list = get_mock_aircraft()
                else:
                    aircraft_list = await get_current_airspace_state()
            except Exception as e:
                logger.warning("Airplanes.live fetch failed: %r", e)

                # Preserve real data age before circuit breaker overwrites it
                stale_since = self.last_update

                # CIRCUIT BREAKER: Update the timestamp ANYWAY so we don't spam 429s
                self.last_update = time.time()

                # Serve stale cache instead of losing data
                if self.cached_response:
                    self.cached_response.cache_age_seconds = round(
                        time.time() - stale_since, 1
                    )
                    self.cached_response.kpis.api_health = "stale"
                    return self.cached_response

                # No cache available, raise the error so the API can return 503
                raise

            # 3. Process KPIs
            fetch_time = time.time()
            inbound_count = 0
            airborne_count = 0
            climbing_count = 0
            descending_count = 0
            altitude_sum = 0.0
            altitude_count = 0

            for ac in aircraft_list:
                if ac.on_ground:
                    pass
                else:
                    airborne_count += 1
                    if ac.baro_altitude_ft is not None:
                        altitude_sum += ac.baro_altitude_ft
                        altitude_count += 1

                if ac.is_climbing:
                    climbing_count += 1
                elif ac.is_descending:
                    descending_count += 1

                if ac.is_approaching_lhr:
                    inbound_count += 1
                    if ac.icao24 not in self.seen_arrivals:
                        self.seen_arrivals.add(ac.icao24)
                        self.arrival_times.append((fetch_time, ac.icao24))

            # 4. Prune the Throughput Queue (and matching seen_arrivals entries)
            while self.arrival_times and self.arrival_times[0][0] < (fetch_time - 3600):
                _, expired_icao = self.arrival_times.popleft()
                self.seen_arrivals.discard(expired_icao)

            avg_alt = (
                round(altitude_sum / altitude_count / 100) * 100
                if altitude_count > 0
                else None
            )

            # 5. Build the Data Contract
            kpis = KPIs(
                tracked_aircraft=len(aircraft_list),
                airborne_aircraft=airborne_count,
                inbound_lhr_aircraft=inbound_count,
                climbing_aircraft=climbing_count,
                descending_aircraft=descending_count,
                throughput_last_60min=len(self.arrival_times),
                avg_altitude_ft=avg_alt,
                api_health="live" if aircraft_list else "offline",
            )

            self.cached_response = AircraftResponse(
                timestamp=int(fetch_time),
                cache_age_seconds=0.0,
                refresh_interval_ms=int(ttl * 1000),
                aircraft=aircraft_list,
                kpis=kpis,
            )

            # Reset the timer only after a successful execution
            self.last_update = fetch_time

            return self.cached_response


# Instantiate the singleton so main.py can import it
airspace_cache = AirspaceCache()
