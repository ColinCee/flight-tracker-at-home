#!/usr/bin/env bash
set -euo pipefail

# Configuration
SAMPLE_INTERVAL=1
SOAK_DURATION=${MEMORY_SOAK_SECONDS:-120}
SOAK_POLL_INTERVAL=10
REPORT_FILE="${MEMORY_REPORT_FILE:-memory-report.md}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Temp files for peak tracking
BACKEND_SAMPLES=$(mktemp)
FRONTEND_SAMPLES=$(mktemp)
cleanup() {
  local pids=("${BACKEND_PID:-}" "${FRONTEND_PID:-}" "${BACKEND_SAMPLER_PID:-}" "${FRONTEND_SAMPLER_PID:-}")
  for pid in "${pids[@]}"; do
    [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
  done
  rm -f "$BACKEND_SAMPLES" "$FRONTEND_SAMPLES"
}
trap cleanup EXIT

# --- Start servers ---
echo "Starting backend..."
cd apps/backend
uv run uvicorn src.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd - > /dev/null

echo "Starting frontend..."
bunx nx serve frontend &
FRONTEND_PID=$!

# --- Wait for servers ---
echo "Waiting for backend (port 8000)..."
if ! timeout 30 bash -c 'until curl -sf http://localhost:8000/health > /dev/null 2>&1; do sleep 0.5; done'; then
  echo "ERROR: Backend did not become ready within 30s" >&2
  exit 1
fi
echo "Backend ready (PID: $BACKEND_PID)"

echo "Waiting for frontend (port 4200)..."
if ! timeout 60 bash -c 'until curl -sf http://localhost:4200 > /dev/null 2>&1; do sleep 0.5; done'; then
  echo "ERROR: Frontend did not become ready within 60s" >&2
  exit 1
fi
echo "Frontend ready (PID: $FRONTEND_PID)"

# --- Start memory samplers ---
# Get all descendant PIDs recursively via /proc
get_descendants() {
  local parent=$1
  local children
  children=$(ps -o pid= --ppid "$parent" 2>/dev/null) || true
  for child in $children; do
    echo "$child"
    get_descendants "$child"
  done
}

sample_rss() {
  local pid=$1 output=$2
  while kill -0 "$pid" 2>/dev/null; do
    # Collect pid + all descendants
    local all_pids="$pid $(get_descendants "$pid")"
    # Sum RSS across all
    rss_kb=$(ps -o rss= -p $(echo $all_pids | tr ' ' ',') 2>/dev/null | awk '{s+=$1} END{print s+0}')
    [[ "$rss_kb" -gt 0 ]] && echo "$rss_kb" >> "$output"
    sleep "$SAMPLE_INTERVAL"
  done
}

sample_rss "$BACKEND_PID" "$BACKEND_SAMPLES" &
BACKEND_SAMPLER_PID=$!

sample_rss "$FRONTEND_PID" "$FRONTEND_SAMPLES" &
FRONTEND_SAMPLER_PID=$!

# --- Run e2e tests ---
echo ""
echo "Running e2e tests..."
cd apps/e2e
# Use SERVERS_EXTERNAL since we started servers ourselves
TEST_EXIT=0
SERVERS_EXTERNAL=1 CI=true bunx playwright test --reporter=list 2>&1 || TEST_EXIT=$?
cd - > /dev/null

# --- Soak test: simulate normal dashboard polling ---
echo ""
echo "Soak test: polling /aircraft every ${SOAK_POLL_INTERVAL}s for ${SOAK_DURATION}s..."

# Capture RSS at start of soak
BACKEND_SOAK_START_KB=$(tail -1 "$BACKEND_SAMPLES" 2>/dev/null || echo "0")
FRONTEND_SOAK_START_KB=$(tail -1 "$FRONTEND_SAMPLES" 2>/dev/null || echo "0")

SOAK_END=$((SECONDS + SOAK_DURATION))
SOAK_REQUESTS=0
while [[ $SECONDS -lt $SOAK_END ]]; do
  curl -sf http://localhost:8000/aircraft > /dev/null 2>&1 || true
  SOAK_REQUESTS=$((SOAK_REQUESTS + 1))
  sleep "$SOAK_POLL_INTERVAL"
done

# Capture RSS at end of soak
BACKEND_SOAK_END_KB=$(tail -1 "$BACKEND_SAMPLES" 2>/dev/null || echo "0")
FRONTEND_SOAK_END_KB=$(tail -1 "$FRONTEND_SAMPLES" 2>/dev/null || echo "0")

echo "Soak complete: ${SOAK_REQUESTS} requests over ${SOAK_DURATION}s"

# --- Stop samplers and servers ---
kill "$BACKEND_SAMPLER_PID" "$FRONTEND_SAMPLER_PID" 2>/dev/null || true
wait "$BACKEND_SAMPLER_PID" "$FRONTEND_SAMPLER_PID" 2>/dev/null || true

# --- Calculate peaks ---
peak_kb() {
  local file=$1
  if [[ -s "$file" ]]; then
    sort -rn "$file" | head -1
  else
    echo "0"
  fi
}

BACKEND_PEAK_KB=$(peak_kb "$BACKEND_SAMPLES")
FRONTEND_PEAK_KB=$(peak_kb "$FRONTEND_SAMPLES")
BACKEND_PEAK_MB=$(( BACKEND_PEAK_KB / 1024 ))
FRONTEND_PEAK_MB=$(( FRONTEND_PEAK_KB / 1024 ))
BACKEND_SAMPLES_COUNT=$(wc -l < "$BACKEND_SAMPLES" | tr -d ' ')
FRONTEND_SAMPLES_COUNT=$(wc -l < "$FRONTEND_SAMPLES" | tr -d ' ')

# --- Calculate soak trend ---
BACKEND_SOAK_START_MB=$(( ${BACKEND_SOAK_START_KB:-0} / 1024 ))
BACKEND_SOAK_END_MB=$(( ${BACKEND_SOAK_END_KB:-0} / 1024 ))
BACKEND_SOAK_DELTA=$(( BACKEND_SOAK_END_MB - BACKEND_SOAK_START_MB ))
FRONTEND_SOAK_START_MB=$(( ${FRONTEND_SOAK_START_KB:-0} / 1024 ))
FRONTEND_SOAK_END_MB=$(( ${FRONTEND_SOAK_END_KB:-0} / 1024 ))
FRONTEND_SOAK_DELTA=$(( FRONTEND_SOAK_END_MB - FRONTEND_SOAK_START_MB ))

trend_indicator() {
  local delta=$1
  if [[ "$delta" -gt 10 ]]; then
    echo "📈 +${delta} MB"
  elif [[ "$delta" -lt -10 ]]; then
    echo "📉 ${delta} MB"
  else
    echo "~ stable (${delta:+$delta} MB)"
  fi
}

# --- Generate report (markdown for PR comment) ---
{
  echo "## Memory Profile"
  echo ""
  echo "### Peak RSS"
  echo ""
  echo "| Process | Peak RSS | Samples |"
  echo "|---------|----------|---------|"
  echo "| Backend (uvicorn) | **${BACKEND_PEAK_MB} MB** | ${BACKEND_SAMPLES_COUNT} |"
  echo "| Frontend (vite) | **${FRONTEND_PEAK_MB} MB** | ${FRONTEND_SAMPLES_COUNT} |"
  echo ""
  echo "### Soak Test (${SOAK_DURATION}s, ${SOAK_REQUESTS} requests)"
  echo ""
  echo "| Process | Start | End | Trend |"
  echo "|---------|-------|-----|-------|"
  echo "| Backend | ${BACKEND_SOAK_START_MB} MB | ${BACKEND_SOAK_END_MB} MB | $(trend_indicator "$BACKEND_SOAK_DELTA") |"
  echo "| Frontend | ${FRONTEND_SOAK_START_MB} MB | ${FRONTEND_SOAK_END_MB} MB | $(trend_indicator "$FRONTEND_SOAK_DELTA") |"
  echo ""
  echo "<details><summary>Details</summary>"
  echo ""
  echo "- Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "- Backend PID: $BACKEND_PID (peak: ${BACKEND_PEAK_KB} KB)"
  echo "- Frontend PID: $FRONTEND_PID (peak: ${FRONTEND_PEAK_KB} KB)"
  echo "- E2E tests exit code: $TEST_EXIT"
  echo "- Soak: polled \`/aircraft\` every ${SOAK_POLL_INTERVAL}s for ${SOAK_DURATION}s"
  echo ""
  echo "</details>"
} | tee "$REPORT_FILE"

exit "$TEST_EXIT"
