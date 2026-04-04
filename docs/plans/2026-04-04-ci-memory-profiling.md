# CI Memory Profiling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a CI job that measures peak RSS of backend and frontend processes during e2e tests, reports the results, and fails if either exceeds 512MB.

**Architecture:** A shell script wraps the existing Playwright `webServer` startup pattern — starts uvicorn + vite, samples their RSS every second via `ps`, runs e2e tests, then reports peak memory. The CI job uploads the memory report as a GitHub Actions artifact.

**Tech Stack:** Bash, `ps` (procps), GitHub Actions artifacts, Playwright (existing)

---

### Task 1: Create the memory profiling script

**Files:**
- Create: `scripts/memory-profile.sh`

**Step 1: Write the profiling script**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Configuration
SAMPLE_INTERVAL=1
THRESHOLD_MB=${MEMORY_THRESHOLD_MB:-512}
REPORT_FILE="${MEMORY_REPORT_FILE:-memory-report.txt}"

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
timeout 30 bash -c 'until curl -sf http://localhost:8000/health > /dev/null 2>&1; do sleep 0.5; done'
echo "Backend ready (PID: $BACKEND_PID)"

echo "Waiting for frontend (port 4200)..."
timeout 60 bash -c 'until curl -sf http://localhost:4200 > /dev/null 2>&1; do sleep 0.5; done'
echo "Frontend ready (PID: $FRONTEND_PID)"

# --- Start memory samplers ---
sample_rss() {
  local pid=$1 output=$2
  while kill -0 "$pid" 2>/dev/null; do
    # ps reports RSS in KB
    rss_kb=$(ps -o rss= -p "$pid" 2>/dev/null || echo "0")
    echo "${rss_kb// /}" >> "$output"
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
# Use reuseExistingServer since we started servers ourselves
CI=true bunx playwright test --reporter=list 2>&1 || TEST_EXIT=$?
cd - > /dev/null
TEST_EXIT=${TEST_EXIT:-0}

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

# --- Generate report ---
{
  echo "=== Memory Profile Report ==="
  echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Threshold: ${THRESHOLD_MB} MB"
  echo ""
  echo "Backend (uvicorn):"
  echo "  PID:          $BACKEND_PID"
  echo "  Peak RSS:     ${BACKEND_PEAK_MB} MB (${BACKEND_PEAK_KB} KB)"
  echo "  Samples:      $BACKEND_SAMPLES_COUNT"
  echo "  Status:       $([ "$BACKEND_PEAK_MB" -le "$THRESHOLD_MB" ] && echo "PASS ✓" || echo "FAIL ✗ (exceeds ${THRESHOLD_MB} MB)")"
  echo ""
  echo "Frontend (vite dev):"
  echo "  PID:          $FRONTEND_PID"
  echo "  Peak RSS:     ${FRONTEND_PEAK_MB} MB (${FRONTEND_PEAK_KB} KB)"
  echo "  Samples:      $FRONTEND_SAMPLES_COUNT"
  echo "  Status:       $([ "$FRONTEND_PEAK_MB" -le "$THRESHOLD_MB" ] && echo "PASS ✓" || echo "FAIL ✗ (exceeds ${THRESHOLD_MB} MB)")"
  echo ""
  echo "E2E tests exit code: $TEST_EXIT"
  echo "=== End Report ==="
} | tee "$REPORT_FILE"

# --- Threshold check ---
EXIT_CODE=$TEST_EXIT
if [[ "$BACKEND_PEAK_MB" -gt "$THRESHOLD_MB" ]]; then
  echo ""
  echo "ERROR: Backend peak RSS (${BACKEND_PEAK_MB} MB) exceeds threshold (${THRESHOLD_MB} MB)"
  EXIT_CODE=1
fi
if [[ "$FRONTEND_PEAK_MB" -gt "$THRESHOLD_MB" ]]; then
  echo ""
  echo "ERROR: Frontend peak RSS (${FRONTEND_PEAK_MB} MB) exceeds threshold (${THRESHOLD_MB} MB)"
  EXIT_CODE=1
fi

exit "$EXIT_CODE"
```

**Step 2: Make it executable and test locally**

Run: `chmod +x scripts/memory-profile.sh && head -5 scripts/memory-profile.sh`
Expected: Shebang line visible, no syntax errors.

**Step 3: Commit**

```bash
git add scripts/memory-profile.sh
git commit -m "feat: add memory profiling script for CI"
```

---

### Task 2: Add CI workflow job

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Add memory-profile job to ci.yml**

Add after the existing `test` job:

```yaml
  memory-profile:
    name: Memory Profile
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jdx/mise-action@v2
      - run: bun install --frozen-lockfile
      - run: cd apps/backend && uv sync
      - run: bunx playwright install chromium
      - run: scripts/memory-profile.sh
        env:
          MEMORY_THRESHOLD_MB: 512
          MEMORY_REPORT_FILE: memory-report.txt
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: memory-report
          path: memory-report.txt
          retention-days: 30
```

**Step 2: Verify YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
Expected: No errors.

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add memory profiling job with 512MB threshold"
```

---

### Task 3: Add Playwright config for external server mode

**Files:**
- Modify: `apps/e2e/playwright.config.ts`

**Context:** The memory-profile script starts servers itself (to capture PIDs for memory sampling). But Playwright's `webServer` config also tries to start them. When `CI=true`, `reuseExistingServer` is `false`, so Playwright would try to start duplicate servers. We need Playwright to detect when servers are already running.

**Step 1: Update playwright.config.ts to skip webServer when servers are pre-started**

Replace the `webServer` block to respect a `SERVERS_EXTERNAL` env var:

```typescript
import { defineConfig } from '@playwright/test';

const serversExternal = !!process.env.SERVERS_EXTERNAL;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4200',
  },
  ...(serversExternal
    ? {}
    : {
        webServer: [
          {
            command:
              'cd ../backend && uv run uvicorn src.main:app --host 0.0.0.0 --port 8000',
            port: 8000,
            reuseExistingServer: !process.env.CI,
          },
          {
            command: 'cd .. && bunx nx serve frontend',
            port: 4200,
            reuseExistingServer: !process.env.CI,
          },
        ],
      }),
});
```

**Step 2: Update memory-profile.sh to set SERVERS_EXTERNAL**

In the e2e test section of the script, change:

```bash
CI=true bunx playwright test --reporter=list 2>&1 || TEST_EXIT=$?
```

to:

```bash
SERVERS_EXTERNAL=1 CI=true bunx playwright test --reporter=list 2>&1 || TEST_EXIT=$?
```

**Step 3: Verify existing e2e tests still work without the env var**

Run: `cd apps/e2e && bunx playwright test --reporter=list`
Expected: Tests pass (Playwright starts its own servers as before).

**Step 4: Commit**

```bash
git add apps/e2e/playwright.config.ts scripts/memory-profile.sh
git commit -m "feat: support external server mode for memory profiling"
```

---

### Task 4: Push and create PR

**Step 1: Push branch**

```bash
git push -u origin feat/memory-profiling
```

**Step 2: Create PR**

```bash
gh pr create \
  --title "ci: add memory profiling to CI" \
  --body "$(cat <<'EOF'
## Summary
- Adds `scripts/memory-profile.sh` that samples peak RSS of backend + frontend during e2e tests
- New CI job uploads memory report as artifact and fails if either process exceeds 512MB
- Playwright config supports `SERVERS_EXTERNAL=1` for pre-started servers

## How it works
1. Script starts uvicorn + vite, records PIDs
2. Background loop samples RSS via `ps` every 1 second
3. Playwright e2e tests run against the servers
4. Report shows peak memory per process, fails if over threshold

## Test plan
- [ ] CI memory-profile job runs and produces artifact
- [ ] Existing e2e tests still pass (webServer mode unchanged)
- [ ] Memory report shows reasonable baseline numbers

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 3: Verify CI starts**

Run: `gh pr view --json number,url`
