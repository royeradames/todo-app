"use client";
import Link from "next/link";
import { z } from "zod";
import { AuthForm } from "./form";
import { authClient, checkResult } from "@/lib/auth-client";
export function Recovery() {
  return (
    <>
      <h2>Reset your password</h2>
      <p className="card-description">
        Enter the email you used for this account. If it matches a verified
        account, we will send a reset link.
      </p>
      <AuthForm
        fields={[
          {
            name: "email",
            label: "Account email",
            type: "email",
            autoComplete: "email",
          },
        ]}
        schema={z.object({ email: z.string().email("Enter a valid email.") })}
        submit="Send reset link"
        onSubmit={async ({ email }) => {
          checkResult(
            await authClient.requestPasswordReset({
              email,
              redirectTo: `${window.location.origin}/reset-password`,
            }),
          );
          return "If that email belongs to a verified account, a reset link is on its way.";
        }}
      />
      <div className="form-footer">
        <Link href="/login">Back to sign in</Link>
      </div>
    </>
  );
}
export function ResetPassword({ token }: { token: string | null }) {
  if (!token)
    return (
      <div className="stack">
        <h2>This link is unavailable</h2>
        <p className="card-description">
          Request a fresh link if the previous one expired or was already used.
        </p>
        <Link className="button primary" href="/recovery">
          Request a new link<span aria-hidden="true">↗</span>
        </Link>
      </div>
    );
  return (
    <>
      <h2>Choose a new password</h2>
      <p className="card-description">
        Use at least 15 characters. Older sessions will be signed out after the
        reset.
      </p>
      <AuthForm
        fields={[
          {
            name: "password",
            label: "New password",
            type: "password",
            autoComplete: "new-password",
          },
        ]}
        schema={z.object({
          password: z
            .string()
            .min(15, "Use at least 15 characters.")
            .max(128, "Use no more than 128 characters."),
        })}
        submit="Save new password"
        onSubmit={async ({ password }) => {
          checkResult(
            await authClient.resetPassword({ newPassword: password, token }),
          );
          window.history.replaceState({}, "", "/reset-password");
          return "Your password has changed. Sign in again with the new password.";
        }}
      />
      <div className="form-footer">
        <Link href="/login">Sign in</Link>
      </div>
    </>
  );
}
