"use client";
import { useState } from "react";
import { startSignIn } from "@/lib/auth-client";

export function Login({
  returnTo,
  failure,
}: {
  returnTo: string | null;
  failure: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(failure ?? "");
  async function continueToAccount() {
    // Busy, not disabled: the button stays focusable and announced.
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      window.location.assign(await startSignIn(returnTo));
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Sign-in is temporarily unavailable. Please try again.",
      );
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <h2>Sign in</h2>
      <p className="card-description">
        Todo uses your Breakthrough account. You sign in on the account page
        with your password, passkey or another device, then come straight
        back to your list.
      </p>
      <button
        type="button"
        className="button primary full"
        aria-busy={busy || undefined}
        onClick={() => void continueToAccount()}
      >
        {busy ? "Opening your account…" : "Continue with Breakthrough account"}
      </button>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
