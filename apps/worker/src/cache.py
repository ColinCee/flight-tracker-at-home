"""Cache for AircraftResponse — singleton that refreshes on a dynamic TTL.

TTL behaviour:
- Development (no CACHE_TTL env var): 5s authenticated / 10s anonymous,
  matching OpenSky's data resolution.
- Production (CACHE_TTL=20): 20s base, scaled up automatically when
  remaining API credits drop below safety thresholds.
"""

import logging
import os
import time
from collections import deque

from models import AircraftResponse, KPIs
from opensky import (
    _token_manager,
    get_current_airspace_state,
    get_remaining_credits,
)

logger = logging.getLogger(__name__)

# Dev defaults match OpenSky data resolution
_TTL_DEV_AUTHENTICATED = 5.0
_TTL_DEV_ANONYMOUS = 10.0

# Credit-aware throttle thresholds: (credit_floor, minimum_ttl)
# Ordered lowest-first so the strictest match wins.
_CREDIT_THRESHOLDS: list[tuple[int, float]] = [
    (100, 120.0),
    (500, 60.0),
    (1000, 30.0),
]


def get_effective_ttl() -> float:
    """Return the cache TTL in seconds, factoring in credit budget.

    1. If CACHE_TTL is set, use it as the base (production).
       Otherwise fall back to 5s/10s dev defaults.
    2. If remaining credits are known and low, scale up to conserve them.
    """
    env_ttl = os.getenv("CACHE_TTL")
    if env_ttl:
        base = float(env_ttl)
    else:
        base = (
            _TTL_DEV_AUTHENTICATED
            if _token_manager.is_authenticated
            else _TTL_DEV_ANONYMOUS
        )

    credits = get_remaining_credits()
    if credits is None:
        return base

    for floor, minimum in _CREDIT_THRESHOLDS:
        if credits < floor:
            if minimum > base:
                logger.info(
                    "Credit-aware throttle: %d credits remaining, TTL %gs → %gs",
                    credits,
                    base,
                    minimum,
                )
            return max(base, minimum)

    return base


class AirspaceCache:
    def __init__(self):
        # The core state
        self.cached_response: AircraftResponse | None = None
        self.last_update: float = 0.0

        # Throughput tracking (The "Rolling 60 Min" window)
        self.arrival_times = deque()
        self.seen_arrivals = set()

    async def get_state(self) -> AircraftResponse:
        """The main entry point for the API route."""
        now = time.time()
        cache_age = now - self.last_update
        ttl = get_effective_ttl()

        # 1. The "Lazy" Check: If data is fresh, return it immediately
        if self.cached_response and cache_age < ttl:
            self.cached_response.cache_age_seconds = round(cache_age, 1)
            return self.cached_response

        # 2. Cache is stale: Fetch fresh data (Phases 1-3)
        try:
            aircraft_list = await get_current_airspace_state()
        except Exception as e:
            logger.warning("OpenSky fetch failed: %r", e)
            # Serve stale cache instead of losing data
            if self.cached_response:
                self.cached_response.cache_age_seconds = round(cache_age, 1)
                self.cached_response.kpis.api_health = "stale"
                return self.cached_response
            aircraft_list = []

        # 3. Process KPIs
        now = time.time()  # Update 'now' after the async await finishes
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
                if ac.baro_altitude is not None:
                    altitude_sum += ac.baro_altitude
                    altitude_count += 1

            vr = ac.vertical_rate or 0.0
            if vr > 1.0:
                climbing_count += 1
            elif vr < -1.0:
                descending_count += 1

            if ac.is_approaching_lhr:
                inbound_count += 1
                # If we haven't seen this plane approaching before,
                # log it as a new throughput event
                if ac.icao24 not in self.seen_arrivals:
                    self.seen_arrivals.add(ac.icao24)
                    self.arrival_times.append(now)

        # 4. Prune the Throughput Queue
        # (Remove events older than 60 mins / 3600 seconds)
        while self.arrival_times and self.arrival_times[0] < (now - 3600):
            self.arrival_times.popleft()

        metres_to_feet = 3.28084
        avg_alt = (
            round(altitude_sum / altitude_count * metres_to_feet / 100) * 100
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
            api_credits_remaining=get_remaining_credits(),
        )

        self.cached_response = AircraftResponse(
            timestamp=int(now),
            cache_age_seconds=0.0,
            refresh_interval_ms=int(ttl * 1000),
            aircraft=aircraft_list,
            kpis=kpis,
        )
        self.last_update = now

        return self.cached_response


# Instantiate the singleton so app.py can import it
airspace_cache = AirspaceCache()
