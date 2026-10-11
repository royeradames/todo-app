import type { Metadata } from "next";
import { Josefin_Sans } from "next/font/google";
import "./globals.css";
const font = Josefin_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-todo",
});
const description =
  "A focused task list with light and dark themes, filters and drag-and-drop ordering.";
export const metadata: Metadata = {
  metadataBase: new URL("https://todo-app.royeradames.com"),
  title: { default: "Todo | Royer Adames", template: "%s | Todo" },
  description,
  openGraph: {
    type: "website",
    siteName: "Todo",
    title: "Todo | Royer Adames",
    description,
    url: "/",
  },
};
const site = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Todo",
  url: "https://todo-app.royeradames.com/",
};
const themeScript = `(function(){try{var t=localStorage.getItem('todo-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}catch{}})()`;
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(site) }}
        />
      </head>
      <body className={font.variable}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        <footer className="site-footer">
          Built by <a href="https://royeradames.com">Royer Adames</a>. Layout
          from the{" "}
          <a href="https://www.frontendmentor.io/challenges/todo-app-Su1_KokOW">
            Frontend Mentor Todo challenge
          </a>
          .
        </footer>
      </body>
    </html>
  );
}
