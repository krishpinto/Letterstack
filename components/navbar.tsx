"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Layers2Icon, MenuIcon } from "lucide-react";
import { motion } from "motion/react";

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

const NAV_TRANSITION = {
  type: "spring",
  stiffness: 260,
  damping: 32,
  mass: 0.9,
} as const;

export function Navbar() {
  const pathname = usePathname();
  const { status } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const isSignedIn = status === "authenticated";

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-[60]"
      animate={{
        paddingTop: scrolled ? 8 : 0,
        paddingBottom: scrolled ? 8 : 0,
        paddingLeft: scrolled ? 16 : 0,
        paddingRight: scrolled ? 16 : 0,
      }}
      transition={NAV_TRANSITION}
    >
      <motion.nav
        className={cn(
          "mx-auto flex h-14 items-center justify-between border-border bg-background/95 px-4 text-foreground backdrop-blur transition-[max-width,box-shadow] duration-300 ease-out supports-[backdrop-filter]:bg-background/80 sm:px-6",
          scrolled
            ? "max-w-5xl rounded-full border shadow-sm"
            : "max-w-none rounded-none border-b",
        )}
        animate={{ borderRadius: scrolled ? 999 : 0 }}
        transition={NAV_TRANSITION}
      >
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
      </motion.nav>
    </motion.header>
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
