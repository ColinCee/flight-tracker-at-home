# Flight Tracker at Home

A real-time aviation dashboard showing aircraft over London airspace with
Heathrow arrival tracking — built as a portfolio project.

- **Frontend:** React + Vite + Tailwind in `apps/frontend`
- **Backend:** FastAPI in `apps/backend`

## Project docs

- **[docs/MVP.md](./docs/MVP.md)** — Product spec, scope, and risks
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — Technical decisions, data contract, and stack

## Tooling at a glance

| Tool        | What it does here                                                                                                                  | Docs                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **mise**    | Installs the runtimes this repo expects: Bun, Node, Python, and uv. It also gives us shared setup commands.                        | <https://mise.jdx.dev>         |
| **bun**     | Installs and runs the JavaScript/TypeScript side of the repo. Think of it as the JS package manager/runtime.                       | <https://bun.sh/docs>          |
| **uv**      | Installs Python dependencies and manages the backend virtual environment. Think of it as the Python package manager for this repo. | <https://docs.astral.sh/uv/>   |
| **Nx**      | Runs repo tasks from one place. It is the monorepo task runner, so you use it to start apps, run tests, and so on.                 | <https://nx.dev>               |
| **Vite**    | Dev server and build tool for the React frontend.                                                                                  | <https://vite.dev/guide/>      |
| **FastAPI** | Python web framework used by the backend API.                                                                                      | <https://fastapi.tiangolo.com> |

## How the tools fit together

1. `mise` gets the right runtimes onto your machine.
2. `bun` installs JavaScript dependencies from the root of the repo.
3. `uv` installs Python dependencies for `apps/backend` and creates `.venv`.
4. `Nx` is the main way to run project commands after setup.

## Typical setup

```sh
mise install
mise run setup
```

That runs:

- `bun install` for the JS workspace
- `cd apps/backend && uv sync` for the Python backend

### OpenSky Network API credentials (optional)

The backend fetches live aircraft data from the [OpenSky Network](https://opensky-network.org/) REST API.
It works without credentials (anonymous access) but you'll hit rate limits quickly (400 calls/day, 10 s resolution).

To get **10× more capacity** (4 000+ calls/day, 5 s resolution):

1. Create a free account at <https://opensky-network.org>
2. Go to **Account → API Clients → Create** and download your credentials
3. Copy the example env file and fill in your keys:

```sh
cp apps/backend/.env.example apps/backend/.env
# Then edit apps/backend/.env with your client_id and client_secret
```

The backend authenticates via OAuth2 client credentials flow — tokens are cached and auto-refreshed.
If no credentials are set, it falls back to anonymous access.

## API contract generation

The frontend API client is generated from the FastAPI OpenAPI schema with Orval:

```sh
mise run codegen
```

That exports `apps/backend`'s OpenAPI schema and regenerates the frontend client in
`apps/frontend/src/api/`.

## Typical commands

```sh
mise run dev
```

Or with Bun/Nx directly:

```sh
bun run dev
```

That starts the frontend on `http://localhost:4200` and the backend on
`http://localhost:8000`.

Other useful commands:

```sh
bunx nx show projects
bunx nx serve backend
bunx nx serve frontend
```

## Lockfiles

- `bun.lock` pins JS dependency versions
- `apps/backend/uv.lock` pins Python dependency versions

If you are new to the repo, start with **mise**, then **bun/uv**, then **Nx**.

## Deployment

Everything runs on **Cloudflare** for free: Pages (frontend) + Python Worker (backend API).
Both deploy automatically via GitHub Actions on push to `main` — see `.github/workflows/deploy.yml`.

### Required GitHub repo settings

Add these in **Settings → Secrets and variables → Actions**:

| Type | Name | Description |
|------|------|-------------|
| Secret | `CLOUDFLARE_API_TOKEN` | API token with Workers + Pages edit permissions |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| Variable | `VITE_API_BASE_URL` | Worker URL (e.g. `https://flight-tracker-api.<account>.workers.dev`) |

### First-time setup (one-off, via CLI)

```sh
# Authenticate wrangler
npx wrangler login

# Create and deploy the worker
cd apps/worker && uv sync && uv run pywrangler deploy

# Set OpenSky secrets (optional, for higher rate limits)
npx wrangler secret put OPENSKY_CLIENT_ID
npx wrangler secret put OPENSKY_CLIENT_SECRET

# Create the Pages project (if not already created)
cd ../.. && npx wrangler pages project create flight-tracker-at-home
```

After this, all subsequent deploys happen automatically via CI.

### Local development

```sh
# Worker (backend)
cd apps/worker && uv sync && uv run pywrangler dev

# Or use the original uvicorn backend
mise run dev
```

### Environment variables reference

| Variable | Where | Required | Default | Description |
|----------|-------|----------|---------|-------------|
| `OPENSKY_CLIENT_ID` | Worker (secret) | No | — | OAuth2 client ID for higher rate limits |
| `OPENSKY_CLIENT_SECRET` | Worker (secret) | No | — | OAuth2 client secret |
| `CACHE_TTL` | Worker (wrangler.jsonc) | No | `20` | Base cache TTL in seconds |
| `CORS_ORIGINS` | Worker (wrangler.jsonc) | No | `https://flight-tracker-at-home.pages.dev` | Comma-separated allowed origins |
| `VITE_API_BASE_URL` | Pages (env var) | No | `http://localhost:8000` | Backend API URL |

### Credit-aware throttling

With `CACHE_TTL=20` and OpenSky auth credentials (4,000 credits/day), the backend
automatically scales polling when credits run low:

| Credits remaining | Effective TTL | Calls/day budget |
|-------------------|---------------|------------------|
| > 1,000 | 20s (base) | 4,320 |
| < 1,000 | 30s | 2,880 |
| < 500 | 60s | 1,440 |
| < 100 | 120s | 720 |

This ensures the tracker stays live all day instead of exhausting credits in a few hours.
