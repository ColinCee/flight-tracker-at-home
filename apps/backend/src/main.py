"""Flight Tracker at Home API"""

import os
import time

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.cache import airspace_cache
from src.models import AircraftResponse
from src.opensky import _get_base_url, _token_manager, _using_proxy

app = FastAPI(title="Flight Tracker at Home API")

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
    """Simple health check for Render deployment."""
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
    Fetches the lazy-cached state, abstracting the OpenSky API rate limits.
    """
    # This single call handles the 10s TTL, OpenSky fetching, and KPI math.
    state = await airspace_cache.get_state()
    return state


@app.get(
    "/debug/opensky", operation_id="debugOpensky", summary="OpenSky Connectivity Test"
)
async def debug_opensky():
    """Diagnose OpenSky API connectivity from this server."""
    base = _get_base_url()
    api_url = f"{base}/api/states/all?lamin=51.2&lamax=51.7&lomin=-0.9&lomax=0.25"
    headers = await _token_manager.get_headers()

    results = {
        "authenticated": _token_manager.is_authenticated,
        "using_proxy": _using_proxy(),
        "base_url": base,
        "tests": {},
    }

    # Test 1: API endpoint (via proxy if configured)
    try:
        start = time.time()
        async with httpx.AsyncClient() as client:
            resp = await client.get(api_url, headers=headers, timeout=10.0)
        elapsed = round(time.time() - start, 3)
        results["tests"]["api"] = {
            "status": resp.status_code,
            "elapsed_s": elapsed,
            "ok": resp.status_code in (200, 429),
        }
    except Exception as e:
        results["tests"]["api"] = {"error": repr(e), "ok": False}

    return results
