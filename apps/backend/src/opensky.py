"""This class handles the extraction of the data from the opensky API,
using Pydantic to check types and putting the data into a dictionary.
It then runs a series of checks to determine
if an aircraft is inbound to Heathrow.
"""

import math
import os
import time

import httpx

from src.models import AircraftState

# London Bounding Box from ARCHITECTURE.md
LAMIN = 51.20
LOMIN = -0.90
LAMAX = 51.70
LOMAX = 0.25

# Heathrow (EGLL) Reference Coordinates
LHR_LAT = 51.4700
LHR_LON = -0.4543


async def fetch_london_airspace() -> list[list]:
    """Phase 1: Extraction - Fetches raw state vectors from OpenSky."""
    url = "https://opensky-network.org/api/states/all"

    # Passing the bounding box ensures we only use 1 API credit
    params = {"lamin": LAMIN, "lamax": LAMAX, "lomin": LOMIN, "lomax": LOMAX}

    # OpenSky credentials (optional but recommended for rate limits)
    # Fetch these from your .env file
    auth = None
    client_id = os.getenv("OPENSKY_CLIENT_ID")
    client_secret = os.getenv("OPENSKY_CLIENT_SECRET")
    if client_id and client_secret:
        auth = httpx.BasicAuth(client_id, client_secret)

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, auth=auth, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            # OpenSky returns the arrays under the "states" key
            return data.get("states") or []
        except httpx.HTTPError as e:
            print(f"Error fetching from OpenSky: {e}")
            return []


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

        # Build the structured Pydantic object
        aircraft = AircraftState(
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
            is_approaching_lhr=False,  # Default to false, handled in Phase 3
        )
        return aircraft
    except (IndexError, TypeError) as e:
        print(f"Failed to parse vector: {e}")
        return None


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

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


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


async def get_current_airspace_state() -> list[AircraftState]:
    raw_vectors = await fetch_london_airspace()

    valid_aircraft = []
    for vector in raw_vectors:
        parsed = parse_state_vector(vector)
        if parsed:
            # Inject the Approach Logic here
            parsed.is_approaching_lhr = check_lhr_approach(parsed)
            valid_aircraft.append(parsed)

    return valid_aircraft
