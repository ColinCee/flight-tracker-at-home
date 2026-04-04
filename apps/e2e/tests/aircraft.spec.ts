import { expect, test } from "@playwright/test";

test.describe("aircraft endpoint", () => {
  test("returns valid aircraft response shape", async ({ request }) => {
    const response = await request.get("http://localhost:8000/aircraft");
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty("timestamp");
    expect(data).toHaveProperty("cacheAgeSeconds");
    expect(data).toHaveProperty("aircraft");
    expect(data).toHaveProperty("kpis");
    expect(Array.isArray(data.aircraft)).toBe(true);
  });

  test("kpis have expected fields", async ({ request }) => {
    const response = await request.get("http://localhost:8000/aircraft");
    const { kpis } = await response.json();

    expect(kpis).toMatchObject({
      inboundLhr: expect.any(Number),
      throughputLast60Min: expect.any(Number),
      trackedAircraft: expect.any(Number),
      dataFreshnessSeconds: expect.any(Number),
      apiHealth: expect.stringMatching(/^(green|amber|red)$/),
    });
  });
});
