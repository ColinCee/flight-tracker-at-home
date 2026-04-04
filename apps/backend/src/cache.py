"""Cache for AircraftResponse, refreshes the data every 10 seconds.
The Python class acts as a Singleton - only one instance of this stace will ever exist.
"""
import time
from collections import deque
from src.models import AircraftResponse, KPIs
from src.opensky import get_current_airspace_state


class AirspaceCache:
  def __init__(self):
    # The core state
    self.cached_response: AircraftResponse | None = None
    self.last_update: float = 0.0
    self.ttl_seconds: float = 10.0

    # Throughput tracking (The "Rolling 60 Min" window)
    self.arrival_times = deque()
    self.seen_arrivals = set()

  async def get_state(self) -> AircraftResponse:
    """The main entry point for the API route."""
    now = time.time()
    cache_age = now - self.last_update

    # 1. The "Lazy" Check: If data is fresh, return it immediately
    if self.cached_response and cache_age < self.ttl_seconds:
      self.cached_response.cache_age_seconds = round(cache_age, 1)
      return self.cached_response

    # 2. Cache is stale: Fetch fresh data (Phases 1-3)
    aircraft_list = await get_current_airspace_state()

    # 3. Process KPIs
    now = time.time()  # Update 'now' after the async await finishes
    inbound_count = 0

    for ac in aircraft_list:
      if ac.is_approaching_lhr:
        inbound_count += 1
        # If we haven't seen this plane approaching before, log it as a new throughput event
        if ac.icao24 not in self.seen_arrivals:
          self.seen_arrivals.add(ac.icao24)
          self.arrival_times.append(now)

    # 4. Prune the Throughput Queue (Remove events older than 60 mins / 3600 seconds)
    while self.arrival_times and self.arrival_times[0] < (now - 3600):
      self.arrival_times.popleft()

    # 5. Build the Data Contract
    kpis = KPIs(
      inbound_lhr=inbound_count,
      throughput_last_60min=len(self.arrival_times),
      tracked_aircraft=len(aircraft_list),
      data_freshness_seconds=0.0,
      api_health="green" if aircraft_list else "amber"  # Amber if OpenSky returns empty
    )

    self.cached_response = AircraftResponse(
      timestamp=int(now),
      cache_age_seconds=0.0,
      aircraft=aircraft_list,
      kpis=kpis
    )
    self.last_update = now

    return self.cached_response


# Instantiate the singleton so main.py can import it
airspace_cache = AirspaceCache()
