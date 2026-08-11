"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ClockIcon,
  GlobeIcon,
  MailIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RazorpayCheckoutButton } from "@/components/settings/razorpay-checkout-button";

function UsageRow({
  icon: Icon,
  label,
  used,
  limit,
}: {
  icon: React.ElementType;
  label: string;
  used: number;
  limit: number;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const near = pct >= 90;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="size-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span
          className={`text-sm tabular-nums ${near ? "text-destructive" : "text-muted-foreground"}`}
        >
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

export function BillingPanel({
  sends,
  domains,
  contacts,
  showCheckout = false,
  profile,
  plan = "free",
  planExpiresAt,
  isTrial = false,
  trialEnded = false,
  daysLeft,
}: {
  sends: { used: number; limit: number };
  domains: { used: number; limit: number };
  contacts: { used: number; limit: number };
  /** Founder-only: exposes the ₹5 smoke-test purchase. */
  showCheckout?: boolean;
  profile?: { name?: string | null; email?: string | null };
  plan?: "free" | "pro";
  planExpiresAt?: string | Date | null;
  isTrial?: boolean;
  trialEnded?: boolean;
  daysLeft?: number | null;
}) {
  const router = useRouter();
  const onPro = plan === "pro";

  const until = planExpiresAt
    ? new Date(planExpiresAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Billing & Plans</h3>
        {onPro ? (
          <Badge className="h-5 bg-amber-400/15 px-2 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Pro
          </Badge>
        ) : (
          <Badge className="h-5 bg-muted px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Free
          </Badge>
        )}
      </div>

      {/* Current plan, and what happens next. This is the first thing someone
          checks when they hit a limit, so it leads rather than sits below the
          meters. */}
      <div
        className={`rounded-xl border p-4 ${
          onPro
            ? "border-amber-500/25 bg-amber-500/[0.06]"
            : "border-border bg-muted/20"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
              onPro
                ? "bg-amber-400/20 text-amber-600 dark:text-amber-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {onPro ? <ZapIcon className="size-3.5" /> : <ClockIcon className="size-3.5" />}
          </span>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">
              {onPro
                ? "You're on Pro"
                : trialEnded
                  ? "Your Pro plan has ended"
                  : "You're on the Free plan"}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              {isTrial ? (
                <>
                  Your Pro plan runs until{" "}
                  <strong className="text-foreground">{until}</strong>
                  {typeof daysLeft === "number" ? ` — ${daysLeft} days left` : ""}.
                  This period is on us: nothing to pay and no card on file. Continue
                  below any time to carry straight on without interruption.
                </>
              ) : onPro ? (
                <>
                  Your plan runs until{" "}
                  <strong className="text-foreground">{until}</strong>. Renewing adds
                  to the time you have left rather than replacing it.
                </>
              ) : trialEnded ? (
                <>
                  Everything you&rsquo;ve made is still here. Your workspace is now on
                  Free limits, so larger imports and sends will be held back until you
                  upgrade.
                </>
              ) : (
                <>
                  Free includes {contacts.limit.toLocaleString()} contacts and{" "}
                  {sends.limit.toLocaleString()} emails a month. Upgrade any time.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Usage
          </p>
          <Link
            href="/pricing"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Compare plans
          </Link>
        </div>
        <UsageRow icon={UsersIcon} label="Contacts" used={contacts.used} limit={contacts.limit} />
        <UsageRow icon={MailIcon} label="Emails this month" used={sends.used} limit={sends.limit} />
        <UsageRow icon={GlobeIcon} label="Sending domains" used={domains.used} limit={domains.limit} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">
            {onPro ? "Continue on Pro" : "Upgrade to Pro"}
          </span>
          <span className="text-xs text-muted-foreground">
            3,000 contacts · 15,000 emails a month · 2 sending domains
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {/* Annual first: it's the better deal and, until recurring billing
              exists, the one that doesn't need re-buying every month. */}
          <RazorpayCheckoutButton
            item="pro_yearly"
            label="₹4,999 / year"
            prefill={profile}
            onPaid={() => router.refresh()}
          />
          <RazorpayCheckoutButton
            item="pro_monthly"
            label="₹499 / month"
            prefill={profile}
            onPaid={() => router.refresh()}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Yearly is ten months&rsquo; price for twelve. Pay by UPI, card, or
          netbanking. Prices exclude GST.
        </p>
      </div>

      {showCheckout ? (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border px-4 py-4">
          <p className="text-xs text-muted-foreground">
            Founder-only: ₹5 purchase for exercising the live rail end to end.
            Grants 30 days of Pro like a real one.
          </p>
          <RazorpayCheckoutButton
            item="pro_smoke_test"
            label="Smoke test (₹5)"
            prefill={profile}
            onPaid={() => router.refresh()}
          />
        </div>
      ) : null}
    </div>
  );
}
