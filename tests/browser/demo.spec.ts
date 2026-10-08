import { test, expect, type Page } from "@playwright/test";

async function add(page: Page, title: string) {
  await page.getByLabel("Create a new todo").fill(title);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await expect(page.getByLabel("Create a new todo")).toHaveValue("");
}

test("demo supports native keyboard, filtered reorder, theme, removal and narrow screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 860 });
  await page.goto("/");
  await expect(
    page.getByText("Demo tasks. Changes stay in this tab."),
  ).toBeVisible();
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
  await add(page, "Synthetic new task");
  await page.getByRole("button", { name: "Active", exact: true }).click();
  await expect(
    page.getByText("Complete online JavaScript course", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Move Synthetic new task up", exact: true })
    .click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.locator(".task-label span").first()).toHaveText(
    "Complete online JavaScript course",
  );
  await page
    .getByRole("checkbox", { name: "Synthetic new task", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Clear completed", exact: true })
    .click();
  await expect(
    page.getByText("Synthetic new task", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Create a new todo")).toBeFocused();
  await page
    .getByRole("button", { name: "Toggle light and dark theme" })
    .click();
  const theme = await page.locator("html").getAttribute("data-theme");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    theme || "light",
  );
  await page.locator("h1").click();
  await page.keyboard.press("?");
  await expect(
    page.getByText("Press N to create a task.", { exact: false }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByText("Press N to create a task.", { exact: false }),
  ).toHaveCount(0);
  await page.screenshot({
    path: ".test-state/todo-demo-320.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  await page.screenshot({
    path: ".test-state/todo-demo-desktop-light.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await page.screenshot({
    path: ".test-state/todo-demo-desktop-dark.png",
    fullPage: true,
  });
});
