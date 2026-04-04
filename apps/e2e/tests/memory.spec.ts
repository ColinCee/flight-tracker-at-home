import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const SAMPLE_INTERVAL_MS = 5_000;
const SOAK_DURATION_MS = Number(process.env.MEMORY_SOAK_SECONDS ?? 120) * 1000;
const REPORT_PATH = join(process.env.MEMORY_REPORT_DIR ?? process.cwd(), 'browser-memory.json');

test.describe('browser memory profile', () => {
  // Soak runs for MEMORY_SOAK_SECONDS (default 120s) — need extra headroom for setup
  test.setTimeout(SOAK_DURATION_MS + 30_000);

  test('measure JS heap during sustained use', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const samples: { elapsed_s: number; heap_used_mb: number }[] = [];
    const start = Date.now();
    const deadline = start + SOAK_DURATION_MS;

    while (Date.now() < deadline) {
      // performance.memory is Chrome-only (non-standard) but Playwright uses Chromium
      const heapUsed = await page.evaluate(() => {
        const perf = performance as Performance & {
          memory?: { usedJSHeapSize: number };
        };
        return perf.memory?.usedJSHeapSize ?? 0;
      });

      const elapsedS = Math.round((Date.now() - start) / 1000);
      const heapMb = Math.round(heapUsed / 1024 / 1024);
      samples.push({ elapsed_s: elapsedS, heap_used_mb: heapMb });

      await page.waitForTimeout(SAMPLE_INTERVAL_MS);
    }

    // Write samples to JSON for the shell script to pick up
    const firstSample = samples[0]?.heap_used_mb ?? 0;
    const lastSample = samples[samples.length - 1]?.heap_used_mb ?? 0;
    const peakSample = Math.max(...samples.map((s) => s.heap_used_mb));

    const report = {
      peak_mb: peakSample,
      start_mb: firstSample,
      end_mb: lastSample,
      delta_mb: lastSample - firstSample,
      samples: samples.length,
      duration_s: SOAK_DURATION_MS / 1000,
    };

    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

    // Log for CI visibility
    console.log(
      `Browser memory: peak=${peakSample}MB, start=${firstSample}MB, end=${lastSample}MB, delta=${report.delta_mb}MB`,
    );

    // Don't fail — this is observational, not a gate
    expect(true).toBe(true);
  });
});
