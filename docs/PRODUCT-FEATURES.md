# Aviation Dashboard — Product Features Spec

**Authors:** Colin & Calvin Cheung

## Problem

No simple tool visualises London airspace in real-time. We want a dashboard that
makes abstract ATC data legible — inspired by the National Grid ESO dashboard —
useful as a portfolio piece and learning project.

## Definition of Done

A live 2D map of aircraft over London with callsign / altitude / speed
datablocks, plus a KPI strip showing inbound arrivals and runway throughput for
Heathrow. Deployed and shareable via a public URL. The map should also display 
major London airports with clickable popups containing real-time METAR weather
conditions.

## User Flow

1. User opens the dashboard
2. Sees a dark-themed radar map of London airspace with aircraft icons moving in
   near-real-time (~10s refresh) and static airport markers
3. Glances at KPI strip — Heathrow arrivals count, estimated throughput, data
   freshness, tracked aircraft count, API health indicator
4. Can zoom / pan the map
5. Clicks an aircraft to see its datablock (callsign, altitude, speed, heading)
6. Clicks an airport to see its live weather datablock (condition, temp, wind)

## Stack

| Layer       | Technology                              |
| ----------- | --------------------------------------- |
| Frontend    | React + Vite + Tailwind CSS             |
| Map         | MapLibre GL JS + react-map-gl + Deck.gl |
| Map tiles   | OpenFreeMap (dark style)                |
| State mgmt  | TanStack Query (React Query)            |
| Backend     | Python / FastAPI                        |
| Data source | airplanes.live REST API + MET Norway    |
| Monorepo    | Nx + Bun + mise                         |
| Deploy (FE) | Cloudflare Pages                        |
| Deploy (BE) | Self-hosted (Docker + Cloudflare Tunnel)|

> See [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details, data contract,
> and implementation guidance. Both files live in `docs/`.

## Not Building (Yet)

- WebSockets / SSE — REST polling matches airplanes.live's ~10s rate limit perfectly
- Airspace Pressure Index — future feature
- Stack debt / holding pattern detection — complex, future
- Historical persistence / database — in-memory only for MVP
- Weight-based spacing, carbon estimation
- Multi-airport tracking (Gatwick, Stansted, etc.) — LHR only for MVP
- Authentication / user accounts

## Risks & Mitigations

| Risk                                    | Impact | Mitigation                                                    |
| --------------------------------------- | ------ | ------------------------------------------------------------- |
| airplanes.live rate limits (~1 req/10s) | Low    | Lazy caching (zero calls when idle), 10s TTL, single instance |
| MET Norway user-agent restrictions      | High   | Send custom User-Agent in headers, aggressive 30m caching     |
| airplanes.live data gaps                | Medium | Show "stale data" warning, degrade gracefully                 |
| Arrival heuristic false positives       | Low    | LHR controlled airspace limits low-altitude traffic           |
