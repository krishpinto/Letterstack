"use client";

import { useRouter } from "next/navigation";
import { MessageCircleIcon, MailIcon, GlobeIcon } from "lucide-react";

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
        <span className={`text-sm tabular-nums ${near ? "text-destructive" : "text-muted-foreground"}`}>
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
  showCheckout = false,
  profile,
  plan = "free",
  planExpiresAt,
}: {
  sends: { used: number; limit: number };
  domains: { used: number; limit: number };
  /** Founder-only until there's a real plan to sell. */
  showCheckout?: boolean;
  profile?: { name?: string | null; email?: string | null };
  plan?: "free" | "pro";
  planExpiresAt?: string | Date | null;
}) {
  const router = useRouter();

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Billing & Plans</h3>
        <Badge className="h-5 bg-primary/10 px-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
          Beta
        </Badge>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <MessageCircleIcon className="size-3.5" />
          </span>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">A note from the team</p>
            <p className="text-sm leading-6 text-muted-foreground">
              We're in beta, so there's no pricing page yet — everyone gets free access while we
              iron things out. To keep sending fair and stable for early users, every workspace
              currently gets up to <strong className="text-foreground">5,000 emails</strong> and{" "}
              <strong className="text-foreground">2 sending domains</strong>. If you're bumping into
              that ceiling, we'd genuinely love to hear from you — that's useful signal for what
              paid plans should look like.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Usage
        </p>
        <UsageRow icon={MailIcon} label="Emails sent (beta cap)" used={sends.used} limit={sends.limit} />
        <UsageRow icon={GlobeIcon} label="Sending domains" used={domains.used} limit={domains.limit} />
      </div>

      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
        <p className="text-sm font-medium">Plans & billing — coming soon</p>
        <p className="mt-1 text-xs text-muted-foreground">
          We'll post pricing here once beta wraps up. No card on file, nothing to configure.
        </p>
      </div>

      {/* Open to every workspace. Nothing is gated on the plan yet, so this
          adds an option without changing anything for anyone who ignores it. */}
      <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-sm font-medium">
              {plan === "pro" ? "Pro — active" : "Pro"}
            </span>
            <span className="text-xs text-muted-foreground">
              {plan === "pro" && planExpiresAt
                ? `Expires ${new Date(planExpiresAt).toLocaleDateString()} — renew any time to add 30 days`
                : "₹5 for 30 days. Adds the Pro mark to your avatar."}
            </span>
          </span>
          {plan === "pro" && (
            <Badge className="h-5 shrink-0 bg-amber-400/15 px-2 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Pro
            </Badge>
          )}
        </div>
        <RazorpayCheckoutButton
          item="pro_monthly"
          label={plan === "pro" ? "Extend Pro (₹5)" : "Get Pro (₹5)"}
          prefill={profile}
          onPaid={() => router.refresh()}
        />
      </div>

      {showCheckout ? (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border px-4 py-4">
          <p className="text-xs text-muted-foreground">
            Founder-only: ₹1 payment for exercising the rail end to end.
          </p>
          <RazorpayCheckoutButton
            item="internal_test"
            label="Test payment (₹1)"
            prefill={profile}
          />
        </div>
      ) : null}
    </div>
  );
}
