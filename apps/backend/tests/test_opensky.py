from src.models import AircraftState
from src.opensky import calculate_distance_km, check_lhr_approach, parse_state_vector


# --- 1. Math Tests ---
def test_calculate_distance_km():
    """Validates the Haversine formula with a known distance."""
    # Heathrow
    lat1, lon1 = 51.4700, -0.4543
    # Windsor Castle (approx 11.5 km away)
    lat2, lon2 = 51.4839, -0.6044

    dist = calculate_distance_km(lat1, lon1, lat2, lon2)
    assert 10.0 < dist < 12.0


# --- 2. Transformation Tests ---
def test_parse_state_vector_valid():
    """Ensures a valid OpenSky array maps to the Pydantic model correctly."""
    raw_vector = [
        "400a5b",
        "BAW123  ",
        "United Kingdom",
        1690000000,
        1690000000,
        -0.45,
        51.47,
        1000.0,
        False,
        150.0,
        90.0,
        -5.0,
        None,
        1050.0,
        "7700",
        False,
        0,
        0,
        0,
    ]

    aircraft = parse_state_vector(raw_vector)

    assert aircraft is not None
    assert aircraft.icao24 == "400a5b"
    assert aircraft.callsign == "BAW123"  # Check stripping works
    assert aircraft.longitude == -0.45
    assert aircraft.is_approaching_lhr is False  # Default state


def test_parse_state_vector_missing_coords():
    """Infrastructure rule: Drop aircraft missing spatial data."""
    raw_vector = [
        "400a5b",
        "BAW123",
        "United Kingdom",
        1690000000,
        1690000000,
        None,
        None,
        1000.0,
        False,
        150.0,  # null lon/lat
        90.0,
        -5.0,
        None,
        1050.0,
        "7700",
        False,
        0,
        0,
        0,
    ]

    aircraft = parse_state_vector(raw_vector)
    assert aircraft is None


# --- 3. ATC Heuristic Tests ---
def test_check_lhr_approach_valid():
    """Aircraft meeting all LHR approach criteria."""
    aircraft = AircraftState(
        icao24="123456",
        callsign="BAW1",
        origin_country="UK",
        last_contact=0,
        latitude=51.4700,
        longitude=-0.5000,  # Very close to LHR
        baro_altitude=800.0,  # Below 1200m
        on_ground=False,
        velocity=100.0,
        true_track=92.0,  # Runway 09 heading
        vertical_rate=-3.0,  # Descending
        geo_altitude=850.0,
        squawk=None,
        position_source=None,
        category=None,
        is_approaching_lhr=False,
    )
    assert check_lhr_approach(aircraft) is True


def test_check_lhr_approach_wrong_heading():
    """Aircraft close and descending, but flying North."""
    aircraft = AircraftState(
        icao24="123456",
        callsign="BAW1",
        origin_country="UK",
        last_contact=0,
        latitude=51.4700,
        longitude=-0.5000,
        baro_altitude=800.0,
        on_ground=False,
        velocity=100.0,
        true_track=360.0,  # Northbound (fails track check)
        vertical_rate=-3.0,
        geo_altitude=850.0,
        squawk=None,
        position_source=None,
        category=None,
        is_approaching_lhr=False,
    )
    assert check_lhr_approach(aircraft) is False
