"""Property tests for the arrival heuristic in `get_destination`.

Each test builds aircraft from geometry (a bearing and distance from an
airport) rather than fixed coordinates, so Hypothesis searches the whole cone,
its edges and the space around it.
"""

import math
from typing import Any

from hypothesis import given, settings
from hypothesis import strategies as st
from src.airplanes_live import (
    APPROACH_CONE_DEG,
    APPROACH_MAX_ALTITUDE_FT,
    APPROACH_RADIUS_KM,
    APPROACH_TRACK_TOLERANCE_DEG,
    LONDON_AIRPORTS,
    get_destination,
)
from src.models import AircraftState

EARTH_RADIUS_KM = 6371.0
# The heuristic's thresholds, imported so the tests follow the code.
RADIUS = APPROACH_RADIUS_KM
MAX_FT = APPROACH_MAX_ALTITUDE_FT
TRACK_TOL = APPROACH_TRACK_TOLERANCE_DEG
CONE = APPROACH_CONE_DEG
# Generated values stay this far from each threshold, clear of float rounding
# and of the spherical-geometry approximations in the helpers below.
MARGIN = 0.5

# Deterministic and quick: same examples every run, no example database on disk.
deterministic = settings(derandomize=True, database=None, max_examples=200)


def destination_point(
    lat: float, lon: float, bearing: float, km: float
) -> tuple[float, float]:
    """The point `km` along a great circle from (lat, lon) on initial `bearing`."""
    lat1, lon1, brg = map(math.radians, (lat, lon, bearing))
    d = km / EARTH_RADIUS_KM
    lat2 = math.asin(
        math.sin(lat1) * math.cos(d) + math.cos(lat1) * math.sin(d) * math.cos(brg)
    )
    lon2 = lon1 + math.atan2(
        math.sin(brg) * math.sin(d) * math.cos(lat1),
        math.cos(d) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), math.degrees(lon2)


# Fields the heuristic must ignore.
irrelevant = st.fixed_dictionaries(
    {
        "icao24": st.text("0123456789abcdef", min_size=6, max_size=6),
        "callsign": st.none() | st.text(min_size=1, max_size=8),
        "registration": st.none() | st.text(max_size=8),
        "aircraft_type": st.none() | st.text(max_size=4),
        "category": st.sampled_from(["Heavy", "Large", "Light", "Unknown"]),
        "geo_altitude_ft": st.none() | st.integers(-500, 50_000),
        "ground_speed_kts": st.none() | st.floats(0, 600),
        "squawk": st.none() | st.sampled_from(["7000", "7700", "2000"]),
        "last_contact": st.integers(0, 2_000_000_000),
        "position_source": st.sampled_from(["ADS-B", "MLAT", "TIS-B"]),
        "is_climbing": st.booleans(),
        "is_descending": st.booleans(),
        "destination": st.none() | st.sampled_from(list(LONDON_AIRPORTS)),
    }
)

runways = st.sampled_from(
    [(code, h) for code, data in LONDON_AIRPORTS.items() for h in data["headings"]]
)
approach_altitude = st.integers(0, MAX_FT)
level_or_descending = st.integers(-3000, 0)


def aircraft(
    lat: float,
    lon: float,
    track: float,
    altitude: int | None,
    vertical_rate: int | None,
    extra: dict[str, Any],
    on_ground: bool = False,
) -> AircraftState:
    return AircraftState(
        latitude=lat,
        longitude=lon,
        true_track=track % 360,
        baro_altitude_ft=altitude,
        vertical_rate_fpm=vertical_rate,
        on_ground=on_ground,
        **extra,
    )


def on_centreline(
    code: str, heading: int, km: float, offset_deg: float
) -> tuple[float, float]:
    """A point `km` out from the airport, `offset_deg` off the approach side of the runway."""
    airport = LONDON_AIRPORTS[code]
    return destination_point(
        airport["lat"], airport["lon"], heading + 180 + offset_deg, km
    )


@deterministic
@given(
    runway=runways,
    km=st.floats(MARGIN, RADIUS - MARGIN),
    offset=st.floats(-(CONE - MARGIN), CONE - MARGIN),
    track_error=st.floats(-(TRACK_TOL - MARGIN), TRACK_TOL - MARGIN),
    altitude=approach_altitude,
    vertical_rate=level_or_descending,
    extra=irrelevant,
)
def test_inside_the_cone_counts_whatever_the_irrelevant_fields(
    runway, km, offset, track_error, altitude, vertical_rate, extra
):
    code, heading = runway
    lat, lon = on_centreline(code, heading, km, offset)
    ac = aircraft(lat, lon, heading + track_error, altitude, vertical_rate, extra)
    assert get_destination(ac) == code


@deterministic
@given(
    runway=runways,
    km=st.floats(MARGIN, RADIUS - MARGIN),
    offset=st.floats(CONE + MARGIN, 180) | st.floats(-180, -(CONE + MARGIN)),
    track_error=st.floats(-TRACK_TOL, TRACK_TOL),
    altitude=approach_altitude,
    vertical_rate=level_or_descending,
    extra=irrelevant,
)
def test_outside_the_cone_never_counts(
    runway, km, offset, track_error, altitude, vertical_rate, extra
):
    code, heading = runway
    lat, lon = on_centreline(code, heading, km, offset)
    ac = aircraft(lat, lon, heading + track_error, altitude, vertical_rate, extra)
    assert get_destination(ac) != code


@deterministic
@given(
    runway=runways,
    km=st.floats(MARGIN, RADIUS - MARGIN),
    offset=st.floats(-CONE, CONE),
    # More than 15 deg off the runway heading and off its reciprocal too.
    track_error=st.floats(TRACK_TOL + MARGIN, 180 - TRACK_TOL - MARGIN)
    | st.floats(-(180 - TRACK_TOL - MARGIN), -(TRACK_TOL + MARGIN)),
    altitude=approach_altitude,
    vertical_rate=level_or_descending,
    extra=irrelevant,
)
def test_track_more_than_15_degrees_off_never_counts(
    runway, km, offset, track_error, altitude, vertical_rate, extra
):
    code, heading = runway
    lat, lon = on_centreline(code, heading, km, offset)
    ac = aircraft(lat, lon, heading + track_error, altitude, vertical_rate, extra)
    assert get_destination(ac) != code


@deterministic
@given(
    runway=runways,
    km=st.floats(MARGIN, RADIUS - MARGIN),
    offset=st.floats(-(CONE - MARGIN), CONE - MARGIN),
    track_error=st.floats(-(TRACK_TOL - MARGIN), TRACK_TOL - MARGIN),
    # Start from an aircraft that would count, then break exactly one condition.
    state=st.one_of(
        st.tuples(approach_altitude, st.integers(1, 6000), st.just(False)),  # climbing
        st.tuples(
            st.integers(MAX_FT + 1, 50_000), level_or_descending, st.just(False)
        ),  # too high
        st.tuples(
            approach_altitude, level_or_descending, st.just(True)
        ),  # on the ground
        st.tuples(st.none(), level_or_descending, st.just(False)),  # altitude unknown
        st.tuples(
            approach_altitude, st.none(), st.just(False)
        ),  # vertical rate unknown
    ),
    extra=irrelevant,
)
def test_climbing_high_grounded_or_unknown_never_counts(
    runway, km, offset, track_error, state, extra
):
    code, heading = runway
    lat, lon = on_centreline(code, heading, km, offset)
    altitude, vertical_rate, on_ground = state
    ac = aircraft(
        lat, lon, heading + track_error, altitude, vertical_rate, extra, on_ground
    )
    assert get_destination(ac) is None


@deterministic
@given(
    runway=runways,
    along_km=st.floats(MARGIN, RADIUS - MARGIN),
    # A downwind leg sits several km abeam. This far abeam is outside the cone
    # even at the edge of the radius.
    abeam_km=st.floats(RADIUS * math.tan(math.radians(CONE)) + MARGIN, 12),
    side=st.sampled_from([-90, 90]),
    # Flying the runway heading or the reciprocal (a downwind leg).
    reverse=st.booleans(),
    track_error=st.floats(-5, 5),
    altitude=approach_altitude,
    vertical_rate=level_or_descending,
    extra=irrelevant,
)
def test_parallel_leg_offset_from_the_centreline_never_counts(
    runway,
    along_km,
    abeam_km,
    side,
    reverse,
    track_error,
    altitude,
    vertical_rate,
    extra,
):
    code, heading = runway
    lat0, lon0 = on_centreline(code, heading, along_km, 0)
    lat, lon = destination_point(lat0, lon0, heading + 180 + side, abeam_km)
    track = heading + (180 if reverse else 0) + track_error
    ac = aircraft(lat, lon, track, altitude, vertical_rate, extra)
    assert get_destination(ac) != code


@deterministic
@given(
    runway=runways,
    km=st.floats(RADIUS + MARGIN, 60),
    offset=st.floats(-(CONE - MARGIN), CONE - MARGIN),
    track_error=st.floats(-(TRACK_TOL - MARGIN), TRACK_TOL - MARGIN),
    altitude=approach_altitude,
    vertical_rate=level_or_descending,
    extra=irrelevant,
)
def test_beyond_the_radius_never_counts(
    runway, km, offset, track_error, altitude, vertical_rate, extra
):
    code, heading = runway
    lat, lon = on_centreline(code, heading, km, offset)
    ac = aircraft(lat, lon, heading + track_error, altitude, vertical_rate, extra)
    assert get_destination(ac) != code
