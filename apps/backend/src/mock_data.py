"""Mock aircraft data for E2E and integration testing.

Returns a realistic set of aircraft over London airspace so E2E tests
can run without hitting the Airplanes.live API.

Activate with: OPENSKY_MOCK=true
"""

from src.models import AircraftState

# Mix of approaching LHR, cruising, climbing, and descending aircraft
MOCK_AIRCRAFT: list[AircraftState] = [
    # Approaching Heathrow from the east (ILS 27L)
    AircraftState(
        icao24="400a5b",
        callsign="BAW123",
        registration="G-XWBA",
        oat=12.0,
        origin_country="United Kingdom",
        latitude=51.47,
        longitude=-0.30,
        baro_altitude_feet=1950.0,
        geo_altitude_feet=2000.0,
        velocity_gs_knots=145.0,
        velocity_ias_knots=140.0,
        true_track=270.0,
        vertical_speed_fps=-10.0,  # ~ -600 fpm
        on_ground=False,
        squawk="7700",
        last_contact=0,
        position_source="ADSB_ICAO",
        category="A5",  # Heavy
        aircraft_type="A359",
        is_approaching_lhr=True,
    ),
    # Approaching Heathrow from the west (ILS 09R)
    AircraftState(
        icao24="3c4b26",
        callsign="DLH456",
        registration="D-AINA",
        oat=11.5,
        origin_country="Germany",
        latitude=51.48,
        longitude=-0.60,
        baro_altitude_feet=2950.0,
        geo_altitude_feet=3000.0,
        velocity_gs_knots=160.0,
        velocity_ias_knots=155.0,
        true_track=90.0,
        vertical_speed_fps=-12.0,  # ~ -720 fpm
        on_ground=False,
        squawk="4521",
        last_contact=0,
        position_source="ADSB_ICAO",
        category="A3",  # Large
        aircraft_type="A320",
        is_approaching_lhr=True,
    ),
    # Cruising over London at high altitude
    AircraftState(
        icao24="a1b2c3",
        callsign="UAL789",
        registration="N123UA",
        oat=-54.0,
        origin_country="United States",
        latitude=51.55,
        longitude=-0.10,
        baro_altitude_feet=36000.0,
        geo_altitude_feet=36050.0,
        velocity_gs_knots=450.0,
        velocity_ias_knots=250.0,
        true_track=45.0,
        vertical_speed_fps=0.0,
        on_ground=False,
        squawk="2345",
        last_contact=0,
        position_source="ADSB_ICAO",
        category="A5",  # Heavy
        aircraft_type="B77W",
        is_approaching_lhr=False,
    ),
    # Climbing out of London City Airport
    AircraftState(
        icao24="d4e5f6",
        callsign="CFE101",
        registration="G-LCYE",
        oat=5.0,
        origin_country="United Kingdom",
        latitude=51.50,
        longitude=0.06,
        baro_altitude_feet=6500.0,
        geo_altitude_feet=6600.0,
        velocity_gs_knots=250.0,
        velocity_ias_knots=240.0,
        true_track=270.0,
        vertical_speed_fps=25.0,  # ~ +1500 fpm
        on_ground=False,
        squawk="5512",
        last_contact=0,
        position_source="ADSB_ICAO",
        category="A3",  # Large
        aircraft_type="E190",
        is_approaching_lhr=False,
    ),
    # Descending towards Gatwick
    AircraftState(
        icao24="7890ab",
        callsign="EZY202",
        registration="G-UZHA",
        oat=-10.0,
        origin_country="United Kingdom",
        latitude=51.20,
        longitude=-0.15,
        baro_altitude_feet=10000.0,
        geo_altitude_feet=10200.0,
        velocity_gs_knots=280.0,
        velocity_ias_knots=260.0,
        true_track=180.0,
        vertical_speed_fps=-15.0,  # ~ -900 fpm
        on_ground=False,
        squawk="3344",
        last_contact=0,
        position_source="ADSB_ICAO",
        category="A3",  # Large
        aircraft_type="A320",
        is_approaching_lhr=False,
    ),
    # Helicopter over central London
    AircraftState(
        icao24="cdef01",
        callsign="GBCDE",
        registration="G-BCDE",
        oat=15.0,
        origin_country="United Kingdom",
        latitude=51.51,
        longitude=-0.12,
        baro_altitude_feet=1000.0,
        geo_altitude_feet=1050.0,
        velocity_gs_knots=110.0,
        velocity_ias_knots=110.0,
        true_track=0.0,
        vertical_speed_fps=0.0,
        on_ground=False,
        squawk=None,
        last_contact=0,
        position_source="ADSB_ICAO",
        category="A7",  # Rotorcraft
        aircraft_type="EC35",
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
