import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

async function createPerson(page: Page) {
  const id = randomUUID().replaceAll("-", "");
  const email = `todo-${id}@example.test`;
  const password = `${randomUUID()} synthetic Todo password`;
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: { origin: "http://localhost:4325" },
        data: {
          name: "Synthetic Todo Person",
          email,
          password,
          username: `todo${id.slice(0, 16)}`,
        },
      })
    ).status(),
  ).toBe(200);
  const mailbox: Array<{ kind: string; recipient: string; url: string }> =
    await (await page.request.get("/api/test-mail")).json();
  const message = mailbox.find(
    (item) => item.kind === "verification" && item.recipient === email,
  );
  expect(Boolean(message)).toBe(true);
  if (!message) throw new Error("Synthetic verification message missing");
  expect((await page.request.get(message.url)).ok()).toBe(true);
  expect(
    (
      await page.request.post("/api/auth/sign-in/email", {
        headers: { origin: "http://localhost:4325" },
        data: { email, password },
      })
    ).status(),
  ).toBe(200);
  return { email, password };
}
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

test("saved tasks persist, enforce ownership, refresh conflicts and fail offline without losing input", async ({
  page,
  context,
  browser,
}) => {
  await createPerson(page);
  await page.goto("/todos");
  await expect(
    page.getByText("Your list is clear. Add a task above."),
  ).toBeVisible();
  await add(page, "Synthetic private task");
  await page.reload();
  await expect(
    page.getByText("Synthetic private task", { exact: true }),
  ).toBeVisible();
  const current = await (await page.request.get("/api/todos")).json();
  const otherContext = await browser.newContext({
    baseURL: "http://localhost:4325",
  });
  try {
    const other = await otherContext.newPage();
    const otherIdentity = await createPerson(other);
    await other.goto("/todos");
    const otherList = await (await other.request.get("/api/todos")).json();
    await expect(
      other.getByText("Synthetic private task", { exact: true }),
    ).toHaveCount(0);
    const foreign = await other.request.post("/api/todos", {
      headers: {
        origin: "http://localhost:4325",
        "x-todo-account": otherList.ownerId,
      },
      data: {
        version: 0,
        command: { kind: "remove", id: current.items[0].id },
      },
    });
    expect(foreign.status()).toBe(400);
    expect(
      (
        await page.request.post("/api/todos", {
          headers: {
            origin: "https://untrusted.example",
            "x-todo-account": current.ownerId,
          },
          data: {
            version: current.version,
            command: { kind: "clear-completed" },
          },
        })
      ).status(),
    ).toBe(403);
    const newer = await page.request.post("/api/todos", {
      headers: {
        origin: "http://localhost:4325",
        "x-todo-account": current.ownerId,
      },
      data: {
        version: current.version,
        command: { kind: "add", title: "Synthetic other tab" },
      },
    });
    expect(newer.status()).toBe(200);
    await page
      .getByRole("checkbox", { name: "Synthetic private task", exact: true })
      .click();
    await expect(
      page.getByText("Your list changed in another tab.", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText("Synthetic other tab", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", {
        name: "Synthetic private task",
        exact: true,
      }),
    ).not.toBeChecked();
    await context.setOffline(true);
    await page.getByLabel("Create a new todo").fill("Unsaved offline task");
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    // Next.js also renders an empty route announcer with role="alert".
    await expect(
      page.locator('[role="alert"]:not(#__next-route-announcer__)'),
    ).toBeVisible();
    await expect(page.getByLabel("Create a new todo")).toHaveValue(
      "Unsaved offline task",
    );
    await context.setOffline(false);
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await expect(
      page.getByText("Unsaved offline task", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Create a new todo").fill("Stale account task");
    expect(
      (
        await page.request.post("/api/auth/sign-in/email", {
        headers: { origin: "http://localhost:4325" },
          data: otherIdentity,
        })
      ).status(),
    ).toBe(200);
    const currentVersion = await (await page.request.get("/api/todos")).json();
    const stale = await page.request.post("/api/todos", {
      headers: {
        origin: "http://localhost:4325",
        "x-todo-account": current.ownerId,
      },
      data: {
        version: currentVersion.version,
        command: { kind: "add", title: "Stale account task" },
      },
    });
    expect(stale.status()).toBe(401);
    expect(
      (await (await page.request.get("/api/todos")).json()).items,
    ).toHaveLength(0);
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Your list is hidden." }),
    ).toBeVisible();
    await expect(
      page.getByText("Synthetic private task", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Retry sign out", exact: true })
      .click();
    await expect(page).toHaveURL(/\/login/);
    expect((await page.request.get("/api/todos")).status()).toBe(401);
    await page.goBack();
    await expect(
      page.getByText("Synthetic private task", { exact: true }),
    ).toHaveCount(0);
  } finally {
    await context.setOffline(false);
    await otherContext.close();
  }
});

test("an unresolved save never prevents hiding the list and signing out", async ({
  page,
}) => {
  await createPerson(page);
  await page.goto("/todos");
  await expect(
    page.getByText("Your list is clear. Add a task above."),
  ).toBeVisible();
  let release = () => {};
  let sawSave = () => {};
  const stoppedSave = new Promise<void>((resolve) => {
    release = resolve;
  });
  const saveStarted = new Promise<void>((resolve) => {
    sawSave = resolve;
  });
  await page.route("**/api/todos", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    sawSave();
    await stoppedSave;
    await route.abort().catch(() => {});
  });
  try {
    await page
      .getByLabel("Create a new todo")
      .fill("Unacknowledged synthetic task");
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await saveStarted;
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    expect((await page.request.get("/api/todos")).status()).toBe(401);
  } finally {
    release();
    await page.unroute("**/api/todos");
  }
});
