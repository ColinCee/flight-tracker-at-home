"""Property tests for the arrival heuristic in `get_destination`.

Each test builds aircraft from geometry (a bearing and distance from an
airport) rather than fixed coordinates, so Hypothesis searches the whole cone,
its edges and the space around it.
"""

import math
from typing import Any

from hypothesis import given, settings
from hypothesis import strategies as st
from src.airplanes_live import LONDON_AIRPORTS, get_destination
from src.models import AircraftState

EARTH_RADIUS_KM = 6371.0

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
approach_altitude = st.integers(0, 4000)
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
    km=st.floats(0.5, 24.5),
    offset=st.floats(-7.5, 7.5),
    track_error=st.floats(-14.5, 14.5),
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
    km=st.floats(0.5, 24.5),
    offset=st.floats(8.5, 180) | st.floats(-180, -8.5),
    track_error=st.floats(-15, 15),
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
    km=st.floats(0.5, 24.5),
    offset=st.floats(-8, 8),
    # More than 15 deg off the runway heading and off its reciprocal too.
    track_error=st.floats(15.5, 164.5) | st.floats(-164.5, -15.5),
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
    km=st.floats(0.5, 24.5),
    offset=st.floats(-7.5, 7.5),
    track_error=st.floats(-14.5, 14.5),
    # Start from an aircraft that would count, then break exactly one condition.
    state=st.one_of(
        st.tuples(approach_altitude, st.integers(1, 6000), st.just(False)),  # climbing
        st.tuples(
            st.integers(4001, 50_000), level_or_descending, st.just(False)
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
    along_km=st.floats(0.5, 24),
    # A downwind leg sits several km abeam; 4 km is already outside the cone at 24 km.
    abeam_km=st.floats(4, 12),
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
