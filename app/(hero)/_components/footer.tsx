import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { ContactLink } from "@/components/marketing/contact-link";
import { cn } from "@/lib/utils";

import { FooterHands } from "./footer-hands";
import { Frame } from "./frame";
import { focusRing } from "./landing-ui";

const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@letterstack.site";

// Footer: the two hands passing the envelope (the page's sign-off image),
// then a Dub-style link grid, both inside the page frame.

type FooterLink = { label: string; href: string } | { label: string; contact: true };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Tour", href: "/#product" },
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Get started", href: "/signup" },
      { label: "Log in", href: "/login" },
    ],
  },
  {
    title: "Company",
    links: [
      // Opens the contact form, the same as "Contact" in the navbar.
      { label: "Contact", contact: true },
      // Google's OAuth review requires the privacy policy to be reachable
      // from the homepage, so these stay in the footer.
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

// Taller on phones so each link is a comfortable tap target.
const linkClass = cn(
  "inline-flex min-h-9 items-center rounded-md text-sm text-neutral-600 transition-colors hover:text-neutral-950 sm:min-h-0",
  focusRing,
);

export function Footer() {
  return (
    <footer className="w-full bg-white">
      <Frame innerClassName="overflow-hidden">
        <FooterHands />
      </Frame>

      <Frame last>
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 px-6 py-12 sm:grid-cols-[1.4fr_repeat(3,1fr)] sm:px-8 sm:py-14">
          <div className="col-span-2 flex flex-col gap-3 sm:col-span-1">
            <Link href="/" className={cn("flex w-fit items-center gap-2 rounded-lg", focusRing)}>
              <BrandLogo className="size-7 shrink-0" aria-hidden />
              <span className="text-[15px] font-semibold text-neutral-950">LetterStack</span>
            </Link>
            <p className="max-w-[16rem] text-sm leading-relaxed text-neutral-600">
              Newsletters for organisations, sent from your own domain.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-sm font-medium text-neutral-950">{column.title}</h2>
              <ul className="mt-3 flex flex-col gap-0 sm:gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {"contact" in link ? (
                      <ContactLink className={linkClass}>{link.label}</ContactLink>
                    ) : (
                      <Link href={link.href} className={linkClass}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Runs rail to rail, like every other rule on the page. */}
        <div className="flex flex-col gap-2 border-t border-neutral-200 px-6 py-6 text-[13px] text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} LetterStack</p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className={cn("w-fit rounded-md transition-colors hover:text-neutral-950", focusRing)}
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      </Frame>
    </footer>
  );
}
