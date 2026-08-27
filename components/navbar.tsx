"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { MenuIcon } from "lucide-react";

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

// Every item points at a section of the landing page itself — the marketing
// subpages are gone, so the nav scrolls instead of navigating.
const NAV_ITEMS = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#testimonials", label: "Testimonials" },
  { href: "/#contact", label: "Contact" },
] as const;

// Fixed dark pill regardless of the page's forced theme — this bar is
// deliberately always #1a1a1a, not `bg-background`, so every child below
// uses hardcoded light-on-dark colors instead of theme tokens (which would
// resolve to light-theme values here and disappear against the dark bg).

export function Navbar() {
  const { status } = useSession();
  const isSignedIn = status === "authenticated";

  return (
    // Above the page blur (z-40) but below z-50 takeovers, so the contact
    // screen and dialogs cover the navbar instead of it floating over them
    // and swallowing their clicks.
    <header className="fixed inset-x-0 top-3 z-[45] px-4">
      {/* grid, not flex justify-between — with a middle group whose own
          width can differ from the outer two, justify-between just spaces
          all three by the leftover gap, it doesn't actually CENTER the
          middle one under the bar. A 3-column grid with the center column
          taking the remaining space (1fr) gives a true, distinct
          left/center/right layout regardless of how wide Brand or the
          actions group are. */}
      {/* max-w-4xl — measured the actual content (brand + 4 links + the
          widest actions combo) at ~793px minimum with no wrapping, so this
          still has ~100px of margin. max-w-3xl (768px) was the one that broke:
          below its true minimum, which forced the grid to squeeze the
          center column until "How it works" wrapped and the brand name
          truncated. whitespace-nowrap on the links stays on as a second
          line of defense regardless. */}
      <nav className="mx-auto grid max-w-4xl grid-cols-[auto_1fr_auto] items-center gap-6 rounded-xl border border-white/10 bg-[#1a1a1a] px-2 py-1.5 text-white shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        <Brand />

        <div className="hidden items-center justify-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[13px] font-medium whitespace-nowrap text-white/85 transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Right column: desktop actions + mobile trigger share this one
            grid cell — they never show at the same time (one's md:flex,
            the other md:hidden), but both need to live in col 3, not
            spawn a 4th grid track that'd wrap the hamburger onto its own
            row on mobile. */}
        <div className="flex items-center justify-self-end">
          <div className="hidden items-center gap-3 md:flex">
            {isSignedIn && (
              <Button
                variant="ghost"
                className="text-white/80 hover:bg-white/10 hover:text-white"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Sign out
              </Button>
            )}
            {!isSignedIn && (
              <Button
                variant="ghost"
                className="text-white/80 hover:bg-white/10 hover:text-white"
                asChild
              >
                <Link href="/login">Log in</Link>
              </Button>
            )}
            <RichButton color="primary" size="sm" asChild>
              <Link href={isSignedIn ? "/dashboard" : "/signup"}>
                {isSignedIn ? "Dashboard" : "Get started"}
              </Link>
            </RichButton>
          </div>

          <MobileNav isSignedIn={isSignedIn} />
        </div>
      </nav>
    </header>
  );
}

function Brand() {
  return (
    // No min-w-0/truncate: "Letterstack" is a fixed short string that
    // should never need clipping — min-w-0 on a grid item lets it shrink
    // below its content's natural width when the row is tight, which is
    // exactly what caused it to truncate to "Letters…" once the center
    // column got squeezed.
    <Link href="/" className="flex shrink-0 items-center gap-2.5">
      <BrandLogo className="size-9 shrink-0" aria-hidden />
      <span className="whitespace-nowrap text-lg font-semibold tracking-normal text-white">
        Letterstack
      </span>
    </Link>
  );
}

function MobileNav({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-white/80 hover:bg-white/10 hover:text-white md:hidden"
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
          <Link href="/" className="flex w-fit items-center gap-2.5">
            <BrandLogo className="size-9 shrink-0" aria-hidden />
            <span className="text-sm font-semibold tracking-normal text-foreground">
              Letterstack
            </span>
          </Link>
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
            <SheetClose asChild>
              <RichButton color="primary" size="sm" asChild>
                <Link href={isSignedIn ? "/dashboard" : "/signup"}>
                  {isSignedIn ? "Dashboard" : "Get started"}
                </Link>
              </RichButton>
            </SheetClose>
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
