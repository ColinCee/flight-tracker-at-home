import { type Browser, devices, expect, test } from '@playwright/test';

// Speed budgets for the main page, measured on a production build (vite build +
// vite preview) with the mock-data backend.
//
// How: each load runs in a fresh browser (empty cache; a second context in the
// same browser had its font download cancelled) at Pixel 7 size, with the
// network throttled to a slow phone connection (1.6 Mbps down, 150 ms
// latency). Bytes are each finished request's headers plus body as sent, which
// the preview server gzips; production may send a little less. Only the
// app's own files and API calls (localhost) count towards bytes and requests:
// the map style and tiles come from openfreemap.org, are fetched for real, and
// change outside this repo. LCP and CLS are the median of three loads, read
// once the first screen's animations have finished, with no input before.
//
// Budgets are today's numbers in CI (ubuntu-24.04, Chromium) plus headroom:
// bytes 10% or 3 KB over, whichever is more; requests two more; LCP about 35%
// over; CLS 0.02 over. Bytes match exactly from run to run, LCP and CLS within
// about 10%. Today's CLS comes from two shifts: the filter chips and list
// header resize when the self-hosted font replaces the fallback (about 0.02),
// and the map's top-right controls shrink once the map has loaded (about
// 0.04). Fixing either one is the way to lower the CLS budget.
// Raise a budget only with the reason in the pull request that raises it.
//
// Measured on 3 Nov 2026 (in comments: today's value):
const BUDGETS = {
  htmlKB: 3.9, // 0.9
  cssKB: 17.8, // 14.8
  jsKB: 635, // 576.9
  fontKB: 37, // 33.5
  imageKB: 3, // 0 (the page loads no images itself)
  totalKB: 692, // 628.8
  requests: 13, // 11
  lcpMs: 4800, // 3500
  cls: 0.08, // 0.054 to 0.061
};

type Metric = keyof typeof BUDGETS;

const KIND: Record<string, Metric | undefined> = {
  document: 'htmlKB',
  stylesheet: 'cssKB',
  script: 'jsKB',
  font: 'fontKB',
  image: 'imageKB',
};

const LOADS = 3;

async function load(browser: Browser, baseURL: string) {
  const context = await browser.newContext({ ...devices['Pixel 7'], baseURL });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 1.6e6 / 8,
    uploadThroughput: 750e3 / 8,
  });

  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: number; __cls: number };
    w.__lcp = 0;
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
        if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });

  // A failed or 4xx/5xx request would make the page look lighter and pass.
  // Maplibre cancels map tiles it no longer needs, so an aborted openfreemap
  // request is not a failure.
  const ownOrigin = (url: string) => new URL(url).hostname === 'localhost';
  const failures: string[] = [];
  const pending: Promise<void>[] = [];
  const bytes: Partial<Record<Metric, number>> = {};
  let requests = 0;
  let inFlight = 0;
  page.on('request', (r) => {
    if (ownOrigin(r.url())) inFlight++;
  });
  page.on('requestfailed', (r) => {
    const error = r.failure()?.errorText;
    if (ownOrigin(r.url())) inFlight--;
    if (ownOrigin(r.url()) || error !== 'net::ERR_ABORTED') failures.push(`${r.url()} ${error}`);
  });
  page.on('requestfinished', (r) => {
    if (!ownOrigin(r.url())) return;
    inFlight--;
    requests++;
    pending.push(
      (async () => {
        const status = (await r.response())?.status() ?? 0;
        if (status >= 400) failures.push(`${r.url()} ${status}`);
        const { responseHeadersSize, responseBodySize } = await r.sizes();
        const size = responseHeadersSize + responseBodySize;
        const kind = KIND[r.resourceType()];
        if (kind) bytes[kind] = (bytes[kind] ?? 0) + size;
        bytes.totalKB = (bytes.totalKB ?? 0) + size;
      })(),
    );
  });

  await page.goto('/', { waitUntil: 'load', timeout: 120_000 });
  await page.waitForLoadState('networkidle', { timeout: 60_000 });
  // Wait for running animations to finish (polling, since a script can start
  // one late), capped so a looping one cannot hang the test.
  const stillRunning = await page.evaluate(async () => {
    const deadline = performance.now() + 5_000;
    for (;;) {
      const running = document
        .getAnimations()
        .filter(
          (a) =>
            a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().endTime),
        );
      if (running.length === 0) return 0;
      if (performance.now() > deadline) return running.length;
      await Promise.allSettled(running.map((a) => a.finished));
      await new Promise((r) => setTimeout(r, 200));
    }
  });
  // A file can start late (a font once the text that needs it renders); wait
  // for every one of the app's own requests before reading the results.
  await expect.poll(() => inFlight, { timeout: 60_000 }).toBe(0);
  const { lcp, cls } = await page.evaluate(() => {
    const w = window as unknown as { __lcp: number; __cls: number };
    return { lcp: w.__lcp, cls: w.__cls };
  });
  await Promise.all(pending);
  // Closing aborts the map tiles still loading, so check failures before that.
  const failed = [...failures];
  await browser.close();

  expect(failed, 'failed requests').toEqual([]);
  expect(stillRunning, 'animations still running after 5 s').toBe(0);
  const kb = Object.fromEntries(
    Object.entries(bytes).map(([k, v]) => [k, Math.round((v / 1024) * 10) / 10]),
  );
  return { ...kb, requests, lcpMs: Math.round(lcp), cls: Math.round(cls * 1000) / 1000 };
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

test('main page stays within its speed budgets', async ({ playwright, launchOptions, baseURL }) => {
  const runs: Partial<Record<Metric, number>>[] = [];
  for (let i = 0; i < LOADS; i++) {
    runs.push(await load(await playwright.chromium.launch(launchOptions), baseURL ?? ''));
    console.log(`load ${i + 1}`, JSON.stringify(runs[i]));
  }
  const measured = { ...runs[0] };
  measured.lcpMs = median(runs.map((r) => r.lcpMs ?? 0));
  measured.cls = median(runs.map((r) => r.cls ?? 0));
  console.log('main page', JSON.stringify(measured));

  const over = (Object.keys(BUDGETS) as Metric[])
    .filter((m) => (measured[m] ?? 0) > BUDGETS[m])
    .map((m) => `main page ${m}: measured ${measured[m]}, budget ${BUDGETS[m]}`);
  expect(over, over.join('\n')).toEqual([]);
});
