"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { MenuIcon } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { ContactLink } from "@/components/marketing/contact-link";
import { StartCtaLink } from "@/components/start-cta";
import { Button } from "@/components/ui/button";
import { signOutAndClearDrafts } from "@/lib/editor/sign-out";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// Marketing navbar, modelled on Dub's (dub.co): sticky at the top of the
// page, taking its own 56px so nothing needs padding to clear it.
//
// It has two states. At the very top it has no background and no line, and
// sits directly on the page. Once the page scrolls, a near-opaque white layer
// with a hairline fades in behind it, so content passing underneath stays out
// of the way. The background lives on its own absolutely positioned layer,
// so only that layer transitions.
//
// Its content lines up with the page grid: same 1200px column, and the logo
// starts on the same left edge as the text in the sections below.

// Sections of the landing page, plus Pricing (its own route) and Contact
// (opens the contact form).
const NAV_ITEMS = [
  { href: "/#product", label: "Product" },
  { href: "/#features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "contact", label: "Contact" },
] as const;

// The page's one focus ring (same as landing-ui.tsx's focusRing).
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6c5ed1]";

// The page's button shape at navbar size: 32px tall, 8px radius, 14px medium.
const buttonShape = cn(
  "inline-flex h-8 items-center justify-center rounded-lg px-4 text-sm font-medium whitespace-nowrap transition-colors",
  focusRing,
);
const outlineButton = cn(
  buttonShape,
  "border border-neutral-200 bg-white text-neutral-950 hover:bg-neutral-50",
);
const solidButton = cn(buttonShape, "bg-neutral-950 text-white hover:bg-neutral-800");

const navLink = cn(
  "inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-950",
  focusRing,
);
const sheetLink = cn(
  "flex h-11 items-center rounded-lg px-3 text-[15px] font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-950",
  focusRing,
);

/** True once the page has scrolled away from the very top. */
function useScrolled(threshold = 4) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [threshold]);
  return scrolled;
}

function Brand() {
  return (
    <Link href="/" className={cn("flex w-fit shrink-0 items-center gap-2 rounded-lg", focusRing)}>
      <BrandLogo className="size-7 shrink-0" aria-hidden />
      <span className="whitespace-nowrap text-[15px] font-semibold text-neutral-950">
        LetterStack
      </span>
    </Link>
  );
}

export function Navbar() {
  const { status } = useSession();
  const isSignedIn = status === "authenticated";
  const scrolled = useScrolled();

  return (
    // Above page content but below z-50 takeovers, so the contact screen and
    // dialogs cover the navbar instead of it floating over them.
    <header className="sticky inset-x-0 top-0 z-[45] w-full">
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 border-b transition-colors duration-200",
          scrolled ? "border-neutral-200 bg-white/90 backdrop-blur-md" : "border-transparent",
        )}
      />
      {/* Two items on phones (brand, menu), three columns from md up with the
          links truly centred. */}
      <nav className="relative mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between gap-6 px-4 sm:px-8 md:grid md:grid-cols-[1fr_auto_1fr]">
        <Brand />

        <div className="hidden items-center justify-center gap-1 md:flex">
          {NAV_ITEMS.map((item) =>
            item.href === "contact" ? (
              <ContactLink key={item.label} className={navLink}>
                {item.label}
              </ContactLink>
            ) : (
              <Link key={item.label} href={item.href} className={navLink}>
                {item.label}
              </Link>
            ),
          )}
        </div>

        <div className="flex items-center justify-self-end">
          <div className="hidden items-center gap-2 md:flex">
            {isSignedIn ? (
              <button
                type="button"
                className={outlineButton}
                onClick={() => signOutAndClearDrafts({ callbackUrl: "/" })}
              >
                Sign out
              </button>
            ) : (
              <Link href="/login" className={outlineButton}>
                Log in
              </Link>
            )}
            <StartCtaLink className={solidButton} />
          </div>

          <MobileNav isSignedIn={isSignedIn} />
        </div>
      </nav>
    </header>
  );
}

function MobileNav({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 size-11 text-neutral-700 hover:bg-neutral-100 md:hidden"
          aria-label="Open navigation"
        >
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(24rem,calc(100vw-2rem))]">
        <SheetHeader>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
        </SheetHeader>
        <div className="flex h-full flex-col gap-6 p-4 pt-10">
          <div className="px-3">
            <Brand />
          </div>
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <SheetClose key={item.label} asChild>
                {item.href === "contact" ? (
                  <ContactLink className={sheetLink}>{item.label}</ContactLink>
                ) : (
                  <Link href={item.href} className={sheetLink}>
                    {item.label}
                  </Link>
                )}
              </SheetClose>
            ))}
          </div>
          <div className="mt-auto flex flex-col gap-2">
            {isSignedIn ? (
              <SheetClose asChild>
                <button
                  type="button"
                  className={cn(outlineButton, "h-11")}
                  onClick={() => signOutAndClearDrafts({ callbackUrl: "/" })}
                >
                  Sign out
                </button>
              </SheetClose>
            ) : (
              <SheetClose asChild>
                <Link href="/login" className={cn(outlineButton, "h-11")}>
                  Log in
                </Link>
              </SheetClose>
            )}
            <SheetClose asChild>
              <StartCtaLink className={cn(solidButton, "h-11")} />
            </SheetClose>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
