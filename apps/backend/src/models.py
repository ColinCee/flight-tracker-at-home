"""Data contract models — the source of truth for the API schema.

JSON output uses camelCase via alias_generator. Python code stays snake_case.
TypeScript interfaces in apps/frontend/src/types/aircraft.ts mirror these exactly.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class AircraftState(BaseModel):
    """One aircraft's state, transformed from OpenSky's positional array."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    # All measurements are in aviation standard. Imperial for distance and knots for speed.
    icao24: str
    callsign: str | None
    registration: str | None
    oat: float | None  #  Outside air temperature
    origin_country: str
    latitude: float
    longitude: float
    baro_altitude_feet: float | None
    geo_altitude_feet: float | None
    velocity_gs_knots: float | None  # Ground speed
    velocity_ias_knots: float | None  # Indicated Airspeed
    true_track: float | None
    vertical_speed_fps: float | None  # Rate of climb
    on_ground: bool
    squawk: str | None
    last_contact: int
    position_source: str
    category: str
    aircraft_type: str
    is_approaching_lhr: bool


class KPIs(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    tracked_aircraft: int
    airborne_aircraft: int
    inbound_lhr_aircraft: int
    climbing_aircraft: int
    descending_aircraft: int
    throughput_last_60min: int
    avg_altitude_ft: int | None
    api_health: Literal["live", "stale", "offline"]
    api_credits_remaining: int | None


class AircraftResponse(BaseModel):
    """Single response for the main polling endpoint."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    timestamp: int
    cache_age_seconds: float
    refresh_interval_ms: int
    aircraft: list[AircraftState]
    kpis: KPIs
