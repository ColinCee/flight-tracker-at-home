FROM node:26-slim@sha256:e4db4c914bf8ad241bd24804fc25d272d89bad97e68cdc8a1414862790a02c39 AS builder

RUN corepack enable && npm install -g bun@1.3

WORKDIR /app

# Install dependencies (cached layer)
COPY package.json bun.lock ./
COPY apps/frontend/package.json ./apps/frontend/
RUN bun install --frozen-lockfile

# Copy source needed for build
COPY tsconfig.base.json tsconfig.json nx.json ./
COPY apps/frontend/ ./apps/frontend/

RUN bunx nx build frontend

# --- Runtime stage ---
FROM caddy:2-alpine@sha256:eb4d35b7452d1ab6171fbdbe8d9275b2301dad6dad92115d91e19fb9b24d510f

COPY apps/frontend/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/apps/frontend/dist/ /srv/

EXPOSE 8080
