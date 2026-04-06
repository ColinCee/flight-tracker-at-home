"""Flight Tracker at Home API"""

import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager

import duckdb
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from src.airplanes_live import (
    close_client,
    get_client,
    get_current_airspace_state,
    init_client,
)
from src.cache import airspace_cache
from src.models import AircraftResponse, HeatmapHexagon, WeatherResponse
from src.spatial_snapshot import DB_PATH, snapshot_to_parquet
from src.weather import weather_cache

logger = logging.getLogger(__name__)


async def run_etl_pipeline():
    """Background task to take spatial snapshots every 60 seconds."""
    while True:
        await asyncio.sleep(60)  # Wait 60 seconds between snapshots

        try:
            # Fetch data directly. Don't rely on the frontend to trigger it.
            aircraft_list = await get_current_airspace_state()

            if aircraft_list:
                # Run the Pandas/DuckDB code in a background thread
                await asyncio.to_thread(snapshot_to_parquet, aircraft_list)
                logger.info("Successfully appended snapshot to Parquet.")
        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            logger.error(f"ETL API fetch failed: {e}")
        except (duckdb.Error, OSError) as e:
            logger.error(f"ETL Storage failed: {e}")
        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("Unexpected error in ETL pipeline")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_client()
    # Start the background ETL engine when the server starts
    etl_task = asyncio.create_task(run_etl_pipeline())
    yield
    etl_task.cancel()  # Cleanly shut down the engine
    await close_client()


app = FastAPI(title="Flight Tracker at Home API", lifespan=lifespan)

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
    try:
        state = await airspace_cache.get_state()
        return state
    except (httpx.RequestError, httpx.HTTPStatusError) as e:
        # Specifically handle upstream API failure when no cache is available
        raise HTTPException(
            status_code=503,
            detail=f"Airplanes.live API is currently unreachable: {e!s}",
        ) from e


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
    except httpx.TimeoutException:
        results["tests"]["api"] = {"error": "Request timed out", "ok": False}
    except httpx.RequestError as e:
        results["tests"]["api"] = {"error": f"Connection error: {e!s}", "ok": False}

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


@app.get("/heatmap", response_model=list[HeatmapHexagon], operation_id="getHeatmap")
def get_heatmap_data() -> list[HeatmapHexagon]:
    """
    Query the Parquet file for the aggregated heatmap.
    Note: This is a sync def endpoint because DuckDB's Python API is synchronous.
    FastAPI will run this in a background threadpool to avoid blocking the event loop.
    """

    # Return a plain array instead of {"data": []}
    if not os.path.exists(DB_PATH):
        return []
    try:
        query = f"""
            SELECT
                hex_id,
                CAST(SUM(total_volume) AS BIGINT) as total_volume,
                SUM(avg_altitude * total_volume) / SUM(total_volume) as avg_altitude
            FROM '{DB_PATH}'
            GROUP BY hex_id
        """

        con = duckdb.connect()
        try:
            res = con.execute(query)
            cols = [desc[0] for desc in res.description]
            results = [dict(zip(cols, row, strict=True)) for row in res.fetchall()]
        finally:
            con.close()

        return [HeatmapHexagon(**row) for row in results]
    except duckdb.Error as e:
        logger.error(f"Heatmap query failed: {e}")
        return []
