"use client";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { AuthForm } from "./form";
import { PhoneLogin } from "./phone-login";
import { authClient, checkResult, returnPath } from "@/lib/auth-client";

export function Login({ returnTo }: { returnTo: string | null }) {
  const [method, setMethod] = useState<"password" | "passkey" | "phone">(
    "password",
  );
  const [passkeyState, setPasskeyState] = useState<
    { kind: "idle" | "busy" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const destination = () => returnPath(returnTo);
  async function signInWithPasskey() {
    setPasskeyState({ kind: "busy" });
    try {
      checkResult(await authClient.signIn.passkey());
      window.location.assign(destination());
    } catch (error) {
      setPasskeyState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Your device could not finish signing in. Try again or choose another method.",
      });
    }
  }
  return (
    <>
      <h2>Sign in</h2>
      <p className="card-description">
        Choose the method that suits this device.
      </p>
      <div className="tabs" role="tablist" aria-label="Sign-in method">
        {(["password", "passkey", "phone"] as const).map((value) => (
          <button
            key={value}
            id={`tab-${value}`}
            role="tab"
            type="button"
            aria-selected={method === value}
            aria-controls="login-panel"
            tabIndex={method === value ? 0 : -1}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? value === "password"
                    ? "passkey"
                    : value === "passkey"
                      ? "phone"
                      : "password"
                  : event.key === "ArrowLeft"
                    ? value === "password"
                      ? "phone"
                      : value === "phone"
                        ? "passkey"
                        : "password"
                    : event.key === "Home"
                      ? "password"
                      : event.key === "End"
                        ? "phone"
                        : null;
              if (!next) return;
              event.preventDefault();
              setMethod(next);
              document.getElementById(`tab-${next}`)?.focus();
            }}
            onClick={() => setMethod(value)}
          >
            {value === "password"
              ? "Password"
              : value === "passkey"
                ? "Passkey"
                : "Phone approval"}
          </button>
        ))}
      </div>
      <div id="login-panel" role="tabpanel" aria-labelledby={`tab-${method}`}>
        {method === "password" && (
          <AuthForm
            fields={[
              {
                name: "identifier",
                label: "Username or email",
                autoComplete: "username",
              },
              {
                name: "password",
                label: "Password",
                type: "password",
                autoComplete: "current-password",
              },
            ]}
            schema={z.object({
              identifier: z.string().min(1, "Enter your username or email."),
              password: z.string().min(1, "Enter your password."),
            })}
            submit="Sign in"
            onSubmit={async ({ identifier, password }) => {
              const result = identifier.includes("@")
                ? await authClient.signIn.email({ email: identifier, password })
                : await authClient.signIn.username({
                    username: identifier,
                    password,
                  });
              checkResult(result);
              const secondFactor = z
                .object({ twoFactorRedirect: z.literal(true) })
                .safeParse(result.data);
              window.location.assign(
                secondFactor.success
                  ? `/two-factor?returnTo=${encodeURIComponent(destination())}`
                  : destination(),
              );
            }}
          >
            <Link className="text-link" href="/recovery">
              Forgot your password?
            </Link>
          </AuthForm>
        )}
        {method === "passkey" && (
          <div className="stack">
            <div className="method-illustration" aria-hidden="true">
              ◎
            </div>
            <h3>Let your device unlock your account.</h3>
            <p className="card-description">
              Use a fingerprint, face recognition, device PIN, or security key.
              Your biometric data stays on your device.
            </p>
            {passkeyState.kind === "error" && (
              <p className="notice error" role="alert">
                {passkeyState.message}
              </p>
            )}
            <button
              className="button primary full"
              disabled={passkeyState.kind === "busy"}
              onClick={() => void signInWithPasskey()}
            >
              {passkeyState.kind === "busy"
                ? "Follow your device prompt…"
                : "Continue with a passkey"}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        )}
        {method === "phone" && <PhoneLogin returnTo={returnTo} />}
      </div>
      <div className="form-footer">
        <p>
          New here? <Link href="/create-account">Create an account</Link>
        </p>
      </div>
    </>
  );
}
