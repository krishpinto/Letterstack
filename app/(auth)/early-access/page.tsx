import Link from "next/link";
import { ArrowRightIcon, CheckIcon, ClockIcon, MailIcon } from "lucide-react";

import { auth } from "@/lib/auth";
import { getEarlyAccessInfo, markWaitlistAppliedEmailSent } from "@/db/access";
import { sendWaitlistAppliedEmail } from "@/lib/waitlist-emails";
import { BrandLogo } from "@/components/brand-logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";

const REASONS = [
  "Real responsive HTML — no Gmail clipping, no flattened images",
  "Send from your own domain via Amazon SES",
  "No lock-in, no per-contact markup",
];

// proxy.ts sends every non-approved visitor here, including anonymous ones —
// this page doubles as the public "apply for early access" landing page
// (no session) and the pending/rejected status page (signed in, not yet
// approved). proxy.ts also guarantees approved users never reach this route.
//
// Not in app/providers.tsx's isLightRoute list, so this renders in the
// app's normal dark theme like /login and /onboarding — every color here is
// a shadcn/Tailwind theme token (bg-background, text-foreground, etc.), no
// hardcoded hex, so it stays correct if the theme or its tokens ever change.
//
// The "you're on the list" email is sent from here (a normal Node.js server
// component), not from signup/Google sign-in — those live in lib/auth.ts,
// which is shared with proxy.ts's edge-bundled middleware, and the AWS SDK
// used to send mail doesn't belong in that bundle. Every pending user's
// first request to this route naturally fires it exactly once, guarded by
// waitlist_applied_email_sent_at so a reload can't send a second copy.
export default async function EarlyAccessPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const info = userId ? await getEarlyAccessInfo(userId) : null;
  const rejected = info?.accessStatus === "rejected";
  const applying = !info;

  if (userId && info?.accessStatus === "pending" && !info.waitlistAppliedEmailSentAt) {
    const sent = await markWaitlistAppliedEmailSent(userId);
    if (sent) {
      void sendWaitlistAppliedEmail(info.email, info.name).catch((err) => {
        console.error("Failed to send waitlist applied email", err);
      });
    }
  }

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background px-6 py-16">
      {/* Ambient background accent — theme tokens only, so it reads right
          in dark mode instead of assuming a light background. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-12rem] size-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-14rem] right-[-8rem] size-[28rem] rounded-full bg-primary/5 blur-[110px]" />
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 text-center">
        {/* Brand + status pill */}
        <div className="flex flex-col items-center gap-4">
          <span className="flex items-center gap-2.5">
            <BrandLogo className="size-10" aria-hidden />
            <span className="text-base font-semibold tracking-normal text-foreground">
              LetterStack
            </span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-foreground shadow-xs select-none">
            <span className="relative flex size-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            Private beta — invite only
          </span>
        </div>

        {applying ? (
          <>
            <div className="flex flex-col items-center gap-4">
              <h1
                className="max-w-md text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl"
                style={{ fontFamily: "var(--font-bricolage, var(--font-inter))" }}
              >
                Apply for early access
              </h1>
              <p className="max-w-sm text-base leading-relaxed text-muted-foreground sm:text-lg">
                We're letting in a small number of orgs at a time. Apply below
                and you'll get an email the moment you're approved.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/signup">
                  Apply — sign up
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Already applied? Log in</Link>
              </Button>
            </div>

            <ul className="flex w-full max-w-sm flex-col gap-3 border-t border-dashed border-border pt-6 text-left">
              {REASONS.map((reason) => (
                <li key={reason} className="flex items-start gap-3 text-sm text-foreground">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <CheckIcon className="size-3" />
                  </span>
                  {reason}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                {rejected ? <MailIcon className="size-5" /> : <ClockIcon className="size-5" />}
              </div>
              <h1
                className="max-w-md text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl"
                style={{ fontFamily: "var(--font-bricolage, var(--font-inter))" }}
              >
                {rejected ? "Access isn't available right now" : "You're on the list"}
              </h1>
              <p className="max-w-sm text-base leading-relaxed text-muted-foreground sm:text-lg">
                {rejected
                  ? "This account doesn't have beta access at the moment. If you think that's a mistake, reach out and we'll take another look."
                  : "We're letting in a small number of beta orgs at a time. You'll get an email the moment your account is approved — no need to keep checking back."}
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Signed in as{" "}
                <span className="font-medium text-foreground">{session?.user?.email}</span>
              </p>
              <SignOutButton callbackUrl="/early-access" />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
