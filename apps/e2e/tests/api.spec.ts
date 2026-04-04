import { expect, test } from '@playwright/test';

const API = 'http://localhost:8000';

test.describe('API contract', () => {
  test('GET /health returns ok', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.ok()).toBe(true);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  test('GET /aircraft returns valid response shape', async ({ request }) => {
    const res = await request.get(`${API}/aircraft`);
    expect(res.ok()).toBe(true);

    const data = await res.json();

    // Top-level envelope
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('cacheAgeSeconds');
    expect(Array.isArray(data.aircraft)).toBe(true);
    expect(data.aircraft.length).toBeGreaterThan(0);

    // Aircraft shape (spot-check first item)
    const aircraft = data.aircraft[0];
    expect(aircraft).toMatchObject({
      icao24: expect.any(String),
      latitude: expect.any(Number),
      longitude: expect.any(Number),
      onGround: expect.any(Boolean),
      isApproachingLhr: expect.any(Boolean),
    });

    // KPIs shape
    expect(data.kpis).toMatchObject({
      inboundLhr: expect.any(Number),
      trackedAircraft: expect.any(Number),
      apiHealth: expect.stringMatching(/^(green|amber|red)$/),
    });
  });
});
