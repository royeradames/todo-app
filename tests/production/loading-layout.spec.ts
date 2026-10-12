import { expect, test } from "@playwright/test";

test("opening the browser list keeps painted content in place", async ({ page }) => {
  let releaseScripts: () => void = () => {};
  const scriptsReady = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  await page.route("**/_next/static/**/*.js", async (route) => {
    await scriptsReady;
    await route.continue();
  });
  await page.addInitScript(() => {
    const shifts: number[] = [];
    Object.defineProperty(window, "todoTestShifts", { value: shifts });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!("value" in entry) || typeof entry.value !== "number") continue;
        if (!("hadRecentInput" in entry) || entry.hadRecentInput) continue;
        shifts.push(entry.value);
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.setViewportSize({ width: 375, height: 900 });
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.getByText("Loading your tasks…", { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    // Let the actual server loading screen paint before loading the real app.
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
  } finally {
    releaseScripts();
  }
  await expect(page.getByRole("checkbox")).toHaveCount(6);
  await expect(page.getByText(
    "Your tasks are saved in this browser only.",
  )).toBeVisible();
  await page.waitForTimeout(250);
  const shift = await page.evaluate(() => {
    const readings: unknown = Reflect.get(window, "todoTestShifts");
    if (!Array.isArray(readings) || !readings.every((value) => typeof value === "number")) {
      throw new Error("Layout shift readings were unavailable.");
    }
    return readings.reduce((sum, value) => sum + value, 0);
  });
  expect(shift).toBeLessThanOrEqual(0.01);
});
