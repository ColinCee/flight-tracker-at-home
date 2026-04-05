import asyncio
import time
from unittest.mock import patch

import pytest
from src.cache import AirspaceCache
from src.models import AircraftState


def create_mock_aircraft(icao: str, approaching: bool) -> AircraftState:
    return AircraftState(
        icao24=icao,
        callsign="TEST",
        registration="G-TEST",
        aircraft_type="A320",
        category="Heavy",
        last_contact=int(time.time()),
        latitude=51.0,
        longitude=0.0,
        baro_altitude_ft=1000,
        geo_altitude_ft=1000,
        ground_speed_kts=100.0,
        true_track=90.0,
        vertical_rate_fpm=0,
        on_ground=False,
        squawk=None,
        position_source="ADS-B",
        is_climbing=False,
        is_descending=False,
        is_approaching_lhr=approaching,
    )


@pytest.mark.asyncio
@patch("src.cache.get_current_airspace_state")
async def test_cache_kpi_calculation(mock_get_state):
    """Tests that the cache correctly calculates KPIs from the mocked data."""
    # Setup mock to return 2 planes (1 approaching, 1 not)
    mock_get_state.return_value = [
        create_mock_aircraft("A111", approaching=True),
        create_mock_aircraft("B222", approaching=False),
    ]

    # Create an isolated cache instance
    cache = AirspaceCache()

    # Trigger the cache
    response = await cache.get_state()

    # Assert KPIs
    assert response.kpis.tracked_aircraft == 2
    assert response.kpis.inbound_lhr_aircraft == 1
    assert response.kpis.throughput_last_60min == 1
    assert response.kpis.api_health == "live"
    assert response.kpis.airborne_aircraft == 2
    assert response.kpis.climbing_aircraft == 0
    assert response.kpis.descending_aircraft == 0
    assert response.kpis.avg_altitude_ft == 1000  # No more metric
    assert response.refresh_interval_ms == 10_000  # Anonymous = 10s


@pytest.mark.asyncio
@patch("src.cache.get_current_airspace_state")
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


@pytest.mark.asyncio
@patch("src.cache.get_current_airspace_state")
async def test_cache_serves_stale_data_on_error(mock_get_state):
    """On upstream failure, the cache serves stale data with 'stale' health."""
    mock_get_state.return_value = [create_mock_aircraft("A111", approaching=False)]

    cache = AirspaceCache()

    # Populate cache with good data
    response_1 = await cache.get_state()
    assert response_1.kpis.api_health == "live"
    assert response_1.kpis.tracked_aircraft == 1

    # Force cache to be stale, then make the API fail
    cache.last_update = 0.0
    mock_get_state.side_effect = Exception("429 rate limited")

    response_2 = await cache.get_state()
    assert response_2.kpis.api_health == "stale"
    # Original aircraft data preserved
    assert response_2.kpis.tracked_aircraft == 1
