import type { Metadata } from "next";
import "@/app/globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "AI WordPress Article Publisher",
  description:
    "Generate AI articles and featured images, then publish with AIOSEO or Yoast metadata via WordPress REST API.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
