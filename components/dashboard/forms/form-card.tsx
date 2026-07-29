"use client";

import { useState } from "react";
import {
  CheckIcon,
  CodeIcon,
  CopyIcon,
  ExternalLinkIcon,
  PencilIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";

import { confirmDialog } from "@/components/app-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/coss-dialog";
import { ScaledPreview } from "./scaled-preview";
import type { SignupFormRow } from "./types";

// Gallery card for a signup form: a live preview thumbnail up top (like the
// templates page), name + badges below. Clicking the card opens the details
// dialog with the embed snippet and hosted link; the corner icon opens the
// real hosted preview in a new tab.
export function FormCard({
  form,
  baseUrl,
  onEdit,
  onDeleted,
}: {
  form: SignupFormRow;
  baseUrl: string;
  onEdit: (form: SignupFormRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const hostedUrl = `${baseUrl}/s/${form.publicKey}`;
  // Popup and animated forms are dismissable on the host site, so their
  // thumbnails wear the little close dot; a static section has none.
  const showClose = form.formType === "popup" || form.formType === "animated";

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setDetailsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setDetailsOpen(true);
          }
        }}
        aria-label={`Open details for ${form.name}`}
        className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-all hover:border-primary hover:shadow-md focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {/* Preview band */}
        <div className="relative h-[190px] w-full border-b border-border bg-muted/50 p-4">
          <div className="relative h-full overflow-hidden rounded-lg border border-border shadow-sm">
            <ScaledPreview settings={form} scale={85} />
            {showClose && (
              <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full border border-border bg-background/90 text-[9px] leading-none text-muted-foreground shadow-sm">
                ✕
              </span>
            )}
          </div>
          {/* Live preview in a new tab — the only action on the card face. */}
          <a
            href={hostedUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            aria-label={`Open live preview of ${form.name} in a new tab`}
            title="Open live preview"
            className="absolute right-2.5 top-2.5 z-10 flex size-7 items-center justify-center rounded-md border border-border bg-background/90 text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-foreground"
          >
            <ExternalLinkIcon className="size-3.5" />
          </a>
        </div>

        {/* Meta row */}
        <div className="flex w-full items-center justify-between gap-3 p-3.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{form.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {form.headline}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant="outline" className="capitalize">
              {form.formType ?? "static"}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <UsersIcon className="size-3" />
              {form.subscriberCount}
            </Badge>
          </div>
        </div>
      </div>

      <FormDetailsDialog
        form={form}
        baseUrl={baseUrl}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onEdit={onEdit}
        onDeleted={onDeleted}
      />
    </>
  );
}

// Everything that used to live on the card face: the embed snippet, the
// hosted link, and the edit/delete actions.
function FormDetailsDialog({
  form,
  baseUrl,
  open,
  onOpenChange,
  onEdit,
  onDeleted,
}: {
  form: SignupFormRow;
  baseUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (form: SignupFormRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hostedUrl = `${baseUrl}/s/${form.publicKey}`;
  const embedSnippet = `<script src="${baseUrl}/embed/${form.publicKey}" async></script>`;

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(
        () => setCopied((current) => (current === key ? null : current)),
        1500,
      );
    } catch {
      // Clipboard unavailable — nothing sensible to do.
    }
  }

  async function remove() {
    const ok = await confirmDialog({
      title: `Delete "${form.name}"?`,
      description:
        "Its hosted page and embed script stop working immediately. People already subscribed stay on your list.",
      confirmLabel: "Delete form",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/forms/${form.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        onOpenChange(false);
        onDeleted(form.id);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate">{form.name}</DialogTitle>
          <DialogDescription>
            <span className="capitalize">{form.formType ?? "static"}</span> form
            · {form.subscriberCount}{" "}
            {form.subscriberCount === 1 ? "subscriber" : "subscribers"}
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="flex flex-col gap-5">
          {/* Embed snippet */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CodeIcon className="size-3.5" />
              Embed on your site
            </div>
            <div className="flex items-stretch gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs whitespace-nowrap">
                {embedSnippet}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void copy("embed", embedSnippet)}
              >
                {copied === "embed" ? (
                  <CheckIcon data-icon="inline-start" />
                ) : (
                  <CopyIcon data-icon="inline-start" />
                )}
                {copied === "embed" ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste this one line wherever you want the form to appear.
            </p>
          </div>

          {/* Hosted link */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-medium text-muted-foreground">
              Or share a direct link
            </div>
            <div className="flex items-stretch gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs whitespace-nowrap">
                {hostedUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void copy("link", hostedUrl)}
              >
                {copied === "link" ? (
                  <CheckIcon data-icon="inline-start" />
                ) : (
                  <CopyIcon data-icon="inline-start" />
                )}
                {copied === "link" ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        </DialogPanel>

        <DialogFooter className="justify-between gap-2 sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void remove()}
            disabled={busy}
            className="text-destructive hover:text-destructive"
          >
            <Trash2Icon data-icon="inline-start" />
            Delete
          </Button>
          <Button size="sm" onClick={() => onEdit(form)}>
            <PencilIcon data-icon="inline-start" />
            Edit form
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
