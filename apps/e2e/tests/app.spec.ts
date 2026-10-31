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
    // Chromium can evict the page's response body before we read it, so re-fetch.
    const data = await (await page.request.get(res.url())).json();

    expect(data.aircraft.length).toBeGreaterThanOrEqual(0);
  });

  test('fetches weather data from API', async ({ page }) => {
    const weatherRequest = page.waitForResponse(
      (res) => new URL(res.url()).pathname === '/weather' && res.status() === 200,
    );

    await page.goto('/');
    const res = await weatherRequest;
    // Chromium can evict the page's response body before we read it, so re-fetch.
    const data = await (await page.request.get(res.url())).json();

    expect(data.weather.length).toBeGreaterThanOrEqual(0);
  });

  test('displays KPI strip with tracked aircraft count', async ({ page }) => {
    await page.goto('/');

    // Wait for data to load and KPI strip to render
    const trackedLabel = page.getByRole('button', { name: 'Tracked' });
    await expect(trackedLabel).toBeVisible({ timeout: 10_000 });

    // KPI labels should be present
    await expect(page.getByRole('button', { name: 'Inbound London' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Airborne' })).toBeVisible();
    // Average altitude is a reading, not a filter, so it is not a button.
    await expect(page.getByText('Avg Alt')).toBeVisible();
  });

  test('shows API health indicator', async ({ page }) => {
    await page.goto('/');

    // Health badge should settle on Live/Stale/Offline once data loads
    const healthBadge = page.locator('[data-slot="badge"]');
    await expect(healthBadge).toBeVisible({ timeout: 10_000 });
    await expect(healthBadge).toHaveText(/^(Live|Stale|Offline)$/, { timeout: 10_000 });
  });
});
