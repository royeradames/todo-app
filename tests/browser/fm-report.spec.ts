import { test, expect } from "@playwright/test";

// Frontend Mentor solution report, October 13, 2026: the theme toggle had no
// hover state and did not say which theme is on, the heading was sized in px,
// and filter and count changes were not announced.

test("the theme toggle says which theme is on and changes on hover", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Dark theme", exact: true });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.mouse.move(0, 0);
  const rest = await toggle.evaluate((element) => getComputedStyle(element).opacity);
  await toggle.hover();
  await expect
    .poll(() => toggle.evaluate((element) => getComputedStyle(element).opacity))
    .not.toBe(rest);
});

test("the heading grows with the reader's text size", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const size = () =>
    page.locator("h1").evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  const base = await size();
  await page.addStyleTag({ content: "html { font-size: 32px !important; }" });
  expect(await size()).toBeCloseTo(base * 2, 0);
});

test("filter changes and the item count are announced", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const input = page.getByLabel("Create a new todo");
  await input.fill("Announce me");
  await input.press("Enter");
  const count = page.locator(".list-footer").getByText(/items? left/);
  await expect(count).toHaveAttribute("aria-live", "polite");
  // The number and its words are separate text nodes; read them together.
  await expect(count).toHaveAttribute("aria-atomic", "true");
  await page.locator(".filters-inline").getByRole("button", { name: "Active", exact: true }).click();
  await expect(page.locator("p.visually-hidden[role=status]")).toHaveText(/Showing active tasks/);
  await page.locator(".filters-inline").getByRole("button", { name: "Completed", exact: true }).click();
  await expect(page.locator("p.visually-hidden[role=status]")).toHaveText(/Showing completed tasks/);
});
