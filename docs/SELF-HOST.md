# Self-Hosting Guide

Run the Flight Tracker backend on your own Linux machine using [Dokploy](https://dokploy.com/), exposed via Cloudflare Tunnel.

## Prerequisites

- Linux machine (always-on, residential IP)
- Docker & Docker Compose installed
- [Dokploy](https://docs.dokploy.com/) installed (or raw Docker Compose — see below)
- A domain managed by Cloudflare (e.g. `colincheung.dev`)
- Internet access (airplanes.live API — no account needed)

## Architecture

```
Browser → flight-tracker-at-home.pages.dev (Cloudflare Pages)
              ↓ API calls
          api.colincheung.dev (Cloudflare Tunnel)
              ↓ (encrypted, no open ports)
          Your machine (Dokploy: backend + cloudflared)
              ↓
          airplanes.live API (free, no auth needed)
```

## Option A: Dokploy (Recommended)

If you have Dokploy installed, deploy the backend as an application:

1. **Create project** in Dokploy dashboard
2. **Add application** → GitHub source → this repo → Dockerfile at `apps/backend/Dockerfile`
3. **Set env vars**: `CORS_ORIGINS=https://your-frontend-domain.pages.dev`
4. **Deploy** — Dokploy builds from source and starts the container
5. **Add cloudflared** as a separate Docker image application (`cloudflare/cloudflared:latest`)
6. Set the cloudflared command to `cloudflared tunnel --no-autoupdate run` with `TUNNEL_TOKEN` env var

### Auto-deploy from CI

Add a deploy step to your GitHub Actions that joins your Tailscale network and calls the Dokploy API:

```yaml
- uses: tailscale/github-action@v4
  with:
    oauth-client-id: ${{ secrets.TS_OAUTH_CLIENT_ID }}
    oauth-secret: ${{ secrets.TS_OAUTH_SECRET }}
    tags: tag:ci
- run: |
    curl -sf -X POST 'http://your-server:3000/api/trpc/application.deploy' \
      -H 'x-api-key: ${{ secrets.DOKPLOY_API_KEY }}' \
      -H 'Content-Type: application/json' \
      -d '{"json":{"applicationId":"your-app-id"}}'
```

## Option B: Plain Docker Compose

If you prefer raw Docker Compose without Dokploy:

### 1. Create a Cloudflare Tunnel

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → Networks → Tunnels
2. Create a new tunnel, name it `flight-tracker`
3. Choose **Docker** as the environment — copy the tunnel token
4. Add a **public hostname**: `api.yourdomain.com` → `http://backend:8000`

### 2. Clone and configure

```bash
git clone https://github.com/ColinCee/flight-tracker-at-home.git
cd flight-tracker-at-home

cat > .env << 'EOF'
COMPOSE_PROFILES=prod
CACHE_TTL=10
CORS_ORIGINS=https://flight-tracker-at-home.pages.dev
TUNNEL_TOKEN=your-tunnel-token-here
EOF
```

### 3. Start

```bash
docker compose up -d
```

### 4. Verify

```bash
curl https://api.yourdomain.com/docs
```

## Updating GitHub Actions variable

In your repo: Settings → Secrets and variables → Actions → Variables:

Set `VITE_API_BASE_URL` = `https://api.yourdomain.com`

## Troubleshooting

**Backend not reachable:**
- Check `docker logs cloudflared` — tunnel should show "Connected"
- Verify the tunnel hostname routes to `http://backend:8000` in Cloudflare dashboard

**airplanes.live rate limiting:**
- The API allows ~1 request per 10 seconds sustained. The backend's 10s cache TTL respects this.
- No authentication or API keys are needed.
