import time
from unittest.mock import patch

import pytest
from src.airplanes_live import (
    calculate_distance_km,
    get_current_airspace_state,
    get_destination,
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
    assert aircraft.destination is None


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
    aircraft = parse_aircraft(ac)
    assert aircraft is not None
    assert aircraft.on_ground is True


# --- 5. parse_aircraft: alt_baro < 100 ---
def test_parse_aircraft_low_altitude():
    ac = {"hex": "400a5b", "lat": 51.47, "lon": -0.45, "alt_baro": 99}
    aircraft = parse_aircraft(ac)
    assert aircraft is not None
    assert aircraft.on_ground is True


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


# --- 13. get_destination: valid approach ---
def test_get_destination_valid():
    """Aircraft meeting all approach criteria for LHR."""
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
        destination=None,
    )
    assert get_destination(aircraft) == "LHR"


# --- 14. get_destination: wrong heading ---
def test_get_destination_wrong_heading():
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
        destination=None,
    )
    assert get_destination(aircraft) is None


# --- 15. get_destination: too high ---
def test_get_destination_too_high():
    """Aircraft above 4000ft should not be considered on approach."""
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
        destination=None,
    )
    assert get_destination(aircraft) is None


# --- 16. get_destination: not descending ---
def test_get_destination_not_descending():
    """Aircraft that is climbing should not be on approach."""
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
        vertical_rate_fpm=500,
        on_ground=False,
        squawk=None,
        last_contact=0,
        position_source="ADS-B",
        is_climbing=True,
        is_descending=False,
        destination=None,
    )
    assert get_destination(aircraft) is None


# --- 17. get_destination: too far ---
def test_get_destination_too_far():
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
        destination=None,
    )
    assert get_destination(aircraft) is None


# --- 18. get_destination: on_ground ---
def test_get_destination_on_ground():
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
        destination=None,
    )
    assert get_destination(aircraft) is None


# --- 19. get_destination: westbound valid ---
def test_get_destination_westbound():
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
        destination=None,
    )
    assert get_destination(aircraft) == "LHR"


# --- 20. get_destination: null vertical rate ---
def test_get_destination_null_vertical_rate():
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
        destination=None,
    )
    assert get_destination(aircraft) is None


# --- 21. get_destination: null altitude ---
def test_get_destination_null_altitude():
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
        destination=None,
    )
    assert get_destination(aircraft) is None


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


# --- 26. get_destination: parallel north (false positive prevention) ---
def test_get_destination_parallel_north():
    """Aircraft flying Westbound (270) but 5km North of the Heathrow centerline."""
    aircraft = AircraftState(
        icao24="123456",
        callsign="BAW1",
        registration="G-EUAA",
        aircraft_type="A320",
        category="Heavy",
        # LHR is at 51.4700. We place this plane at 51.5200 (~5.5km North)
        latitude=51.5200,
        longitude=-0.2500,  # East of LHR, approaching
        baro_altitude_ft=2000,
        geo_altitude_ft=2050,
        ground_speed_kts=140.0,
        true_track=270.0,  # Valid runway heading
        vertical_rate_fpm=-700,  # Valid descent
        on_ground=False,
        squawk=None,
        last_contact=0,
        position_source="ADS-B",
        is_climbing=False,
        is_descending=True,
        destination=None,
    )
    # Fails because the bearing from LHR is ~60 deg, not the required 90 deg
    assert get_destination(aircraft) is None


# --- 27. get_destination: parallel south (false positive prevention) ---
def test_get_destination_parallel_south():
    """Aircraft flying Eastbound (90) but 5km South of the Heathrow centerline."""
    aircraft = AircraftState(
        icao24="123456",
        callsign="BAW1",
        registration="G-EUAA",
        aircraft_type="A320",
        category="Heavy",
        # LHR is at 51.4700. We place this plane at 51.4200 (~5.5km South)
        latitude=51.4200,
        longitude=-0.6500,  # West of LHR, approaching
        baro_altitude_ft=2000,
        geo_altitude_ft=2050,
        ground_speed_kts=140.0,
        true_track=90.0,  # Valid runway heading
        vertical_rate_fpm=-700,  # Valid descent
        on_ground=False,
        squawk=None,
        last_contact=0,
        position_source="ADS-B",
        is_climbing=False,
        is_descending=True,
        destination=None,
    )
    # Fails because the bearing from LHR is ~240 deg, not the required 270 deg
    assert get_destination(aircraft) is None
