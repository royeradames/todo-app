"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="auth-layout">
      <h1>This page is temporarily unavailable.</h1>
      <p>Please try again. Your saved list has not been changed.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
      <Link href="/">Return to the demo</Link>
    </main>
  );
}
