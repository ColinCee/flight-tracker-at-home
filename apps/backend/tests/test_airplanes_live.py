import time
from unittest.mock import patch

import pytest
from src.airplanes_live import (
    calculate_distance_km,
    check_lhr_approach,
    get_current_airspace_state,
    parse_aircraft,
)
from src.models import AircraftState


# --- 1. Math: Haversine distance ---
def test_calculate_distance_km():
    """Validates the Haversine formula with a known distance."""
    lat1, lon1 = 51.4700, -0.4543
    lat2, lon2 = 51.4839, -0.6044
    dist = calculate_distance_km(lat1, lon1, lat2, lon2)
    assert 10.0 < dist < 12.0


# --- 2. parse_aircraft: valid full dict ---
def test_parse_aircraft_valid():
    """Ensures a valid Airplanes.live dict maps to the Pydantic model correctly."""
    ac = {
        "hex": "400a5b",
        "flight": "BAW123  ",
        "lat": 51.47,
        "lon": -0.45,
        "alt_baro": 1000,
        "alt_geom": 1050,
        "gs": 150.0,
        "ias": 140.0,
        "track": 90.0,
        "baro_rate": -500,
        "squawk": "7700",
        "type": "adsb_icao",
        "category": "A5",
        "r": "G-TEST",
        "t": "A320",
        "seen": 2,
    }

    aircraft = parse_aircraft(ac)
    assert aircraft is not None
    assert aircraft.icao24 == "400a5b"
    assert aircraft.callsign == "BAW123"
    assert aircraft.registration == "G-TEST"
    assert aircraft.aircraft_type == "A320"
    assert aircraft.category == "Heavy"
    assert aircraft.latitude == 51.47
    assert aircraft.longitude == -0.45
    assert aircraft.baro_altitude_ft == 1000
    assert aircraft.geo_altitude_ft == 1050
    assert aircraft.ground_speed_kts == 150.0
    assert aircraft.true_track == 90.0
    assert aircraft.vertical_rate_fpm == -500
    assert aircraft.on_ground is False
    assert aircraft.squawk == "7700"
    assert aircraft.position_source == "ADS-B"
    assert aircraft.is_climbing is False
    assert aircraft.is_descending is False
    assert aircraft.is_approaching_lhr is False


# --- 3. parse_aircraft: missing lat/lon ---
def test_parse_aircraft_missing_coords():
    ac = {
        "hex": "400a5b",
        "flight": "BAW123",
        "lat": None,
        "lon": None,
        "alt_baro": 1000,
    }
    assert parse_aircraft(ac) is None


# --- 4. parse_aircraft: alt_baro="ground" ---
def test_parse_aircraft_on_ground():
    ac = {"hex": "400a5b", "lat": 51.47, "lon": -0.45, "alt_baro": "ground"}
    assert parse_aircraft(ac) is None


# --- 5. parse_aircraft: alt_baro < 100 ---
def test_parse_aircraft_low_altitude():
    ac = {"hex": "400a5b", "lat": 51.47, "lon": -0.45, "alt_baro": 99}
    assert parse_aircraft(ac) is None


# --- 6. parse_aircraft: strips callsign whitespace ---
def test_parse_aircraft_strips_callsign():
    ac = {
        "hex": "400a5b",
        "flight": "BAW123  ",
        "lat": 51.47,
        "lon": -0.45,
        "alt_baro": 5000,
        "type": "adsb_icao",
    }
    aircraft = parse_aircraft(ac)
    assert aircraft is not None
    assert aircraft.callsign == "BAW123"


# --- 7. parse_aircraft: rejects garbage callsigns ---
def test_parse_aircraft_rejects_garbage_callsign():
    ac = {
        "hex": "400a5b",
        "flight": "@@@@@@@@",
        "lat": 51.47,
        "lon": -0.45,
        "alt_baro": 5000,
        "type": "adsb_icao",
    }
    aircraft = parse_aircraft(ac)
    assert aircraft is not None
    assert aircraft.callsign is None


# --- 8. parse_aircraft: handles missing optional fields ---
def test_parse_aircraft_missing_optional_fields():
    ac = {
        "hex": "400a5b",
        "lat": 51.47,
        "lon": -0.45,
        "alt_baro": 5000,
    }
    aircraft = parse_aircraft(ac)
    assert aircraft is not None
    assert aircraft.callsign is None
    assert aircraft.registration is None
    assert aircraft.aircraft_type is None
    assert aircraft.vertical_rate_fpm is None
    assert aircraft.true_track is None
    assert aircraft.ground_speed_kts is None


# --- 9. Position source mapping ---
def test_position_source_adsb():
    ac = {"hex": "aaa", "lat": 51.0, "lon": 0.0, "alt_baro": 5000, "type": "adsb_icao"}
    assert parse_aircraft(ac).position_source == "ADS-B"


def test_position_source_mlat():
    ac = {"hex": "aaa", "lat": 51.0, "lon": 0.0, "alt_baro": 5000, "type": "mlat"}
    assert parse_aircraft(ac).position_source == "MLAT"


def test_position_source_unknown():
    ac = {
        "hex": "aaa",
        "lat": 51.0,
        "lon": 0.0,
        "alt_baro": 5000,
        "type": "some_new_type",
    }
    assert parse_aircraft(ac).position_source == "Unknown"


# --- 10. Category resolution ---
def test_category_heavy():
    ac = {"hex": "aaa", "lat": 51.0, "lon": 0.0, "alt_baro": 5000, "category": "A5"}
    assert parse_aircraft(ac).category == "Heavy"


def test_category_large():
    ac = {"hex": "aaa", "lat": 51.0, "lon": 0.0, "alt_baro": 5000, "category": "A3"}
    assert parse_aircraft(ac).category == "Large"


def test_category_unknown_code():
    ac = {"hex": "aaa", "lat": 51.0, "lon": 0.0, "alt_baro": 5000, "category": "Z9"}
    assert parse_aircraft(ac).category == "Unknown"


# --- 11. last_contact computed from seen field ---
def test_last_contact_from_seen():
    now = int(time.time())
    ac = {"hex": "aaa", "lat": 51.0, "lon": 0.0, "alt_baro": 5000, "seen": 5}
    aircraft = parse_aircraft(ac)
    assert aircraft is not None
    # last_contact should be approximately now - 5
    assert abs(aircraft.last_contact - (now - 5)) <= 1


# --- 12. is_climbing and is_descending set by orchestrator ---
@pytest.mark.asyncio
@patch("src.airplanes_live.fetch_london_airspace")
async def test_orchestrator_sets_climbing_descending(mock_fetch):
    """The orchestrator should compute is_climbing/is_descending from vertical rate."""
    mock_fetch.return_value = [
        {
            "hex": "aaa",
            "lat": 51.0,
            "lon": 0.0,
            "alt_baro": 5000,
            "baro_rate": 500,
            "track": 45.0,
            "type": "adsb_icao",
        },
        {
            "hex": "bbb",
            "lat": 51.0,
            "lon": 0.0,
            "alt_baro": 5000,
            "baro_rate": -500,
            "track": 45.0,
            "type": "adsb_icao",
        },
        {
            "hex": "ccc",
            "lat": 51.0,
            "lon": 0.0,
            "alt_baro": 5000,
            "baro_rate": 100,
            "track": 45.0,
            "type": "adsb_icao",
        },
    ]

    aircraft = await get_current_airspace_state()
    assert len(aircraft) == 3

    climber = next(a for a in aircraft if a.icao24 == "aaa")
    assert climber.is_climbing is True
    assert climber.is_descending is False

    descender = next(a for a in aircraft if a.icao24 == "bbb")
    assert descender.is_climbing is False
    assert descender.is_descending is True

    level = next(a for a in aircraft if a.icao24 == "ccc")
    assert level.is_climbing is False
    assert level.is_descending is False


# --- 13. check_lhr_approach: valid approach ---
def test_check_lhr_approach_valid():
    """Aircraft meeting all LHR approach criteria."""
    aircraft = AircraftState(
        icao24="123456",
        callsign="BAW1",
        registration="G-EUAA",
        aircraft_type="A320",
        category="Heavy",
        latitude=51.47,
        longitude=-0.50,
        baro_altitude_ft=800,
        geo_altitude_ft=850,
        ground_speed_kts=100.0,
        true_track=92.0,
        vertical_rate_fpm=-300,
        on_ground=False,
        squawk=None,
        last_contact=0,
        position_source="ADS-B",
        is_climbing=False,
        is_descending=True,
        is_approaching_lhr=False,
    )
    assert check_lhr_approach(aircraft) is True


# --- 14. check_lhr_approach: wrong heading ---
def test_check_lhr_approach_wrong_heading():
    """Aircraft close and descending, but flying North."""
    aircraft = AircraftState(
        icao24="123456",
        callsign="BAW1",
        registration="G-EUAA",
        aircraft_type="A320",
        category="Heavy",
        latitude=51.47,
        longitude=-0.50,
        baro_altitude_ft=800,
        geo_altitude_ft=850,
        ground_speed_kts=100.0,
        true_track=360.0,
        vertical_rate_fpm=-300,
        on_ground=False,
        squawk=None,
        last_contact=0,
        position_source="ADS-B",
        is_climbing=False,
        is_descending=True,
        is_approaching_lhr=False,
    )
    assert check_lhr_approach(aircraft) is False


# --- 15. check_lhr_approach: too high ---
def test_check_lhr_approach_too_high():
    """Aircraft above 6500ft should not be considered on approach."""
    aircraft = AircraftState(
        icao24="123456",
        callsign="BAW1",
        registration="G-EUAA",
        aircraft_type="A320",
        category="Heavy",
        latitude=51.47,
        longitude=-0.50,
        baro_altitude_ft=8000,
        geo_altitude_ft=8050,
        ground_speed_kts=100.0,
        true_track=92.0,
        vertical_rate_fpm=-300,
        on_ground=False,
        squawk=None,
        last_contact=0,
        position_source="ADS-B",
        is_climbing=False,
        is_descending=True,
        is_approaching_lhr=False,
    )
    assert check_lhr_approach(aircraft) is False


# --- 16. check_lhr_approach: not descending ---
def test_check_lhr_approach_not_descending():
    """Aircraft that is level or climbing should not be on approach."""
    aircraft = AircraftState(
        icao24="123456",
        callsign="BAW1",
        registration="G-EUAA",
        aircraft_type="A320",
        category="Heavy",
        latitude=51.47,
        longitude=-0.50,
        baro_altitude_ft=800,
        geo_altitude_ft=850,
        ground_speed_kts=100.0,
        true_track=92.0,
        vertical_rate_fpm=0,
        on_ground=False,
        squawk=None,
        last_contact=0,
        position_source="ADS-B",
        is_climbing=False,
        is_descending=False,
        is_approaching_lhr=False,
    )
    assert check_lhr_approach(aircraft) is False


# --- 17. check_lhr_approach: too far from Heathrow ---
def test_check_lhr_approach_too_far():
    """Aircraft more than 20km away should not be on approach."""
    aircraft = AircraftState(
        icao24="123456",
        callsign="BAW1",
        registration="G-EUAA",
        aircraft_type="A320",
        category="Heavy",
        latitude=52.0,
        longitude=0.5,
        baro_altitude_ft=3000,
        geo_altitude_ft=3050,
        ground_speed_kts=150.0,
        true_track=270.0,
        vertical_rate_fpm=-500,
        on_ground=False,
        squawk=None,
        last_contact=0,
        position_source="ADS-B",
        is_climbing=False,
        is_descending=True,
        is_approaching_lhr=False,
    )
    assert check_lhr_approach(aircraft) is False


# --- 18. check_lhr_approach: on_ground ---
def test_check_lhr_approach_on_ground():
    """Aircraft on the ground should never be on approach."""
    aircraft = AircraftState(
        icao24="123456",
        callsign="BAW1",
        registration="G-EUAA",
        aircraft_type="A320",
        category="Heavy",
        latitude=51.47,
        longitude=-0.45,
        baro_altitude_ft=0,
        geo_altitude_ft=0,
        ground_speed_kts=10.0,
        true_track=270.0,
        vertical_rate_fpm=-100,
        on_ground=True,
        squawk=None,
        last_contact=0,
        position_source="ADS-B",
        is_climbing=False,
        is_descending=False,
        is_approaching_lhr=False,
    )
    assert check_lhr_approach(aircraft) is False


# --- 19. check_lhr_approach: westbound valid ---
def test_check_lhr_approach_westbound():
    """Aircraft on valid westbound (runway 27) approach should be detected."""
    aircraft = AircraftState(
        icao24="123456",
        callsign="BAW1",
        registration="G-EUAA",
        aircraft_type="A320",
        category="Heavy",
        latitude=51.47,
        longitude=-0.30,
        baro_altitude_ft=2000,
        geo_altitude_ft=2050,
        ground_speed_kts=140.0,
        true_track=272.0,
        vertical_rate_fpm=-700,
        on_ground=False,
        squawk=None,
        last_contact=0,
        position_source="ADS-B",
        is_climbing=False,
        is_descending=True,
        is_approaching_lhr=False,
    )
    assert check_lhr_approach(aircraft) is True


# --- 20. check_lhr_approach: null vertical rate ---
def test_check_lhr_approach_null_vertical_rate():
    """Aircraft with no vertical rate data should not be on approach."""
    aircraft = AircraftState(
        icao24="123456",
        callsign="BAW1",
        registration="G-EUAA",
        aircraft_type="A320",
        category="Heavy",
        latitude=51.47,
        longitude=-0.50,
        baro_altitude_ft=2000,
        geo_altitude_ft=2050,
        ground_speed_kts=140.0,
        true_track=90.0,
        vertical_rate_fpm=None,
        on_ground=False,
        squawk=None,
        last_contact=0,
        position_source="ADS-B",
        is_climbing=False,
        is_descending=False,
        is_approaching_lhr=False,
    )
    assert check_lhr_approach(aircraft) is False


# --- 21. check_lhr_approach: null altitude ---
def test_check_lhr_approach_null_altitude():
    """Aircraft with no barometric altitude should not be on approach."""
    aircraft = AircraftState(
        icao24="123456",
        callsign="BAW1",
        registration="G-EUAA",
        aircraft_type="A320",
        category="Heavy",
        latitude=51.47,
        longitude=-0.50,
        baro_altitude_ft=None,
        geo_altitude_ft=2050,
        ground_speed_kts=140.0,
        true_track=90.0,
        vertical_rate_fpm=-500,
        on_ground=False,
        squawk=None,
        last_contact=0,
        position_source="ADS-B",
        is_climbing=False,
        is_descending=True,
        is_approaching_lhr=False,
    )
    assert check_lhr_approach(aircraft) is False


# --- 22. parse_aircraft: non-numeric gs/track are safely ignored ---
def test_parse_aircraft_non_numeric_gs_track():
    """Non-numeric gs/track should result in None, not crash the parser."""
    ac = {
        "hex": "400a5b",
        "lat": 51.47,
        "lon": -0.45,
        "alt_baro": 5000,
        "gs": "invalid",
        "track": "bad_data",
        "type": "adsb_icao",
    }
    aircraft = parse_aircraft(ac)
    assert aircraft is not None
    assert aircraft.ground_speed_kts is None
    assert aircraft.true_track is None


# --- 23. parse_aircraft: alt_baro=None passes through ---
def test_parse_aircraft_alt_baro_none():
    """When alt_baro key exists but value is None, aircraft is still parsed."""
    ac = {
        "hex": "400a5b",
        "lat": 51.47,
        "lon": -0.45,
        "alt_baro": None,
        "type": "adsb_icao",
    }
    aircraft = parse_aircraft(ac)
    assert aircraft is not None
    assert aircraft.baro_altitude_ft is None


# --- 24. parse_aircraft: non-numeric seen defaults safely ---
def test_parse_aircraft_non_numeric_seen():
    """Non-numeric 'seen' field should default to 0 offset."""
    now = int(time.time())
    ac = {
        "hex": "400a5b",
        "lat": 51.47,
        "lon": -0.45,
        "alt_baro": 5000,
        "seen": "invalid",
    }
    aircraft = parse_aircraft(ac)
    assert aircraft is not None
    # With "invalid" seen, offset is 0, so last_contact ≈ now
    assert abs(aircraft.last_contact - now) <= 1


# --- 25. parse_aircraft: missing hex defaults to "unknown" ---
def test_parse_aircraft_missing_hex():
    ac = {
        "lat": 51.47,
        "lon": -0.45,
        "alt_baro": 5000,
    }
    aircraft = parse_aircraft(ac)
    assert aircraft is not None
    assert aircraft.icao24 == "unknown"
