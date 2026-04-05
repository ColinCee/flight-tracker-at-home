# Architecture & Data Contract

> Technical reference for both frontend and backend developers.
> For product requirements, see [MVP.md](./MVP.md). Both files live in `docs/`.

## Architecture Overview

```
┌─────────────┐  poll every 10s   ┌───────────────┐  REST + auto-poll  ┌──────────────┐
│  OpenSky    │ ◄──── (lazy) ──── │  FastAPI       │ ◄───────────────── │  React SPA   │
│  Network    │ ────────────────► │  (Render)      │ ────────────────► │  (CF Pages)  │
│  /states/all│   state vectors   │  in-memory     │   JSON response   │  MapLibre +  │
└─────────────┘                   │  cache (TTL)   │                   │  Deck.gl     │
                                  └───────────────┘                   └──────────────┘
```

### Lazy caching

Backend does NOT poll OpenSky continuously. When the frontend requests
`/aircraft`, the backend checks its in-memory cache. If stale (>10s), it
fetches fresh data from OpenSky, caches it, and responds.

- Zero credits consumed when nobody is viewing the dashboard
- Backend can scale to zero / sleep on Render's free tier
- First request after sleep: ~1-2s (cold start + OpenSky fetch)

### Frontend polling

React Query's `refetchInterval: 10_000` auto-polls the backend every 10 seconds,
matching OpenSky's update cadence.

### Credit budget

Free registered OpenSky account → 4,000 credits/day (refreshes daily). Our
bounding box is <25 sq° → 1 credit per request. At 10s polling, that supports
~11 hours of active viewing per day.

---

## Data Source — OpenSky Network

- **Endpoint:** `GET https://opensky-network.org/api/states/all`
- **Auth:** OAuth2 client credentials ([register free](https://opensky-network.org/index.php/-account/register))
- **Response:** `{ time: int, states: [...arrays...] }`
- **Each state vector** is a positional array (17-18 fields by index, not named keys)

The backend transforms OpenSky's arrays into typed `AircraftState` objects. This
abstraction means the data source is swappable (adsb.fi, airplanes.live, etc.)
without changing the frontend contract.

### London bounding box

```
lamin=51.20  lomin=-0.90  lamax=51.70  lomax=0.25
```

Covers Greater London — Heathrow to City Airport east-west, Croydon to Enfield
north-south. Area is ~0.32 sq° → 1 credit per request.

- Aircraft below 30.5m (~100ft) no longer get detected by OpenSky and should be removed.


### Heathrow arrival heuristic

An aircraft is classified as "approaching Heathrow" when ALL conditions are met:

- Within **25 km** of LHR (51.4700°N, 0.4543°W)
- Below **2,000 m** barometric altitude (~6,500 ft)
- Negative vertical rate (descending)
- Not on ground

~90% accurate for a portfolio demo. Heathrow's controlled airspace means very
few false positives.

---

## API Endpoints

| Method | Path        | Response           | Notes                                       |
| ------ | ----------- | ------------------ | ------------------------------------------- |
| GET    | `/aircraft` | `AircraftResponse` | Aircraft + KPIs in a single atomic response |
| GET    | `/health`   | `{ status: "ok" }` | Health check for Render                     |

---

## Data Contract

> **This is the foundation that lets frontend and backend work concurrently.**
> Both sides code against these interfaces. Any changes must be agreed by both devs.

**Casing convention:** Python models use `snake_case`. JSON output is auto-aliased
to `camelCase` via Pydantic's `alias_generator`. Both sides stay idiomatic.

### Python models (backend)

```python
from typing import Literal
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class AircraftState(BaseModel):
    """One aircraft's state, transformed from OpenSky's positional array."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    icao24: str                             # ICAO 24-bit transponder address (hex)
    callsign: str | None                    # Flight callsign e.g. "BAW123" (8 chars, trimmed)
    origin_country: str                     # Country inferred from ICAO24
    latitude: float                         # WGS-84 degrees (never null — filtered on backend)
    longitude: float                        # WGS-84 degrees (never null — filtered on backend)
    baro_altitude: float | None             # Barometric altitude in meters
    geo_altitude: float | None              # Geometric altitude in meters (fallback for baro)
    velocity: float | None                  # Ground speed in m/s
    true_track: float | None                # Heading in degrees clockwise from north
    vertical_rate: float | None             # m/s — positive = climbing, negative = descending
    on_ground: bool                         # True if surface position report
    squawk: str | None                      # Transponder code (7700=emergency, 7600=comms, 7500=hijack)
    last_contact: int                       # Unix timestamp of last update from transponder
    is_approaching_lhr: bool                # Computed via heuristic (see above)


class KPIs(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    inbound_lhr: int                        # Aircraft currently matching arrival heuristic
    throughput_last_60min: int               # Arrivals detected in rolling 60-min window (resets on cold start)
    tracked_aircraft: int                   # Total aircraft in bounding box
    data_freshness_seconds: float           # Seconds since last successful OpenSky fetch
    api_health: Literal["green", "amber", "red"]  # Based on recent error rate


class AircraftResponse(BaseModel):
    """Single response for the main polling endpoint."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    timestamp: int                          # Unix epoch when OpenSky data was captured
    cache_age_seconds: float                # How stale the cached data is (0 = fresh fetch)
    aircraft: list[AircraftState]           # All aircraft with known positions in bounding box
    kpis: KPIs                              # Derived from aircraft list
```

### TypeScript interfaces (frontend)

```typescript
/** Mirrors Python AircraftResponse — field names are camelCase in JSON */
export interface AircraftResponse {
  timestamp: number;
  cacheAgeSeconds: number;
  aircraft: AircraftState[];
  kpis: KPIs;
}

export interface AircraftState {
  icao24: string;
  callsign: string | null;
  originCountry: string;
  latitude: number;
  longitude: number;
  baroAltitude: number | null;
  geoAltitude: number | null;
  velocity: number | null;
  trueTrack: number | null;
  verticalRate: number | null;
  onGround: boolean;
  squawk: string | null;
  lastContact: number;
  isApproachingLhr: boolean;
}

export interface KPIs {
  inboundLhr: number;
  throughputLast60Min: number;
  trackedAircraft: number;
  dataFreshnessSeconds: number;
  apiHealth: 'green' | 'amber' | 'red';
}
```

### KPI definitions

| KPI                  | JSON field             | Source                                                 |
| -------------------- | ---------------------- | ------------------------------------------------------ |
| Inbound to LHR       | `inboundLhr`           | Count of aircraft matching arrival heuristic           |
| Estimated throughput | `throughputLast60Min`  | Arrivals detected in rolling 60-min window             |
| Tracked aircraft     | `trackedAircraft`      | Total aircraft in bounding box                         |
| Data freshness       | `dataFreshnessSeconds` | Seconds since last successful OpenSky fetch            |
| API health           | `apiHealth`            | `"green"` / `"amber"` / `"red"` based on recent errors |

---

## Design Decisions

- **Backend filters out aircraft without lat/lon** — `latitude` and `longitude`
  are non-nullable, even though OpenSky can return null.
- **`camelCase` in JSON** — Pydantic `alias_generator=to_camel` handles this.
  Python code stays `snake_case`, TypeScript gets idiomatic `camelCase`.
- **Single endpoint** — KPIs are derived from the aircraft list. Bundling avoids
  redundant computation and gives atomic consistency.
- **Data source abstraction** — Backend implements a protocol/interface for the
  data source, so OpenSky can be swapped for adsb.fi or airplanes.live without
  changing the API contract.
- **`squawk` included** — emergency codes (7700/7600/7500) enable great visual
  highlights on the map.
- **`origin_country` included** — cheap to pass through, useful for datablock
  tooltips.
- **`geo_altitude` included** — fallback when `baro_altitude` is null.
- **`throughputLast60min` resets on cold start** — in-memory rolling window is
  lost when the backend sleeps on Render's free tier. Frontend shows `"-"` until
  data accumulates. Acceptable for a portfolio demo.

## Environment Variables

| Variable                | Where    | Description                                                                                  |
| ----------------------- | -------- | -------------------------------------------------------------------------------------------- |
| `OPENSKY_CLIENT_ID`     | Backend  | OAuth2 client ID from [OpenSky account page](https://opensky-network.org/my-opensky/account) |
| `OPENSKY_CLIENT_SECRET` | Backend  | OAuth2 client secret                                                                         |
| `CORS_ORIGINS`          | Backend  | Allowed origins, e.g. `https://flight-tracker.pages.dev`                                     |
| `VITE_API_BASE_URL`     | Frontend | Backend URL, e.g. `https://flight-tracker-api.onrender.com`                                  |

### CORS

Frontend on Cloudflare Pages and backend on Render are different origins.
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

The repo should treat the backend schema as the source of truth. Regenerate the
frontend client with:

```sh
bun run generate:api
```

The OpenAPI spec is always available at `/docs` (Swagger UI) and `/openapi.json`.

---

## Stack Details

| Layer        | Technology                               | Rationale                                                                |
| ------------ | ---------------------------------------- | ------------------------------------------------------------------------ |
| Frontend     | React + Vite + Tailwind CSS              | Already scaffolded in Nx monorepo                                        |
| Map          | MapLibre GL JS + react-map-gl            | Free, open-source, WebGL-accelerated, no API key                         |
| Data overlay | Deck.gl (IconLayer)                      | GPU-rendered aircraft icons with heading rotation + smooth interpolation |
| Map tiles    | OpenFreeMap (dark style)                 | Free, no API key, no rate limits                                         |
| State mgmt   | TanStack Query (React Query)             | Auto-polling via `refetchInterval`, caching, loading states              |
| Backend      | Python / FastAPI                         | Auto-generates OpenAPI spec from Pydantic models                         |
| Data source  | OpenSky Network REST API (`/states/all`) | Free registered account — 4,000 credits/day, 10s resolution              |
| API contract | Pydantic → OpenAPI → Orval (future)      | Typed React Query hooks + Zod schemas from FastAPI spec                  |
| Monorepo     | Nx + Bun                                 | Polyglot task orchestration (JS + Python)                                |
| Tooling      | mise (Bun, Node, Python, uv)             | Single command to bootstrap all runtimes from zero                       |
| Deploy (FE)  | Cloudflare Pages                         | Fastest CDN, unlimited free bandwidth, auto-deploy from GitHub           |
| Deploy (BE)  | Render                                   | Free tier (750 hrs/mo), auto-deploy from GitHub, zero config             |
