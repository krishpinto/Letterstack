"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormPreview } from "@/components/dashboard/forms/form-preview";
import { FORM_TEMPLATES } from "@/components/dashboard/forms/templates";
import type { SignupFormSettingsInput } from "@/components/dashboard/forms/types";
import type { FormType } from "@/db/signup-forms";
import { cn } from "@/lib/utils";

// Mailchimp-style create flow: first pick HOW the form appears on the host
// site (static / popup / animated — each with a looping example), then pick a
// starting template. Picking a template creates the form and opens the editor.

const FORM_TYPES: {
  type: FormType;
  title: string;
  description: string;
}[] = [
  {
    type: "static",
    title: "Static form",
    description:
      "Lives inside your page as a section — drop it in a footer, sidebar, or anywhere in your content.",
  },
  {
    type: "popup",
    title: "Popup form",
    description:
      "Opens over the page in a modal overlay — great for offers and grabbing attention.",
  },
  {
    type: "animated",
    title: "Animated form",
    description:
      "Slides into the corner of the page with motion — present without interrupting reading.",
  },
];

// ─── Mini illustrations: a tiny fake webpage per type ────────────────────────

/** Skeleton text lines standing in for the host page's content. */
function PageLines({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="h-1.5 w-3/5 rounded-full bg-foreground/15" />
      <div className="h-1.5 w-full rounded-full bg-foreground/8" />
      <div className="h-1.5 w-full rounded-full bg-foreground/8" />
      <div className="h-1.5 w-4/5 rounded-full bg-foreground/8" />
    </div>
  );
}

/** The mini signup form itself: label, input bar, accent button. */
function FormChip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-md border border-border bg-background p-2 shadow-md",
        className,
      )}
    >
      <div className="h-1.5 w-1/2 rounded-full bg-foreground/30" />
      <div className="h-3 w-full rounded-sm border border-border bg-muted/60" />
      <div className="h-3 w-2/5 rounded-sm bg-primary" />
    </div>
  );
}

/** Shared browser-window frame around each type illustration. */
function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none relative h-40 select-none overflow-hidden rounded-lg border border-border bg-muted/40">
      <div className="flex items-center gap-1 border-b border-border bg-background/60 px-2.5 py-1.5">
        <span className="size-1.5 rounded-full bg-foreground/15" />
        <span className="size-1.5 rounded-full bg-foreground/15" />
        <span className="size-1.5 rounded-full bg-foreground/15" />
      </div>
      <div className="relative h-full p-3">{children}</div>
    </div>
  );
}

function StaticIllustration() {
  return (
    <BrowserFrame>
      <PageLines />
      <FormChip className="mt-2.5 w-3/5" />
      <PageLines className="mt-2.5" />
    </BrowserFrame>
  );
}

function PopupIllustration({ animate }: { animate: boolean }) {
  return (
    <BrowserFrame>
      <PageLines />
      <PageLines className="mt-2.5" />
      <motion.div
        className="absolute inset-0 bg-foreground/25"
        initial={false}
        animate={animate ? { opacity: [0, 1, 1, 0] } : { opacity: 1 }}
        transition={
          animate
            ? { duration: 3.6, times: [0, 0.12, 0.88, 1], repeat: Infinity, repeatDelay: 0.8 }
            : undefined
        }
      />
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={false}
        animate={
          animate
            ? { opacity: [0, 1, 1, 0], scale: [0.85, 1, 1, 0.85] }
            : { opacity: 1, scale: 1 }
        }
        transition={
          animate
            ? { duration: 3.6, times: [0, 0.12, 0.88, 1], repeat: Infinity, repeatDelay: 0.8 }
            : undefined
        }
      >
        <FormChip className="w-1/2" />
      </motion.div>
    </BrowserFrame>
  );
}

function AnimatedIllustration({ animate }: { animate: boolean }) {
  return (
    <BrowserFrame>
      <PageLines />
      <PageLines className="mt-2.5" />
      <motion.div
        className="absolute bottom-3 right-3 w-1/2"
        initial={false}
        animate={
          animate
            ? { opacity: [0, 1, 1, 0], y: [28, 0, 0, 28] }
            : { opacity: 1, y: 0 }
        }
        transition={
          animate
            ? { duration: 3.6, times: [0, 0.15, 0.85, 1], repeat: Infinity, repeatDelay: 0.8 }
            : undefined
        }
      >
        <FormChip />
      </motion.div>
    </BrowserFrame>
  );
}

// ─── Template showcase cards (Mailchimp-style: mobile + desktop preview) ─────

/**
 * The form art uses fixed pixel sizes, so narrow frames render it oversized
 * and scale down — the thumbnail trick — to keep both frames faithful.
 */
function ScaledPreview({
  settings,
  scale,
}: {
  settings: SignupFormSettingsInput;
  scale: number;
}) {
  // scale is a percentage (70 → 0.7): the box must be oversized by its
  // reciprocal, also in percent — 70% scale means a 10000/70 ≈ 143% box.
  const inverse = 10000 / scale;
  return (
    <div className="h-full w-full overflow-hidden">
      <div
        // Size/transform are derived from the scale prop — inline by necessity.
        style={{
          width: `${inverse}%`,
          height: `${inverse}%`,
          transform: `scale(${scale / 100})`,
          transformOrigin: "top left",
        }}
      >
        <FormPreview settings={settings} className="h-full w-full" />
      </div>
    </div>
  );
}

function TemplateShowcaseCard({
  title,
  settings,
  formType,
  disabled,
  onSelect,
}: {
  title: string;
  settings: SignupFormSettingsInput;
  formType: FormType;
  disabled: boolean;
  onSelect: () => void;
}) {
  // Popup and animated forms are dismissable on the host site, so their
  // previews wear the little close dot; a static section has none.
  const showClose = formType !== "static";

  const closeDot = (
    <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full border border-border bg-background/90 text-[9px] leading-none text-muted-foreground shadow-sm">
      ✕
    </span>
  );

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-all hover:border-primary hover:shadow-md focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-60"
    >
      {/* Preview band: the same form in a mobile and a desktop frame. */}
      <div className="flex h-[230px] w-full items-stretch gap-3 border-b border-border bg-muted/50 p-4">
        <div className="relative w-[38%] overflow-hidden rounded-lg border border-border shadow-sm">
          <ScaledPreview settings={settings} scale={70} />
          {showClose && closeDot}
        </div>
        <div className="relative flex-1 overflow-hidden rounded-lg border border-border shadow-sm">
          <ScaledPreview settings={settings} scale={90} />
          {showClose && closeDot}
        </div>
      </div>

      <div className="flex w-full items-center justify-between gap-3 p-3.5">
        <p className="truncate text-sm font-semibold">{title}</p>
        <div className="flex shrink-0 gap-1.5">
          <Badge variant="secondary" className="capitalize">
            {settings.layout}
          </Badge>
          <Badge variant="secondary" className="capitalize">
            {settings.theme}
          </Badge>
        </div>
      </div>
    </button>
  );
}

// ─── The flow ────────────────────────────────────────────────────────────────

type Step = "type" | "template";

export default function NewFormPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState<Step>("type");
  const [formType, setFormType] = useState<FormType | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickType(type: FormType) {
    setFormType(type);
    setStep("template");
  }

  async function pickTemplate(settings: SignupFormSettingsInput) {
    if (!formType) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          formType,
          name: settings.name || "Untitled form",
        }),
      });
      const data = await res.json();
      if (data.ok && data.form) {
        router.push(`/editor/form/${data.form.id}`);
      } else {
        setError(data.error ?? "Could not create the form.");
        setCreating(false);
      }
    } catch {
      setError("Could not reach the server.");
      setCreating(false);
    }
  }

  const animate = !reduceMotion;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      {/* ── Header: back, title, step breadcrumb ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" className="mt-0.5" asChild>
            <Link href="/dashboard/forms" aria-label="Back to forms">
              <ChevronLeftIcon className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Create a form</h1>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setStep("type")}
                className={cn(
                  "cursor-pointer underline-offset-4 transition-colors",
                  step === "type"
                    ? "font-medium text-foreground underline"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Type
              </button>
              <ChevronRightIcon className="size-3 text-muted-foreground/60" />
              <span
                className={cn(
                  step === "template"
                    ? "font-medium text-foreground underline underline-offset-4"
                    : "text-muted-foreground/60",
                )}
              >
                Template
              </span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/forms">Exit</Link>
        </Button>
      </div>

      {step === "type" ? (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-base font-semibold">
              How should your form appear?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              All three collect subscribers the same way — the difference is how
              they show up on your website.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FORM_TYPES.map((entry) => (
              <button
                key={entry.type}
                type="button"
                onClick={() => pickType(entry.type)}
                className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-primary hover:shadow-md focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {entry.type === "static" ? (
                  <StaticIllustration />
                ) : entry.type === "popup" ? (
                  <PopupIllustration animate={animate} />
                ) : (
                  <AnimatedIllustration animate={animate} />
                )}
                <div>
                  <p className="text-sm font-semibold">{entry.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {entry.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-base font-semibold">Pick a starting point</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {FORM_TYPES.find((entry) => entry.type === formType)?.title ??
                "Form"}{" "}
              selected — now choose a template. You can customize everything in
              the editor after.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="grid gap-5 sm:grid-cols-2">
            {FORM_TEMPLATES.map((template) => (
              <TemplateShowcaseCard
                key={template.id}
                title={template.title}
                settings={template.settings}
                formType={formType ?? "static"}
                disabled={creating}
                onSelect={() => void pickTemplate(template.settings)}
              />
            ))}
          </div>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center gap-2 bg-background/70 text-sm text-muted-foreground backdrop-blur-sm">
          <Loader2Icon className="size-4 animate-spin" />
          Creating your form…
        </div>
      )}
    </div>
  );
}
