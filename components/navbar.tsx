"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Layers2Icon, MenuIcon } from "lucide-react";

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

export function Navbar() {
  const { status } = useSession();
  const isSignedIn = status === "authenticated";

  return (
    <header className="fixed inset-x-0 top-3 z-[60] px-4">
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
          <RichButton color="primary" size="sm" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </RichButton>
        </div>

        <MobileNav isSignedIn={isSignedIn} />
      </nav>
    </header>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shadow-xs shadow-zinc-950/10">
        <Layers2Icon className="size-4.5" />
      </span>
      <span className="truncate text-sm font-semibold tracking-normal text-[#0A0A0A]">
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
            <SheetClose asChild>
              <RichButton color="primary" size="sm" asChild>
                <Link href="/dashboard">Dashboard</Link>
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
