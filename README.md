# ✈️ Flight Tracker at Home

[![CI](https://github.com/ColinCee/flight-tracker-at-home/actions/workflows/ci.yml/badge.svg)](https://github.com/ColinCee/flight-tracker-at-home/actions/workflows/ci.yml)
[![Deploy](https://github.com/ColinCee/flight-tracker-at-home/actions/workflows/deploy.yml/badge.svg)](https://github.com/ColinCee/flight-tracker-at-home/actions/workflows/deploy.yml)

Real-time aviation dashboard showing aircraft around the London airspace with London airport arrival tracking.

**[▶ Live Demo](https://flight-tracker-at-home.pages.dev)**
&nbsp;·&nbsp;
**[API Health](https://api.colincheung.dev/health)**

## What it does

- Plots live aircraft on a dark-themed interactive map (OpenFreeMap tiles)
- Highlights planes approaching an airport in orange (heading + altitude + "ILS check")
- Real-time KPIs: tracked, airborne, inbound airport, climbing, descending, avg altitude
- Rolling 60-minute London Airport arrival throughput counter
- Click any aircraft for callsign, altitude, speed, heading, and squawk

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 8, Tailwind CSS |
| Map | MapLibre GL JS, react-map-gl, Deck.gl |
| State | TanStack Query (auto-polling) |
| Backend | Python 3.12, FastAPI |
| Data | [airplanes.live](https://airplanes.live/) REST API |
| E2E Tests | Playwright |
| Monorepo | Nx + Bun + mise |
| Deploy (FE) | Cloudflare Pages |
| Deploy (BE) | Dokploy (Beelink) + Cloudflare Tunnel |

## Architecture

```
airplanes.live API → Backend (FastAPI + 10s cache) → Frontend (React + Deck.gl)
```

The backend fetches aircraft positions from airplanes.live, enriches them with a Heathrow approach heuristic, and caches results with a 10-second TTL. The frontend polls the backend and renders aircraft on a map with real-time KPIs.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for deep dives into the data contract, caching strategy, and design decisions.

## Getting Started

### Prerequisites

- [mise](https://mise.jdx.dev) — manages all tool versions (Bun, Node, Python, uv)

### Setup

```sh
mise install        # install runtimes
mise run setup      # install all dependencies + git hooks
mise run dev        # start frontend (localhost:4200) + backend (localhost:8000)
```

## Commands

```sh
mise run dev          # Start frontend + backend
mise run check        # Lint, format check, type check
mise run test         # Unit tests (pytest + vitest)
mise run test:e2e     # E2E tests (Playwright, uses mock data)
mise run format       # Auto-fix formatting
mise run codegen      # Regenerate frontend types from backend schema
```

## Project Structure

```
apps/
├── frontend/         # React + Vite + Tailwind
├── backend/          # Python FastAPI
└── e2e/              # Playwright tests
docs/
├── ARCHITECTURE.md   # Technical reference
└── MVP.md            # Product requirements
```

## Docs

- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — Technical decisions, data contract, and stack
- **[docs/MVP.md](docs/PRODUCT-FEATURES.md)** — Product spec and scope
- **[docs/SELF-HOST.md](./docs/SELF-HOST.md)** — Self-hosting the backend with Dokploy + Cloudflare Tunnel

## Deployment

| Component | Platform | Trigger |
|-----------|----------|---------|
| Frontend | Cloudflare Pages | Auto-deploy on merge to `main` |
| Backend | [Dokploy](https://dokploy.com/) on Beelink | CI → Tailscale → Dokploy API on merge to `main` |
| Networking | Cloudflare Tunnel (via Dokploy) | `api.colincheung.dev` → Dokploy backend service |

The two workflow badges at the top show current CI and deploy status.
