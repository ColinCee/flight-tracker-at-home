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

### 1. Create a Cloudflare Tunnel

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → Networks → Tunnels
2. Create a new tunnel, name it `flight-tracker`
3. Copy the **tunnel token** (you'll only see it once)
4. Add a **public hostname**:
   - Subdomain: `api`
   - Domain: `colincheung.dev`
   - Service: `http://backend:8000`

### 2. Create the `.env` file

On your machine, in the directory where you'll run the stack:

```bash
cat > .env << 'EOF'
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

### 3. Authenticate with GHCR

Create a GitHub Personal Access Token (PAT) with `read:packages` scope, then:

```bash
docker login ghcr.io -u YOUR_GITHUB_USERNAME
# Paste your PAT as the password
```

### 4. Start the stack

Copy `docker-compose.prod.yml` to your machine and run:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Or create a new stack in **Dockge** using the compose file contents.

### 5. Verify

```bash
# Check containers are running
docker compose -f docker-compose.prod.yml ps

# Test the API
curl https://api.colincheung.dev/health

# Test OpenSky connectivity
curl https://api.colincheung.dev/debug/opensky
```

### 6. Update GitHub Actions variable

In your repo: Settings → Secrets and variables → Actions → Variables:

Set `VITE_API_BASE_URL` = `https://api.colincheung.dev`

## Auto-deployment

When you merge to `main`:

1. **CI** builds a new Docker image and pushes it to GHCR (`:latest` tag)
2. **Tugtainer** on your machine detects the new image, pulls it, and restarts the backend
3. **CI** also deploys the frontend to Cloudflare Pages

No SSH keys, no webhooks, no manual steps after initial setup.

## Troubleshooting

**Backend not reachable:**
- Check `docker logs cloudflared` — tunnel should show "Connected"
- Verify the tunnel hostname routes to `http://backend:8000` in Cloudflare dashboard

**OpenSky returning 429:**
- You're rate-limited. The credit-aware throttling will automatically back off.
- Check `/debug/opensky` to see current status.

**Tugtainer not updating:**
- Check `docker logs tugtainer`
- Ensure GHCR package visibility is set to **Public** (or that Docker is logged in to GHCR)
