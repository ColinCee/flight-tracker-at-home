FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install production deps only (cached layer)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy application source
COPY src/ ./src/

# --- Runtime stage ---
FROM gcr.io/distroless/python3-debian12:nonroot

WORKDIR /app

# Copy installed packages and source
COPY --from=builder /app/.venv/lib/python3.12/site-packages /app/site-packages
COPY --from=builder /app/src /app/src

ENV PYTHONPATH="/app/site-packages:/app"

EXPOSE 8000

ENTRYPOINT ["python3", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
