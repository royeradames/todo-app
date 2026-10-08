import "server-only";
import { randomUUID } from "node:crypto";
import { AccountUnavailable, authSettings, type AuthMail } from "./auth-config";
type TestMessage = {
  id: string;
  kind: "verification" | "recovery";
  recipient: string;
  url: string;
};
const localMail = globalThis as typeof globalThis & {
  todoTestInbox?: TestMessage[];
};
function testInbox() {
  return (localMail.todoTestInbox ??= []);
}
export function readTestMail(request: Request) {
  const host = new URL(request.url).hostname;
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(host) ||
    !authSettings().testMail
  )
    return null;
  return testInbox();
}
export async function deliverAuthMail(
  kind: "verification" | "recovery",
  { user, url }: AuthMail,
) {
  const settings = authSettings();
  if (new URL(url).origin !== settings.baseURL)
    throw new AccountUnavailable("Account email is unavailable.");
  if (settings.testMail) {
    if (!user.email.toLowerCase().endsWith("@example.test"))
      throw new AccountUnavailable(
        "Local verification accepts only example.test addresses.",
      );
    const inbox = testInbox();
    inbox.unshift({ id: randomUUID(), kind, recipient: user.email, url });
    inbox.splice(50);
    return;
  }
  try {
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.AUTH_EMAIL_FROM,
        to: user.email,
        subject:
          kind === "verification"
            ? "Verify your Todo account"
            : "Reset your Todo password",
        text: `${kind === "verification" ? "Verify your email" : "Choose a new password"}: ${url}\n\nIf you did not request this, ignore this email.`,
      }),
    });
    if (!result.ok) throw new Error("Mail delivery failed");
  } catch {
    console.error(JSON.stringify({ event: "auth_mail_failed", kind }));
    throw new AccountUnavailable("Account email is temporarily unavailable.");
  }
}
