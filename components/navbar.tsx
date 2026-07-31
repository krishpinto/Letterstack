"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { ClockIcon, MailIcon, MenuIcon } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { RichButton } from "@/components/rich-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { AccessStatus } from "@/db/access";

// Every item points at a section of the landing page itself — the marketing
// subpages are gone, so the nav scrolls instead of navigating.
const NAV_ITEMS = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#testimonials", label: "Testimonials" },
  { href: "/#contact", label: "Contact" },
] as const;

type NavbarProps = {
  /**
   * Signed-in user's early-access status. Undefined/null means either
   * anonymous or "not known here" (e.g. a page that doesn't compute it) —
   * both fall back to the normal signed-in behavior (Dashboard link), so
   * only an explicit 'pending'/'rejected' changes anything.
   */
  accessStatus?: AccessStatus | null;
};

/** Small pill shown instead of the Dashboard link for a non-approved account. */
function WaitingBadge({ accessStatus }: { accessStatus: "pending" | "rejected" }) {
  const Icon = accessStatus === "pending" ? ClockIcon : MailIcon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground select-none">
      <Icon className="size-3.5" />
      {accessStatus === "pending" ? "Waiting for approval" : "Access not available"}
    </span>
  );
}

export function Navbar({ accessStatus }: NavbarProps) {
  const { status } = useSession();
  const isSignedIn = status === "authenticated";
  const waiting = isSignedIn && (accessStatus === "pending" || accessStatus === "rejected");

  return (
    // Above the page blur (z-40) but below z-50 takeovers, so the contact
    // screen and dialogs cover the navbar instead of it floating over them
    // and swallowing their clicks.
    <header className="fixed inset-x-0 top-3 z-[45] px-4">
      <nav className="mx-auto flex max-w-5xl items-center justify-between rounded-xl border border-zinc-950/10 bg-background/80 p-1.5 text-foreground shadow-[0_2px_8px_rgba(9,9,11,0.01)] inset-shadow-2xs inset-shadow-white/60 backdrop-blur-md dark:border-zinc-800/80 dark:inset-shadow-zinc-950/20">
        <Brand />

        <div className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {isSignedIn && (
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Sign out
            </Button>
          )}
          {!isSignedIn && (
            <Button variant="ghost" asChild>
              <Link href="/login">Log in</Link>
            </Button>
          )}
          {waiting ? (
            <WaitingBadge accessStatus={accessStatus as "pending" | "rejected"} />
          ) : (
            <RichButton color="primary" size="sm" asChild>
              <Link href={isSignedIn ? "/dashboard" : "/signup"}>
                {isSignedIn ? "Dashboard" : "Join waitlist"}
              </Link>
            </RichButton>
          )}
        </div>

        <MobileNav isSignedIn={isSignedIn} accessStatus={accessStatus} />
      </nav>
    </header>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5">
      <BrandLogo className="size-9 shrink-0" aria-hidden />
      <span className="truncate text-sm font-semibold tracking-normal text-[#0A0A0A]">
        Letterstack
      </span>
    </Link>
  );
}

function MobileNav({ isSignedIn, accessStatus }: { isSignedIn: boolean } & NavbarProps) {
  const waiting = isSignedIn && (accessStatus === "pending" || accessStatus === "rejected");

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation"
        >
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(24rem,calc(100vw-2rem))]">
        <SheetHeader>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-6 p-4 pt-12">
          <Brand />
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <SheetClose key={item.href} asChild>
                <Link
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              </SheetClose>
            ))}
          </div>
          <div className="mt-auto flex flex-col gap-2">
            {!isSignedIn && (
              <SheetClose asChild>
                <Button variant="outline" asChild>
                  <Link href="/login">Log in</Link>
                </Button>
              </SheetClose>
            )}
            {waiting ? (
              <div className="flex justify-center">
                <WaitingBadge accessStatus={accessStatus as "pending" | "rejected"} />
              </div>
            ) : (
              <SheetClose asChild>
                <RichButton color="primary" size="sm" asChild>
                  <Link href={isSignedIn ? "/dashboard" : "/signup"}>
                    {isSignedIn ? "Dashboard" : "Join waitlist"}
                  </Link>
                </RichButton>
              </SheetClose>
            )}
            {isSignedIn && (
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  Sign out
                </Button>
              </SheetClose>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
