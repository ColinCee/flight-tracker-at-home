// Mobile performance snapshot: a mid-range phone (Pixel 7, 4x CPU slowdown,
// 1.6 Mbps / 150 ms network) loads the page, waits for map tiles, then pans
// the map for 5 s. Headless Chrome draws WebGL in software, so compare runs of
// this script with each other, not with a real phone.
// Usage: node apps/e2e/profiling/mobile-perf.mjs [url] [runs]
// Prints one JSON line per run, then the median of each metric.
import { chromium, devices } from '@playwright/test';

const url = process.argv[2] ?? 'https://flight-tracker-at-home.pages.dev';
const runs = Number(process.argv[3] ?? 3);

async function measure() {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 1.6e6 / 8,
    uploadThroughput: 750e3 / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  // Main-thread time beyond 50 ms per task (the part a user feels as lag).
  await page.addInitScript(() => {
    window.__blockingMs = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__blockingMs += e.blockingDuration;
    }).observe({ type: 'long-animation-frame', buffered: true });
  });

  // Ready = the first vector tiles have arrived and no new ones for 1 s.
  let lastTileAt = 0;
  page.on('response', (r) => {
    if (/\.pbf(\?|$)/.test(r.url())) lastTileAt = Date.now();
  });

  const start = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
  const loadMs = Date.now() - start;
  const deadline = start + 60_000;
  while (Date.now() < deadline && (lastTileAt === 0 || Date.now() - lastTileAt < 1000)) {
    await page.waitForTimeout(100);
  }
  const tilesMs = lastTileAt ? lastTileAt - start : null;

  // Pan for 5 s and record how long the main thread was blocked meanwhile.
  const loadBlockingMs = Math.round(await page.evaluate(() => window.__blockingMs));
  const box = page.viewportSize();
  const cx = box.width / 2;
  const cy = box.height / 2;
  const panStart = Date.now();
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  while (Date.now() - panStart < 5000) {
    const t = (Date.now() - panStart) / 5000;
    await page.mouse.move(
      cx + Math.sin(t * Math.PI * 4) * 120,
      cy + Math.cos(t * Math.PI * 4) * 120,
      { steps: 2 },
    );
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
  const panBlockingMs = Math.round(await page.evaluate(() => window.__blockingMs)) - loadBlockingMs;

  const page_ = await page.evaluate(() => {
    const res = performance.getEntriesByType('resource');
    const kb = (list) => Math.round(list.reduce((s, r) => s + r.transferSize, 0) / 1024);
    return {
      jsKB: kb(res.filter((r) => /\.m?js(\?|$)/.test(r.name))),
      totalKB: kb(res),
      requests: res.length,
      canvases: document.querySelectorAll('canvas').length,
      heapMB: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1e6),
    };
  });

  await browser.close();
  return { loadMs, tilesMs, loadBlockingMs, panBlockingMs, ...page_, errors: errors.length };
}

const results = [];
for (let i = 0; i < runs; i++) {
  const r = await measure();
  results.push(r);
  console.log(JSON.stringify(r));
}
const median = (k) =>
  results.map((r) => r[k]).sort((a, b) => a - b)[Math.floor(results.length / 2)];
console.log(
  `median ${JSON.stringify(Object.fromEntries(Object.keys(results[0]).map((k) => [k, median(k)])))}`,
);
