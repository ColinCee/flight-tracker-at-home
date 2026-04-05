---
root: true
targets:
  - '*'
globs:
  - '**/*'
description: 'Project overview, conventions, and development guidelines'
---

# Flight Tracker at Home

Real-time aviation dashboard showing aircraft over London with Heathrow arrival tracking.
Built by Colin & Calvin Cheung as a portfolio/learning project.

## Repository Structure

```
flight-tracker-at-home/
├── apps/
│   ├── frontend/              # React + Vite + Tailwind + TanStack Query
│   │   ├── src/
│   │   │   ├── api/           # API layer: Orval-generated hooks + fetch client
│   │   │   ├── features/      # Feature modules (map/, kpi/) with colocated tests
│   │   │   └── shared/        # Cross-feature: ui/, filters, units, utils
│   │   └── openapi.json       # Exported OpenAPI spec from backend
│   ├── backend/               # Python FastAPI + Pydantic
│   │   ├── src/main.py        # FastAPI app + endpoints (/health, /aircraft)
│   │   ├── src/models.py      # Data contract — source of truth for API schema
│   │   ├── src/opensky.py     # OpenSky API client (fetch, parse, enrich)
│   │   ├── src/cache.py       # 10s TTL cache + KPI computation
│   │   └── tests/             # Pytest tests
│   └── e2e/                   # Playwright end-to-end tests
│       ├── tests/             # Functional specs (health, aircraft, app)
│       └── profiling/         # Memory profiling spec (separate config)
├── scripts/
│   └── memory-profile.sh      # CI memory profiling (server RSS + browser JS heap)
├── docs/
│   ├── ARCHITECTURE.md        # Technical reference, data contract, design decisions
│   ├── MVP.md                 # Product requirements and scope
│   └── plans/                 # Design & implementation plans
├── .rulesync/                 # AI config source of truth → generates CLAUDE.md etc.
├── .githooks/                 # Pre-commit hook (lint-staged: ruff + biome)
├── nx.json                    # Nx monorepo config (generators + caching)
├── biome.json                 # JS/TS/CSS linting + formatting config
├── ruff.toml                  # Python linting + formatting config
├── orval.config.ts            # Pydantic → OpenAPI → TypeScript codegen
└── .mise.toml                 # Tool versions + tasks (bun, node, python, uv)
```

## Architecture

### Frontend (apps/frontend)

- **MapView.tsx** — MapLibre GL map with OpenFreeMap dark tiles, centered on London
- **AircraftLayer.tsx** — Deck.gl IconLayer rendering aircraft with heading rotation; orange for Heathrow approach, white otherwise
- **useAircraftData.ts** — React Query hook wrapping Orval-generated `useGetAircraft`, auto-polls every 10s
- **aircraft.svg** — A320 top-down silhouette, used as IconLayer atlas with `mask: true` for dynamic coloring

### Backend (apps/backend)

- **opensky.py** — 3-phase ETL: fetch London airspace from OpenSky API → parse state vectors into `AircraftState` → enrich with `is_approaching_lhr` heuristic (haversine distance, altitude, heading, descent rate). Authenticates via OAuth2 client credentials flow (tokens auto-cached and refreshed). Falls back to anonymous if no credentials.
- **cache.py** — `AirspaceCache` singleton with dynamic TTL lazy refresh; tracks rolling 60-min throughput for KPIs. On upstream failure (rate limit, timeout), serves stale cached data instead of losing aircraft. Credit-aware throttling scales TTL up (20s → 30s → 60s → 120s) as remaining API credits deplete.
- **models.py** — Pydantic models (`AircraftState`, `KPIs`, `AircraftResponse`) with `alias_generator=to_camel`

### OpenSky API credentials

The backend works without credentials (anonymous: 400 calls/day, 10s resolution) but rate limits are tight. For authenticated access (4000+ calls/day, 5s resolution):

1. Create a free account at https://opensky-network.org
2. Go to Account → API Clients → Create and download your credentials
3. `cp apps/backend/.env.example apps/backend/.env` and fill in `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET`

The `.env` file is gitignored. See `.env.example` for the template.

### Production environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENSKY_CLIENT_ID` | No | — | OAuth2 client ID (4000+ credits/day) |
| `OPENSKY_CLIENT_SECRET` | No | — | OAuth2 client secret |
| `CACHE_TTL` | No | `5`/`10` | Base cache TTL in seconds (production: `20`) |
| `CORS_ORIGINS` | No | `http://localhost:4200` | Comma-separated allowed origins |
| `VITE_API_BASE_URL` | No | `http://localhost:8000` | Backend URL (set at frontend build time) |

### Data Flow

```
OpenSky API (dynamic TTL, credit-aware)
  → opensky.py (fetch + parse + enrich)
  → cache.py (adaptive TTL + KPIs + stale fallback)
  → GET /aircraft (AircraftResponse JSON)
  → useAircraftData (React Query, adaptive refetch)
  → AircraftLayer (Deck.gl IconLayer)
```

## Essential Commands

All commands are run via [mise](https://mise.jdx.dev/) from the repo root:

```bash
# Setup
mise run setup              # Install all dependencies (JS + Python) + git hooks
mise run setup:frontend     # Install frontend dependencies only
mise run setup:backend      # Install backend dependencies only

# Development
mise run dev                # Run frontend and backend together

# Quality
mise run format             # Format all code (ruff + biome), auto-fix
mise run check              # Lint, format check, and type check (read-only, for CI)
mise run typecheck          # Type check only (subset of check)
mise run test               # Run all tests (pytest + vitest)
mise run test:e2e           # Run Playwright e2e tests
mise run test:e2e:ui        # Run Playwright with interactive UI

# Codegen & config
mise run rules:sync         # Regenerate AI config files from .rulesync/
mise run rules:check        # Verify AI config files are in sync (CI)
mise run codegen            # Regenerate frontend types from backend schema
mise run codegen:check      # Verify generated types are in sync (CI)

# Deploy
mise run deploy             # Deploy proxy worker + frontend to Cloudflare
mise run deploy:proxy       # Deploy proxy worker only
mise run deploy:frontend    # Build + deploy frontend to Cloudflare Pages
mise run dev:proxy          # Run proxy worker locally
```

## CI (GitHub Actions)

- **Auto-format** — On PRs, commits formatting fixes as `ci-format-bot`
- **Lint, Format & Types** — `mise run check` (ruff, biome, ty, tsc)
- **Test** — `mise run test` (pytest)
- **E2E Tests** — Playwright functional tests
- **Memory Profile** — Starts servers, runs e2e + 120s soak test, posts PR comment with:
  - Peak RSS for backend (uvicorn) and frontend (vite dev server)
  - JS heap usage from Chromium via CDP `Runtime.getHeapUsage`
  - Soak trend (stable / growing / shrinking) per process
- **Deploy** — On merge to main: deploys frontend to Cloudflare Pages; on PRs: creates preview deployments with status checks. Backend auto-deploys via Tugtainer (pulls new GHCR images).
- **Docker** — Builds backend (distroless Python) image, pushes to GHCR on main

## Key Conventions

- **Pydantic is the schema source of truth** — change `apps/backend/src/models.py`, run `mise run codegen` to update frontend types
- **camelCase in JSON** — Pydantic `alias_generator=to_camel` handles this automatically; Python stays `snake_case`, TypeScript gets `camelCase`
- **Generated code is committed** — `apps/frontend/src/api/generated.ts` and `apps/frontend/openapi.json` are checked in so the frontend builds without the backend running
- **Single `/aircraft` endpoint** — KPIs are derived from the aircraft list and bundled atomically
- **AI config is managed by rulesync** — edit `.rulesync/` and run `mise run rules:sync`, never edit generated files directly
- **Pre-commit hook** — lint-staged runs ruff (Python) + biome (JS/TS) on staged files

## Stack

| Layer     | Tech                                    |
| --------- | --------------------------------------- |
| Frontend  | React 19 + Vite 8 + Tailwind CSS       |
| Map       | MapLibre GL JS + react-map-gl + Deck.gl |
| State     | TanStack Query (auto-polling 10s)       |
| Backend   | Python 3.12 / FastAPI                   |
| Data      | OpenSky Network REST API                |
| E2E Tests | Playwright (Chromium)                   |
| Profiling | ps RSS sampling + CDP JS heap           |
| Monorepo  | Nx + Bun + mise                         |
| CI        | GitHub Actions                          |
| Deploy FE | Cloudflare Pages                        |
| Deploy BE | Self-hosted (Docker + Cloudflare Tunnel)|

## Tooling

Tool versions are managed by [mise](https://mise.jdx.dev/) (see `.mise.toml`):

- **bun** 1.3 — JS package manager + runtime
- **node** 24 — Required by Nx
- **python** 3.12 — Backend runtime
- **uv** — Python package/project manager
- **ruff** — Python linting + formatting (config: `ruff.toml`)
- **ty** — Python type checking (config: `pyproject.toml [tool.ty]`)
- **biome** — JS/TS/CSS linting + formatting (config: `biome.json`)

## Anti-Patterns

- Don't edit `apps/frontend/src/api/generated.ts` by hand — it's overwritten by Orval
- Don't add Python type stubs manually — use ty for type checking
- Don't install Python deps with pip — use `uv add` in `apps/backend/`
- Don't install JS deps with npm/yarn — use `bun add` from repo root
- Don't edit CLAUDE.md / .cursorrules / copilot-instructions.md directly — edit `.rulesync/` and run `mise run rules:sync`
- Don't put memory profiling specs in `apps/e2e/tests/` — they live in `apps/e2e/profiling/` with their own config
