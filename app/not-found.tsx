// 404 page. Without this file a mistyped URL or a deleted campaign id renders
// Next's stock black-and-white 404, which shares no styling with the product
// and reads as if the user left the site.

import Link from "next/link";
import { CompassIcon, HomeIcon, LayoutDashboardIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 py-16">
      <Empty className="max-w-md border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CompassIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>
            This page doesn&apos;t exist, or whatever used to be here has since
            been deleted.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" asChild>
              <Link href="/dashboard">
                <LayoutDashboardIcon aria-hidden="true" />
                Go to dashboard
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/">
                <HomeIcon aria-hidden="true" />
                Home
              </Link>
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </main>
  );
}
