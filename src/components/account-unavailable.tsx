"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

// Shown when a private page cannot check the account service. Refreshing
// re-runs the check, so a recovered issuer opens the page directly.
export function AccountUnavailable() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(timer);
  }, [pending]);
  return (
    <main id="main" className="auth-layout">
      <Link className="back-link" href="/">
        Back to Todo
      </Link>
      <h1>This page is temporarily unavailable.</h1>
      <p>
        Your account could not be reached. Your saved list has not been
        changed.
      </p>
      <button
        className="button primary"
        aria-busy={pending || undefined}
        onClick={() => {
          // Busy, not disabled: a second press while checking does nothing.
          if (pending) return;
          setSlow(false);
          startTransition(() => router.refresh());
        }}
      >
        {pending ? "Trying again…" : "Try again"}
      </button>
      <p className="hint" role="status">
        {pending && slow ? "Still waiting for your account service…" : ""}
      </p>
    </main>
  );
}
