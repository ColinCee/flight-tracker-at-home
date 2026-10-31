# ✈️ Flight Tracker at Home

Real-time aviation dashboard showing aircraft around the London airspace with London airport arrival tracking.

**▶ Live: [flight-tracker-at-home.pages.dev](https://flight-tracker-at-home.pages.dev)**

[![CI](https://github.com/ColinCee/flight-tracker-at-home/actions/workflows/ci.yml/badge.svg?branch=main&event=push)](https://github.com/ColinCee/flight-tracker-at-home/actions/workflows/ci.yml?query=branch%3Amain)
[![Deploy](https://github.com/ColinCee/flight-tracker-at-home/actions/workflows/deploy.yml/badge.svg?branch=main&event=push)](https://github.com/ColinCee/flight-tracker-at-home/actions/workflows/deploy.yml?query=branch%3Amain)
[![Live](https://img.shields.io/website?url=https%3A%2F%2Fflight-tracker-at-home.pages.dev&label=live&up_message=online&down_message=offline)](https://flight-tracker-at-home.pages.dev)
[![API](https://img.shields.io/website?url=https%3A%2F%2Fapi.colincheung.dev%2Fhealth&label=api&up_message=online&down_message=offline)](https://api.colincheung.dev/health)

![Screenshot](docs/screenshot.png)

## What it does

- Plots live aircraft on a dark-themed interactive map (OpenFreeMap tiles), with emergency squawks highlighted
- Highlights planes approaching an airport in orange (heading + altitude + "ILS check")
- Real-time KPIs: tracked, airborne, inbound airport, climbing, descending, avg altitude, plus a rolling 60-minute arrival throughput counter
- Click any aircraft for callsign, altitude, speed, heading, and squawk; click an airport for current weather (MET Norway)
- 3D heatmap view of historical traffic, binned into H3 hexagons

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 8, Tailwind CSS |
| Map | MapLibre GL JS, react-map-gl, Deck.gl |
| State | TanStack Query (auto-polling) |
| Backend | Python 3.14, FastAPI |
| Data | [adsb.lol](https://adsb.lol/) REST API (ODbL) |
| E2E Tests | Playwright |
| Monorepo | Bun workspaces + mise tasks |
| Deploy (FE) | Cloudflare Pages |
| Deploy (BE) | Docker image on the homelab + Cloudflare Tunnel |

## Run locally

Requires [mise](https://mise.jdx.dev), which manages all tool versions (Bun, Node, Python, uv).

```sh
mise install        # install runtimes
mise run setup      # install all dependencies + git hooks
mise run dev        # start frontend (localhost:4200) + backend (localhost:8000)
```

Other commands (tests, checks, codegen) are listed in [AGENTS.md](./AGENTS.md#commands) and by `mise tasks`.

## How it works

```
adsb.lol API → Backend (FastAPI + 10s cache) → Frontend (React + Deck.gl)
```

The backend fetches aircraft positions from adsb.lol (any ADSBx v2 endpoint via `ADSB_API_URL`), marks aircraft approaching the five London airports, and caches results with a 10-second TTL. The frontend polls the backend and renders aircraft on a map with real-time KPIs.

Architecture, configuration and conventions for contributors (and coding agents) are in [AGENTS.md](./AGENTS.md).

## Deployment

| Component | Platform | Trigger |
|-----------|----------|---------|
| Frontend | Cloudflare Pages | Auto-deploy on merge to `main`; preview deploys on PRs |
| Backend | Docker image on GHCR | Built and pushed on merge to `main`; run by [homelab](https://github.com/ColinCee/homelab) |
| Networking | Cloudflare Tunnel | `api.colincheung.dev` → backend container |

The workflow badges at the top show current CI and deploy status.
