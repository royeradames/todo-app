import { test, expect, type Page } from "@playwright/test";

// The production build: my Frontend Mentor solution, a list kept only in this
// browser. Sign-in and saved lists live in the private suite app.

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function add(page: Page, title: string) {
  await page.getByLabel("Create a new todo").fill(title);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await expect(page.getByLabel("Create a new todo")).toHaveValue("");
}

const titles = (page: Page) => page.locator(".tasks li .task-title").allTextContents();

test("the solution serves no sign-in pages or account APIs", async ({ request }) => {
  for (const path of ["/login", "/todos", "/account", "/api/todos", "/api/auth/get-session"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(404);
    expect(response.headers()["set-cookie"]).toBeUndefined();
  }
});

test("people can keep a whole list in this browser", async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByText("Your tasks are saved in this browser only.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /sign in/i })).toHaveCount(0);
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
    "content",
    "Todo",
  );

  await test.step("an empty task explains itself and keeps focus", async () => {
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await expect(page.locator("main [role=alert]")).toHaveText("Enter a task first.");
    await expect(page.getByLabel("Create a new todo")).toBeFocused();
  });

  await test.step("add, complete, filter, delete and clear", async () => {
    await add(page, "Synthetic first task");
    await page.getByLabel("Create a new todo").fill("Synthetic second task");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Synthetic second task", { exact: true })).toBeVisible();
    await expect(page.locator("main [role=alert]")).toHaveCount(0);
    await expect(page.getByText("7 items left", { exact: true })).toBeVisible();

    await page.getByRole("checkbox", { name: "Synthetic first task" }).check();
    await expect(page.getByText("6 items left", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Active", exact: true }).click();
    await expect(page.getByText("Synthetic first task", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Completed", exact: true }).click();
    expect(await titles(page)).toEqual([
      "Complete online JavaScript course",
      "Synthetic first task",
    ]);
    await page.getByRole("button", { name: "All", exact: true }).click();

    await page
      .getByRole("button", { name: "Delete Synthetic second task", exact: true })
      .click();
    await expect(page.getByText("Synthetic second task", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Clear Completed", exact: true }).click();
    await expect(page.getByText("Synthetic first task", { exact: true })).toHaveCount(0);
    await expect(
      page.getByText("Complete online JavaScript course", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("5 items left", { exact: true })).toBeVisible();
  });

  await test.step("drag a task into a new place with the mouse", async () => {
    const source = page.locator(".tasks li", { hasText: "Pick up groceries" });
    const target = page.locator(".tasks li", { hasText: "Jog around the park 3x" });
    const from = (await source.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + 8, { steps: 8 });
    await page.mouse.up();
    expect(await titles(page)).toEqual([
      "Pick up groceries",
      "Jog around the park 3x",
      "10 minutes meditation",
      "Read for 1 hour",
      "Complete Todo App on Frontend Mentor",
    ]);
  });

  await test.step("move a task with the keyboard and keep focus on it", async () => {
    const box = page.getByRole("checkbox", { name: "Read for 1 hour" });
    await box.focus();
    await page.keyboard.press("Alt+ArrowUp");
    await page.keyboard.press("Alt+ArrowUp");
    expect((await titles(page)).indexOf("Read for 1 hour")).toBe(1);
    await expect(box).toBeFocused();
    await expect(page.getByRole("status").filter({ hasText: "Moved" })).toHaveText(
      "Moved Read for 1 hour to position 2 of 5.",
    );
  });

  await test.step("move a task with buttons instead of dragging", async () => {
    await page.getByRole("button", { name: "Reorder with buttons" }).click();
    const down = page.getByRole("button", {
      name: "Move Pick up groceries down",
      exact: true,
    });
    await down.click();
    expect((await titles(page)).indexOf("Pick up groceries")).toBe(1);
    await expect(down).toBeFocused();
  });

  await test.step("the list and theme survive a reload", async () => {
    const order = await titles(page);
    await page.getByRole("button", { name: "Dark theme", exact: true }).click();
    const theme = await page.locator("html").getAttribute("data-theme");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme!);
    await expect.poll(() => titles(page)).toEqual(order);
    await expect(page.getByText("5 items left", { exact: true })).toBeVisible();
  });

  await test.step("one task left reads in the singular", async () => {
    for (const title of await titles(page)) {
      if (title === "Read for 1 hour") continue;
      await page.getByRole("checkbox", { name: title, exact: true }).check();
    }
    await expect(page.getByText("1 item left", { exact: true })).toBeVisible();
  });
  expect(errors).toEqual([]);
});
