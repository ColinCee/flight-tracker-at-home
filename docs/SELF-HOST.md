# Self-Hosting Guide

Run the Flight Tracker backend on your own Linux machine with Docker Compose, exposed via Cloudflare Tunnel.

The live site's backend runs this way from the [homelab](https://github.com/ColinCee/homelab) repo (`stacks/flight-tracker/`), which pins the image that CI pushes to `ghcr.io/colincee/flight-tracker-at-home/backend` on every merge to `main`.

## Prerequisites

- Linux machine (always-on, residential IP)
- Docker & Docker Compose installed
- A domain managed by Cloudflare (e.g. `colincheung.dev`)
- Internet access (adsb.lol API — no account needed)

## Architecture

```
Browser → flight-tracker-at-home.pages.dev (Cloudflare Pages)
              ↓ API calls
          api.colincheung.dev (Cloudflare Tunnel)
              ↓ (encrypted, no open ports)
          Your machine (backend + cloudflared)
              ↓
          adsb.lol API (free, no auth needed)
```

## Setup

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

**Upstream failures:**
- adsb.lol times out several times a day; the backend then tries `ADSB_FALLBACK_URL` and serves its last good data meanwhile.
