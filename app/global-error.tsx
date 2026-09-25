"use client";

// Last-resort boundary: catches errors thrown by the root layout itself, which
// app/error.tsx cannot — it lives inside that layout. Because this replaces the
// root layout, it has to render its own <html> and <body>, and it imports the
// stylesheet directly since the layout that normally does never ran.
//
// No Providers here on purpose: whatever broke may well be one of them, so this
// page depends on nothing but React.

import { useEffect } from "react";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error-boundary]", error);
  }, [error]);

  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col items-center justify-center gap-4 bg-background p-6 text-center font-sans text-foreground antialiased">
        <h1 className="text-xl font-semibold">LetterStack hit an error</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Something failed badly enough to take the whole page down. Reloading
          usually clears it.
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Reload
        </button>
        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        ) : null}
      </body>
    </html>
  );
}
