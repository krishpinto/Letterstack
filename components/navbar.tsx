"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { MenuIcon } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { RichButton } from "@/components/rich-button";
import { StartCtaLink } from "@/components/start-cta";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// Mostly sections of the landing page itself — the marketing subpages are
// gone, so those items scroll instead of navigating. Pricing is the one real
// route left, and it sits next to the section links rather than off in the
// actions group because it's something people look for, not an action.
const NAV_ITEMS = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#testimonials", label: "Testimonials" },
  { href: "/#contact", label: "Contact" },
] as const;

// Two palettes, picked by what is physically behind the bar.
//
// One palette cannot serve both. The landing page opens on a full-bleed
// purple sky photo; every other marketing route is white from the first
// pixel, with a white footer under it. A dark bar on /pricing was the only
// dark element on an otherwise white page, and a translucent white bar over
// the hero photo just soaked up the purple and read as a washed-out lavender
// slab — worse than the dark one it replaced.
//
// So: dark over the photo, light over white. The routes below are the ones
// whose FIRST SCREEN is a photo, which is the only thing that matters — the
// bar is fixed to the top and never scrolls into the sections underneath.
// This has to be maintained by hand for the same reason LIGHT_ROUTES in
// app/providers.tsx does: usePathname cannot see the route group. If you add
// a marketing page that opens on a full-bleed image, add it here.
const PHOTO_HERO_ROUTES = new Set(["/"]);

// Hardcoded colors rather than theme tokens, matching the footer, which is
// also hardcoded — these two components bracket every marketing page and
// have to agree exactly. The group is force-light anyway, so `bg-background`
// would resolve light in both branches and the dark bar would vanish.
const TONES = {
  dark: {
    bar: "border-white/10 bg-[#1a1a1a] text-white shadow-[0_4px_20px_rgba(0,0,0,0.4)]",
    brand: "text-white",
    link: "text-white/85 hover:text-white",
    ghost: "text-white/80 hover:bg-white/10 hover:text-white",
  },
  light: {
    // No backdrop-blur here: with nothing but flat white behind it there is
    // nothing to blur, and the translucency is what ruined the dark-photo
    // case. Opaque white + a hairline border is what reads as a pill.
    bar: "border-[#0A0A0A]/10 bg-white text-[#0A0A0A] shadow-[0_4px_20px_rgba(10,10,10,0.08)]",
    brand: "text-[#0A0A0A]",
    link: "text-[#52525B] hover:text-[#0A0A0A]",
    ghost: "text-[#52525B] hover:bg-[#0A0A0A]/5 hover:text-[#0A0A0A]",
  },
} as const;

export function Navbar() {
  const { status } = useSession();
  const isSignedIn = status === "authenticated";
  const pathname = usePathname();
  const tone = PHOTO_HERO_ROUTES.has(pathname) ? TONES.dark : TONES.light;

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
      {/* max-w-5xl — was 4xl (896px) when this held 4 links, measured at
          ~793px minimum. Adding "Pricing" puts the true minimum at ~870px,
          which left under 30px of margin: close enough to the edge that a
          font fallback or a wider label would start wrapping "How it works"
          and truncating the brand, the exact failure max-w-3xl caused
          before. 5xl (1024px) restores the margin the 4-link bar had.
          whitespace-nowrap on the links stays on as a second line of
          defense regardless. */}
      <nav
        className={cn(
          "mx-auto grid max-w-5xl grid-cols-[auto_1fr_auto] items-center gap-6 rounded-xl border px-2 py-1.5",
          tone.bar,
        )}
      >
        <Brand className={tone.brand} />

        <div className="hidden items-center justify-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-[13px] font-medium whitespace-nowrap transition-colors",
                tone.link,
              )}
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
                className={tone.ghost}
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Sign out
              </Button>
            )}
            {!isSignedIn && (
              <Button
                variant="ghost"
                className={tone.ghost}
                asChild
              >
                <Link href="/login">Log in</Link>
              </Button>
            )}
            <RichButton color="primary" size="sm" asChild>
              <StartCtaLink />
            </RichButton>
          </div>

          <MobileNav isSignedIn={isSignedIn} triggerClassName={tone.ghost} />
        </div>
      </nav>
    </header>
  );
}

function Brand({ className }: { className?: string }) {
  return (
    // No min-w-0/truncate: "Letterstack" is a fixed short string that
    // should never need clipping — min-w-0 on a grid item lets it shrink
    // below its content's natural width when the row is tight, which is
    // exactly what caused it to truncate to "Letters…" once the center
    // column got squeezed.
    <Link href="/" className="flex shrink-0 items-center gap-2.5">
      <BrandLogo className="size-9 shrink-0" aria-hidden />
      <span
        className={cn(
          "whitespace-nowrap text-lg font-semibold tracking-normal",
          className,
        )}
      >
        Letterstack
      </span>
    </Link>
  );
}

function MobileNav({
  isSignedIn,
  triggerClassName,
}: {
  isSignedIn: boolean;
  triggerClassName?: string;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {/* Only the trigger takes the bar's tone — the sheet itself is a
            separate surface on theme tokens, which are light either way. */}
        <Button
          variant="ghost"
          size="icon"
          className={cn("md:hidden", triggerClassName)}
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
                <StartCtaLink />
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
