from src.airplanes_live import (
    calculate_distance_km,
    check_lhr_approach,
    parse_state_vector,
)
from src.models import AircraftState


# --- 1. Math Tests ---
def test_calculate_distance_km():
    """Validates the Haversine formula with a known distance."""
    lat1, lon1 = 51.4700, -0.4543
    lat2, lon2 = 51.4839, -0.6044
    dist = calculate_distance_km(lat1, lon1, lat2, lon2)
    assert 10.0 < dist < 12.0


# --- 2. Transformation Tests ---
def test_parse_state_vector_valid():
    """Ensures a valid Airplanes.live dict maps to the Pydantic model correctly."""
    ac = {
        "hex": "400a5b",
        "flight": "BAW123  ",
        "lat": 51.47,
        "lon": -0.45,
        "alt_baro": 1000.0,
        "alt_geom": 1050.0,
        "gs": 150.0,
        "ias": 140.0,
        "track": 90.0,
        "baro_rate": -500.0,
        "squawk": "7700",
        "type": "ADSB_ICAO",
        "category": "A5",
        "r": "G-TEST",
        "t": "A320",
    }

    aircraft = parse_state_vector(ac)
    assert aircraft is not None
    assert aircraft.icao24 == "400a5b"
    assert aircraft.callsign == "BAW123"  # Check stripping works
    assert aircraft.longitude == -0.45
    assert aircraft.baro_altitude_feet == 1000.0
    assert aircraft.category == "A5"


def test_parse_state_vector_missing_coords():
    ac = {
        "hex": "400a5b",
        "flight": "BAW123",
        "lat": None,
        "lon": None,
        "alt_baro": 1000.0,
    }
    assert parse_state_vector(ac) is None


# --- 3. ATC Heuristic Tests ---
def test_check_lhr_approach_valid():
    """Aircraft meeting all LHR approach criteria."""
    aircraft = AircraftState(
        icao24="123456",
        callsign="BAW1",
        registration="G-EUAA",
        oat=10.0,
        origin_country="UK",
        last_contact=0,
        latitude=51.4700,
        longitude=-0.5000,
        baro_altitude_feet=800.0,
        geo_altitude_feet=850.0,
        velocity_gs_knots=100.0,
        velocity_ias_knots=100.0,
        true_track=92.0,
        vertical_speed_fps=-3.0,
        on_ground=False,
        squawk=None,
        position_source="ADS-B",
        category="A5",
        aircraft_type="A320",
        is_approaching_lhr=False,
    )
    assert check_lhr_approach(aircraft) is True


def test_check_lhr_approach_wrong_heading():
    """Aircraft close and descending, but flying North."""
    aircraft = AircraftState(
        icao24="123456",
        callsign="BAW1",
        registration="G-EUAA",
        oat=10.0,
        origin_country="UK",
        last_contact=0,
        latitude=51.4700,
        longitude=-0.5000,
        baro_altitude_feet=800.0,
        geo_altitude_feet=850.0,
        velocity_gs_knots=100.0,
        velocity_ias_knots=100.0,
        true_track=360.0,  # Fails track check
        vertical_speed_fps=-3.0,
        on_ground=False,
        squawk=None,
        position_source="ADS-B",
        category="A5",
        aircraft_type="A320",
        is_approaching_lhr=False,
    )
    assert check_lhr_approach(aircraft) is False


# --- 4. Test remove aircraft on ground or below 100ft ---
def test_parse_state_vector_on_ground():
    ac = {"hex": "400a5b", "lat": 51.47, "lon": -0.45, "alt_baro": "ground"}
    assert parse_state_vector(ac) is None


def test_parse_state_vector_low_altitude():
    ac = {"hex": "400a5b", "lat": 51.47, "lon": -0.45, "alt_baro": 99.0}
    assert parse_state_vector(ac) is None
