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

// Found while reviewing the README, October 13, 2026: the light-theme footer
// links were #2f6ee8 on #fafafa, about 4.46:1, just under WCAG AA 4.5:1.
test("the footer links reach 4.5:1 in the light theme", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const links = page.locator("footer a");
  await expect(links.first()).toBeVisible();
  const ratios = await links.evaluateAll((elements) => {
    const rgb = (value: string) => value.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number);
    const luminance = (value: string) => {
      const [r, g, b] = rgb(value).map((channel) => {
        const c = channel / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const page = getComputedStyle(document.body).backgroundColor;
    return elements.map((element) => {
      const [a, b] = [luminance(getComputedStyle(element).color), luminance(page)].sort((x, y) => y - x);
      return (a + 0.05) / (b + 0.05);
    });
  });
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
});
