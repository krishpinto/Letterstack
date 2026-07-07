"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowRightIcon, LockKeyholeIcon } from "lucide-react";

import { compileEmailDocument } from "@/lib/email/compiler";
import {
  PREBUILT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type PrebuiltTemplate,
  type TemplateCategory,
} from "@/lib/email/templates";
import { STORAGE_KEY } from "@/lib/email/document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/coss-dialog";
import { Section } from "@/components/section";
import { SectionHeading } from "@/components/section-heading";
import { cn } from "@/lib/utils";

// Public, read-only template gallery: anyone can browse and preview what
// LetterStack ships with; using a template is where the login gate sits.

function TemplateThumb({ html, title }: { html: string; title: string }) {
  return (
    <div className="pointer-events-none relative aspect-[16/11] w-full select-none">
      <div className="absolute inset-x-8 top-7 bottom-0 overflow-hidden rounded-t-md bg-white shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
        <iframe
          title={`Preview of ${title}`}
          srcDoc={html}
          sandbox=""
          scrolling="no"
          tabIndex={-1}
          aria-hidden
          className="absolute left-0 top-0 origin-top-left border-0"
          style={{ width: "250%", height: "800%", transform: "scale(0.4)" }}
        />
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  onPreview,
  onUse,
}: {
  template: PrebuiltTemplate;
  onPreview: () => void;
  onUse: () => void;
}) {
  const html = useMemo(
    () => compileEmailDocument(template.build()).html,
    [template],
  );

  return (
    <div className="group flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted/40 transition-colors group-hover:border-border/80">
        <TemplateThumb html={html} title={template.title} />
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
          <Button variant="outline" size="sm" onClick={onPreview}>
            Preview
          </Button>
          <Button size="sm" onClick={onUse}>
            Use template
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-0.5">
        <span className="truncate text-sm font-medium">{template.title}</span>
        <Badge variant="secondary" className="shrink-0 text-xs capitalize">
          {template.category}
        </Badge>
      </div>
    </div>
  );
}

export default function PublicTemplatesPage() {
  const router = useRouter();
  const { status } = useSession();
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [preview, setPreview] = useState<PrebuiltTemplate | null>(null);
  const [gateOpen, setGateOpen] = useState(false);

  const previewHtml = useMemo(
    () => (preview ? compileEmailDocument(preview.build()).html : ""),
    [preview],
  );

  const filtered =
    category === "all"
      ? PREBUILT_TEMPLATES
      : PREBUILT_TEMPLATES.filter((t) => t.category === category);

  function applyTemplate(template: PrebuiltTemplate) {
    if (status !== "authenticated") {
      setGateOpen(true);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(template.build()));
      localStorage.setItem("letterstack-return-to", "/dashboard/templates");
    } catch {
      // Editor falls back to its default document if storage is unavailable.
    }
    router.push("/editor");
  }

  return (
    <Section className="[&>div>div:last-child]:py-0">
      <div className="py-20">
        <SectionHeading
          label="Templates"
          heading="Start from a template, ship in minutes."
          subheading="Every template compiles to responsive, email-safe HTML. Browse freely — sign in when you're ready to make one yours."
          align="left"
        />

        {/* Category filter */}
        <div className="mt-8 flex flex-wrap gap-2">
          {TEMPLATE_CATEGORIES.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setCategory(entry.key)}
              className={cn(
                "cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                category === entry.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {/* Gallery */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onPreview={() => setPreview(template)}
              onUse={() => applyTemplate(template)}
            />
          ))}
        </div>
      </div>

      {/* Full preview */}
      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogPopup className="h-[88vh] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden px-6 pb-3">
            <iframe
              title={`Full preview of ${preview?.title ?? "template"}`}
              srcDoc={previewHtml}
              sandbox=""
              className="h-full w-full rounded-lg border border-border bg-white"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                const t = preview;
                setPreview(null);
                if (t) applyTemplate(t);
              }}
            >
              Use this template
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Login gate */}
      <Dialog open={gateOpen} onOpenChange={setGateOpen}>
        <DialogPopup className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <span className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LockKeyholeIcon className="size-5" />
            </span>
            <DialogTitle>Sign in to use this template</DialogTitle>
            <DialogDescription>
              Browsing is free — editing and sending need an account. It takes
              under a minute.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Create free account</Link>
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </Section>
  );
}
