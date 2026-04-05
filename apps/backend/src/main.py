"""Flight Tracker at Home API"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.cache import airspace_cache
from src.models import AircraftResponse

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
