"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ClockIcon,
  GlobeIcon,
  MailIcon,
  MessageSquareIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RazorpayCheckoutButton } from "@/components/settings/razorpay-checkout-button";
import { checkoutItemsFor } from "@/lib/payments/catalog";
import {
  PLAN_LIMITS,
  PLAN_ORDER,
  planRank,
  type PlanKey,
} from "@/lib/plans/limits";

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

/** The allowance line under a tier's name, built from the enforced numbers. */
function quotaLine(plan: PlanKey) {
  const limits = PLAN_LIMITS[plan];
  const plus = limits.negotiable ? "+" : "";
  return (
    `${limits.contacts.toLocaleString("en-IN")}${plus} contacts · ` +
    `${limits.emailsPerMonth.toLocaleString("en-IN")}${plus} emails a month · ` +
    `${limits.domains}${plus} sending domain${limits.domains === 1 ? "" : "s"}`
  );
}

/**
 * One purchasable (or enquirable) tier. Rendered for the current plan when
 * it can be renewed, and for every tier above it.
 */
function PlanOffer({
  plan,
  heading,
  profile,
  onPaid,
}: {
  plan: PlanKey;
  heading: string;
  profile?: { name?: string | null; email?: string | null };
  onPaid: () => void;
}) {
  const limits = PLAN_LIMITS[plan];
  const items = checkoutItemsFor(plan);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{heading}</span>
        <span className="text-xs text-muted-foreground">{quotaLine(plan)}</span>
      </div>

      {items ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            {/* Annual first: it's the better deal and, until recurring billing
                exists, the one that doesn't need re-buying every month. */}
            <RazorpayCheckoutButton
              item={items.yearly}
              label={`₹${limits.yearlyPrice!.toLocaleString("en-IN")} / year`}
              prefill={profile}
              onPaid={onPaid}
            />
            <RazorpayCheckoutButton
              item={items.monthly}
              label={`₹${limits.monthlyPrice!.toLocaleString("en-IN")} / month`}
              prefill={profile}
              onPaid={onPaid}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Yearly is ten months&rsquo; price for twelve. Pay by UPI, card, or
            netbanking. Prices exclude GST.
          </p>
        </>
      ) : (
        <>
          {/* No checkout button by design — Business is quoted per deal, and
              the conversation before the first send is what keeps a bought
              list off our sending reputation. */}
          <Button variant="outline" className="w-fit" asChild>
            <Link href="/#contact">
              <MessageSquareIcon className="size-4" />
              Talk to us
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Priced per deal. Tell us your list size and how often you send, and
            we&rsquo;ll come back with a number.
          </p>
        </>
      )}
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
  plan?: PlanKey;
  planExpiresAt?: string | Date | null;
  isTrial?: boolean;
  trialEnded?: boolean;
  daysLeft?: number | null;
}) {
  const router = useRouter();
  const onPaidPlan = plan !== "free";
  const current = PLAN_LIMITS[plan];
  const refresh = () => router.refresh();

  // Every tier above the current one, cheapest first — so someone on Starter
  // is offered Growth and Business, not told to "upgrade to Pro" again.
  const upgrades = PLAN_ORDER.filter((key) => planRank(key) > planRank(plan));

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
        {onPaidPlan ? (
          <Badge className="h-5 bg-amber-400/15 px-2 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            {current.label}
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
          onPaidPlan
            ? "border-amber-500/25 bg-amber-500/[0.06]"
            : "border-border bg-muted/20"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
              onPaidPlan
                ? "bg-amber-400/20 text-amber-600 dark:text-amber-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {onPaidPlan ? (
              <ZapIcon className="size-3.5" />
            ) : (
              <ClockIcon className="size-3.5" />
            )}
          </span>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">
              {onPaidPlan
                ? `You're on ${current.label}`
                : trialEnded
                  ? "Your paid plan has ended"
                  : "You're on the Free plan"}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              {isTrial ? (
                <>
                  Your {current.label} plan runs until{" "}
                  <strong className="text-foreground">{until}</strong>
                  {typeof daysLeft === "number" ? ` — ${daysLeft} days left` : ""}.
                  This period is on us: nothing to pay and no card on file. Continue
                  below any time to carry straight on without interruption.
                </>
              ) : onPaidPlan ? (
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

      {/* Renewing the tier they already hold comes before upselling the next
          one — someone whose plan is about to lapse is here to keep what they
          have, not to be sold something bigger. */}
      {onPaidPlan && checkoutItemsFor(plan) ? (
        <PlanOffer
          plan={plan}
          heading={`Continue on ${current.label}`}
          profile={profile}
          onPaid={refresh}
        />
      ) : null}

      {upgrades.map((key) => (
        <PlanOffer
          key={key}
          plan={key}
          heading={`Upgrade to ${PLAN_LIMITS[key].label}`}
          profile={profile}
          onPaid={refresh}
        />
      ))}

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
            onPaid={refresh}
          />
        </div>
      ) : null}
    </div>
  );
}
