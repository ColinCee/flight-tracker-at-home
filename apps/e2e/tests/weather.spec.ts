import { expect, test } from '@playwright/test';

const API = 'http://localhost:8000';

test.describe('weather endpoint', () => {
  test('returns valid weather response shape', async ({ request }) => {
    const response = await request.get(`${API}/weather`);
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('cacheAgeSeconds');
    expect(data).toHaveProperty('weather');
    expect(Array.isArray(data.weather)).toBe(true);
  });

  test('weather array items have correct shape when present', async ({ request }) => {
    const response = await request.get(`${API}/weather`);
    const { weather } = await response.json();

    if (weather.length > 0) {
      const airport = weather[0];
      expect(airport).toMatchObject({
        icao: expect.any(String),
        name: expect.any(String),
        condition: expect.any(String),
      });

      // Nullable fields should be present (even if null)
      expect(airport).toHaveProperty('temperatureC');
      expect(airport).toHaveProperty('windSpeedKts');
      expect(airport).toHaveProperty('windDirectionDeg');
    }
  });

  test('timestamp and cacheAgeSeconds are non-negative numbers', async ({ request }) => {
    const response = await request.get(`${API}/weather`);
    const data = await response.json();

    expect(data.timestamp).toBeGreaterThanOrEqual(0);
    expect(data.cacheAgeSeconds).toBeGreaterThanOrEqual(0);
  });
});
