import { expect, test } from '@playwright/test';

test.describe('frontend app', () => {
  test('loads and renders the map container', async ({ page }) => {
    await page.goto('/');

    // App shell renders
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // MapLibre canvas is present (indicates WebGL map loaded)
    const canvas = page.locator('canvas.maplibregl-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
  });

  test('fetches aircraft data from API', async ({ page }) => {
    const aircraftRequest = page.waitForResponse(
      (res) => new URL(res.url()).pathname === '/aircraft' && res.status() === 200,
    );

    await page.goto('/');
    const res = await aircraftRequest;
    const data = await res.json();

    expect(data.aircraft.length).toBeGreaterThan(0);
  });
});
