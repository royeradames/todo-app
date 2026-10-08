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
  await expect(page.getByLabel("Create a new todo")).toBeFocused();
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
