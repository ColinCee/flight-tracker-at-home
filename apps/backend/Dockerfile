FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install production deps only (cached layer)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy application source
COPY src/ ./src/

# --- Runtime stage ---
FROM python:3.12-slim

RUN useradd --create-home --shell /bin/false appuser \
    && mkdir -p /app/data && chown appuser:appuser /app/data
USER appuser

WORKDIR /app

# Copy installed packages and source
COPY --from=builder /app/.venv/lib/python3.12/site-packages /app/site-packages
COPY --from=builder /app/src /app/src

ENV PYTHONPATH="/app/site-packages:/app"

EXPOSE 8000

ENTRYPOINT ["python3", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
