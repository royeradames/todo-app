import { test, expect, type Browser, type Page } from "@playwright/test";
import jsQR from "jsqr";
import * as OTPAuth from "otpauth";
import { PNG } from "pngjs";
import { accountsOrigin, todoOrigin } from "./hosted-env";
import {
  add,
  continueToIssuer,
  handoff,
  fillSignUp,
  mailMark,
  newPage,
  openVerification,
  passwordOnIssuer,
  person,
  readMail,
  removeCreatedAccounts,
  sixDigitCode,
  type Person,
} from "./accounts";

// Every way into Todo, clicked from its own pages against the deployed
// previews: sign-up, sign-out, and each sign-in option the Breakthrough
// account offers. One synthetic account per run; it is removed afterwards.
test.describe.configure({ mode: "serial" });
test.afterAll(removeCreatedAccounts);

const task = "Synthetic journey task";
let member: Person;
// The first browser: it signs up, later holds the passkey and approves other devices.
let home: Page;

async function signedInToList(page: Page) {
  await expect(page).toHaveURL(todoOrigin + "/todos", handoff);
  await expect(page.getByText(task, { exact: true })).toBeVisible();
}
/** A fresh browser that has never signed in, opened at Todo's saved list. */
async function freshAtSignIn(browser: Browser) {
  const page = await newPage(browser);
  await page.goto(todoOrigin + "/todos");
  await expect(page).toHaveURL(todoOrigin + "/login?returnTo=%2Ftodos");
  await continueToIssuer(page);
  return page;
}
async function issuerSignOut(page: Page) {
  await page.goto(accountsOrigin + "/account");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL((url) => url.origin === accountsOrigin && url.pathname === "/login");
}
/** Decodes the rendered approval QR from pixels, as a phone camera would. */
async function scanApprovalQr(page: Page, visibleCode: string) {
  const image = page.getByRole("img", { name: "Open device approval with the public request code" });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0))
    .toBe(true);
  const png = PNG.sync.read(await image.screenshot());
  const pixels = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.byteLength);
  const decoded = jsQR(pixels, png.width, png.height);
  if (!decoded) throw new Error("The rendered approval QR code could not be scanned");
  const link = new URL(decoded.data);
  expect(link.origin).toBe(accountsOrigin);
  expect(link.pathname).toBe("/approve");
  expect(link.searchParams.get("code")).toBe(visibleCode);
  return link.href;
}

test("sign up: a new visitor creates a Breakthrough account from Todo's home page", async ({ browser }) => {
  member = person("j");
  home = await newPage(browser);
  await home.goto(todoOrigin + "/");
  await home.getByRole("link", { name: "Sign in to keep your tasks on every device" }).click();
  await expect(home).toHaveURL(todoOrigin + "/login?returnTo=%2Ftodos");
  await home.screenshot({ path: "test-results-hosted/journey-todo-login-1440.png", fullPage: true });

  await test.step("the sign-in button shows it is busy and stays pressable", async () => {
    // Watch the real request rather than delay it: the button reports each
    // busy moment before the browser leaves for the account page.
    const busy: Array<{ text: string; disabled: boolean }> = [];
    await home.exposeFunction("reportSignInBusy", (state: { text: string; disabled: boolean }) => busy.push(state));
    await home.getByRole("button", { name: "Continue with Breakthrough account" }).evaluate((button: HTMLButtonElement) => {
      const report = (window as unknown as { reportSignInBusy: (state: { text: string; disabled: boolean }) => void }).reportSignInBusy;
      new MutationObserver(() => {
        if (button.getAttribute("aria-busy") === "true") report({ text: button.textContent ?? "", disabled: button.disabled });
      }).observe(button, { attributes: true, childList: true, subtree: true, characterData: true });
    });
    await continueToIssuer(home);
    expect(busy.length, "The button showed a busy state").toBeGreaterThan(0);
    expect(busy[0]).toEqual({ text: "Opening your account…", disabled: false });
  });

  await expect(home.getByRole("tablist", { name: "Sign-in method" })).toBeVisible();
  await home.screenshot({ path: "test-results-hosted/journey-issuer-login-1440.png", fullPage: true });
  await home.getByRole("link", { name: "Create an account" }).click();
  await expect(home).toHaveURL((url) => url.origin === accountsOrigin && url.pathname === "/create-account");
  await fillSignUp(home, member);
  await openVerification(home, member);
  await home.getByRole("link", { name: "Continue to sign in" }).click();
  await expect(home).toHaveURL((url) => url.origin === accountsOrigin && url.pathname === "/login");
  await passwordOnIssuer(home, member);
  await expect(home).toHaveURL(todoOrigin + "/todos", handoff);
  await expect(home.getByText("Your list is clear. Add a task above.")).toBeVisible();
  await add(home, task);
  await home.screenshot({ path: "test-results-hosted/journey-saved-list-1440.png", fullPage: true });
});

test("log out: signing out of Todo keeps the account; signing out of the account ends Todo too", async () => {
  await home.goto(todoOrigin + "/account");
  await home.getByRole("button", { name: "Sign out of Todo" }).click();
  await expect(home).toHaveURL(/\/login/);
  expect((await home.request.get(todoOrigin + "/api/todos")).status()).toBe(401);
  // The Breakthrough account is still signed in, so returning takes one press.
  await home.goto(todoOrigin + "/todos");
  await home.getByRole("button", { name: "Continue with Breakthrough account" }).click();
  await signedInToList(home);

  await home.goto(todoOrigin + "/account");
  await home.getByRole("link", { name: "Manage your Breakthrough account" }).click();
  await expect(home).toHaveURL(accountsOrigin + "/account");
  await home.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(home).toHaveURL((url) => url.origin === accountsOrigin && url.pathname === "/login");
  // Todo re-checks the account on its next read, so the list is closed too.
  await home.goto(todoOrigin + "/todos");
  await expect(home).toHaveURL(todoOrigin + "/login?returnTo=%2Ftodos");
  expect((await home.request.get(todoOrigin + "/api/todos")).status()).toBe(401);
});

test("log in with a password from a new browser", async ({ browser }) => {
  const page = await freshAtSignIn(browser);
  // This browser is new to the account, so the issuer also emails a code.
  expect(await passwordOnIssuer(page, member)).toBe("/verify-device");
  await signedInToList(page);
  await page.context().close();
});

test("log in with an emailed sign-in code", async ({ browser }) => {
  const page = await freshAtSignIn(browser);
  await page.getByRole("tab", { name: "Email code", exact: true }).click();
  await page.getByLabel("Account email", { exact: true }).fill(member.email);
  const seen = await mailMark(member.email);
  await page.getByRole("button", { name: "Send sign-in code", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email.", exact: true })).toBeVisible();
  const code = sixDigitCode(await readMail(member.email, "Your Breakthrough account sign-in code", seen));
  await page.getByLabel("Email sign-in code", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
  await signedInToList(page);
  await page.context().close();
});

test("log in with a passkey", async () => {
  // Enroll a passkey on the account, from the browser that signed up.
  await home.goto(accountsOrigin + "/login");
  await passwordOnIssuer(home, member);
  await expect(home).toHaveURL(accountsOrigin + "/account");
  const cdp = await home.context().newCDPSession(home);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2", transport: "internal", hasResidentKey: true,
      hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true,
    },
  });
  await home.getByRole("button", { name: "Add a passkey" }).click();
  await expect(home.getByText("Your passkey is ready to use.")).toBeVisible();
  await issuerSignOut(home);

  await home.goto(todoOrigin + "/todos");
  await continueToIssuer(home);
  await home.getByRole("tab", { name: "Passkey", exact: true }).click();
  await home.getByRole("button", { name: "Continue with a passkey" }).click();
  await signedInToList(home);
});

test("log in by approving the request on a signed-in phone", async ({ browser }) => {
  // `home` is signed in to the account (passkey); it plays the phone.
  const page = await freshAtSignIn(browser);
  await page.getByRole("tab", { name: "Phone approval", exact: true }).click();
  await page.getByRole("button", { name: "Create approval code" }).click();
  const code = (await page.getByTestId("device-code").innerText()).trim();
  await page.screenshot({ path: "test-results-hosted/journey-phone-approval-1440.png", fullPage: true });
  await home.goto(await scanApprovalQr(page, code));
  await home.getByRole("button", { name: "Review request" }).click();
  await expect(home.getByRole("heading", { name: "Is this your request?" })).toBeVisible();
  await home.getByLabel("Number shown on the other device").fill((await page.getByTestId("match-number").innerText()).trim());
  await home.getByRole("button", { name: "Approve sign-in" }).click();
  await expect(home.getByRole("heading", { name: "You can return to the other device." })).toBeVisible();
  await signedInToList(page);
  await page.context().close();
});

test("log in with a password and an authenticator code", async ({ browser }) => {
  await home.goto(accountsOrigin + "/account");
  await home.getByLabel("Confirm current password").fill(member.password);
  await home.getByRole("button", { name: "Set up authenticator" }).click();
  await home.getByText("Cannot scan? Show setup key").click();
  const secret = await home.getByTestId("totp-secret").innerText();
  const totp = new OTPAuth.TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) });
  const enrollment = totp.generate();
  await home.getByLabel("Authenticator setup code").fill(enrollment);
  await home.getByRole("button", { name: "Verify authenticator", exact: true }).click();
  await expect(home.getByText("Authenticator setup complete.", { exact: false })).toBeVisible();
  await home.getByRole("button", { name: "I saved my backup codes" }).click();
  await expect(home.getByText("Authenticator enabled", { exact: true })).toBeVisible();

  const page = await freshAtSignIn(browser);
  await passwordOnIssuer(page, member);
  await expect(page).toHaveURL((url) => url.origin === accountsOrigin && url.pathname === "/two-factor");
  // A code is accepted once; wait for the next one after enrollment.
  await expect.poll(() => totp.generate(), { timeout: 35_000, intervals: [250] }).not.toBe(enrollment);
  await page.getByLabel("Authenticator code", { exact: true }).fill(totp.generate());
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await signedInToList(page);
  await page.context().close();
  await home.context().close();
});
