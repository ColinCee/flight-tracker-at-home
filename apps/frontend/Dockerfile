FROM node:24-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS builder

RUN corepack enable && npm install -g bun@1.4.4

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
