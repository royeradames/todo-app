"use client";
import Link from "next/link";
import { useState } from "react";
// Shown when a protected page cannot reach the account service or the list.
// retry() re-fetches the segment, so a recovered issuer signs straight back in.
export default function ErrorPage({ retry }: { retry: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <main id="main" className="auth-layout">
      <h1>This page is temporarily unavailable.</h1>
      <p>Your account or list could not be reached. Your saved list has not been changed.</p>
      <button
        className="button primary"
        aria-busy={busy || undefined}
        onClick={() => {
          if (busy) return;
          setBusy(true);
          retry();
          // retry() resolves by re-rendering; release the guard for a second failure.
          setTimeout(() => setBusy(false), 3000);
        }}
      >
        {busy ? "Trying again…" : "Try again"}
      </button>
      <Link href="/">Back to Todo</Link>
    </main>
  );
}
