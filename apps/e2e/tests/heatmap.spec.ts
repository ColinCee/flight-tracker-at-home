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

test.describe('hourly heatmap endpoint', () => {
  test('returns 24 hours and cells with 24 counts', async ({ request }) => {
    const response = await request.get(`${API}/heatmap/hourly`);
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.resolution).toBe(7);
    expect(data.hours).toHaveLength(24);
    expect(data.hours[0]).toMatchObject({
      start: expect.any(String),
      aircraft: expect.any(Number),
      snapshots: expect.any(Number),
    });
    for (const cell of data.cells) expect(cell.counts).toHaveLength(24);
  });
});

/** A day of made-up traffic in two cells, peaking at the 10th hour. */
function fakeDay() {
  const first = Date.now() - 24 * 3600_000;
  const shape = Array.from({ length: 24 }, (_, i) => 10 + 40 * Math.exp(-((i - 10) ** 2) / 20));
  return {
    resolution: 7,
    hours: shape.map((aircraft, i) => ({
      start: new Date(first + i * 3600_000).toISOString(),
      aircraft,
      snapshots: 60,
    })),
    cells: [
      { hexId: '87194ad86ffffff', counts: shape.map((n) => Math.round(n * 10)) },
      { hexId: '87194ad33ffffff', counts: shape.map((n) => Math.round(n * 4)) },
    ],
  };
}

test.describe('busy times view', () => {
  test('says data is coming when the backend has none yet', async ({ page }) => {
    // Older backends have no /heatmap/hourly at all.
    await page.route('**/heatmap/hourly', (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto('/');
    await page.getByRole('tab', { name: 'Busy times' }).click();
    const panel = page.getByRole('region', { name: 'Busy times' });
    await expect(panel).toContainText('Busy times will appear soon');
  });

  test('ranks the chosen hour and lets you pick another', async ({ page }) => {
    await page.route('**/heatmap/hourly', (route) => route.fulfill({ json: fakeDay() }));
    await page.goto('/');
    await page.getByRole('tab', { name: 'Busy times' }).click();
    await expect(page.getByRole('tab', { name: 'Busy times' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    const panel = page.getByRole('region', { name: 'Busy times' });
    const bars = panel.getByRole('group', { name: 'Hour of day' }).getByRole('button');
    await expect(bars).toHaveCount(24);
    // Opens on the latest hour, one of the quietest in this made-up day.
    await expect(panel).toContainText(/Quieter than \d+% of the day|The quietest hour/);

    // The peak is the 10th hour of the rolling window: find its clock hour.
    const peakStart = new Date(fakeDay().hours[10]?.start ?? '');
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        hourCycle: 'h23',
        timeZone: 'Europe/London',
      }).format(peakStart),
    );
    await bars.nth(hour).click();
    await expect(panel).toContainText('The busiest hour of the day');
    await expect(bars.nth(hour)).toHaveAttribute('aria-pressed', 'true');
  });
});
