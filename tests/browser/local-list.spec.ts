import { test, expect } from "@playwright/test";

// This dev server has account settings (pointing at closed ports), so the
// browser list offers sign-in instead of saying accounts are coming soon.
test("the browser list offers sign-in when accounts exist, and fits a 320px screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 860 });
  await page.goto("/");
  await expect(
    page.getByText("Your tasks are saved in this browser.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/coming soon/)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("n");
  await expect(page.getByLabel("New task")).toBeFocused();
  await page.locator("h1").click();
  await page.keyboard.press("?");
  await expect(
    page.getByText("Press N to create a task.", { exact: false }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByText("Press N to create a task.", { exact: false }),
  ).toHaveCount(0);
  await page.screenshot({ path: ".test-state/todo-local-320.png", fullPage: true });
  await page
    .getByRole("link", { name: "Sign in to keep your tasks on every device" })
    .click();
  await expect(page).toHaveURL(/\/login\?returnTo=%2Ftodos$/);
  await expect(
    page.getByRole("button", { name: "Continue with Breakthrough account" }),
  ).toBeVisible();
});

// The theme button sits on the header gradient, so its keyboard focus ring
// must reach 3:1 against every gradient stop in both themes (WCAG 1.4.11).
test("the theme button's focus ring stands out on the header gradient in both themes", async ({
  page,
}) => {
  await page.goto("/");
  // The example tasks render on the client, so the toggle is live by then.
  await expect(page.getByText("Water the plants", { exact: true })).toBeVisible();
  const toggle = page.getByRole("button", { name: "Toggle light and dark theme" });
  const theme = () =>
    page.evaluate(() => document.documentElement.dataset.theme ?? "light");
  const ringContrast = () =>
    toggle.evaluate((element) => {
      const channel = (value: number) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const luminance = ([r, g, b]: number[]) =>
        0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      const ring = getComputedStyle(element).outlineColor.match(/\d+/g)!.map(Number);
      const hero = getComputedStyle(document.documentElement).getPropertyValue("--hero");
      const stops = [...hero.matchAll(/#([0-9a-f]{6})/gi)].map((m) =>
        [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)),
      );
      if (!element.matches(":focus-visible") || stops.length === 0) return 0;
      return Math.min(
        ...stops.map((stop) => {
          const [a, b] = [luminance(ring), luminance(stop)].sort((x, y) => y - x);
          return (a + 0.05) / (b + 0.05);
        }),
      );
    });
  // Focused without a pointer and switched with the keyboard, so the ring
  // stays visible for both themes.
  await toggle.focus();
  const first = await theme();
  expect(await ringContrast(), `focus ring contrast, ${first} theme`).toBeGreaterThanOrEqual(3);
  await page.keyboard.press("Enter");
  await expect.poll(theme).not.toBe(first);
  const second = await theme();
  expect(await ringContrast(), `focus ring contrast, ${second} theme`).toBeGreaterThanOrEqual(3);
});
