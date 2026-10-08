"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";
import { authClient, checkResult } from "@/lib/auth-client";
import { AuthForm } from "./form";
import { QrCode } from "./qr-code";

type Passkey = { id: string; name?: string | null };
type Enrollment =
  | { kind: "idle" | "enabled" }
  | { kind: "enroll"; totpURI: string; backupCodes: string[] }
  | { kind: "done"; backupCodes: string[] };
export function Account({
  ownerId,
  name,
  email,
}: {
  ownerId: string;
  name: string;
  email: string;
}) {
  const { data: session, isPending } = authClient.useSession();
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [passkeyFeedback, setPasskeyFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment>({ kind: "idle" });
  const [sessionFeedback, setSessionFeedback] = useState("");
  async function loadPasskeys() {
    const result = await authClient.passkey.listUserPasskeys();
    checkResult(result);
    setPasskeys(result.data || []);
  }
  useEffect(() => {
    let active = true;
    void authClient.passkey
      .listUserPasskeys()
      .then((result) => {
        checkResult(result);
        if (active) setPasskeys(result.data || []);
      })
      .catch(() => {
        if (active)
          setPasskeyFeedback(
            "Saved passkeys could not be loaded. Refresh to try again.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function addPasskey() {
    setBusy(true);
    setPasskeyFeedback("");
    try {
      checkResult(await authClient.passkey.addPasskey({ name: "My passkey" }));
      await loadPasskeys();
      setPasskeyFeedback("Your passkey is ready to use.");
    } catch (error) {
      setPasskeyFeedback(
        error instanceof Error
          ? error.message
          : "Your device could not add a passkey.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function removePasskey(id: string) {
    try {
      checkResult(await authClient.passkey.deletePasskey({ id }));
      await loadPasskeys();
      setPasskeyFeedback("Passkey removed.");
    } catch (error) {
      setPasskeyFeedback(
        error instanceof Error
          ? error.message
          : "The passkey could not be removed.",
      );
    }
  }
  async function signOut() {
    try {
      checkResult(await authClient.signOut());
      window.location.assign(new URL("/login", window.location.origin).href);
    } catch {
      setSessionFeedback("Could not sign out. Please try again.");
    }
  }
  const authenticatorActive =
    session?.user.twoFactorEnabled ||
    enrollment.kind === "done" ||
    enrollment.kind === "enabled";
  if (isPending || session?.user.id !== ownerId)
    return (
      <main id="main" className="auth-layout">
        <h1>Account security</h1>
        <p role="status">
          {isPending
            ? "Checking your account…"
            : "Your session changed. Open the current account to continue."}
        </p>
        {!isPending && <a href="/account">Open current account</a>}
      </main>
    );
  return (
    <main id="main" className="dashboard">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Your account</p>
          <h1>Welcome, {name}.</h1>
          <p>{email}</p>
        </div>
        <button className="button" onClick={() => void signOut()}>
          Sign out<span aria-hidden="true">↗</span>
        </button>
      </div>
      <div className="dashboard-grid">
        <section className="security-card">
          <p className="card-label">01 / Passkeys</p>
          <h2>Unlock with your device.</h2>
          <p>
            Use a fingerprint, face recognition, device PIN, or security key.
            The app never receives your biometric data.
          </p>
          {passkeys === null && (
            <p className="hint" role="status">
              Loading saved passkeys…
            </p>
          )}
          <ul className="list">
            {passkeys?.map((passkey) => (
              <li key={passkey.id}>
                <span>{passkey.name || "Saved passkey"}</span>
                <button onClick={() => void removePasskey(passkey.id)}>
                  Remove
                  <span className="visually-hidden">
                    {" "}
                    {passkey.name || "saved passkey"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {passkeyFeedback && (
            <p className="notice" role="status">
              {passkeyFeedback}
            </p>
          )}
          <button
            className="button primary full"
            disabled={busy}
            onClick={() => void addPasskey()}
          >
            {busy ? "Follow your device prompt…" : "Add a passkey"}
            <span aria-hidden="true">+</span>
          </button>
        </section>
        <section className="security-card">
          <p className="card-label">02 / Authenticator app</p>
          <h2>A second check for passwords.</h2>
          <p>
            A rotating app code protects password sign-in. Passkey and
            signed-in-device access use their own verification.
          </p>
          {isPending && (
            <p className="hint" role="status">
              Loading account security…
            </p>
          )}
          {authenticatorActive && (
            <p className="status-pill">Authenticator enabled</p>
          )}
          {!isPending && !authenticatorActive && enrollment.kind === "idle" && (
            <AuthForm
              fields={[
                {
                  name: "password",
                  label: "Confirm current password",
                  type: "password",
                  autoComplete: "current-password",
                },
              ]}
              schema={z.object({
                password: z.string().min(1, "Enter your current password."),
              })}
              submit="Set up authenticator"
              onSubmit={async ({ password }) => {
                const result = await authClient.twoFactor.enable({ password });
                checkResult(result);
                const data = z
                  .object({
                    totpURI: z.string(),
                    backupCodes: z.array(z.string()),
                  })
                  .parse(result.data);
                setEnrollment({ kind: "enroll", ...data });
              }}
            />
          )}
          {enrollment.kind === "enroll" && (
            <div className="stack">
              <p className="hint">
                Scan with your authenticator app, then enter a code to finish
                setup.
              </p>
              <QrCode
                value={enrollment.totpURI}
                description="Add this account to an authenticator app"
              />
              <details>
                <summary className="text-link">
                  Cannot scan? Show setup key
                </summary>
                <p className="mono" data-testid="totp-secret">
                  {new URL(enrollment.totpURI).searchParams.get("secret")}
                </p>
              </details>
              <AuthForm
                fields={[
                  {
                    name: "code",
                    label: "Authenticator setup code",
                    autoComplete: "one-time-code",
                    inputMode: "numeric",
                  },
                ]}
                schema={z.object({
                  code: z
                    .string()
                    .regex(/^\d{6}$/, "Enter the six-digit code."),
                })}
                submit="Verify authenticator"
                onSubmit={async ({ code }) => {
                  checkResult(
                    await authClient.twoFactor.verifyTotp({
                      code,
                      trustDevice: false,
                    }),
                  );
                  setEnrollment({
                    kind: "done",
                    backupCodes: enrollment.backupCodes,
                  });
                }}
              />
            </div>
          )}
          {enrollment.kind === "done" && (
            <div className="stack">
              <p className="notice success" role="status">
                Authenticator setup complete. Save these backup codes now.
              </p>
              <ul className="backup-codes" aria-label="Backup codes">
                {enrollment.backupCodes.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
              <p className="hint">
                Each code works once when your authenticator is unavailable.
                Store them in your password manager.
              </p>
              <button
                className="button"
                onClick={() => setEnrollment({ kind: "enabled" })}
              >
                I saved my backup codes
              </button>
            </div>
          )}
        </section>
        <section className="security-card">
          <p className="card-label">03 / Phone approval</p>
          <h2>Help your other device sign in.</h2>
          <p>
            Review a code from another browser. Approval goes to the browser
            that started the request.
          </p>
          <Link className="button full" href="/approve">
            Approve a device<span aria-hidden="true">↗</span>
          </Link>
        </section>
        <section className="security-card">
          <p className="card-label">04 / Recovery & sessions</p>
          <h2>Keep a way back in.</h2>
          <p>
            Password reset uses your verified email. Save authenticator backup
            codes separately if you enable that second check.
          </p>
          <Link className="button full" href="/recovery">
            Reset password<span aria-hidden="true">↗</span>
          </Link>
          <button
            className="button full"
            onClick={async () => {
              try {
                checkResult(await authClient.revokeOtherSessions());
                setSessionFeedback("Other sessions have been signed out.");
              } catch {
                setSessionFeedback(
                  "Could not revoke sessions. Please try again.",
                );
              }
            }}
          >
            Sign out other sessions<span aria-hidden="true">↗</span>
          </button>
          {sessionFeedback && (
            <p className="notice" role="status">
              {sessionFeedback}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
