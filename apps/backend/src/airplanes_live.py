"""This module handles the extraction and transformation of Airplanes.live API data.
It maps ADSBx v2 format JSON to strict Pydantic contracts and applies
spatial heuristics to determine Heathrow approach status.
"""

import logging
import math
import time

import httpx
from src.models import AircraftState, PositionSource

logger = logging.getLogger(__name__)

# --- Configuration & Constants ---
AIRPLANES_LIVE_URL = "https://api.airplanes.live/v2/point"

# Heathrow (EGLL) Reference Coordinates
LHR_LAT = 51.4700
LHR_LON = -0.4543

# Radius in Nautical Miles (30nm covers the London TMA well)
RADIUS_NM = 30

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

_http_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    """Lazily initialize the client inside the active Event Loop."""
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(
            headers={"User-Agent": "FlightTrackerAtHome/1.1 (London TMA Project)"},
            timeout=10.0,
        )
    return _http_client


# --- Phase 1: Extraction ---
async def fetch_london_airspace() -> list[dict]:
    """Phase 1: Extraction - Fetches aircraft within 30nm of Heathrow."""
    url = f"{AIRPLANES_LIVE_URL}/{LHR_LAT}/{LHR_LON}/{RADIUS_NM}"

    try:
        client = get_client()
        response = await client.get(url)
        response.raise_for_status()

        data = response.json()
        return data.get("ac") or []
    except httpx.HTTPError as e:
        logger.warning("Error fetching from Airplanes.live: %s", e)
        raise


def parse_aircraft(ac: dict) -> AircraftState | None:
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
        is_on_ground = alt_baro == "ground"

        if is_on_ground:
            return None

        # Filter below 100ft
        if isinstance(alt_baro, (int, float)) and alt_baro < 100.0:
            return None

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

        return AircraftState(
            icao24=ac.get("hex", "unknown"),
            callsign=clean_callsign,
            registration=ac.get("r"),
            last_contact=last_contact,
            longitude=lon,
            latitude=lat,
            baro_altitude_ft=int(baro_alt) if baro_alt is not None else None,
            geo_altitude_ft=geo_alt,
            ground_speed_kts=ac.get("gs"),
            true_track=ac.get("track"),
            vertical_rate_fpm=vert_rate,
            on_ground=False,  # Ground aircraft filtered above
            squawk=ac.get("squawk"),
            position_source=position_source,
            category=category,
            aircraft_type=ac.get("t"),
            is_climbing=False,  # Evaluated downstream
            is_descending=False,  # Evaluated downstream
            is_approaching_lhr=False,  # Evaluated downstream
        )
    except Exception as e:
        logger.warning("Failed to parse aircraft dictionary: %s", e)
        return None


# --- Phase 3: Spatial Math & Business Logic ---
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


def check_lhr_approach(aircraft: AircraftState) -> bool:
    """Determines if an aircraft is on final approach to Heathrow."""
    if aircraft.on_ground:
        return False

    # Must be descending
    if aircraft.vertical_rate_fpm is None or aircraft.vertical_rate_fpm >= 0:
        return False

    # Must be below ~6,500 ft
    if aircraft.baro_altitude_ft is None or aircraft.baro_altitude_ft > 6500:
        return False

    if aircraft.true_track is None:
        return False

    # Heathrow runways: 09 (East) and 27 (West)
    track = aircraft.true_track
    tolerance = 15

    is_eastbound = (90 - tolerance) <= track <= (90 + tolerance)
    is_westbound = (270 - tolerance) <= track <= (270 + tolerance)

    if not (is_eastbound or is_westbound):
        return False

    dist = calculate_distance_km(
        aircraft.latitude, aircraft.longitude, LHR_LAT, LHR_LON
    )

    return dist <= 20.0


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
            parsed.is_approaching_lhr = check_lhr_approach(parsed)
            valid_aircraft.append(parsed)

    return valid_aircraft
