import asyncio
import time
from unittest.mock import patch

import pytest
from src.cache import AirspaceCache
from src.models import AircraftState


def create_mock_aircraft(icao: str, destination: str | None) -> AircraftState:
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
        destination=destination,
    )


@pytest.mark.asyncio
@patch("src.cache.get_current_airspace_state")
async def test_cache_kpi_calculation(mock_get_state):
    """Tests that the cache correctly calculates KPIs from the mocked data."""
    # Setup mock to return 2 planes (1 approaching, 1 not)
    mock_get_state.return_value = [
        create_mock_aircraft("A111", destination="LHR"),
        create_mock_aircraft("B222", destination=None),
    ]

    # Create an isolated cache instance
    cache = AirspaceCache()

    # Trigger the cache
    response = await cache.get_state()

    # Assert KPIs
    assert response.kpis.tracked_aircraft == 2
    assert response.kpis.inbound_london_aircraft == 1
    assert response.kpis.throughput_last_60min == 1
    assert response.kpis.api_health == "live"
    assert response.kpis.airborne_aircraft == 2
    assert response.kpis.climbing_aircraft == 0
    assert response.kpis.descending_aircraft == 0
    assert response.kpis.avg_altitude_ft == 1000  # No more metric
    assert response.refresh_interval_ms == 10_000  # Default = 10s


@pytest.mark.asyncio
@patch("src.cache.get_current_airspace_state")
async def test_cache_ttl_logic(mock_get_state):
    """Ensures the cache doesn't fetch new data until the TTL expires."""
    mock_get_state.return_value = [create_mock_aircraft("A111", destination="LHR")]

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
    mock_get_state.return_value = [create_mock_aircraft("A111", destination=None)]

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


@pytest.mark.asyncio
@patch("src.cache.get_current_airspace_state")
async def test_cache_climbing_descending_kpis(mock_get_state):
    """Tests that climbing and descending KPIs are counted correctly."""
    climbing = create_mock_aircraft("C111", destination=None)
    climbing.is_climbing = True
    climbing.vertical_rate_fpm = 1500

    descending = create_mock_aircraft("D222", destination=None)
    descending.is_descending = True
    descending.vertical_rate_fpm = -1200

    level = create_mock_aircraft("L333", destination=None)

    mock_get_state.return_value = [climbing, descending, level]

    cache = AirspaceCache()
    response = await cache.get_state()

    assert response.kpis.climbing_aircraft == 1
    assert response.kpis.descending_aircraft == 1
    assert response.kpis.airborne_aircraft == 3


@pytest.mark.asyncio
@patch("src.cache.get_current_airspace_state")
async def test_cache_empty_aircraft_offline(mock_get_state):
    """Empty aircraft list should report api_health as 'offline'."""
    mock_get_state.return_value = []

    cache = AirspaceCache()
    response = await cache.get_state()

    assert response.kpis.api_health == "offline"
    assert response.kpis.tracked_aircraft == 0
    assert response.kpis.airborne_aircraft == 0
    assert response.kpis.avg_altitude_ft is None


@pytest.mark.asyncio
@patch("src.cache.get_current_airspace_state")
async def test_cache_throughput_pruning(mock_get_state):
    """Arrival entries older than 60 minutes should be pruned."""
    mock_get_state.return_value = [create_mock_aircraft("A111", destination="LHR")]

    cache = AirspaceCache()

    # Populate with an arrival
    await cache.get_state()
    assert cache.arrival_times
    assert len(cache.seen_arrivals) == 1

    # Simulate: the arrival happened >60 min ago
    old_time = time.time() - 3700
    cache.arrival_times[0] = (old_time, "A111")
    cache.last_update = 0.0  # Force re-fetch

    # New fetch with a different aircraft
    mock_get_state.return_value = [create_mock_aircraft("B222", destination="LHR")]
    response = await cache.get_state()

    # Old entry pruned, new one added
    assert response.kpis.throughput_last_60min == 1
    assert "A111" not in cache.seen_arrivals
    assert "B222" in cache.seen_arrivals
