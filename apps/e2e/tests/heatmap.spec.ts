import { expect, test } from '@playwright/test';

const API = 'http://localhost:8000';

test.describe('heatmap endpoint', () => {
  test('returns JSON and an array', async ({ request }) => {
    const response = await request.get(`${API}/heatmap`);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('application/json');
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('returns objects with expected fields', async ({ request }) => {
    const response = await request.get(`${API}/heatmap`);
    expect(response.ok()).toBe(true);
    const data = await response.json();

    // If there's data, verify structure
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('hexId');
      expect(data[0]).toHaveProperty('totalVolume');
      expect(data[0]).toHaveProperty('avgAltitude');
    }
  });

  test('aggregates data by hexagon', async ({ request }) => {
    const response = await request.get(`${API}/heatmap`);
    expect(response.ok()).toBe(true);
    const data = await response.json();

    // If there's data, verify each hex is unique
    const hexIds = data.map((d: { hexId: string }) => d.hexId);
    const uniqueHexIds = new Set(hexIds);
    expect(uniqueHexIds.size).toBe(hexIds.length);
  });
});

test.describe('frontend heatmap view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();
  });

  test('has a Heatmap button in the navigation', async ({ page }) => {
    const heatmapButton = page.getByRole('button', { name: /heatmap/i });
    await expect(heatmapButton).toBeVisible();
  });

  test('can switch to heatmap view by clicking the Heatmap button', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());

    const heatmapButton = page.getByRole('button', { name: /heatmap/i });
    await heatmapButton.click();

    await expect(heatmapButton).toHaveClass(/bg-zinc-700/);

    const radarButton = page.getByRole('button', { name: /live radar/i });
    await expect(radarButton).not.toHaveClass(/bg-zinc-700/);
  });

  test('can switch back to live radar view', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());

    const heatmapButton = page.getByRole('button', { name: /heatmap/i });
    await heatmapButton.click();

    const radarButton = page.getByRole('button', { name: /live radar/i });
    await radarButton.click();

    await expect(radarButton).toHaveClass(/bg-zinc-700/);
  });

  test('heatmap view shows tooltip on first visit', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());

    const heatmapButton = page.getByRole('button', { name: /heatmap/i });
    await heatmapButton.click();

    const tooltip = page.getByText('3D Map Controls');
    await expect(tooltip).toBeVisible();
  });

  test('tooltip appears with close button', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());

    const heatmapButton = page.getByRole('button', { name: /heatmap/i });
    await heatmapButton.click();

    // The tooltip has an X button to close it
    const closeButton = page.getByRole('button', { name: /close/i });
    await expect(closeButton).toBeVisible();
  });

  test('KPI strip is not visible in heatmap mode', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());

    const trackedLabel = page.getByRole('button', { name: 'Tracked' });
    await expect(trackedLabel).toBeVisible({ timeout: 10_000 });

    const heatmapButton = page.getByRole('button', { name: /heatmap/i });
    await heatmapButton.click();

    await page.waitForTimeout(500);

    await expect(trackedLabel).not.toBeVisible();
  });

  test('fetches heatmap data from API', async ({ page }) => {
    const heatmapRequest = page.waitForResponse(
      (res) => new URL(res.url()).pathname === '/heatmap' && res.status() === 200,
    );

    const heatmapButton = page.getByRole('button', { name: /heatmap/i });
    await heatmapButton.click();

    const res = await heatmapRequest;
    const data = await res.json();

    expect(Array.isArray(data)).toBe(true);
  });
});
