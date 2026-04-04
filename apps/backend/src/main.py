from fastapi import FastAPI

from src.models import AircraftResponse, KPIs

app = FastAPI(title="Flight Tracker at Home API")


@app.get("/health", operation_id="getHealth", summary="Health")
async def health():
    return {"status": "ok"}


@app.get(
    "/aircraft",
    response_model=AircraftResponse,
    operation_id="getAircraft",
    summary="Get aircraft",
)
async def get_aircraft() -> AircraftResponse:
    return AircraftResponse(
        timestamp=0,
        cache_age_seconds=0,
        aircraft=[],
        kpis=KPIs(
            inbound_lhr=0,
            throughput_last_60min=0,
            tracked_aircraft=0,
            data_freshness_seconds=0,
            api_health="green",
        ),
    )
