# Aviation Dashboard — MVP Spec

**Authors:** Colin & Calvin Cheung

## Problem

No simple tool visualises London airspace in real-time. We want a dashboard that
makes abstract ATC data legible — inspired by the National Grid ESO dashboard —
useful as a portfolio piece and learning project.

## Definition of Done

A live 2D map of aircraft over London with callsign / altitude / speed
datablocks, plus a KPI strip showing inbound arrivals and runway throughput for
Heathrow. Deployed and shareable via a public URL.

## User Flow

1. User opens the dashboard
2. Sees a dark-themed radar map of London airspace with aircraft icons moving in
   near-real-time (~10s refresh)
3. Glances at KPI strip — Heathrow arrivals count, estimated throughput, data
   freshness, tracked aircraft count, API health indicator
4. Can zoom / pan the map
5. Clicks an aircraft to see its datablock (callsign, altitude, speed, heading)

## Stack

| Layer        | Technology                              | Rationale                                                    |
| ------------ | --------------------------------------- | ------------------------------------------------------------ |
| Frontend     | React + Vite + Tailwind CSS             | Already scaffolded in Nx monorepo                            |
| Map          | MapLibre GL JS + react-map-gl           | Free, open-source, WebGL-accelerated, no API key             |
| Data overlay | Deck.gl (IconLayer)                     | GPU-rendered aircraft icons with heading rotation, smooth interpolation between polls |
| Map tiles    | OpenFreeMap (dark style)                | Free, no API key, no rate limits                             |
| State mgmt   | TanStack Query (React Query)            | Auto-polling via `refetchInterval`, caching, loading states  |
| Backend      | Python / FastAPI                        | Auto-generates OpenAPI spec from Pydantic models             |
| Data source  | OpenSky Network REST API (`/states/all`)| Free anonymous tier — 400 credits/day, 10s resolution        |
| API contract | Pydantic → OpenAPI → Orval              | Generates typed React Query hooks + Zod schemas from FastAPI spec |
| Monorepo     | Nx + Bun                                | Polyglot task orchestration (JS + Python)                    |
| Tooling      | mise (Bun, Node, Python, uv)            | Single command to bootstrap all runtimes from zero            |
| Deploy (FE)  | Cloudflare Pages                        | Fastest CDN, unlimited free bandwidth, auto-deploy from GitHub |
| Deploy (BE)  | Render                                  | Free tier (750 hrs/mo), auto-deploy from GitHub, zero config |

## Architecture

```
┌─────────────┐  poll every 10s   ┌───────────────┐  REST + auto-poll  ┌──────────────┐
│  OpenSky    │ ◄──── (lazy) ──── │  FastAPI       │ ◄───────────────── │  React SPA   │
│  Network    │ ────────────────► │  (Render)      │ ────────────────► │  (CF Pages)  │
│  /states/all│   state vectors   │  in-memory     │   JSON response   │  MapLibre +  │
└─────────────┘                   │  cache (TTL)   │                   │  Deck.gl     │
                                  └───────────────┘                   └──────────────┘
```

**Lazy caching pattern:** Backend does NOT poll OpenSky continuously. Instead,
when the frontend requests `/api/aircraft`, the backend checks its in-memory
cache. If stale (>10s), it fetches fresh data from OpenSky, caches it, and
responds. This means the backend can scale to zero / sleep on Render's free tier
with no wasted API calls. First request after sleep has ~1-2s cold start.

**Frontend polling:** React Query's `refetchInterval: 10_000` auto-polls the
backend every 10 seconds, matching OpenSky's update cadence.

## API Endpoints (MVP)

| Method | Path            | Response                         | Notes                         |
| ------ | --------------- | -------------------------------- | ----------------------------- |
| GET    | `/api/aircraft` | `AircraftState[]`                | All aircraft in bounding box  |
| GET    | `/api/kpis`     | `{ arrivals, throughput, ... }`  | Computed from aircraft states |
| GET    | `/health`       | `{ status: "ok" }`              | Health check for Render       |

## Data Model

```python
class AircraftState(BaseModel):
    icao24: str                    # ICAO 24-bit transponder address
    callsign: str | None           # Flight callsign (e.g. "BAW123")
    latitude: float
    longitude: float
    baro_altitude: float | None    # Barometric altitude in meters
    velocity: float | None         # Ground speed in m/s
    true_track: float | None       # Heading in degrees (0 = north)
    vertical_rate: float | None    # m/s (negative = descending)
    on_ground: bool
    is_approaching_lhr: bool       # Computed via heuristic
```

## Heathrow Arrival Heuristic

An aircraft is classified as "approaching Heathrow" when ALL of:
- Within **20 km** of LHR (51.4700°N, 0.4543°W)
- Below **1,200 m** barometric altitude (~4,000 ft)
- Negative vertical rate (descending)
- Not on ground

This is ~90% accurate for a portfolio demo. Heathrow's controlled airspace means
very few false positives (no other low-altitude traffic nearby).

## London Bounding Box

```
lamin=51.28  lomin=-0.53  lamax=51.70  lomax=0.23
```

Covers Greater London, roughly Heathrow to City Airport east-west, Croydon to
Enfield north-south. Generous enough to capture approach paths.

## KPI Strip

| KPI                    | Source                                       |
| ---------------------- | -------------------------------------------- |
| Inbound to LHR         | Count of aircraft matching arrival heuristic |
| Estimated throughput   | Arrivals detected in rolling 60-min window   |
| Tracked aircraft       | Total aircraft in bounding box               |
| Data freshness         | Seconds since last successful OpenSky fetch  |
| API health             | Green / amber / red based on recent errors   |

## API Contract (Type Sharing)

**Pipeline:** Pydantic models → FastAPI auto-generates OpenAPI spec → Orval
generates typed React Query hooks + Zod validation schemas + TypeScript types.

**For MVP:** Start with manually written React Query hooks and TypeScript
interfaces. Introduce Orval when the API stabilises (>3 endpoints). The OpenAPI
spec is always available at `/docs` (Swagger UI) and `/openapi.json`.

## Not Building (Yet)

- ~~WebSockets / SSE~~ — REST polling matches OpenSky's 10s cadence perfectly
- Airspace Pressure Index — future feature
- Stack debt / holding pattern detection — complex, future
- Historical persistence / database — in-memory only for MVP
- Weather overlays, weight-based spacing, carbon estimation
- Multi-airport tracking (Gatwick, Stansted, etc.) — LHR only for MVP
- Authentication / user accounts
- E2E tests (Playwright) — add after core features work

## Risks & Mitigations

| Risk                                    | Impact | Mitigation                                       |
| --------------------------------------- | ------ | ------------------------------------------------ |
| OpenSky rate limits (400 credits/day)   | High   | Lazy caching, single backend instance, 10s TTL   |
| OpenSky data gaps during high load      | Medium | Show "stale data" warning, degrade gracefully    |
| Render free tier cold starts (~30-60s)  | Low    | Acceptable for portfolio demo, show loading state |
| Arrival heuristic false positives       | Low    | LHR controlled airspace limits low-altitude traffic |
| OpenSky anonymous tier deprecated       | Low    | Free registered account gives 4000-8000 credits/day |
