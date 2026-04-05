"""This module handles the extraction and transformation of Airplanes.live API data.
It maps standard ADSBx v2 format JSON to strict Pydantic contracts and applies
spatial heuristics to determine Heathrow approach status.
"""

import logging
import math
import time

import httpx
from src.models import AircraftState

logger = logging.getLogger(__name__)

# --- Configuration & Constants ---
AIRPLANES_LIVE_URL = "https://api.airplanes.live/v2/point"

# Heathrow (EGLL) Reference Coordinates
LHR_LAT = 51.4700
LHR_LON = -0.4543

# Radius in Nautical Miles (30nm covers the London TMA well)
RADIUS_NM = 30

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
    # Construct the endpoint: /v2/point/{lat}/{lon}/{radius}
    url = f"{AIRPLANES_LIVE_URL}/{LHR_LAT}/{LHR_LON}/{RADIUS_NM}"

    try:
        client = get_client()
        response = await client.get(url)
        response.raise_for_status()

        data = response.json()
        return data.get("ac") or []
    except httpx.HTTPError as e:
        logger.warning("Error fetching from Airplanes.live: %s", e)
        # If we return [], the cache overwrites the screen with empty data!
        raise


def parse_state_vector(ac: dict) -> AircraftState | None:
    """Phase 2: Transformation - Maps ADSBx v2 dictionary to the Pydantic contract."""
    try:
        # Strict validation: Drop if positional data is missing
        lat = ac.get("lat")
        lon = ac.get("lon")
        if lat is None or lon is None:
            return None

        # --- Filter: Drop planes on the ground or below 100ft ---
        alt_baro = ac.get("alt_baro")

        # Airplanes.live explicitly tags planes on the tarmac as "ground"
        if alt_baro == "ground":
            return None

        # If it's a number, ensure it is above 100 feet
        if isinstance(alt_baro, (int, float)) and alt_baro < 100.0:
            return None

        # Clean the callsign
        raw_callsign = ac.get("flight")
        clean_callsign = raw_callsign.strip() if raw_callsign else None

        # Airplanes.live provides the data source natively under "type" (e.g., adsb_icao, mlat)
        data_source = str(ac.get("type", "Unknown")).upper()

        # They also use standard alphanumeric FAA/ICAO categories (e.g., A1, A5)
        category = str(ac.get("category", "Unknown"))

        return AircraftState(
            icao24=ac.get("hex", "Unknown"),
            callsign=clean_callsign,
            registration=ac.get("r"),
            oat=ac.get("oat"),
            origin_country="Unknown",  # Requires a heavy offline database lookup, safe to leave generic
            last_contact=int(time.time()),
            longitude=lon,
            latitude=lat,
            baro_altitude_feet=ac.get("alt_baro"),
            geo_altitude_feet=ac.get("alt_geom"),
            velocity_gs_knots=ac.get("gs"),
            velocity_ias_knots=ac.get("ias"),
            true_track=ac.get("track"),
            vertical_speed_fps=ac.get("baro_rate"),
            on_ground=False,  # Filtered out above
            squawk=ac.get("squawk"),
            position_source=data_source,
            category=category,
            aircraft_type=ac.get("t", "Unknown"),
            is_approaching_lhr=False,  # Evaluated downstream
        )
    except Exception as e:
        logger.warning("Failed to parse aircraft dictionary: %s", e)
        return None


# --- Phase 3: Spatial Math & Business Logic ---
def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates the great-circle distance between two GPS points in kilometers."""
    R = 6371.0  # Earth radius in kilometers

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
    """
    Determines if an aircraft is on final approach to Heathrow.
    Checks are ordered from least to most computationally expensive.
    """
    # 1. Must be in the air
    if aircraft.on_ground:
        return False

    # 2. Must be descending (vertical rate is negative)
    if aircraft.vertical_speed_fps is None or aircraft.vertical_speed_fps >= 0:
        return False

    # 3. Must be below 2000 meters (~6,500 ft)
    if aircraft.baro_altitude_feet is None or aircraft.baro_altitude_feet > 2000:
        return False

    # 4. Heading Check: Heathrow uses runways 09 (East) and 27 (West)
    if aircraft.true_track is None:
        return False

    track = aircraft.true_track
    tolerance = 15  # Allow +/- 15 degrees for crosswind crabbing or localizer intercept

    is_eastbound = (90 - tolerance) <= track <= (90 + tolerance)
    is_westbound = (270 - tolerance) <= track <= (270 + tolerance)

    if not (is_eastbound or is_westbound):
        return False

    # 5. Distance Check: Must be within 20km of LHR
    dist = calculate_distance_km(
        aircraft.latitude, aircraft.longitude, LHR_LAT, LHR_LON
    )

    # Returns True if it passed all filters (dist <= 20), otherwise False
    return dist <= 20.0


# --- Main Orchestrator ---
async def get_current_airspace_state() -> list[AircraftState]:
    """Executes the ETL pipeline: Fetches, parses, and applies ATC logic."""
    raw_vectors = await fetch_london_airspace()

    valid_aircraft = []
    for vector in raw_vectors:
        parsed = parse_state_vector(vector)
        if parsed:
            # Inject the Approach Logic here
            parsed.is_approaching_lhr = check_lhr_approach(parsed)
            valid_aircraft.append(parsed)

    return valid_aircraft
