# Flight Tracker at Home

Real-time map of aircraft over London with arrival tracking for the five London airports, plus a 3D heatmap of past traffic.
Built by Colin & Calvin Cheung as a portfolio and learning project. What it does for users, how to run it and where it is deployed: `README.md`.

## Layout

```
apps/
├── frontend/          React 19 + Vite + Tailwind + TanStack Query, deployed to Cloudflare Pages
│   ├── src/api/       Orval-generated client (generated.ts) + hooks that poll it
│   ├── src/features/  map/, kpi/, navigation/, with tests next to the code
│   ├── src/shared/    Cross-feature UI and filters
│   └── openapi.json   Backend schema, exported by `mise run codegen`
├── backend/           Python FastAPI; image pushed to GHCR, run by the homelab repo
│   ├── src/main.py            Endpoints + 60 s heatmap snapshot task
│   ├── src/models.py          Pydantic models: the API contract
│   ├── src/airplanes_live.py  Upstream client: fetch, parse, enrich
│   ├── src/cache.py           10 s cache, KPIs, stale fallback
│   ├── src/weather.py         MET Norway weather, 30 min cache
│   ├── src/spatial_snapshot.py H3 binning + DuckDB parquet history
│   └── src/mock_data.py       Fixtures served when MOCK_DATA=true (E2E)
└── e2e/
    ├── tests/         Playwright specs against the dev servers
    ├── smoke/         Production-build smoke test (vite build + preview)
    └── profiling/     Memory soak and mobile performance scripts
```

## Commands

Everything runs through [mise](https://mise.jdx.dev/) from the repo root; `mise tasks` lists them all with descriptions.

```bash
mise run setup        # bun install, uv sync, git hooks
mise run dev          # frontend :4200 + backend :8000 (dev:frontend / dev:backend run one)
mise run format       # ruff + biome, auto-fix
mise run check        # ruff, biome, ty, tsc (what CI runs)
mise run test         # pytest + vitest
mise run test:e2e     # Playwright against dev servers with mock data
mise run test:e2e:prod  # Playwright against a production build
mise run codegen      # backend models -> openapi.json -> frontend types
```

CI (`.github/workflows/`) runs check, codegen:check, test, both E2E suites, a Trivy scan of the backend image, and the Pages deploy (a preview on every PR). It fails on unformatted code, so run `mise run format` before pushing.

## How data flows

```
adsb.lol (ADSBx v2, 60 nm around central London)
  -> airplanes_live.py: parse, enrich (destination, climbing, descending)
  -> cache.py: 10 s TTL, fetched only when a request finds it stale; KPIs; serves stale data on upstream failure
  -> GET /aircraft (aircraft + KPIs in one response, plus refresh_interval_ms)
  -> useAircraftData polls at that interval -> AircraftLayer (deck.gl)

every 60 s: cache -> H3 cells (resolution 8) -> historical_heatmap.parquet -> GET /heatmap -> HeatmapLayer
```

Endpoints: `/aircraft`, `/weather`, `/heatmap`, `/health`, and `/debug/airplanes_live` only when `ENABLE_DEBUG_ENDPOINTS=true` (it calls upstream on every request). Swagger UI is at `/docs`.

**Arrival heuristic.** An aircraft counts as inbound to an airport (LHR, LGW, STN, LTN, LCY) when it is within 25 km, below 4,000 ft, level or descending, its track is within 15° of a runway heading, and its bearing from the airport lies inside an 8° cone along the extended centreline. The cone stops aircraft on a parallel downwind leg from counting.

**Units** stay aviation-native as the feed gives them: feet, knots, ft/min.

**Upstream.** adsb.lol needs no key. If it fails, the backend tries `ADSB_FALLBACK_URL` (adsb.fi) and meanwhile serves its last good data. airplanes.live was the source until it blocked our IP in Oct 2026; the module name is from then.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `CACHE_TTL` | `10` | Aircraft cache TTL, seconds |
| `CORS_ORIGINS` | `http://localhost:4200` | Comma-separated origins; Pages preview URLs are always allowed |
| `MOCK_DATA` | off | `true` serves fixtures (E2E) |
| `ENABLE_DEBUG_ENDPOINTS` | off | `true` adds `/debug/airplanes_live` |
| `ADSB_API_URL` | adsb.lol `/v2/point` | Any ADSBx v2 point endpoint |
| `ADSB_FALLBACK_URL` | adsb.fi | Tried when the primary fails; empty disables |
| `HEATMAP_DB_PATH` | `apps/backend/historical_heatmap.parquet` | Heatmap history file |
| `VITE_API_BASE_URL` (frontend build) | `http://localhost:8000` | Backend URL; CI sets it from a repo variable |

## Conventions

- **Pydantic is the schema source of truth.** Change `apps/backend/src/models.py`, then `mise run codegen`. Never edit `generated.ts` by hand; it and `openapi.json` are committed so the frontend builds without the backend.
- **camelCase JSON, snake_case Python.** `alias_generator=to_camel` on the models does the conversion.
- **One `/aircraft` response** carries aircraft and KPIs together, so they always agree.
- **Packages:** `bun add` from the repo root for JS, `uv add` in `apps/backend/` for Python. No npm, yarn or pip.
- **Tooling:** mise for tasks and tool versions, bun for packages, call vite/vitest/playwright directly; no task-runner layer (Nx was removed as unused).
- **Pre-commit hook** (`.githooks/pre-commit`) runs ruff and Biome on staged files.
- **Profiling specs** live in `apps/e2e/profiling/` with their own config, not in `apps/e2e/tests/`.
- **Agent instructions** live only in this file; `CLAUDE.md` just imports it.

## Not building (yet)

WebSockets or SSE (10 s polling is enough), user accounts, holding-pattern detection, carbon or wake-spacing estimates.
