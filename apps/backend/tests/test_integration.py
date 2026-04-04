import time
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from src.cache import airspace_cache

# Import your FastAPI app and the singleton cache
from src.main import app

# Create the test client
client = TestClient(app)


# --- Fixture to clean the environment ---
@pytest.fixture(autouse=True)
def reset_cache():
    """
    Because airspace_cache is a Singleton, state from one test will bleed into another.
    This fixture wipes the cache clean before every single test.
    """
    airspace_cache.cached_response = None
    airspace_cache.last_update = 0.0
    airspace_cache.arrival_times.clear()
    airspace_cache.seen_arrivals.clear()
    yield


# --- The Integration Test ---
@patch("src.opensky.httpx.AsyncClient.get")
def test_full_aircraft_pipeline(mock_get):
    """
    Tests the entire flow: OpenSky Mock -> Parser -> Math -> Cache -> FastAPI JSON
    """
    # 1. Setup the External Boundary Mock (What OpenSky would return)
    # We provide one valid plane
    # (on approach to LHR) and one invalid plane (missing coords)
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "time": int(time.time()),
        "states": [
            # Valid: Close to LHR, descending, runway 09 heading
            [
                "111111",
                "BAW1    ",
                "UK",
                0,
                0,
                -0.5,
                51.47,
                800.0,
                False,
                100.0,
                92.0,
                -3.0,
                None,
                800.0,
                "1234",
                False,
                0,
            ],
            # Invalid: Missing latitude/longitude (should be dropped by parser)
            [
                "222222",
                "GHOST   ",
                "UK",
                0,
                0,
                None,
                None,
                1000.0,
                False,
                100.0,
                0.0,
                0.0,
                None,
                1000.0,
                "1234",
                False,
                0,
            ],
        ],
    }
    mock_get.return_value = mock_response

    # 2. Execute the Pipeline (Simulate the React frontend making a request)
    response = client.get("/aircraft")

    # 3. Assert HTTP Layer
    assert response.status_code == 200

    # 4. Assert the Data Contract (camelCase conversion & logic)
    data = response.json()

    # Check KPIs
    assert data["kpis"]["trackedAircraft"] == 1  # Ghost plane was dropped!
    assert data["kpis"]["inboundLhr"] == 1  # BAW1 was flagged as approaching
    assert data["kpis"]["apiHealth"] == "green"

    # Check Aircraft Array
    aircraft_list = data["aircraft"]
    assert len(aircraft_list) == 1

    # Verify Pydantic stripping and camelCase aliasing worked
    baw1 = aircraft_list[0]
    assert baw1["icao24"] == "111111"
    assert baw1["callsign"] == "BAW1"  # Whitespace stripped
    assert baw1["isApproachingLhr"] is True  # ATC logic applied successfully
