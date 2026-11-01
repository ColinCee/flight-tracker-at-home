"""Flight Tracker at Home API"""

import asyncio
import functools
import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

import duckdb
import h3
import httpx
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from src.airplanes_live import (
    ADSB_API_URL,
    close_client,
    get_client,
    init_client,
)
from src.cache import airspace_cache
from src.models import (
    AircraftResponse,
    HeatmapHexagon,
    HeatmapHour,
    HourlyHeatmap,
    HourlyHeatmapCell,
    WeatherResponse,
)
from src.spatial_snapshot import DB_PATH, snapshot_to_parquet
from src.weather import weather_cache

logger = logging.getLogger(__name__)


async def run_etl_pipeline():
    """Background task to take spatial snapshots every 60 seconds."""
    while True:
        await asyncio.sleep(60)  # Wait 60 seconds between snapshots

        try:
            # Go through the shared cache so the ETL never adds an extra upstream
            # call when the frontend is polling. Skip stale (failed-fetch) data.
            state = await airspace_cache.get_state()
            aircraft_list = state.aircraft if state.kpis.api_health == "live" else []

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
    # Cloudflare Pages preview deploys (<hash> or <branch>.flight-tracker-at-home
    # .pages.dev); only this project can publish under that name.
    allow_origin_regex=r"https://[a-z0-9-]+\.flight-tracker-at-home\.pages\.dev",
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
        state = await airspace_cache.get_state(allow_stale=True)
        return state
    except (httpx.RequestError, httpx.HTTPStatusError) as e:
        # Specifically handle upstream API failure when no cache is available
        raise HTTPException(
            status_code=503,
            detail=f"ADS-B API is currently unreachable: {e!s}",
        ) from e


# Each call hits upstream directly, bypassing the cache, so anyone could spend
# the server's upstream rate budget. Off unless ENABLE_DEBUG_ENDPOINTS is set.
if os.getenv("ENABLE_DEBUG_ENDPOINTS", "").lower() in ("true", "1", "yes"):

    @app.get(
        "/debug/airplanes_live",
        operation_id="debugAirplanesLive",
        summary="Airplanes.live Connectivity Test",
    )
    async def debug_airplanes_live():
        """Diagnose Airplanes.live API connectivity from this server."""
        # We test the exact bounding box for Heathrow
        api_url = f"{ADSB_API_URL}/51.47/-0.4543/30"

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
async def get_weather(response: Response) -> WeatherResponse:
    """
    Fetches current weather (MET Norway forecast) for London airports.
    Cached for 30 minutes to respect upstream rate limits.
    """
    weather = await weather_cache.get_weather()
    # Never let a browser hold an empty answer.
    if weather.weather:
        response.headers["Cache-Control"] = "public, max-age=300"
    return weather


# (path, mtime_ns, size) of the file behind the cached result. The file changes
# once a minute; requests in between reuse the aggregate instead of rescanning.
_heatmap_cache: tuple[tuple[str, int, int], list[HeatmapHexagon]] | None = None


@app.get("/heatmap", response_model=list[HeatmapHexagon], operation_id="getHeatmap")
def get_heatmap_data(response: Response) -> list[HeatmapHexagon]:
    """
    Query the Parquet file for the aggregated heatmap.
    Note: This is a sync def endpoint because DuckDB's Python API is synchronous.
    FastAPI will run this in a background threadpool to avoid blocking the event loop.
    """

    global _heatmap_cache

    # Return a plain array instead of {"data": []}
    if not os.path.exists(DB_PATH):
        return []
    # A new snapshot lands every 60 s. Set only on a real answer, so a browser
    # never holds an empty one.
    response.headers["Cache-Control"] = "public, max-age=60"
    stat = os.stat(DB_PATH)
    key = (DB_PATH, stat.st_mtime_ns, stat.st_size)
    if _heatmap_cache and _heatmap_cache[0] == key:
        return _heatmap_cache[1]
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

        hexagons = [HeatmapHexagon(**row) for row in results]
        _heatmap_cache = (key, hexagons)
        return hexagons
    except duckdb.Error as e:
        logger.error(f"Heatmap query failed: {e}")
        del response.headers["Cache-Control"]
        return []


# Coarser than the stored resolution 8, so a day of hourly traffic stays small
# enough for a phone.
HOURLY_RESOLUTION = 7
# (path, mtime_ns, size, window start) of the result below.
_hourly_cache: tuple[tuple[str, int, int, datetime], HourlyHeatmap] | None = None


@functools.cache
def _parent_cell(hex_id: str) -> str:
    return str(h3.cell_to_parent(hex_id, HOURLY_RESOLUTION))


@app.get(
    "/heatmap/hourly",
    response_model=HourlyHeatmap,
    operation_id="getHourlyHeatmap",
    summary="Traffic per hour over the last 24 hours",
)
def get_hourly_heatmap(response: Response) -> HourlyHeatmap:
    """
    Aircraft-minutes per H3 cell in each of the last 24 complete hours, and the
    average number of aircraft over the whole area in each hour. An hour with
    no snapshots has `snapshots: 0`; with no history at all, `cells` is empty.
    """
    global _hourly_cache

    # Snapshot times are naive, in the server's local time (what DuckDB's
    # CURRENT_TIMESTAMP gave the writer), so the window is too. Hours go out
    # as UTC and the browser shows them in its own zone.
    first = datetime.now().replace(minute=0, second=0, microsecond=0) - timedelta(
        hours=24
    )
    starts = [first + timedelta(hours=i) for i in range(24)]
    hours = [
        HeatmapHour(start=s.astimezone(UTC), aircraft=0, snapshots=0) for s in starts
    ]
    empty = HourlyHeatmap(resolution=HOURLY_RESOLUTION, hours=hours, cells=[])
    if not os.path.exists(DB_PATH):
        return empty
    stat = os.stat(DB_PATH)
    key = (DB_PATH, stat.st_mtime_ns, stat.st_size, first)
    if _hourly_cache and _hourly_cache[0] == key:
        response.headers["Cache-Control"] = "public, max-age=60"
        return _hourly_cache[1]

    window = f"""
        FROM '{DB_PATH}'
        WHERE snapshot_time >= $first AND snapshot_time < $first + INTERVAL 24 HOUR
    """
    hour = "date_diff('hour', $first, date_trunc('hour', snapshot_time))"
    try:
        con = duckdb.connect()
        try:
            per_cell = con.execute(
                f"SELECT hex_id, {hour}, CAST(SUM(total_volume) AS BIGINT) {window} GROUP BY ALL",
                {"first": first},
            ).fetchall()
            per_hour = con.execute(
                f"SELECT {hour}, SUM(total_volume), COUNT(DISTINCT snapshot_time) {window} GROUP BY ALL",
                {"first": first},
            ).fetchall()
        finally:
            con.close()
    except duckdb.Error as e:
        logger.error(f"Hourly heatmap query failed: {e}")
        return empty

    counts: dict[str, list[int]] = {}
    for hex_id, i, volume in per_cell:
        counts.setdefault(_parent_cell(hex_id), [0] * 24)[i] += volume
    for i, volume, snapshots in per_hour:
        hours[i] = HeatmapHour(
            start=hours[i].start,
            aircraft=round(volume / snapshots, 1),
            snapshots=snapshots,
        )
    result = HourlyHeatmap(
        resolution=HOURLY_RESOLUTION,
        hours=hours,
        cells=[HourlyHeatmapCell(hex_id=h, counts=c) for h, c in counts.items()],
    )
    _hourly_cache = (key, result)
    response.headers["Cache-Control"] = "public, max-age=60"
    return result
