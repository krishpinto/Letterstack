"use client";

// Route-level error boundary for everything outside /dashboard.
//
// Without this file a thrown render error unmounts the whole tree and Next
// falls back to its own unstyled "Application error" page — which looks like
// the site is down rather than like one page failed. This keeps the failure
// inside our own shell and, crucially, offers a way out of it.

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangleIcon, HomeIcon, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Until an error tracker is wired up, the browser console is the only place
  // a failure is recorded at all. Logging the whole error keeps the stack,
  // which `digest` alone does not carry.
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 py-16">
      <Empty className="max-w-md border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertTriangleIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Something went wrong</EmptyTitle>
          <EmptyDescription>
            This page hit an error we didn&apos;t expect. Trying again usually
            works — nothing you&apos;d saved has been lost.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={reset} size="sm">
              <RotateCcwIcon aria-hidden="true" />
              Try again
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/">
                <HomeIcon aria-hidden="true" />
                Go home
              </Link>
            </Button>
          </div>
          {/* The digest is the only handle that ties what the user saw to a
              server log line, so it is worth showing rather than hiding. */}
          {error.digest ? (
            <p className="mt-4 font-mono text-xs text-muted-foreground">
              Reference: {error.digest}
            </p>
          ) : null}
        </EmptyContent>
      </Empty>
    </main>
  );
}
