"""Realistic mock aircraft data for UI development.

Returns a small set of aircraft that drift on each request, simulating
movement. Used by the /aircraft endpoint until the real OpenSky integration
is built.
"""

import math
import time

from src.models import AircraftResponse, AircraftState, KPIs

_SEED_AIRCRAFT: list[dict] = [
    {
        "icao24": "400a1b",
        "callsign": "BAW123",
        "origin_country": "United Kingdom",
        "latitude": 51.465,
        "longitude": -0.382,
        "baro_altitude": 610.0,
        "velocity": 72.0,
        "true_track": 270.0,
        "vertical_rate": -3.5,
        "squawk": "5765",
        "is_approaching_lhr": True,
    },
    {
        "icao24": "3c4a8f",
        "callsign": "DLH42A",
        "origin_country": "Germany",
        "latitude": 51.52,
        "longitude": -0.08,
        "baro_altitude": 11280.0,
        "velocity": 240.0,
        "true_track": 135.0,
        "vertical_rate": 0.0,
        "squawk": "2347",
        "is_approaching_lhr": False,
    },
    {
        "icao24": "400d4e",
        "callsign": "BAW901",
        "origin_country": "United Kingdom",
        "latitude": 51.49,
        "longitude": -0.52,
        "baro_altitude": 1520.0,
        "velocity": 130.0,
        "true_track": 290.0,
        "vertical_rate": 8.5,
        "squawk": "5412",
        "is_approaching_lhr": False,
    },
    {
        "icao24": "39ac47",
        "callsign": "AFR678",
        "origin_country": "France",
        "latitude": 51.54,
        "longitude": -0.17,
        "baro_altitude": 4200.0,
        "velocity": 165.0,
        "true_track": 180.0,
        "vertical_rate": -2.0,
        "squawk": "6154",
        "is_approaching_lhr": False,
    },
    {
        "icao24": "400399",
        "callsign": "BAW777",
        "origin_country": "United Kingdom",
        "latitude": 51.55,
        "longitude": -0.22,
        "baro_altitude": 2400.0,
        "velocity": 140.0,
        "true_track": 120.0,
        "vertical_rate": -1.0,
        "squawk": "7700",
        "is_approaching_lhr": False,
    },
]

# London bounding box for wrapping
_LAT_MIN, _LAT_MAX = 51.28, 51.70
_LON_MIN, _LON_MAX = -0.53, 0.23


def _wrap(val: float, lo: float, hi: float) -> float:
    """Wrap a value back into [lo, hi] range."""
    span = hi - lo
    return lo + (val - lo) % span


def build_mock_response() -> AircraftResponse:
    """Build a response with aircraft that drift based on wall-clock time."""
    now = time.time()
    elapsed = now % 3600  # loop every hour

    aircraft: list[AircraftState] = []
    for seed in _SEED_AIRCRAFT:
        # Move aircraft along its heading proportional to elapsed time
        speed_deg_per_sec = seed["velocity"] / 111_000  # rough m/s → deg/s
        heading_rad = math.radians(seed["true_track"])
        dlat = math.cos(heading_rad) * speed_deg_per_sec * elapsed
        dlng = math.sin(heading_rad) * speed_deg_per_sec * elapsed

        lat = _wrap(seed["latitude"] + dlat, _LAT_MIN, _LAT_MAX)
        lng = _wrap(seed["longitude"] + dlng, _LON_MIN, _LON_MAX)

        aircraft.append(
            AircraftState(
                icao24=seed["icao24"],
                callsign=seed["callsign"],
                origin_country=seed["origin_country"],
                latitude=lat,
                longitude=lng,
                baro_altitude=seed["baro_altitude"],
                geo_altitude=seed["baro_altitude"],
                velocity=seed["velocity"],
                true_track=seed["true_track"],
                vertical_rate=seed["vertical_rate"],
                on_ground=False,
                squawk=seed["squawk"],
                last_contact=int(now),
                is_approaching_lhr=seed["is_approaching_lhr"],
            )
        )

    inbound = sum(1 for a in aircraft if a.is_approaching_lhr)
    return AircraftResponse(
        timestamp=int(now),
        cache_age_seconds=0.0,
        aircraft=aircraft,
        kpis=KPIs(
            inbound_lhr=inbound,
            throughput_last_60min=12,
            tracked_aircraft=len(aircraft),
            data_freshness_seconds=0.0,
            api_health="green",
        ),
    )
