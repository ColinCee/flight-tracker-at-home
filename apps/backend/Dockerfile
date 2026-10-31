FROM python:3.14-slim@sha256:cd89c30eda26ee911a4611b18680086e0ea42e6f5f8cbe653d07fa7958c9cec8 AS builder

COPY --from=ghcr.io/astral-sh/uv:latest@sha256:32a7bb39b496babbd997b0a39a4d66c126bdaf5661b302bf6f06abda8deca6ff /uv /usr/local/bin/uv

WORKDIR /app

# Install production deps only (cached layer)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy application source
COPY src/ ./src/

# --- Runtime stage ---
FROM python:3.14-slim@sha256:cd89c30eda26ee911a4611b18680086e0ea42e6f5f8cbe653d07fa7958c9cec8

# The app never installs packages at runtime; pip's vendored copies of
# urllib3, msgpack and setuptools only add CVEs to the scan.
RUN python3 -m pip uninstall --yes pip \
    && useradd --create-home --shell /bin/false appuser \
    && mkdir -p /app/data && chown appuser:appuser /app/data
USER appuser

WORKDIR /app

# Copy installed packages and source
COPY --from=builder /app/.venv/lib/python3.14/site-packages /app/site-packages
COPY --from=builder /app/src /app/src

ENV PYTHONPATH="/app/site-packages:/app"

EXPOSE 8000

ENTRYPOINT ["python3", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
