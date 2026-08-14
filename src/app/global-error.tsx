"use client";

// Replaces the whole document when a root layout crashes, so it must render
// its own <html>/<body> and rely on inline styles only — no globals.css and
// no next/font variables exist here. Both languages are shown stacked.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
          Lune
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
          Something went wrong
        </h1>
        <p dir="rtl" style={{ fontSize: "1.25rem", margin: 0 }}>
          حدث خطأ ما
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            border: "1px solid rgba(196, 161, 94, 0.4)",
            background: "transparent",
            color: "#c4a15e",
            padding: "0.75rem 2rem",
            fontSize: "0.8rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Try again · حاول مرة أخرى
        </button>
      </body>
    </html>
  );
}
