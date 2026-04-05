# Self-Hosting Guide

Run the Flight Tracker backend on your own Linux machine, exposed via Cloudflare Tunnel.

## Prerequisites

- Linux machine (always-on, residential IP)
- Docker & Docker Compose installed
- A domain managed by Cloudflare (e.g. `colincheung.dev`)
- OpenSky Network account with API client credentials

## Architecture

```
Browser → flight-tracker-at-home.pages.dev (Cloudflare Pages)
              ↓ API calls
          api.colincheung.dev (Cloudflare Tunnel)
              ↓ (encrypted, no open ports)
          Your machine (Docker: backend + cloudflared + tugtainer)
              ↓
          OpenSky API (residential IP — not blocked)
```

## Setup

### 1. Make the GHCR package public

The backend Docker image is pushed to GitHub Container Registry by CI. Make it publicly pullable:

1. Go to GitHub → Your profile → Packages → `flight-tracker-at-home/backend`
2. Package settings → Danger Zone → Change visibility → **Public**

This lets your server (and Tugtainer) pull images without authentication.

### 2. Create a Cloudflare Tunnel

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → Networks → Tunnels
2. Create a new tunnel, name it `flight-tracker`
3. Choose **Docker** as the environment — it will show you a token and a `docker run` command
4. **Run the `docker run` command** on your server to connect the tunnel and satisfy the wizard
5. Add a **public hostname**:
   - Subdomain: `api`
   - Domain: `colincheung.dev`
   - Type: `HTTP`
   - URL: `backend:8000`
6. Save, then stop the temporary container (`Ctrl+C`)

The token encodes your tunnel config. Save it for the next step.

### 3. Clone the repo and create `.env`

```bash
git clone https://github.com/ColinCee/flight-tracker-at-home.git
cd flight-tracker-at-home

cat > .env << 'EOF'
# Activate production services (needed for Dockge / plain docker compose up)
COMPOSE_PROFILES=prod

# OpenSky Network OAuth2 credentials
OPENSKY_CLIENT_ID=your-client-id
OPENSKY_CLIENT_SECRET=your-client-secret

# Cache TTL (seconds)
CACHE_TTL=20

# CORS — allow the frontend origin
CORS_ORIGINS=https://flight-tracker-at-home.pages.dev

# Cloudflare Tunnel token
TUNNEL_TOKEN=your-tunnel-token-here
EOF
```

The `.env` file is gitignored — credentials stay local.

### 4. Start the stack

```bash
docker compose up -d
```

Or point **Dockge** at this directory to manage it via the UI — it works out of the box because `COMPOSE_PROFILES=prod` in `.env` activates the right services.

### 5. Verify

```bash
# Check containers are running
docker compose ps

# Test the API
curl https://api.colincheung.dev/health

# Test OpenSky connectivity
curl https://api.colincheung.dev/debug/opensky
```

### 6. Update GitHub Actions variable

In your repo: Settings → Secrets and variables → Actions → Variables:

Set `VITE_API_BASE_URL` = `https://api.colincheung.dev`

This tells the frontend build where the API lives.

## Auto-deployment

When you merge to `main`:

1. **CI** builds a new Docker image and pushes it to GHCR (`:latest` tag)
2. **Tugtainer** on your machine detects the new image, pulls it, and restarts the backend
3. **CI** also deploys the frontend to Cloudflare Pages

No SSH keys, no webhooks, no manual steps after initial setup.

## Updating the compose config

If `compose.yaml` changes:

```bash
cd flight-tracker-at-home
git pull
docker compose up -d
```

## Troubleshooting

**Backend not reachable:**
- Check `docker logs cloudflared` — tunnel should show "Connected"
- Verify the tunnel hostname routes to `http://backend:8000` in Cloudflare dashboard

**OpenSky returning 429:**
- You're rate-limited. The credit-aware throttling will automatically back off.
- Check `/debug/opensky` to see current status.

**Tugtainer not updating:**
- Check `docker logs tugtainer`
- Ensure GHCR package visibility is set to **Public**
