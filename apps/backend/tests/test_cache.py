import time
import asyncio
import pytest
from unittest.mock import patch
from src.cache import AirspaceCache
from src.models import AircraftState


# Helper to generate mock aircraft
def create_mock_aircraft(icao: str, approaching: bool) -> AircraftState:
  return AircraftState(
    icao24=icao, callsign="TEST", origin_country="UK", last_contact=int(time.time()),
    latitude=51.0, longitude=0.0, baro_altitude=1000.0, on_ground=False,
    velocity=100.0, true_track=90.0, vertical_rate=0.0, geo_altitude=1000.0,
    squawk=None, is_approaching_lhr=approaching
  )


@pytest.mark.asyncio
@patch('src.cache.get_current_airspace_state')
async def test_cache_kpi_calculation(mock_get_state):
  """Tests that the cache correctly calculates KPIs from the mocked data."""
  # Setup mock to return 2 planes (1 approaching, 1 not)
  mock_get_state.return_value = [
    create_mock_aircraft("A111", approaching=True),
    create_mock_aircraft("B222", approaching=False)
  ]

  # Create an isolated cache instance
  cache = AirspaceCache()

  # Trigger the cache
  response = await cache.get_state()

  # Assert KPIs
  assert response.kpis.tracked_aircraft == 2
  assert response.kpis.inbound_lhr == 1
  assert response.kpis.throughput_last_60min == 1
  assert response.kpis.api_health == "green"


@pytest.mark.asyncio
@patch('src.cache.get_current_airspace_state')
async def test_cache_ttl_logic(mock_get_state):
  """Ensures the cache doesn't fetch new data until the TTL expires."""
  mock_get_state.return_value = [create_mock_aircraft("A111", approaching=True)]

  cache = AirspaceCache()

  # First call - should hit the mock API
  await cache.get_state()
  assert mock_get_state.call_count == 1

  # Simulate a small delay so the time difference survives the 1-decimal rounding
  await asyncio.sleep(0.2)

  # Second call - should return cached data, NO mock API call
  response_2 = await cache.get_state()
  assert mock_get_state.call_count == 1
  assert response_2.cache_age_seconds > 0.0
