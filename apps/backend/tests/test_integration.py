from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from src.cache import airspace_cache
from src.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_cache():
    airspace_cache.cached_response = None
    airspace_cache.last_update = 0.0
    airspace_cache.arrival_times.clear()
    airspace_cache.seen_arrivals.clear()
    yield


# Update the patch target to match your new module!
@patch("src.airplanes_live.httpx.AsyncClient.get")
def test_full_aircraft_pipeline(mock_get):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "ac": [
            # Valid: Close to LHR, descending, runway 09 heading
            {
                "hex": "111111",
                "flight": "BAW1    ",
                "lat": 51.47,
                "lon": -0.5,
                "alt_baro": 800,
                "gs": 100.0,
                "track": 92.0,
                "baro_rate": -300,
                "squawk": "1234",
                "type": "adsb_icao",
                "category": "A5",
            },
            # Invalid: Missing latitude/longitude
            {
                "hex": "222222",
                "flight": "GHOST",
                "lat": None,
                "lon": None,
                "alt_baro": 1000,
            },
        ]
    }
    mock_get.return_value = mock_response

    response = client.get("/aircraft")
    assert response.status_code == 200
    data = response.json()

    assert data["kpis"]["trackedAircraft"] == 1  # Ghost plane was dropped!
    assert data["kpis"]["inboundLhrAircraft"] == 1  # BAW1 was flagged as approaching
    assert data["kpis"]["apiHealth"] == "live"

    aircraft_list = data["aircraft"]
    assert len(aircraft_list) == 1

    baw1 = aircraft_list[0]
    assert baw1["icao24"] == "111111"
    assert baw1["callsign"] == "BAW1"  # Whitespace stripped
    assert baw1["isApproachingLhr"] is True  # ATC logic applied successfully

    # Verify field mappings
    assert baw1["positionSource"] == "ADS-B"
    assert baw1["category"] == "Heavy"
    assert baw1["aircraftType"] is None  # Mock doesn't include "t" field
    assert baw1["isClimbing"] is False
    assert baw1["isDescending"] is True
