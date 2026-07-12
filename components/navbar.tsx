"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Layers2Icon } from "lucide-react";

import { RichButton } from "@/components/rich-button";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { status } = useSession();
  const isSignedIn = status === "authenticated";

  return (
    <header className="fixed inset-x-0 top-3 z-[60] px-4">
      <nav className="mx-auto flex max-w-5xl items-center justify-between rounded-xl border border-zinc-950/10 bg-background/80 p-1.5 text-foreground shadow-[0_2px_8px_rgba(9,9,11,0.01)] inset-shadow-2xs inset-shadow-white/60 backdrop-blur-md dark:border-zinc-800/80 dark:inset-shadow-zinc-950/20">
        <Brand />

        <div className="flex items-center gap-2">
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
