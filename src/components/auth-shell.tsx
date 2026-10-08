import Link from "next/link";
import type { ReactNode } from "react";
export function AuthShell({
  backLink = true,
  eyebrow,
  title,
  description,
  children,
}: {
  backLink?: boolean;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main id="main" className="auth-layout">
      {backLink && (
        <Link className="back-link" href="/">
          Back to Todo
        </Link>
      )}
      <header>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <section className="auth-card" aria-label={title}>
        {children}
      </section>
    </main>
  );
}
export function FormFooter({ children }: { children: ReactNode }) {
  return (
    <div className="form-footer">
      {children}
      <Link href="/login">Back to sign in</Link>
    </div>
  );
}
