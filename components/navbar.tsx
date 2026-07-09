"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/features", homeHref: "#features", label: "Features" },
  { href: "/design", label: "Design" },
  { href: "/templates", label: "Templates" },
  { href: "/pricing", homeHref: "#pricing", label: "Pricing" },
  { href: "/about", homeHref: "#about", label: "About" },
  { href: "/contact", homeHref: "#contact", label: "Contact" },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const { status } = useSession();
  const isSignedIn = status === "authenticated";

  return (
    <header className="fixed inset-x-0 top-0 z-[60] px-3 py-2 sm:px-4">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between rounded-full border border-border bg-background/95 px-4 text-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
        <Brand />

        <div className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={getItemHref(item, pathname)}
              active={isActivePath(item.href, pathname)}
            >
              {item.label}
            </NavLink>
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

        <MobileNav pathname={pathname} isSignedIn={isSignedIn} />
      </nav>
    </header>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Layers2Icon className="size-4" />
      </span>
      <span className="truncate text-sm font-semibold tracking-normal">
        LetterStack
      </span>
    </Link>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground",
        active && "text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function MobileNav({
  pathname,
  isSignedIn,
}: {
  pathname: string;
  isSignedIn: boolean;
}) {
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
                  href={getItemHref(item, pathname)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    isActivePath(item.href, pathname) && "bg-muted text-foreground",
                  )}
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

function getItemHref(item: (typeof NAV_ITEMS)[number], pathname: string) {
  return pathname === "/" && "homeHref" in item ? item.homeHref : item.href;
}

function isActivePath(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}