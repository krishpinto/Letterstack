"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useSession } from "next-auth/react";

/**
 * Where the primary "Get started" call to action goes, and what it says.
 *
 * Signed in, it goes to the dashboard — someone who already has an account
 * clicking the big button on the landing page wants their workspace, not a
 * login form. Signed out, it goes to /signup rather than /dashboard: signup
 * is open, and bouncing a new visitor off the dashboard into a login screen
 * would hide the one thing we want them to do.
 *
 * One definition, used by every CTA on the marketing site, so the header
 * button and the in-page buttons can't disagree about where they lead.
 */
export function useStartCta() {
  const { status } = useSession();
  const isSignedIn = status === "authenticated";

  return {
    isSignedIn,
    href: isSignedIn ? "/dashboard" : "/signup",
    label: isSignedIn ? "Dashboard" : "Get started",
  };
}

/**
 * The CTA as a link, for server components that would otherwise have to
 * become client components just to read the session. Renders the label
 * itself; `children` is for trailing decoration like an arrow icon.
 *
 * Spreads the rest of its props onto the Link so it still works as the child
 * of an `asChild` button, which clones this element to pass className down.
 */
export function StartCtaLink({
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { children?: ReactNode }) {
  const { href, label } = useStartCta();

  return (
    <Link href={href} {...props}>
      {label}
      {children}
    </Link>
  );
}
