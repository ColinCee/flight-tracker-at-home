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

| Layer        | Technology                              |
| ------------ | --------------------------------------- |
| Frontend     | React + Vite + Tailwind CSS             |
| Map          | MapLibre GL JS + react-map-gl + Deck.gl |
| Map tiles    | OpenFreeMap (dark style)                |
| State mgmt   | TanStack Query (React Query)            |
| Backend      | Python / FastAPI                        |
| Data source  | OpenSky Network REST API                |
| Monorepo     | Nx + Bun + mise                         |
| Deploy (FE)  | Cloudflare Pages                        |
| Deploy (BE)  | Render                                  |

> See [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details, data contract,
> and implementation guidance. Both files live in `docs/`.

## Not Building (Yet)

- WebSockets / SSE — REST polling matches OpenSky's 10s cadence perfectly
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
| OpenSky rate limits (4,000 credits/day) | Medium | Lazy caching (zero burn when idle), 10s TTL, single instance |
| OpenSky data gaps during high load      | Medium | Show "stale data" warning, degrade gracefully    |
| Render free tier cold starts (~30-60s)  | Low    | Acceptable for portfolio demo, show loading state |
| Arrival heuristic false positives       | Low    | LHR controlled airspace limits low-altitude traffic |
| OpenSky auth changes (OAuth2 only)      | Low    | Use OAuth2 client credentials — token auto-refresh in backend |
