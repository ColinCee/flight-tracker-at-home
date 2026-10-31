# Architecture & Data Contract

> Technical reference for both frontend and backend developers.
> For product requirements, see [PRODUCT-FEATURES.md](PRODUCT-FEATURES.md).

## Architecture Overview

```
┌──────────────────┐  on-demand     ┌───────────────┐  REST + auto-poll  ┌──────────────┐
│  adsb.lol        │ ◄── (lazy) ─── │  FastAPI       │ ◄───────────────── │  React SPA   │
│  /v2/point/...   │ ──────────────►│  (self-hosted) │ ────────────────► │  (CF Pages)  │
│  60nm radius     │  JSON aircraft │  in-memory     │   JSON response   │  MapLibre +  │
└──────────────────┘                │  cache (10s)   │                   │  Deck.gl     │
                                    └───────────────┘                   └──────────────┘
```

### Lazy caching

When the frontend requests `/aircraft`, the backend checks its in-memory
cache. If stale (>10s TTL), it fetches fresh data upstream, caches it, and
responds. The heatmap snapshot reads the same cache every 60 s.

- One upstream call a minute when nobody is viewing (the heatmap snapshot)
- First request after idle: ~200-500ms (upstream fetch)

### Frontend polling

React Query's `refetchInterval` auto-polls the backend every 10 seconds,
matching the cache TTL. The backend returns a `refresh_interval_ms` hint so
the frontend can adapt dynamically.

---

## Data Source — adsb.lol

- **Endpoint:** any ADSBx v2 point endpoint, `ADSB_API_URL` (default
  `https://api.adsb.lol/v2/point`), queried as `{url}/{lat}/{lon}/{radius_nm}`
- **Fallback:** `ADSB_FALLBACK_URL` (default adsb.fi) when the primary fails
- **Auth:** none
- **Units:** aviation-native — feet, knots, ft/min (no conversion needed)

The query centres on central London (51.5072, -0.1276) with a 60 nm radius,
covering the London TMA. airplanes.live was the source until it blocked our IP
in Oct 2026; the response shape is the same.

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

The backend defaults to a **10-second cache TTL** (`CACHE_TTL`).

---

## API Endpoints

| Method | Path                    | Response           | Notes                                       |
|--------|-------------------------|--------------------|---------------------------------------------|
| GET    | `/aircraft`             | `AircraftResponse` | Aircraft + KPIs in a single atomic response |
| GET    | `/weather`              | `WeatherResponse`  | MET Norway weather for London airports, cached 30 min |
| GET    | `/heatmap`              | `HeatmapHexagon[]` | H3 hex-binned historical flight volume      |
| GET    | `/health`               | `{ status: "ok" }` | Health check                                |
| GET    | `/debug/airplanes_live` | JSON               | Upstream status and latency (debug only)    |

---

## Data Contract

> **This is the foundation that lets frontend and backend work concurrently.**
> Both sides code against these interfaces. Any changes must be agreed by both devs.

**Casing convention:** Python models use `snake_case`. JSON output is auto-aliased
to `camelCase` via Pydantic's `alias_generator`. Both sides stay idiomatic.

### Python models (backend — source of truth)

See [`apps/backend/src/models.py`](../apps/backend/src/models.py): `AircraftState`,
`KPIs`, `AircraftResponse`, `AirportWeather`, `WeatherResponse`, `HeatmapHexagon`.

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

- **Aviation-native units** — the ADSBx v2 feed provides data in feet, knots, and
  ft/min. No unit conversion needed; the backend passes values through directly.
- **`camelCase` in JSON** — Pydantic `alias_generator=to_camel` handles this.
  Python code stays `snake_case`, TypeScript gets idiomatic `camelCase`.
- **Single endpoint** — KPIs are derived from the aircraft list. Bundling avoids
  redundant computation and gives atomic consistency.
- **No authentication required** — adsb.lol is a free public API with no
  API keys or credentials, simplifying deployment.
- **`category` field** — the feed provides rich aircraft category data,
  enabling category-based icon selection (jet, prop, helicopter, glider) and
  coloring on the frontend.
- **`is_climbing` / `is_descending` booleans** — pre-computed on the backend
  from `vertical_rate_fpm`, simplifying frontend logic and KPI computation.
- **`destination`** — uses spatial ILS cone mathematics to determine approach status for 5 major London airports.
- **`registration` and `aircraft_type`** — the feed provides these natively,
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
| `ADSB_API_URL`      | Backend        | No         | adsb.lol `/v2/point`    | ADSBx v2 point endpoint            |
| `ADSB_FALLBACK_URL` | Backend        | No         | adsb.fi                 | Tried when the primary fails; empty disables |
| `HEATMAP_DB_PATH`   | Backend        | No         | `apps/backend/historical_heatmap.parquet` | Heatmap history file |
| `VITE_API_BASE_URL` | Frontend build | No         | `http://localhost:8000` | Backend URL                        |
| `TUNNEL_TOKEN`      | compose.yaml   | Yes (prod) | —                       | Cloudflare Tunnel token            |
| `COMPOSE_PROFILES`  | .env (server)  | No         | —                       | Set to `prod` for production       |

### CORS

Frontend on Cloudflare Pages and backend self-hosted are different origins.
FastAPI's `CORSMiddleware` allows the origins in `CORS_ORIGINS`.
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
| Backend      | Python 3.14 / FastAPI                    | Auto-generates OpenAPI spec from Pydantic models                         |
| Data source  | adsb.lol (`/v2/point/...`)               | Free, no auth, aviation-native units, rich aircraft metadata             |
| API contract | Pydantic → OpenAPI → Orval               | Typed React Query hooks + TypeScript types from FastAPI spec             |
| Monorepo     | Nx + Bun + mise                          | Polyglot task orchestration (JS + Python)                                |
| Deploy (FE)  | Cloudflare Pages                         | Fastest CDN, unlimited free bandwidth, auto-deploy from GitHub           |
| Deploy (BE)  | GHCR image on the homelab + Cloudflare Tunnel | Always-on, no cold starts; the homelab pins the image digest             |
