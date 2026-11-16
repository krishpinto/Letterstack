"use client";

import { useEffect, useState } from "react";
import {
  CircleCheckIcon,
  MailCheckIcon,
  XIcon,
} from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import {
  ExpandableScreen,
  ExpandableScreenContent,
  ExpandableScreenTrigger,
  useExpandableScreen,
} from "@/components/ui/expandable-screen";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { CONTACT_HASH, OPEN_CONTACT_EVENT } from "@/components/marketing/contact-link";
import { cn } from "@/lib/utils";

import { button, displayFont } from "./landing-ui";

// Linear-style "Contact sales" takeover: the pill button in the CTA band is
// the morph origin, and the screen expands out of it (same pattern as the
// create-workspace screen) into a two-column contact form.

// Shown to visitors and used for the mailto: fallback. Public by nature, but
// configured rather than hard-coded so a self-hosted deployment shows its own
// address.
const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@letterstack.site";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COMPANY_SIZES = ["Just me", "2–10", "11–50", "51–200", "200+"] as const;

const TALKING_POINTS = [
  "Get a guided walkthrough of LetterStack",
  "Find the right setup for your list size",
  "Get help with onboarding and your first send",
];

/**
 * Opens the form when something elsewhere asks for it: the navbar's Contact
 * link fires OPEN_CONTACT_EVENT, and links from other pages arrive with
 * CONTACT_HASH in the URL.
 */
function OpenOnRequest() {
  const { expand } = useExpandableScreen();
  useEffect(() => {
    window.addEventListener(OPEN_CONTACT_EVENT, expand);
    if (window.location.hash === CONTACT_HASH) {
      // Drop the hash so a reload or a later visit doesn't reopen the form.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      expand();
    }
    return () => window.removeEventListener(OPEN_CONTACT_EVENT, expand);
  }, [expand]);
  return null;
}

function CloseButton({ onClose }: { onClose: () => void }) {
  const { collapse } = useExpandableScreen();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 rounded-full text-muted-foreground hover:text-foreground"
      onClick={() => {
        collapse();
        onClose();
      }}
      aria-label="Close"
    >
      <XIcon className="size-4" />
    </Button>
  );
}

export function ContactSalesScreen({
  triggerClassName,
}: {
  /** Extra classes for the "Contact us" button, e.g. to restyle it on a dark background. */
  triggerClassName?: string;
} = {}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setEmail("");
    setCompanySize("");
    setMessage("");
    setSent(false);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError("Please tell us your name.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!message.trim()) {
      setError("Tell us a little about what you need.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          companySize,
          message: message.trim(),
        }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        throw new Error(data?.error ?? "Could not send your message.");
      }
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send your message.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <ExpandableScreen
      layoutId="contact-sales-screen"
      animationDuration={0.35}
      triggerRadius="8px"
      contentRadius="14px"
    >
      <OpenOnRequest />
      <ExpandableScreenTrigger>
        <button type="button" className={cn(button.secondary, triggerClassName)}>
          Contact us
        </button>
      </ExpandableScreenTrigger>

      <ExpandableScreenContent
        showCloseButton={false}
        label="Contact the LetterStack team"
        className="border border-border bg-background"
      >
        {/* text-left: the trigger lives in a text-center CTA band, and the
            fixed takeover would inherit that alignment. */}
        <div className="flex min-h-full flex-col px-6 py-6 text-left sm:px-10">
          {/* ── Top row: brand + close ── */}
          <div className="flex shrink-0 items-center justify-between">
            <span className="flex items-center gap-2">
              <BrandLogo className="size-8" aria-hidden />
              <span className="text-sm font-semibold">LetterStack</span>
            </span>
            <CloseButton onClose={reset} />
          </div>

          {/* ── Two columns: pitch left, form right ── */}
          <div className="mx-auto grid w-full max-w-5xl flex-1 gap-12 pb-16 pt-[10vh] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-20">
            <div>
              {/* h2: the page behind already has the one h1. */}
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl" style={displayFont}>
                Talk to the team
              </h2>
              <ul className="mt-8 flex flex-col gap-4">
                {TALKING_POINTS.map((point) => (
                  <li key={point} className="flex items-center gap-3 text-sm">
                    <CircleCheckIcon className="size-4 shrink-0 text-primary" />
                    {point}
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-sm text-muted-foreground">
                Technical issues or product questions?{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Email us directly
                </a>
              </p>
            </div>

            {sent ? (
              <div className="flex flex-col items-start justify-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MailCheckIcon className="size-5" />
                </span>
                <h2 className="text-lg font-semibold">Message sent</h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Thanks, {name.trim().split(" ")[0] || "there"}. We read every message
                  and will get back to you at {email.trim()} soon.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid gap-5">
                <p className="text-sm font-medium">Tell us how we can help</p>

                <div className="grid gap-2">
                  <label htmlFor="contact-name" className="text-sm">
                    Full name
                  </label>
                  <Input
                    id="contact-name"
                    value={name}
                    disabled={sending}
                    placeholder="Your name"
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <label htmlFor="contact-email" className="text-sm">
                    Email
                  </label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={email}
                    disabled={sending}
                    placeholder="you@yourclub.org"
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <span id="contact-size-label" className="text-sm">
                    Organisation size
                  </span>
                  <Select
                    value={companySize}
                    onValueChange={setCompanySize}
                    disabled={sending}
                  >
                    <SelectTrigger className="w-full" aria-labelledby="contact-size-label">
                      <SelectValue placeholder="Select a size" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZES.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <label htmlFor="contact-message" className="text-sm">
                    Tell us about your requirements
                  </label>
                  <Textarea
                    id="contact-message"
                    value={message}
                    disabled={sending}
                    rows={4}
                    placeholder="I'm interested in LetterStack for my newsletter..."
                    onChange={(event) => setMessage(event.target.value)}
                  />
                </div>

                {/* role="alert": read out as soon as it appears. */}
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <Button
                    type="submit"
                    disabled={sending}
                    className="h-10 rounded-lg bg-neutral-950 px-5 text-white hover:bg-neutral-800"
                  >
                    {sending && <Spinner data-icon="inline-start" />}
                    {sending ? "Sending..." : "Send message"}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    You can also email us at{" "}
                    <a
                      href={`mailto:${CONTACT_EMAIL}`}
                      className="font-medium text-foreground underline underline-offset-4"
                    >
                      {CONTACT_EMAIL}
                    </a>
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </ExpandableScreenContent>
    </ExpandableScreen>
  );
}
