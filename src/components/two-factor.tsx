"use client";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { AuthForm } from "./form";
import { authClient, checkResult, returnPath } from "@/lib/auth-client";
export function TwoFactor({ returnTo }: { returnTo: string | null }) {
  const [method, setMethod] = useState<"totp" | "backup">("totp");
  return (
    <>
      <h2>{method === "totp" ? "Enter your app code" : "Use a backup code"}</h2>
      <p className="card-description">
        {method === "totp"
          ? "Open your authenticator app and enter the current six-digit code."
          : "Each saved backup code works once. Keep your remaining codes somewhere safe."}
      </p>
      <AuthForm
        key={method}
        fields={[
          {
            name: "code",
            label: method === "totp" ? "Authenticator code" : "Backup code",
            autoComplete: "one-time-code",
            inputMode: method === "totp" ? "numeric" : "text",
          },
        ]}
        schema={z.object({
          code:
            method === "totp"
              ? z.string().regex(/^\d{6}$/, "Enter the six-digit code.")
              : z.string().min(1, "Enter a saved backup code."),
        })}
        submit="Verify and sign in"
        onSubmit={async ({ code }) => {
          checkResult(
            method === "totp"
              ? await authClient.twoFactor.verifyTotp({
                  code,
                  trustDevice: false,
                })
              : await authClient.twoFactor.verifyBackupCode({
                  code,
                  trustDevice: false,
                }),
          );
          window.location.assign(returnPath(returnTo));
        }}
      />
      <div className="form-footer">
        <button
          className="text-button"
          onClick={() => setMethod(method === "totp" ? "backup" : "totp")}
        >
          {method === "totp"
            ? "Use a backup code instead"
            : "Use my authenticator app"}
        </button>
        <Link href="/login">Back to sign in</Link>
      </div>
    </>
  );
}
