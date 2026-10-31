import { expect, test } from '@playwright/test';

const PHONE = { width: 390, height: 844 };

// A phone in portrait. Not a device descriptor: those pick WebKit, and CI installs only Chromium.
test.use({
  viewport: PHONE,
  isMobile: true,
  hasTouch: true,
  // Headless Chromium needs this for WebGL, which deck.gl uses to pick the tapped aircraft.
  launchOptions: { args: ['--enable-unsafe-swiftshader'] },
});

/** Screen position of a point at the map's starting view (centre -0.12, 51.49, zoom 10). */
function toScreen(lng: number, lat: number) {
  const worldSize = 512 * 2 ** 10;
  const project = (lo: number, la: number) => {
    const s = Math.sin((la * Math.PI) / 180);
    return {
      x: ((lo + 180) / 360) * worldSize,
      y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * worldSize,
    };
  };
  const c = project(-0.12, 51.49);
  const p = project(lng, lat);
  return { x: PHONE.width / 2 + p.x - c.x, y: PHONE.height / 2 + p.y - c.y };
}

test.describe('phone layout', () => {
  test('every KPI is on screen without scrolling', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Tracked' })).toBeVisible({ timeout: 10_000 });

    const items = [
      ...['Tracked', 'Airborne', 'Inbound London', 'Climbing', 'Descending'].map((name) =>
        page.getByRole('button', { name }),
      ),
      page.getByText('Avg Alt'),
      page.locator('[data-slot="badge"]'),
    ];
    for (const item of items) {
      const box = await item.boundingBox();
      expect(box).not.toBeNull();
      if (!box) continue;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width);
      expect(box.y + box.height).toBeLessThanOrEqual(PHONE.height);
    }
  });

  test('tapping an aircraft opens a bottom sheet, not a map popup', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Tracked' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 15_000 });

    // UAL789 in the mock data sits at 51.55 N, 0.10 W. Retry while the layers finish drawing.
    const { x, y } = toScreen(-0.1, 51.55);
    const sheet = page.getByRole('dialog', { name: 'Aircraft details' });
    await expect(async () => {
      await page.touchscreen.tap(x, y);
      await expect(sheet).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });

    await expect(sheet).toContainText('UAL789');
    await expect(page.locator('.maplibregl-popup')).toHaveCount(0);

    // Full width and resting on the bottom edge once the slide-in ends.
    await expect
      .poll(async () => {
        const box = await sheet.boundingBox();
        return box && [box.width, Math.round(box.y + box.height)];
      })
      .toEqual([PHONE.width, PHONE.height]);

    await sheet.getByRole('button', { name: 'Close' }).tap();
    await expect(sheet).toBeHidden();

    // Tapping empty map closes it too. (Wait out the double-tap-zoom window between taps.)
    await page.waitForTimeout(500);
    await page.touchscreen.tap(x, y);
    await expect(sheet).toBeVisible();
    await page.waitForTimeout(500);
    await page.touchscreen.tap(40, 360);
    await expect(sheet).toBeHidden();
  });
});
