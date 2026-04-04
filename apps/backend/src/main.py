from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.fixtures import build_mock_response
from src.models import AircraftResponse

app = FastAPI(title="Flight Tracker at Home API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


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
    return build_mock_response()
