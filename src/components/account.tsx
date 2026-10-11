"use client";
import Link from "next/link";
import { useState } from "react";
import { signOutOfTodo } from "@/lib/auth-client";

export function Account({
  name,
  email,
  manageURL,
}: {
  name: string;
  email: string;
  manageURL: string;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  async function signOut() {
    if (busy) return;
    setBusy(true);
    setFeedback("");
    try {
      await signOutOfTodo();
      window.location.assign(new URL("/login", window.location.origin).href);
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Could not sign out.",
      );
      setBusy(false);
    }
  }
  return (
    <main id="main" className="dashboard">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Your account</p>
          <h1>Welcome, {name}.</h1>
          <p>{email}</p>
        </div>
        <div className="heading-actions">
          {/* A top-level post: Todo signs out, then the Breakthrough account ends, which signs out every app. */}
          <form method="post" action="/api/auth/federation/sign-out">
            <button className="button" type="submit">
              Sign out of all apps
            </button>
          </form>
          <button
            className="button"
            aria-busy={busy || undefined}
            onClick={() => void signOut()}
          >
            {busy ? "Signing out…" : "Sign out of Todo only"}
          </button>
        </div>
      </div>
      {feedback && (
        <p className="notice error" role="alert">
          {feedback}
        </p>
      )}
      <div className="dashboard-grid">
        <section className="security-card">
          <p className="card-label">01 / Breakthrough account</p>
          <h2>Security lives in one place.</h2>
          <p>
            Your password, passkeys, authenticator app and recovery codes
            belong to your Breakthrough account, so every app in the family
            gets the same protection.
          </p>
          <a className="button primary full" href={manageURL}>
            Manage your Breakthrough account
          </a>
        </section>
        <section className="security-card">
          <p className="card-label">02 / This app</p>
          <h2>Signing out here.</h2>
          <p>
            Signing out of Todo ends Todo on this browser only. Your
            Breakthrough account stays signed in until you sign out there.
          </p>
          <Link className="button full" href="/todos">
            Back to your list
          </Link>
        </section>
      </div>
    </main>
  );
}
