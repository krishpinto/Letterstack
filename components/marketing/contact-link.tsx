"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// A link that opens the contact form (the full-screen takeover that lives on
// the landing page, app/(hero)/_components/contact-sales-screen.tsx).
//
// On the landing page it opens the form in place, by firing a window event
// the form listens for. From any other page it navigates to the landing page
// with a hash, and the form opens itself when it sees that hash on load.

export const OPEN_CONTACT_EVENT = "letterstack:open-contact";
export const CONTACT_HASH = "#contact-us";

export function ContactLink({
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, "href">) {
  const pathname = usePathname();

  return (
    <Link
      href={`/${CONTACT_HASH}`}
      onClick={(event) => {
        onClick?.(event);
        if (pathname === "/") {
          event.preventDefault();
          window.dispatchEvent(new Event(OPEN_CONTACT_EVENT));
        }
      }}
      {...props}
    />
  );
}
