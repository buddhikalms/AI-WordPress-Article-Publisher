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
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
