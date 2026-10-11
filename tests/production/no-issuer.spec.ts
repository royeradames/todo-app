import { test, expect, type Page } from "@playwright/test";

// The production build with no issuer, client registration or database:
// what Vercel Production serves until a production issuer exists.

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function add(page: Page, title: string) {
  await page.getByLabel("New task").fill(title);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await expect(page.getByLabel("New task")).toHaveValue("");
}

const titles = (page: Page) => page.locator(".tasks li .task-title").allTextContents();

test("account routes never fail without an issuer; they say accounts are coming soon", async ({
  page,
  request,
}) => {
  const errors = watchErrors(page);
  for (const path of ["/todos", "/account"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(response.headers().location).toBe(
      `/login?returnTo=${encodeURIComponent(path)}`,
    );
    expect(response.headers()["set-cookie"]).toBeUndefined();
  }
  for (const path of ["/", "/login", "/login?returnTo=%2Ftodos", "/todos", "/account"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    expect(response?.headers()["set-cookie"]).toBeUndefined();
  }
  // Signed-out people reach the explanation, never a private page or an error.
  await expect(page).toHaveURL(/\/login\?returnTo=%2Faccount$/);
  await expect(
    page.getByRole("heading", { name: "Accounts are coming soon." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Breakthrough/ })).toHaveCount(0);
  await page.getByRole("link", { name: "Open your tasks" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel("New task")).toBeVisible();

  for (const [method, path] of [
    ["GET", "/api/todos"],
    ["POST", "/api/todos"],
    ["GET", "/api/auth/get-session"],
    ["POST", "/api/auth/federation/start"],
  ] as const) {
    const response = await request.fetch(path, {
      method,
      data: method === "POST" ? {} : undefined,
      maxRedirects: 0,
    });
    expect(response.status(), `${method} ${path}`).toBe(404);
    expect((await response.json()).error).toMatch(/coming soon/);
    expect(response.headers()["set-cookie"]).toBeUndefined();
  }
  const callback = await request.get(
    "/api/auth/federation/callback?state=x&code=y",
    { maxRedirects: 0 },
  );
  expect(callback.status()).toBe(303);
  expect(new URL(callback.headers().location).pathname).toBe("/login");
  expect(errors).toEqual([]);
});

test("signed-out people can keep a whole list in this browser", async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByText(
      "Accounts are coming soon. Your tasks are saved in this browser only.",
    ),
  ).toBeVisible();
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
    "content",
    "Todo",
  );

  await test.step("an empty task explains itself and keeps focus", async () => {
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await expect(page.locator("main [role=alert]")).toHaveText("Enter a task first.");
    await expect(page.getByLabel("New task")).toBeFocused();
  });

  await test.step("add, complete, filter, delete and clear", async () => {
    await add(page, "Synthetic first task");
    await page.getByLabel("New task").fill("Synthetic second task");
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
      "Water the plants",
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
      page.getByText("Water the plants", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("5 items left", { exact: true })).toBeVisible();
  });

  await test.step("drag a task into a new place with the mouse", async () => {
    const source = page.locator(".tasks li", { hasText: "Buy coffee beans" });
    const target = page.locator(".tasks li", { hasText: "Back up the phone photos" });
    const from = (await source.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + 8, { steps: 8 });
    await page.mouse.up();
    expect(await titles(page)).toEqual([
      "Buy coffee beans",
      "Back up the phone photos",
      "Book a haircut",
      "Pay the electricity bill",
      "Drag a task to change the order",
    ]);
  });

  await test.step("move a task with the keyboard and keep focus on it", async () => {
    const box = page.getByRole("checkbox", { name: "Pay the electricity bill" });
    await box.focus();
    await page.keyboard.press("Alt+ArrowUp");
    await page.keyboard.press("Alt+ArrowUp");
    expect((await titles(page)).indexOf("Pay the electricity bill")).toBe(1);
    await expect(box).toBeFocused();
    await expect(page.getByRole("status").filter({ hasText: "Moved" })).toHaveText(
      "Moved Pay the electricity bill to position 2 of 5.",
    );
  });

  await test.step("move a task with buttons instead of dragging", async () => {
    await page.getByRole("button", { name: "Reorder with buttons" }).click();
    const down = page.getByRole("button", {
      name: "Move Buy coffee beans down",
      exact: true,
    });
    await down.click();
    expect((await titles(page)).indexOf("Buy coffee beans")).toBe(1);
    await expect(down).toBeFocused();
  });

  await test.step("the list and theme survive a reload", async () => {
    const order = await titles(page);
    await page.getByRole("button", { name: "Toggle light and dark theme" }).click();
    const theme = await page.locator("html").getAttribute("data-theme");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme!);
    await expect.poll(() => titles(page)).toEqual(order);
    await expect(page.getByText("5 items left", { exact: true })).toBeVisible();
  });

  await test.step("one task left reads in the singular", async () => {
    for (const title of await titles(page)) {
      if (title === "Pay the electricity bill") continue;
      await page.getByRole("checkbox", { name: title, exact: true }).check();
    }
    await expect(page.getByText("1 item left", { exact: true })).toBeVisible();
  });
  expect(errors).toEqual([]);
});
