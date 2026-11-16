import Link from "next/link";
import { Accordion } from "radix-ui";
import { MessageCircleQuestion, Plus } from "lucide-react";

import { PLAN_LIMITS } from "@/lib/plans/limits";

import { Frame } from "../frame";
import { SectionIntro } from "../landing-ui";

// Questions an organisation asks before it signs up. Every answer describes
// what the code does today; where a fact lives in the code or the legal
// pages, the comment above the answer says where, so it can be rechecked
// when that code changes. Plan figures are read from lib/plans/limits.ts.
//
// The accordion is Radix's, so keyboard support comes with it: Tab moves
// between questions, Enter or Space opens one, arrow keys, Home and End move
// between headers. Opening and closing animate the height and respect
// prefers-reduced-motion.

const free = PLAN_LIMITS.free;

// ["1 signup form", "Full block editor"] -> "1 signup form and full block editor"
function listOf(items: string[]) {
  const lower = items.map((s) => s.charAt(0).toLowerCase() + s.slice(1));
  return lower.length > 1 ? `${lower.slice(0, -1).join(", ")} and ${lower.at(-1)}` : lower.join("");
}

type Item = { q: string; a: React.ReactNode };

const ITEMS: Item[] = [
  {
    // lib/send/sender-identity.ts (shared MAIL_FROM default, isAllowedFromEmail),
    // lib/send/domain-identity.ts (DKIM + MAIL FROM records, shown not set),
    // app/dashboard/domains, PLAN_LIMITS.*.domains.
    q: "Do I need my own domain?",
    a: (
      <>
        No. Until you add one, campaigns go out from LetterStack&apos;s shared sending
        address. To send from an address on your own domain, add the domain on the Domains
        page and copy the DNS records it shows into your DNS provider. You can use it once
        they verify. Every plan includes at least {free.domains} sending domain.
      </>
    ),
  },
  {
    // lib/email/compiler.ts (unsubscribe link in every email), lib/send/ses.ts
    // (List-Unsubscribe + one-click headers), lib/webhooks/ses-event.ts (hard
    // bounces and complaints suppress, soft bounces don't), app/api/unsubscribe,
    // lib/send/send-campaign.ts and app/api/audience/import (suppressed skipped),
    // Terms "Sending limits" (permanent suppression).
    q: "What happens to bounces and unsubscribes?",
    a: (
      <>
        Every email has an unsubscribe link and a one-click unsubscribe header. When someone
        unsubscribes, an address hard-bounces, or a recipient marks you as spam, the address
        goes on your workspace&apos;s suppression list. LetterStack skips it on every later
        send and import, permanently. Soft bounces, like a full mailbox, are recorded but
        not suppressed.
      </>
    ),
  },
  {
    // app/dashboard/contacts/import-wizard.tsx (.csv/.xlsx/.xls, folder picker),
    // lib/import/validation.ts (syntax, dead domain, disposable are dropped),
    // app/api/audience/import (duplicates and suppressed addresses skipped).
    q: "Can I import my existing list?",
    a: (
      <>
        Yes. Upload a CSV or Excel file and put the contacts straight into a folder.
        LetterStack drops addresses that can&apos;t receive mail (bad syntax, domains that
        can&apos;t take mail, disposable inboxes) and skips duplicates and anyone already on your
        suppression list.
      </>
    ),
  },
  {
    // lib/email/compiler.ts (table layout, MSO conditional wrapper, numeric image
    // widths for Outlook, .ls-col mobile stacking, plain-text part),
    // lib/send/ses.ts (text + HTML), app/api/campaigns/[id]/test (test send).
    q: "Will it look right in Outlook and Gmail?",
    a: (
      <>
        That&apos;s what the editor is built for. It compiles each email to table-based HTML
        with specific fixes for Outlook on Windows, columns stack on phones, and every send
        includes a plain-text version. Send yourself a test before the real thing to check.
      </>
    ),
  },
  {
    // PLAN_LIMITS.free (contacts, emailsPerMonth, domains, apiRequestsPerMonth,
    // extras, blurb); "No card needed on Free" is on /pricing (pricing-02.tsx).
    q: "What does the free plan include?",
    a: (
      <>
        {free.contacts.toLocaleString("en-IN")} contacts,{" "}
        {free.emailsPerMonth.toLocaleString("en-IN")} emails a month and {free.domains}{" "}
        sending domain, plus {listOf(free.extras)}. No card needed. It&apos;s
        sized for building a real campaign and sending it to a small test list. For a full
        newsletter, see <Link href="/pricing">the paid plans</Link>.
      </>
    ),
  },
  {
    // lib/payments/catalog.ts (one-time payments of 30 or 365 days, no recurring
    // billing), Terms "Plans, payment and refunds" (returns to Free, data kept).
    q: "Is there a contract?",
    a: (
      <>
        No. A paid plan is a one-off payment for a month or a year, through Razorpay, and
        nothing renews automatically. When the period ends, the workspace goes back to Free.
        Your lists, drafts and history stay; the Free limits apply from then on.
      </>
    ),
  },
  {
    // Terms "What you may and may not send" and "Sending limits, monitoring and
    // suspension".
    q: "Can I send to any list I have?",
    a: (
      <>
        Only to people who agreed to hear from you, or who have a genuine existing relationship
        with you, such as your members. Bought, rented or scraped lists are not allowed. A send
        with high bounce or complaint rates can be paused, because every customer shares the
        same sending reputation.
      </>
    ),
  },
  {
    // Privacy "Who we share data with" and "Where data is processed"; Privacy
    // "Two different roles" (your list is yours, processed on your instructions).
    q: "Where is my data stored?",
    a: (
      <>
        Email is sent through Amazon SES in Mumbai (ap-south-1). The database, hosting and
        other providers run in the United States and the European Union, so data may be
        processed outside India. Your lists stay yours: we use them only to send your
        campaigns, and never sell them. The <Link href="/privacy">Privacy Policy</Link> lists
        every provider.
      </>
    ),
  },
];

export function Faq() {
  return (
    <Frame id="faq">
      <style>{`
        @keyframes faq-open { from { height: 0 } to { height: var(--radix-accordion-content-height) } }
        @keyframes faq-close { from { height: var(--radix-accordion-content-height) } to { height: 0 } }
        .faq-content[data-state="open"] { animation: faq-open 220ms cubic-bezier(0.22, 1, 0.36, 1); }
        .faq-content[data-state="closed"] { animation: faq-close 180ms cubic-bezier(0.22, 1, 0.36, 1); }
        @media (prefers-reduced-motion: reduce) {
          .faq-content[data-state] { animation: none; }
        }
      `}</style>

      <SectionIntro
        icon={MessageCircleQuestion}
        eyebrow="FAQ"
        title="Questions before you sign up"
        description="Short answers. The long ones are in the Terms and the Privacy Policy."
      />

      <Accordion.Root
        type="single"
        collapsible
        className="divide-y divide-neutral-200 border-t border-neutral-200"
      >
        {ITEMS.map((item) => (
          <Accordion.Item key={item.q} value={item.q}>
            <Accordion.Header asChild>
              <h3>
                <Accordion.Trigger className="group flex w-full items-center justify-between gap-6 px-6 py-5 text-left text-[15px] font-medium text-neutral-950 transition-colors hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#6c5ed1] sm:px-8 sm:py-6 sm:text-base">
                  {item.q}
                  <Plus
                    className="size-4 shrink-0 text-neutral-400 transition-transform duration-200 group-data-[state=open]:rotate-45 motion-reduce:transition-none"
                    aria-hidden
                  />
                </Accordion.Trigger>
              </h3>
            </Accordion.Header>
            <Accordion.Content className="faq-content overflow-hidden">
              <div className="max-w-2xl px-6 pb-6 text-pretty text-sm leading-relaxed text-neutral-500 sm:px-8 sm:text-[15px] [&_a]:font-medium [&_a]:text-neutral-950 [&_a]:underline [&_a]:underline-offset-4">
                {item.a}
              </div>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </Frame>
  );
}
