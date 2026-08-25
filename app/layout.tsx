import type { Metadata } from "next";
import "@/app/globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "AI Article Publisher | SEO-ready WordPress content with AI",
  description:
    "Generate articles, images, SEO metadata, Google Doc imports, and news-based drafts, then publish directly to WordPress.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {process.env.NODE_ENV === "development" ? (
        <head>
          <link rel="stylesheet" href="/_next/static/css/app/layout.css" />
        </head>
      ) : null}
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
try {
  const stored = localStorage.getItem("ai-publisher-theme");
  const theme = stored === "dark" || stored === "light"
    ? stored
    : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
} catch {}
`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
