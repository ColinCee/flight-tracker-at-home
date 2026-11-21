"""This module handles the extraction and transformation of ADS-B Exchange v2 API data.
It maps ADSBx v2 format JSON to strict Pydantic contracts and applies
spatial heuristics to determine Heathrow approach status.
"""

import logging
import math
import os
import time
from typing import Any, Literal, TypedDict

import httpx
from src.models import AircraftState, PositionSource

logger = logging.getLogger(__name__)

# --- Configuration & Constants ---
# ADSBx v2-shaped point endpoints, as URL templates with {lat}, {lon} and {radius}
# (nautical miles). adsb.fi is first: side by side it gives more and fresher
# positions, and adsb.lol refuses most daytime calls with 429.
ADSB_API_URL = os.getenv(
    "ADSB_API_URL",
    "https://opendata.adsb.fi/api/v3/lat/{lat}/lon/{lon}/dist/{radius}",
)
# Tried when the primary fails or has no usable aircraft; set it empty to disable.
ADSB_FALLBACK_URL = os.getenv(
    "ADSB_FALLBACK_URL", "https://api.adsb.lol/v2/point/{lat}/{lon}/{radius}"
)
# The primary failing this long in a row logs at error, not warning, so the
# homelab's errors-logged alert sees a primary the fallback is quietly covering.
PRIMARY_FAILING_ERROR_AFTER_S = 300

# Central London Reference Coordinates
LONDON_LAT = 51.5072
LONDON_LON = -0.1276

# Radius in Nautical Miles
RADIUS_NM = 60

# Position source mapping: airplanes.live type → friendly name
POSITION_SOURCE_MAP: dict[str, PositionSource] = {
    "adsb_icao": "ADS-B",
    "adsb_icao_nt": "ADS-B",
    "adsr_icao": "ADS-B",
    "mlat": "MLAT",
    "tisb_icao": "TIS-B",
    "tisb_other": "TIS-B",
    "tisb_trackfile": "TIS-B",
    "adsc": "ADS-C",
    "mode_s": "Mode S",
    "adsb_other": "ADS-B",
    "adsr_other": "ADS-B",
}

CATEGORY_MAP = {
    "A0": "Unknown",
    "A1": "Light",
    "A2": "Small",
    "A3": "Large",
    "A4": "High Vortex Large",
    "A5": "Heavy",
    "A6": "High Performance",
    "A7": "Rotorcraft",
    "B0": "Unknown",
    "B1": "Glider",
    "B2": "Lighter-than-air",
    "B3": "Skydiver",
    "B4": "Ultralight",
    "B5": "Reserved",
    "B6": "UAV",
    "B7": "Space Vehicle",
    "C0": "Unknown",
    "C1": "Emergency Vehicle",
    "C2": "Service Vehicle",
    "C3": "Fixed Obstruction",
    "C4": "Cluster Obstruction",
    "C5": "Line Obstruction",
    "D0": "Unknown",
}

_VERTICAL_RATE_THRESHOLD_FPM = 200

# Arrival heuristic (get_destination); tests/test_arrival_properties.py checks them.
APPROACH_RADIUS_KM = 25.0  # within this of the airport
APPROACH_MAX_ALTITUDE_FT = 4000  # typical ILS intercept altitude
APPROACH_TRACK_TOLERANCE_DEG = (
    15.0  # track either side of a runway heading, for crosswinds
)
APPROACH_CONE_DEG = 8.0  # bearing either side of the extended centreline

_http_client: httpx.AsyncClient | None = None
# When the primary's current run of failures began; None after a success.
_primary_failing_since: float | None = None


def init_client():
    """Initialize the client inside the active Event Loop."""
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(
            headers={"User-Agent": "FlightTrackerAtHome/1.1 (London TMA Project)"},
            timeout=10.0,
        )


async def close_client():
    """Close the HTTP client cleanly on shutdown."""
    global _http_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None


def get_client() -> httpx.AsyncClient:
    """Get the HTTP client."""
    global _http_client
    if _http_client is None:
        init_client()
    assert _http_client is not None
    return _http_client


# --- Phase 1: Extraction ---
async def _fetch_aircraft(url: str) -> list[dict[str, Any]]:
    response = await get_client().get(url)
    response.raise_for_status()
    data = response.json()
    # ADSBx v2 uses "ac"; some mirrors' older endpoints use "aircraft".
    return data.get("ac") or data.get("aircraft") or []


def _primary_failed(reason: str) -> None:
    """Log a primary failure: a warning while it may be a blip, an error once
    failures have lasted PRIMARY_FAILING_ERROR_AFTER_S in a row."""
    global _primary_failing_since
    now = time.monotonic()
    if _primary_failing_since is None:
        _primary_failing_since = now
    lasted = now - _primary_failing_since
    level = (
        logging.ERROR if lasted >= PRIMARY_FAILING_ERROR_AFTER_S else logging.WARNING
    )
    logger.log(level, "Primary ADS-B API %s (failing for %.0fs)", reason, lasted)


async def fetch_london_airspace() -> list[dict[str, Any]]:
    """Phase 1: Extraction - Fetches aircraft within 60nm of Central London.

    Tries the fallback when the primary errors, or answers with no aircraft that
    parse_aircraft can use (sources have degraded to empty 200s). Returns [] when
    both are empty, so the API reports offline; a fallback error propagates, so
    the cache serves its last data as stale.
    """
    global _primary_failing_since
    url = ADSB_API_URL.format(lat=LONDON_LAT, lon=LONDON_LON, radius=RADIUS_NM)

    try:
        aircraft = await _fetch_aircraft(url)
    except httpx.HTTPError as e:
        if not ADSB_FALLBACK_URL:
            logger.warning("Error fetching from ADS-B API: %s", e)
            raise
        _primary_failed(f"failed, trying fallback: {e!r}")
    else:
        if not ADSB_FALLBACK_URL or _has_usable_aircraft(aircraft):
            _primary_failing_since = None
            return aircraft
        _primary_failed(
            f"returned no usable aircraft ({len(aircraft)} entries), trying fallback"
        )

    fallback = ADSB_FALLBACK_URL.format(
        lat=LONDON_LAT, lon=LONDON_LON, radius=RADIUS_NM
    )
    try:
        return await _fetch_aircraft(fallback)
    except httpx.HTTPError as e:
        logger.warning("Error fetching from fallback ADS-B API: %s", e)
        raise


def _has_usable_aircraft(aircraft: list[dict[str, Any]]) -> bool:
    return any(parse_aircraft(ac) is not None for ac in aircraft)


def parse_aircraft(ac: dict[str, Any]) -> AircraftState | None:
    """Phase 2: Transformation - Maps airplanes.live dict to AircraftState.

    All aviation units are preserved as-is (feet, knots, fpm).
    """
    try:
        lat = ac.get("lat")
        lon = ac.get("lon")
        if lat is None or lon is None:
            return None

        # airplanes.live returns "ground" string for on-ground aircraft
        alt_baro = ac.get("alt_baro")
        is_on_ground = alt_baro == "ground" or (
            isinstance(alt_baro, (int, float)) and alt_baro < 100.0
        )

        raw_callsign = ac.get("flight")
        clean_callsign = raw_callsign.strip() if raw_callsign else None
        # Reject garbage callsigns like "@@@@@@@@"
        if clean_callsign and not clean_callsign[0].isalnum():
            clean_callsign = None

        raw_type = str(ac.get("type", "unknown"))
        position_source: PositionSource = POSITION_SOURCE_MAP.get(raw_type, "Unknown")

        raw_category = str(ac.get("category", ""))
        category = CATEGORY_MAP.get(raw_category, "Unknown")

        # Compute last_contact from relative "seen" field
        seen = ac.get("seen", 0)
        last_contact = int(
            time.time() - (seen if isinstance(seen, (int, float)) else 0)
        )

        baro_alt = alt_baro if isinstance(alt_baro, (int, float)) else None
        raw_geo = ac.get("alt_geom")
        geo_alt = int(raw_geo) if isinstance(raw_geo, (int, float)) else None
        raw_baro_rate = ac.get("baro_rate")
        vert_rate = (
            int(raw_baro_rate) if isinstance(raw_baro_rate, (int, float)) else None
        )

        raw_gs = ac.get("gs")
        gs = float(raw_gs) if isinstance(raw_gs, (int, float)) else None

        raw_track = ac.get("track")
        track = float(raw_track) if isinstance(raw_track, (int, float)) else None

        return AircraftState(
            icao24=ac.get("hex", "unknown"),
            callsign=clean_callsign,
            registration=ac.get("r"),
            last_contact=last_contact,
            longitude=lon,
            latitude=lat,
            baro_altitude_ft=int(baro_alt) if baro_alt is not None else None,
            geo_altitude_ft=geo_alt,
            ground_speed_kts=gs,
            true_track=track,
            vertical_rate_fpm=vert_rate,
            on_ground=is_on_ground,
            squawk=ac.get("squawk"),
            position_source=position_source,
            category=category,
            aircraft_type=ac.get("t"),
            is_climbing=False,  # Evaluated downstream
            is_descending=False,  # Evaluated downstream
            destination=None,  # Evaluated downstream
        )
    except Exception as e:
        logger.warning("Failed to parse aircraft dictionary: %s", e)
        return None


# --- Phase 3: Spatial Math & Business Logic ---
class AirportData(TypedDict):
    lat: float
    lon: float
    headings: list[int]


LONDON_AIRPORTS: dict[str, AirportData] = {
    "LHR": {"lat": 51.4700, "lon": -0.4543, "headings": [90, 270]},
    "LGW": {"lat": 51.1537, "lon": -0.1821, "headings": [80, 260]},
    "STN": {"lat": 51.8860, "lon": 0.2389, "headings": [40, 220]},
    "LTN": {"lat": 51.8747, "lon": -0.3683, "headings": [70, 250]},
    "LCY": {"lat": 51.5053, "lon": 0.0553, "headings": [90, 270]},
}


def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates the great-circle distance between two GPS points in kilometers."""
    R = 6371.0

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )

    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates the initial bearing (forward azimuth) from point 1 to point 2 in degrees."""
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - (
        math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    )

    initial_bearing = math.atan2(x, y)

    # Convert from radians to degrees and normalize to 0-360
    initial_bearing = math.degrees(initial_bearing)
    return (initial_bearing + 360) % 360


def get_destination(
    aircraft: AircraftState,
) -> Literal["LHR", "LGW", "STN", "LTN", "LCY"] | None:
    """Determines if an aircraft is on final approach inside an ILS cone."""
    if aircraft.on_ground:
        return None

    # Must be descending or level
    if aircraft.vertical_rate_fpm is None or aircraft.vertical_rate_fpm > 0:
        return None

    if (
        aircraft.baro_altitude_ft is None
        or aircraft.baro_altitude_ft > APPROACH_MAX_ALTITUDE_FT
    ):
        return None

    if aircraft.true_track is None:
        return None

    track = aircraft.true_track

    for airport_code, data in LONDON_AIRPORTS.items():
        lat_airport = data["lat"]
        lon_airport = data["lon"]

        # 1. Fast distance check
        dist = calculate_distance_km(
            aircraft.latitude,
            aircraft.longitude,
            lat_airport,
            lon_airport,
        )
        if dist > APPROACH_RADIUS_KM:
            continue

        headings = data["headings"]

        for h in headings:
            # 2. Heading check: is the plane pointing along the runway?
            if not (
                (h - APPROACH_TRACK_TOLERANCE_DEG)
                <= track
                <= (h + APPROACH_TRACK_TOLERANCE_DEG)
            ):
                continue

            # 3. Position Check (The ILS Cone): Is the plane physically lined up with the runway?
            runway_reciprocal = (h + 180) % 360
            bearing_from_airport = calculate_bearing(
                lat_airport,
                lon_airport,
                aircraft.latitude,
                aircraft.longitude,
            )

            # Calculate the shortest angular distance
            angle_diff = abs(
                (bearing_from_airport - runway_reciprocal + 180) % 360 - 180
            )

            # Inside the cone extending from the runway: on approach
            if angle_diff <= APPROACH_CONE_DEG:
                return airport_code  # type: ignore

    return None


# --- Main Orchestrator ---
async def get_current_airspace_state() -> list[AircraftState]:
    """Executes the ETL pipeline: Fetches, parses, and applies ATC logic."""
    raw_aircraft = await fetch_london_airspace()

    valid_aircraft = []
    for ac_dict in raw_aircraft:
        parsed = parse_aircraft(ac_dict)
        if parsed:
            vr = parsed.vertical_rate_fpm or 0
            parsed.is_climbing = vr > _VERTICAL_RATE_THRESHOLD_FPM
            parsed.is_descending = vr < -_VERTICAL_RATE_THRESHOLD_FPM
            parsed.destination = get_destination(parsed)
            valid_aircraft.append(parsed)

    return valid_aircraft
