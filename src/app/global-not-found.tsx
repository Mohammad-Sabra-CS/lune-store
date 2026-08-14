import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 — Lune",
};

// Served for URLs that match no route at all (outside both the [locale] and
// admin trees). Rendering bypasses every layout, so this is a complete,
// dependency-free document: no globals.css, no next/font, inline styles only.
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          background: "#0b0e17",
          color: "#f4eedf",
          fontFamily: "Georgia, 'Times New Roman', serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <p
          style={{
            color: "#c4a15e",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            fontSize: "0.75rem",
            margin: 0,
          }}
        >
          404
        </p>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Page not found
        </h1>
        <p dir="rtl" style={{ fontSize: "1.25rem", margin: 0 }}>
          الصفحة غير موجودة
        </p>
        <a
          href="/"
          style={{
            marginTop: "0.5rem",
            border: "1px solid rgba(196, 161, 94, 0.4)",
            color: "#c4a15e",
            padding: "0.75rem 2rem",
            fontSize: "0.8rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          Lune — Home · الرئيسية
        </a>
      </body>
    </html>
  );
}
