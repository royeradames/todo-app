import { test, expect } from "@playwright/test";
import { z } from "zod";
import { accountsOrigin, todoOrigin } from "./hosted-env";
import { add, createCentralAccount, nameIssuerRateLimit, newPage, person, removeCreatedAccounts, signInToTodo, waitForHydrated } from "./accounts";

test.describe.configure({ mode: "serial" });
test.afterEach(({}, testInfo) => nameIssuerRateLimit(testInfo));
test.afterAll(removeCreatedAccounts);

test("a Breakthrough account signs in to Todo, keeps a private list and signs out", async ({
  browser,
}) => {
  const owner = person("a");
  const other = person("b");
  const page = await newPage(browser);
  await createCentralAccount(page, owner);
  await signInToTodo(page, owner);
  await expect(page.getByText("Your list is clear. Add a task above.")).toBeVisible();
  // Signed-in people never see the sign-in page.
  await page.goto(todoOrigin + "/login?returnTo=%2Faccount");
  await expect(page).toHaveURL(todoOrigin + "/account");
  await page.goto(todoOrigin + "/todos");
  await page.screenshot({ path: "test-results-hosted/todos-empty-1440.png" });
  await add(page, "Synthetic central task");
  await page.reload();
  await expect(page.getByText("Synthetic central task", { exact: true })).toBeVisible();
  await expect(page.getByText("1 item left", { exact: true })).toBeVisible();
  for (const [width, height] of [[400, 860], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      "No horizontal overflow at " + width,
    ).toBe(true);
    await page.screenshot({ path: `test-results-hosted/todos-saved-${width}.png`, fullPage: true });
  }
  const mine = z
    .object({ ownerId: z.string(), version: z.number(), items: z.array(z.object({ id: z.string() })) })
    .parse(await (await page.request.get(todoOrigin + "/api/todos")).json());
  expect(mine.items).toHaveLength(1);
  const firstTaskId = mine.items[0].id;

  await test.step("another account sees an empty list and cannot touch this one", async () => {
    const otherPage = await newPage(browser);
    await createCentralAccount(otherPage, other);
    await signInToTodo(otherPage, other);
    await expect(otherPage.getByText("Synthetic central task", { exact: true })).toHaveCount(0);
    const theirs = z
      .object({ ownerId: z.string() })
      .parse(await (await otherPage.request.get(todoOrigin + "/api/todos")).json());
    expect(theirs.ownerId).not.toBe(mine.ownerId);
    const foreign = await otherPage.request.post(todoOrigin + "/api/todos", {
      headers: { origin: todoOrigin, "x-todo-account": theirs.ownerId },
      data: { version: 0, command: { kind: "remove", id: firstTaskId } },
    });
    expect(foreign.status()).toBe(400);
    await otherPage.context().close();
  });

  await test.step("a stale tab gets a 409 and refreshes to the saved list", async () => {
    const stale = await page.context().newPage();
    await stale.goto(todoOrigin + "/todos");
    await expect(stale.getByText("Synthetic central task", { exact: true })).toBeVisible();
    await add(page, "Saved from the first tab");
    await (await waitForHydrated(stale.getByLabel("Create a new todo"))).fill("Saved from the stale tab");
    await stale.getByRole("button", { name: "Add task", exact: true }).click();
    // The stale write is refused and the list reloads with the other tab's task.
    await expect(stale.getByText("Saved from the first tab", { exact: true })).toBeVisible();
    await expect(stale.getByText("Saved from the stale tab", { exact: true })).toHaveCount(0);
    await stale.close();
  });

  const untrusted = await page.request.post(todoOrigin + "/api/todos", {
    headers: { origin: "https://untrusted.example", "x-todo-account": mine.ownerId },
    data: { version: mine.version, command: { kind: "clear-completed" } },
  });
  expect(untrusted.status()).toBe(403);

  await test.step("account page links to the central account", async () => {
    await page.goto(todoOrigin + "/account");
    await expect(page.getByRole("heading", { name: "Welcome, " + owner.name + "." })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Manage your Breakthrough account" }),
    ).toHaveAttribute("href", accountsOrigin + "/account");
    await page.screenshot({ path: "test-results-hosted/account-1440.png", fullPage: true });
  });

  await test.step("sign-in and account pages fit 400px", async () => {
    await page.setViewportSize({ width: 400, height: 860 });
    for (const path of ["/account", "/login"]) {
      await page.goto(todoOrigin + path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
      await page.screenshot({ path: `test-results-hosted/${path.slice(1)}-400.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(todoOrigin + "/account");
  });

  await test.step("an expired callback shows the sign-in page, not raw JSON", async () => {
    // Signed in, a stale callback leaves the person signed in on their list.
    const same = await page.context().newPage();
    await same.goto(todoOrigin + "/api/auth/federation/callback?state=expired&code=expired");
    await expect(same).toHaveURL(todoOrigin + "/todos");
    await same.close();
    // Signed out, it explains itself on the sign-in page.
    const other = await newPage(browser);
    await other.goto(todoOrigin + "/api/auth/federation/callback?state=expired&code=expired");
    await expect(other).toHaveURL(todoOrigin + "/login?error=expired");
    await expect(other.locator("main [role=alert]")).toHaveText(
      "That sign-in expired or could not be verified. Please start again.",
    );
    await other.context().close();
  });

  await test.step("signing out in another tab hides this tab's list", async () => {
    const listTab = await page.context().newPage();
    await listTab.goto(todoOrigin + "/todos");
    await expect(listTab.getByText("Synthetic central task", { exact: true })).toBeVisible();
    const response = await page.request.post(todoOrigin + "/api/auth/sign-out", {
      headers: { origin: todoOrigin }, data: {},
    });
    expect(response.ok()).toBe(true);
    await (await waitForHydrated(listTab.getByLabel("Create a new todo"))).fill("Never saved");
    await listTab.getByRole("button", { name: "Add task", exact: true }).click();
    await expect(listTab.getByRole("heading", { name: "Your list is hidden." })).toBeVisible();
    await expect(listTab.getByRole("link", { name: "Open your current list" })).toBeVisible();
    await expect(listTab.getByRole("button", { name: /sign out/i })).toHaveCount(0);
    await listTab.close();
    // Back in through the still-live central session.
    await page.goto(todoOrigin + "/todos");
    await (await waitForHydrated(page.getByRole("button", { name: "Continue with Breakthrough account" }))).click();
    await expect(page).toHaveURL(todoOrigin + "/todos");
    await page.goto(todoOrigin + "/account");
  });

  await test.step("signing out of Todo keeps the central session for a one-click return", async () => {
    await (await waitForHydrated(page.getByRole("button", { name: "Sign out of Todo" }))).click();
    await expect(page).toHaveURL(/\/login/);
    expect((await page.request.get(todoOrigin + "/api/todos")).status()).toBe(401);
    await page.goto(todoOrigin + "/todos");
    await (await waitForHydrated(page.getByRole("button", { name: "Continue with Breakthrough account" }))).click();
    await expect(page).toHaveURL(todoOrigin + "/todos");
    await expect(page.getByText("Synthetic central task", { exact: true })).toBeVisible();
  });

  await test.step("a callback that arrives twice lands on the list, not the expired page", async () => {
    // Hosted run 37779582609: a doubled callback turned a good sign-in into "expired".
    // The issuer answers the authorize request with a redirect to Todo's callback. Routes don't
    // see redirect hops, so the test takes that redirect itself, sends the callback twice at once
    // with this browser's cookies, and lets the browser follow the second answer.
    await page.goto(todoOrigin + "/account");
    await (await waitForHydrated(page.getByRole("button", { name: "Sign out of Todo" }))).click();
    await expect(page).toHaveURL(/\/login/);
    const authorize = (url: URL) => url.origin === accountsOrigin && url.pathname.endsWith("/oauth2/authorize");
    const landed: string[] = [];
    await page.context().route(authorize, async (route) => {
      const issued = await route.fetch({ maxRedirects: 0 });
      const callback = new URL(issued.headers().location ?? "", route.request().url());
      if (callback.origin !== todoOrigin) return route.fulfill({ response: issued });
      const twice = await Promise.all([1, 2].map(() =>
        route.fetch({ url: callback.href, method: "GET", headers: {}, maxRedirects: 0 })));
      const targets = twice.map((reply) => new URL(reply.headers().location ?? "/missing", todoOrigin));
      landed.push(...targets.map((target) => target.pathname + target.search));
      await route.fulfill({ status: 302, headers: { location: targets[1].href } });
    });
    try {
      await page.goto(todoOrigin + "/todos");
      await (await waitForHydrated(page.getByRole("button", { name: "Continue with Breakthrough account" }))).click();
      await expect(page).toHaveURL(todoOrigin + "/todos");
      await expect(page.getByText("Synthetic central task", { exact: true })).toBeVisible();
      expect(landed, "both copies land on the list").toEqual(["/todos", "/todos"]);
    } finally {
      await page.context().unroute(authorize);
    }
  });

  await test.step("central sign-out ends the Todo session on its next read", async () => {
    const response = await page.request.post(accountsOrigin + "/api/auth/sign-out", {
      headers: { origin: accountsOrigin },
      data: {},
    });
    expect(response.ok()).toBe(true);
    expect((await page.request.get(todoOrigin + "/api/todos")).status()).toBe(401);
  });
  await page.context().close();
});
