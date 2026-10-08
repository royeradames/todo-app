import Link from "next/link";
import type { ReactNode } from "react";
export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main id="main" className="auth-layout">
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
