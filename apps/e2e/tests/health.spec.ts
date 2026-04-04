import { expect, test } from "@playwright/test";

test.describe("health", () => {
  test("backend health endpoint responds", async ({ request }) => {
    const response = await request.get("http://localhost:8000/health");
    expect(response.ok()).toBe(true);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("frontend loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Frontend/i);
  });
});
