"""Flight Tracker at Home API"""

import logging
import os
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.airplanes_live import get_client
from src.cache import airspace_cache
from src.models import AircraftResponse, WeatherResponse
from src.weather import weather_cache

logger = logging.getLogger(__name__)

app = FastAPI(title="Flight Tracker at Home API")

if os.getenv("MOCK_DATA", "").lower() in ("true", "1", "yes"):
    logger.warning("MOCK_DATA is enabled — serving fixture data")

# Setup CORS so the React frontend can talk to this backend
# Comma-separated for multiple origins (e.g., "https://app.pages.dev,https://custom.com")
cors_env = os.getenv("CORS_ORIGINS", "http://localhost:4200")
allowed_origins = [origin.strip() for origin in cors_env.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health", operation_id="getHealth", summary="Health Check")
async def health():
    """Simple health check."""
    return {"status": "ok"}


@app.get(
    "/aircraft",
    response_model=AircraftResponse,
    operation_id="getAircraft",
    summary="Get Aircraft State",
)
async def get_aircraft() -> AircraftResponse:
    """
    Main polling endpoint.
    Fetches the lazy-cached state, abstracting the Airplanes.live API rate limits.
    """
    # This single call handles the 10s TTL, Airplanes.live fetching, and KPI math.
    state = await airspace_cache.get_state()
    return state


@app.get(
    "/debug/airplanes_live",
    operation_id="debugAirplanesLive",
    summary="Airplanes.live Connectivity Test",
)
async def debug_airplanes_live():
    """Diagnose Airplanes.live API connectivity from this server."""
    # We test the exact bounding box for Heathrow
    api_url = "https://api.airplanes.live/v2/point/51.47/-0.4543/30"

    results = {
        "authenticated": False,  # Airplanes.live is public, no auth required
        "tests": {},
    }

    # Test 1: API endpoint
    try:
        start = time.time()

        # Grab our persistent HTTP Keep-Alive client so we don't trigger firewalls
        client = get_client()
        resp = await client.get(api_url, timeout=10.0)

        elapsed = round(time.time() - start, 3)
        results["tests"]["api"] = {
            "status": resp.status_code,
            "elapsed_s": elapsed,
            "ok": resp.status_code in (200, 429),
        }
    except Exception as e:
        results["tests"]["api"] = {"error": repr(e), "ok": False}

    return results


@app.get(
    "/weather",
    response_model=WeatherResponse,
    operation_id="getWeather",
    summary="Get London Airport Weather",
)
async def get_weather() -> WeatherResponse:
    """
    Fetches METAR weather for London airports.
    Cached for 30 minutes to respect upstream rate limits.
    """
    return await weather_cache.get_weather()
