"""Mock aircraft data for E2E and integration testing.

Returns a realistic set of aircraft over London airspace so E2E tests
can run without hitting the Airplanes.live API.

Activate with: MOCK_DATA=true
"""

from src.models import AircraftState

# Mix of approaching LHR, cruising, climbing, and descending aircraft
MOCK_AIRCRAFT: list[AircraftState] = [
    # Approaching Heathrow from the east (ILS 27L)
    AircraftState(
        icao24="400a5b",
        callsign="BAW123",
        registration="G-XWBA",
        latitude=51.47,
        longitude=-0.30,
        baro_altitude_ft=1950,
        geo_altitude_ft=2000,
        ground_speed_kts=145.0,
        true_track=270.0,
        vertical_rate_fpm=-700,
        on_ground=False,
        squawk="7700",
        last_contact=0,
        position_source="ADS-B",
        category="Heavy",
        aircraft_type="A359",
        is_climbing=False,
        is_descending=True,
        is_approaching_lhr=True,
    ),
    # Approaching Heathrow from the west (ILS 09R)
    AircraftState(
        icao24="3c4b26",
        callsign="DLH456",
        registration="D-AINA",
        latitude=51.48,
        longitude=-0.60,
        baro_altitude_ft=2950,
        geo_altitude_ft=3000,
        ground_speed_kts=160.0,
        true_track=90.0,
        vertical_rate_fpm=-800,
        on_ground=False,
        squawk="4521",
        last_contact=0,
        position_source="ADS-B",
        category="Large",
        aircraft_type="A320",
        is_climbing=False,
        is_descending=True,
        is_approaching_lhr=True,
    ),
    # Cruising over London at high altitude
    AircraftState(
        icao24="a1b2c3",
        callsign="UAL789",
        registration="N123UA",
        latitude=51.55,
        longitude=-0.10,
        baro_altitude_ft=36000,
        geo_altitude_ft=36050,
        ground_speed_kts=450.0,
        true_track=45.0,
        vertical_rate_fpm=0,
        on_ground=False,
        squawk="2345",
        last_contact=0,
        position_source="ADS-B",
        category="Heavy",
        aircraft_type="B77W",
        is_climbing=False,
        is_descending=False,
        is_approaching_lhr=False,
    ),
    # Climbing out of London City Airport
    AircraftState(
        icao24="d4e5f6",
        callsign="CFE101",
        registration="G-LCYE",
        latitude=51.50,
        longitude=0.06,
        baro_altitude_ft=6500,
        geo_altitude_ft=6600,
        ground_speed_kts=250.0,
        true_track=270.0,
        vertical_rate_fpm=1500,
        on_ground=False,
        squawk="5512",
        last_contact=0,
        position_source="ADS-B",
        category="Large",
        aircraft_type="E190",
        is_climbing=True,
        is_descending=False,
        is_approaching_lhr=False,
    ),
    # Descending towards Gatwick
    AircraftState(
        icao24="7890ab",
        callsign="EZY202",
        registration="G-UZHA",
        latitude=51.20,
        longitude=-0.15,
        baro_altitude_ft=10000,
        geo_altitude_ft=10200,
        ground_speed_kts=280.0,
        true_track=180.0,
        vertical_rate_fpm=-1200,
        on_ground=False,
        squawk="3344",
        last_contact=0,
        position_source="ADS-B",
        category="Large",
        aircraft_type="A320",
        is_climbing=False,
        is_descending=True,
        is_approaching_lhr=False,
    ),
    # Helicopter over central London
    AircraftState(
        icao24="cdef01",
        callsign="GBCDE",
        registration="G-BCDE",
        latitude=51.51,
        longitude=-0.12,
        baro_altitude_ft=1000,
        geo_altitude_ft=1050,
        ground_speed_kts=110.0,
        true_track=0.0,
        vertical_rate_fpm=0,
        on_ground=False,
        squawk=None,
        last_contact=0,
        position_source="ADS-B",
        category="Rotorcraft",
        aircraft_type="EC35",
        is_climbing=False,
        is_descending=False,
        is_approaching_lhr=False,
    ),
]


def get_mock_aircraft() -> list[AircraftState]:
    """Return mock aircraft with current timestamps."""
    import time

    now = int(time.time())
    for ac in MOCK_AIRCRAFT:
        ac.last_contact = now
    return MOCK_AIRCRAFT.copy()
