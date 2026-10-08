import type { Metadata } from "next";
import Link from "next/link";
import { Josefin_Sans } from "next/font/google";
import "./globals.css";
const font = Josefin_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-todo",
});
export const metadata: Metadata = {
  title: { default: "Todo | Royer Adames", template: "%s | Todo" },
  description:
    "A focused task list with themes, filters and an account to keep your tasks across devices.",
  icons: { icon: "/images/favicon-32x32.png" },
};
const themeScript = `(function(){try{var t=localStorage.getItem('todo-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}catch{}})()`;
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={font.variable}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <nav className="site-nav" aria-label="Main">
          <Link href="/">Todo demo</Link>
          <Link href="/todos">Your list</Link>
          <Link href="/account">Account</Link>
        </nav>
        {children}
        <footer className="site-footer">
          Built by <a href="https://royeradames.com">Royer Adames</a> for the{" "}
          <a href="https://www.frontendmentor.io/challenges/todo-app-Su1_KokOW">
            Todo challenge
          </a>
          .
        </footer>
      </body>
    </html>
  );
}
