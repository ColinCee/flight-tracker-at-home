FROM node:24-slim AS builder

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
FROM caddy:2-alpine

COPY apps/frontend/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/apps/frontend/dist/ /srv/

EXPOSE 8080
