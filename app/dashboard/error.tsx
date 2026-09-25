"use client";

// Dashboard-scoped error boundary.
//
// Deliberately separate from the root one: this renders *inside*
// app/dashboard/layout.tsx, so the nav shell survives and the failure reads as
// "this page broke" rather than "the app broke". Someone whose campaigns page
// throws can still reach their audience from the sidebar.

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangleIcon, LayoutDashboardIcon, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard-error-boundary]", error);
  }, [error]);

  return (
    <div className="flex h-full flex-1 items-center justify-center p-6">
      <Empty className="max-w-md border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertTriangleIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>This page didn&apos;t load</EmptyTitle>
          <EmptyDescription>
            Something failed while building this view. Your campaigns, contacts
            and templates are unaffected.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={reset} size="sm">
              <RotateCcwIcon aria-hidden="true" />
              Try again
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">
                <LayoutDashboardIcon aria-hidden="true" />
                Back to dashboard
              </Link>
            </Button>
          </div>
          {error.digest ? (
            <p className="mt-4 font-mono text-xs text-muted-foreground">
              Reference: {error.digest}
            </p>
          ) : null}
        </EmptyContent>
      </Empty>
    </div>
  );
}
