# Architecture & Data Contract

> Technical reference for both frontend and backend developers.
> For product requirements, see [MVP.md](PRODUCT-FEATURES.md). Both files live in `docs/`.

## Architecture Overview

```
┌──────────────────┐  on-demand     ┌───────────────┐  REST + auto-poll  ┌──────────────┐
│  airplanes.live  │ ◄── (lazy) ─── │  FastAPI       │ ◄───────────────── │  React SPA   │
│  /v2/point/...   │ ──────────────►│  (self-hosted) │ ────────────────► │  (CF Pages)  │
│  30nm radius     │  JSON aircraft │  in-memory     │   JSON response   │  MapLibre +  │
└──────────────────┘                │  cache (10s)   │                   │  Deck.gl     │
                                    └───────────────┘                   └──────────────┘
```

### Lazy caching

Backend does NOT poll airplanes.live continuously. When the frontend requests
`/aircraft`, the backend checks its in-memory cache. If stale (>10s TTL), it
fetches fresh data from airplanes.live, caches it, and responds.

- Zero API calls when nobody is viewing the dashboard
- First request after idle: ~200-500ms (airplanes.live fetch)

### Frontend polling

React Query's `refetchInterval` auto-polls the backend every 10 seconds,
matching the cache TTL. The backend returns a `refresh_interval_ms` hint so
the frontend can adapt dynamically.

---

## Data Source — airplanes.live

- **Endpoint:** `GET https://api.airplanes.live/v2/point/{lat}/{lon}/{radius_nm}`
- **Auth:** None required — free public API, no keys or credentials
- **Rate limit:** ~1 request per 10 seconds sustained (see [note below](#rate-limiting))
- **Response:** `{ ac: [...], msg: "...", now: int, ... }`
- **Each aircraft** is a JSON object with named fields (not positional arrays)
- **Units:** Aviation-native — feet, knots, ft/min (no conversion needed)
- **Docs:** [airplanes.live API guide](https://airplanes.live/api-guide/)

### London point query

```
lat=51.45  lon=-0.30  radius=30nm
```

Centre point covers Greater London — Heathrow to City Airport. The 30nm radius
captures all aircraft in the London TMA. airplanes.live returns only aircraft
with known positions.

### London Arrival Heuristic (The ILS Cone)

An aircraft is classified as "approaching a London airport" when ALL conditions
are met. To prevent false positives from aircraft flying parallel downwind legs,
we use strict geometric funneling:

- Distance: Within 25 km of the target airport (LHR, LGW, STN, LTN, LCY)
- Altitude: Below 4,000 ft barometric altitude
- Descent: Descending or level (vertical rate <= 0)
- Heading: True track within ±15° of the specific runway heading
- The ILS Cone: The calculated bearing from the airport to the aircraft must
  fall within an 8° angular cone extending outward from the runway centerline 
  (the reciprocal heading)

~90% accurate for a portfolio demo. Heathrow's controlled airspace means very
few false positives.

### Rate limiting

The [API guide](https://airplanes.live/api-guide/) states "1 request per second",
but empirical testing (April 2026) shows a much stricter Cloudflare-fronted limit:

| Interval | Result                                       |
|----------|----------------------------------------------|
| 3s       | Constant 429 flapping (~50% failure)         |
| 5s       | ~40% failure rate even in isolation          |
| 7s       | Still intermittent 429s                      |
| 10s      | Stable — 8/8 consecutive 200s after cooldown |
| 15s      | Rock solid                                   |

Other observations:
- **429 response:** `"You have been rate limited. Please contact us..."` — no `Retry-After` header
- **Per-IP:** Multiple clients on the same IP share the budget
- **Cooldown:** After a burst of 429s, ~30 seconds of silence is needed before stable responses resume
- **Token bucket:** Behaviour suggests a sliding window or token bucket, not a simple fixed-rate limiter

The backend defaults to a **10-second cache TTL** as the minimum stable polling interval.

---

## API Endpoints

| Method | Path                    | Response           | Notes                                       |
|--------|-------------------------|--------------------|---------------------------------------------|
| GET    | `/aircraft`             | `AircraftResponse` | Aircraft + KPIs in a single atomic response |
| GET    | `/weather`              | `WeatherResponse`  | Cached METAR data for London airports       |
| GET    | `/heatmap`              | `HeatmapCell[]`    | H3 hex-binned historical flight volume      |
| GET    | `/health`               | `{ status: "ok" }` | Health check                                |
| GET    | `/debug/airplanes_live` | Raw JSON           | Raw upstream response (debug only)          |

---

## Data Contract

> **This is the foundation that lets frontend and backend work concurrently.**
> Both sides code against these interfaces. Any changes must be agreed by both devs.

**Casing convention:** Python models use `snake_case`. JSON output is auto-aliased
to `camelCase` via Pydantic's `alias_generator`. Both sides stay idiomatic.

### Python models (backend — source of truth)

```python
from typing import Literal
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

PositionSource = Literal["ADS-B", "MLAT", "TIS-B", "ADS-C", "Mode S", "Unknown"]


class AircraftState(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    icao24: str                             # ICAO 24-bit transponder address (hex)
    callsign: str | None                    # Flight callsign e.g. "BAW123" (trimmed)
    registration: str | None                # Aircraft registration e.g. "G-EUPH"
    aircraft_type: str | None               # ICAO type designator e.g. "A320"
    category: str                           # Human-readable: "Heavy", "Large", "Light", "Rotorcraft", etc.
    latitude: float                         # WGS-84 degrees
    longitude: float                        # WGS-84 degrees
    baro_altitude_ft: int | None            # Barometric altitude in feet (integer)
    geo_altitude_ft: int | None             # Geometric altitude in feet (integer)
    ground_speed_kts: float | None          # Ground speed in knots
    true_track: float | None                # Heading in degrees clockwise from north
    vertical_rate_fpm: int | None           # Feet per minute (integer) — positive = climbing
    on_ground: bool                         # True if surface position report
    squawk: str | None                      # Transponder code (7700=emergency, 7600=comms, 7500=hijack)
    last_contact: int                       # Unix timestamp of last update from transponder
    position_source: PositionSource         # ADS-B, MLAT, TIS-B, etc.
    is_climbing: bool                       # Derived from vertical_rate_fpm > 0
    is_descending: bool                     # Derived from vertical_rate_fpm < 0
    destination: Literal["LHR", "LGW", "STN", "LTN", "LCY"] | None # Computed via ILS cone heuristic


class KPIs(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    tracked_aircraft: int                   # Total aircraft in query radius
    airborne_aircraft: int                  # Aircraft not on ground
    inbound_london_aircraft: int            # Aircraft matching arrival heuristic for any airport
    climbing_aircraft: int                  # Aircraft with positive vertical rate
    descending_aircraft: int                # Aircraft with negative vertical rate
    throughput_last_60min: int              # Arrivals detected in rolling 60-min window
    avg_altitude_ft: int | None             # Mean barometric altitude of airborne aircraft
    api_health: Literal["live", "stale", "offline"]


class AircraftResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    timestamp: int                          # Unix epoch when data was captured
    cache_age_seconds: float                # How stale the cached data is (0 = fresh fetch)
    refresh_interval_ms: int                # Hint for frontend polling interval
    aircraft: list[AircraftState]           # All aircraft with known positions
    kpis: KPIs                              # Derived from aircraft list


class AirportWeather(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    icao: str                               # ICAO airport code (e.g. EGLL)
    name: str                               # Human readable name
    condition: str                          # MET Norway weather symbol code
    temperature_c: float | None             # Temperature in Celsius
    wind_speed_kts: float | None            # Wind speed in knots
    wind_direction_deg: float | None        # Wind direction in degrees


class WeatherResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    timestamp: int                          # Unix epoch when data was fetched
    cache_age_seconds: float                # How stale the cached data is
    weather: list[AirportWeather]           # Weather for London airports
```

### TypeScript interfaces (frontend)

TypeScript types are **auto-generated** from the backend's OpenAPI spec via Orval.
See `apps/frontend/src/api/generated.ts` — do not edit by hand.

Run `mise run codegen` to regenerate after backend model changes.

### KPI definitions

| KPI                  | JSON field              | Source                                                       |
|----------------------|-------------------------|--------------------------------------------------------------|
| Tracked aircraft     | `trackedAircraft`       | Total aircraft in query radius                               |
| Airborne aircraft    | `airborneAircraft`      | Aircraft not on ground                                       |
| Inbound to London    | `inboundLondonAircraft` | Count of aircraft matching arrival heuristic for any airport |
| Climbing             | `climbingAircraft`      | Aircraft with positive vertical rate                         |
| Descending           | `descendingAircraft`    | Aircraft with negative vertical rate                         |
| Estimated throughput | `throughputLast60Min`   | Arrivals detected in rolling 60-min window                   |
| Average altitude     | `avgAltitudeFt`         | Mean barometric altitude of airborne aircraft (feet)         |
| API health           | `apiHealth`             | `"live"` / `"stale"` / `"offline"`                           |

---

## Design Decisions

- **Aviation-native units** — airplanes.live provides data in feet, knots, and
  ft/min. No unit conversion needed; the backend passes values through directly.
- **`camelCase` in JSON** — Pydantic `alias_generator=to_camel` handles this.
  Python code stays `snake_case`, TypeScript gets idiomatic `camelCase`.
- **Single endpoint** — KPIs are derived from the aircraft list. Bundling avoids
  redundant computation and gives atomic consistency.
- **No authentication required** — airplanes.live is a free public API with no
  API keys or credentials, simplifying deployment.
- **`category` field** — airplanes.live provides rich aircraft category data,
  enabling category-based icon selection (jet, prop, helicopter, glider) and
  coloring on the frontend.
- **`is_climbing` / `is_descending` booleans** — pre-computed on the backend
  from `vertical_rate_fpm`, simplifying frontend logic and KPI computation.
- **`destination`** — uses spatial ILS cone mathematics to determine approach status for 5 major London airports.
- **`registration` and `aircraft_type`** — airplanes.live provides these natively,
  enabling richer aircraft datablocks and tooltips.
- **`squawk` included** — emergency codes (7700/7600/7500) enable visual
  highlights on the map (red pulsing ring for emergencies).
- **`position_source`** — distinguishes ADS-B, MLAT, TIS-B positions for
  accuracy indication.
- **`throughputLast60min` resets on cold start** — in-memory rolling window is
  lost on restart. Frontend shows `"-"` until data accumulates.

## Environment Variables

| Variable            | Where          | Required   | Default                 | Description                        |
|---------------------|----------------|------------|-------------------------|------------------------------------|
| `CACHE_TTL`         | Backend        | No         | `10`                    | Cache TTL in seconds               |
| `CORS_ORIGINS`      | Backend        | No         | `http://localhost:4200` | Comma-separated allowed origins    |
| `MOCK_DATA`         | Backend        | No         | —                       | Set to `true` for E2E fixture mode |
| `VITE_API_BASE_URL` | Frontend build | No         | `http://localhost:8000` | Backend URL                        |
| `TUNNEL_TOKEN`      | compose.yaml   | Yes (prod) | —                       | Cloudflare Tunnel token            |
| `COMPOSE_PROFILES`  | .env (server)  | No         | —                       | Set to `prod` for production       |

### CORS

Frontend on Cloudflare Pages and backend self-hosted are different origins.
FastAPI's `CORSMiddleware` must allow the frontend origin:

```python
app.add_middleware(
  CORSMiddleware,
  allow_origins=[os.getenv("CORS_ORIGINS", "http://localhost:4200")],
  allow_methods=["GET"],
  allow_headers=["*"],
)
```

`localhost:4200` as default ensures local dev works without env vars.

## API Contract Pipeline

**Pipeline:** Pydantic models → FastAPI auto-generates OpenAPI spec → Orval
generates typed React Query hooks + TypeScript types for the frontend.

The backend schema is the source of truth. Regenerate the frontend client with:

```sh
mise run codegen
```

The OpenAPI spec is always available at `/docs` (Swagger UI) and `/openapi.json`.

---

## Stack Details

| Layer        | Technology                               | Rationale                                                                |
|--------------|------------------------------------------|--------------------------------------------------------------------------|
| Frontend     | React 19 + Vite 8 + Tailwind CSS         | Fast builds, modern React                                                |
| Map          | MapLibre GL JS + react-map-gl            | Free, open-source, WebGL-accelerated, no API key                         |
| Data overlay | Deck.gl (IconLayer)                      | GPU-rendered aircraft icons with heading rotation + smooth interpolation |
| Map tiles    | OpenFreeMap (dark style)                 | Free, no API key, no rate limits                                         |
| State mgmt   | TanStack Query (React Query)             | Auto-polling via `refetchInterval`, caching, loading states              |
| Backend      | Python 3.12 / FastAPI                    | Auto-generates OpenAPI spec from Pydantic models                         |
| Data source  | airplanes.live (`/v2/point/...`)         | Free, no auth, aviation-native units, rich aircraft metadata             |
| API contract | Pydantic → OpenAPI → Orval               | Typed React Query hooks + TypeScript types from FastAPI spec             |
| Monorepo     | Nx + Bun + mise                          | Polyglot task orchestration (JS + Python)                                |
| Deploy (FE)  | Cloudflare Pages                         | Fastest CDN, unlimited free bandwidth, auto-deploy from GitHub           |
| Deploy (BE)  | Dokploy (Beelink) + Cloudflare Tunnel  | Always-on, no cold starts, auto-deploy from CI via Tailscale             |
