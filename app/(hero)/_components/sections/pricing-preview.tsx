import Link from "next/link";
import { ArrowRight, Check, Tag } from "lucide-react";

import { ContactLink } from "@/components/marketing/contact-link";
import { StartCtaLink } from "@/components/start-cta";
import {
  PLAN_LIMITS,
  PLAN_ORDER,
  planHighlights,
  type PlanKey,
  yearlyPricing,
} from "@/lib/plans/limits";
import { cn } from "@/lib/utils";

import { Frame } from "../frame";
import { CellGrid, SectionIntro, button, displayFont, focusRing } from "../landing-ui";

// A compact version of /pricing. Every name, price and limit is read from
// lib/plans/limits.ts, the same table the app enforces, and formatted the way
// components/pricing-02.tsx formats it, so the two pages cannot disagree.
// Monthly prices only; the yearly discount is one line under the grid.

// Contacts, emails a month, sending domains: the first three entries of
// planHighlights. The rest are per-tier extras, which the full page lists.
const LIMITS_SHOWN = 3;

// Same figure the yearly toggle on /pricing advertises.
const yearly = yearlyPricing("pro");

// The tier /pricing highlights.
const FEATURED: PlanKey = "pro";

export function PricingPreview() {
  return (
    <Frame id="pricing">
      <SectionIntro
        icon={Tag}
        eyebrow="Pricing"
        title="Start free. Pay when your list grows."
        description="Each plan sets how many contacts you can keep and how many emails you can send a month. You pay for a month or a year up front, and nothing renews on its own."
      />

      <CellGrid className="sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_ORDER.map((key) => {
          const plan = PLAN_LIMITS[key];
          const featured = key === FEATURED;
          const limits = planHighlights(key).slice(0, LIMITS_SHOWN);

          return (
            <div key={key} className="flex flex-col bg-white p-6 sm:p-8">
              <h3 className="text-base font-semibold text-neutral-950">{plan.label}</h3>
              <p className="mt-1.5 text-pretty text-sm leading-relaxed text-neutral-500 sm:min-h-[2lh]">
                {plan.blurb}
              </p>

              <p className="mt-6 flex items-baseline gap-1.5">
                {plan.monthlyPrice === null ? (
                  // Quoted per deal on /pricing too: a number here would be made up.
                  <span
                    className="text-3xl font-semibold tracking-tight text-neutral-950"
                    style={displayFont}
                  >
                    Custom
                  </span>
                ) : (
                  <>
                    <span
                      className="text-3xl font-semibold tabular-nums tracking-tight text-neutral-950"
                      style={displayFont}
                    >
                      ₹{plan.monthlyPrice.toLocaleString("en-IN")}
                    </span>
                    <span className="text-sm text-neutral-400">/ month</span>
                  </>
                )}
              </p>

              <ul className="mt-6 space-y-2.5 border-t border-neutral-100 pt-6">
                {limits.map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-sm text-neutral-700">
                    <Check className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-1 flex-col justify-end">
                {plan.negotiable ? (
                  // Not self-serve: this tier goes to the contact form.
                  <ContactLink className={cn(button.secondary, "w-full justify-between")}>
                    Talk to us
                    <ArrowRight className="size-4" aria-hidden />
                  </ContactLink>
                ) : (
                  <StartCtaLink
                    className={cn(
                      featured ? button.primary : button.secondary,
                      "w-full justify-between",
                    )}
                  >
                    <ArrowRight className="size-4" aria-hidden />
                  </StartCtaLink>
                )}
              </div>
            </div>
          );
        })}
      </CellGrid>

      <div className="flex flex-col gap-3 border-t border-neutral-200 px-6 py-5 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="text-pretty">
          {yearly && <>Pay yearly and get {yearly.monthsFree} months free. </>}
          No card needed on Free. Prices in INR, exclusive of GST.
        </p>
        <Link
          href="/pricing"
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md font-medium text-neutral-950 underline-offset-4 hover:underline",
            focusRing,
          )}
        >
          See full pricing
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </Frame>
  );
}
