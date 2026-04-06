import { expect, test } from '@playwright/test';

const API = 'http://localhost:8000';

test.describe('aircraft endpoint', () => {
  test('returns valid aircraft response shape', async ({ request }) => {
    const response = await request.get(`${API}/aircraft`);
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('cacheAgeSeconds');
    expect(data).toHaveProperty('refreshIntervalMs');
    expect(data).toHaveProperty('aircraft');
    expect(data).toHaveProperty('kpis');
    expect(Array.isArray(data.aircraft)).toBe(true);
  });

  test('kpis have expected fields and types', async ({ request }) => {
    const response = await request.get(`${API}/aircraft`);
    const { kpis } = await response.json();

    expect(kpis).toMatchObject({
      trackedAircraft: expect.any(Number),
      airborneAircraft: expect.any(Number),
      inboundLondonAircraft: expect.any(Number),
      climbingAircraft: expect.any(Number),
      descendingAircraft: expect.any(Number),
      throughputLast60Min: expect.any(Number),
      apiHealth: expect.stringMatching(/^(live|stale|offline)$/),
    });
  });

  test('kpis contain no extra unexpected fields', async ({ request }) => {
    const response = await request.get(`${API}/aircraft`);
    const { kpis } = await response.json();
    const expectedKeys = [
      'trackedAircraft',
      'airborneAircraft',
      'inboundLondonAircraft',
      'climbingAircraft',
      'descendingAircraft',
      'throughputLast60Min',
      'avgAltitudeFt',
      'apiHealth',
    ];
    expect(Object.keys(kpis).sort()).toEqual(expectedKeys.sort());
  });

  test('response uses camelCase field names', async ({ request }) => {
    const response = await request.get(`${API}/aircraft`);
    const data = await response.json();

    // Top-level fields should be camelCase
    expect(data).toHaveProperty('cacheAgeSeconds');
    expect(data).not.toHaveProperty('cache_age_seconds');
  });

  test('aircraft array items have correct shape when present', async ({ request }) => {
    const response = await request.get(`${API}/aircraft`);
    const { aircraft } = await response.json();

    if (aircraft.length > 0) {
      const plane = aircraft[0];
      expect(plane).toMatchObject({
        icao24: expect.any(String),
        latitude: expect.any(Number),
        longitude: expect.any(Number),
        onGround: expect.any(Boolean),
        lastContact: expect.any(Number),
        isClimbing: expect.any(Boolean),
        isDescending: expect.any(Boolean),
        positionSource: expect.any(String),
        category: expect.any(String),
      });

      // Nullable fields should be present (even if null)
      expect(plane).toHaveProperty('callsign');
      expect(plane).toHaveProperty('registration');
      expect(plane).toHaveProperty('aircraftType');
      expect(plane).toHaveProperty('baroAltitudeFt');
      expect(plane).toHaveProperty('geoAltitudeFt');
      expect(plane).toHaveProperty('groundSpeedKts');
      expect(plane).toHaveProperty('trueTrack');
      expect(plane).toHaveProperty('verticalRateFpm');
      expect(plane).toHaveProperty('squawk');
      expect(plane).toHaveProperty('destination');
    }
  });

  test('timestamp and cacheAgeSeconds are non-negative numbers', async ({ request }) => {
    const response = await request.get(`${API}/aircraft`);
    const data = await response.json();

    expect(data.timestamp).toBeGreaterThanOrEqual(0);
    expect(data.cacheAgeSeconds).toBeGreaterThanOrEqual(0);
  });

  test('trackedAircraft matches aircraft array length', async ({ request }) => {
    const response = await request.get(`${API}/aircraft`);
    const data = await response.json();

    expect(data.kpis.trackedAircraft).toBe(data.aircraft.length);
  });
});
