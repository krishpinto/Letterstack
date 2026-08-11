"use client";

import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ArrowRight, Check } from "lucide-react";

// Yearly is ten months' price on every tier — pay for 10, get 12. One rule
// across the table keeps the discount easy to explain and easy to verify.
const plans = [
  {
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "Enough to run a real list and see whether this fits you.",
    features: [
      "500 contacts",
      "2,000 emails a month",
      "1 sending domain",
      "1 signup form",
      "7 days of analytics",
      "Full block editor",
    ],
    includesLabel: "Free includes",
    cta: "Start free",
  },
  {
    name: "Starter",
    monthlyPrice: 499,
    yearlyPrice: 4999,
    description: "For a newsletter going out to a few thousand people.",
    features: [
      "3,000 contacts",
      "15,000 emails a month",
      "2 sending domains",
      "Unlimited signup forms",
      "Full analytics history",
      "Email support",
    ],
    includesLabel: "Everything in Free, plus",
    cta: "Choose Starter",
    featured: true,
  },
  {
    name: "Growth",
    monthlyPrice: 1499,
    yearlyPrice: 14999,
    description: "For orgs sending to a larger list, more than once a month.",
    features: [
      "10,000 contacts",
      "50,000 emails a month",
      "5 sending domains",
      "Automations",
      "Team roles and invites",
      "Priority support",
    ],
    includesLabel: "Everything in Starter, plus",
    cta: "Choose Growth",
  },
];

type BillingCycle = "monthly" | "yearly";

function positionPill(
  pill: HTMLSpanElement,
  tab: HTMLButtonElement,
  animate: boolean,
) {
  if (!animate) {
    const previousTransition = pill.style.transition;
    pill.style.transition = "none";
    pill.style.transform = `translateX(${tab.offsetLeft}px)`;
    pill.style.width = `${tab.offsetWidth}px`;
    void pill.offsetWidth;
    pill.style.transition = previousTransition;
    return;
  }

  pill.style.transform = `translateX(${tab.offsetLeft}px)`;
  pill.style.width = `${tab.offsetWidth}px`;
}

export function Pricing02() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const pillRef = useRef<HTMLSpanElement>(null);
  const monthlyTabRef = useRef<HTMLButtonElement>(null);
  const yearlyTabRef = useRef<HTMLButtonElement>(null);
  const priceRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const hasMounted = useRef(false);

  useLayoutEffect(() => {
    const pill = pillRef.current;
    const activeTab = monthlyTabRef.current;
    if (!pill || !activeTab) return;

    positionPill(pill, activeTab, false);

    const handleResize = () => {
      const currentTab =
        yearlyTabRef.current?.getAttribute("aria-selected") === "true"
          ? yearlyTabRef.current
          : monthlyTabRef.current;
      if (pill && currentTab) positionPill(pill, currentTab, false);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    const pill = pillRef.current;
    const activeTab =
      billingCycle === "monthly" ? monthlyTabRef.current : yearlyTabRef.current;
    if (pill && activeTab) positionPill(pill, activeTab, true);

    priceRefs.current.forEach((group) => {
      if (!group) return;
      group.classList.remove("is-animating");
      void group.offsetHeight;
      group.classList.add("is-animating");
    });
  }, [billingCycle]);

  return (
    <section className="pricing-02 relative min-h-screen overflow-hidden bg-white px-4 py-20 text-[#172033] transition-colors duration-300 dark:bg-[#101010] dark:text-white sm:px-6 lg:px-8 lg:py-28">
      <style>{`
        .pricing-02 {
          --digit-dur: 500ms;
          --digit-distance: 8px;
          --digit-stagger: 70ms;
          --digit-blur: 2px;
          --digit-ease: cubic-bezier(0.34, 1.45, 0.64, 1);
          --digit-dir-x: 0;
          --digit-dir-y: 1;
          --tabs-dur: 250ms;
          --tabs-ease: cubic-bezier(0.22, 1, 0.36, 1);
          --tabs-text-muted: rgba(71, 85, 105, 0.82);
          --tabs-text-hover: #334155;
          --tabs-text-active: #ffffff;
          --tabs-bar-bg: #ffffff;
          --tabs-pill-bg: #172033;
        }

        .dark .pricing-02 {
          --tabs-text-muted: rgba(161, 161, 170, 0.76);
          --tabs-text-hover: #f4f4f5;
          --tabs-text-active: #18181b;
          --tabs-bar-bg: #1a1a1a;
          --tabs-pill-bg: #f4f4f5;
        }

        @keyframes t-digit-pop-in {
          0% {
            transform: translate(
              calc(var(--digit-distance) * var(--digit-dir-x)),
              calc(var(--digit-distance) * var(--digit-dir-y))
            );
            opacity: 0;
            filter: blur(var(--digit-blur));
          }
          100% {
            transform: translate(0, 0);
            opacity: 1;
            filter: blur(0);
          }
        }

        .t-digit-group {
          display: inline-flex;
          align-items: baseline;
        }
        .t-digit {
          display: inline-block;
          will-change: transform, opacity, filter;
        }
        .t-digit-group.is-animating .t-digit {
          animation: t-digit-pop-in var(--digit-dur) var(--digit-ease) both;
        }
        .t-digit-group.is-animating .t-digit[data-stagger="1"] {
          animation-delay: var(--digit-stagger);
        }
        .t-digit-group.is-animating .t-digit[data-stagger="2"] {
          animation-delay: calc(var(--digit-stagger) * 2);
        }

        .t-tabs {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 3px;
          border-radius: 48px;
          background: var(--tabs-bar-bg);
        }
        .t-tab {
          position: relative;
          appearance: none;
          border: 0;
          background: transparent;
          height: 30px;
          padding: 4px 12px;
          color: var(--tabs-text-muted);
          cursor: pointer;
          border-radius: 48px;
          z-index: 1;
          transition: color var(--tabs-dur) var(--tabs-ease);
        }
        .t-tab:not([aria-selected="true"]):hover {
          color: var(--tabs-text-hover);
        }
        .t-tab[aria-selected="true"] {
          color: var(--tabs-text-active);
        }

        .t-tabs-pill {
          position: absolute;
          top: 3px;
          left: 0;
          height: 30px;
          width: 0;
          background: var(--tabs-pill-bg);
          border-radius: 48px;
          transform: translateX(0);
          transition:
            transform var(--tabs-dur) var(--tabs-ease),
            width var(--tabs-dur) var(--tabs-ease);
          will-change: transform, width;
          z-index: 0;
          pointer-events: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .t-digit-group .t-digit {
            animation: none !important;
          }
          .t-tabs-pill,
          .t-tab {
            transition: none !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 md:grid-cols-12 md:items-end">
          <div className="md:col-span-6">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
              Pricing
            </p>
            <h2 className="mt-4 max-w-xl text-4xl font-medium leading-[1.02] tracking-[-0.045em] sm:text-5xl">
              Priced for the
              <br />
              list you actually have.
            </h2>
          </div>
          <div className="md:col-span-4 md:col-start-9">
            <p className="max-w-md text-sm leading-6 text-slate-500 dark:text-zinc-400">
              Plans are sized by contacts, not by how much you send — so
              emailing your list more often never costs you more. Change plan
              or cancel whenever you like.
            </p>
            <div
              className="t-tabs mt-5 border border-slate-200 text-xs shadow-sm dark:border-zinc-700 dark:shadow-none"
              role="tablist"
              aria-label="Billing cycle"
            >
              <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
              <button
                ref={monthlyTabRef}
                type="button"
                role="tab"
                aria-selected={billingCycle === "monthly"}
                className={`t-tab font-medium ${
                  billingCycle === "monthly"
                    ? "text-white dark:text-zinc-950"
                    : ""
                }`}
                onClick={() => setBillingCycle("monthly")}
              >
                Monthly
              </button>
              <button
                ref={yearlyTabRef}
                type="button"
                role="tab"
                aria-selected={billingCycle === "yearly"}
                className={`t-tab font-medium ${
                  billingCycle === "yearly"
                    ? "text-white dark:text-zinc-950"
                    : ""
                }`}
                onClick={() => setBillingCycle("yearly")}
              >
                Yearly · 2 months free
              </button>
            </div>
          </div>
        </div>

        <div className="relative mt-12 grid gap-3 lg:grid-cols-3">
          {plans.map((plan, planIndex) => (
            <article
              key={plan.name}
              className="group relative isolate flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/70 p-2 shadow-[0_18px_55px_-46px_rgba(15,23,42,0.35)] transition-[border-color,box-shadow] duration-500 ease-out hover:border-slate-300 hover:shadow-[0_24px_70px_-50px_rgba(15,23,42,0.52)] dark:border-white/[0.08] dark:bg-[#151515] dark:shadow-[0_18px_55px_-46px_rgba(0,0,0,0.95)] dark:hover:border-white/[0.15] dark:hover:shadow-[0_24px_70px_-48px_rgba(0,0,0,1)] lg:min-h-[640px]"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 z-0 h-72 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(148,163,184,0.16),transparent_66%)] opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100 dark:bg-[radial-gradient(ellipse_at_50%_-20%,rgba(255,255,255,0.09),transparent_64%)]"
              />

              <div
                className={`relative z-10 flex min-h-[248px] flex-col rounded-xl p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.06),inset_0_8px_18px_-20px_rgba(15,23,42,0.45),inset_0_-8px_18px_-22px_rgba(15,23,42,0.4)] transition-[background-color,box-shadow] duration-500 ease-out group-hover:shadow-[0_0_0_1px_rgba(0,0,0,0.075),inset_0_8px_18px_-20px_rgba(15,23,42,0.45),inset_0_-8px_18px_-22px_rgba(15,23,42,0.4)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.085),inset_0_8px_18px_-20px_rgba(255,255,255,0.45),inset_0_-8px_18px_-22px_rgba(255,255,255,0.4)] dark:group-hover:shadow-[0_0_0_1px_rgba(255,255,255,0.105),inset_0_8px_18px_-20px_rgba(255,255,255,0.45),inset_0_-8px_18px_-22px_rgba(255,255,255,0.4)] ${
                  plan.featured
                    ? "bg-[radial-gradient(circle_at_50%_0%,#eef2f7_0%,#ffffff_62%)] dark:bg-[radial-gradient(circle_at_50%_0%,#292929_0%,#1a1a1a_62%)]"
                    : "bg-white dark:bg-[#1a1a1a]"
                }`}
              >
                <div>
                  <p className="text-base font-medium">{plan.name}</p>
                  <p className="mt-2 min-h-12 max-w-xs text-sm leading-6 text-slate-500 dark:text-zinc-400">
                    {plan.description}
                  </p>
                </div>

                <div className="mt-4 flex min-h-10 items-end gap-1.5">
                  <span
                    ref={(element) => {
                      priceRefs.current[planIndex] = element;
                    }}
                    className="t-digit-group text-4xl font-medium leading-none tracking-[-0.045em]"
                    style={
                      {
                        "--digit-dir-y": billingCycle === "yearly" ? 1 : -1,
                      } as CSSProperties
                    }
                  >
                    {`₹${(billingCycle === "monthly"
                      ? plan.monthlyPrice
                      : plan.yearlyPrice
                    ).toLocaleString("en-IN")}`
                      .split("")
                      .map((character, index, characters) => (
                        <span
                          key={`${billingCycle}-${index}-${character}`}
                          className="t-digit"
                          data-stagger={
                            index === characters.length - 2
                              ? "1"
                              : index === characters.length - 1
                                ? "2"
                                : undefined
                          }
                        >
                          {character}
                        </span>
                      ))}
                  </span>
                  <span className="pb-1 text-sm text-slate-400 dark:text-zinc-500">
                    / {billingCycle === "monthly" ? "month" : "year"}
                  </span>
                </div>

                <a
                  href="#"
                  className={`mt-auto flex h-10 items-center justify-between rounded-lg px-4 text-sm font-medium transition-[background-color,color,transform] duration-300 active:scale-[0.99] ${
                    plan.featured
                      ? "bg-[#172033] text-white hover:bg-slate-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
                      : "border border-slate-200 bg-white text-[#172033] hover:border-slate-300 hover:bg-slate-50 dark:border-white/[0.1] dark:bg-transparent dark:text-zinc-100 dark:hover:border-white/[0.16] dark:hover:bg-white/[0.04]"
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </a>
              </div>

              <div className="relative z-10 flex flex-1 flex-col px-4 pb-5 pt-8 sm:px-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-slate-400 dark:text-zinc-500">
                  {plan.includesLabel}
                </p>

                <ul className="mt-5 space-y-4">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-zinc-300"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        <Check className="size-3" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-2 text-xs text-slate-400 dark:text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p>No card needed on Free. Pay by UPI, card, or netbanking.</p>
          <p>Prices in INR, exclusive of GST.</p>
        </div>
      </div>
    </section>
  );
}
