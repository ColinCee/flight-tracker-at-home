"""This module handles the extraction and transformation of OpenSky API data.
It maps raw positional arrays to strict Pydantic contracts and applies
spatial heuristics to determine Heathrow approach status.
"""

import logging
import math
import os
import time

import httpx
from src.models import AircraftState

logger = logging.getLogger(__name__)

# --- Configuration & Constants ---
OPENSKY_URL = "https://opensky-network.org/api/states/all"

# London Bounding Box
LAMIN = 51.20
LOMIN = -0.90
LAMAX = 51.70
LOMAX = 0.25

# Heathrow (EGLL) Reference Coordinates
LHR_LAT = 51.4700
LHR_LON = -0.4543

# OpenSky OAuth2 token endpoint (Keycloak)
TOKEN_URL = (
    "https://auth.opensky-network.org/auth/realms/"
    "opensky-network/protocol/openid-connect/token"
)

# Refresh the token 60s before it actually expires
TOKEN_REFRESH_MARGIN = 60

# --- Data Dictionaries (Initialized once at startup) ---
POSITION_SOURCE_MAP = {0: "ADS-B", 1: "ASTERIX", 2: "MLAT", 3: "FLARM"}

# 13 is reserved (who knows for what?)
CATEGORY_MAP = {
    0: "Unknown",
    1: "Unknown",
    2: "Light",
    3: "Small",
    4: "Large",
    5: "High Vortex Large",
    6: "Heavy",
    7: "High Performance",
    8: "Rotorcraft",
    9: "Glider",
    10: "Lighter-than-air",
    11: "Skydiver",
    12: "Ultralight",
    14: "UAV",
    15: "Space Vehicle",
    16: "Emergency Surface Vehicle",
    17: "Service Surface Vehicle",
    18: "Point Obstacle",
    19: "Line Obstacle",
}


class _TokenManager:
    """Handles OAuth2 client credentials flow with automatic token refresh."""

    def __init__(self):
        self._access_token: str | None = None
        self._expires_at: float = 0.0

    @property
    def is_authenticated(self) -> bool:
        """Whether credentials are configured."""
        return bool(
            os.getenv("OPENSKY_CLIENT_ID") and os.getenv("OPENSKY_CLIENT_SECRET")
        )

    async def get_headers(self) -> dict[str, str]:
        """Return Authorization headers, refreshing the token if needed."""
        client_id = os.getenv("OPENSKY_CLIENT_ID")
        client_secret = os.getenv("OPENSKY_CLIENT_SECRET")

        if not client_id or not client_secret:
            return {}

        if self._access_token and time.time() < self._expires_at:
            return {"Authorization": f"Bearer {self._access_token}"}

        # Request a new token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": client_id,
                    "client_secret": client_secret,
                },
                timeout=10.0,
            )
            response.raise_for_status()
            token_data = response.json()

        self._access_token = token_data["access_token"]
        expires_in = token_data.get("expires_in", 300)
        self._expires_at = time.time() + expires_in - TOKEN_REFRESH_MARGIN
        logger.info("OpenSky OAuth2 token acquired (expires in %ds)", expires_in)

        return {"Authorization": f"Bearer {self._access_token}"}


_token_manager = _TokenManager()

# Last known API credits remaining (from X-Rate-Limit-Remaining header)
_remaining_credits: int | None = None


async def fetch_london_airspace() -> list[list]:
    """Phase 1: Extraction - Fetches raw state vectors from OpenSky."""
    global _remaining_credits
    url = "https://opensky-network.org/api/states/all"

    # Passing the bounding box ensures we only use 1 API credit
    params = {"lamin": LAMIN, "lamax": LAMAX, "lomin": LOMIN, "lomax": LOMAX}

    auth_headers = await _token_manager.get_headers()

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                url, params=params, headers=auth_headers, timeout=10.0
            )
            response.raise_for_status()

            remaining = response.headers.get("X-Rate-Limit-Remaining")
            if remaining is not None:
                _remaining_credits = int(remaining)

            data = response.json()
            # OpenSky returns the arrays under the "states" key
            return data.get("states") or []
        except httpx.HTTPError as e:
            logger.warning("Error fetching from OpenSky: %s", e)
            return []


def get_remaining_credits() -> int | None:
    """Return the last known API credits remaining, or None if unknown."""
    return _remaining_credits


def parse_state_vector(vector: list) -> AircraftState | None:
    """Phase 2: Transformation - Maps array indices to the Pydantic contract."""

    # OpenSky Array Indices:
    # 0: icao24, 1: callsign, 2: origin_country, 3: time_position, 4: last_contact
    # 5: longitude, 6: latitude, 7: baro_altitude, 8: on_ground, 9: velocity
    # 10: true_track, 11: vertical_rate, 12: sensors, 13: geo_altitude, 14: squawk
    # 16: position_source, 17: aircraft_category

    POSITION_SOURCE_MAP = {0: "ADS-B", 1: "ASTERIX", 2: "MLAT", 3: "FLARM"}

    CATEGORY_MAP = {
        0: "Unknown",
        1: "Unknown",
        2: "Light",
        3: "Small",
        4: "Large",
        5: "High Vortex Large",
        6: "Heavy",
        7: "High Performance",
        8: "Rotorcraft",
        9: "Glider",
        10: "Lighter-than-air",
        11: "Skydiver",
        12: "Ultralight",
        14: "UAV",
        15: "Space Vehicle",
        16: "Emergency Surface Vehicle",
        17: "Service Surface Vehicle",
        18: "Point Obstacle",
    }

    try:
        # Strict validation: Drop if positional data is missing
        if vector[5] is None or vector[6] is None:
            return None

        # Clean the callsign (OpenSky pads it with spaces)
        raw_callsign = vector[1]
        clean_callsign = raw_callsign.strip() if raw_callsign else None

        # Map positional_source and category to a map string value
        raw_position = vector[16] if len(vector) > 16 else 0
        raw_category = vector[17] if len(vector) > 17 else 0

        # Some fields are not required, if need to add more check out:
        # https://openskynetwork.github.io/opensky-api/rest.html
        return AircraftState(
            icao24=vector[0],
            callsign=clean_callsign,
            origin_country=vector[2],
            last_contact=vector[4] or int(time.time()),
            longitude=vector[5],
            latitude=vector[6],
            baro_altitude=vector[7],
            on_ground=vector[8],
            velocity=vector[9],
            true_track=vector[10],
            vertical_rate=vector[11],
            geo_altitude=vector[13],
            squawk=vector[14],
            position_source=POSITION_SOURCE_MAP.get(raw_position, "Unknown"),
            category=CATEGORY_MAP.get(raw_category, "Unknown"),
            is_approaching_lhr=False,  # Evaluated downstream
        )
    except (IndexError, TypeError) as e:
        logger.warning("Failed to parse vector: %s", e)
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
    if aircraft.vertical_rate is None or aircraft.vertical_rate >= 0:
        return False

    # 3. Must be below 2000 meters (~6,500 ft)
    if aircraft.baro_altitude is None or aircraft.baro_altitude > 2000:
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
