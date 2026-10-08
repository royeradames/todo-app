import { test, expect, type Browser, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { accountsOrigin, authorizePreviews, readSink, todoOrigin } from "./hosted-env";

// Synthetic Breakthrough accounts. Reserved .test recipients go to the
// issuer's preview sink, never to a real inbox. Every address starts with
// "todo-suite-" so the cleanup step can find and remove them.
const run = Date.now().toString(36) + randomBytes(3).toString("hex");
function person(label: string) {
  return {
    name: "Todo Suite " + label,
    username: "todosuite" + label + run,
    email: "todo-suite-" + label + "-" + run + "@sink.accounts-preview.test",
    password: "A synthetic Todo phrase " + randomBytes(6).toString("hex"),
  };
}
type Person = ReturnType<typeof person>;
const mailSchema = z.object({
  messages: z.array(z.object({ subject: z.string(), text: z.string() })),
});

async function newPage(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await authorizePreviews(context);
  return context.newPage();
}
async function verificationLink(email: string) {
  let link = "";
  await expect
    .poll(
      async () => {
        const response = await readSink(email);
        if (response.status !== 200) return false;
        const message = mailSchema
          .parse(await response.json())
          .messages.find((item) => item.subject === "Verify your Breakthrough account");
        link = /https:\/\/\S+/.exec(message?.text ?? "")?.[0] ?? "";
        return Boolean(link);
      },
      { message: "Waiting for the verification message", timeout: 30_000 },
    )
    .toBe(true);
  expect(new URL(link).origin, "Mail links stay on the issuer").toBe(accountsOrigin);
  return link;
}
/** Creates and verifies a central account directly on the issuer. */
async function createCentralAccount(page: Page, account: Person) {
  await page.goto(accountsOrigin + "/create-account");
  await page.getByLabel("Name", { exact: true }).fill(account.name);
  await page.getByLabel("Username", { exact: true }).fill(account.username);
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page
    .locator("input")
    .and(page.getByLabel("Password", { exact: true }))
    .fill(account.password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.goto(await verificationLink(account.email));
  await expect(page).toHaveURL(/\/login/);
}
/** Opens the saved list and signs in through the issuer's own screen. */
async function signInToTodo(page: Page, account: Person) {
  await page.goto(todoOrigin + "/todos");
  await expect(page).toHaveURL(todoOrigin + "/login?returnTo=%2Ftodos");
  await page.getByRole("button", { name: "Continue with Breakthrough account" }).click();
  await expect(page).toHaveURL((url) => url.origin === accountsOrigin && url.pathname === "/login");
  await page.getByLabel("Username or email").fill(account.username);
  await page
    .locator("input")
    .and(page.getByLabel("Password", { exact: true }))
    .fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(todoOrigin + "/todos");
}
async function add(page: Page, title: string) {
  await page.getByLabel("Create a new todo").fill(title);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("a Breakthrough account signs in to Todo, keeps a private list and signs out", async ({
  browser,
}) => {
  const owner = person("a");
  const other = person("b");
  const page = await newPage(browser);
  await createCentralAccount(page, owner);
  await signInToTodo(page, owner);
  await expect(page.getByText("Your list is clear. Add a task above.")).toBeVisible();
  await page.screenshot({ path: "test-results-hosted/todos-empty-1440.png" });
  await add(page, "Synthetic central task");
  await page.reload();
  await expect(page.getByText("Synthetic central task", { exact: true })).toBeVisible();
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
      data: { version: 0, command: { kind: "remove", id: mine.items[0].id } },
    });
    expect(foreign.status()).toBe(400);
    await otherPage.context().close();
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

  await test.step("signing out of Todo keeps the central session for a one-click return", async () => {
    await page.getByRole("button", { name: "Sign out of Todo" }).click();
    await expect(page).toHaveURL(/\/login/);
    expect((await page.request.get(todoOrigin + "/api/todos")).status()).toBe(401);
    await page.goto(todoOrigin + "/todos");
    await page.getByRole("button", { name: "Continue with Breakthrough account" }).click();
    await expect(page).toHaveURL(todoOrigin + "/todos");
    await expect(page.getByText("Synthetic central task", { exact: true })).toBeVisible();
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
