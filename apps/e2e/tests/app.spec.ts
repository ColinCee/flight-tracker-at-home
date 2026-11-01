import { expect, test } from '@playwright/test';

// Mock data: six airborne aircraft; BAW123, DLH456 and EZY202 are landing,
// CFE101 is climbing out, and GBCDE (a helicopter), BAW123 and DLH456 are below 3,000 ft.

test.describe('live view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('draws the map and says how many flights are up', async ({ page }) => {
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 15_000 });
    const sheet = page.getByRole('region', { name: 'Flights' });
    await expect(sheet).toContainText('6 flights in the sky over London', { timeout: 10_000 });
    await expect(sheet).toContainText('live');
  });

  test('chips count and filter the nearest flights', async ({ page }) => {
    const list = page.getByRole('list', { name: 'Nearest flights' });
    await expect(list.getByRole('listitem')).toHaveCount(6, { timeout: 10_000 });

    const landing = page.getByRole('button', { name: /^Landing/ });
    await expect(landing.locator('.chip-n')).toHaveText('3');
    await landing.click();
    await expect(landing).toHaveAttribute('aria-pressed', 'true');
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await expect(list).toContainText('Landing at Heathrow');

    await page.getByRole('button', { name: /^Taking off/ }).click();
    await expect(list.getByRole('listitem')).toHaveCount(1);
    await expect(list).toContainText('CFE101');

    await page.getByRole('button', { name: /^Low/ }).click();
    await expect(list.getByRole('listitem')).toHaveCount(3);
  });

  test('search finds a flight by airline name', async ({ page }) => {
    const list = page.getByRole('list', { name: 'Nearest flights' });
    await expect(list.getByRole('listitem')).toHaveCount(6, { timeout: 10_000 });
    await page.getByRole('searchbox', { name: /Find a flight/ }).fill('united');
    await expect(list.getByRole('listitem')).toHaveCount(1);
    await expect(list).toContainText('UAL789');

    await page.getByRole('searchbox', { name: /Find a flight/ }).fill('nothing-like-this');
    await expect(list).toContainText('No flight matches');
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(list.getByRole('listitem')).toHaveCount(6);
  });

  test('a flight opens as a card and closes again', async ({ page }) => {
    await page.getByRole('button', { name: /^BAW123/ }).click();
    const card = page.getByRole('region', { name: 'Flight details' });
    await expect(card).toContainText('BAW123');
    await expect(card).toContainText('British Airways · A359');
    await expect(card).toContainText('Landing at Heathrow');
    await expect(card).toContainText('Emergency squawk (7700)');
    await expect(card).toContainText('1,950');

    await card.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('region', { name: 'Flights' })).toBeVisible();

    await page.getByRole('button', { name: /^UAL789/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: 'Flights' })).toBeVisible();
  });
});
