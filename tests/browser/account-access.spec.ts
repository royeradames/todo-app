import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import * as OTPAuth from "otpauth";

const password = "A synthetic Todo review phrase 7946";
async function passwordSignIn(
  page: Page,
  identifier: string,
  value = password,
) {
  await page.goto("/login?returnTo=%2Faccount");
  await page.getByLabel("Username or email").fill(identifier);
  await page
    .locator("input")
    .and(page.getByLabel("Password", { exact: true }))
    .fill(value);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
async function openLatestMail(page: Page, email: string, link: string) {
  const kind = link === "Verify account" ? "verification" : "recovery";
  const response = await page.request.get("/api/test-mail");
  expect(response.status()).toBe(200);
  const messages: Array<{ kind: string; recipient: string; url: string }> =
    await response.json();
  const message = messages.find(
    (item) => item.kind === kind && item.recipient === email,
  );
  expect(Boolean(message)).toBe(true);
  if (!message) throw new Error("Synthetic verification message missing");
  await page.goto(message.url);
}
async function startPhoneLogin(context: BrowserContext) {
  const page = await context.newPage();
  await page.goto("/login?returnTo=%2Faccount");
  await page.getByRole("tab", { name: "Phone approval" }).click();
  await page.getByRole("button", { name: "Create approval code" }).click();
  const code = page.getByTestId("device-code");
  await expect(code).toBeVisible();
  return { page, code: (await code.innerText()).trim() };
}

test("synthetic account completes password, recovery, passkey, authenticator and device approval in the browser", async ({
  page,
  browser,
}) => {
  const id = `review${Date.now()}`;
  const email = `${id}@example.test`;
  await page.goto("/create-account");
  await page.getByLabel("Name", { exact: true }).fill("Review Person");
  await page.getByLabel("Username", { exact: true }).fill(id);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .locator("input")
    .and(page.getByLabel("Password", { exact: true }))
    .fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  await openLatestMail(page, email, "Verify account");
  await expect(page).toHaveURL(/\/login/);
  await passwordSignIn(page, id, "An incorrect password");
  await expect(page.getByRole("alert")).toBeVisible();
  await passwordSignIn(page, id);
  await expect(
    page.getByRole("heading", { name: "Welcome, Review Person." }),
  ).toBeVisible();

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );
  await page.getByRole("button", { name: "Add a passkey" }).click();
  await expect(page.getByText("Your passkey is ready to use.")).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/login?returnTo=%2Faccount");
  await page.getByRole("tab", { name: "Passkey", exact: true }).click();
  await cdp.send("WebAuthn.setResponseOverrideBits", {
    authenticatorId,
    isBadUV: true,
  });
  const rejectedPasskey = page.waitForResponse((response) =>
    response.url().endsWith("/passkey/verify-authentication"),
  );
  await page.getByRole("button", { name: "Continue with a passkey" }).click();
  expect((await rejectedPasskey).status()).toBe(401);
  await expect(
    page.getByText("Unlock your device to use this passkey.", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  await cdp.send("WebAuthn.setResponseOverrideBits", {
    authenticatorId,
    isBadUV: false,
  });
  await page.getByRole("button", { name: "Continue with a passkey" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome, Review Person." }),
  ).toBeVisible();

  await page.getByLabel("Confirm current password").fill(password);
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  await page.getByText("Cannot scan? Show setup key").click();
  const secret = await page.getByTestId("totp-secret").innerText();
  const totp = new OTPAuth.TOTP({
    issuer: "Royer account",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  const enrollmentCode = totp.generate();
  await page.getByLabel("Authenticator setup code").fill(enrollmentCode);
  await page
    .getByRole("button", { name: "Verify authenticator", exact: true })
    .click();
  await expect(
    page.getByText("Authenticator setup complete.", { exact: false }),
  ).toBeVisible();
  const backup = await page
    .getByRole("list", { name: "Backup codes" })
    .locator("li")
    .first()
    .innerText();
  await page.getByRole("button", { name: "I saved my backup codes" }).click();
  await expect(
    page.getByText("Authenticator enabled", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await passwordSignIn(page, id);
  await expect(page).toHaveURL(/\/two-factor/);
  // Royer Auth rc.3 accepts each authenticator code once, so wait for the next timestep.
  await expect
    .poll(() => totp.generate(), { timeout: 35_000, intervals: [250] })
    .not.toBe(enrollmentCode);
  await page
    .getByLabel("Authenticator code", { exact: true })
    .fill(totp.generate());
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome, Review Person." }),
  ).toBeVisible();

  const receiver = await browser.newContext({
    baseURL: "http://localhost:4325",
  });
  const incoming = await startPhoneLogin(receiver);
  await page.goto(`/approve?code=${encodeURIComponent(incoming.code)}`);
  await page.getByRole("button", { name: "Review request" }).click();
  await expect(
    page.getByRole("heading", { name: "Is this your request?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve sign-in" }).click();
  await expect(
    page.getByRole("heading", { name: "You can return to the other device." }),
  ).toBeVisible();
  await expect(
    incoming.page.getByRole("heading", { name: "Welcome, Review Person." }),
  ).toBeVisible();
  await receiver.close();
  const deniedReceiver = await browser.newContext({
    baseURL: "http://localhost:4325",
  });
  const denied = await startPhoneLogin(deniedReceiver);
  await page.goto(`/approve?code=${encodeURIComponent(denied.code)}`);
  await page.getByRole("button", { name: "Review request" }).click();
  await page.getByRole("button", { name: "Deny", exact: true }).click();
  await expect(
    denied.page.getByText("This request was denied.", { exact: false }),
  ).toBeVisible();
  await deniedReceiver.close();

  await page.goto("/recovery");
  await page.getByLabel("Account email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If that email");
  await openLatestMail(page, email, "Reset password");
  await page
    .getByLabel("New password", { exact: true })
    .fill("A changed review phrase 8362");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your password has changed",
  );
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
  await passwordSignIn(page, id, "A changed review phrase 8362");
  await expect(page).toHaveURL(/\/two-factor/);
  await page.getByRole("button", { name: "Use a backup code instead" }).click();
  await page.getByLabel("Backup code", { exact: true }).fill(backup);
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome, Review Person." }),
  ).toBeVisible();
  await expect(
    page.getByText("Authenticator enabled", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove My passkey", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await passwordSignIn(page, id, "A changed review phrase 8362");
  await expect(page).toHaveURL(/\/two-factor/);
  await page.getByRole("button", { name: "Use a backup code instead" }).click();
  await page.getByLabel("Backup code", { exact: true }).fill(backup);
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect((await page.request.get("/api/todos")).status()).toBe(401);
});

test("sign-in stays usable at 400px and gives recoverable error feedback", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 400, height: 860 });
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "A familiar way in." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Enter your username or email.")).toBeVisible();
  await page.getByRole("tab", { name: "Phone approval" }).click();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Create approval code" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("tab", { name: "Password", exact: true }).click();
});
