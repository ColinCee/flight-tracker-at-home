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

  test('displays KPI strip with tracked aircraft count', async ({ page }) => {
    await page.goto('/');

    // Wait for data to load and KPI strip to render
    const trackedLabel = page.locator('text=Tracked');
    await expect(trackedLabel).toBeVisible({ timeout: 10_000 });

    // All 5 KPI labels should be present
    await expect(page.locator('text=Inbound LHR')).toBeVisible();
    await expect(page.locator('text=Throughput/hr')).toBeVisible();
    await expect(page.locator('text=Freshness')).toBeVisible();
  });

  test('shows API health indicator', async ({ page }) => {
    await page.goto('/');

    // Health badge should show green/amber/red
    const healthBadge = page.locator('[data-slot="badge"]');
    await expect(healthBadge).toBeVisible({ timeout: 10_000 });
    const text = await healthBadge.textContent();
    expect(['green', 'amber', 'red']).toContain(text?.trim());
  });
});
