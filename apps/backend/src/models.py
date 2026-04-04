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

    icao24: str
    callsign: str | None
    origin_country: str
    latitude: float
    longitude: float
    baro_altitude: float | None
    geo_altitude: float | None
    velocity: float | None
    true_track: float | None
    vertical_rate: float | None
    on_ground: bool
    squawk: str | None
    last_contact: int
    is_approaching_lhr: bool


class KPIs(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    inbound_lhr: int
    throughput_last_60min: int
    tracked_aircraft: int
    data_freshness_seconds: float
    api_health: Literal["green", "amber", "red"]


class AircraftResponse(BaseModel):
    """Single response for the main polling endpoint."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    timestamp: int
    cache_age_seconds: float
    aircraft: list[AircraftState]
    kpis: KPIs
