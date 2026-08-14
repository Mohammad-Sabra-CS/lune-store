import type { Metadata, Viewport } from "next";
import { Jost } from "next/font/google";
import "../globals.css";

const jost = Jost({ subsets: ["latin"], variable: "--font-jost" });

export const metadata: Metadata = {
  title: "Lune — Orders",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: "only light",
  themeColor: "#0b0e17",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={jost.variable}
      style={{ "--font-sans": "var(--font-jost), sans-serif" } as React.CSSProperties}
    >
      <body className="min-h-screen bg-ivory antialiased">{children}</body>
    </html>
  );
}
