import { expect, type Page, test } from '@playwright/test';

// Distinct colours in a screenshot of the map canvas. A blank or lost WebGL
// canvas is one flat colour; drawn tiles give many.
async function distinctColours(page: Page): Promise<number> {
  const png = await page.locator('canvas.maplibregl-canvas').screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    if (!ctx) return 0;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    const seen = new Set<number>();
    for (let i = 0; i < data.length; i += 16) {
      seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    }
    return seen.size;
  }, png.toString('base64'));
}

// Two production-only bugs this would have caught: the maplibre v6 worker
// missing from the bundle (blank map, no tiles), and react-maplibre 8.1.0
// throwing on every pan frame.
test('production build draws map tiles and pans without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __contextsLost: number };
    w.__contextsLost = 0;
    window.addEventListener('webglcontextlost', () => w.__contextsLost++, true);
  });

  // Vector tiles are fetched by the maplibre worker, so none arrive if the
  // worker failed to load.
  const firstTile = page.waitForResponse((r) => /\.pbf(\?|$)/.test(r.url()) && r.ok(), {
    timeout: 30_000,
  });

  await page.goto('/');
  const canvas = page.locator('canvas.maplibregl-canvas');
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  await firstTile;
  await expect.poll(() => distinctColours(page), { timeout: 15_000 }).toBeGreaterThan(20);

  const box = await canvas.boundingBox();
  if (!box) throw new Error('map canvas has no size');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(cx + i * 10, cy + i * 5);
  }
  await page.mouse.up();
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(1000);

  expect(errors).toEqual([]);
  expect(
    await page.evaluate(() => (window as unknown as { __contextsLost: number }).__contextsLost),
  ).toBe(0);
});
