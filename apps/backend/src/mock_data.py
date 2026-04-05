"""Mock aircraft data for E2E and integration testing.

Returns a realistic set of aircraft over London airspace so E2E tests
can run without hitting the OpenSky API.

Activate with: OPENSKY_MOCK=true
"""

from src.models import AircraftState

# Mix of approaching LHR, cruising, climbing, and descending aircraft
MOCK_AIRCRAFT: list[AircraftState] = [
    # Approaching Heathrow from the east (ILS 27L)
    AircraftState(
        icao24="400a5b",
        callsign="BAW123",
        origin_country="United Kingdom",
        latitude=51.47,
        longitude=-0.30,
        baro_altitude=600.0,
        geo_altitude=620.0,
        velocity=130.0,
        true_track=270.0,
        vertical_rate=-4.0,
        on_ground=False,
        squawk="7700",
        last_contact=0,
        position_source="ADS-B",
        category="Large",
        is_approaching_lhr=True,
    ),
    # Approaching Heathrow from the west (ILS 09R)
    AircraftState(
        icao24="3c4b26",
        callsign="DLH456",
        origin_country="Germany",
        latitude=51.48,
        longitude=-0.60,
        baro_altitude=900.0,
        geo_altitude=920.0,
        velocity=140.0,
        true_track=90.0,
        vertical_rate=-3.5,
        on_ground=False,
        squawk="4521",
        last_contact=0,
        position_source="ADS-B",
        category="Large",
        is_approaching_lhr=True,
    ),
    # Cruising over London at high altitude
    AircraftState(
        icao24="a1b2c3",
        callsign="UAL789",
        origin_country="United States",
        latitude=51.55,
        longitude=-0.10,
        baro_altitude=11000.0,
        geo_altitude=11050.0,
        velocity=250.0,
        true_track=45.0,
        vertical_rate=0.0,
        on_ground=False,
        squawk="2345",
        last_contact=0,
        position_source="ADS-B",
        category="Heavy",
        is_approaching_lhr=False,
    ),
    # Climbing out of London City Airport
    AircraftState(
        icao24="d4e5f6",
        callsign="CFE101",
        origin_country="United Kingdom",
        latitude=51.50,
        longitude=0.06,
        baro_altitude=2000.0,
        geo_altitude=2020.0,
        velocity=180.0,
        true_track=270.0,
        vertical_rate=8.0,
        on_ground=False,
        squawk="5512",
        last_contact=0,
        position_source="ADS-B",
        category="Medium",
        is_approaching_lhr=False,
    ),
    # Descending towards Gatwick
    AircraftState(
        icao24="7890ab",
        callsign="EZY202",
        origin_country="United Kingdom",
        latitude=51.20,
        longitude=-0.15,
        baro_altitude=3000.0,
        geo_altitude=3050.0,
        velocity=160.0,
        true_track=180.0,
        vertical_rate=-5.0,
        on_ground=False,
        squawk="3344",
        last_contact=0,
        position_source="ADS-B",
        category="Large",
        is_approaching_lhr=False,
    ),
    # Helicopter over central London
    AircraftState(
        icao24="cdef01",
        callsign="GBCDE",
        origin_country="United Kingdom",
        latitude=51.51,
        longitude=-0.12,
        baro_altitude=300.0,
        geo_altitude=310.0,
        velocity=60.0,
        true_track=0.0,
        vertical_rate=0.0,
        on_ground=False,
        squawk=None,
        last_contact=0,
        position_source="ADS-B",
        category="Rotorcraft",
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
