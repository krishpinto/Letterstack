"use client";

// The dashboard product tour.
//
// One pass down the icon rail, module by module, finishing on the Getting
// Started checklist — so someone who has just created a workspace learns what
// every icon is before being handed a list of things to do with them.
//
// Selectors are plain ids set where the element is rendered
// (`components/protected-shell/icon-rail.tsx`,
// `components/dashboard/getting-started.tsx`). Keep them in sync: Onborda
// silently skips a step whose selector matches nothing.

import type { OnbordaProps } from "onborda";
import {
  BarChart3Icon,
  GlobeIcon,
  LayoutDashboardIcon,
  LayoutTemplateIcon,
  MailPlusIcon,
  SendIcon,
  SettingsIcon,
  SparklesIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";

/** The tour name passed to `startOnborda()`. */
export const DASHBOARD_TOUR = "dashboard";

// `Tour` isn't re-exported from the package index, so it's derived from what
// the component actually accepts — which can't drift from the real prop type.
type Tour = OnbordaProps["steps"][number];

const iconClass = "size-4";

/**
 * Every element the tour points at.
 *
 * Onborda decides whether to scroll a step's target into view by observing its
 * own highlight box, not the target — and when that reads false it calls
 * `scrollIntoView` regardless of whether the target was already visible. The
 * dashboard shell is `h-screen` with nested `overflow-hidden` containers, which
 * are still scrollable programmatically, so that call drags the whole layout
 * (rail included) up or down. Nothing the tour points at can ever be off
 * screen here, so the scroll is suppressed on these elements while the tour is
 * open — see `tour-provider.tsx`.
 */
export const TOUR_SELECTORS = [
  "#tour-rail-home",
  "#tour-rail-campaigns",
  "#tour-rail-audience",
  "#tour-rail-templates",
  "#tour-rail-automations",
  "#tour-rail-forms",
  "#tour-rail-domains",
  "#tour-rail-settings",
  "#tour-getting-started",
];

export const tours: Tour[] = [
  {
    tour: DASHBOARD_TOUR,
    steps: [
      {
        icon: <LayoutDashboardIcon className={iconClass} />,
        title: "This is your workspace",
        content: (
          <>
            Everything for one organisation lives here — its audience, its
            campaigns and its sending. This home page shows how your last sends
            performed. Let&apos;s walk the rail on the left.
          </>
        ),
        selector: "#tour-rail-home",
        side: "right-top",
        pointerPadding: 6,
        pointerRadius: 12,
      },
      {
        icon: <SendIcon className={iconClass} />,
        title: "Campaigns",
        content: (
          <>
            Where you create, schedule and send a newsletter. Every campaign
            keeps its own copy of your recipient list, so editing your audience
            later never changes something you already sent.
          </>
        ),
        selector: "#tour-rail-campaigns",
        side: "right-top",
        pointerPadding: 6,
        pointerRadius: 12,
      },
      {
        icon: <UsersIcon className={iconClass} />,
        title: "Audience",
        content: (
          <>
            Your contacts. Import a CSV or Excel file and we validate, dedupe
            and clean it on the way in. Addresses that hard-bounce or complain
            are suppressed automatically and stay out of every future send.
          </>
        ),
        selector: "#tour-rail-audience",
        side: "right-top",
        pointerPadding: 6,
        pointerRadius: 12,
      },
      {
        icon: <LayoutTemplateIcon className={iconClass} />,
        title: "Templates",
        content: (
          <>
            Reusable designs. Build one in the block editor and start every
            campaign from it — the output is real responsive HTML, not a
            flattened image.
          </>
        ),
        selector: "#tour-rail-templates",
        side: "right-top",
        pointerPadding: 6,
        pointerRadius: 12,
      },
      {
        icon: <WorkflowIcon className={iconClass} />,
        title: "Automations",
        content: (
          <>
            Emails that send themselves on a trigger — a welcome message the
            moment somebody subscribes, for example, rather than a campaign you
            press send on.
          </>
        ),
        selector: "#tour-rail-automations",
        side: "right-top",
        pointerPadding: 6,
        pointerRadius: 12,
      },
      {
        icon: <MailPlusIcon className={iconClass} />,
        title: "Forms",
        content: (
          <>
            Signup forms you can embed on your own site. New subscribers land
            straight in your audience here, confirmed by double opt-in.
          </>
        ),
        selector: "#tour-rail-forms",
        side: "right-top",
        pointerPadding: 6,
        pointerRadius: 12,
      },
      {
        icon: <GlobeIcon className={iconClass} />,
        title: "Domains",
        content: (
          <>
            Send from your own domain instead of our shared one. We walk you
            through the DNS records that authenticate it, which is what keeps
            your mail out of the spam folder.
          </>
        ),
        selector: "#tour-rail-domains",
        side: "right-top",
        pointerPadding: 6,
        pointerRadius: 12,
      },
      {
        icon: <SettingsIcon className={iconClass} />,
        title: "Settings",
        content: (
          <>
            Workspace details, teammates, your plan and billing. Your sending
            allowance and contact limit live here too.
          </>
        ),
        selector: "#tour-rail-settings",
        side: "right-bottom",
        pointerPadding: 6,
        pointerRadius: 12,
      },
      {
        icon: <BarChart3Icon className={iconClass} />,
        title: "Results, after you send",
        content: (
          <>
            Delivered, opened, clicked, bounced — per campaign, straight from
            the mail servers that accepted it. Delivery and bounce numbers are
            exact; opens are an estimate, because some mail apps block the
            tracking pixel.
          </>
        ),
        selector: "#tour-rail-campaigns",
        side: "right-top",
        pointerPadding: 6,
        pointerRadius: 12,
      },
      {
        icon: <SparklesIcon className={iconClass} />,
        title: "Start here",
        content: (
          <>
            This checklist is the shortest path to your first send: add your
            audience, design an email, send it. It ticks itself off as you go
            and disappears once you&apos;re set up.
          </>
        ),
        selector: "#tour-getting-started",
        side: "bottom",
        pointerPadding: 8,
        pointerRadius: 22,
      },
    ],
  },
];
