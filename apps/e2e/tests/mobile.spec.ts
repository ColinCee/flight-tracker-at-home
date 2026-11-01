import { expect, type Locator, type Page, test } from '@playwright/test';

const PHONE = { width: 390, height: 844 };

// A phone in portrait. Not a device descriptor: those pick WebKit, and CI installs only Chromium.
test.use({
  viewport: PHONE,
  isMobile: true,
  hasTouch: true,
  // Headless Chromium needs this for WebGL, which deck.gl uses to pick the tapped aircraft.
  launchOptions: { args: ['--enable-unsafe-swiftshader'] },
});

/** The sheet's resting heights on this phone (see sheet-snap.ts). */
const SNAP = { peek: 156, half: Math.round(PHONE.height * 0.48), full: PHONE.height - 76 };

/**
 * Screen position of a point at the map's starting view: centre -0.2, 51.5,
 * zoom 8.6, drawn in the space above the half-open sheet and below the search bar.
 */
function toScreen(lng: number, lat: number) {
  const worldSize = 512 * 2 ** 8.6;
  const project = (lo: number, la: number) => {
    const s = Math.sin((la * Math.PI) / 180);
    return {
      x: ((lo + 180) / 360) * worldSize,
      y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * worldSize,
    };
  };
  const c = project(-0.2, 51.5);
  const p = project(lng, lat);
  const centreY = 72 + (PHONE.height - 72 - SNAP.half) / 2;
  return { x: PHONE.width / 2 + p.x - c.x, y: centreY + p.y - c.y };
}

async function sheetHeight(sheet: Locator) {
  const box = await sheet.boundingBox();
  return box && Math.round(box.height);
}

/** Drag the sheet by its grip with touch-like pointer events. */
async function drag(page: Page, sheet: Locator, dy: number, steps: number) {
  const box = await sheet.boundingBox();
  if (!box) throw new Error('no sheet');
  const x = box.x + box.width / 2;
  const y = box.y + 12;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(x, y + (dy * i) / steps);
  await page.mouse.up();
}

test.describe('phone layout', () => {
  test('one sheet across the bottom, with the sentence and chips on screen', async ({ page }) => {
    await page.goto('/');
    const sheet = page.getByRole('region', { name: 'Flights' });
    await expect(sheet).toContainText('flights in the sky over London', { timeout: 10_000 });
    await expect
      .poll(async () => {
        const box = await sheet.boundingBox();
        return box && [box.width, Math.round(box.y + box.height)];
      })
      .toEqual([PHONE.width, PHONE.height]);
    for (const name of [/^All/, /^Landing/, /^Taking off/, /^Low/]) {
      await expect(sheet.getByRole('button', { name })).toBeInViewport();
    }
  });

  test('the sheet snaps to its three heights when dragged or flicked', async ({ page }) => {
    await page.goto('/');
    const sheet = page.getByRole('region', { name: 'Flights' });
    await expect.poll(() => sheetHeight(sheet)).toBe(SNAP.half);

    // A slow, long drag up settles at the nearest height: full.
    await drag(page, sheet, -360, 30);
    await expect.poll(() => sheetHeight(sheet)).toBe(SNAP.full);

    // A quick flick down moves one step. (Far enough that a slow CI runner,
    // where the release no longer counts as a flick, still settles there.)
    await drag(page, sheet, 200, 3);
    await expect.poll(() => sheetHeight(sheet)).toBe(SNAP.half);
    await drag(page, sheet, 150, 3);
    await expect.poll(() => sheetHeight(sheet)).toBe(SNAP.peek);
    await expect(sheet.getByRole('list', { name: 'Nearest flights' })).toBeHidden();

    // Tapping the grip opens it again.
    await sheet.getByRole('button', { name: 'Resize panel' }).tap();
    await expect.poll(() => sheetHeight(sheet)).toBe(SNAP.half);
  });

  test('tapping an aircraft turns the sheet into its card', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('region', { name: 'Flights' })).toContainText('6 flights', {
      timeout: 10_000,
    });

    // UAL789 in the mock data sits at 51.55 N, 0.10 W. Retry while the layers finish drawing.
    const { x, y } = toScreen(-0.1, 51.55);
    const card = page.getByRole('region', { name: 'Flight details' });
    await expect(async () => {
      await page.touchscreen.tap(x, y);
      await expect(card).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(card).toContainText('UAL789');
    await expect(card).toContainText('United · B77W');

    // Tapping empty map goes back to the list. (Wait out the double-tap-zoom window.)
    await page.waitForTimeout(500);
    await page.touchscreen.tap(40, 200);
    await expect(page.getByRole('region', { name: 'Flights' })).toBeVisible();
  });
});
