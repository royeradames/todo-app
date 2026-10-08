import { createPrivateAuth } from "@royer/auth/server";
import type { Pool } from "pg";

export class AccountUnavailable extends Error {}
export function authSettings() {
  const baseURL = process.env.AUTH_BASE_URL;
  const secret = process.env.AUTH_SECRET;
  if (!baseURL || !secret || secret.length < 32)
    throw new AccountUnavailable("Account access is not configured yet.");
  let origin: URL;
  try {
    origin = new URL(baseURL);
  } catch {
    throw new AccountUnavailable("Account access is not configured yet.");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
    origin.hostname,
  );
  if (
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    (origin.protocol !== "https:" && !(origin.protocol === "http:" && loopback))
  ) {
    throw new AccountUnavailable(
      "Account origin must be an exact HTTPS origin, or local development origin.",
    );
  }
  const testMail =
    process.env.NODE_ENV !== "production" &&
    loopback &&
    process.env.TODO_LOCAL_TEST_MAIL === "1";
  if (
    !testMail &&
    (!process.env.RESEND_API_KEY || !process.env.AUTH_EMAIL_FROM)
  )
    throw new AccountUnavailable("Account email is not configured yet.");
  return { baseURL: origin.origin, secret, testMail };
}
export type AuthMail = {
  user: { id: string; name: string; email: string };
  url: string;
};
export function configureAuth(
  database: Pool,
  deliver: (
    kind: "verification" | "recovery",
    message: AuthMail,
  ) => Promise<void>,
) {
  const settings = authSettings();
  return createPrivateAuth({
    appId: "todo",
    appName: "Todo",
    baseURL: settings.baseURL,
    secret: settings.secret,
    database,
    email: {
      sendVerification: (message) => deliver("verification", message),
      sendPasswordReset: (message) => deliver("recovery", message),
    },
    companionPage: "/approve",
  });
}
