import { expect, test } from '@playwright/test';

const API = 'http://localhost:8000';

test.describe('health', () => {
  test('backend health endpoint responds', async ({ request }) => {
    const response = await request.get(`${API}/health`);
    expect(response.ok()).toBe(true);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  test('frontend loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await expect(page).toHaveTitle(/Frontend/i);
    expect(errors).toEqual([]);
  });

  test('unknown routes return 404 from backend', async ({ request }) => {
    const response = await request.get(`${API}/nonexistent`);
    expect(response.status()).toBe(404);
  });
});

test.describe('cors and headers', () => {
  test('backend returns JSON content-type', async ({ request }) => {
    const response = await request.get(`${API}/aircraft`);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('openapi spec is available', async ({ request }) => {
    const response = await request.get(`${API}/openapi.json`);
    expect(response.ok()).toBe(true);

    const spec = await response.json();
    expect(spec).toHaveProperty('openapi');
    expect(spec).toHaveProperty('paths');
    expect(spec.paths).toHaveProperty('/aircraft');
    expect(spec.paths).toHaveProperty('/health');
  });
});
