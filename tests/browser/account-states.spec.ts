import { test, expect, type Page } from "@playwright/test";

// The local server's issuer and database point at closed ports (see
// playwright.config.ts), so these checks cover the unavailable states.
async function fitsAt400(page: Page) {
  await page.setViewportSize({ width: 400, height: 860 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  const smallest = await page.evaluate(() =>
    Math.min(
      ...[...document.querySelectorAll("main *")]
        .filter((element) => element.textContent?.trim() && element.children.length === 0)
        .map((element) => parseFloat(getComputedStyle(element).fontSize)),
    ),
  );
  expect(smallest).toBeGreaterThanOrEqual(16);
}

test("an unreachable issuer keeps sign-in usable and says so", async ({ page }) => {
  await page.goto("/login?returnTo=%2Ftodos");
  await fitsAt400(page);
  const button = page.getByRole("button", { name: "Continue with Breakthrough account" });
  await button.click();
  await expect(page.locator("main [role=alert]")).toHaveText(
    "Sign-in is temporarily unavailable. Please try again in a moment.",
  );
  // Busy, not disabled: the button returns and can be pressed again.
  await expect(button).toBeEnabled();
  await expect(button).not.toHaveAttribute("aria-busy", "true");
  await button.focus();
  await expect(button).toBeFocused();
  await page.screenshot({ path: ".test-state/login-unavailable-400.png", fullPage: true });
});

test("a callback the store cannot complete shows the sign-in page, not raw JSON", async ({ page }) => {
  const response = await page.goto("/api/auth/federation/callback?state=forged&code=forged");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/login\?error=unavailable$/);
  await expect(page.locator("main [role=alert]")).toHaveText(
    "Your account could not be reached. Please try again in a moment.",
  );
  await expect(page.locator("body")).not.toContainText("{");
  await fitsAt400(page);
});

test("a crafted return path cannot leave the app", async ({ page }) => {
  await page.goto("/login?returnTo=%2F.%2F%2Fevil.example");
  const start = page.waitForRequest("**/api/auth/federation/start");
  await page.getByRole("button", { name: "Continue with Breakthrough account" }).click();
  // The client only sends same-origin paths; anything else becomes /todos.
  expect((await start).postDataJSON()).toEqual({ returnPath: "/todos" });
});

test("protected pages show a retry page when accounts cannot be checked", async ({ page }) => {
  for (const path of ["/todos", "/account"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "This page is temporarily unavailable." })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("{");
    const retry = page.getByRole("button", { name: "Try again" });
    await retry.click();
    // Busy, not disabled, while the segment re-renders.
    await expect(page.getByRole("button", { name: /Try again|Trying again/ })).toBeEnabled();
    await expect(page.getByRole("heading", { name: "This page is temporarily unavailable." })).toBeVisible();
  }
  await fitsAt400(page);
});
